const { getProvider, limits } = require('../../config/ai');
const ApiError = require('../../utils/ApiError');

// Единая точка вызова языковой модели (OpenRouter, см. config/ai.js). Ключ в сообщения и логи не попадает.

function textOf(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((part) => (typeof part === 'string' ? part : part?.text ?? '')).join('');
  return '';
}

// «Рассуждения» некоторых моделей приходят в тегах <think>…</think>: пользователю они не нужны
const clean = (text) => text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

// Короткое объяснение ошибки из ответа OpenRouter ({error:{message, metadata:{raw}}}). Ключ вычищается.
async function errorReason(response, apiKey) {
  try {
    const raw = await response.text();
    let message = raw;
    try {
      const error = JSON.parse(raw)?.error;
      message = error?.message ?? (typeof error === 'string' ? error : raw);
      if (error?.metadata?.raw) message += ` / ${String(error.metadata.raw).slice(0, 200)}`;
    } catch { /* ответ не JSON, берём как есть */ }
    const text = String(message).split(apiKey).join('***').replace(/\s+/g, ' ').trim().slice(0, 300);
    return text ? `: ${text}` : '';
  } catch {
    return '';
  }
}

async function request(provider, { system, messages, maxTokens, temperature, timeoutMs, rejectTruncated }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.apiKey}`, 'X-Title': 'Tvoi talon' },
      body: JSON.stringify({
        model: provider.model,
        messages: [{ role: 'system', content: system }, ...messages],
        max_tokens: maxTokens,
        ...(temperature === undefined ? {} : { temperature }),
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      // причину отказа даёт сам провайдер (неверный ключ, нет такой модели, лимит…): без неё в логе только номер кода
      const error = new Error(`HTTP ${response.status}${await errorReason(response, provider.apiKey)}`);
      error.status = response.status;
      throw error;
    }
    const choice = (await response.json())?.choices?.[0];
    const text = clean(textOf(choice?.message?.content));
    if (!text) throw new Error(`пустой ответ модели${choice?.finish_reason === 'length' ? ' (всё ушло на размышления: увеличьте AI_MAX_TOKENS)' : ''}`);
    // ответ оборвался на лимите токенов: для JSON-ответов это битые данные
    if (rejectTruncated && choice?.finish_reason === 'length') throw new Error('ответ обрезан по лимиту токенов (увеличьте max_tokens)');
    // ход мыслей рассуждающей модели: OpenRouter кладёт его в reasoning (у части моделей – reasoning_content)
    const reasoning = textOf(choice?.message?.reasoning ?? choice?.message?.reasoning_content).trim();
    return { text, reasoning, provider: provider.name, model: provider.model };
  } finally {
    clearTimeout(timer);
  }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Чат поддержки и подсказка врачу вызывают одну функцию; если temperature не указан, модель использует свою
async function chat({ system, messages, maxTokens, temperature, rejectTruncated = false, timeoutMs: ownTimeout }) {
  const provider = getProvider();
  if (!provider) throw new ApiError(503, 'Помощник сейчас недоступен');
  const { timeoutMs, maxTokens: defaultMax } = limits();
  const options = { system, messages, maxTokens: maxTokens ?? defaultMax, temperature, timeoutMs: ownTimeout ?? timeoutMs, rejectTruncated };

  try {
    try {
      return await request(provider, options);
    } catch (err) {
      // 503 у провайдера обычно кратковременный («высокий спрос»): один повтор через пару секунд
      if (err.status !== 503) throw err;
      await wait(2000);
      return await request(provider, options);
    }
  } catch (err) {
    // причина в консоль сервера (без ключа и без текста вопроса), клиенту – общее сообщение
    console.warn(`ИИ (${provider.name}): ${err.name === 'AbortError' ? 'нет ответа за отведённое время' : err.message}`);
    throw new ApiError(503, 'Помощник сейчас недоступен');
  }
}

module.exports = { chat };
