import { validateKinChoice } from "./kin";
/**
 * Сборка кампании Велории из анкеты: мир под персонажа + начальное состояние.
 *
 * Раньше эта логика жила в App.tsx в двух копиях, а собранный мир терялся:
 * интерфейс играл в базовом мире, где нет дворца, семьи и стартового окружения.
 * Теперь анкета сохраняется в GameState.campaign, и мир восстанавливается из неё
 * при каждой загрузке (см. worlds/registry.ts → rebuild).
 */
import type { GameState, WorldData } from "../../engine/types";
import { createInitialState } from "../../engine/world";
import { createAppearanceState, isHaircutDescriptionAllowed, isNonInheritedAppearanceDescriptionAllowed } from "../../engine/appearance";
import { createSuccessorInSameWorld } from "../../engine/lifecycle";
import { createDevelopment, MINUTES_PER_YEAR } from "../../engine/development";
import { createVeloriaWorldForCharacter, resolveVeloriaStart, type VeloriaCharacterDraft } from "./character";
import { attachGeneratedFamily, generateVeloriaFamily } from "./familyGeneration";
import { validateChildAppearance, type AppearanceProfile } from "./heritage";
import { validateFamilyRecord } from "./family";
import type { WorldDifficultyId } from "./difficulty";
import { SECOND_PRINCE_START_YEAR } from "./reynarCourt";
import { seedHash } from "./populations";

export interface VeloriaCampaignRecipe {
  kind: "veloria-character";
  draft: VeloriaCharacterDraft;
  difficultyId: WorldDifficultyId;
}

/** Каноническая внешность второго принца. Игрок не может её изменить. */
export const SECOND_PRINCE_APPEARANCE: Required<Omit<AppearanceProfile, "notes">> = {
  skinTone: 3, hairColor: "light-blond", hairTexture: "straight", eyeColor: "dark-brown", facialFeatures: "east-asian"
};

export const isVeloriaRecipe = (value: unknown): value is VeloriaCampaignRecipe =>
  typeof value === "object" && value !== null && (value as { kind?: unknown }).kind === "veloria-character" && typeof (value as { draft?: unknown }).draft === "object";

/** Детерминированно собирает мир персонажа. Одна и та же анкета всегда даёт тот же мир. */
export function buildVeloriaCampaignWorld(recipe: VeloriaCampaignRecipe): WorldData | null {
  const built = createVeloriaWorldForCharacter(recipe.draft);
  if (!built) return null;
  const family = generateVeloriaFamily(recipe.draft, Object.keys(built.npcs));
  if (!family.available) return built;
  return attachGeneratedFamily(built, family);
}

/** Какую внешность получит персонаж: фиксированную (второй принц) или выбранную в пределах наследования. */
export function resolveInheritedAppearance(draft: VeloriaCharacterDraft): AppearanceProfile | undefined {
  const family = generateVeloriaFamily(draft);
  const fallback = draft.dynasticRole === "second-prince" ? SECOND_PRINCE_APPEARANCE : family.defaultAppearance;
  if (!fallback) return undefined;
  return {
    skinTone: draft.skinTone ?? fallback.skinTone,
    hairColor: draft.hairColor ?? fallback.hairColor,
    hairTexture: draft.hairTexture ?? fallback.hairTexture,
    eyeColor: draft.eyeColor ?? fallback.eyeColor,
    facialFeatures: draft.facialFeatures ?? fallback.facialFeatures
  };
}

export type CampaignStart = { ok: true; world: WorldData; state: GameState; notice: string } | { ok: false; errors: string[] };

/**
 * Создаёт кампанию. Если передано состояние умершего героя: новый герой продолжает тот же мир
 * (хроника и память NPC сохраняются), иначе начинается новая версия мира.
 */
