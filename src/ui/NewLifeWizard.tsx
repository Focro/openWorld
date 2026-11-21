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
import { getChildAppearanceOptions } from "../worlds/veloria/heritage";
import { resolveInheritedAppearance } from "../worlds/veloria/campaign";
import { COUNTRIES } from "../worlds/veloria/atlas";
import { FAITHS } from "../worlds/veloria/faiths";
import { WORLD_DIFFICULTIES, type WorldDifficultyId } from "../worlds/veloria/difficulty";
import { NEUTRAL_TEMPERAMENT } from "../engine/development";
import { BirthSetup } from "./LifePanel";
import type { StateId } from "../worlds/veloria/populations";

type Draft = VeloriaCharacterDraft;
const ATTRS = NEW_LIFE_ATTRIBUTES;
const ATTR_LABEL: Record<string, string> = { "Сила": "Сила", "Выносливость": "Выносливость", "Ловкость": "Ловкость", "Интеллект": "Ум", "Харизма": "Обаяние" };
const PRESETS: Record<string, number[]> = { "Ровно": [3, 3, 3, 3, 3], "Умник": [2, 2, 3, 5, 3], "Крепыш": [5, 4, 3, 2, 1], "Душа компании": [2, 3, 3, 2, 5] };
const LEVEL_WORD = ["", "слабее обычного", "чуть ниже обычного", "обычно", "заметно", "редкий дар"];
const HAIR: Record<string, string> = { black: "чёрные", "dark-brown": "тёмно-каштановые", brown: "каштановые", auburn: "рыжевато-каштановые", red: "рыжие", blond: "русые", "light-blond": "светло-русые", grey: "седые", white: "белые" };
const TEXTURE: Record<string, string> = { straight: "прямые", wavy: "волнистые", curly: "кудрявые", coiled: "мелко вьющиеся" };
const EYES: Record<string, string> = { brown: "карие", "dark-brown": "тёмно-карие", hazel: "ореховые", green: "зелёные", blue: "голубые", grey: "серые", amber: "янтарные" };
const FACE: Record<string, string> = { soft: "мягкие", angular: "резкие", broad: "широкие", narrow: "узкие", mixed: "смесь черт родителей", "east-asian": "восточные" };
const SKIN = (tone: number) => tone <= 2 ? "очень светлая" : tone <= 4 ? "светлая" : tone <= 6 ? "смуглая" : tone <= 8 ? "тёмная" : "очень тёмная";

export function ageHint(age: number): [string, string] {
  if (age === 0) return ["С рождения", "Вы младенец: плачете, спите, смотрите на мир. Всё остальное впереди."];
  if (age === 1) return ["1 год", "Учитесь ходить, говорите первые слова."];
  if (age === 2) return ["2 года", "Бегаете, лезете везде, говорите короткими фразами."];
  if (age < 6) return [`${age} ${age < 5 ? "года" : "лет"}`, "Малыш: всё видите, всё спрашиваете, взрослые решают за вас."];
  return [`${age} лет`, "Ребёнок: помогаете по дому, заводите друзей, у вас есть свои секреты."];
}

