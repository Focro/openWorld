/** Сайт = макет Жозы (index.html). Здесь только настоящий вход через Google поверх кнопки макета. */
import { getCloud, signInWithGoogle } from "./cloud/account";

const cloud = getCloud();
const ow = () => (window as unknown as { OW?: { login?: () => void } }).OW;
if (cloud) {
  document.getElementById("gBtn")?.addEventListener("click", e => {
    e.stopImmediatePropagation();
    void signInWithGoogle(cloud).catch(() => undefined);
  }, true);
  void cloud.auth.getSession().then(({ data }) => { if (data.session) ow()?.login?.(); });
}
