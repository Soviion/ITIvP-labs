// Маленькие общие элементы кабинета врача: инициалы пациента и статус записи
import { STATUS_LABELS } from '../../constants';
import { fetchPatientAvatarBlob } from '../../doctorApi';
import Avatar from '../../ui/Avatar';

// Аватар пациента: стикер, своё фото (скачивается с токеном врача) или инициалы
export function PatientMark({ patient, size = 36 }) {
  return (
    <Avatar
      avatar={patient.avatar}
      name={patient.fullName}
      size={size}
      photoKey={`patient-${patient.id}`}
      fetchPhoto={() => fetchPatientAvatarBlob(patient.id)}
    />
  );
}

export function StatusTag({ status }) {
  return <span className={`dr-status dr-status-${status}`}>{STATUS_LABELS[status] ?? status}</span>;
}
