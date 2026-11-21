/**
 * Главная страница сайта до входа (0.19.0), один в один по макету Жозы design/01.
 * Здесь нет вкладок игры, настроек, ключа ИИ и даты рождения. «Начать» и «Войти» открывают вход через Google.
 */
import { useEffect, useState } from "react";
import { I } from "./icons";

const SCENES: Array<{ tab: string; when: string; text: string; ch: Array<[string, string, string]> }> = [
  { tab: "Ночь", when: "Десять лет спустя", text: "Ночь. Тебе семь, и тебе не спится. Из коридора доносится шёпот, а потом кто-то тихо зовёт тебя по имени. Свеча у кровати почти догорела.",
    ch: [["Выглянуть в коридор", "В конце коридора мелькает край плаща. На полу остаётся серебряная пуговица.", "Ты всё ещё хранишь ту пуговицу. Сегодня её хозяин, первый советник, предлагает тебе союз и не знает, что ты помнишь ту ночь."],
      ["Позвать стражу", "Стражник прибегает с факелом, но коридор пуст. Он смотрит на тебя так, будто знает больше.", "Тот стражник теперь капитан гвардии. С той ночи он присматривает за тобой, и когда начнётся смута, он будет на твоей стороне."],
      ["Спрятаться под одеяло", "Шёпот стихает. Утром слуги говорят, что ночью из дворца кто-то исчез.", "На рынке чужой страны ты встречаешь того, кто исчез той ночью. Он узнаёт тебя и делает вид, что видит впервые."]] },
  { tab: "Перстень", when: "Двенадцать лет спустя", text: "Тебе девять. У ворот нищенка хватает тебя за рукав и вкладывает в ладонь холодный перстень. «Спрячь. Никому не показывай. Особенно отцу». Она исчезает в толпе, а на перстне герб, который давно запрещено носить.",
    ch: [["Спрятать перстень", "Ты прячешь его в щель под подоконником. Ночью снится, что кто-то тихо стучит в стекло.", "К тебе приходит седая женщина. «Ты сохранил его. Значит, тебе можно доверять». И рассказывает, кто на самом деле должен сидеть на троне."],
      ["Отдать отцу", "Отец бледнеет, молча забирает перстень и запирает дверь. Наутро нищенку ищет вся стража.", "Ту женщину так и не нашли. А отец с того дня ни разу не оставил тебя без охраны. Ты до сих пор не знаешь, от кого он тебя берёг."],
      ["Догнать её и вернуть", "Ты бежишь сквозь толпу, но её нигде нет. Только старый торговец видел, как ты её искал.", "Тот торговец теперь глава гильдии. Он помнит ребёнка, который хотел вернуть чужое, и предлагает тебе то, чего не предложит никто другой."]] },
  { tab: "Друг", when: "Десять лет спустя", text: "Тебе тринадцать. Твой лучший друг сломал меч наставника и шепчет: «Скажи, что это ты. Тебя простят, а меня выгонят». Шаги наставника уже за дверью.",
    ch: [["Взять вину на себя", "Тебя оставляют без ужина и запирают в оружейной. Ночью друг тайком приносит тебе хлеб.", "В бою он закрывает тебя своим щитом. «За тот меч», говорит он. Это его последние слова."],
      ["Сказать правду", "Друга выгоняют со двора. Он уходит, не оглядываясь.", "Он возвращается командиром наёмников. Он помнит тот день, и его отряд стоит у ворот твоего города."],
      ["Промолчать", "Наставник наказывает вас обоих. Друг не разговаривает с тобой неделю.", "Вы оба служите при дворе. Он так и не решил, можно ли тебе доверять, и сомневается в самый важный момент."]] }
];

function Teaser({ onLogin }: { onLogin: () => void }) {
  const [cur, setCur] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [later, setLater] = useState(false);
  const sc = SCENES[cur]!;
  const show = (i: number) => { setCur(i); setPicked(null); setLater(false); };
  const c = picked !== null ? sc.ch[picked]! : null;
  const next = (cur + 1) % SCENES.length;
  return <div className="teaser" aria-live="polite">
    <div className="t-head"><span className="w"><span className="dot" />Попробуй сам</span>
      <div className="tabs" role="tablist">{SCENES.map((x, k) => <button key={x.tab} className="tab" type="button" role="tab" aria-selected={k === cur} onClick={() => show(k)}>{x.tab}</button>)}</div></div>
    {!c ? <>
      <div><p className="story fade">{sc.text}</p></div>
      <div className="choices">{sc.ch.map((x, k) => <button key={x[0]} className="ch" type="button" onClick={() => setPicked(k)}>{I.chevron}{x[0]}</button>)}</div>
    </> : !later ? <>
      <div><p className="story fade">{c[1]}<span className="you">Ты выбрал: {c[0]}. Мир это запомнил.</span></p></div>
      <div className="choices"><div className="after fade"><button className="btn primary" type="button" onClick={() => setLater(true)}>Чем это может обернуться {I.chevron}</button></div></div>
    </> : <>
      <div><p className="story">{c[1]}</p><div className="later fade"><span className="lbl">{sc.when}, если доживёшь</span><p className="story">{c[2]}</p></div></div>
      <div className="choices"><div className="after fade"><button className="btn primary" type="button" onClick={onLogin}>Прожить это по-настоящему {I.arrow}</button><button className="ghost" type="button" onClick={() => show(next)}>Другая история: {SCENES[next]!.tab}</button></div></div>
    </>}
    <p className="t-foot">Это пример. В игре можно написать и свой вариант.</p>
  </div>;
}

