// Проверка настроек почты: npm run mail:check
// Подключается к SMTP, авторизуется и отправляет тестовое письмо на SMTP_USER.
const { verifyConnection, sendTestEmail } = require('../services/mailer');
const { smtp } = require('../config/auth');

(async () => {
  try {
    console.log(`SMTP: ${smtp.host}:${smtp.port} (secure=${smtp.secure}), пользователь ${smtp.user || '(не задан)'}`);
    await verifyConnection();
    console.log('SMTP: подключение и авторизация успешны');
    await sendTestEmail();
    console.log(`SMTP: тестовое письмо отправлено на ${smtp.user}`);
  } catch (err) {
    console.error(`SMTP: ошибка - ${err.message}`);
    process.exit(1);
  }
})();
