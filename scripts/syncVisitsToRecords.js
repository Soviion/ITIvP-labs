// Переносит диагнозы и назначения из уже оформленных приёмов (MongoDB) в медицинскую карту пациента:  npm run records:sync
// Нужен один раз для приёмов, оформленных до появления автоматического переноса. Повторы не добавляются, запуск безопасен.
require('dotenv').config({ quiet: true });

const mongoose = require('mongoose');
const { sequelize } = require('../models');
const { connectMongo, isConnected } = require('../config/mongo');
const MedicalCard = require('../mongo/models/MedicalCard');
const { applyVisitToRecord, applyVisitToCard } = require('../services/visitRecordSync');

async function main() {
  if (!(await connectMongo()) || !isConnected()) {
    console.error('Не удалось подключиться к MongoDB. Проверьте MONGO_URI в .env.');
    process.exitCode = 1;
    return;
  }
  let patients = 0;
  let visits = 0;
  for (const card of await MedicalCard.find()) {
    let touched = false;
    for (const visit of card.visits) {
      const plain = visit.toObject();
      const a = await applyVisitToRecord(card.patientId, plain);
      const b = applyVisitToCard(card, plain);
      if (a || b) { visits += 1; touched = true; }
    }
    if (touched) { await card.save(); patients += 1; }
  }
  console.log(`Готово. Обновлено карт пациентов: ${patients}, учтено приёмов: ${visits}`);
}

main()
  .catch((err) => { console.error(`Ошибка: ${err.message}`); process.exitCode = 1; })
  .finally(async () => { await mongoose.disconnect(); await sequelize.close(); });
