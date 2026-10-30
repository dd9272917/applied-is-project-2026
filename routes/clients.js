const router = require('express').Router();
const { sql, poolPromise } = require('../db');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

function validateClient(body) {
  const errors = {};
  if (!body.ФИО || !body.ФИО.trim()) errors.ФИО = 'Укажите ФИО заказчика';
  if (body.Телефон && !/^[0-9+()\-\s]{5,20}$/.test(body.Телефон)) {
    errors.Телефон = 'Телефон указан в неверном формате';
  }
  if (body.Email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.Email)) {
    errors.Email = 'Введите корректный e-mail';
  }
  return errors;
}

// GET /api/clients?q=поиск
router.get('/', asyncHandler(async (req, res) => {
  const pool = await poolPromise;
  const like = `%${(req.query.q || '').trim()}%`;
  const result = await pool.request()
    .input('q', sql.NVarChar, like)
    .query(`SELECT ID_Заказчика, ФИО, Телефон, Email FROM Заказчик
            WHERE ФИО LIKE @q OR Телефон LIKE @q OR Email LIKE @q
            ORDER BY ФИО`);
  res.json(result.recordset);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('id', sql.Int, req.params.id)
    .query('SELECT * FROM Заказчик WHERE ID_Заказчика = @id');
  if (!result.recordset.length) throw new AppError(404, 'Заказчик не найден');
  res.json(result.recordset[0]);
}));

router.post('/', asyncHandler(async (req, res) => {
  const errors = validateClient(req.body);
  if (Object.keys(errors).length) return res.status(400).json({ error: true, fields: errors });

  const pool = await poolPromise;
  const result = await pool.request()
    .input('ФИО', sql.NVarChar, req.body.ФИО.trim())
    .input('Телефон', sql.NVarChar, req.body.Телефон || null)
    .input('Email', sql.NVarChar, req.body.Email || null)
    .query(`INSERT INTO Заказчик (ФИО, Телефон, Email)
            OUTPUT INSERTED.*
            VALUES (@ФИО, @Телефон, @Email)`);
  res.status(201).json(result.recordset[0]);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const errors = validateClient(req.body);
  if (Object.keys(errors).length) return res.status(400).json({ error: true, fields: errors });

  const pool = await poolPromise;
  const result = await pool.request()
    .input('id', sql.Int, req.params.id)
    .input('ФИО', sql.NVarChar, req.body.ФИО.trim())
    .input('Телефон', sql.NVarChar, req.body.Телефон || null)
    .input('Email', sql.NVarChar, req.body.Email || null)
    .query(`UPDATE Заказчик SET ФИО=@ФИО, Телефон=@Телефон, Email=@Email
            OUTPUT INSERTED.*
            WHERE ID_Заказчика=@id`);
  if (!result.recordset.length) throw new AppError(404, 'Заказчик не найден');
  res.json(result.recordset[0]);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const pool = await poolPromise;
  const inUse = await pool.request()
    .input('id', sql.Int, req.params.id)
    .query('SELECT COUNT(*) AS c FROM Заказ WHERE ID_Заказчика=@id');
  if (inUse.recordset[0].c > 0) {
    throw new AppError(409, 'Нельзя удалить заказчика — на него оформлены заказы');
  }
  await pool.request().input('id', sql.Int, req.params.id)
    .query('DELETE FROM Заказчик WHERE ID_Заказчика=@id');
  res.status(204).end();
}));

module.exports = router;