export function startVeloriaCampaign(recipe: VeloriaCampaignRecipe, previous?: GameState): CampaignStart {
  const { draft } = recipe;
  const validation = resolveVeloriaStart(draft);
  if (!validation.ok) return { ok: false, errors: validation.errors };
  const family = generateVeloriaFamily(draft);
  if (!family.available || !family.record) return { ok: false, errors: [family.reason ?? "Семейный сценарий пока недоступен."] };
  const familyErrors = validateFamilyRecord(family.record);
  if (familyErrors.length) return { ok: false, errors: familyErrors.map(issue => issue.message) };
  const appearance = resolveInheritedAppearance(draft);
  if (draft.dynasticRole !== "second-prince" && appearance && family.biologicalParents.length >= 1) {
    const errors = validateChildAppearance(family.biologicalParents[0]!, family.biologicalParents[1] ?? family.biologicalParents[0]!, appearance);
    if (errors.length) return { ok: false, errors };
  }
  // Правило автора: выбранные черты есть у кого-то из родных (мама, папа, бабушки, деды).
  if (draft.dynasticRole !== "second-prince" && family.kin?.length) {
    const errors = validateKinChoice(family.kin, { skinTone: draft.skinTone, hairColor: draft.hairColor, hairTexture: draft.hairTexture, eyeColor: draft.eyeColor, facialFeatures: draft.facialFeatures, nose: draft.nose, lips: draft.lips, brows: draft.brows, heightTendency: draft.heightTendency, bodyBuild: draft.bodyBuild, marks: draft.marks });
    if (errors.length) return { ok: false, errors };
  }
  if (!isHaircutDescriptionAllowed(draft.hairstyle ?? "")) return { ok: false, errors: ["Причёска описывает только форму и длину волос. Природный цвет определяется происхождением и здесь не меняется."] };
  if (!isNonInheritedAppearanceDescriptionAllowed(draft.appearance ?? "")) return { ok: false, errors: ["Дополнительные отметины не могут подменять наследуемые цветовые признаки или форму лица."] };

  const world = buildVeloriaCampaignWorld(recipe);
  if (!world) return { ok: false, errors: ["Не удалось собрать мир для этой анкеты."] };
  const isPrince = draft.dynasticRole === "second-prince";
  /** Старт с рождения: второй принц или новорождённый в обычной семье. */
  const isBirth = isPrince || draft.age === 0;
  /** «Новая жизнь»: обычное происхождение из каталога, возраст от 0 до 12. */
  const newLife = Boolean(draft.birthOriginId) && !isPrince;
  const start = validation.start;
  const heritage = {
    ...family.record,
    appearanceInheritance: appearance
      ? { status: "validated", ...appearance, inheritedFrom: family.biologicalParents.map(parent => parent.id) }
      : { status: "unresolved", reason: "Нет двух подтверждённых биологических родителей для расчёта наследуемых признаков." }
  };
  const profile: NonNullable<GameState["playerProfile"]> = {
    age: draft.age, sex: draft.sex ?? "unspecified", birthYearKL: isPrince ? SECOND_PRINCE_START_YEAR : undefined, dynasticRole: draft.dynasticRole,
    originId: draft.originId, statusId: draft.statusId, professionId: draft.professionId, familyState: draft.familyState,
    parentalUnionStatus: draft.parentalUnionStatus ?? "unknown", startScenarioId: draft.startScenarioId, biography: draft.biography,
    attributes: { ...draft.attributes }, difficultyId: recipe.difficultyId, heightCm: draft.heightCm, weightKg: draft.weightKg, build: draft.build,
    hair: appearance?.hairColor, hairstyle: draft.hairstyle, eyes: appearance?.eyeColor, appearance: draft.appearance,
    personality: draft.personality, education: draft.education, faithId: draft.faithId, skills: draft.skills, familyNotes: draft.familyNotes,
    familySummary: family.summary, heritage
  };

  let state: GameState | null;
  if (previous?.lifeStatus === "dead" && previous.deathRecord) {
    state = createSuccessorInSameWorld(world, previous, { status: "dead", death: previous.deathRecord }, { name: draft.name.trim(), startLocationId: start.locationId, money: start.money, inventory: { ...start.inventory } });
    if (!state) return { ok: false, errors: ["Не удалось продолжить мир новым героем."] };
  } else {
    state = createInitialState(world, draft.name.trim());
    state.playerMemory[0] = newLife && !isBirth
      ? { ...state.playerMemory[0]!, text: `${start.notes.join(" ")} ${family.summary}`, kind: "own", confidence: 0.6 }
      : isBirth && !isPrince
      ? { ...state.playerMemory[0]!, text: `${start.notes.join(" ")} ${family.summary}`, kind: "own", confidence: 0.2 }
      : { ...state.playerMemory[0]!, text: `Ты начинаешь новую жизнь в Ровене: ${draft.name}, ${draft.age} лет. ${start.notes.join(" ")}`, kind: "own", confidence: 1 };
  }
  state = { ...state, playerProfile: profile, campaign: { worldId: "veloria", recipe: structuredClone(recipe) }, worldStartYearKL: world.startYearKL ?? 742 };

  if (isPrince) {
    state.minute = 8 * 60 + 10;
    state.relations["rey-elin"] = { trust: -80, sympathy: -85, fear: 12, respect: -15 };
    state.relations["rey-consort"] = { trust: 55, sympathy: 62, fear: 0, respect: 35 };
    // Мать и кормилица относятся к новорождённому тепло; это стартовое отношение, а не обещание на всю жизнь.
    state.relations["rey-second-prince-mother"] = { trust: 40, sympathy: 85, fear: 0, respect: 10 };
    state.relations["rey-second-prince-nurse"] = { trust: 30, sympathy: 55, fear: 0, respect: 5 };
    state.playerMemory = [{
      minute: state.minute, kind: "own", confidence: 0.2,
      // Подробности рождения уже есть в start.notes (character.ts), здесь их не повторяем.
      text: `${start.notes.join(" ")}`
    }];
  }
  // Развитие: возраст отсчитывается от минуты рождения. Для взрослого старта вехи считаются пройденными.
  // У ребёнка из «Новой жизни» свой день рождения внутри года, а не ровно в день старта.
  const birthdayOffset = newLife ? (seedHash(`${draft.familySeed ?? draft.name}:hero-birthday`) % 365) * 1440 : 0;
  const birthMinute = isBirth ? state.minute : state.minute - draft.age * MINUTES_PER_YEAR - birthdayOffset;
  state.development = createDevelopment({
    birthMinute, nowMinute: state.minute, aptitudes: draft.attributes,
    seed: `${draft.familySeed ?? draft.name}:${draft.name}`,
    sex: draft.sex ?? "unspecified",
    // Обычный новорождённый: задатки: как у принца, темперамент и телосложение выбирает игрок.
    temperament: draft.temperament, build: draft.bodyBuild, heightTendency: draft.heightTendency
  });
  if (newLife && !isBirth) {
    // Ребёнок уже прожил годы с этими людьми: привязанность к тем, кто растил, сложилась по их теплоте.
    for (const member of family.members) {
      const friend = member.id.includes("-friend-");
      if (member.lifeStatus !== "alive" || (member.homeId !== family.household?.homeId && !friend)) continue;
      if (friend) {
        state.development.attachments[member.id] = { security: 15, familiarity: 55, wariness: 0, lastContactMinute: state.minute };
        state.relations[member.id] = { trust: 30, sympathy: 45, fear: 0, respect: 5 };
        continue;
      }
      const warmth = member.personality?.traits.warmth ?? 60;
      const carer = member.caregiving?.role === "mother" || member.caregiving?.role === "father" || member.caregiving?.role === "guardian";
      state.development.attachments[member.id] = { security: Math.round((carer ? 35 : 15) + warmth * 0.4), familiarity: carer ? 80 : 60, wariness: warmth < 40 ? 15 : 0, lastContactMinute: state.minute };
      state.relations[member.id] = { trust: carer ? 45 : 25, sympathy: Math.round(warmth * 0.8), fear: warmth < 40 ? 15 : 0, respect: carer ? 20 : 5 };
    }
    state.playerProfile = { ...profile, heightCm: Math.round(state.development.physical.heightCm), weightKg: state.development.physical.weightKg };
  }
  if (isBirth && !isPrince) {
    // Новорождённый уже знает голос матери, если она жива; родные получают тёплое стартовое отношение.
    for (const member of family.members) {
      if (member.lifeStatus !== "alive" || !member.caregiving) continue;
      const mother = member.caregiving.role === "mother";
      state.development.attachments[member.id] = { security: mother ? 30 : 8, familiarity: mother ? 20 : 5, wariness: 0, lastContactMinute: state.minute };
      state.relations[member.id] = { trust: 30, sympathy: Math.round((member.personality?.traits.warmth ?? 60) * 0.9), fear: 0, respect: 5 };
    }
    state.playerProfile = { ...profile, heightCm: Math.round(state.development.physical.heightCm), weightKg: state.development.physical.weightKg };
  }
  if (isPrince) {
    // Новорождённый уже знает голос матери: это единственная привязанность, существующая до рождения.
    state.development.attachments["rey-second-prince-mother"] = { security: 30, familiarity: 20, wariness: 0, lastContactMinute: state.minute };
    state.playerProfile = { ...profile, heightCm: Math.round(state.development.physical.heightCm), weightKg: state.development.physical.weightKg };
  }
  state.playerAppearance = createAppearanceState(
    {
      skinTone: appearance?.skinTone, eyeColor: appearance?.eyeColor, naturalHairColor: appearance?.hairColor,
      hairTexture: appearance?.hairTexture, facialFeatures: appearance?.facialFeatures, description: draft.appearance?.trim() || undefined
    },
    { hairstyle: isBirth ? "редкие младенческие волосы" : draft.hairstyle?.trim() || (newLife ? "детская стрижка" : "причёска не описана"), clothing: isBirth ? "пелёнки" : newLife ? (draft.age < 2 ? "детская рубашонка" : "простая детская одежда") : "одежда стартового комплекта" }
  );
  const notice = previous?.lifeStatus === "dead"
    ? "Новый персонаж продолжает историю мира. Время, хроника и память NPC сохранены; умерший герой не возвращён."
    : isPrince ? `Персонаж создан. Кампания началась с рождения во дворце Коронхольма в ${SECOND_PRINCE_START_YEAR} КЛ.`
    : newLife ? `Новая жизнь началась. ${start.notes[0] ?? ""}`.trim()
    : isBirth ? "Персонаж создан. Кампания началась с рождения в Ровене." : "Персонаж создан. Кампания началась в Ровене.";
  return { ok: true, world, state, notice };
}

