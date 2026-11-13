const { getRedis } = require('../config/redis');
const { isConnected } = require('../config/mongo');
const Message = require('../mongo/models/Message');

// Очередь доставки: что ждёт адресата, которого сейчас нет в сети («ваш вопрос принят, будет доставлен, когда врач появится»).
//
// Текст сообщения всегда сначала сохраняется в MongoDB (история + источник правды), поэтому подтверждённое сообщение
// не пропадёт, даже если Redis перезапустится. В Redis хранятся только id ждущих сообщений: по одному списку на адресата.
// Если Redis не настроен или недоступен, недоставленные находятся запросом к MongoDB (deliveredAt: null), а при
// (пере)подключении Redis списки пересобираются из MongoDB (reconcile). Очередь от этого только быстрее, но не нужнее.

const TTL_SECONDS = 30 * 24 * 3600;
const listKey = (recipientKey) => `chat:pending:${recipientKey}`;

// Положить id сообщения в очередь адресата. false — Redis недоступен (сообщение всё равно найдётся в MongoDB)
async function enqueue(recipientKey, messageId) {
  const redis = getRedis();
  if (!redis) return false;
  try {
    await redis.multi().rpush(listKey(recipientKey), String(messageId)).expire(listKey(recipientKey), TTL_SECONDS).exec();
    return true;
  } catch (err) {
    console.error(`Очередь доставки: не удалось записать в Redis: ${err.message}`);
    return false;
  }
}

// Забрать id ждущих сообщений и очистить список одной транзакцией. null — Redis недоступен, нужно искать в MongoDB
async function drainIds(recipientKey) {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const [[error, ids]] = await redis.multi().lrange(listKey(recipientKey), 0, -1).del(listKey(recipientKey)).exec();
    return error ? null : ids;
  } catch (err) {
    console.error(`Очередь доставки: не удалось прочитать из Redis: ${err.message}`);
    return null;
  }
}

// Недоставленные сообщения адресата по порядку (беседа, номер). Если загрузка из MongoDB не удалась, id возвращаются в очередь
async function takePending(recipientKey) {
  const ids = await drainIds(recipientKey);
  const filter = ids ? { _id: { $in: ids }, deliveredAt: null } : { recipientKey, deliveredAt: null };
  try {
    return await Message.find(filter).sort({ conversationId: 1, seq: 1 }).lean();
  } catch (err) {
    if (ids) await Promise.all(ids.map((id) => enqueue(recipientKey, id)));
    throw err;
  }
}

// Пересобрать списки Redis из MongoDB: после перезапуска Redis, очистки или простоя, когда сообщения копились без него
async function reconcile() {
  const redis = getRedis();
  if (!redis || !isConnected()) return;
  try {
    const rows = await Message.find({ deliveredAt: null }).sort({ createdAt: 1, seq: 1 }).select('recipientKey').lean();
    const byRecipient = new Map();
    rows.forEach((row) => {
      const list = byRecipient.get(row.recipientKey) ?? [];
      list.push(String(row._id));
      byRecipient.set(row.recipientKey, list);
    });
    await Promise.all([...byRecipient].map(([recipientKey, ids]) => {
      const transaction = redis.multi().del(listKey(recipientKey));
      ids.forEach((id) => transaction.rpush(listKey(recipientKey), id));
      return transaction.expire(listKey(recipientKey), TTL_SECONDS).exec();
    }));
    if (rows.length) console.log(`Очередь доставки: из MongoDB восстановлено сообщений: ${rows.length}`);
  } catch (err) {
    console.error(`Очередь доставки: не удалось пересобрать из MongoDB: ${err.message}`);
  }
}

module.exports = { enqueue, takePending, reconcile };
