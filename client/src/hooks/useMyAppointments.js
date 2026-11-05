import { useCallback, useEffect, useState } from 'react';
import { cancelMyAppointment, clearMyArchive, deleteMyAppointment, fetchMyAppointments, getErrorMessage, isCanceled, updateMyAppointment } from '../api';
import { useToast } from '../ui/toastContext';

// Талоны пациента: загрузка, отмена и редактирование с оптимистичным обновлением (при ошибке всё возвращается).
// enabled=false — ничего не загружать (например, пока пользователь не вошёл или он не пациент).
export default function useMyAppointments({ enabled = true } = {}) {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    fetchMyAppointments(controller.signal)
      .then((data) => { setItems(data); setStatus('ready'); })
      .catch((err) => {
        if (isCanceled(err)) return;
        setError(getErrorMessage(err));
        setStatus('error');
      });
    return () => controller.abort();
  }, [reloadKey, enabled]);

  const reload = useCallback(() => {
    setStatus('loading');
    setError('');
    setReloadKey((key) => key + 1);
  }, []);

  const cancel = useCallback(async (item) => {
    setItems((list) => list.map((i) => (i.id === item.id ? { ...i, status: 'cancelled', pending: true } : i)));
    try {
      const saved = await cancelMyAppointment(item.id);
      setItems((list) => list.map((i) => (i.id === item.id ? saved : i)));
      toast.success('Запись отменена');
    } catch (err) {
      setItems((list) => list.map((i) => (i.id === item.id ? item : i)));
      toast.error(getErrorMessage(err), { title: 'Запись не отменена' });
    }
  }, [toast]);

  // Удаление из списка: талон исчезает сразу, при ошибке возвращается на место
  const remove = useCallback(async (item) => {
    setItems((list) => list.filter((i) => i.id !== item.id));
    try {
      await deleteMyAppointment(item.id);
      toast.success('Талон удалён');
    } catch (err) {
      setItems((list) => [...list, item]);
      toast.error(getErrorMessage(err), { title: 'Талон не удалён' });
    }
  }, [toast]);

  // Очистить архив: переданные талоны убираются из списка, при ошибке возвращаются
  const clearArchive = useCallback(async (archived) => {
    const ids = new Set(archived.map((i) => i.id));
    setItems((list) => list.filter((i) => !ids.has(i.id)));
    try {
      await clearMyArchive();
      toast.success('Архив очищен');
    } catch (err) {
      setItems((list) => [...list, ...archived]);
      toast.error(getErrorMessage(err), { title: 'Архив не очищен' });
    }
  }, [toast]);

  // changes: { date?, time?, reason? }
  const edit = useCallback(async (item, changes) => {
    setItems((list) => list.map((i) => (i.id === item.id ? { ...i, ...changes, pending: true } : i)));
    try {
      const saved = await updateMyAppointment(item.id, changes);
      setItems((list) => list.map((i) => (i.id === item.id ? saved : i)));
      toast.success('Запись изменена');
    } catch (err) {
      setItems((list) => list.map((i) => (i.id === item.id ? item : i)));
      toast.error(getErrorMessage(err), { title: 'Запись не изменена' });
    }
  }, [toast]);

  return { items, status, error, reload, cancel, edit, remove, clearArchive };
}
