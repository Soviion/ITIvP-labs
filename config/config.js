require('dotenv').config({ quiet: true });


const url = (process.env.DATABASE_URL || '').replace(/^postgres(?:ql)?(?:\+\w+)?:/, 'postgres:');

const common = {
  url,
  dialect: 'postgres',
  logging: process.env.DB_LOGGING === 'true' ? console.log : false,
  typeValidation: true, // проверяет типы перед отправкой в бд
  dialectOptions: process.env.DB_SSL === 'true'
    ? { ssl: { require: true, rejectUnauthorized: false } }
    : {},
};

module.exports = {
  development: { ...common },
  production: { ...common },
};
