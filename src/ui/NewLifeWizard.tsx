/**
 * «Новая жизнь в Велории» (0.16.0): создание героя по шагам.
 * 1 возраст (0–12) и сложность, 2 держава, пол и кем родиться, 3 семья и имя, 4 внешность и нрав, 5 задатки.
 * Взрослого старта нет. Второй принц: обычная карточка в списке Эстрана.
 */
import { useEffect, useMemo, useState } from "react";
import type { VeloriaCharacterDraft } from "../worlds/veloria/character";
import { NEW_LIFE_ATTRIBUTES, NEW_LIFE_POINTS, newLifeAttributes, newLifeLevels, resolveVeloriaStart } from "../worlds/veloria/character";
import { BIRTH_GROUPS, BIRTH_ORIGINS, BIRTH_STATES, MAX_BIRTH_START_AGE, SECOND_PRINCE_ORIGIN_ID, birthOrigin, type BirthOrigin } from "../worlds/veloria/birthOrigins";
import { generateVeloriaFamily } from "../worlds/veloria/familyGeneration";
import { kinLabel, kinOptions, lookFromLine, regionOptions, NOSE_LABEL, LIPS_LABEL, BROWS_LABEL, MARK_LABEL, HEIGHT_LABEL, BUILD_LABEL, type KinMember, type KinMark } from "../worlds/veloria/kin";
import { I } from "./icons";
import { COUNTRIES } from "../worlds/veloria/atlas";
import { FAITHS } from "../worlds/veloria/faiths";
import { WORLD_DIFFICULTIES, type WorldDifficultyId } from "../worlds/veloria/difficulty";
import type { StateId } from "../worlds/veloria/populations";

type Draft = VeloriaCharacterDraft;
const ATTRS = NEW_LIFE_ATTRIBUTES;
const ATTR_LABEL: Record<string, string> = { "Сила": "Сила", "Выносливость": "Выносливость", "Ловкость": "Ловкость", "Интеллект": "Ум", "Харизма": "Обаяние" };
const PRESETS: Record<string, number[]> = { "Ровно": [3, 3, 3, 3, 3], "Умник": [2, 2, 3, 5, 3], "Крепыш": [5, 4, 3, 2, 1], "Душа компании": [2, 3, 3, 2, 5] };
const LEVEL_WORD = ["", "слабее обычного", "чуть ниже среднего", "обычно", "сильная сторона", "редкий дар"];
const HAIR: Record<string, string> = { black: "чёрные", "dark-brown": "тёмно-каштановые", brown: "каштановые", auburn: "рыжевато-каштановые", red: "рыжие", blond: "русые", "light-blond": "светло-русые", grey: "седые", white: "белые" };
const TEXTURE: Record<string, string> = { straight: "прямые", wavy: "волнистые", curly: "кудрявые", coiled: "мелко вьющиеся" };
const EYES: Record<string, string> = { brown: "карие", "dark-brown": "тёмно-карие", hazel: "ореховые", green: "зелёные", blue: "голубые", grey: "серые", amber: "янтарные" };
const FACE: Record<string, string> = { soft: "мягкое", angular: "с резкими скулами", broad: "широкое", narrow: "вытянутое", mixed: "смешанное", "east-asian": "с восточными чертами" };
const SKIN_WORDS = ["очень светлая", "светлая", "светлая, тёплая", "светло-оливковая", "оливковая", "смугловатая", "смуглая", "загорелая", "тёмная", "очень тёмная"];
const SKIN = (tone: number) => SKIN_WORDS[Math.max(1, Math.min(10, tone)) - 1]!;

export function ageHint(age: number): [string, string] {
  if (age === 0) return ["С рождения", "Ты младенец: плачешь, спишь, смотришь на мир. Всё остальное впереди."];
  if (age === 1) return ["1 год", "Учишься ходить, говоришь первые слова."];
  if (age === 2) return ["2 года", "Бегаешь, лезешь везде, говоришь короткими фразами."];
  if (age < 6) return [`${age} ${age < 5 ? "года" : "лет"}`, "Малыш: всё видишь, всё спрашиваешь, взрослые решают за тебя."];
  return [`${age} лет`, "Ребёнок: помогаешь по дому, заводишь друзей, у тебя есть свои секреты."];
}

