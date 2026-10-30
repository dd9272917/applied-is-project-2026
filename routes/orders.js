const router = require('express').Router();
const { sql, poolPromise } = require('../db');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

const STATUSES = ['Новый', 'В дизайне', 'В печати', 'Готов', 'Выдан'];

// ---------- Список заказов ----------
// GET /api/orders?status=&q=
router.get('/', asyncHandler(async (req, res) => {
  const pool = await poolPromise;
  const like = `%${(req.query.q || '').trim()}%`;
  const request = pool.request().input('q', sql.NVarChar, like);
  let where = '(зк.ФИО LIKE @q OR CAST(з.ID_Заказа AS NVARCHAR) = @qExact)';
  request.input('qExact', sql.NVarChar, (req.query.q || '').trim());

  if (req.query.status) {
    where += ' AND з.Статус = @status';
    request.input('status', sql.NVarChar, req.query.status);
  }

  const result = await request.query(`
    SELECT з.ID_Заказа, з.Статус, з.Сумма, з.ДатаСоздания,
           зк.ФИО AS Заказчик, с.ФИО AS Сотрудник,
           ISNULL((SELECT SUM(Сумма) FROM Оплата o WHERE o.ID_Заказа = з.ID_Заказа), 0) AS Оплачено
    FROM Заказ з
    JOIN Заказчик зк ON зк.ID_Заказчика = з.ID_Заказчика
    JOIN Сотрудник с ON с.ID_Сотрудника = з.ID_Сотрудника
    WHERE ${where}
    ORDER BY з.ДатаСоздания DESC`);
  res.json(result.recordset);
}));

// ---------- Создание заказа ----------
router.post('/', asyncHandler(async (req, res) => {
  const { ID_Заказчика } = req.body;
  const ID_Сотрудника = req.user.ID_Сотрудника;
  if (!ID_Заказчика) throw new AppError(400, 'Выберите заказчика');
  if (!ID_Сотрудника) throw new AppError(400, 'Выберите сотрудника, оформляющего заказ');

  const pool = await poolPromise;
  const result = await pool.request()
    .input('ID_Заказчика', sql.Int, ID_Заказчика)
    .input('ID_Сотрудника', sql.Int, ID_Сотрудника)
    .query(`INSERT INTO Заказ (ID_Заказчика, ID_Сотрудника, ДатаСоздания, Статус, Сумма)
            OUTPUT INSERTED.*
            VALUES (@ID_Заказчика, @ID_Сотрудника, GETDATE(), N'Новый', 0)`);
  res.status(201).json(result.recordset[0]);
}));

// ---------- Удаление заказа и связанных записей ----------
router.delete('/:id', asyncHandler(async (req, res) => {
  const pool = await poolPromise;
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const order = await new sql.Request(tx)
      .input('id', sql.Int, req.params.id)
      .query('SELECT ID_Заказа FROM Заказ WHERE ID_Заказа=@id');
    if (!order.recordset.length) throw new AppError(404, 'Заказ не найден');

    // Вернуть на склад материалы, списанные на позиции этого заказа.
    await new sql.Request(tx)
      .input('id', sql.Int, req.params.id)
      .query(`UPDATE m
              SET m.Остаток = m.Остаток + r.Количество
              FROM Материал m
              JOIN Расход_материала r ON r.ID_Материала = m.ID_Материала
              JOIN Позиция_заказа p ON p.ID_Позиции = r.ID_Позиции
              WHERE p.ID_Заказа = @id`);

    await new sql.Request(tx).input('id', sql.Int, req.params.id)
      .query(`DELETE r FROM Расход_материала r
              JOIN Позиция_заказа p ON p.ID_Позиции = r.ID_Позиции
              WHERE p.ID_Заказа = @id`);
    await new sql.Request(tx).input('id', sql.Int, req.params.id)
      .query('DELETE FROM Позиция_заказа WHERE ID_Заказа=@id');
    await new sql.Request(tx).input('id', sql.Int, req.params.id)
      .query('DELETE FROM Оплата WHERE ID_Заказа=@id');
    await new sql.Request(tx).input('id', sql.Int, req.params.id)
      .query('DELETE FROM Макет WHERE ID_Заказа=@id');
    await new sql.Request(tx).input('id', sql.Int, req.params.id)
      .query('DELETE FROM Заказ WHERE ID_Заказа=@id');

    await tx.commit();
    res.status(204).end();
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}));

