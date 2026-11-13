require('dotenv').config({ quiet: true });

const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { sequelize } = require('./models');
const { checkAuthConfig, client } = require('./config/auth');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const auth = require('./middleware/auth');

const authRouter = require('./routes/auth');
const profileRouter = require('./routes/profile');
const meRouter = require('./routes/me');
const slotsRouter = require('./routes/slots');
const requireRole = require('./middleware/roles');
const requireMongo = require('./middleware/requireMongo');
const { connectMongo, mongoStatus } = require('./config/mongo');
const mongoRouter = require('./mongo/routes/cards');
const doctorPortalRouter = require('./routes/doctorPortal');
const ensureAdmin = require('./services/ensureAdmin');
const loadDoctor = require('./middleware/doctor');
const appointmentsRouter = require('./routes/appointments');
const patientsRouter = require('./routes/patients');
const doctorsRouter = require('./routes/doctors');
const specialtiesRouter = require('./routes/specialties');
const chatRouter = require('./routes/chat');
const assistantRouter = require('./routes/assistant');
const aiConfig = require('./config/ai');
const { attachRealtime } = require('./realtime');
const { connectRedis, onRedisReady } = require('./config/redis');
const { reconcile: restoreDeliveryQueue } = require('./services/deliveryQueue');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS: React-клиент (Vite, порт 5173) живёт на другом origin, без этих заголовков браузер блокирует ответы API.
// Разрешённые адреса клиента можно задать через CLIENT_ORIGIN в .env (несколько — через запятую).
app.use(cors({
  origin: client.origins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'QUERY', 'OPTIONS'],
  // Authorization нужен для заголовка Bearer <JWT>, Content-Type — для JSON-тела запросов
  allowedHeaders: ['Content-Type', 'Authorization'],
  // клиент может прочитать, сколько ждать при ответе 429 Too Many Requests
  exposedHeaders: ['Retry-After', 'RateLimit', 'Content-Disposition'],
  maxAge: 600,
}));

// За туннелем или прокси (Cloudflare, nginx) лимиты по IP должны видеть настоящий адрес посетителя: TRUST_PROXY=1 в .env
if (process.env.TRUST_PROXY) app.set('trust proxy', /^\d+$/.test(process.env.TRUST_PROXY) ? Number(process.env.TRUST_PROXY) : process.env.TRUST_PROXY);

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Clinic Management API' });
});

// Аутентификация и профиль
app.use('/auth', authRouter);
app.use('/profile', profileRouter);

// Личный кабинет пациента (/me) и свободные талоны (/slots)
app.use('/me', auth, meRouter);
app.use('/slots', slotsRouter);

// MongoDB: альтернативное хранение медицинских карт документами (лабораторная работа №6).
// Состояние подключения открыто всем, сами данные — только сотрудникам.
app.get('/mongo/health', (req, res) => res.json(mongoStatus()));
app.use('/mongo', auth, requireRole('staff'), requireMongo, mongoRouter);

// Кабинет врача: записи к нему, личные дела пациентов, документы Word
app.use('/doctor', auth, requireRole('doctor'), loadDoctor, doctorPortalRouter);

// Общие списки записей и пациентов — только для сотрудников регистратуры (роль staff)
app.use('/appointments', auth, requireRole('staff'), appointmentsRouter);
app.use('/patients', auth, requireRole('staff'), patientsRouter);
// Врачи и специальности: чтение открыто, изменение врачей закрыто внутри routes/doctors.js
app.use('/doctors', doctorsRouter);
app.use('/specialties', specialtiesRouter);

// Вопросы врачу (REST: список, история, счётчик). Сами сообщения идут по WebSocket, см. realtime/
app.use('/chat', auth, chatRouter);

// ИИ-помощник для пациентов (чат без входа); подсказка врачу находится в /doctor/assistant/hint
app.use('/assistant', assistantRouter);

app.use(notFound);
app.use(errorHandler);

async function start() {
  const { errors, warnings } = checkAuthConfig();
  if (errors.length) {
    console.error(`Ошибка конфигурации (.env):\n - ${errors.join('\n - ')}`);
    process.exit(1);
  }
  warnings.forEach((warning) => console.warn(`Предупреждение: ${warning}`));

  try {
    await sequelize.authenticate();
    console.log('PostgreSQL: connection established');

    // Новые таблицы и колонки появляются только после миграций: если какая-то не применена, запросы падают ошибкой БД
    // (например «column ... does not exist»). Поэтому сравниваем файлы в migrations с таблицей SequelizeMeta.
    const files = fs.readdirSync(path.join(__dirname, 'migrations')).filter((name) => name.endsWith('.js')).sort();
    let applied = [];
    try {
      [applied] = await sequelize.query('SELECT name FROM "SequelizeMeta"');
    } catch { /* таблицы ещё нет: миграции не запускались ни разу */ }
    const done = new Set(applied.map((row) => row.name));
    const pending = files.filter((name) => !done.has(name));
    if (pending.length) {
      console.error(`База данных не обновлена, не применено миграций: ${pending.length}`);
      pending.forEach((name) => console.error(`  - ${name}`));
      console.error('Выполните  npm run db:migrate  и запустите сервер снова');
      process.exit(1);
    }
  } catch (err) {
    console.error(`PostgreSQL: connection failed - ${err.message}`);
    process.exit(1);
  }

  await ensureAdmin(); // учётка администратора из ADMIN_EMAIL и ADMIN_PASSWORD (.env), если администратора ещё нет
  const aiMissing = aiConfig.missing();
  if (aiMissing.length) console.warn(`ИИ-помощник: в .env не хватает ${aiMissing.join(', ')}`);
  const aiProvider = aiConfig.getProvider();
  console.log(`ИИ-помощник (чат пациентов и подсказка врачу): ${aiProvider ? `${aiProvider.name} (${aiProvider.model})` : 'не настроен, чат отвечает справочными ответами, подсказка врачу недоступна'}`);
  await connectMongo(); // необязательно: без MONGO_URI или при ошибке подключения сервер всё равно запускается

  // Redis (REDIS_URI) — очередь доставки сообщений офлайн-адресату; тоже необязательный. При каждом (пере)подключении
  // очередь пересобирается из MongoDB, чтобы после простоя Redis ни одно сообщение не осталось «в пути»
  onRedisReady(restoreDeliveryQueue);
  connectRedis();

  // Socket.IO живёт на том же HTTP-сервере и порту, что и REST
  const server = app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  attachRealtime(server);
}

start();