const PRINCE_FIELDS: Partial<Draft> = {
  dynasticRole: "second-prince", name: "Рейнар", age: 0, sex: "male", originId: "acknowledged-bastard", statusId: "noble", professionId: "none", familyState: "together",
  startScenarioId: "ordinary", parentalUnionStatus: "unmarried", heightCm: 50, weightKg: 3.5, build: "Среднее", hairColor: "light-blond", hairTexture: "straight", eyeColor: "dark-brown",
  facialFeatures: "east-asian", skinTone: 3, hairstyle: "мягкие короткие волосы младенца", faithId: "sevenfold",
  biography: "Рождён в 723 КЛ от Гарена Вальда и женщины из далёкой восточной земли. Отец признал сына. Принцесса Элиана (королевой станет в 735 КЛ): жена отца, не мать ребёнка; её личная неприязнь связана с изменой супруга.",
  familyNotes: "Королевская кормилица Мейра назначена опекуном."
};

/** Анкета под выбранное происхождение: всё, что не выбирает игрок, берётся из варианта. */
export function draftForOrigin(d: Draft, origin: BirthOrigin): Draft {
  const attributes = newLifeAttributes(newLifeLevels(d.attributes));
  if (origin.fixed) return { ...d, ...PRINCE_FIELDS, birthOriginId: origin.id, temperament: d.temperament, bodyBuild: d.bodyBuild, heightTendency: d.heightTendency, attributes };
  const faith = COUNTRIES.find(c => c.id === origin.stateId)?.primaryFaith ?? "sevenfold";
  return {
    ...d, attributes, dynasticRole: undefined, birthOriginId: origin.id, age: Math.min(d.age, MAX_BIRTH_START_AGE), sex: d.sex === "female" ? "female" : "male",
    name: d.dynasticRole ? "" : d.name, originId: origin.legacyOriginId, statusId: origin.statusId, professionId: "none", familyState: origin.foundling ? "unknown" : "together",
    startScenarioId: "ordinary", parentalUnionStatus: undefined, heightCm: undefined, weightKg: undefined, build: undefined, hairstyle: "", appearance: "", biography: "", familyNotes: "",
    skinTone: undefined, hairColor: undefined, hairTexture: undefined, eyeColor: undefined, facialFeatures: undefined,
    faithId: FAITHS.some(f => f.id === faith) ? faith : "sevenfold"
  };
}


