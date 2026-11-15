const { User } = require('../models');
const ApiError = require('../utils/ApiError');

// GET /profile — данные текущего пользователя (id берётся из проверенного JWT)
exports.getProfile = async (req, res) => {
  const user = await User.findByPk(req.user.id);
  if (!user) {
    throw new ApiError(404, 'Пользователь не найден');
  }

  res.json({
    user,
    token: {
      issuedAt: new Date(req.user.iat * 1000).toISOString(),
      expiresAt: new Date(req.user.exp * 1000).toISOString(),
    },
  });
};
