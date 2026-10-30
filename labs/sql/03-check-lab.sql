USE PhotoCenterLab12;
GO
IF DB_NAME() <> N'PhotoCenterLab12'
    THROW 51002, N'Выбрана неверная база данных. Выполнение остановлено.', 1;
SELECT N'Сотрудник' AS Таблица, COUNT(*) AS Записей FROM dbo.Сотрудник
UNION ALL
SELECT N'Заказчик' AS Таблица, COUNT(*) AS Записей FROM dbo.Заказчик
UNION ALL
SELECT N'Услуга' AS Таблица, COUNT(*) AS Записей FROM dbo.Услуга
UNION ALL
SELECT N'Материал' AS Таблица, COUNT(*) AS Записей FROM dbo.Материал
UNION ALL
SELECT N'Заказ' AS Таблица, COUNT(*) AS Записей FROM dbo.Заказ
UNION ALL
SELECT N'Позиция_заказа' AS Таблица, COUNT(*) AS Записей FROM dbo.Позиция_заказа
UNION ALL
SELECT N'Расход_материала' AS Таблица, COUNT(*) AS Записей FROM dbo.Расход_материала
UNION ALL
SELECT N'Макет' AS Таблица, COUNT(*) AS Записей FROM dbo.Макет
UNION ALL
SELECT N'Оплата' AS Таблица, COUNT(*) AS Записей FROM dbo.Оплата;

DBCC CHECKCONSTRAINTS WITH ALL_CONSTRAINTS;

SELECT fk.name AS ВнешнийКлюч, OBJECT_NAME(fk.parent_object_id) AS ДочерняяТаблица,
OBJECT_NAME(fk.referenced_object_id) AS РодительскаяТаблица,
fk.is_disabled, fk.is_not_trusted FROM sys.foreign_keys AS fk;

SELECT з.ID_Заказа, зк.ФИО, з.Сумма,
SUM(п.Стоимость) AS СуммаПозиций,
з.Сумма-SUM(п.Стоимость) AS Разница
FROM dbo.Заказ з JOIN dbo.Заказчик зк ON зк.ID_Заказчика=з.ID_Заказчика
JOIN dbo.Позиция_заказа п ON п.ID_Заказа=з.ID_Заказа
GROUP BY з.ID_Заказа, зк.ФИО, з.Сумма;
-- Ожидается: 9 таблиц по 3 записи, 9 внешних ключей,
-- пустой результат DBCC, нулевая разница сумм для каждого заказа.

