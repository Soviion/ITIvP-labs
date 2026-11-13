require('dotenv').config({ quiet: true });

const Redis = require('ioredis');

// Redis нужен чату как очередь доставки сообщений офлайн-получателю (см. services/deliveryQueue.js),
// а в дальнейшем — для кеша и сессий. Подключение необязательное: без REDIS_URI или при недоступном сервере
// всё продолжает работать, очередь тогда строится по MongoDB. Адрес с паролем в лог не попадает.

let client = null;
const readyListeners = new Set();

const isEnabled = () => Boolean(process.env.REDIS_URI);
const isReady = () => client?.status === 'ready';

function connectRedis() {
  if (!isEnabled()) {
    console.warn('Redis: REDIS_URI не задан в .env — очередь доставки сообщений работает через MongoDB');
    return null;
  }
  if (client) return client;

  client = new Redis(process.env.REDIS_URI, {
    // команды не копятся в памяти, пока сервер недоступен: сразу ошибка, и код переходит на запасной путь
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 5000,
    retryStrategy: (attempt) => Math.min(attempt * 1000, 10000),
  });

  let lastError = '';
  client.on('ready', () => {
    lastError = '';
    console.log('Redis connected');
    readyListeners.forEach((listener) => listener());
  });
  // без обработчика 'error' ioredis роняет процесс; одинаковые сообщения при переподключениях не повторяем
  client.on('error', (err) => {
    if (err.message === lastError) return;
    lastError = err.message;
    console.error(`Redis: ${err.message}`);
  });
  return client;
}

// Клиент отдаётся только когда соединение живо, иначе null
const getRedis = () => (isReady() ? client : null);

// Вызывается при каждом (пере)подключении: например, чтобы пересобрать очередь из MongoDB
const onRedisReady = (listener) => {
  readyListeners.add(listener);
  return () => readyListeners.delete(listener);
};

module.exports = { connectRedis, getRedis, onRedisReady, isEnabled };
