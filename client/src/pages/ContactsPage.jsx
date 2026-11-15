import { Link } from 'react-router-dom';
import '../contacts.css';
import Icon from '../ui/Icon';

const STEPS = [
  { title: 'Выберите врача', text: 'На главной странице откройте нужную специальность и выберите врача.' },
  { title: 'Выберите день и время', text: 'Свободные талоны показаны на две недели вперёд. Один талон — 30 минут.' },
  { title: 'Подтвердите запись', text: 'Войдите в личный кабинет и нажмите «Записаться». Талон появится в разделе «Мои талоны».' },
];

const BRING = [
  'Паспорт или другой документ, удостоверяющий личность',
  'Страховой полис (если он у вас есть)',
  'Направление от другого врача, если оно было',
  'Результаты прошлых анализов и обследований',
];

const FAQ = [
  {
    q: 'Как записаться, если у меня ещё нет аккаунта?',
    a: 'Нажмите «Зарегистрироваться» на главной странице: подтвердите почту кодом из письма, заполните короткую анкету и придумайте пароль. Это займёт несколько минут.',
  },
  {
    q: 'Можно ли записаться по телефону?',
    a: 'Да. Позвоните в регистратуру в рабочее время, и сотрудник подберёт свободный талон. Запись по телефону и онлайн ведётся в одной системе, двойных талонов не бывает.',
  },
  {
    q: 'За сколько нужно прийти на приём?',
    a: 'Лучше за 10–15 минут до времени талона: нужно успеть найти кабинет и раздеться в гардеробе.',
  },
  {
    q: 'Что делать, если я опаздываю или не могу прийти?',
    a: 'Отмените или перенесите талон в разделе «Мои талоны». Так освободится время для другого пациента. Талон нельзя изменить, если приём уже начался.',
  },
  {
    q: 'Сколько талонов можно иметь одновременно?',
    a: 'Не больше четырёх активных талонов. Чтобы записаться ещё, отмените один из существующих или дождитесь приёма.',
  },
  {
    q: 'Где посмотреть заключение врача после приёма?',
    a: 'В личном кабинете, в разделе «История болезни»: там список ваших приёмов, документ с заключением и выданные направления. Их можно скачать и распечатать.',
  },
];

// Схема проезда: не настоящая карта, а упрощённый план района
function RouteMap() {
  return (
    <svg className="contacts-map" viewBox="0 0 520 300" role="img" aria-label="Схема проезда: поликлиника на улице Примерной, рядом остановка и станция метро">
      <rect width="520" height="300" className="map-ground" />
      <rect x="0" y="128" width="520" height="44" className="map-road" />
      <rect x="338" y="0" width="38" height="300" className="map-road" />
      <line x1="0" y1="150" x2="520" y2="150" className="map-dash" />
      <line x1="357" y1="0" x2="357" y2="300" className="map-dash" />
      <rect x="40" y="26" width="120" height="76" className="map-block" />
      <rect x="180" y="26" width="130" height="76" className="map-block" />
      <rect x="40" y="198" width="90" height="76" className="map-block" />
      <rect x="150" y="198" width="160" height="76" className="map-building" />
      <rect x="400" y="30" width="96" height="70" className="map-block" />
      <rect x="400" y="198" width="96" height="76" className="map-block" />
      <text x="230" y="240" className="map-label-strong" textAnchor="middle">Поликлиника</text>
      <text x="230" y="258" className="map-label" textAnchor="middle">ул. Примерная, 1</text>
      <text x="20" y="122" className="map-label">ул. Примерная</text>
      <text x="383" y="20" className="map-label">пр. Центральный</text>
      <g transform="translate(347 168)">
        <rect x="-26" y="0" width="52" height="22" className="map-stop" />
        <text x="0" y="15" textAnchor="middle" className="map-stop-text">Остановка</text>
      </g>
      <g transform="translate(446 150)">
        <circle r="13" className="map-metro" />
        <text y="5" textAnchor="middle" className="map-metro-text">М</text>
      </g>
      <text x="446" y="182" textAnchor="middle" className="map-label">метро «Примерная»</text>
      <path d="M446 137 L446 118 L357 118 L357 150 L240 150 L240 198" className="map-route" />
      <circle cx="240" cy="198" r="6" className="map-pin" />
    </svg>
  );
}

