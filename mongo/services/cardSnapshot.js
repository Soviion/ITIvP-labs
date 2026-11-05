const { Patient, MedicalRecord } = require('../../models');
const ApiError = require('../../utils/ApiError');

const splitList = (text) => (text ? String(text).split(/[,;\n]+/).map((item) => item.trim()).filter(Boolean) : []);
const orUndefined = (value) => (value === null || value === '' ? undefined : value);

// Снимок данных пациента из PostgreSQL в виде документа MongoDB: всё, что пациент сам указал в профиле,
// превращается во вложенный объект patient и массивы. Пустые поля остаются пустыми — врач заполнит их на осмотре.
async function snapshotFromPostgres(patientId) {
  const patient = await Patient.findByPk(patientId, { include: [{ model: MedicalRecord, as: 'medicalRecord' }] });
  if (!patient) throw new ApiError(404, `Пациент с id=${patientId} не найден`);
  const record = patient.medicalRecord;

  const diseases = [
    ...(Array.isArray(record?.diseases) ? record.diseases : []),
    ...splitList(record?.chronicDiseases),
  ];
  const medications = Array.isArray(record?.medications) ? record.medications : [];

  return {
    patientId: patient.id,
    cardNumber: record?.cardNumber,
    patient: {
      lastName: patient.lastName,
      firstName: patient.firstName,
      middleName: orUndefined(patient.middleName),
      birthDate: new Date(patient.birthDate),
      gender: patient.gender,
      phone: patient.phone,
      email: orUndefined(patient.email),
      address: orUndefined(patient.address),
      insuranceNumber: orUndefined(patient.insuranceNumber),
      socialStatus: orUndefined(patient.socialStatus),
      workplace: orUndefined(patient.workplace),
      trustedPerson: orUndefined(patient.trustedPerson),
    },
    bloodType: orUndefined(record?.bloodType),
    heightCm: orUndefined(record?.heightCm),
    weightKg: orUndefined(record?.weightKg),
    allergies: splitList(record?.allergies),
    diseases: diseases.map((name) => ({ name: String(name).slice(0, 120) })),
    medications: medications.map((name) => ({ name: String(name).slice(0, 120) })),
  };
}

module.exports = { snapshotFromPostgres, splitList };
