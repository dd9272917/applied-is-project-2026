const router = require('express').Router();
const { sql, poolPromise } = require('../db');
const asyncHandler = require('../utils/asyncHandler');

router.get('/', asyncHandler(async (req, res) => {
  const pool = await poolPromise;

  const ordersQ = pool.request().query(`
    SELECT з.ID_Заказа, з.Статус, з.Сумма, з.ДатаСоздания, зк.ФИО AS Заказчик,
           ISNULL((SELECT SUM(Сумма) FROM Оплата o WHERE o.ID_Заказа = з.ID_Заказа), 0) AS Оплачено
    FROM Заказ з JOIN Заказчик зк ON зк.ID_Заказчика = з.ID_Заказчика
    ORDER BY з.ДатаСоздания DESC`);

  const revenueTodayQ = pool.request().query(`
    SELECT ISNULL(SUM(Сумма), 0) AS Выручка FROM Оплата
    WHERE CAST(Дата AS DATE) = CAST(GETDATE() AS DATE)`);

  const lowStockQ = pool.request().query(`
    SELECT * FROM Материал WHERE Остаток <= 20 ORDER BY Остаток`);

  const [orders, revenueToday, lowStock] = await Promise.all([ordersQ, revenueTodayQ, lowStockQ]);

  const inWork = orders.recordset.filter(o => o.Статус !== 'Выдан').length;

  res.json({
    ordersInWork: inWork,
    revenueToday: revenueToday.recordset[0].Выручка,
    lowStock: lowStock.recordset,
    orders: orders.recordset
  });
}));

module.exports = router;
