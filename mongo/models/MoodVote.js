const mongoose = require('mongoose');

const MOODS = ['happy', 'neutral', 'sad'];

// Голос в опросе «Как ваше настроение сегодня?». Аккаунт в голосе НЕ хранится: кто проголосовал, по базе узнать нельзя.
// Чтобы один человек не голосовал дважды за день, пишется необратимый хэш voterHash = HMAC(секрет, «аккаунт:день»),
// а повтор отсекает уникальный индекс (день + хэш), поэтому гонки «проверил, потом записал» невозможны.
const moodVoteSchema = new mongoose.Schema({
  day: { type: String, required: true, match: [/^\d{4}-\d{2}-\d{2}$/, 'День в формате ГГГГ-ММ-ДД'] }, // сутки по часовому поясу клиники
  mood: { type: String, enum: MOODS, required: true },
  voterHash: { type: String, required: true, minlength: 64, maxlength: 64 },
}, { timestamps: { createdAt: true, updatedAt: false } });

// один голос на человека в сутки; тот же индекс ускоряет подсчёт за день (поиск по префиксу «day»)
moodVoteSchema.index({ day: 1, voterHash: 1 }, { unique: true });

const MoodVote = mongoose.models.MoodVote || mongoose.model('MoodVote', moodVoteSchema);
MoodVote.MOODS = MOODS;

module.exports = MoodVote;
