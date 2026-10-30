const fs = require('node:fs');
const path = require('node:path');
const { poolPromise } = require('../db');
(async () => {
  let pool;
  try {
    pool = await poolPromise;
    await pool.request().query(fs.readFileSync(path.join(__dirname, '../migrations/001-password-length.sql'), 'utf8'));
    const result = await pool.request().query("SELECT CHARACTER_MAXIMUM_LENGTH AS Capacity FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=N'dbo' AND TABLE_NAME=N'Сотрудник' AND COLUMN_NAME=N'Пароль'");
    const length = result.recordset[0]?.Capacity;
    if (length !== -1 && !(length >= 255)) throw new Error('Размер поля пароля не обновлён. Проверьте схему таблицы.');
    console.log('Готово: поле пароля поддерживает защищённые хеши. Существующие данные сохранены.');
  } catch (error) {
    console.error('Ошибка обновления:', error.message);
    process.exitCode = 1;
  } finally { if (pool) await pool.close(); }
})();
