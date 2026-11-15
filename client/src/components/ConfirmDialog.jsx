import Button from '../ui/Button';
import Modal from '../ui/Modal';

export default function ConfirmDialog({ open, title, children, confirmLabel = 'Подтвердить', danger = false, onConfirm, onClose }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button>
        </>
      )}
    >
      {children}
    </Modal>
  );
}
