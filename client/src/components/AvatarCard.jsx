import { useEffect, useRef, useState } from 'react';
import { getErrorMessage } from '../api';
import { AVATAR_LIMITS, checkAvatarFile, chooseAvatarPreset, clearAvatar, uploadAvatarPhoto } from '../avatarApi';
import { useAuth } from '../auth/context';
import '../avatar.css';
import Avatar from '../ui/Avatar';
import { AVATAR_PRESETS, PresetImage } from '../ui/avatarPresets';
import Banner from '../ui/Banner';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import { useToast } from '../ui/toastContext';
import { fullPatientName } from '../utils/patient';

// Настройки → «Аватар»: слева 9 готовых картинок (3 в ряд), справа загрузка своего фото
export default function AvatarCard() {
  const { patient, updateMe } = useAuth();
  const toast = useToast();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(null); // 'preset-3' | 'upload' | 'clear'
  const [error, setError] = useState('');
  const [draft, setDraft] = useState(null); // { file, url } — выбранное, но ещё не отправленное фото
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);

  // освобождаем память от предпросмотра, когда он больше не нужен
  useEffect(() => () => { if (draft?.url) URL.revokeObjectURL(draft.url); }, [draft]);

  if (!patient) return null;
  const current = patient.avatar ?? { kind: null };

  async function run(kind, action, successText) {
    setBusy(kind);
    setError('');
    try {
      updateMe(await action());
      toast.success(successText);
      return true;
    } catch (err) {
      setError(getErrorMessage(err));
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function pick(file) {
    setError('');
    if (!file) return;
    const problem = await checkAvatarFile(file);
    if (problem) {
      setDraft(null);
      setError(problem);
      return;
    }
    setDraft({ file, url: URL.createObjectURL(file) });
  }

  async function sendDraft() {
    setProgress(0);
    const ok = await run('upload', () => uploadAvatarPhoto(draft.file, setProgress), 'Фото загружено');
    if (ok) setDraft(null);
  }

  function onDrop(event) {
    event.preventDefault();
    setDragging(false);
    if (!busy) pick(event.dataTransfer.files?.[0]);
  }

  const mb = AVATAR_LIMITS.maxBytes / 1024 / 1024;

  return (
    <section className="card section avatar-card">
      <header className="section-head">
        <div className="section-icon"><Icon name="user" size={20} /></div>
        <div>
          <h2>Аватар</h2>
          <p>Выберите предложенные или загрузите своё фото</p>
        </div>
      </header>

      {error && <Banner kind="error">{error}</Banner>}

      <div className="avatar-split">
        <ul className="avatar-grid" role="radiogroup" aria-label="Предложенные аватары">
          {AVATAR_PRESETS.map((preset) => {
            const selected = current.kind === 'preset' && current.preset === preset.id;
            return (
              <li key={preset.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`Аватар ${preset.id}`}
                  className={`avatar-option ${selected ? 'is-selected' : ''}`}
                  disabled={Boolean(busy)}
                  onClick={() => !selected && run(`preset-${preset.id}`, () => chooseAvatarPreset(preset.id), 'Аватар выбран')}
                >
                  <span className="avatar-pic" style={{ width: 72, height: 72 }}><PresetImage id={preset.id} /></span>
                  {selected && <Icon name="check" size={14} className="avatar-option-mark" />}
                </button>
              </li>
            );
          })}
        </ul>

        <div
          className={`dropzone ${dragging ? 'is-over' : ''}`}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          {draft ? (
            <div className="dropzone-row">
              <span className="avatar-pic" style={{ width: 72, height: 72 }}><img src={draft.url} alt="Предпросмотр фото" /></span>
              <div className="dropzone-text">
                <strong title={draft.file.name}>{draft.file.name}</strong>
                <span className="muted">{(draft.file.size / 1024).toFixed(0)} КБ, будет обрезано до квадрата</span>
                {busy === 'upload' && (
                  <div className="progress" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                    <span style={{ width: `${Math.round(progress * 100)}%` }} />
                  </div>
                )}
                <div className="dropzone-actions">
                  <Button size="sm" variant="primary" icon="check" loading={busy === 'upload'} onClick={sendDraft}>Использовать</Button>
                  <Button size="sm" disabled={busy === 'upload'} onClick={() => setDraft(null)}>Отмена</Button>
                </div>
              </div>
            </div>
          ) : current.kind === 'photo' ? (
            <div className="dropzone-row">
              <Avatar patient={patient} name={fullPatientName(patient)} size={72} />
              <div className="dropzone-text">
                <strong>Ваше фото</strong>
                <span className="muted">Видно врачу в личном деле</span>
                <div className="dropzone-actions">
                  <Button size="sm" disabled={Boolean(busy)} onClick={() => inputRef.current?.click()}>Заменить</Button>
                  <Button size="sm" icon="x" loading={busy === 'clear'} disabled={Boolean(busy)} onClick={() => run('clear', clearAvatar, 'Фото удалено')}>Убрать</Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="dropzone-empty">
              <Icon name="download" size={20} className="dropzone-icon" />
              <span><strong>Перетащите фото сюда</strong> или</span>
              <Button size="sm" disabled={Boolean(busy)} onClick={() => inputRef.current?.click()}>Выбрать файл</Button>
            </div>
          )}

          <p className="dropzone-rules">
            {AVATAR_LIMITS.typeLabel}, до {mb} МБ, не меньше {AVATAR_LIMITS.minSide}×{AVATAR_LIMITS.minSide} пикселей.
            Лучше всего подходит фото лица на светлом фоне, формат 3×4.
          </p>

          <input
            ref={inputRef}
            type="file"
            accept={AVATAR_LIMITS.types.join(',')}
            hidden
            onChange={(event) => { pick(event.target.files?.[0]); event.target.value = ''; }}
          />
        </div>
      </div>
    </section>
  );
}