// ---------- Детальная карточка заказа ----------
router.get('/:id', asyncHandler(async (req, res) => {
  const pool = await poolPromise;
  const id = req.params.id;

  const orderQ = pool.request().input('id', sql.Int, id).query(`
    SELECT з.*, зк.ФИО AS Заказчик_ФИО, зк.Телефон AS Заказчик_Телефон, зк.Email AS Заказчик_Email,
           с.ФИО AS Сотрудник_ФИО
    FROM Заказ з
    JOIN Заказчик зк ON зк.ID_Заказчика = з.ID_Заказчика
    JOIN Сотрудник с ON с.ID_Сотрудника = з.ID_Сотрудника
    WHERE з.ID_Заказа = @id`);

  const positionsQ = pool.request().input('id', sql.Int, id).query(`
    SELECT п.ID_Позиции, п.ID_Услуги, у.Название AS Услуга, у.Тип, п.Количество, п.Стоимость
    FROM Позиция_заказа п
    JOIN Услуга у ON у.ID_Услуги = п.ID_Услуги
    WHERE п.ID_Заказа = @id
    ORDER BY п.ID_Позиции`);

  const materialsQ = pool.request().input('id', sql.Int, id).query(`
    SELECT р.ID_Расхода, р.ID_Позиции, р.ID_Материала, м.Название AS Материал, м.ЕдиницаИзм, р.Количество
    FROM Расход_материала р
    JOIN Материал м ON м.ID_Материала = р.ID_Материала
    JOIN Позиция_заказа п ON п.ID_Позиции = р.ID_Позиции
    WHERE п.ID_Заказа = @id
    ORDER BY р.ID_Расхода`);

  const paymentsQ = pool.request().input('id', sql.Int, id).query(`
    SELECT * FROM Оплата WHERE ID_Заказа = @id ORDER BY Дата`);

  const layoutsQ = pool.request().input('id', sql.Int, id).query(`
    SELECT м.*, с.ФИО AS Дизайнер
    FROM Макет м JOIN Сотрудник с ON с.ID_Сотрудника = м.ID_Дизайнера
    WHERE м.ID_Заказа = @id ORDER BY м.ID_Макета`);

  const [order, positions, materials, payments, layouts] = await Promise.all([
    orderQ, positionsQ, materialsQ, paymentsQ, layoutsQ
  ]);

  if (!order.recordset.length) throw new AppError(404, 'Заказ не найден');

  res.json({
    order: order.recordset[0],
    positions: positions.recordset,
    materials: materials.recordset,
    payments: payments.recordset,
    layouts: layouts.recordset
  });
}));

// ---------- Смена статуса заказа ----------
router.patch('/:id/status', asyncHandler(async (req, res) => {
  const { Статус } = req.body;
  if (!STATUSES.includes(Статус)) {
    throw new AppError(400, `Недопустимый статус. Допустимые значения: ${STATUSES.join(', ')}`);
  }
  const pool = await poolPromise;
  const result = await pool.request()
    .input('id', sql.Int, req.params.id)
    .input('Статус', sql.NVarChar, Статус)
    .query('UPDATE Заказ SET Статус=@Статус OUTPUT INSERTED.* WHERE ID_Заказа=@id');
  if (!result.recordset.length) throw new AppError(404, 'Заказ не найден');
  res.json(result.recordset[0]);
}));

// ---------- Добавление позиции (услуги) в заказ ----------
router.post('/:id/positions', asyncHandler(async (req, res) => {
  const { ID_Услуги, Количество } = req.body;
  const qty = Number(Количество);
  if (!ID_Услуги) throw new AppError(400, 'Выберите услугу');
  if (!Number.isInteger(qty) || qty <= 0) throw new AppError(400, 'Количество должно быть целым числом больше нуля');

  const pool = await poolPromise;
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const service = await new sql.Request(tx)
      .input('id', sql.Int, ID_Услуги)
      .query('SELECT Цена FROM Услуга WHERE ID_Услуги=@id');
    if (!service.recordset.length) throw new AppError(404, 'Услуга не найдена');

    const cost = Number(service.recordset[0].Цена) * qty;

    const inserted = await new sql.Request(tx)
      .input('ID_Заказа', sql.Int, req.params.id)
      .input('ID_Услуги', sql.Int, ID_Услуги)
      .input('Количество', sql.Int, qty)
      .input('Стоимость', sql.Decimal(10, 2), cost)
      .query(`INSERT INTO Позиция_заказа (ID_Заказа, ID_Услуги, Количество, Стоимость)
              OUTPUT INSERTED.*
              VALUES (@ID_Заказа, @ID_Услуги, @Количество, @Стоимость)`);

    await new sql.Request(tx)
      .input('id', sql.Int, req.params.id)
      .input('delta', sql.Decimal(10, 2), cost)
      .query('UPDATE Заказ SET Сумма = Сумма + @delta WHERE ID_Заказа=@id');

    await tx.commit();
    res.status(201).json(inserted.recordset[0]);
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}));

