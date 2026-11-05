import { useState, useSyncExternalStore } from 'react';
import { connection } from '../connection';
import { NO_CONNECTION_TEXT } from '../errors';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import Modal from '../ui/Modal';

// Окно «Нет связи с сервером»: затемняет весь сайт и не даёт с ним работать, пока связь не вернётся.
// Связь проверяется автоматически каждые 5 секунд (connection.js), окно закрывается само. Кнопка «Повторить» проверяет сразу.
export default function ConnectionLostDialog() {
  const lost = useSyncExternalStore(connection.subscribe, connection.getSnapshot);
  // ключ сбрасывает состояние окна («по-прежнему не отвечает») при каждом открытии и закрытии
  return <ConnectionLostContent key={lost ? 'open' : 'closed'} lost={lost} />;
}

function ConnectionLostContent({ lost }) {
  const [checking, setChecking] = useState(false);
  const [stillDown, setStillDown] = useState(false);

  async function retry() {
    setChecking(true);
    setStillDown(false);
    const ok = await connection.check();
    setChecking(false);
    if (!ok) setStillDown(true);
  }

  return (
    <Modal
      open={lost}
      onClose={connection.dismiss}
      size="sm"
      title="Нет связи с сервером"
      footer={(
        <>
          <Button onClick={connection.dismiss}>Закрыть</Button>
          <Button variant="primary" icon="refresh" loading={checking} onClick={retry}>Повторить</Button>
        </>
      )}
    >
      <div className="conn-lost" role="alert">
        <span className="conn-lost-icon"><Icon name="wifiOff" size={28} /></span>
        <div>
          <p>{NO_CONNECTION_TEXT}</p>
          <p className="conn-lost-note">{stillDown ? 'Сервер по-прежнему не отвечает.' : 'Связь проверяется автоматически, окно закроется само.'}</p>
        </div>
      </div>
    </Modal>
  );
}
