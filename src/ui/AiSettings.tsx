import { useState } from "react";
import { AI_PROVIDERS, isAiProviderId, type AiProviderId } from "../ai/proxyClient";
import { clearVaultRecord, decryptApiKey, encryptApiKey, loadVaultRecord, passwordProblems, saveVaultRecord, type UnlockedKeySession } from "../ai/keyVault";

/** Настройка ИИ: свой ключ хранится только зашифрованным паролем игрока. Игра работает и без ИИ. */
export function AiSettings({ session, endpoint, onEndpoint, enabled, onEnabled, provider, onProvider, model, onModel, onChange }: {
  session: UnlockedKeySession; endpoint: string; onEndpoint: (value: string) => void;
  enabled: boolean; onEnabled: (value: boolean) => void;
  provider: AiProviderId; onProvider: (value: AiProviderId) => void;
  model: string; onModel: (value: string) => void; onChange: () => void;
}) {
  const [record, setRecord] = useState(() => loadVaultRecord());
  const [apiKey, setApiKey] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    const problems = passwordProblems(password);
    if (problems.length) { setMessage(problems.join(" ")); return; }
    setBusy(true);
    try {
      const next = await encryptApiKey(apiKey, password, provider);
      if (!saveVaultRecord(next)) setMessage("Браузер не дал сохранить запись (например, приватный режим). Ключ будет жить только до закрытия вкладки.");
      else setMessage("Ключ зашифрован и сохранён. Пароль нигде не хранится — не забудьте его.");
      session.unlock(provider, apiKey.trim()); setRecord(next); setApiKey(""); setPassword(""); onChange();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Не удалось зашифровать ключ."); }
    setBusy(false);
  }
  async function unlock() {
    if (!record) return;
    setBusy(true);
    try { session.unlock(record.provider, await decryptApiKey(record, password)); setPassword(""); setMessage("Ключ разблокирован до закрытия вкладки."); onChange(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Не удалось расшифровать."); }
    setBusy(false);
  }
  function lock() { session.lock(); setMessage("Ключ заблокирован."); onChange(); }
  function forget() { session.lock(); clearVaultRecord(); setRecord(null); setMessage("Зашифрованная запись удалена из этого браузера."); onChange(); }

  return <div className="ai-settings">
    <h3 className="sub">Нейросеть (необязательно)</h3>
    <p className="hint">Без ИИ игра полностью работает на командах. ИИ только переводит свободный текст в действие, а движок проверяет, возможно ли оно. Ключ хранится в этом браузере зашифрованным вашим паролем и отправляется только на ваш прокси.</p>
    <label className="inline-check"><input type="checkbox" checked={enabled} onChange={e => onEnabled(e.target.checked)} /> Понимать свободный текст через ИИ</label>
    <div className="form-grid">
      <label>Нейросеть<select value={record?.provider ?? provider} disabled={Boolean(record)} onChange={e => { if (isAiProviderId(e.target.value)) onProvider(e.target.value); }}>{AI_PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
      <label>Модель (необязательно)<input value={model} onChange={e => onModel(e.target.value)} placeholder="по умолчанию сервера" /></label>
    </div>
    {record && <p className="hint">Сохранённый ключ привязан к провайдеру «{AI_PROVIDERS.find(p => p.id === record.provider)?.label ?? record.provider}». Чтобы сменить провайдера, удалите ключ и сохраните новый.</p>}
    <p className="hint">Модель учитывается только со своим ключом: с ключом сервера модель выбирает сервер.</p>
    <label>Адрес прокси<input value={endpoint} onChange={e => onEndpoint(e.target.value)} placeholder="http://localhost:8787" /></label>
    <p className="hint">Статус ключа: {session.isUnlocked ? "разблокирован" : record ? "сохранён, заблокирован" : "своего ключа нет (будет использован ключ сервера, если он настроен)"}.</p>
    {!record && <div className="form-grid">
      <label>API-ключ<input type="password" autoComplete="off" value={apiKey} onChange={e => setApiKey(e.target.value)} /></label>
      <label>Пароль для ключа<input type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></label>
    </div>}
    {record && !session.isUnlocked && <label>Пароль<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></label>}
    <div className="save-row">
      {!record && <button disabled={busy || !apiKey || !password} onClick={save}>ЗАШИФРОВАТЬ И СОХРАНИТЬ</button>}
      {record && !session.isUnlocked && <button disabled={busy || !password} onClick={unlock}>РАЗБЛОКИРОВАТЬ</button>}
      {session.isUnlocked && <button onClick={lock}>ЗАБЛОКИРОВАТЬ</button>}
      {record && <button onClick={forget}>УДАЛИТЬ КЛЮЧ ИЗ БРАУЗЕРА</button>}
    </div>
    {message && <p className="hint">{message}</p>}
  </div>;
}