// ---------- Удаление позиции заказа ----------
router.delete('/:id/positions/:posId', asyncHandler(async (req, res) => {
  const pool = await poolPromise;
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const pos = await new sql.Request(tx)
      .input('posId', sql.Int, req.params.posId)
      .query('SELECT * FROM Позиция_заказа WHERE ID_Позиции=@posId');
    if (!pos.recordset.length) throw new AppError(404, 'Позиция не найдена');

    // возвращаем на склад списанные материалы этой позиции
    const mats = await new sql.Request(tx)
      .input('posId', sql.Int, req.params.posId)
      .query('SELECT * FROM Расход_материала WHERE ID_Позиции=@posId');
    for (const m of mats.recordset) {
      await new sql.Request(tx)
        .input('matId', sql.Int, m.ID_Материала)
        .input('qty', sql.Decimal(10, 2), m.Количество)
        .query('UPDATE Материал SET Остаток = Остаток + @qty WHERE ID_Материала=@matId');
    }
    await new sql.Request(tx).input('posId', sql.Int, req.params.posId)
      .query('DELETE FROM Расход_материала WHERE ID_Позиции=@posId');

    await new sql.Request(tx).input('posId', sql.Int, req.params.posId)
      .query('DELETE FROM Позиция_заказа WHERE ID_Позиции=@posId');

    await new sql.Request(tx)
      .input('id', sql.Int, req.params.id)
      .input('delta', sql.Decimal(10, 2), pos.recordset[0].Стоимость)
      .query('UPDATE Заказ SET Сумма = Сумма - @delta WHERE ID_Заказа=@id');

    await tx.commit();
    res.status(204).end();
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}));

// ---------- Списание материала на позицию заказа ----------
router.post('/:id/positions/:posId/materials', asyncHandler(async (req, res) => {
  const { ID_Материала, Количество } = req.body;
  const qty = Number(Количество);
  if (!ID_Материала) throw new AppError(400, 'Выберите материал');
  if (!Number.isFinite(qty) || qty <= 0) throw new AppError(400, 'Количество должно быть больше нуля');

  const pool = await poolPromise;
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const mat = await new sql.Request(tx)
      .input('id', sql.Int, ID_Материала)
      .query('SELECT * FROM Материал WHERE ID_Материала=@id');
    if (!mat.recordset.length) throw new AppError(404, 'Материал не найден');
    if (Number(mat.recordset[0].Остаток) < qty) {
      throw new AppError(400, `На складе недостаточно материала «${mat.recordset[0].Название}» (осталось ${mat.recordset[0].Остаток} ${mat.recordset[0].ЕдиницаИзм})`);
    }

    const inserted = await new sql.Request(tx)
      .input('ID_Позиции', sql.Int, req.params.posId)
      .input('ID_Материала', sql.Int, ID_Материала)
      .input('Количество', sql.Decimal(10, 2), qty)
      .query(`INSERT INTO Расход_материала (ID_Позиции, ID_Материала, Количество)
              OUTPUT INSERTED.* VALUES (@ID_Позиции, @ID_Материала, @Количество)`);

    await new sql.Request(tx)
      .input('id', sql.Int, ID_Материала)
      .input('qty', sql.Decimal(10, 2), qty)
      .query('UPDATE Материал SET Остаток = Остаток - @qty WHERE ID_Материала=@id');

    await tx.commit();
    res.status(201).json(inserted.recordset[0]);
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}));

