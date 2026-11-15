import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addAppointment,
  deleteAppointment,
  fetchAppointments,
  getErrorMessage,
  isCanceled,
  patchAppointment,
  updateAppointment,
} from '../api';
import { useLiveRefresh } from '../realtime/hooks';
import { useToast } from '../ui/toastContext';

export default function useAppointments() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    const controller = new AbortController();

    fetchAppointments(controller.signal)
      .then((data) => {
        setItems(data);
        setStatus('ready');
      })
      .catch((err) => {
        if (isCanceled(err)) return;
        setError(getErrorMessage(err));
        setStatus('error');
      });

    return () => controller.abort();
  }, [reloadKey]);

  const settle = useCallback((id) => {
    setTimeout(() => setItems((list) => list.map((item) => (item.id === id ? { ...item, fresh: false } : item))), 2600);
  }, []);

  const reload = useCallback(() => {
    setStatus('loading');
    setError('');
    setReloadKey((key) => key + 1);
  }, []);

  // Новая запись, отмена или перенос от пациента появляются в списке регистратуры сами (сервер присылает сигнал «обнови»).
  // Без спиннера; при ошибке фонового запроса прежний список остаётся. Номер запроса отсекает «старый» ответ
  const refreshSeq = useRef(0);
  useLiveRefresh('appointments:changed', () => {
    refreshSeq.current += 1;
    const seq = refreshSeq.current;
    fetchAppointments()
      .then((data) => { if (seq === refreshSeq.current) { setItems(data); setStatus('ready'); setError(''); } })
      .catch(() => { /* прежний список остаётся */ });
  });

  const add = useCallback(async (draft, related) => {
    const tempId = Date.now();
    const optimistic = { ...draft, id: tempId, uid: tempId, ...related, pending: true, fresh: true };
    setItems((list) => [...list, optimistic]);

    try {
      const saved = await addAppointment(draft);
      setItems((list) => list.map((item) => (item.id === tempId ? { ...saved, uid: tempId, fresh: true } : item)));
      settle(saved.id);
      return { ok: true, item: saved };
    } catch (err) {
      setItems((list) => list.filter((item) => item.id !== tempId));
      toast.error(getErrorMessage(err), { title: 'Запись не создана' });
      return { ok: false, error: err };
    }
  }, [toast, settle]);

  const update = useCallback(async (id, draft, related) => {
    const previous = itemsRef.current.find((item) => item.id === id);
    setItems((list) => list.map((item) => (item.id === id ? { ...item, ...draft, id, ...related, pending: true, fresh: true } : item)));

    try {
      const saved = await updateAppointment(id, draft);
      setItems((list) => list.map((item) => (item.id === id ? { ...saved, uid: item.uid, fresh: true } : item)));
      settle(id);
      return { ok: true, item: saved };
    } catch (err) {
      setItems((list) => list.map((item) => (item.id === id ? previous : item)));
      toast.error(getErrorMessage(err), { title: 'Изменения не сохранены' });
      return { ok: false, error: err };
    }
  }, [toast, settle]);

  const changeStatus = useCallback(async (id, nextStatus) => {
    const previous = itemsRef.current.find((item) => item.id === id);
    if (!previous || previous.status === nextStatus) return { ok: true };
    setItems((list) => list.map((item) => (item.id === id ? { ...item, status: nextStatus, pending: true } : item)));

    try {
      const saved = await patchAppointment(id, { status: nextStatus });
      setItems((list) => list.map((item) => (item.id === id ? saved : item)));
      return { ok: true };
    } catch (err) {
      setItems((list) => list.map((item) => (item.id === id ? previous : item)));
      toast.error(getErrorMessage(err), { title: 'Статус не изменён' });
      return { ok: false, error: err };
    }
  }, [toast]);

  const remove = useCallback(async (id) => {
    const removed = itemsRef.current.find((item) => item.id === id);
    if (!removed) return { ok: true };
    setItems((list) => list.filter((item) => item.id !== id));

    try {
      await deleteAppointment(id);
      return { ok: true };
    } catch (err) {
      setItems((list) => (list.some((item) => item.id === id) ? list : [...list, removed]));
      toast.error(getErrorMessage(err), { title: 'Запись не удалена, она возвращена в список' });
      return { ok: false, error: err };
    }
  }, [toast]);

  return { items, status, error, reload, add, update, changeStatus, remove };
}
