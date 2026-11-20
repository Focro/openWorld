import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ATTRIBUTE_MAX, ATTRIBUTE_MIN, ATTRIBUTE_TOTAL, attributeSum, attributes, validateCharacter } from "./character";
import type { CharacterDraft } from "./character";
import { WorldSchema } from "./schema";
import { applyAction } from "./engine/rules";
import { parseAction } from "./engine/parse";
import { createInitialState, defaultWorld } from "./engine/world";
import { dayOf, formatClock } from "./engine/time";
import { describeAttitude } from "./engine/relations";
import { searchChronicle } from "./engine/memory";
import type { MemoryEntry } from "./engine/types";

type Tab = "ИГРА" | "МИР" | "ПЕРСОНАЖ" | "ПАМЯТЬ" | "СИСТЕМА";
const TABS: Tab[] = ["ИГРА", "МИР", "ПЕРСОНАЖ", "ПАМЯТЬ", "СИСТЕМА"];
const QUICK = ["осмотреться", "инвентарь", "подождать", "идти рынок", "идти таверна", "купить хлеб"];

const defaults: Record<string, number> = {
  Сила: 16, Выносливость: 15, Ловкость: 15, Интеллект: 14, Восприятие: 14, Харизма: 12, Воля: 14
};

const rumorNote = (m: MemoryEntry) =>
  m.kind === "heard" ? ` (слух, ${Math.round(m.confidence * 100)}%)` : "";

