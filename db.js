// Слой доступа к данным: единая точка управления подключением к SQL Server.
// Пул подключений открывается один раз при старте и переиспользуется
// всеми компонентами доступа к данным (routes/*) — см. лаб. 4 методички
// (рекомендации по управлению подключениями).

require('dotenv').config();
const mssql = require('mssql');

const config = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER || 'localhost',
  port: 1433,
  database: process.env.DB_DATABASE || 'photocenter',
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

const poolPromise = new mssql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log('✅ Успешное подключение к MS SQL Server!');
    return pool;
  })
  .catch(err => {
    console.error('[БД] Ошибка подключения к SQL Server:', err.message);
    throw err;
  });

// Keep the interface available when the database is offline. Routes still
// receive the original rejection through their centralized error handler.
poolPromise.catch(() => {});

module.exports = {
  sql: mssql,
  poolPromise
};
