// Защита ключа модели от выжигания лимита: суточный бюджет запросов на весь сайт и кэш одинаковых вопросов.
// Лимиты по IP и по пользователю стоят отдельно, в middleware/rateLimit.js.

// Суточный бюджет: сколько запросов к модели разрешено за календарные сутки. Исчерпан – ответы без обращения к модели.
function createDailyBudget(getLimit) {
  let day = '';
  let used = 0;
  const rotate = () => {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== day) { day = today; used = 0; }
  };
  return {
    take() {
      rotate();
      if (used >= getLimit()) return false;
      used += 1;
      return true;
    },
    left() {
      rotate();
      return Math.max(0, getLimit() - used);
    },
  };
}

// Кэш с временем жизни: одинаковые вопросы («как записаться») не тратят лимит модели
function createTtlCache({ max = 200, ttlMs = 60 * 60 * 1000 } = {}) {
  const map = new Map();
  return {
    get(key) {
      const hit = map.get(key);
      if (!hit) return undefined;
      if (hit.expires < Date.now()) { map.delete(key); return undefined; }
      return hit.value;
    },
    set(key, value) {
      if (map.size >= max) map.delete(map.keys().next().value);
      map.set(key, { value, expires: Date.now() + ttlMs });
    },
  };
}

module.exports = { createDailyBudget, createTtlCache };
