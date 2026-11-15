import { useEffect, useRef, useState } from 'react';
import { getErrorMessage, getStatus, isCanceled } from '../../api';
import { requestTreatmentHint } from '../../doctorApi';
import Button from '../../ui/Button';
import Icon from '../../ui/Icon';

// Обезличенные данные, которые ушли в модель, в обычный текст. Сервер присылает группы с русскими названиями:
// «пациент», «приём» – набор «название: значение», «анализы» и «история болезни» – списки записей.
const isEmpty = (value) => value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length);

function line(value) {
  if (Array.isArray(value)) return value.map(line).filter(Boolean).join('; ');
  if (value && typeof value === 'object') {
    return Object.entries(value).filter(([, item]) => !isEmpty(item)).map(([name, item]) => `${name}: ${line(item)}`).join(', ');
  }
  return String(value ?? '');
}

// список строк для группы данных: для набора – по строке на поле, для списка – по строке на запись
function groupLines(value) {
  if (Array.isArray(value)) return value.map(line).filter(Boolean);
  if (value && typeof value === 'object') return Object.entries(value).filter(([, item]) => !isEmpty(item)).map(([name, item]) => `${name}: ${line(item)}`);
  return [line(value)];
}

const ERROR_TEXT = {
  400: 'Укажите диагноз, чтобы получить подсказку.',
  403: 'Подсказка для этого пациента недоступна.',
  429: 'Слишком много запросов, подождите.',
  503: 'Помощник сейчас недоступен.',
};

const hasText = (list) => Array.isArray(list) && list.length > 0;