/**
 * Восстанавливает рецепт для сохранений до 0.13.0, где анкета не хранилась.
 * Для второго принца рецепт однозначен; для обычных героев семья генерируется заново
 * по устойчивому seed, поэтому сгенерированные родственники могут отличаться от старых.
 */
export function legacyRecipeFromState(state: GameState): VeloriaCampaignRecipe | null {
  const profile = state.playerProfile;
  if (!profile) return null;
  const draft: VeloriaCharacterDraft = {
    name: state.playerName, age: profile.dynasticRole === "second-prince" ? 0 : profile.age,
    originId: profile.originId as VeloriaCharacterDraft["originId"], statusId: profile.statusId as VeloriaCharacterDraft["statusId"],
    professionId: profile.professionId as VeloriaCharacterDraft["professionId"], familyState: profile.familyState as VeloriaCharacterDraft["familyState"],
    startScenarioId: profile.startScenarioId as VeloriaCharacterDraft["startScenarioId"], biography: profile.biography,
    attributes: { ...profile.attributes }, dynasticRole: profile.dynasticRole === "second-prince" ? "second-prince" : undefined,
    parentalUnionStatus: profile.parentalUnionStatus, familySeed: `legacy:${state.playerName}`
  };
  return { kind: "veloria-character", draft, difficultyId: profile.difficultyId };
}
