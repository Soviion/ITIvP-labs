// Черновик записи: врач, дата и время, выбранные на главной. Хранится на время сеанса (sessionStorage), поэтому
// остаётся при переходе в профиль врача, на регистрацию и обратно. fromGuest — талон выбран до входа.
const KEY = 'clinic.pendingSlot';

const write = (slot) => {
  try { sessionStorage.setItem(KEY, JSON.stringify(slot)); } catch { /* без sessionStorage просто выберет заново */ }
};

export function readPendingSlot() {
  try {
    const slot = JSON.parse(sessionStorage.getItem(KEY));
    return slot && slot.doctorId ? slot : null;
  } catch {
    return null;
  }
}

// Вызывается при каждом изменении выбора; флаг fromGuest сохраняется
export function updatePendingSlot(selection) {
  if (!selection.doctorId) return;
  write({ ...selection, fromGuest: readPendingSlot()?.fromGuest ?? false });
}

// Гость нажал «Записаться»: запоминаем выбор и то, что он сделан до регистрации
export function savePendingSlot(selection) {
  write({ ...selection, fromGuest: true });
}

export function clearPendingSlot() {
  try { sessionStorage.removeItem(KEY); } catch { /* ничего не делаем */ }
}
