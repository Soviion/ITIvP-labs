// Перенос медицинских карт из PostgreSQL в MongoDB:  npm run mongo:seed
// Для каждой карты (medical_records) собирается ОДИН документ: пациент, диагнозы и все приёмы (medical_entries)
// превращаются во вложенные объекты и массивы. Повторный запуск безопасен: документы обновляются по patientId.
require('dotenv').config({ quiet: true });

const mongoose = require('mongoose');
const { sequelize, Patient, MedicalRecord, MedicalEntry, Doctor, Specialty, Appointment } = require('../models');
const { connectMongo, isConnected } = require('../config/mongo');
const MedicalCard = require('../mongo/models/MedicalCard');

const splitList = (text) => (text ? String(text).split(/[,;\n]+/).map((item) => item.trim()).filter(Boolean) : []);

// Текст назначений «Омез 20 мг; Ингалипт» → массив назначений
const toPrescriptions = (text) => splitList(text).map((drug) => ({ drug: drug.slice(0, 120) }));

function toVisit(entry) {
  const doctor = entry.doctor;
  return {
    appointmentId: entry.appointmentId ?? undefined,
    doctor: doctor
      ? { id: doctor.id, name: doctor.fullName, specialty: doctor.specialty?.name }
      : { id: entry.doctorId, name: `Врач №${entry.doctorId}` },
    date: entry.appointment?.date ? new Date(entry.appointment.date) : entry.createdAt,
    complaints: entry.complaints,
    diagnosis: entry.diagnosis,
    icdCode: entry.icdCode ?? undefined,
    treatment: entry.treatment ?? undefined,
    prescriptions: toPrescriptions(entry.prescriptions),
  };
}

async function main() {
  if (!(await connectMongo()) || !isConnected()) {
    console.error('Не удалось подключиться к MongoDB. Проверьте MONGO_URI в .env и что сервер MongoDB запущен.');
    process.exitCode = 1;
    return;
  }

  const records = await MedicalRecord.findAll({
    include: [
      { model: Patient, as: 'patient', required: true },
      {
        model: MedicalEntry,
        as: 'entries',
        include: [
          { model: Doctor, as: 'doctor', include: [{ model: Specialty, as: 'specialty' }] },
          { model: Appointment, as: 'appointment', attributes: ['date'] },
        ],
      },
    ],
    order: [['id', 'ASC'], [{ model: MedicalEntry, as: 'entries' }, 'id', 'ASC']],
  });

  let created = 0;
  let updated = 0;
  for (const record of records) {
    const { patient } = record;
    const document = {
      patientId: patient.id,
      cardNumber: record.cardNumber,
      patient: {
        lastName: patient.lastName,
        firstName: patient.firstName,
        middleName: patient.middleName ?? undefined,
        birthDate: new Date(patient.birthDate),
        gender: patient.gender,
        phone: patient.phone,
        email: patient.email ?? undefined,
      },
      bloodType: record.bloodType ?? undefined,
      allergies: splitList(record.allergies),
      diseases: splitList(record.chronicDiseases).map((name) => ({ name: name.slice(0, 120) })),
      tags: splitList(record.chronicDiseases).length ? ['хроник'] : [],
      visits: record.entries.map(toVisit),
    };

    const existing = await MedicalCard.findOne({ patientId: patient.id });
    if (existing) {
      existing.set(document);
      await existing.save();
      updated += 1;
    } else {
      await MedicalCard.create(document);
      created += 1;
    }
  }

  console.log(`Готово. Создано карт: ${created}, обновлено: ${updated}, всего в коллекции: ${await MedicalCard.countDocuments()}`);
}

main()
  .catch((err) => {
    console.error(`Ошибка переноса: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    await sequelize.close();
  });
