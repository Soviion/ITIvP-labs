// Реквизиты учреждения для шапок документов. Название и контакты можно переопределить в .env.
module.exports = {
  name: process.env.CLINIC_NAME || 'Моя клиника',
  address: process.env.CLINIC_ADDRESS || 'г. Минск, ул. Примерная, 1',
  phone: process.env.CLINIC_PHONE || '+375 (17) 000-00-00',
};
