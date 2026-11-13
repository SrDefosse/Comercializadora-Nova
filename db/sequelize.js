import '../config/cargar-env.js';
import { Sequelize } from 'sequelize';

const url = process.env.DATABASE_URL;
if (!url || !/^postgres(?:ql)?:\/\//i.test(url)) {
  throw new Error('Configura DATABASE_URL con la URL de PostgreSQL en el .env.');
}

export const sequelize = new Sequelize(url, {
  dialect: 'postgres',
  logging: process.env.SQL_LOG === 'true' ? console.log : false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  dialectOptions: process.env.PGSSL === 'true'
    ? {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
    : {}
});
