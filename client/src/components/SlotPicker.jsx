import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { fetchSlotDays, fetchSlots, getErrorMessage, isCanceled } from '../api';
import { useSlotsWatch } from '../realtime/hooks';
import { parseISO } from '../utils/dates';
import Icon from '../ui/Icon';
import Spinner from '../ui/Spinner';
import { useToast } from '../ui/toastContext';
import { HoldAnnouncer, HoldBar, HoldChip } from './SlotHoldTimer';

const weekday = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' });
const month = new Intl.DateTimeFormat('ru-RU', { month: 'short' });

const plural = (n) => {
  const rest = n % 100;
  if (rest > 10 && rest < 20) return 'талонов';
  return { 1: 'талон', 2: 'талона', 3: 'талона', 4: 'талона' }[n % 10] ?? 'талонов';
};

// Выбор даты и времени у конкретного врача. Значение хранит родитель: value = { date, time }, onChange получает изменения.
// numbered — оформление шагами «2 Выберите дату» и «3 Выберите время» (форма записи); excludeId — запись, которую переносят.
// hold — состояние брони выбранного времени (результат useSlotHold у владельца выбора): отсчёт на выбранном талоне.
// Талон, который сейчас выбирает другой пациент, отключён и помечен замком.
export default function SlotPicker({ doctorId, value, onChange, refreshKey = 0, excludeId, numbered = false, hold }) {
  const toast = useToast();
  // liveKey растёт, когда сервер сообщил, что у врача изменились талоны: данные перезапрашиваются без спиннера
  const [liveKey, setLiveKey] = useState(0);
  const liveRef = useRef(false);
  const heldKeys = useSlotsWatch(doctorId, () => { liveRef.current = true; setLiveKey((key) => key + 1); });
  const holdState = hold?.status;
  const myHoldActive = holdState === 'pending' || holdState === 'holding'; // выбранный талон держит эта вкладка
  // бронью выбора управляет useSlotHold (отказ сам сбросит время); без неё (гость, регистратура) сбрасываем выбор здесь
  const holdManagesSelection = ['pending', 'holding', 'denied', 'ended'].includes(holdState);
  const selectedIsHeld = Boolean(value.date && value.time) && heldKeys.has(`${value.date}|${value.time}`) && !myHoldActive && !holdManagesSelection;

  // key — для какого врача/даты получены данные: пока он не совпал с текущим выбором, показываем «загрузка»
  const [days, setDays] = useState({ key: null, list: [], error: '' });
  const [slots, setSlots] = useState({ key: null, list: [], error: '' });
  const daysKey = doctorId ? `${doctorId}:${excludeId ?? ''}` : null;
  const slotsKey = doctorId && value.date ? `${doctorId}:${value.date}:${excludeId ?? ''}` : null;

  // Событие эффекта: берёт самые свежие value и onChange, не перезапуская загрузку при их изменении
  const syncDays = useEffectEvent((list) => {
    const current = value.date;
    if (!(current && list.some((day) => day.date === current && day.free > 0))) {
      onChange({ date: list.find((day) => day.free > 0)?.date ?? null, time: null });
    }
  });
  const syncSlots = useEffectEvent((list) => {
    if (value.time && !list.some((slot) => slot.time === value.time && slot.free)) {
      onChange({ time: null }); // время мог занять другой
      // сняли выбор не по действию пациента, а потому что талон занял другой: говорим об этом, а не меняем молча
      if (liveRef.current) toast.info('Этот талон только что заняли. Выберите другое время.', { title: 'Время недоступно', duration: 6000 });
    }
    liveRef.current = false;
  });

  // выбранный заранее талон (до входа или в другой вкладке) забронировал другой пациент: снимаем выбор и объясняем
  const dropHeldSelection = useEffectEvent(() => {
    onChange({ time: null });
    toast.info('Этот талон сейчас выбирает другой пациент. Выберите другое время.', { title: 'Время недоступно', duration: 6000 });
  });
  useEffect(() => { if (selectedIsHeld) dropHeldSelection(); }, [selectedIsHeld]);

  // дни врача; если выбранной даты нет или в ней нет мест — берём первую подходящую
  useEffect(() => {
    if (!daysKey) return undefined;
    const controller = new AbortController();
    fetchSlotDays(doctorId, controller.signal, excludeId)
      .then((list) => { setDays({ key: daysKey, list, error: '' }); syncDays(list); })
      .catch((error) => { if (!isCanceled(error)) setDays({ key: daysKey, list: [], error: getErrorMessage(error) }); });
    return () => controller.abort();
  }, [doctorId, excludeId, daysKey, refreshKey, liveKey]);

  // талоны на выбранный день
  useEffect(() => {
    if (!slotsKey) return undefined;
    const controller = new AbortController();
    fetchSlots(doctorId, value.date, controller.signal, excludeId)
      .then((list) => { setSlots({ key: slotsKey, list, error: '' }); syncSlots(list); })
      .catch((error) => { if (!isCanceled(error)) setSlots({ key: slotsKey, list: [], error: getErrorMessage(error) }); });
    return () => controller.abort();
  }, [doctorId, value.date, excludeId, slotsKey, refreshKey, liveKey]);

  const daysReady = days.key === daysKey;
  const slotsReady = slots.key === slotsKey;
  const daysLoading = Boolean(daysKey) && !daysReady;
  const slotsLoading = Boolean(slotsKey) && !slotsReady;

  const dateTitle = numbered ? (
    <header><span className="rstep-num">2</span><h2>Выберите дату</h2></header>
  ) : <h3 className="picker-title">Дата</h3>;
  const holdChip = holdState === 'holding' ? <HoldChip hold={hold} /> : null;
  const timeTitle = numbered ? (
    <header><span className="rstep-num">3</span><h2>Выберите время</h2>{holdChip}</header>
  ) : <div className="picker-title-row"><h3 className="picker-title">Время</h3>{holdChip}</div>;
  const Block = numbered ? 'div' : 'section';

  return (
    <>
      <Block className={numbered ? `bstep ${doctorId ? '' : 'is-locked'}` : 'picker-block'}>
        {dateTitle}
        {!doctorId && <p className="bstep-hint">Сначала выберите врача</p>}
        {daysLoading && <div className="state-loading"><Spinner size={18} />Загружаем расписание…</div>}
        {daysReady && days.error && <p className="inline-error">{days.error}</p>}
        {daysReady && days.list.length > 0 && (
          <div className="days" role="group" aria-label="Дата приёма">
            {days.list.map((day) => {
              const date = parseISO(day.date);
              return (
                <button
                  key={day.date}
                  type="button"
                  className={`day-btn ${day.date === value.date ? 'is-selected' : ''}`}
                  disabled={day.free === 0}
                  onClick={() => onChange({ date: day.date, time: null })}
                  aria-pressed={day.date === value.date}
                >
                  <span className="day-wd">{weekday.format(date)}</span>
                  <strong>{date.getDate()}</strong>
                  <span className="day-mo">{month.format(date).replace('.', '')}</span>
                  <span className="day-free">{day.free > 0 ? `${day.free} ${plural(day.free)}` : 'нет мест'}</span>
                </button>
              );
            })}
          </div>
        )}
      </Block>

      <Block className={numbered ? `bstep ${value.date ? '' : 'is-locked'}` : 'picker-block'}>
        {timeTitle}
        {!value.date && <p className="bstep-hint">Сначала выберите дату</p>}
        {hold && <HoldAnnouncer hold={hold} />}
        {slotsLoading && <div className="state-loading"><Spinner size={18} />Загружаем талоны…</div>}
        {slotsReady && slots.error && <p className="inline-error">{slots.error}</p>}
        {slotsReady && slots.list.length > 0 && (
          <div className="slots" role="group" aria-label="Время приёма">
            {slots.list.map((slot) => {
              const selected = slot.time === value.time;
              // свободный по записям талон, который сейчас выбирает другой пациент (свою бронь в этой вкладке не считаем)
              const heldByOther = slot.free && heldKeys.has(`${value.date}|${slot.time}`) && !(selected && myHoldActive);
              return (
                <button
                  key={slot.time}
                  type="button"
                  className={`slot ${selected ? 'is-selected' : ''} ${heldByOther ? 'is-held' : ''}`}
                  disabled={!slot.free || heldByOther}
                  onClick={() => onChange({ time: slot.time })}
                  aria-pressed={selected}
                  aria-label={heldByOther ? `${slot.time}, сейчас бронирует другой пациент` : undefined}
                  title={heldByOther ? 'Сейчас бронирует другой пациент' : slot.free ? 'Свободно' : 'Занято'}
                >
                  {heldByOther && <Icon name="lock" size={12} />}
                  {slot.time}
                  {selected && holdState === 'holding' && <HoldBar hold={hold} />}
                </button>
              );
            })}
          </div>
        )}
      </Block>
    </>
  );
}
