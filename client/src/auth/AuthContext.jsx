import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchMe, getErrorMessage, getStatus, isCanceled, onUnauthorized, tokenStorage } from '../api';
import { decodeJwt } from '../utils/jwt';
import { displayNameOf } from '../utils/patient';
import { AuthContext } from './context';

const GUEST = { status: 'guest', user: null, patient: null, record: null, expiresAt: null, notice: '', profile: 'idle', profileError: '' };

// Старт приложения: если в localStorage лежит неистёкший токен, сразу считаем пользователя вошедшим
// (e-mail берём из самого токена), а карточку пациента догружаем с сервера в фоне. Так при недоступном сервере
// пользователь видит рабочий экран с понятной ошибкой, а не пустую заставку.
function initialState(portal) {
  const token = tokenStorage.get(portal);
  if (!token) return GUEST;

  const payload = decodeJwt(token);
  if (!payload?.email || !payload.exp || payload.exp * 1000 <= Date.now()) {
    tokenStorage.clear(portal);
    return { ...GUEST, notice: payload ? 'Сессия истекла. Войдите снова.' : '' };
  }
  return {
    ...GUEST,
    status: 'authed',
    user: { id: payload.id, email: payload.email, role: null, twoFactorEnabled: false },
    expiresAt: payload.exp * 1000,
    profile: 'loading', // loading | ready | error — подтянуты ли данные пользователя с сервера
  };
}

const expiryOf = (token) => {
  const exp = decodeJwt(token)?.exp;
  return exp ? exp * 1000 : null;
};

// portal: 'site' («Твой талон») или 'doctor' («Моя клиника»): у каждого входа своя сессия и свой токен
export function AuthProvider({ portal = 'site', children }) {
  const [state, setState] = useState(() => initialState(portal));

  // Фоновая загрузка пользователя, карточки пациента и медицинской карты одним запросом GET /me
  useEffect(() => {
    if (state.status !== 'authed' || state.profile !== 'loading') return undefined;

    const controller = new AbortController();
    fetchMe(controller.signal)
      .then((me) => setState((prev) => ({ ...prev, ...me, profile: 'ready', profileError: '' })))
      .catch((error) => {
        if (isCanceled(error) || getStatus(error) === 401) return; // 401 обработает onUnauthorized
        setState((prev) => ({ ...prev, profile: 'error', profileError: getErrorMessage(error) }));
      });
    return () => controller.abort();
  }, [state.status, state.profile]);

  const signOut = useCallback((notice = '') => {
    tokenStorage.clear(portal);
    setState({ ...GUEST, notice });
  }, [portal]);

  // Сервер ответил 401 на запрос с токеном: срок истёк или токен отозван
  useEffect(() => onUnauthorized((failed) => { if (failed === portal) signOut('Сессия истекла. Войдите снова.'); }), [signOut, portal]);

  const signIn = useCallback(({ token, user }) => {
    tokenStorage.set(token, portal);
    setState({ ...GUEST, status: 'authed', user, expiresAt: expiryOf(token), profile: 'loading' });
  }, [portal]);

  // После смены пароля или почты сервер отзывает старые токены и выдаёт новый — подменяем его, чтобы не вылететь из аккаунта
  const replaceToken = useCallback((token) => {
    tokenStorage.set(token, portal);
    setState((prev) => ({ ...prev, expiresAt: expiryOf(token) }));
  }, [portal]);

  const updateUser = useCallback((user) => setState((prev) => ({ ...prev, user })), []);

  // Обновляет данные пациента и карты без перезагрузки страницы: шапка и все экраны сразу видят новые значения
  const updateMe = useCallback((me) => setState((prev) => ({ ...prev, ...me })), []);

  const retryProfile = useCallback(() => setState((prev) => ({ ...prev, profile: 'loading', profileError: '' })), []);

  const value = useMemo(() => ({
    ...state,
    // администратор (admin) может всё, что регистратура, и заходит в кабинет врача; isDoctor — только для самого врача
    isStaff: state.user?.role === 'staff' || state.user?.role === 'admin',
    isAdmin: state.user?.role === 'admin',
    isDoctor: state.user?.role === 'doctor',
    displayName: state.user ? displayNameOf(state.patient, state.user.email) : '',
    signIn, signOut, replaceToken, updateUser, updateMe, retryProfile,
  }), [state, signIn, signOut, replaceToken, updateUser, updateMe, retryProfile]);

  return <AuthContext value={value}>{children}</AuthContext>;
}
