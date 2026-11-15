// «Ведро с жетонами»: за каждое действие снимается жетон, жетоны медленно возвращаются.
// express-rate-limit работает только для HTTP, поэтому для сокетов лимит свой. В тестах отключается так же, как HTTP-лимиты.
function createLimiter({ capacity, refillPerSecond }) {
  const buckets = new Map();

  // забытые ведра удаляем, чтобы карта не росла бесконечно
  const sweep = setInterval(() => {
    const limit = Date.now() - 10 * 60 * 1000;
    buckets.forEach((bucket, key) => { if (bucket.at < limit) buckets.delete(key); });
  }, 5 * 60 * 1000);
  sweep.unref?.();

  return {
    take(key, cost = 1) {
      if (process.env.RATE_LIMIT_DISABLED === 'true') return true;
      const now = Date.now();
      const bucket = buckets.get(key) ?? { tokens: capacity, at: now };
      bucket.tokens = Math.min(capacity, bucket.tokens + ((now - bucket.at) / 1000) * refillPerSecond);
      bucket.at = now;
      const allowed = bucket.tokens >= cost;
      if (allowed) bucket.tokens -= cost;
      buckets.set(key, bucket);
      return allowed;
    },
  };
}

module.exports = { createLimiter };