export default function App() {
  const world = defaultWorld;
  const [tab, setTab] = useState<Tab>("ИГРА");
  const [game, setGame] = useState(() => createInitialState(world));
  const [log, setLog] = useState<string[]>(() => game.playerMemory.map((m) => m.text));
  const [action, setAction] = useState("");
  const [worldDraft, setWorldDraft] = useState({
    name: "Новый мир", genre: "Фэнтези", era: "Средневековье", technology: "Ремесленная", magic: "Редкая", description: ""
  });
  const [character, setCharacter] = useState<CharacterDraft>({ name: "Путник", concept: "", attributes: defaults });
  const [savedName, setSavedName] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const total = useMemo(() => attributeSum(character.attributes), [character.attributes]);
  const validation = useMemo(() => validateCharacter(character), [character]);
  const worldCheck = useMemo(() => WorldSchema.safeParse(worldDraft), [worldDraft]);
  const location = world.locations[game.playerLocation]!;
  const found = useMemo(() => searchChronicle(game, { text: query }), [game, query]);

  function run(text: string) {
    const parsed = parseAction(world, text);
    if (!parsed.ok) { setLog((l) => [...l, parsed.reason]); return; }
    const result = applyAction(world, game, parsed.action);
    setGame(result.state);
    setLog((l) => [...l, result.message]);
  }

  function submitAction(e: FormEvent) {
    e.preventDefault();
    if (action.trim()) run(action);
    setAction("");
  }

  function changeAttr(name: string, value: number) {
    setCharacter((c) => ({ ...c, attributes: { ...c.attributes, [name]: value } }));
    setSavedName(null);
  }

  function saveCharacter() {
    if (!validation.ok) return;           // невалидную сборку сохранить нельзя
    const name = character.name.trim();
    setGame((g) => ({ ...g, playerName: name }));
    setSavedName(name);
  }

  return <main className="shell">
    <header className="topbar">
      <div><div className="eyebrow">TEXT ROLEPLAY SIMULATOR</div><h1>LIVING WORLD <span>RPG</span></h1></div>
      <div className="status"><i /> LOCAL ALPHA</div>
    </header>
    <nav className="tabs">{TABS.map((item) =>
      <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}</nav>

    {tab === "ИГРА" && <section className="panel">
      <div className="section-head">
        <div><div className="eyebrow">ТЕКУЩАЯ СЕССИЯ</div><h2>{worldDraft.name}</h2></div>
        <div className="clock">День {dayOf(game.minute)} · {formatClock(game.minute)}</div>
      </div>
      <div className="location">⌖ {location.name}</div>
      <div className="story">{log.map((line, i) => <p key={i}>{line}</p>)}</div>
      <div className="quick">{QUICK.map((q) => <button key={q} type="button" onClick={() => run(q)}>{q}</button>)}</div>
      <form className="action-form" onSubmit={submitAction}>
        <input value={action} onChange={(e) => setAction(e.target.value)} placeholder="Что вы хотите сделать?" />
        <button className="primary">ДЕЙСТВИЕ</button>
      </form>
      <p className="hint">Команды: «осмотреться», «инвентарь», «подождать [N мин/часов]», «идти &lt;место&gt;», «купить &lt;товар&gt; [N]». Неизвестные действия мир не меняют.</p>
    </section>}

    {tab === "МИР" && <section className="panel">
      <div className="eyebrow">КОНСТРУКТОР</div><h2>Создание мира</h2>
      <div className="form-grid">
        <label>Название мира<input value={worldDraft.name} onChange={e => setWorldDraft({ ...worldDraft, name: e.target.value })} /></label>
        <label>Жанр<select value={worldDraft.genre} onChange={e => setWorldDraft({ ...worldDraft, genre: e.target.value })}><option>Фэнтези</option><option>Научная фантастика</option><option>Постапокалипсис</option><option>Современность</option><option>Исторический</option></select></label>
        <label>Эпоха<input value={worldDraft.era} onChange={e => setWorldDraft({ ...worldDraft, era: e.target.value })} /></label>
        <label>Уровень технологий<input value={worldDraft.technology} onChange={e => setWorldDraft({ ...worldDraft, technology: e.target.value })} /></label>
        <label>Магия<input value={worldDraft.magic} onChange={e => setWorldDraft({ ...worldDraft, magic: e.target.value })} /></label>
      </div>
      <label>Описание<textarea value={worldDraft.description} onChange={e => setWorldDraft({ ...worldDraft, description: e.target.value })} placeholder="История, география, государства, правила мира..." /></label>
      {!worldCheck.success && <div className="warning">Проверьте поля: название 1–60 символов, описание до 2000.</div>}
      <p className="hint">Пока это черновик: игровой мир (локации, NPC, цены) задан в коде, редактор географии и фракций ещё не реализован.</p>
    </section>}

    {tab === "ПЕРСОНАЖ" && <section className="panel">
      <div className="section-head">
        <div><div className="eyebrow">ЛИСТ ПЕРСОНАЖА</div><h2>Создание персонажа</h2></div>
        <div className={total === ATTRIBUTE_TOTAL ? "total good" : "total"}>{total} / {ATTRIBUTE_TOTAL} очков</div>
      </div>
      <label>Имя персонажа<input value={character.name} onChange={e => { setCharacter({ ...character, name: e.target.value }); setSavedName(null); }} /></label>
      <label>Концепция персонажа<textarea value={character.concept} onChange={e => { setCharacter({ ...character, concept: e.target.value }); setSavedName(null); }} placeholder="Происхождение, внешность, прошлое, цели..." /></label>
      <div className="stats">{attributes.map(name => <div className="stat" key={name}>
        <label>{name}<b>{character.attributes[name]}</b></label>
        <input type="range" min={ATTRIBUTE_MIN} max={ATTRIBUTE_MAX} value={character.attributes[name]} onChange={e => changeAttr(name, Number(e.target.value))} />
      </div>)}</div>
      {!validation.ok && <div className="warning">{validation.errors.map((e, i) => <div key={i}>{e}</div>)}</div>}
      <div className="save-row">
        <button className="primary" disabled={!validation.ok} onClick={saveCharacter}>СОХРАНИТЬ ПЕРСОНАЖА</button>
        {savedName && <span className="saved">✓ Сохранён: {savedName}</span>}
      </div>
      <p className="hint">Каждая характеристика: от {ATTRIBUTE_MIN} до {ATTRIBUTE_MAX}. Общий бюджет: ровно {ATTRIBUTE_TOTAL} очков. Невалидную сборку сохранить нельзя. Хранится только в состоянии страницы.</p>
    </section>}

    {tab === "ПАМЯТЬ" && <section className="panel">
      <div className="eyebrow">ПАМЯТЬ МИРА</div><h2>Хроника и знания</h2>
      <h3 className="sub">Хроника мира (объективная)</h3>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по хронике..." />
      {found.length ? <ul className="memory">{found.map((c) =>
        <li key={c.id}><span>{formatClock(c.minute)}</span>{c.text}</li>)}</ul>
        : <div className="placeholder">{game.chronicle.length ? "Ничего не найдено." : "Событий пока нет."}</div>}
      <h3 className="sub">Память игрока</h3>
      <ul className="memory">{game.playerMemory.map((m, i) => <li key={i}><span>{formatClock(m.minute)}</span>{m.text}</li>)}</ul>
      <h3 className="sub">Память NPC (только то, что они видели)</h3>
      {Object.values(world.npcs).map((npc) => <div key={npc.id}>
        <b className="npc">{npc.name}</b>
        <p className="muted">К игроку: {describeAttitude(game.relations[npc.id]!)}</p>
        {(game.npcMemory[npc.id] ?? []).length
          ? <ul className="memory">{game.npcMemory[npc.id]!.map((m, i) => <li key={i}><span>{formatClock(m.minute)}</span>{m.text}{rumorNote(m)}</li>)}</ul>
          : <p className="muted">Ничего не помнит.</p>}
      </div>)}
    </section>}

    {tab === "СИСТЕМА" && <section className="panel">
      <div className="eyebrow">СОСТОЯНИЕ ПРОЕКТА</div><h2>Системное ядро</h2>
      <ul className="checklist">
        <li>✓ Базовый интерфейс и навигация</li>
        <li>✓ Движок — единственный источник истины, чистые правила</li>
        <li>✓ Время, локации, перемещение, деньги, инвентарь, покупка</li>
        <li>✓ NPC: расписания, занятия, собственные цели</li>
        <li>✓ Память свидетелей, слухи (с падением уверенности и забыванием)</li>
        <li>✓ Отношения: доверие, симпатия, страх, уважение — меняются постепенно</li>
        <li>✓ События с временем и источником, поиск по хронике</li>
        <li>✓ Раздельные память мира, игрока и NPC</li>
        <li>✓ Лист персонажа: 7 атрибутов, 100 очков, невалидное не сохраняется</li>
        <li>✓ Граница для ИИ: предложение → проверка → правила</li>
        <li>✓ Формат сохранений с версией и ветками (в коде)</li>
        <li>○ NPC: самостоятельные решения, диалоги, семьи</li>
        <li>○ Навыки, происхождение, семья, страхи, стартовое имущество</li>
        <li>○ Редактор мира: география, климат, политика, фракции</li>
        <li>○ Сохранения в интерфейсе (экспорт/импорт, ветки)</li>
        <li>○ Защищённое подключение ИИ-провайдера (серверный прокси)</li>
      </ul>
      <div className="warning">API-ключи намеренно не запрашиваются и не сохраняются. Не добавляйте секреты в клиентский код, GitHub, localStorage или переменные VITE_*.</div>
    </section>}
    <footer> LIVING WORLD RPG <span>· prototype 0.4.0 · данные пока хранятся только в состоянии страницы</span></footer>
  </main>;
}