// Блок «Подсказка по лечению» в форме приёма. Диагноз ставит врач, помощник предлагает варианты лечения.
// form: { complaints, examination, diagnosis, icdCode, vitals } – текущие значения формы приёма.
// Сервер сам добавляет к ним данные из карты и историю болезни пациента.
export default function HintPanel({ patientId, form, onInsertTreatment, onInsertRecommendations }) {
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const [data, setData] = useState(null);
  const [usedDiagnosis, setUsedDiagnosis] = useState('');
  const [problem, setProblem] = useState('');
  const [inserted, setInserted] = useState({ treatment: false, recommendations: false });
  const sequence = useRef(0);
  const controller = useRef(null);

  // при закрытии формы запрос к модели отменяется
  useEffect(() => () => controller.current?.abort(), []);

  const diagnosis = form.diagnosis.trim();
  const outdated = status === 'ready' && usedDiagnosis !== diagnosis;

  async function ask() {
    if (!diagnosis) return;
    controller.current?.abort();
    controller.current = new AbortController();
    const mine = ++sequence.current;
    setStatus('loading');
    setProblem('');
    try {
      const result = await requestTreatmentHint({
        patientId: Number(patientId),
        complaints: form.complaints.trim() || undefined,
        diagnosis,
        icdCode: form.icdCode.trim() || undefined,
        vitals: form.vitals,
        notes: form.examination.trim() || undefined,
      }, controller.current.signal);
      if (mine !== sequence.current) return;
      setData(result);
      setUsedDiagnosis(diagnosis);
      setInserted({ treatment: false, recommendations: false });
      setStatus('ready');
    } catch (error) {
      if (isCanceled(error) || mine !== sequence.current) return;
      const text = ERROR_TEXT[getStatus(error)] ?? getErrorMessage(error);
      if (!text) { setStatus(data ? 'ready' : 'idle'); return; } // нет связи: об этом сообщает окно «Нет связи»
      setProblem(text);
      setStatus('error');
    }
  }

  const hint = data?.hint;
  const sent = data?.sent ? Object.entries(data.sent) : [];

  return (
    <section className="dr-ai" aria-label="Возможный вариант лечения">
      <header className="dr-ai-head">
        <h3><Icon name="stethoscope" size={16} />Возможный вариант лечения</h3>
        <Button size="sm" icon={status === 'ready' ? 'refresh' : 'stethoscope'} loading={status === 'loading'} disabled={!diagnosis} onClick={ask}>
          {status === 'ready' ? 'Обновить подсказку' : 'Получить вариант лечения'}
        </Button>
      </header>
      <p className="dr-ai-intro">
        Помощник на основе ИИ предложит варианты лечения по поставленному вами диагнозу. Это только генерации ИИ, решение всегда остается за вами! Не полагайтесь только на ответы помощника.
        Помощнику уходят только обезличенные данные: возраст, пол, группа крови, рост, вес, заболевания, препараты, аллергии, социальный статус и условия работы, анамнез, история болезни (прошлые диагнозы, назначения и осмотры), анализы, жалобы, осмотр, температура, пульс, давление и диагноз. ФИО, контакты и даты не передаются.
      </p>
      {!diagnosis && status === 'idle' && <p className="dr-ai-note">Укажите диагноз, и кнопка станет доступной.</p>}
      {outdated && <p className="dr-ai-note" role="status">Диагноз изменён после запроса. Нажмите «Обновить подсказку».</p>}

      {status === 'loading' && <p className="dr-ai-wait" role="status">Помощник готовит подсказку, это может занять до минуты…</p>}
      {status === 'error' && <p className="dr-ai-error" role="alert"><Icon name="alert" size={15} />{problem}</p>}

      {hint && status !== 'loading' && (
        <div className={`dr-ai-result ${outdated ? 'is-outdated' : ''}`}>
          <p className="dr-ai-disclaimer"><Icon name="alert" size={15} /><span><strong>{data.disclaimer || 'Подсказка ИИ, не назначение. Проверьте самостоятельно.'}</strong></span></p>

          {hint.summary && (
            <div className="dr-ai-block">
              <h4>Кратко</h4>
              <p>{hint.summary}</p>
            </div>
          )}

          {hint.diagnosisCheck && (
            <div className="dr-ai-block">
              <h4>Замечания к диагнозу</h4>
              <p>{hint.diagnosisCheck}</p>
            </div>
          )}

          {hasText(hint.treatment) && (
            <div className="dr-ai-block">
              <h4>Варианты лечения</h4>
              <ul>{hint.treatment.map((item) => <li key={item}>{item}</li>)}</ul>
              <Button size="sm" icon={inserted.treatment ? 'check' : 'plus'} disabled={inserted.treatment}
                onClick={() => { onInsertTreatment(hint.treatment); setInserted((prev) => ({ ...prev, treatment: true })); }}>
                {inserted.treatment ? 'Вставлено в лечение' : 'Вставить в лечение'}
              </Button>
            </div>
          )}

          {hasText(hint.monitoring) && (
            <div className="dr-ai-block">
              <h4>Что контролировать</h4>
              <ul>{hint.monitoring.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          )}

          {hasText(hint.redFlags) && (
            <div className="dr-ai-block dr-ai-flags">
              <h4><Icon name="alert" size={15} />Тревожные признаки</h4>
              <ul>{hint.redFlags.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          )}

          {hint.patientText && (
            <div className="dr-ai-block">
              <h4>Текст для пациента</h4>
              <p>{hint.patientText}</p>
              <Button size="sm" icon={inserted.recommendations ? 'check' : 'plus'} disabled={inserted.recommendations}
                onClick={() => { onInsertRecommendations(hint.patientText); setInserted((prev) => ({ ...prev, recommendations: true })); }}>
                {inserted.recommendations ? 'Вставлено в рекомендации' : 'Вставить в рекомендации'}
              </Button>
            </div>
          )}

          {sent.length > 0 && (
            <details className="dr-ai-sent">
              <summary>Что отправлено в модель</summary>
              <dl>
                {sent.map(([key, value]) => {
                  const lines = groupLines(value);
                  return (
                    <div key={key}>
                      <dt>{key.charAt(0).toUpperCase() + key.slice(1)}</dt>
                      <dd>
                        {lines.length ? <ul>{lines.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul> : 'нет данных'}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </details>
          )}

          {data.reasoning && (
            <details className="dr-ai-sent">
              <summary>Ход рассуждений модели</summary>
              <p className="dr-ai-reasoning">{data.reasoning}</p>
            </details>
          )}

          {data.provider && <p className="dr-ai-source">Источник: {data.provider}{data.model ? `, ${data.model}` : ''}</p>}
        </div>
      )}
    </section>
  );
}
