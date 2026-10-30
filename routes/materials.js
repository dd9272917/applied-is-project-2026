const router = require('express').Router();
const { sql, poolPromise } = require('../db');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

const LOW_STOCK_THRESHOLD = 20;

function validateMaterial(body) {
  const errors = {};
  if (!body.Название || !body.Название.trim()) errors.Название = 'Укажите название материала';
  if (!body.ЕдиницаИзм || !body.ЕдиницаИзм.trim()) errors.ЕдиницаИзм = 'Укажите единицу измерения';
  const stock = Number(body.Остаток);
  if (!Number.isFinite(stock) || stock < 0) errors.Остаток = 'Остаток не может быть отрицательным';
  return errors;
}

router.get('/', asyncHandler(async (req, res) => {
  const pool = await poolPromise;
  const result = await pool.request().query('SELECT * FROM Материал ORDER BY Название');
  const data = result.recordset.map(m => ({ ...m, НизкийОстаток: m.Остаток <= LOW_STOCK_THRESHOLD }));
  res.json(data);
}));

router.post('/', asyncHandler(async (req, res) => {
  const errors = validateMaterial(req.body);
  if (Object.keys(errors).length) return res.status(400).json({ error: true, fields: errors });

  const pool = await poolPromise;
  const result = await pool.request()
    .input('Название', sql.NVarChar, req.body.Название.trim())
    .input('ЕдиницаИзм', sql.NVarChar, req.body.ЕдиницаИзм.trim())
    .input('Остаток', sql.Decimal(10, 2), Number(req.body.Остаток) || 0)
    .query(`INSERT INTO Материал (Название, ЕдиницаИзм, Остаток)
            OUTPUT INSERTED.* VALUES (@Название, @ЕдиницаИзм, @Остаток)`);
  res.status(201).json(result.recordset[0]);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const errors = validateMaterial(req.body);
  if (Object.keys(errors).length) return res.status(400).json({ error: true, fields: errors });

  const pool = await poolPromise;
  const result = await pool.request()
    .input('id', sql.Int, req.params.id)
    .input('Название', sql.NVarChar, req.body.Название.trim())
    .input('ЕдиницаИзм', sql.NVarChar, req.body.ЕдиницаИзм.trim())
    .input('Остаток', sql.Decimal(10, 2), Number(req.body.Остаток))
    .query(`UPDATE Материал SET Название=@Название, ЕдиницаИзм=@ЕдиницаИзм, Остаток=@Остаток
            OUTPUT INSERTED.* WHERE ID_Материала=@id`);
  if (!result.recordset.length) throw new AppError(404, 'Материал не найден');
  res.json(result.recordset[0]);
}));

// Пополнение / списание остатка вручную (например, поступление партии бумаги)
router.patch('/:id/stock', asyncHandler(async (req, res) => {
  const delta = Number(req.body.Дельта);
  if (!Number.isFinite(delta) || delta === 0) {
    throw new AppError(400, 'Укажите ненулевое числовое значение изменения остатка');
  }
  const pool = await poolPromise;
  const current = await pool.request().input('id', sql.Int, req.params.id)
    .query('SELECT Остаток FROM Материал WHERE ID_Материала=@id');
  if (!current.recordset.length) throw new AppError(404, 'Материал не найден');

  const newStock = Number(current.recordset[0].Остаток) + delta;
  if (newStock < 0) throw new AppError(400, 'На складе недостаточно материала для списания такого количества');

  const result = await pool.request()
    .input('id', sql.Int, req.params.id)
    .input('Остаток', sql.Decimal(10, 2), newStock)
    .query('UPDATE Материал SET Остаток=@Остаток OUTPUT INSERTED.* WHERE ID_Материала=@id');
  res.json(result.recordset[0]);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const pool = await poolPromise;
  const inUse = await pool.request()
    .input('id', sql.Int, req.params.id)
    .query('SELECT COUNT(*) AS c FROM Расход_материала WHERE ID_Материала=@id');
  if (inUse.recordset[0].c > 0) {
    throw new AppError(409, 'Нельзя удалить материал — он уже использован в заказах');
  }
  await pool.request().input('id', sql.Int, req.params.id)
    .query('DELETE FROM Материал WHERE ID_Материала=@id');
  res.status(204).end();
}));

module.exports = router;