const yearsWord = (n: number) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? "год" : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? "года" : "лет"}`;
const capital = (t: string) => t ? t.charAt(0).toLocaleUpperCase("ru") + t.slice(1) : t;
type LookKey = "skinTone" | "hairColor" | "hairTexture" | "eyeColor" | "facialFeatures" | "nose" | "lips" | "brows" | "heightTendency" | "bodyBuild";
const LOOK_KEYS: LookKey[] = ["skinTone", "hairColor", "hairTexture", "eyeColor", "facialFeatures", "nose", "lips", "brows", "heightTendency", "bodyBuild"];
const WORD: Record<LookKey, (v: never) => string> = {
  skinTone: (v: number) => SKIN(v), hairColor: (v: string) => HAIR[v] ?? v, hairTexture: (v: string) => TEXTURE[v] ?? v, eyeColor: (v: string) => EYES[v] ?? v,
  facialFeatures: (v: string) => FACE[v] ?? v, nose: (v: keyof typeof NOSE_LABEL) => NOSE_LABEL[v], lips: (v: keyof typeof LIPS_LABEL) => LIPS_LABEL[v], brows: (v: keyof typeof BROWS_LABEL) => BROWS_LABEL[v],
  heightTendency: (v: keyof typeof HEIGHT_LABEL) => HEIGHT_LABEL[v], bodyBuild: (v: keyof typeof BUILD_LABEL) => BUILD_LABEL[v]
} as never;
const word = (k: LookKey, v: unknown) => (WORD[k] as (x: unknown) => string)(v);
const Hdr = ({ title, sub, onBack }: { title: string; sub: string; onBack?: () => void }) =>
  <div className="hdr">{onBack && <button className="ico" type="button" aria-label="Назад" onClick={onBack}>{I.backChevron}</button>}<div className="t"><b>{title}</b><span>{sub}</span></div></div>;
const Dots = ({ step }: { step: number }) => <div className="dots">{[1, 2, 3, 4, 5, 6].map(n => <i key={n} className={n === step ? "on" : ""} />)}</div>;

/** Мастер «Твоя первая жизнь» / «Новая жизнь в Велории»: 6 шагов по макетам Жозы 02 и 03. */
export function NewLifeWizard({ draft, setDraft, difficulty, setDifficulty, onStart, newSeed, first, onExit }: {
  draft: Draft; setDraft: (update: (d: Draft) => Draft) => void;
  difficulty: WorldDifficultyId; setDifficulty: (id: WorldDifficultyId) => void;
  onStart: () => void; newSeed: () => string; first?: boolean; onExit?: () => void;
}) {
  const [step, setStep] = useState(1);
  const [line, setLine] = useState(50);
  const origin = birthOrigin(draft.birthOriginId) ?? BIRTH_ORIGINS[0]!;
  const [stateId, setStateId] = useState<StateId>(origin.stateId);
  const [nameTouched, setNameTouched] = useState(false);
  const prince = origin.fixed === true;
  const family = useMemo(() => generateVeloriaFamily(draft), [draft]);
  const preview = family.preview;
  const kin: KinMember[] = family.kin ?? [];
  const validation = useMemo(() => resolveVeloriaStart(draft), [draft]);
  const levels = newLifeLevels(draft.attributes);
  const total = ATTRS.reduce((sum, key) => sum + levels[key]!, 0);
  const patch = (p: Partial<Draft>) => setDraft(d => ({ ...d, ...p }));
  const setLevels = (next: Record<string, number>) => patch({ attributes: newLifeAttributes(next) });
  const title = first ? "Твоя первая жизнь" : "Новая жизнь в Велории";

  useEffect(() => {
    if (!nameTouched && !prince && preview?.suggestedName && draft.name !== preview.suggestedName) setDraft(d => ({ ...d, name: preview.suggestedName }));
  }, [preview?.suggestedName, nameTouched, prince]);

  const choose = (o: BirthOrigin) => setDraft(d => draftForOrigin(d, o));
  const fate = () => {
    const pool = BIRTH_ORIGINS.filter(o => o.stateId === stateId);
    const o = pool[Math.floor(Math.random() * pool.length)]!;
    setDraft(d => ({ ...draftForOrigin(d, o), familySeed: newSeed() }));
  };
  const country = COUNTRIES.find(c => c.id === stateId);
  const stateInfo = BIRTH_STATES.find(s => s.id === stateId)!;

  // Внешность: варианты только от родных; у подкидыша обычные черты его края.
  const kinOpts = useMemo(() => kin.length ? kinOptions(kin) : null, [kin]);
  const region = useMemo(() => regionOptions(origin.stateId), [origin.stateId]);
  const base = useMemo(() => kin.length ? lookFromLine(kin, line, draft.familySeed ?? "") : null, [kin, line, draft.familySeed]);
  const optionsFor = (k: LookKey): Array<{ value: unknown; from: KinMember[] }> => kinOpts ? (kinOpts[k] as Array<{ value: unknown; from: KinMember[] }>) : (region[k] as unknown[]).map(value => ({ value, from: [] }));
  const current = (k: LookKey): unknown => (draft as unknown as Record<string, unknown>)[k] ?? base?.[k] ?? optionsFor(k)[0]?.value;
  const marks: KinMark[] = draft.marks ?? base?.marks ?? [];
  const markOpts: Array<{ value: KinMark; from: KinMember[] }> = kinOpts ? kinOpts.marks : region.marks.map(value => ({ value, from: [] }));
  const applyLine = (v: number) => { setLine(v); if (!kin.length) return; const l = lookFromLine(kin, v, draft.familySeed ?? ""); patch({ ...l }); };
  const fromText = (from: KinMember[]) => from.map(k => k.given).join(", ");
  const describe = () => {
    const g = (k: LookKey) => word(k, current(k));
    const f = draft.sex === "female";
    const h = current("heightTendency");
    return `Кожа ${g("skinTone")}. Волосы ${g("hairColor")}, ${g("hairTexture")}. Глаза ${g("eyeColor")}. Лицо ${g("facialFeatures")}, нос ${g("nose")}, губы ${g("lips")}, брови ${g("brows")}. Вырастешь ${h === "short" ? (f ? "невысокой" : "невысоким") : h === "tall" ? (f ? "высокой" : "высоким") : "среднего роста"}, ${g("bodyBuild")}.${marks.length ? ` Приметы: ${marks.map(m => MARK_LABEL[m]).join(", ")}.` : ""}`;
  };
  const chipRow = (k: LookKey) => <div className="chips">{optionsFor(k).map(o => <button key={String(o.value)} type="button" className="chip" aria-pressed={current(k) === o.value} onClick={() => patch({ [k]: o.value } as Partial<Draft>)}>{word(k, o.value)}{o.from.length > 0 && <small>{fromText(o.from)}</small>}</button>)}</div>;
  const section = (label: string, summary: string, body: React.ReactNode) => <details className="ap"><summary>{label}<em>{summary}</em></summary><div className="apb">{body}</div></details>;
  const parentsLine = () => {
    const by = (r: string) => kin.filter(k => k.relation === r);
    const names = (list: KinMember[]) => list.map((k, i) => <span key={k.id}>{i > 0 && " и "}<b>{k.given}</b></span>);
    const mom = by("мама")[0], dad = by("папа")[0];
    return <p className="parents">Черты берутся только от родных: {mom && <><b>мамы {mom.given}</b>, </>}{dad && <><b>папы {dad.given}</b>, </>}{by("бабушка").length > 1 ? "бабушек " : "бабушки "}{names(by("бабушка"))}, {by("дед").length > 1 ? "дедов " : "деда "}{names(by("дед"))}. Под каждым вариантом видно, от кого он.</p>;
  };
  const parents = preview?.members.filter(m => m.role === "мать" || m.role === "отец") ?? [];
  const topTraits = [...ATTRS].sort((a, b) => levels[b]! - levels[a]!).slice(0, 2).filter(a => levels[a]! >= 4).map(a => ATTR_LABEL[a]!.toLocaleLowerCase("ru"));
  const back = () => step > 1 ? setStep(step - 1) : onExit?.();
  const next = () => { if (step === 1 && !draft.birthOriginId) choose(BIRTH_ORIGINS.find(o => o.stateId === stateId)!); setStep(step + 1); };
  const canBorn = validation.ok && family.available && total === NEW_LIFE_POINTS && !!draft.name.trim();

  if (step === 1) return <>
    <Hdr title={title} sub="Шаг 1 из 6" onBack={onExit} />
    <div className="body">
      <Dots step={1} />
      <p className="q">С какого возраста начать?</p>
      <p className="qs">Все жизни в Велории начинаются в детстве. Можно с первого крика, можно чуть позже, но не старше 12 лет.</p>
      <div className="agebox">
        <div className="agebig"><b>{ageHint(draft.age)[0]}</b><span>{prince ? "Эта жизнь начинается с рождения." : ageHint(draft.age)[1]}</span></div>
        <input type="range" min={0} max={MAX_BIRTH_START_AGE} value={draft.age} disabled={prince} aria-label="Возраст на старте" onChange={e => patch({ age: Number(e.target.value) })} />
        <div className="agescale"><span>0</span><span>3</span><span>6</span><span>9</span><span>12</span></div>
      </div>
      <span className="lbl">Насколько суров мир</span>
      <div className="chips">{Object.values(WORLD_DIFFICULTIES).map(d => <button className="chip" type="button" key={d.id} aria-pressed={difficulty === d.id} onClick={() => setDifficulty(d.id)}>{d.label}</button>)}</div>
    </div>
    <div className="foot"><button className="btn primary" type="button" onClick={next}>Дальше</button></div>
  </>;

  if (step === 2) return <>
    <Hdr title={title} sub="Шаг 2 из 6" onBack={back} />
    <div className="body">
      <Dots step={2} />
      <p className="q">Кем ты родишься?</p>
      <p className="qs">Только кто ты при рождении. Кем станешь, решишь сам.</p>
      <span className="lbl">Держава</span>
      <div className="chips">{BIRTH_STATES.map(s => <button className="chip" type="button" key={s.id} aria-pressed={stateId === s.id} onClick={() => { setStateId(s.id); const f = BIRTH_ORIGINS.find(o => o.stateId === s.id)!; if (origin.stateId !== s.id) choose(f); }}>{s.name}</button>)}</div>
      <div className="sinfo"><b>{country?.name ?? stateInfo.name}</b><p>{stateInfo.climate}. {stateInfo.knownFor}</p><div className="facts2"><span>Правит: {country?.ruler}</span><span>Вера: {FAITHS.find(f => f.id === country?.primaryFaith)?.name ?? "своя"}</span></div></div>
      <span className="lbl">Ты</span>
      <div className="seg" style={{ alignSelf: "flex-start" }}>{(["male", "female"] as const).map(sex => <button type="button" key={sex} aria-pressed={(draft.sex ?? "male") === sex} onClick={() => patch({ sex })}>{sex === "male" ? "Мальчик" : "Девочка"}</button>)}</div>
      <button className="btn" type="button" style={{ padding: 10 }} onClick={fate}>{I.dice}Пусть решит судьба</button>
      <div className="grp">{BIRTH_GROUPS.map(group => {
        const list = BIRTH_ORIGINS.filter(o => o.stateId === stateId && o.group === group);
        if (!list.length) return null;
        return <div className="grp" key={group}><span className="lbl">{capital(group)}</span>
          {list.map(o => <button type="button" key={o.id} className="opt" aria-pressed={draft.birthOriginId === o.id} onClick={() => choose(o)}>
            <span className="oi">{I.people}</span><span><b>{o.label}</b><span>{o.blurb}</span><em className="meta">{o.wealthHint === "бедно" ? "обычно бедно" : o.wealthHint === "скромно" ? "обычно скромно" : "обычно в достатке"}</em></span>
          </button>)}
        </div>;
      })}</div>
    </div>
    <div className="foot"><button className="btn primary" type="button" onClick={next}>Дальше</button></div>
  </>;

  if (step === 3) return <>
    <Hdr title={title} sub="Шаг 3 из 6" onBack={back} />
    <div className="body">
      <Dots step={3} />
      <p className="q">Твоя семья</p>
      <p className="qs">{prince ? family.summary : preview?.summary}</p>
      {!prince && preview && <div className="fam">{preview.members.map(m => <div className="fm" key={m.id}>
        <span className="fa">{m.name.charAt(0)}</span>
        <div><b>{m.name}, {m.role} {m.alive && <em>{yearsWord(m.age)}</em>}</b>{m.alive && <span>{m.temperament}. {m.appearance} {capital(m.occupation)}.{m.livesWithYou ? "" : " Живёт отдельно."}</span>}</div>
      </div>)}</div>}
      {!prince && preview && draft.age >= 3 && preview.friends.length > 0 && <><span className="lbl">Друзья и соседи</span><div className="fam">{preview.friends.map(m => <div className="fm" key={m.id}>
        <span className="fa">{m.name.charAt(0)}</span><div><b>{m.name} <em>{yearsWord(m.age)}</em></b><span>{m.temperament}. {m.appearance}</span></div>
      </div>)}</div></>}
      <p className="note2">{I.info16}Это то, что видно со стороны. Их секреты, прошлое и то, что с ними случится, ты узнаешь только в игре.</p>
      {!prince && <button className="btn" type="button" style={{ padding: 10 }} onClick={() => { setNameTouched(false); setLine(50); patch({ familySeed: newSeed(), skinTone: undefined, hairColor: undefined, hairTexture: undefined, eyeColor: undefined, facialFeatures: undefined, nose: undefined, lips: undefined, brows: undefined, heightTendency: undefined, bodyBuild: undefined, marks: undefined }); }}>{I.dice}Другая семья</button>}
    </div>
    <div className="foot"><button className="btn primary" type="button" onClick={next}>Дальше</button></div>
  </>;

  if (step === 4) return <>
    <Hdr title="Внешность" sub="Шаг 4 из 6" onBack={back} />
    <div className="body">
      {prince ? <div className="desc"><span className="lbl">Каким ты будешь</span><p>Кожа светлая. Волосы светло-русые, прямые. Глаза тёмно-карие. Лицо с восточными чертами, как у матери.</p></div> : <>
        <div className="desc"><span className="lbl">Каким ты будешь</span><p>{describe()}</p></div>
        {kin.length > 0 && <div className="like"><span>Мамина линия</span><input type="range" min={0} max={100} value={line} aria-label="На кого похож" onChange={e => applyLine(Number(e.target.value))} /><span>Папина линия</span></div>}
        {kin.length > 0 ? parentsLine() : <p className="parents">Родные неизвестны, поэтому черты берутся из обычных для твоего края.</p>}
        <div>
          {section("Кожа", word("skinTone", current("skinTone")), chipRow("skinTone"))}
          {section("Волосы", `${word("hairColor", current("hairColor"))}, ${word("hairTexture", current("hairTexture"))}`, <><span className="sub">Цвет</span>{chipRow("hairColor")}<span className="sub">Какие</span>{chipRow("hairTexture")}</>)}
          {section("Глаза", word("eyeColor", current("eyeColor")), chipRow("eyeColor"))}
          {section("Лицо", `${word("facialFeatures", current("facialFeatures"))}, нос ${word("nose", current("nose"))}`, <><span className="sub">Форма</span>{chipRow("facialFeatures")}<span className="sub">Нос</span>{chipRow("nose")}<span className="sub">Губы</span>{chipRow("lips")}<span className="sub">Брови</span>{chipRow("brows")}</>)}
          {section("Рост и сложение", `${word("heightTendency", current("heightTendency"))}, ${word("bodyBuild", current("bodyBuild"))}`, <><span className="sub">Вырастет</span>{chipRow("heightTendency")}<span className="sub">Сложение</span>{chipRow("bodyBuild")}</>)}
          {section("Приметы", marks.length ? marks.map(m => MARK_LABEL[m]).join(", ") : "нет", <div className="chips">{markOpts.map(o => <button key={o.value} type="button" className="chip" aria-pressed={marks.includes(o.value)} onClick={() => patch({ marks: marks.includes(o.value) ? marks.filter(m => m !== o.value) : [...marks, o.value] })}>{MARK_LABEL[o.value]}{o.from.length > 0 && <small>{fromText(o.from)}</small>}</button>)}</div>)}
        </div>
      </>}
    </div>
    <div className="foot"><Dots step={4} /><button className="btn primary" type="button" onClick={() => { if (!prince) patch(Object.fromEntries(LOOK_KEYS.map(k => [k, current(k)])) as Partial<Draft>); next(); }}>Дальше</button></div>
  </>;

  if (step === 5) return <>
    <Hdr title={title} sub="Шаг 5 из 6" onBack={back} />
    <div className="body">
      <Dots step={5} />
      <p className="q">С какими задатками ты родишься?</p>
      <p className="qs">Это не умения, а то, к чему тянет. Остальное даст жизнь.</p>
      <div className="budget">
        <svg className="ring" viewBox="0 0 46 46"><circle cx="23" cy="23" r="19" fill="none" stroke="var(--surface2)" strokeWidth="5" /><circle cx="23" cy="23" r="19" fill="none" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" strokeDasharray="119.4" strokeDashoffset={119.4 * Math.max(0, NEW_LIFE_POINTS - total) / NEW_LIFE_POINTS} transform="rotate(-90 23 23)" /><text x="23" y="27.5" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--fg)" fontFamily="Inter,sans-serif">{NEW_LIFE_POINTS - total}</text></svg>
        <div><b>{total === NEW_LIFE_POINTS ? "Все очки распределены" : total < NEW_LIFE_POINTS ? `Осталось ${NEW_LIFE_POINTS - total}` : `Лишних ${total - NEW_LIFE_POINTS}, убавь где-нибудь`}</b><span>Всего {NEW_LIFE_POINTS} очков, от 1 до 5 на задаток</span></div>
      </div>
      <div className="presets">{Object.entries(PRESETS).map(([label, values]) => <button className="chip" type="button" key={label} onClick={() => setLevels(Object.fromEntries(ATTRS.map((a, i) => [a, values[i]!])))}>{label}</button>)}
        <button className="chip" type="button" onClick={() => { const v = [1, 1, 1, 1, 1]; let left = NEW_LIFE_POINTS - 5; while (left > 0) { const i = Math.floor(Math.random() * 5); if (v[i]! < 5) { v[i]!++; left--; } } setLevels(Object.fromEntries(ATTRS.map((a, i) => [a, v[i]!]))); }}>Случайно</button></div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{ATTRS.map(name => <div className="pst" key={name}>
        <div className="pl"><b>{ATTR_LABEL[name]}</b><span>{LEVEL_WORD[levels[name]!]}</span></div>
        <div className="pips">{[1, 2, 3, 4, 5].map(n => <button type="button" key={n} className={n <= levels[name]! ? "pip on" : "pip"} aria-label={`${ATTR_LABEL[name]} ${n}`} onClick={() => setLevels({ ...levels, [name]: levels[name] === n && n > 1 ? n - 1 : n })} />)}</div>
      </div>)}</div>
    </div>
    <div className="foot"><button className="btn primary" type="button" disabled={total !== NEW_LIFE_POINTS} onClick={next}>Дальше</button></div>
  </>;

  return <>
    <Hdr title="Имя и рождение" sub="Шаг 6 из 6" onBack={back} />
    <div className="body">
      <label className="lbl" htmlFor="nm">Имя</label>
      <input className="field2" id="nm" maxLength={40} value={draft.name} disabled={prince} autoComplete="off" onChange={e => { setNameTouched(true); patch({ name: e.target.value }); }} />
      <p className="qs" style={{ marginTop: -6 }}>Так назвали бы в этой семье. Можно своё.</p>
      <div className="card sum">
        <div><span>Родится</span><b>{origin.label.toLocaleLowerCase("ru")}, {country?.name ?? stateInfo.name}</b></div>
        {parents.length > 0 && <div><span>Семья</span><b>{parents.map(p => p.name.split(" ")[0]).join(" и ")}</b></div>}
        <div><span>Начнёт с</span><b>{draft.age === 0 ? "рождения" : yearsWord(draft.age)}</b></div>
        <div><span>Задатки</span><b>{topTraits.length ? topTraits.join(" и ") : "ровные"}</b></div>
      </div>
      <p className="qs">После рождения героя уже не изменить. Дальше только жить.</p>
      {!validation.ok && <p className="err">{validation.errors.join(" ")}</p>}
      {!family.available && <p className="err">{family.reason}</p>}
    </div>
    <div className="foot"><Dots step={6} /><button className="btn primary" type="button" disabled={!canBorn} onClick={onStart}>Родиться</button></div>
  </>;
}
export { SECOND_PRINCE_ORIGIN_ID, kinLabel };