const PRINCE_FIELDS: Partial<Draft> = {
  dynasticRole: "second-prince", name: "Второй принц Рейнар", age: 0, sex: "male", originId: "acknowledged-bastard", statusId: "noble", professionId: "none", familyState: "together",
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

export function NewLifeWizard({ draft, setDraft, difficulty, setDifficulty, onStart, newSeed }: {
  draft: Draft; setDraft: (update: (d: Draft) => Draft) => void;
  difficulty: WorldDifficultyId; setDifficulty: (id: WorldDifficultyId) => void;
  onStart: () => void; newSeed: () => string;
}) {
  const [step, setStep] = useState(1);
  const origin = birthOrigin(draft.birthOriginId) ?? BIRTH_ORIGINS[0]!;
  const [stateId, setStateId] = useState<StateId>(origin.stateId);
  const [nameTouched, setNameTouched] = useState(false);
  const prince = origin.fixed === true;
  const family = useMemo(() => generateVeloriaFamily(draft), [draft]);
  const preview = family.preview;
  const validation = useMemo(() => resolveVeloriaStart(draft), [draft]);
  const levels = newLifeLevels(draft.attributes);
  const total = ATTRS.reduce((sum, key) => sum + levels[key]!, 0);
  const setLevels = (next: Record<string, number>) => patch({ attributes: newLifeAttributes(next) });

  // Пока игрок сам не назвал ребёнка, имя предлагает семья.
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
  const options = family.biologicalParents.length === 2 ? getChildAppearanceOptions(family.biologicalParents[0], family.biologicalParents[1]) : undefined;
  const look = resolveInheritedAppearance(draft);
  const patch = (p: Partial<Draft>) => setDraft(d => ({ ...d, ...p }));
  const steps = ["Возраст", "Кем родиться", "Семья", "Внешность", "Задатки"];

  return <div className="wizard">
    <div className="wizard-head">
      <div><div className="eyebrow">НОВАЯ ЖИЗНЬ В ВЕЛОРИИ</div><b>Шаг {step} из 5 · {steps[step - 1]}</b></div>
      <div className="dots">{steps.map((s, i) => <i key={s} className={i + 1 === step ? "on" : i + 1 < step ? "done" : ""} />)}</div>
    </div>

    {step === 1 && <>
      <h2>С какого возраста начать?</h2>
      <p className="hint">Все жизни в Велории начинаются в детстве: с первого крика или чуть позже, но не старше 12 лет.</p>
      <div className="agebox">
        <b>{ageHint(draft.age)[0]}</b><span>{prince ? "Эта жизнь начинается с рождения." : ageHint(draft.age)[1]}</span>
        <input type="range" min={0} max={MAX_BIRTH_START_AGE} value={draft.age} disabled={prince} aria-label="Возраст на старте" onChange={e => patch({ age: Number(e.target.value) })} />
        <div className="agescale"><span>0</span><span>3</span><span>6</span><span>9</span><span>12</span></div>
      </div>
      <div className="lbl">Насколько суров мир</div>
      <div className="chips">{Object.values(WORLD_DIFFICULTIES).map(d => <button type="button" key={d.id} aria-pressed={difficulty === d.id} onClick={() => setDifficulty(d.id)}>{d.label}</button>)}</div>
    </>}

    {step === 2 && <>
      <h2>Кем вы родитесь?</h2>
      <p className="hint">Только кто вы при рождении. Кем станете, решите сами.</p>
      <div className="lbl">Держава</div>
      <div className="chips">{BIRTH_STATES.map(s => <button type="button" key={s.id} aria-pressed={stateId === s.id} onClick={() => { setStateId(s.id); const first = BIRTH_ORIGINS.find(o => o.stateId === s.id)!; if (origin.stateId !== s.id) choose(first); }}>{s.name}</button>)}</div>
      <div className="state-info"><b>{country?.name ?? stateInfo.name}</b><span>{stateInfo.climate}. {stateInfo.knownFor}</span><small>Правит: {country?.ruler}. Вера: {FAITHS.find(f => f.id === country?.primaryFaith)?.name ?? "своя"}.</small></div>
      <div className="lbl">Вы</div>
      <div className="seg">{(["male", "female"] as const).map(sex => <button type="button" key={sex} disabled={prince} aria-pressed={(draft.sex ?? "male") === sex} onClick={() => patch({ sex })}>{sex === "male" ? "Мальчик" : "Девочка"}</button>)}</div>
      <button type="button" className="ghost" onClick={fate}>Пусть решит судьба</button>
      {BIRTH_GROUPS.map(group => {
        const list = BIRTH_ORIGINS.filter(o => o.stateId === stateId && o.group === group);
        if (!list.length) return null;
        return <div className="grp" key={group}><div className="lbl">{group}</div>
          {list.map(o => <button type="button" key={o.id} className="opt" aria-pressed={draft.birthOriginId === o.id} onClick={() => choose(o)}>
            <b>{o.label}</b><span>{o.blurb}</span><em>{o.wealthHint === "бедно" ? "обычно бедно" : o.wealthHint === "скромно" ? "обычно скромно" : "обычно в достатке"}</em>
          </button>)}
        </div>;
      })}
    </>}

    {step === 3 && <>
      <h2>Ваша семья</h2>
      {prince ? <p className="hint">{family.summary}</p> : <p className="hint">{preview?.summary}</p>}
      {!prince && preview && <div className="fam">{preview.members.map(m => <div className={m.alive ? "fm" : "fm gone"} key={m.id}>
        <b>{m.name}, {m.role} <em>{m.alive ? `${m.age} ${m.age % 10 === 1 && m.age % 100 !== 11 ? "год" : m.age % 10 >= 2 && m.age % 10 <= 4 && (m.age % 100 < 12 || m.age % 100 > 14) ? "года" : "лет"}` : ""}</em></b>
        {m.alive && <span>{m.temperament}. {m.appearance} {capital(m.occupation)}.{m.livesWithYou ? "" : " Живёт отдельно."}</span>}
      </div>)}</div>}
      {!prince && preview && draft.age >= 3 && <><div className="lbl">Друзья</div>{preview.friends.length ? <div className="fam">{preview.friends.map(m => <div className="fm" key={m.id}>
        <b>{m.name}, {m.role} <em>{m.age} {m.age < 5 ? "года" : "лет"}</em></b><span>{m.temperament}. {m.appearance}</span>
      </div>)}</div> : <p className="hint">Близких друзей пока нет.</p>}</>}
      <p className="note2">Это то, что видно со стороны. Их прошлое, секреты и то, что с ними случится, вы узнаете только в игре.</p>
      {!prince && <button type="button" className="ghost" onClick={() => { setNameTouched(false); patch({ familySeed: newSeed(), skinTone: undefined, hairColor: undefined, hairTexture: undefined, eyeColor: undefined, facialFeatures: undefined }); }}>Другая семья</button>}
      <label>Как вас назовут<input maxLength={40} value={draft.name} onChange={e => { setNameTouched(true); patch({ name: e.target.value }); }} /></label>
    </>}

    {step === 4 && <>
      <h2>Какой вы?</h2>
      {prince ? <p className="hint">Внешность второго принца закреплена каноном: светлая кожа, светло-русые прямые волосы, тёмно-карие глаза, восточные черты лица.</p>
        : options?.parentsKnown && look ? <>
          <p className="hint">Выбирать можно только то, что передаётся от ваших родителей.</p>
          <div className="form-grid">
            <label>Кожа<select value={look.skinTone} onChange={e => patch({ skinTone: Number(e.target.value) as Draft["skinTone"] })}>{Array.from({ length: options.skinMax - options.skinMin + 1 }, (_, i) => options.skinMin + i).map(t => <option key={t} value={t}>{SKIN(t)} ({t}/10)</option>)}</select></label>
            <label>Цвет волос<select value={look.hairColor} onChange={e => patch({ hairColor: e.target.value as Draft["hairColor"] })}>{options.hairColors.map(v => <option key={v} value={v}>{HAIR[v]}</option>)}</select></label>
            <label>Волосы<select value={look.hairTexture} onChange={e => patch({ hairTexture: e.target.value as Draft["hairTexture"] })}>{options.hairTextures.map(v => <option key={v} value={v}>{TEXTURE[v]}</option>)}</select></label>
            <label>Глаза<select value={look.eyeColor} onChange={e => patch({ eyeColor: e.target.value as Draft["eyeColor"] })}>{options.eyeColors.map(v => <option key={v} value={v}>{EYES[v]}</option>)}</select></label>
            <label>Черты лица<select value={look.facialFeatures} onChange={e => patch({ facialFeatures: e.target.value as Draft["facialFeatures"] })}>{options.facialFeatures.map(v => <option key={v} value={v}>{FACE[v]}</option>)}</select></label>
          </div></>
        : <p className="hint">Родители неизвестны, поэтому внешность сложится сама. Вы увидите её в игре.</p>}
      <BirthSetup temperament={{ ...NEUTRAL_TEMPERAMENT, ...(draft.temperament ?? {}) }} build={draft.bodyBuild ?? "average"} heightTendency={draft.heightTendency ?? "average"}
        onChange={p => patch({ ...(p.temperament ? { temperament: p.temperament } : {}), ...(p.build ? { bodyBuild: p.build } : {}), ...(p.heightTendency ? { heightTendency: p.heightTendency } : {}) })} />
    </>}

    {step === 5 && <>
      <h2>С какими задатками вы родитесь?</h2>
      <p className="hint">Это не умения, а то, к чему тянет. Остальное даст жизнь.</p>
      <div className={total === NEW_LIFE_POINTS ? "budget good" : "budget"}><b>{total === NEW_LIFE_POINTS ? "Все очки распределены" : total < NEW_LIFE_POINTS ? `Осталось очков: ${NEW_LIFE_POINTS - total}` : `Лишних очков: ${total - NEW_LIFE_POINTS}, убавьте где-нибудь`}</b><span>{NEW_LIFE_POINTS} очков на пять задатков, от 1 до 5 на каждый</span></div>
      <div className="chips">{Object.entries(PRESETS).map(([label, values]) => <button type="button" key={label} onClick={() => setLevels(Object.fromEntries(ATTRS.map((a, i) => [a, values[i]!])))}>{label}</button>)}
        <button type="button" onClick={() => { const v = [1, 1, 1, 1, 1]; let left = NEW_LIFE_POINTS - 5; while (left > 0) { const i = Math.floor(Math.random() * 5); if (v[i]! < 5) { v[i]!++; left--; } } setLevels(Object.fromEntries(ATTRS.map((a, i) => [a, v[i]!]))); }}>Случайно</button></div>
      <div className="levels">{ATTRS.map(name => <div className="level-row" key={name}>
        <span className="level-name">{ATTR_LABEL[name]}<small>{LEVEL_WORD[levels[name]!]}</small></span>
        <span className="pips" role="radiogroup" aria-label={ATTR_LABEL[name]}>{[1, 2, 3, 4, 5].map(n => <button type="button" key={n} role="radio" aria-checked={levels[name] === n} aria-label={`${ATTR_LABEL[name]}: ${n}`} className={n <= levels[name]! ? "on" : ""} onClick={() => setLevels({ ...levels, [name]: n })} />)}</span>
      </div>)}</div>
      {!validation.ok && <div className="warning">{validation.errors.map((e, i) => <div key={i}>{e}</div>)}</div>}
      {!family.available && <div className="warning">{family.reason}</div>}
    </>}

    <div className="wizard-foot">
      {step > 1 && <button type="button" className="ghost" onClick={() => setStep(step - 1)}>Назад</button>}
      {step < 5 ? <button type="button" className="primary" disabled={step === 3 && !draft.name.trim()} onClick={() => { if (step === 1 && !draft.birthOriginId) choose(BIRTH_ORIGINS.find(o => o.stateId === stateId)!); setStep(step + 1); }}>Дальше</button>
        : <button type="button" className="primary" disabled={!validation.ok || !family.available || total !== NEW_LIFE_POINTS} onClick={onStart}>Родиться</button>}
    </div>
  </div>;
}

const capital = (t: string) => t ? t.charAt(0).toLocaleUpperCase("ru") + t.slice(1) : t;
export { SECOND_PRINCE_ORIGIN_ID };
