const mongoose = require('mongoose');
const { normalizePhone, PHONE_RE } = require('../../utils/phone');

const BLOOD_TYPES = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
const ICD_RE = /^[A-Z]\d{2}(\.\d{1,2})?$/;

// Заболевание
const diseaseSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Название заболевания обязательно'], trim: true, maxlength: 120 },
  since: Date,
  note: { type: String, trim: true, maxlength: 500 },
});

// Принимаемый препарат
const medicationSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Название препарата обязательно'], trim: true, maxlength: 120 },
  dose: { type: String, trim: true, maxlength: 60 },
  schedule: { type: String, trim: true, maxlength: 120 },
  startedAt: { type: Date, default: Date.now },
  active: { type: Boolean, default: true },
});

// Назначение внутри приёма
const prescriptionSchema = new mongoose.Schema({
  drug: { type: String, required: [true, 'Название препарата обязательно'], trim: true, maxlength: 120 },
  dose: { type: String, trim: true, maxlength: 60 },
  days: { type: Number, min: [1, 'Курс — от 1 дня'], max: [365, 'Курс — не больше 365 дней'], default: 7 },
}, { _id: false });

// схема дока Прием врача
const visitSchema = new mongoose.Schema({
  appointmentId: Number, 
  doctor: {
    id: Number,
    name: { type: String, required: [true, 'Укажите врача'], trim: true },
    specialty: { type: String, trim: true },
  },
  date: { type: Date, required: [true, 'Дата приёма обязательна'], default: Date.now },
  complaints: { type: String, required: [true, 'Жалобы обязательны'], trim: true, maxlength: 2000 },
  diagnosis: { type: String, required: [true, 'Диагноз обязателен'], trim: true, maxlength: 500 },
  icdCode: { type: String, trim: true, uppercase: true, match: [ICD_RE, 'Код МКБ-10 должен быть вида J20.9'] },
  treatment: { type: String, trim: true, maxlength: 2000 },
  examination: { type: String, trim: true, maxlength: 4000 }, // объективный осмотр врача
  recommendations: { type: String, trim: true, maxlength: 2000 },
  vitals: {
    temperature: { type: Number, min: [30, 'Температура ниже 30 °C'], max: [45, 'Температура выше 45 °C'] },
    pulse: { type: Number, min: 20, max: 250 },
    pressure: {
      systolic: { type: Number, min: 50, max: 300 },
      diastolic: { type: Number, min: 30, max: 200 },
    },
  },
  prescriptions: [prescriptionSchema],
}, { timestamps: { createdAt: 'createdAt', updatedAt: false } });

// Направление к другому специалисту или на исследование. Выдаётся врачом из карточки пациента
const referralSchema = new mongoose.Schema({
  number: { type: String, required: true }, 
  visitId: mongoose.Schema.Types.ObjectId, 
  issuedAt: { type: Date, default: Date.now },
  validUntil: Date,
  doctor: {
    id: Number,
    name: { type: String, required: true, trim: true },
    specialty: { type: String, trim: true },
  },
  urgency: { type: String, enum: { values: ['planned', 'urgent'], message: 'Срочность: planned или urgent' }, default: 'planned' },
  toSpecialty: { type: String, required: [true, 'Укажите, к какому специалисту или на какое исследование направление'], trim: true, maxlength: 120 },
  toFacility: { type: String, trim: true, maxlength: 160 },
  purpose: { type: String, required: [true, 'Укажите цель направления'], trim: true, maxlength: 1000 },
  diagnosis: { type: String, trim: true, maxlength: 500 },
  icdCode: { type: String, trim: true, uppercase: true, match: [ICD_RE, 'Код МКБ-10 должен быть вида J20.9'] },
  notes: { type: String, trim: true, maxlength: 1000 }, // что уже проведено, особые отметки
});