// ---------- Отмена списания материала (возврат на склад) ----------
router.delete('/materials/:rid', asyncHandler(async (req, res) => {
  const pool = await poolPromise;
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const rec = await new sql.Request(tx)
      .input('rid', sql.Int, req.params.rid)
      .query('SELECT * FROM Расход_материала WHERE ID_Расхода=@rid');
    if (!rec.recordset.length) throw new AppError(404, 'Запись расхода не найдена');

    await new sql.Request(tx)
      .input('matId', sql.Int, rec.recordset[0].ID_Материала)
      .input('qty', sql.Decimal(10, 2), rec.recordset[0].Количество)
      .query('UPDATE Материал SET Остаток = Остаток + @qty WHERE ID_Материала=@matId');

    await new sql.Request(tx).input('rid', sql.Int, req.params.rid)
      .query('DELETE FROM Расход_материала WHERE ID_Расхода=@rid');

    await tx.commit();
    res.status(204).end();
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}));

// ---------- Оплата заказа ----------
router.post('/:id/payments', asyncHandler(async (req, res) => {
  const { Сумма, Тип, Способ } = req.body;
  const amount = Number(Сумма);
  if (!Number.isFinite(amount) || amount <= 0) throw new AppError(400, 'Сумма оплаты должна быть больше нуля');
  if (!Тип) throw new AppError(400, 'Укажите тип оплаты');
  if (!Способ) throw new AppError(400, 'Укажите способ оплаты');

  const pool = await poolPromise;

  const order = await pool.request().input('id', sql.Int, req.params.id)
    .query('SELECT Сумма FROM Заказ WHERE ID_Заказа=@id');
  if (!order.recordset.length) throw new AppError(404, 'Заказ не найден');

  const paidSoFar = await pool.request().input('id', sql.Int, req.params.id)
    .query('SELECT ISNULL(SUM(Сумма),0) AS Оплачено FROM Оплата WHERE ID_Заказа=@id');
  const remaining = Number(order.recordset[0].Сумма) - Number(paidSoFar.recordset[0].Оплачено);
  if (amount > remaining + 0.01) {
    throw new AppError(400, `Сумма превышает остаток к оплате (${remaining.toFixed(2)} ₸)`);
  }

  const result = await pool.request()
    .input('ID_Заказа', sql.Int, req.params.id)
    .input('Сумма', sql.Decimal(10, 2), amount)
    .input('Тип', sql.NVarChar, Тип)
    .input('Способ', sql.NVarChar, Способ)
    .query(`INSERT INTO Оплата (ID_Заказа, Сумма, Тип, Способ, Дата)
            OUTPUT INSERTED.* VALUES (@ID_Заказа, @Сумма, @Тип, @Способ, GETDATE())`);
  res.status(201).json(result.recordset[0]);
}));

// ---------- Макеты (дизайн-файлы) ----------
router.post('/:id/layouts', asyncHandler(async (req, res) => {
  const { ID_Дизайнера, ФайлМакета } = req.body;
  if (!ID_Дизайнера) throw new AppError(400, 'Выберите дизайнера');

  const pool = await poolPromise;
  const result = await pool.request()
    .input('ID_Заказа', sql.Int, req.params.id)
    .input('ID_Дизайнера', sql.Int, ID_Дизайнера)
    .input('ФайлМакета', sql.NVarChar, ФайлМакета || null)
    .query(`INSERT INTO Макет (ID_Заказа, ID_Дизайнера, ФайлМакета, Статус)
            OUTPUT INSERTED.* VALUES (@ID_Заказа, @ID_Дизайнера, @ФайлМакета, N'В работе')`);
  res.status(201).json(result.recordset[0]);
}));

router.patch('/layouts/:id', asyncHandler(async (req, res) => {
  const { Статус } = req.body;
  const allowed = ['В работе', 'На согласовании', 'Утверждён'];
  if (!allowed.includes(Статус)) throw new AppError(400, `Допустимые статусы макета: ${allowed.join(', ')}`);

  const pool = await poolPromise;
  const result = await pool.request()
    .input('id', sql.Int, req.params.id)
    .input('Статус', sql.NVarChar, Статус)
    .query('UPDATE Макет SET Статус=@Статус OUTPUT INSERTED.* WHERE ID_Макета=@id');
  if (!result.recordset.length) throw new AppError(404, 'Макет не найден');
  res.json(result.recordset[0]);
}));

module.exports = router;
