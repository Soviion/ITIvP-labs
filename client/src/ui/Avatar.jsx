import { useEffect, useState } from 'react';
import { fetchMyAvatarBlob } from '../avatarApi';
import '../avatar.css';
import { PresetImage, Silhouette } from './avatarPresets';

// Кэш адресов blob: чтобы одно и то же фото не скачивалось заново в шапке, карточке и настройках.
// Ключ содержит версию фото, поэтому после загрузки нового оно подхватывается само.
const photoCache = new Map();
const pending = new Map();

function loadPhotoUrl(cacheKey, fetcher) {
  if (photoCache.has(cacheKey)) return Promise.resolve(photoCache.get(cacheKey));
  if (!pending.has(cacheKey)) {
    pending.set(cacheKey, fetcher()
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        photoCache.set(cacheKey, url);
        return url;
      })
      .finally(() => pending.delete(cacheKey)));
  }
  return pending.get(cacheKey);
}

/**
 * Адрес загруженного фото (blob:) или null.
 * fetcher — функция, возвращающая Promise<Blob>; cacheKey — уникальный ключ (например `p12:1699999`).
 * Пока enabled=false, ничего не грузится.
 */
export function useAvatarPhotoUrl({ enabled, cacheKey, fetcher }) {
  const [state, setState] = useState({ key: null, url: null, failed: false });

  useEffect(() => {
    if (!enabled || !cacheKey) return undefined;
    let active = true;
    loadPhotoUrl(cacheKey, fetcher)
      .then((url) => { if (active) setState({ key: cacheKey, url, failed: false }); })
      .catch(() => { if (active) setState({ key: cacheKey, url: null, failed: true }); });
    return () => { active = false; };
    // fetcher нарочно не в зависимостях: ключ кэша однозначно определяет, что именно грузим
  }, [enabled, cacheKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const ready = enabled && state.key === cacheKey;
  return { url: ready ? state.url : null, loading: enabled && !ready, failed: ready && state.failed };
}

/**
 * Круглый аватар.
 *  patient / avatar  — либо объект пациента (из него берётся patient.avatar), либо сразу { kind, preset, version }
 *  name              — для подписи (aria-label); без выбранного аватара показывается нейтральный силуэт
 *  size              — диаметр в пикселях
 *  photoKey          — префикс ключа кэша для чужих фото (например `patient-12`); без него кэшируются только «мои»
 *  fetchPhoto        — функция (signal?) => Promise<Blob> для чужих фото (кабинет врача); по умолчанию GET /me/avatar
 */
export default function Avatar({ patient, avatar, name, size = 36, photoKey, fetchPhoto, className = '' }) {
  const data = avatar ?? patient?.avatar ?? null;
  const isPhoto = data?.kind === 'photo';
  const { url, failed } = useAvatarPhotoUrl({
    enabled: isPhoto,
    cacheKey: isPhoto ? `${photoKey ?? 'me'}:${data.version ?? 0}` : null,
    fetcher: fetchPhoto ?? fetchMyAvatarBlob,
  });

  let content;
  if (data?.kind === 'preset' && data.preset) content = <PresetImage id={data.preset} />;
  else if (isPhoto && url && !failed) content = <img src={url} alt="" draggable={false} />;
  else content = <Silhouette />;

  return (
    <span className={`avatar-pic ${className}`.trim()} style={{ width: size, height: size }} role="img" aria-label={name ? `Аватар: ${name}` : 'Аватар'}>
      {content}
    </span>
  );
}
