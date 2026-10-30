// Отдельная учебная БД для лабораторных 1 и 2. Рабочая БД не изменяется.
const fs = require('node:fs');
const path = require('node:path');
const sql = require('mssql');
require('dotenv').config();

const database = 'PhotoCenterLab12';
const setup = process.argv.includes('--setup');
const config = {
  server: process.env.DB_SERVER || 'localhost',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD,
  port: 1433,
  database: 'master',
  options: { encrypt: false, trustServerCertificate: true }
};

async function executeFile(pool, name) {
  const text = fs.readFileSync(path.join(__dirname, '../labs/sql', name), 'utf8');
  for (const batch of text.replace(/^\uFEFF/, '').split(/^\s*GO\s*$/mi)) {
    if (batch.trim()) await pool.request().batch(batch);
  }
}

async function main() {
  let pool;
  try {
    pool = await new sql.ConnectionPool(config).connect();
    const exists = await pool.request().input('name', sql.NVarChar, database)
      .query('SELECT DB_ID(@name) AS id');
    if (setup) {
      if (exists.recordset[0].id !== null) {
        throw new Error('Учебная БД уже существует. Для проверки запустите без --setup.');
      }
      await executeFile(pool, '01-create-lab.sql');
      console.log('Учебная база создана.');
    } else if (exists.recordset[0].id === null) {
      throw new Error('Учебная БД отсутствует. Для создания используйте --setup.');
    }
    await pool.close();
    pool = await new sql.ConnectionPool({ ...config, database }).connect();
    if (setup) await executeFile(pool, '02-seed-lab.sql');
    const tables = await pool.request().query(
      "SELECT name FROM sys.tables WHERE schema_id=SCHEMA_ID('dbo') ORDER BY name"
    );
    if (tables.recordset.length !== 9) throw new Error('Ожидалось 9 таблиц.');
    let total = 0;
    for (const { name } of tables.recordset) {
      const result = await pool.request().query(`SELECT COUNT(*) AS n FROM dbo.[${name.replace(/]/g, ']]')}]`);
      const count = result.recordset[0].n;
      console.log(`${name}: ${count}`);
      if (count !== 3) throw new Error(`Ожидалось 3 записи в таблице ${name}.`);
      total += count;
    }
    const keys = await pool.request().query('SELECT is_disabled, is_not_trusted FROM sys.foreign_keys');
    if (keys.recordset.length !== 9 || keys.recordset.some(k => k.is_disabled || k.is_not_trusted)) {
      throw new Error('Проверка девяти внешних ключей не пройдена.');
    }
    const constraints = await pool.request().query('DBCC CHECKCONSTRAINTS WITH ALL_CONSTRAINTS');
    if (constraints.recordset?.length) throw new Error('Обнаружено нарушение ограничений.');
    const sums = await pool.request().query(`
      SELECT з.ID_Заказа FROM dbo.Заказ з
      JOIN dbo.Позиция_заказа п ON п.ID_Заказа=з.ID_Заказа
      GROUP BY з.ID_Заказа, з.Сумма HAVING з.Сумма<>SUM(п.Стоимость)`);
    if (sums.recordset.length) throw new Error('Не совпадают суммы заказов и позиций.');
    console.log(`PASS: ${tables.recordset.length} таблиц, ${total} строк, 9 внешних ключей; ограничения и суммы корректны.`);
  } finally {
    if (pool) await pool.close();
  }
}

main().catch(error => {
  console.error('Проверка не завершена:', error.message);
  process.exitCode = 1;
});