export default function ContactsPage() {
  return (
    <>
      <title>Контакты и FAQ — Твой талон</title>
      <div className="page-head">
        <div>
          <h1>Контакты и FAQ</h1>
          <p>Как с нами связаться, как к нам добраться и что взять с собой на приём</p>
        </div>
      </div>

      <div className="contacts-quick">
        <section className="card contacts-tile">
          <span className="contacts-icon"><Icon name="home" size={18} /></span>
          <h2>Адрес</h2>
          <p>г. Минск, ул. Примерная, 1</p>
          <p className="muted">2 этаж, окна регистратуры 1–3. Вход со двора, есть пандус.</p>
        </section>
        <section className="card contacts-tile">
          <span className="contacts-icon"><Icon name="phone" size={18} /></span>
          <h2>Телефоны</h2>
          <dl className="contacts-dl">
            <div><dt>Регистратура</dt><dd className="mono">+375 (17) 000-00-00</dd></div>
            <div><dt>Справочная</dt><dd className="mono">+375 (17) 000-00-01</dd></div>
          </dl>
        </section>
        <section className="card contacts-tile">
          <span className="contacts-icon"><Icon name="clock" size={18} /></span>
          <h2>График работы</h2>
          <dl className="contacts-dl">
            <div><dt>Пн–пт</dt><dd>09:00–17:00</dd></div>
            <div><dt>Перерыв</dt><dd>13:00–14:00</dd></div>
            <div><dt>Сб–вс</dt><dd>выходной</dd></div>
          </dl>
        </section>
        <section className="card contacts-tile">
          <span className="contacts-icon"><Icon name="mail" size={18} /></span>
          <h2>Почта</h2>
          <p>help@talon.example</p>
          <p className="muted">Отвечаем в рабочие дни в течение суток.</p>
        </section>
      </div>

      <div className="contacts-alert" role="note">
        <strong>Экстренная помощь: 103 или 112</strong>
        <span>Сервис «Твой талон» не заменяет экстренную помощь. При угрозе жизни не записывайтесь на приём, а сразу звоните.</span>
      </div>

      <div className="contacts-cols">
        <section className="card contacts-block">
          <h2>Как добраться</h2>
          <RouteMap />
          <ul className="contacts-list">
            <li><b>Метро.</b> От станции «Примерная» — 7 минут пешком по проспекту Центральному, затем направо на улицу Примерную.</li>
            <li><b>Автобус.</b> Маршруты 12 и 34 до остановки «Поликлиника», дальше 2 минуты пешком.</li>
            <li><b>На машине.</b> Парковка во дворе, 15 мест. Первые 30 минут бесплатно.</li>
          </ul>
          <p className="muted">Схема приблизительная и не заменяет карту.</p>
        </section>

        <div className="contacts-side">
          <section className="card contacts-block">
            <h2>Как записаться</h2>
            <ol className="contacts-steps">
              {STEPS.map((step) => (
                <li key={step.title}>
                  <strong>{step.title}</strong>
                  <span>{step.text}</span>
                </li>
              ))}
            </ol>
            <Link to="/" className="btn btn-primary contacts-cta">Записаться на приём</Link>
          </section>

          <section className="card contacts-block">
            <h2>Как отменить или перенести талон</h2>
            <p>Откройте <Link to="/cabinet/tickets">«Мои талоны»</Link> в личном кабинете и выберите талон: кнопка «Изменить» переносит приём на другое время, «Отменить» освобождает талон.</p>
            <p className="muted">Изменить или отменить талон можно, пока приём не начался.</p>
          </section>

          <section className="card contacts-block">
            <h2>Что взять с собой</h2>
            <ul className="contacts-checks">
              {BRING.map((item) => (
                <li key={item}><Icon name="check" size={16} />{item}</li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <section className="card contacts-block contacts-faq">
        <h2>Вопросы и ответы</h2>
        {FAQ.map((item) => (
          <details key={item.q}>
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
      </section>
    </>
  );
}
