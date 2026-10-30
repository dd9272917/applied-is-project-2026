const router = require('express').Router();
const { sql, poolPromise } = require('../db');
const asyncHandler = require('../utils/asyncHandler');

// Справочник сотрудников для назначения дизайнера. Автор заказа
// определяется сервером по сессии; пароли никогда не возвращаются клиенту.
router.get('/', asyncHandler(async (req, res) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .query('SELECT ID_Сотрудника, ФИО, Роль FROM Сотрудник ORDER BY ФИО');
  res.json(result.recordset);
}));

module.exports = router;
