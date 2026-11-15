const mongoose = require('mongoose');

// Беседа «пациент — врач». Людей и врачей храним ссылками на PostgreSQL (числовые id), имена подтягиваются оттуда при выдаче.
// Счётчики непрочитанных лежат в самой беседе и меняются атомарно, поэтому красный кружок считается без обхода всех сообщений.
const sideCounters = () => ({
  patient: { type: Number, default: 0, min: 0 },
  doctor: { type: Number, default: 0, min: 0 },
});

const conversationSchema = new mongoose.Schema({
  patientId: { type: Number, required: true }, // patients.id
  patientUserId: { type: Number, required: true }, // users.id пациента: адрес для уведомлений (комната user:N)
  doctorId: { type: Number, required: true }, // doctors.id (комната doctor:N)
  // номер последнего сообщения: сквозная нумерация внутри беседы, по ней сортируются сообщения и догружается пропущенное
  lastSeq: { type: Number, default: 0, min: 0 },
  lastMessageAt: { type: Date, default: null },
  // до какого сообщения каждая сторона прочитала беседу (по этому отображается «прочитано» у отправителя)
  readSeq: sideCounters(),
  unread: sideCounters(),
}, { timestamps: true });

// у пары «пациент — врач» одна беседа, даже если запрос на её создание пришёл дважды
conversationSchema.index({ patientId: 1, doctorId: 1 }, { unique: true });
conversationSchema.index({ doctorId: 1, lastMessageAt: -1 });
conversationSchema.index({ patientUserId: 1, lastMessageAt: -1 });

module.exports = mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema);
