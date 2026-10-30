const router = require('express').Router();
const { sql, poolPromise } = require('../db');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

function validateService(body) {
  const errors = {};
  if (!body.Название || !body.Название.trim()) errors.Название = 'Укажите название услуги';
  if (!body.Тип || !body.Тип.trim()) errors.Тип = 'Укажите тип услуги';
  const price = Number(body.Цена);
  if (!Number.isFinite(price) || price <= 0) errors.Цена = 'Цена должна быть положительным числом';
  return errors;
}

router.get('/', asyncHandler(async (req, res) => {
  const pool = await poolPromise;
  const result = await pool.request().query('SELECT * FROM Услуга ORDER BY Тип, Название');
  res.json(result.recordset);
}));

router.post('/', asyncHandler(async (req, res) => {
  const errors = validateService(req.body);
  if (Object.keys(errors).length) return res.status(400).json({ error: true, fields: errors });

  const pool = await poolPromise;
  const result = await pool.request()
    .input('Название', sql.NVarChar, req.body.Название.trim())
    .input('Тип', sql.NVarChar, req.body.Тип.trim())
    .input('Цена', sql.Decimal(10, 2), Number(req.body.Цена))
    .query(`INSERT INTO Услуга (Название, Тип, Цена)
            OUTPUT INSERTED.* VALUES (@Название, @Тип, @Цена)`);
  res.status(201).json(result.recordset[0]);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const errors = validateService(req.body);
  if (Object.keys(errors).length) return res.status(400).json({ error: true, fields: errors });

  const pool = await poolPromise;
  const result = await pool.request()
    .input('id', sql.Int, req.params.id)
    .input('Название', sql.NVarChar, req.body.Название.trim())
    .input('Тип', sql.NVarChar, req.body.Тип.trim())
    .input('Цена', sql.Decimal(10, 2), Number(req.body.Цена))
    .query(`UPDATE Услуга SET Название=@Название, Тип=@Тип, Цена=@Цена
            OUTPUT INSERTED.* WHERE ID_Услуги=@id`);
  if (!result.recordset.length) throw new AppError(404, 'Услуга не найдена');
  res.json(result.recordset[0]);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const pool = await poolPromise;
  const inUse = await pool.request()
    .input('id', sql.Int, req.params.id)
    .query('SELECT COUNT(*) AS c FROM Позиция_заказа WHERE ID_Услуги=@id');
  if (inUse.recordset[0].c > 0) {
    throw new AppError(409, 'Нельзя удалить услугу — она используется в заказах');
  }
  await pool.request().input('id', sql.Int, req.params.id)
    .query('DELETE FROM Услуга WHERE ID_Услуги=@id');
  res.status(204).end();
}));

module.exports = router;
