const crypto = require('crypto');
const hub = require('../hub');
const { createLimiter } = require('../limiter');
const MoodVote = require('../../mongo/models/MoodVote');
const ApiError = require('../../utils/ApiError');
const { isConnected } = require('../../config/mongo');

// Опрос «Как ваше настроение сегодня?» — голосование в реальном времени.
//   mood:get  {}         -> { ok, total, counts:{happy,neutral,sad}, myVote, canVote }   (гостям тоже: результаты открыты всем)
//   mood:vote { mood }   -> то же самое после голосования; один голос на аккаунт в сутки
//   mood:updated {total, counts}  сервер -> ВСЕМ подключённым после каждого голоса (и гостям)
//   mood:day                      сервер -> всем, когда наступили новые сутки (клиент заново запрашивает mood:get)
// Голосуют только вошедшие: иначе опрос накручивался бы без ограничений. Результаты анонимны: в базе нет аккаунта,
// только необратимый хэш «аккаунт + день» (см. mongo/models/MoodVote.js).

const { MOODS } = MoodVote;
const TIMEZONE = process.env.POLL_TIMEZONE || 'Europe/Minsk';

const getLimiter = createLimiter({ capacity: 10, refillPerSecond: 1 });
const voteLimiter = createLimiter({ capacity: 3, refillPerSecond: 0.1 });

const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
// «Сегодня» по часовому поясу клиники: ГГГГ-ММ-ДД (формат en-CA как раз такой)
const today = () => dayFormat.format(new Date());

const reply = (ack, payload) => { if (typeof ack === 'function') ack(payload); };
const zero = () => Object.fromEntries(MOODS.map((mood) => [mood, 0]));

function failure(err) {
  if (err instanceof ApiError) return { ok: false, code: err.statusCode, reason: err.reason, error: err.message };
  console.error(`Realtime mood: ${err?.stack || err}`);
  return { ok: false, code: 500, error: 'Внутренняя ошибка сервера' };
}

function fail(code, reason, message) {
  const error = new ApiError(code, message);
  error.reason = reason;
  return error;
}

// Хэш «аккаунт + день»: по нему видно, что человек уже голосовал, но не видно, кто он. Ключ — секрет сервера
const voterHash = (userId, day) => crypto.createHmac('sha256', process.env.JWT_SECRET || '').update(`${userId}:${day}`).digest('hex');

function requireStorage() {
  if (!isConnected()) throw fail(503, 'storage', 'Опрос временно недоступен');
}

// Индекс (день + хэш) должен существовать до первого голоса, иначе повтор мог бы проскочить. Создаётся один раз
let indexes = null;
const indexesReady = () => { indexes ??= MoodVote.init().catch(() => { indexes = null; }); return indexes; };

// Сколько голосов за день по каждому настроению
async function tally(day) {
  const counts = zero();
  const rows = await MoodVote.aggregate([{ $match: { day } }, { $group: { _id: '$mood', n: { $sum: 1 } } }]);
  rows.forEach((row) => { if (row._id in counts) counts[row._id] = row.n; });
  return { total: Object.values(counts).reduce((sum, n) => sum + n, 0), counts };
}

// Что видит конкретный человек: общие цифры + его собственный выбор и право голосовать
async function snapshot(identity) {
  const day = today();
  const results = await tally(day);
  let myVote = null;
  if (identity) {
    const mine = await MoodVote.findOne({ day, voterHash: voterHash(identity.userId, day) }).select('mood').lean();
    myVote = mine?.mood ?? null;
  }
  return { ok: true, ...results, myVote, canVote: Boolean(identity) && !myVote };
}

// Лимит по аккаунту, а у гостя — по адресу
const limitKey = (socket) => (socket.data.identity ? `u${socket.data.identity.userId}` : `ip:${socket.handshake.address}`);

function register(socket) {
  socket.on('mood:get', async (data, ack) => {
    try {
      if (!getLimiter.take(limitKey(socket))) throw fail(429, 'rate', 'Слишком часто. Подождите немного');
      requireStorage();
      reply(ack, await snapshot(socket.data.identity));
    } catch (err) {
      reply(ack, failure(err));
    }
  });

  socket.on('mood:vote', async (data, ack) => {
    try {
      const { identity } = socket.data;
      const mood = data?.mood;
      if (!MOODS.includes(mood)) throw fail(400, 'invalid', 'Выберите один из вариантов');
      if (!identity) throw fail(401, 'login', 'Войдите в аккаунт, чтобы проголосовать');
      if (!voteLimiter.take(limitKey(socket))) throw fail(429, 'rate', 'Слишком часто. Подождите немного');
      requireStorage();
      await indexesReady();

      const day = today();
      try {
        await MoodVote.create({ day, mood, voterHash: voterHash(identity.userId, day) });
      } catch (err) {
        if (err?.code === 11000) throw fail(409, 'already', 'Вы уже голосовали сегодня');
        throw err;
      }

      const results = await tally(day);
      // всем подключённым (в том числе гостям), у которых открыт опрос: цифры меняются без перезагрузки страницы
      hub.getIo()?.emit('mood:updated', results);
      reply(ack, { ok: true, ...results, myVote: mood, canVote: false });
    } catch (err) {
      reply(ack, failure(err));
    }
  });
}

// Новые сутки: у всех открытых вкладок опрос обнуляется. Проверяем раз в полминуты — этого достаточно
let lastDay = today();
const dayTimer = setInterval(() => {
  const now = today();
  if (now === lastDay) return;
  lastDay = now;
  hub.getIo()?.emit('mood:day', { day: now });
}, 30 * 1000);
dayTimer.unref?.();

module.exports = { register, today, voterHash };
