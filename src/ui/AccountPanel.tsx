import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getCloudSave, listCloudSaves, putCloudSave, signInWithGoogle, signOut, type Cloud, type CloudSaveInfo, AUTO_SLOT, GRAVEYARD_WORLD } from "../cloud/account";

/** Вход через Google. Используется и в настройках, и на первом экране. */
export function SignInForm({ cloud, compact = false }: { cloud: Cloud; compact?: boolean }) {
  // Вход только через Google (решение автора): без паролей и писем.
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function google() {
    setBusy(true); setMessage("");
    try { await signInWithGoogle(cloud); } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); setBusy(false); }
  }
  return <div className="account-signin">
    {!compact && <p className="hint">С аккаунтом игра хранит сохранения в облаке и продолжается на любом устройстве. Ключ ИИ хранится там же, но только зашифрованным вашим паролем.</p>}
    <div className="save-row"><button className="primary" disabled={busy} onClick={google}>ВОЙТИ ЧЕРЕЗ GOOGLE</button></div>
    {message && <p className="hint" role="status">{message}</p>}
  </div>;
}

const SLOT_LABEL = (slot: string, worldId: string) => `${worldId === "veloria" ? "Велория" : worldId}: ${slotWord(slot)}`;
const slotWord = (slot: string) => slot === AUTO_SLOT ? "Автосохранение" : slot === "manual" ? "Ручное сохранение" : slot;
const when = (iso: string) => { try { return new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); } catch { return iso; } };

export function AccountPanel({ cloud, session, cloudSavedAt, worldId, currentSaveJson, onLoad }: {
  cloud: Cloud | null;
  session: Session | null;
  /** Когда автосохранение последний раз ушло в облако. */
  cloudSavedAt?: string;
  worldId: string;
  /** JSON текущей игры в формате автосохранения или null, если героя нет. */
  currentSaveJson: () => string | null;
  onLoad: (json: string) => void;
}) {
  const [saves, setSaves] = useState<CloudSaveInfo[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const userId = session?.user.id;

  async function refresh() {
    if (!cloud || !userId) return;
    try { setSaves((await listCloudSaves(cloud)).filter(s => s.worldId !== GRAVEYARD_WORLD)); } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
  }
  useEffect(() => { void refresh(); }, [cloud, userId, cloudSavedAt]);

  if (!cloud) return <div className="ai-settings"><h3 className="sub">Аккаунт</h3><p className="hint">В этой сборке облако не настроено, игра хранится только в этом браузере.</p></div>;
  if (!session) return <div className="ai-settings"><h3 className="sub">Аккаунт</h3><SignInForm cloud={cloud} /></div>;

  async function saveNow() {
    const json = currentSaveJson();
    if (!json || !cloud) { setMessage("Сохранять пока нечего: герой ещё не создан."); return; }
    setBusy(true);
    try { await putCloudSave(cloud, worldId, "manual", json); setMessage("Сохранено в облако."); await refresh(); }
    catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  }
  async function load(info: CloudSaveInfo) {
    if (!cloud) return;
    setBusy(true);
    try { const json = await getCloudSave(cloud, info.worldId, info.slot); if (json) onLoad(json); else setMessage("Сохранение не найдено."); }
    catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  }

  return <div className="ai-settings">
    <h3 className="sub">Аккаунт</h3>
    <p className="hint">Вы вошли как {session.user.email ?? "игрок"}. {cloudSavedAt ? `Автосохранение в облаке: ${when(cloudSavedAt)}.` : "Автосохранение уйдёт в облако после следующего хода."}</p>
    <div className="save-row"><button disabled={busy} onClick={saveNow}>СОХРАНИТЬ В ОБЛАКО</button><button disabled={busy} onClick={() => void signOut(cloud)}>ВЫЙТИ</button></div>
    {saves.length > 0 && <><h3 className="sub">Сохранения в облаке</h3><ul className="cloud-saves">{saves.map(s => <li key={`${s.worldId}/${s.slot}`}><span><b>{SLOT_LABEL(s.slot, s.worldId)}</b> · {when(s.updatedAt)}</span><button disabled={busy} onClick={() => load(s)}>ЗАГРУЗИТЬ</button></li>)}</ul></>}
    {message && <p className="hint" role="status">{message}</p>}
  </div>;
}
