const mongoose = require('mongoose');

// Сообщение — история чата. Сначала всегда записывается сюда (источник правды), и только потом доставляется адресату:
// живому — сразу по сокету, офлайн — через очередь (см. services/deliveryQueue.js). Поэтому подтверждённое сообщение не теряется.
const messageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
  seq: { type: Number, required: true }, // номер в беседе
  from: { type: String, enum: ['patient', 'doctor'], required: true },
  // кому: комната адресата — 'doctor:5' или 'user:12'; по ней находятся недоставленные сообщения
  recipientKey: { type: String, required: true },
  text: { type: String, required: [true, 'Введите текст сообщения'], trim: true, maxlength: [2000, 'Сообщение: не больше 2000 символов'] },
  // идентификатор, который клиент придумывает сам: повторная отправка после обрыва связи не создаёт дубль
  clientMsgId: { type: String, required: true, maxlength: 64 },
  deliveredAt: { type: Date, default: null }, // null — ждёт, пока адресат появится в сети
}, { timestamps: { createdAt: true, updatedAt: false } });

messageSchema.index({ conversationId: 1, seq: 1 }, { unique: true });
messageSchema.index({ conversationId: 1, clientMsgId: 1 }, { unique: true });
messageSchema.index({ recipientKey: 1, deliveredAt: 1 });

module.exports = mongoose.models.Message || mongoose.model('Message', messageSchema);
