const mongoose = require('mongoose');
const { Patient } = require('../models');
const ApiError = require('../utils/ApiError');
const sendDocx = require('../utils/sendDocx');
const MedicalCard = require('../mongo/models/MedicalCard');
const { isConnected } = require('../config/mongo');
const { buildVisitDocx } = require('../services/documents/visitDocx');
const { buildReferralDocx } = require('../services/documents/referralDocx');

// «Моя история болезни»: приёмы, которые врач оформил в личном деле пациента, и выписанные к ним направления.
// Пациент видит только своё дело (оно ищется по его аккаунту), чужие идентификаторы дают 404.

const notFound = () => new ApiError(404, 'Запись о приёме не найдена');

async function ownCard(req) {
  const patient = await Patient.findOne({ where: { userId: req.user.id }, attributes: ['id'] });
  if (!patient) throw new ApiError(404, 'Карточка пациента не найдена. Личный кабинет доступен только пациентам');
  if (!isConnected()) throw new ApiError(503, 'История приёмов временно недоступна. Повторите попытку позже');
  return MedicalCard.findOne({ patientId: patient.id });
}

const idOf = (value) => String(value);
const referralsOf = (card, visitId) => (card.referrals ?? []).filter((item) => item.visitId && idOf(item.visitId) === idOf(visitId));

function findVisit(card, visitId) {
  if (!card || !mongoose.isValidObjectId(visitId)) throw notFound();
  const visit = card.visits.id(visitId);
  if (!visit) throw notFound();
  return visit;
}

const visitView = (visit) => ({
  id: idOf(visit._id),
  date: visit.date,
  doctor: { name: visit.doctor?.name, specialty: visit.doctor?.specialty },
  complaints: visit.complaints,
  examination: visit.examination,
  diagnosis: visit.diagnosis,
  icdCode: visit.icdCode,
  treatment: visit.treatment,
  recommendations: visit.recommendations,
  vitals: visit.vitals,
  prescriptions: visit.prescriptions,
});

const referralView = (referral) => ({
  id: idOf(referral._id),
  number: referral.number,
  issuedAt: referral.issuedAt,
  validUntil: referral.validUntil,
  urgency: referral.urgency,
  toSpecialty: referral.toSpecialty,
  toFacility: referral.toFacility,
  purpose: referral.purpose,
  diagnosis: referral.diagnosis,
  icdCode: referral.icdCode,
  notes: referral.notes,
  doctor: { name: referral.doctor?.name, specialty: referral.doctor?.specialty },
});

// GET /me/history — список приёмов, новые сверху
exports.list = async (req, res) => {
  const card = await ownCard(req);
  const visits = [...(card?.visits ?? [])].sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json({
    mongoAvailable: true,
    data: visits.map((visit) => ({
      id: idOf(visit._id),
      date: visit.date,
      doctor: { name: visit.doctor?.name, specialty: visit.doctor?.specialty },
      diagnosis: visit.diagnosis,
      icdCode: visit.icdCode,
      complaints: visit.complaints,
      referralsCount: referralsOf(card, visit._id).length,
    })),
  });
};

// GET /me/history/:visitId — документ приёма и его направления
exports.getVisit = async (req, res) => {
  const card = await ownCard(req);
  const visit = findVisit(card, req.params.visitId);
  const patient = card.patient.toObject();
  res.json({
    visit: visitView(visit),
    referrals: referralsOf(card, visit._id).map(referralView),
    card: {
      cardNumber: card.cardNumber,
      patient: {
        lastName: patient.lastName,
        firstName: patient.firstName,
        middleName: patient.middleName,
        birthDate: patient.birthDate,
        gender: patient.gender,
        address: patient.address,
        insuranceNumber: patient.insuranceNumber,
      },
    },
  });
};

// GET /me/history/:visitId/visit.docx
exports.downloadVisit = async (req, res) => {
  const card = await ownCard(req);
  const visit = findVisit(card, req.params.visitId);
  const buffer = await buildVisitDocx(card.toObject(), visit.toObject());
  const date = new Date(visit.date).toISOString().slice(0, 10);
  sendDocx(res, buffer, `Приём ${date}.docx`);
};

// GET /me/history/:visitId/referrals/:referralId.docx
exports.downloadReferral = async (req, res) => {
  const card = await ownCard(req);
  const visit = findVisit(card, req.params.visitId);
  const referral = mongoose.isValidObjectId(req.params.referralId)
    ? referralsOf(card, visit._id).find((item) => idOf(item._id) === req.params.referralId)
    : null;
  if (!referral) throw new ApiError(404, 'Направление не найдено');
  const buffer = await buildReferralDocx(card.toObject(), referral.toObject());
  sendDocx(res, buffer, `Направление ${referral.number}.docx`);
};
