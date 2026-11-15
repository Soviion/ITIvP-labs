import { useCallback, useEffect, useState } from 'react';
import { fetchDoctors, getErrorMessage, isCanceled } from '../api';

// Справочник врачей (открытый, без входа): нужен и для записи, и для доски почёта
export default function useDoctors() {
  const [state, setState] = useState({ status: 'loading', list: [], error: '' });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchDoctors(controller.signal)
      .then((list) => setState({ status: 'ready', list: list.filter((doctor) => doctor.isActive), error: '' }))
      .catch((error) => { if (!isCanceled(error)) setState({ status: 'error', list: [], error: getErrorMessage(error) }); });
    return () => controller.abort();
  }, [reloadKey]);

  const reload = useCallback(() => {
    setState({ status: 'loading', list: [], error: '' });
    setReloadKey((key) => key + 1);
  }, []);

  return { ...state, reload };
}
