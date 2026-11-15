const OTPAuth = require('otpauth');
const QRCode = require('qrcode');
const { Op } = require('sequelize');
const { User } = require('../models');
const { twoFactor } = require('../config/auth');
const { decrypt } = require('../utils/crypto');

// Google Authenticator — обычный TOTP - Time-based One-Time Password 6 цифр раз в 30 секунл
function buildTotp(base32Secret, accountName) {
  return new OTPAuth.TOTP({
    issuer: twoFactor.issuer,
    label: accountName,
    algorithm: 'SHA1',
    digits: twoFactor.digits,
    period: twoFactor.period,
    secret: OTPAuth.Secret.fromBase32(base32Secret),
  });
}

const generateSecret = () => new OTPAuth.Secret({ size: 20 }).base32;

// otpauth://totp/Clinic%20API:user@mail.com?secret=...&issuer=Clinic%20API
const buildOtpauthUri = (secret, accountName) => buildTotp(secret, accountName).toString();

const toQrDataUrl = (uri) => QRCode.toDataURL(uri, { margin: 2, width: 300 });
const toQrPng = (uri) => QRCode.toBuffer(uri, { margin: 2, width: 300 });

const currentStep = () => Math.floor(Date.now() / 1000 / twoFactor.period);

async function verifyUserCode(user, code) {
  const secret = decrypt(user.twoFactorSecret);
  const delta = buildTotp(secret, user.email).validate({ token: code, window: twoFactor.window });
  if (delta === null) return 'invalid';

  const step = currentStep() + delta;
  // условное обновление атомарно: два одновременных запроса с одним кодом не пройдут оба
  const [updated] = await User.update(
    { twoFactorLastStep: step },
    {
      where: {
        id: user.id,
        [Op.or]: [{ twoFactorLastStep: null }, { twoFactorLastStep: { [Op.lt]: step } }],
      },
    },
  );
  return updated ? 'ok' : 'replay';
}

module.exports = { generateSecret, buildOtpauthUri, toQrDataUrl, toQrPng, verifyUserCode };