function Brand() {
  return <a className="brand" href="#"><span className="mark"><img src="logo-mark-on-dark-128.png" alt="" /></span>OpenWorld</a>;
}

function Footer() {
  return <footer><div className="in"><span>OpenWorld</span><span className="foot-links">
    <a href="#what">Что это такое</a><a href="#why">Зачем мы это делаем</a><a href="#about">О проекте</a>
    <a href="./privacy.html" target="_blank" rel="noopener">Политика</a><a href="./terms.html" target="_blank" rel="noopener">Условия</a>
  </span></div></footer>;
}

function TextPage({ title, children, onLogin, plain = false, extra }: { title: string; children: React.ReactNode; onLogin: () => void; plain?: boolean; extra?: React.ReactNode }) {
  return <>
    <div className="in"><nav className="nav"><Brand /><button className="btn sm" type="button" onClick={onLogin}>Войти</button></nav></div>
    <article className="about"><div className="in">
      <a className="back" href="#">{I.back}На главную</a>
      <h1>{title}</h1>
      <div className={plain ? "txt plain" : "txt"}>{children}</div>
      <div className="cta"><button className="btn primary" type="button" onClick={onLogin}>{plain ? "Начать" : <>Начать свою историю {I.arrow}</>}</button>{extra}</div>
    </div></article>
    <Footer />
  </>;
}