// Основная схема 
const medicalCardSchema = new mongoose.Schema({
  patientId: { type: Number, required: [true, 'Не указан пациент'], unique: true }, // id пациента в PostgreSQL
  cardNumber: { type: String, required: [true, 'Номер карты обязателен'], unique: true, trim: true, match: [/^MK-\d{4}-\d{4}$/, 'Номер карты вида MK-2026-0001'] },

  // Данные пациента лежат прямо в документе (вложенный объект), а не в отдельной таблице
  patient: {
    lastName: { type: String, required: [true, 'Фамилия обязательна'], trim: true, maxlength: 60 },
    firstName: { type: String, required: [true, 'Имя обязательно'], trim: true, maxlength: 60 },
    middleName: { type: String, trim: true, maxlength: 60 },
    birthDate: { type: Date, required: [true, 'Дата рождения обязательна'] },
    gender: { type: String, enum: { values: ['male', 'female'], message: 'Пол: male или female' }, required: [true, 'Пол обязателен'] },
    address: { type: String, trim: true, maxlength: 255 },
    insuranceNumber: { type: String, trim: true, maxlength: 30 },
    socialStatus: { type: String, enum: ['student', 'schoolchild', 'child', 'adult'] },
    workplace: { type: String, trim: true, maxlength: 150 },
    trustedPerson: { type: String, trim: true, maxlength: 300 },
    phone: {
      type: String,
      set: (value) => (typeof value === 'string' ? (normalizePhone(value) ?? value) : value),
      match: [PHONE_RE, 'Телефон в формате +375(44)4444444'],
    },
    email: { type: String, lowercase: true, trim: true, maxlength: 120 },
  },

  bloodType: { type: String, enum: { values: BLOOD_TYPES, message: `Группа крови: ${BLOOD_TYPES.join(', ')}` } },
  heightCm: { type: Number, min: 30, max: 250 },
  weightKg: { type: Number, min: 2, max: 400 },
  anamnesis: {
    family: { type: String, trim: true, maxlength: 1000 },
    habits: { type: String, trim: true, maxlength: 500 },
    surgeries: { type: String, trim: true, maxlength: 1000 },
    disability: { type: String, trim: true, maxlength: 300 },
    notes: { type: String, trim: true, maxlength: 2000 },
  },
  createdBy: { id: Number, name: String }, // врач, который завёл личное дело
  allergies: [{ type: String, trim: true, maxlength: 80 }], // массив строк
  tags: [{ type: String, trim: true, lowercase: true, maxlength: 40 }], // метки: «хроник», «льготник», «диспансерный учёт»
  diseases: [diseaseSchema], // массив вложенных документов
  medications: [medicationSchema],
  visits: [visitSchema],
  referrals: [referralSchema],
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

medicalCardSchema.index({ 'patient.lastName': 1, 'patient.firstName': 1 }); // поиск и сортировка по ФИО (составной индекс)
medicalCardSchema.index({ tags: 1 }); // «мультиключевой» индекс по массиву
medicalCardSchema.index({ 'visits.date': -1 }); // индекс по полю внутри вложенных документов
medicalCardSchema.index({ 'diseases.name': 'text', 'visits.diagnosis': 'text' }); // полнотекстовый поиск

// Виртуальные поля 
medicalCardSchema.virtual('fullName').get(function fullName() {
  return [this.patient?.lastName, this.patient?.firstName, this.patient?.middleName].filter(Boolean).join(' ');
});

medicalCardSchema.virtual('bmi').get(function bmi() {
  if (!this.heightCm || !this.weightKg) return null;
  return Math.round((this.weightKg / ((this.heightCm / 100) ** 2)) * 10) / 10;
});

medicalCardSchema.virtual('age').get(function age() {
  const born = this.patient?.birthDate;
  if (!born) return null;
  const now = new Date();
  let years = now.getFullYear() - born.getFullYear();
  if (now < new Date(now.getFullYear(), born.getMonth(), born.getDate())) years -= 1;
  return years;
});

// подтягивает анализы из виртуального поля
medicalCardSchema.virtual('labResults', { ref: 'LabResult', localField: '_id', foreignField: 'card' });


medicalCardSchema.methods.addVisit = function addVisit(data) {
  this.visits.push(data);
  return this.save(); // валидируется схема приёма, а затем сохраняется весь документ
};

medicalCardSchema.methods.activeMedications = function activeMedications() {
  return this.medications.filter((medication) => medication.active);
};


medicalCardSchema.statics.findByDisease = function findByDisease(name) {
  // совпадение по вложенному полю внутри массива: любая запись массива diseases с таким name
  return this.find({ 'diseases.name': new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') });
};

medicalCardSchema.statics.findByTag = function findByTag(tag) {
  return this.find({ tags: tag.toLowerCase() }); // массив содержит значение
};

// Каскадное удаление. Удалили карту — удаляем и её анализы из другой коллекции 
async function removeLabResults(cardId) {
  if (cardId) await mongoose.model('LabResult').deleteMany({ card: cardId });
}
medicalCardSchema.post('findOneAndDelete', async (doc) => { await removeLabResults(doc?._id); });
medicalCardSchema.post('deleteOne', { document: true, query: false }, async (doc) => { await removeLabResults(doc._id); });

module.exports = mongoose.models.MedicalCard || mongoose.model('MedicalCard', medicalCardSchema);
module.exports.BLOOD_TYPES = BLOOD_TYPES;
