const { User, Doctor, Specialty } = require('../models');

// Подключается после auth и requireRole('doctor'): находит врача, к которому привязан аккаунт, и кладёт его в req.doctor.
// Администратор и врач, которого пригласили по e-mail и у которого ещё нет карточки в справочнике, получают «пустого» врача:
// у него нет записей, но кабинет открывается (профиль можно будет заполнить позже).
module.exports = async function loadDoctor(req, res, next) {
  try {
    const user = await User.findByPk(req.user.id, { attributes: ['id', 'email', 'role', 'doctorId'] });

    if (user?.role === 'admin') {
      req.doctor = { id: null, fullName: 'Администратор', specialty: { name: 'Полный доступ' }, isAdmin: true, email: user.email };
      return next();
    }

    const doctor = user?.doctorId
      ? await Doctor.findByPk(user.doctorId, { include: [{ model: Specialty, as: 'specialty', attributes: ['id', 'name'] }] })
      : null;

    req.doctor = doctor ?? { id: null, fullName: user?.email.split('@')[0] ?? 'Врач', specialty: null, isEmpty: true, email: user?.email };
    return next();
  } catch (err) {
    return next(err);
  }
};
