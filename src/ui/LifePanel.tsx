import type { GameState, WorldData } from "../engine/types";
import {
  INFANT_ACT_LABELS, MILESTONES, ageMonths, capabilities, formatAge, LIFE_STAGES, TEMPERAMENT_LABELS,
  type InfantActId, type Temperament, type BodyBuild, type HeightTendency
} from "../engine/development";

const TRAIT_LABELS: Record<string, string> = {
  warmth: "Теплота", sociability: "Общительность", assertiveness: "Напористость", emotionalReactivity: "Эмоциональность",
  patience: "Терпение", openness: "Открытость новому", discipline: "Самодисциплина", suspicion: "Настороженность", empathy: "Сопереживание", pride: "Гордость"
};

/** Потребность словами: внутри числа, игрок видит только метку. */
export function needWord(kind: "hunger" | "tiredness" | "distress" | "health", value: number): { word: string; level: "good" | "mid" | "bad" } {
  const v = Math.max(0, Math.min(100, value));
  const words: Record<typeof kind, [string, string, string, string]> = {
    hunger: ["нет", "лёгкий", "сильный", "мучительный"],
    tiredness: ["нет", "лёгкая", "клонит в сон", "без сил"],
    distress: ["спокойствие", "беспокойство", "сильная тревога", "отчаяние"],
    health: ["тяжёлая болезнь", "болезнь", "неважное", "крепкое"]
  };
  const i = v < 25 ? 0 : v < 50 ? 1 : v < 75 ? 2 : 3;
  const word = words[kind][i]!;
  const level = kind === "health" ? (i === 3 ? "good" : i === 2 ? "mid" : "bad") : (i === 0 ? "good" : i === 1 ? "mid" : "bad");
  return { word, level };
}
function Need({ label, kind, value }: { label: string; kind: Parameters<typeof needWord>[0]; value: number }) {
  const { word, level } = needWord(kind, value);
  return <div className="meter"><span>{label}</span><b className={`need ${level}`}>{word}</b></div>;
}
const traitWord = (v: number) => v >= 70 ? "сильно" : v >= 55 ? "заметно" : v >= 45 ? "средне" : v >= 30 ? "слабо" : "почти нет";
const bondWord = (security: number, familiarity: number, wariness: number) =>
  wariness >= 30 ? "настороженность" : security >= 60 ? "родной человек" : security >= 30 ? "привязанность" : familiarity >= 30 ? "знакомый" : "почти чужой";

