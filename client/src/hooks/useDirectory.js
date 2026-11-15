import { useCallback, useEffect, useState } from 'react';
import { createPatient, fetchDoctors, fetchPatients, getErrorMessage, isCanceled } from '../api';

// Справочники для формы записи: пациенты и врачи с сервера
export default function useDirectory() {
  const [data, setData] = useState({ patients: [], doctors: [] });
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([fetchPatients(controller.signal), fetchDoctors(controller.signal)])
      .then(([patients, doctors]) => {
        setData({ patients, doctors });
        setStatus('ready');
      })
      .catch((err) => {
        if (isCanceled(err)) return;
        setError(getErrorMessage(err));
        setStatus('error');
      });

    return () => controller.abort();
  }, [reloadKey]);

  const reload = useCallback(() => {
    setStatus('loading');
    setReloadKey((key) => key + 1);
  }, []);

  const addPatient = useCallback(async (draft) => {
    const patient = await createPatient(draft);
    setData((prev) => ({ ...prev, patients: [...prev.patients, patient] }));
    return patient;
  }, []);

  return { ...data, status, error, reload, addPatient };
}
