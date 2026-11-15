require('dotenv').config({ quiet: true });

// Оба ИИ-помощника (чат поддержки для пациентов и подсказка врачу) работают через OpenRouter, на одной модели.
// Ключ, адрес и модель лежат в .env, в коде их нет:
//   OPENROUTER_API_KEY=...               – ключ
//   OPENROUTER_BASE_URL=...              – адрес API (https://openrouter.ai/api/v1)
//   OPENROUTER_MODEL=...                 – название модели (например, бесплатная nvidia/nemotron-3.5-super-vl:free)
// Необязательно: AI_DAILY_PATIENT, AI_DAILY_DOCTOR – суточные бюджеты запросов; AI_TIMEOUT_MS, AI_MAX_TOKENS,
// AI_DOCTOR_TIMEOUT_MS, AI_DOCTOR_MAX_TOKENS – время ожидания и лимит токенов.
// Без ключа чат отвечает справочными ответами, подсказка врачу отвечает «недоступна».

const number = (value, fallback) => (Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback);
const REQUIRED = ['OPENROUTER_API_KEY', 'OPENROUTER_BASE_URL', 'OPENROUTER_MODEL'];

// Настройки модели или null, если в .env что-то не заполнено. Читается при каждом вызове: настройки всегда актуальны.
function getProvider() {
  const [apiKey, baseUrl, model] = REQUIRED.map((name) => (process.env[name] || '').trim());
  if (!apiKey || !baseUrl || !model) return null;
  return { name: 'openrouter', apiKey, baseUrl: baseUrl.replace(/\/+$/, ''), model };
}

// Чего не хватает в .env: ключ есть, а адреса или модели нет (подсказка при старте сервера)
function missing() {
  if (!process.env.OPENROUTER_API_KEY) return [];
  return REQUIRED.slice(1).filter((name) => !process.env[name]);
}

module.exports = {
  getProvider,
  missing,
  isEnabled: () => getProvider() !== null,
  limits: () => ({
    timeoutMs: number(process.env.AI_TIMEOUT_MS, 30_000),
    maxTokens: number(process.env.AI_MAX_TOKENS, 900),
    doctorTimeoutMs: number(process.env.AI_DOCTOR_TIMEOUT_MS, 120_000), // подсказка врачу длинная, а бесплатная модель отвечает не быстро
    doctorMaxTokens: number(process.env.AI_DOCTOR_MAX_TOKENS, 12_000), // в этот лимит входят и «мысли» модели, и сам JSON
    patientDaily: number(process.env.AI_DAILY_PATIENT, 60), // сколько вопросов к модели в сутки на весь сайт (бесплатные тарифы небольшие)
    doctorDaily: number(process.env.AI_DAILY_DOCTOR, 100), // подсказок врачам в сутки на весь сайт
    messageLength: 500,
    historyTurns: 6,
  }),
};