export function Site({ onGoogle, busy, message }: { onGoogle: () => void; busy: boolean; message: string }) {
  const [hash, setHash] = useState(() => globalThis.location?.hash ?? "");
  const [login, setLogin] = useState(false);
  useEffect(() => {
    const on = () => { setHash(location.hash); window.scrollTo(0, 0); };
    addEventListener("hashchange", on);
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setLogin(false); };
    addEventListener("keydown", esc);
    return () => { removeEventListener("hashchange", on); removeEventListener("keydown", esc); };
  }, []);
  const open = () => setLogin(true);
  const toggleTheme = () => {
    const r = document.documentElement;
    const cur = r.getAttribute("data-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    r.setAttribute("data-theme", cur === "dark" ? "light" : "dark");
  };

  let view: React.ReactNode;
  if (hash === "#what") view = <TextPage title="Мир, который тебя запомнит" onLogin={open}>
    <p>В детстве мы все придумывали миры. Королевства под столом, звёздные корабли из коробок, друзей, которые жили только в нашей голове. Потом мы выросли, а желание пожить чужой жизнью никуда не делось.</p>
    <p>Обычные игры дают сюжет и ведут по нему за руку. Мы хотели другого: мир, который не крутится вокруг тебя, но замечает тебя. Где ты рождаешься никем, растёшь, ошибаешься, и где люди помнят, кем ты был вчера.</p>
    <p>OpenWorld это место для таких историй. Каждый мир здесь со своими законами, семьями и тайнами. Первый из них, Велория, уже ждёт. Дальше будут другие, совсем непохожие.</p>
    <p>Здесь нет правильного прохождения. Есть только твоя жизнь, и как ты её проживёшь.</p>
  </TextPage>;
  else if (hash === "#why") view = <TextPage title="Здесь ты выбираешь, кем родиться" onLogin={open}>
    <p>Мне всегда хотелось узнать другие миры. Наш мир иногда кажется скучноватым: хочется попробовать что-то новое, прожить другую жизнь, увидеть то, чего здесь нет.</p>
    <p>Но в этом мире у меня много ограничений, которые я не выбирал. Пол, цвет кожи, место, где я родился. Многое решено за меня ещё до первого шага.</p>
    <p>В OpenWorld этих границ нет. Здесь ты сам выбираешь, кем родиться: принцем или дочерью кузнеца, в южном султанате или в северном лесу. И дальше живёшь эту жизнь так, как хочешь ты.</p>
    <p>Поэтому я и задумал этот проект. Чтобы каждый мог хотя бы ненадолго стать кем угодно. Первый мир, Велория, уже ждёт. Дальше будут другие, совсем непохожие.</p>
    <p className="sign">Автор OpenWorld</p>
  </TextPage>;
  else if (hash === "#about") view = <TextPage title="О проекте" plain onLogin={open} extra={<a className="btn" href="#why">Зачем мы это делаем</a>}>
    <p>OpenWorld это платформа текстовых ролевых миров. Историю ведёт искусственный интеллект, а правила, карта, семьи и события каждого мира заранее проработаны авторами. Игрок проживает жизнь своего персонажа и сам решает, что делать, выбирая вариант или описывая действие своими словами.</p>
    <div className="facts">
      <div className="fact"><b>Миры</b>У каждого мира свой канон: история, государства, законы и родословные. Первый мир, Велория, открыт. Следующие в работе.</div>
      <div className="fact"><b>Персонаж</b>Жизнь начинается с рождения. Характер, навыки и отношения складываются из решений игрока.</div>
      <div className="fact"><b>Память</b>Персонажи мира запоминают поступки игрока, и последствия могут проявиться через годы.</div>
    </div>
    <h2>Как начать</h2>
    <ol className="steps"><li>Войдите через Google.</li><li>Выберите мир.</li><li>Подключите свой ключ ИИ (DeepSeek, Claude, OpenAI или OpenRouter). Ключ хранится в зашифрованном виде и открывается только вашим паролем.</li></ol>
    <h2>Статус</h2>
    <p>Проект в раннем доступе. Возможны ошибки и изменения, сохранения и правила миров ещё дорабатываются. Мы будем рады отзывам.</p>
  </TextPage>;
  else view = <>
    <div className="hero">
      <div className="blob b1" /><div className="blob b2" />
      <div className="in" style={{ display: "block" }}>
        <nav className="nav"><Brand />
          <div className="nav-r">
            <a className="ghost hide-s" href="#about">О проекте</a>
            <button className="ghost" type="button" aria-label="Сменить тему" onClick={toggleTheme}>◐</button>
            <button className="btn sm" type="button" onClick={open}>Войти</button>
          </div>
        </nav>
      </div>
      <div className="in" style={{ marginTop: 20 }}>
        <div>
          <span className="kicker">{I.star16}Первый мир уже открыт</span>
          <h1>Проживи целую жизнь <em>в другом мире</em></h1>
          <p className="sub">Родись, вырасти, найди друзей и врагов. Мир живёт сам по себе и помнит каждый твой выбор. Никаких сценариев, только твоя история.</p>
          <div className="cta"><button className="btn primary" type="button" onClick={open}>Начать историю {I.arrow}</button><a className="btn" href="#what">Что это такое</a></div>
          <p className="hint">Бесплатно. Вход через Google.</p>
        </div>
        <Teaser onLogin={open} />
      </div>
    </div>
    <section className="sec"><div className="in">
      <h2>Чем это отличается</h2>
      <div className="three">
        <div className="p"><span className="ic">{I.heart}</span><h3>Тебя помнят</h3><p>Люди вокруг запоминают твои слова и поступки. Обиду, помощь, обещание. Отношения растут годами.</p></div>
        <div className="p"><span className="ic">{I.clock}</span><h3>С рождения</h3><p>Ты не появляешься готовым героем. Детство, учёба, первые решения, и только потом большие дела.</p></div>
        <div className="p"><span className="ic">{I.people}</span><h3>Мир живёт сам</h3><p>Пока ты занят своим, другие плетут интриги, женятся, воюют и умирают. Мир не ждёт, пока ты нажмёшь кнопку.</p></div>
      </div>
    </div></section>
    <section className="sec" style={{ paddingTop: 8 }}><div className="in">
      <h2>Миры</h2>
      <div className="worlds">
        <div className="wc"><div className="art" style={{ background: "linear-gradient(160deg,#5d72d6,#c7a2e0)" }} /><div className="tx"><b>Велория</b><span>Шесть держав, короны и клятвы</span></div></div>
        <div className="wc soon"><div className="art" /><div className="tx"><b>Новый мир</b><span>Скоро</span></div></div>
        <div className="wc soon"><div className="art" /><div className="tx"><b>Новый мир</b><span>Скоро</span></div></div>
      </div>
    </div></section>
    <section className="sec" style={{ paddingTop: 8 }}><div className="in">
      <a className="about-link" href="#why"><div><b>Зачем мы это делаем</b><span>Минута чтения о том, откуда взялась идея</span></div><span className="go">{I.arrow}</span></a>
    </div></section>
    <Footer />
  </>;

  return <div className="site">
    {view}
    {login && <div className="modal" onClick={e => { if (e.target === e.currentTarget) setLogin(false); }}>
      <form className="card" noValidate onSubmit={e => e.preventDefault()}>
        <button className="x" type="button" aria-label="Закрыть" onClick={() => setLogin(false)}>{I.close}</button>
        <span className="mark"><img src="logo-mark-on-dark-128.png" alt="" /></span>
        <h3>Добро пожаловать</h3>
        <p className="sub">Один шаг, и твоя история начнётся</p>
        <button className="btn primary" type="button" id="gBtn" disabled={busy} onClick={onGoogle}><span className="g">G</span>Продолжить с Google</button>
        {message && <p className="ok">{message}</p>}
        <p className="fine">Продолжая, вы принимаете <a href="./terms.html" target="_blank" rel="noopener">условия</a> и <a href="./privacy.html" target="_blank" rel="noopener">политику конфиденциальности</a></p>
      </form>
    </div>}
  </div>;
}
