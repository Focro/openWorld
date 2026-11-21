import type { GameState, NpcDef, WorldData } from "./types";

export type ClaimKind = "otherworld" | "simulation" | "rebirth" | "divine-cult" | "new-faith" | "ordinary";
export const initialSocialState = () => ({ suspicion: 0, heresySuspicion: 0, claimCount: 0, cultAttempts: 0, followers: [], movement: "none" as const, legalCase: "none" as const });
const normalize = (value: string) => value.toLocaleLowerCase("ru").replace(/ё/g, "е");

export function classifyClaim(text: string): ClaimKind {
  const t = normalize(text);
  if (["npc", "нпс", "вас не существует", "вас на самом деле нет", "на самом деле вас нет", "вас нет на самом деле", "вы ненастоящие", "вы не настоящие", "вы просто текст", "вы лишь текст", "все это текст", "это игра", "все это игра", "всё это игра", "вы часть игры", "вы персонажи игры", "весь мир игра", "вы в игре", "игрок управляет", "я игрок"].some(x => t.includes(x))) return "simulation";
  if (["возродился", "переродился", "вернулся из мертвых", "вернулся из мёртвых", "прошлая жизнь", "я умер и снова", "я воскрес", "воскрес из мертвых", "воскрес из мёртвых"].some(x => t.includes(x))) return "rebirth";
  if (["из другого мира", "другой мир", "иной мир", "пришел из мира", "пришла из мира", "прибыл из другого мира"].some(x => t.includes(x))) return "otherworld";
  if (["культ", "поклоняйтесь мне", "молитесь мне", "я бог", "я божество", "я пророк", "новая вера", "новая религия", "новую религию", "создать новую религию", "избранный свыше", "новый бог", "следуйте за мной"].some(x => t.includes(x))) return "divine-cult";
  if (["создам религию", "создать веру", "учение мое", "учение моё", "новая церковь", "новое вероучение"].some(x => t.includes(x))) return "new-faith";
  return "ordinary";
}
const clamp = (n: number) => Math.max(0, Math.min(100, n));
const hasRole = (npcs: NpcDef[], role: NonNullable<NpcDef["roleTags"]>[number]) => npcs.some(n => n.roleTags?.includes(role));
export interface SpeechOutcome { state: GameState; reaction: string; deathCause?: string }

/** Реакция общества, а не объективный диагноз персонажа. */
export function resolveSpeech(world: WorldData, state: GameState, text: string, witnesses: string[]): SpeechOutcome {
  const age = state.playerProfile?.age ?? 22;
  if (age < 5) return { state, reaction: "Вы ещё слишком малы, чтобы произнести связную речь. Жесты и отдельные звуки возможны, но слова не были сказаны." };
  const kind = classifyClaim(text);
  const present = witnesses.map(id => world.npcs[id]).filter((npc): npc is NpcDef => Boolean(npc));
  const prior = state.socialState ?? initialSocialState();
  if (kind === "ordinary" || present.length === 0) return { state: { ...state, socialState: prior }, reaction: present.length ? "Вы произносите слова, но явной реакции окружающих пока нет." : "Вы произносите это без свидетелей. Никто из NPC не услышал сказанного." };

  const childFactor = age < 12 ? 0.2 : age < 16 ? 0.55 : 1;
  const publicFactor = present.length >= 3 ? 1.35 : present.length === 2 ? 1.15 : 1;
  const clergy = hasRole(present, "clergy"), guard = hasRole(present, "guard"), authority = clergy || guard;
  const count = prior.claimCount + 1;
  const isCult = kind === "divine-cult" || kind === "new-faith";
  const base = kind === "simulation" ? 23 : kind === "otherworld" || kind === "rebirth" ? 15 : 18;
  const repeated = Math.min(24, Math.max(0, count - 1) * 8);
  const authorityPressure = (clergy ? 12 : 0) + (guard ? 10 : 0);
  const increase = Math.round((base + repeated + authorityPressure) * publicFactor * childFactor);
  const suspicion = clamp(prior.suspicion + (isCult ? Math.round(increase * 0.55) : increase));
  const heresySuspicion = clamp(prior.heresySuspicion + (isCult ? increase + (clergy ? 12 : 0) : kind === "simulation" ? Math.round(increase * 0.45) : 0));
  const cultAttempts = prior.cultAttempts + (isCult ? 1 : 0);
  const followers = [...(prior.followers ?? [])];
  if (isCult) {
    const charisma = state.playerProfile?.attributes?.["Харизма"] ?? 10;
    const candidate = present.find(npc => !followers.includes(npc.id) && !npc.roleTags?.includes("guard") && !npc.roleTags?.includes("clergy") && ((state.relations[npc.id]?.sympathy ?? 0) >= 20 || charisma >= 24));
    if (candidate) followers.push(candidate.id);
  }
  const movement = isCult ? (followers.length >= 4 ? "cult" : followers.length >= 2 ? "sect" : "rumor") : prior.movement;
  let legalCase: NonNullable<GameState["socialState"]>["legalCase"] = prior.legalCase;
  let reaction = "Слова вызывают недоумение. Свидетели могут пересказать их другим.";
  if (age < 12) reaction = "Окружающие воспринимают это скорее как детскую фантазию. Взрослые могут одёрнуть вас, но не считают проповедь полноценным политическим заявлением.";
  else if (suspicion >= 25) reaction = "Некоторые свидетели начинают считать ваши слова тревожными или бессвязными. Разговор может стать предметом слухов.";
  if (heresySuspicion >= 35) reaction = "Религиозные свидетели воспринимают слова как опасное заблуждение или ересь; возможны донос и церковное разбирательство.";
  if (suspicion >= 50 || heresySuspicion >= 50) legalCase = legalCase === "none" ? "watched" : legalCase;
  if (suspicion >= 65 || heresySuspicion >= 65) legalCase = "summoned";
  if (guard && (suspicion >= 70 || heresySuspicion >= 70)) legalCase = "detained";

  // Для казни нужны повторные заявления, хотя бы один свидетель-представитель власти/духовенства и высокий уровень подозрения.
  // Сословный статус не даёт иммунитета. Одинокая фраза сама по себе не казнит.
  const executionRisk = count >= 3 && present.length >= 1 && authority && (suspicion >= 72 || heresySuspicion >= 72);
  let deathCause: string | undefined;
  if (executionRisk) {
    legalCase = "condemned";
    deathCause = state.playerProfile?.politicalOffice === "monarch"
      ? "свергнут(а) с престола и казнён(а) после признания опасным(ой) для порядка и веры"
      : isCult
        ? "осуждён(а) за ересь и создание запрещённого культа после разбирательства"
        : "признан(а) опасным(ой) для общественного порядка после повторных публичных заявлений о природе мира";
    if (state.playerProfile?.politicalOffice === "monarch") {
      legalCase = "deposed";
      reaction = "Против вас выступают знать и духовенство: вас свергают, затем судят и казнят. Корона переходит к признанному наследнику или победившей политической стороне.";
    } else reaction = "Вас задерживают, судят и приговаривают к казни. Положение и богатство не гарантируют помилования.";
  }
  return { state: { ...state, socialState: { suspicion, heresySuspicion, claimCount: count, cultAttempts, followers, movement, legalCase, lastClaimMinute: state.minute } }, reaction, deathCause };
}
