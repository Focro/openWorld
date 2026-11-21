/** Иконки из макетов Жозы (линейные, 24×24). */
const S = ({ d, children, size }: { d?: string; children?: React.ReactNode; size?: number }) =>
  <svg className="i" viewBox="0 0 24 24" style={size ? { width: size, height: size } : undefined} aria-hidden="true">{d ? <path d={d} /> : children}</svg>;

export const I = {
  chevron: <S d="M9 6l6 6-6 6" />,
  chevronMuted: <svg className="i" viewBox="0 0 24 24" style={{ width: 16, height: 16, color: "var(--muted)" }} aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>,
  arrow: <S d="M5 12h14M13 6l6 6-6 6" />,
  back: <S size={18} d="M19 12H5M11 6l-6 6 6 6" />,
  backChevron: <S d="M15 6l-6 6 6 6" />,
  close: <S d="M6 6l12 12M18 6L6 18" />,
  star16: <S size={16} d="M12 3l2.2 5.3L20 9l-4.4 3.8L17 18.5 12 15.5 7 18.5l1.4-5.7L4 9l5.8-.7z" />,
  heart: <S d="M12 21c-4-3-7-6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4-3 7-7 10z" />,
  clock: <S><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></S>,
  people: <S><path d="M4 20c2-5 5-8 8-8s6 3 8 8" /><circle cx="12" cy="6.5" r="3" /><circle cx="5" cy="9" r="2" /><circle cx="19" cy="9" r="2" /></S>,
  gear: <S><path d="M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.3a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4a2 2 0 0 0 .7 2.7l.2.1a2 2 0 0 1 1 1.7v.5a2 2 0 0 1-1 1.7l-.2.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.3a2 2 0 0 1 1 1.7v.2a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.3a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.7v-.5a2 2 0 0 1 1-1.7l.2-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.3a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></S>,
  hourglass: <S d="M6 4h12M6 20h12M7 4c0 5 10 5 10 8s-10 3-10 8M17 4c0 5-10 5-10 8" />,
  sparkle: <S d="M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4z" />,
  sparkle16: <S size={16} d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4z" />,
  send: <S d="M5 12h14M13 6l6 6-6 6" />,
  tabStory: <S d="M5 4.5h10a3 3 0 0 1 3 3V20l-4-2.5H5z" />,
  tabHero: <S><circle cx="12" cy="8" r="3.5" /><path d="M5 20c1.2-3.6 4-5 7-5s5.8 1.4 7 5" /></S>,
  tabWorld: <S><path d="M9 4l6 2 5-2v14l-5 2-6-2-5 2V6z" /><path d="M9 4v14M15 6v14" /></S>,
  tabMemory: <S><path d="M12 7v5l3 2" /><path d="M4 12a8 8 0 1 0 2.3-5.6L4 8.5" /><path d="M4 4v4.5h4.5" /></S>,
  dice: <S><rect x="4" y="4" width="16" height="16" rx="4" /><circle cx="9" cy="9" r="1" fill="currentColor" /><circle cx="15" cy="15" r="1" fill="currentColor" /><circle cx="15" cy="9" r="1" fill="currentColor" /><circle cx="9" cy="15" r="1" fill="currentColor" /></S>,
  info16: <S size={16}><circle cx="12" cy="12" r="8" /><path d="M12 11v5M12 8h.01" /></S>,
  plus: <S d="M12 5v14M5 12h14" />,
  pin: <S><path d="M12 21s-6-5.5-6-10a6 6 0 0 1 12 0c0 4.5-6 10-6 10z" /><circle cx="12" cy="11" r="2" /></S>,
  bookOpen: <S d="M12 6c3-2 6-2 8 0v12c-2-2-5-2-8 0-3-2-6-2-8 0V6c2-2 5-2 8 0zM12 6v12" />,
  moon: <S d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z" />,
  palette: <S><circle cx="12" cy="12" r="8.5" /><circle cx="9" cy="9.5" r="1.3" /><circle cx="14.5" cy="8.5" r="1.3" /><circle cx="16" cy="13.5" r="1.3" /></S>,
  lines: <S d="M4 7h10M4 12h16M4 17h7" />,
  lock: <S><rect x="5" y="10" width="14" height="10" rx="3" /><path d="M8 10V7.5a4 4 0 0 1 8 0V10" /></S>,
  download: <S><path d="M12 4v11M7 10l5 5 5-5" /><path d="M5 20h14" /></S>,
  help: <S><circle cx="12" cy="12" r="8" /><path d="M12 8v4M12 16h.01" /></S>,
  reborn: <S><path d="M4 12a8 8 0 1 0 2.3-5.6L4 8.5" /><path d="M4 4v4.5h4.5" /></S>,
  home: <S d="M4 11l8-7 8 7v9H4z" />,
  exit: <S d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11" />
};