/** Панель жизни: этап, возраст, потребности, вехи и привязанности. Показывает только то, что важно на этом этапе. */
export function LifePanel({ world, game, onAct, onLive, onHour }: { world: WorldData; game: GameState; onAct: (act: InfantActId) => void; onLive: (days: number) => void; onHour: () => void }) {
  const dev = game.development;
  if (!dev) return null;
  const caps = capabilities(dev, game.minute);
  const months = ageMonths(dev, game.minute);
  const young = months < 72;
  const reached = MILESTONES.filter(m => dev.milestones[m.id] !== undefined);
  const people = Object.entries(dev.attachments)
    .filter(([, a]) => a.familiarity >= 5 || a.lost)
    .sort(([, a], [, b]) => b.security - a.security)
    .slice(0, 6);
  const stageIndex = LIFE_STAGES.findIndex(s => s.id === caps.stage.id);
  const disabled = game.lifeStatus === "dead" || Boolean(game.journey);
  return <div className="life-panel">
    <div className="life-head">
      <div><div className="eyebrow">ЖИЗНЕННЫЙ ЭТАП</div><b>{caps.stage.label}</b> · {formatAge(dev, game.minute)}</div>
      <ol className="stage-track">{LIFE_STAGES.slice(0, stageIndex + 1).map((s, i) => <li key={s.id} className={i < stageIndex ? "past" : "now"}>{s.label}</li>)}</ol>
    </div>
    <p className="hint">{caps.stage.summary}</p>
    {young && <div className="meters">
      <Need label="Голод" kind="hunger" value={dev.needs.hunger} />
      <Need label="Усталость" kind="tiredness" value={dev.needs.tiredness} />
      <Need label="Настроение" kind="distress" value={dev.needs.distress} />
      <Need label="Здоровье" kind="health" value={dev.physical.health} />
    </div>}
    <p className="life-facts">Рост {dev.physical.heightCm} см · вес {dev.physical.weightKg} кг · {caps.maxWordsPerUtterance === 0 ? "ещё не говорит" : caps.maxWordsPerUtterance === Infinity ? "говорит свободно" : `говорит до ${caps.maxWordsPerUtterance} слов`} · {caps.canWalk ? "ходит" : caps.canCrawl ? "ползает" : "носят на руках"}</p>
    {caps.infantActions.length > 0 && <div className="quick infant-actions">{caps.infantActions.map(act => <button key={act} type="button" disabled={disabled} onClick={() => onAct(act)}>{INFANT_ACT_LABELS[act]}</button>)}</div>}
    <div className="quick live-actions">
      <span>Прожить:</span>
      <button type="button" disabled={disabled} onClick={onHour}>час</button>
      {[[1, "день"], [7, "неделю"]].map(([days, label]) => <button key={label} type="button" disabled={disabled} onClick={() => onLive(days as number)}>{label}</button>)}
    </div>
    <p className="hint">Мир живёт сам. Если случится что-то важное, время остановится.</p>
    <details>
      <summary>Развитие и близкие люди</summary>
      <div className="life-columns">
        <div>
          <b>Достигнуто</b>
          <ul className="memory">{reached.length ? reached.map(m => <li key={m.id}>{m.label}</li>) : <li>Пока ничего.</li>}</ul>
        </div>
        <div>
          <b>Привязанности</b>
          <ul className="memory">{people.length ? people.map(([id, a]) => <li key={id}><span>{world.npcs[id]?.name ?? id}</span>{a.lost ? "больше нет рядом" : bondWord(a.security, a.familiarity, a.wariness)}</li>) : <li>Устойчивых привязанностей ещё нет.</li>}</ul>
          {dev.habits.length > 0 && <><b>Привычки</b><ul className="memory">{dev.habits.slice(-5).map(h => <li key={h.id}>{h.label}</li>)}</ul></>}
        </div>
        <div>
          <b>Складывающийся характер</b>
          <ul className="memory">{Object.entries(dev.traits).map(([key, value]) => <li key={key}><span>{TRAIT_LABELS[key] ?? key}</span>{traitWord(value)}</li>)}</ul>
        </div>
      </div>
    </details>
  </div>;
}

/** Выбор врождённых задатков для старта с рождения: темперамент и телосложение, а не готовый характер. */
export function BirthSetup({ temperament, build, heightTendency, onChange }: {
  temperament: Temperament; build: BodyBuild; heightTendency: HeightTendency;
  onChange: (patch: { temperament?: Temperament; build?: BodyBuild; heightTendency?: HeightTendency }) => void;
}) {
  return <div className="birth-setup">
    <p className="hint">Характер младенца не выбирается целиком. Ты задаёшь врождённый темперамент, а черты личности сложатся из него и из того, как с ребёнком обращаются.</p>
    <div className="stats">{(Object.keys(TEMPERAMENT_LABELS) as Array<keyof Temperament>).map(key => {
      const [label, low, high] = TEMPERAMENT_LABELS[key];
      return <div className="stat" key={key}><label>{label}<b>{temperament[key]}</b></label>
        <input type="range" min={0} max={100} step={5} value={temperament[key]} onChange={e => onChange({ temperament: { ...temperament, [key]: Number(e.target.value) } })} />
        <small className="range-ends"><span>{low}</span><span>{high}</span></small></div>;
    })}</div>
    <div className="form-grid">
      <label>Склонность телосложения<select value={build} onChange={e => onChange({ build: e.target.value as BodyBuild })}><option value="slender">Хрупкое</option><option value="average">Среднее</option><option value="sturdy">Крепкое</option></select></label>
      <label>Ожидаемый рост во взрослом возрасте<select value={heightTendency} onChange={e => onChange({ heightTendency: e.target.value as HeightTendency })}><option value="short">Ниже среднего</option><option value="average">Средний</option><option value="tall">Выше среднего</option></select></label>
    </div>
    <p className="hint">Это наследственная склонность. Реальный рост и вес будут зависеть от питания, здоровья и условий жизни.</p>
  </div>;
}
