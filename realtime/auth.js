const { User, Patient } = require('../models');
const { verifyToken } = require('../services/tokens');
const { client } = require('../config/auth');

const MAX_TIMER_MS = 2 ** 31 - 1;

// Браузер не применяет CORS к WebSocket: страница любого сайта может попытаться подключиться от имени посетителя.
// Поэтому Origin проверяем сами. У не-браузерных клиентов (скрипты, тесты) заголовка нет, подмена Origin им ничего не даёт.
function allowRequest(req, callback) {
  const { origin } = req.headers;
  if (!origin) return callback(null, true);
  return callback(null, client.origins.includes(origin.replace(/\/+$/, '')));
}

function rejection(code) {
  const error = new Error(code);
  error.data = { code };
  return error;
}

// Рукопожатие. Токен приходит в socket.handshake.auth (а не в адресе: адреса попадают в логи).
// Без токена — гость: ему доступны только свободные талоны. Проверки те же, что в middleware/auth.js для обычных запросов,
// в том числе tokenVersion из базы (смена пароля отзывает токен), а роль берётся из базы, а не из токена
async function authenticate(socket, next) {
  const token = socket.handshake.auth?.token;
  if (!token) {
    socket.data.identity = null;
    return next();
  }
  try {
    const decoded = verifyToken(String(token), 'access');
    const user = await User.findByPk(decoded.id, { attributes: ['id', 'isVerified', 'tokenVersion', 'role', 'doctorId'] });
    if (!user || !user.isVerified || user.tokenVersion !== decoded.tv) throw rejection('unauthorized');

    let patientId = null;
    if (user.role === 'patient') {
      const patient = await Patient.findOne({ where: { userId: user.id }, attributes: ['id'] });
      patientId = patient?.id ?? null;
    }
    socket.data.identity = {
      userId: user.id,
      role: user.role,
      doctorId: user.role === 'doctor' ? user.doctorId : null,
      patientId,
      tokenVersion: user.tokenVersion,
      exp: decoded.exp,
    };
    return next();
  } catch (err) {
    // неверный, просроченный или отозванный токен — «unauthorized»; сбой базы — «unavailable» (клиент попробует позже)
    return next(err.statusCode === 401 || err.data?.code ? rejection('unauthorized') : rejection('unavailable'));
  }
}

function expire(socket) {
  socket.emit('auth:expired');
  socket.disconnect(true);
}

// JWT живёт 1 час, а сокет может жить дольше. Без этого просроченный токен работал бы на открытом соединении бесконечно
function scheduleExpiry(socket) {
  const { exp } = socket.data.identity;
  const timer = setTimeout(() => expire(socket), Math.min(Math.max(exp * 1000 - Date.now(), 0), MAX_TIMER_MS));
  timer.unref?.();
  socket.once('disconnect', () => clearTimeout(timer));
}

// Раз в минуту сверяем открытые соединения с базой: сменили пароль, отключили аккаунт или поменяли роль — соединение закрывается,
// а не дожидается следующего HTTP-запроса
function startRevalidation(io, everyMs = Number(process.env.REALTIME_REVALIDATE_MS ?? 60000)) {
  const timer = setInterval(async () => {
    try {
      const sockets = [...io.sockets.sockets.values()].filter((socket) => socket.data.identity);
      if (!sockets.length) return;
      const ids = [...new Set(sockets.map((socket) => socket.data.identity.userId))];
      const users = await User.findAll({ where: { id: ids }, attributes: ['id', 'isVerified', 'tokenVersion', 'role', 'doctorId'], raw: true });
      const byId = new Map(users.map((user) => [user.id, user]));
      sockets.forEach((socket) => {
        const { identity } = socket.data;
        const user = byId.get(identity.userId);
        const valid = user
          && user.isVerified
          && user.tokenVersion === identity.tokenVersion
          && user.role === identity.role
          && (identity.role !== 'doctor' || user.doctorId === identity.doctorId);
        if (!valid) expire(socket);
      });
    } catch (err) {
      console.error(`Realtime: не удалось сверить соединения с базой: ${err.message}`);
    }
  }, everyMs);
  timer.unref?.();
  return timer;
}

module.exports = { allowRequest, authenticate, scheduleExpiry, startRevalidation };
