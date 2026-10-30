USE PhotoCenterLab12;
GO
IF DB_NAME() <> N'PhotoCenterLab12'
    THROW 51002, N'Выбрана неверная база данных. Выполнение остановлено.', 1;
SET XACT_ABORT ON;
BEGIN TRY
BEGIN TRANSACTION;
IF EXISTS (SELECT 1 FROM dbo.Сотрудник) OR EXISTS (SELECT 1 FROM dbo.Заказчик)
 OR EXISTS (SELECT 1 FROM dbo.Услуга) OR EXISTS (SELECT 1 FROM dbo.Материал)
 OR EXISTS (SELECT 1 FROM dbo.Заказ) OR EXISTS (SELECT 1 FROM dbo.Позиция_заказа)
 OR EXISTS (SELECT 1 FROM dbo.Расход_материала) OR EXISTS (SELECT 1 FROM dbo.Макет)
 OR EXISTS (SELECT 1 FROM dbo.Оплата)
    THROW 51001, N'Посев рассчитан на пустую учебную БД.', 1;
INSERT dbo.Сотрудник (ФИО,Роль,Логин,Пароль) VALUES
(N'Иванова Мария',N'Приёмщик',N'lab_ivanova',N'demo'),
(N'Петров Алексей',N'Дизайнер',N'lab_petrov',N'demo'),
(N'Сидорова Ольга',N'Кассир',N'lab_sidorova',N'demo');
INSERT dbo.Заказчик (ФИО,Телефон,Email) VALUES
(N'Анна Смирнова',N'+7 700 000 00 01',N'anna@example.com'),
(N'Дмитрий Кузнецов',N'+7 700 000 00 02',N'dmitry@example.com'),
(N'ТОО Учебный пример',N'+7 700 000 00 03',N'office@example.com');
INSERT dbo.Услуга (Название,Тип,Цена) VALUES
(N'Печать фото 10x15',N'Фотопечать',15.00),
(N'Разработка визитки',N'Дизайн',800.00),
(N'Ламинация A4',N'Полиграфия',50.00);
INSERT dbo.Материал (Название,ЕдиницаИзм,Остаток) VALUES
(N'Фотобумага 10x15',N'лист',490),
(N'Визитная бумага',N'лист',399),
(N'Плёнка A4',N'лист',148);
-- Идентификаторы извлекаются по уникальному логину и учебным именам.
DECLARE @s int=(SELECT ID_Сотрудника FROM dbo.Сотрудник WHERE Логин=N'lab_ivanova');
DECLARE @d int=(SELECT ID_Сотрудника FROM dbo.Сотрудник WHERE Логин=N'lab_petrov');
DECLARE @c1 int=(SELECT ID_Заказчика FROM dbo.Заказчик WHERE Email=N'anna@example.com');
DECLARE @c2 int=(SELECT ID_Заказчика FROM dbo.Заказчик WHERE Email=N'dmitry@example.com');
DECLARE @c3 int=(SELECT ID_Заказчика FROM dbo.Заказчик WHERE Email=N'office@example.com');
DECLARE @o1 int, @o2 int, @o3 int, @p1 int, @p2 int, @p3 int;
INSERT dbo.Заказ (ID_Заказчика,ID_Сотрудника,Статус,Сумма) VALUES (@c1,@s,N'Готов',150);
SET @o1=CONVERT(int,SCOPE_IDENTITY());
INSERT dbo.Заказ (ID_Заказчика,ID_Сотрудника,Статус,Сумма) VALUES (@c2,@s,N'В дизайне',800);
SET @o2=CONVERT(int,SCOPE_IDENTITY());
INSERT dbo.Заказ (ID_Заказчика,ID_Сотрудника,Статус,Сумма) VALUES (@c3,@s,N'Новый',100);
SET @o3=CONVERT(int,SCOPE_IDENTITY());
INSERT dbo.Позиция_заказа (ID_Заказа,ID_Услуги,Количество,Стоимость)
SELECT @o1,ID_Услуги,10,150 FROM dbo.Услуга WHERE Название=N'Печать фото 10x15';
SET @p1=CONVERT(int,SCOPE_IDENTITY());
INSERT dbo.Позиция_заказа (ID_Заказа,ID_Услуги,Количество,Стоимость)
SELECT @o2,ID_Услуги,1,800 FROM dbo.Услуга WHERE Название=N'Разработка визитки';
SET @p2=CONVERT(int,SCOPE_IDENTITY());
INSERT dbo.Позиция_заказа (ID_Заказа,ID_Услуги,Количество,Стоимость)
SELECT @o3,ID_Услуги,2,100 FROM dbo.Услуга WHERE Название=N'Ламинация A4';
SET @p3=CONVERT(int,SCOPE_IDENTITY());
INSERT dbo.Расход_материала (ID_Позиции,ID_Материала,Количество)
SELECT @p1,ID_Материала,10 FROM dbo.Материал WHERE Название=N'Фотобумага 10x15';
INSERT dbo.Расход_материала (ID_Позиции,ID_Материала,Количество)
SELECT @p2,ID_Материала,1 FROM dbo.Материал WHERE Название=N'Визитная бумага';
INSERT dbo.Расход_материала (ID_Позиции,ID_Материала,Количество)
SELECT @p3,ID_Материала,2 FROM dbo.Материал WHERE Название=N'Плёнка A4';
INSERT dbo.Макет (ID_Заказа,ID_Дизайнера,ФайлМакета,Статус) VALUES
(@o1,@d,N'photo-demo.jpg',N'Согласован'),
(@o2,@d,N'card-demo.pdf',N'В работе'),
(@o3,@d,N'lamination-demo.pdf',N'В работе');
INSERT dbo.Оплата (ID_Заказа,Сумма,Тип,Способ) VALUES
(@o1,150,N'Полная',N'Карта'),
(@o2,400,N'Предоплата',N'Перевод'),
(@o3,100,N'Полная',N'Наличные');
COMMIT;
END TRY
BEGIN CATCH
IF @@TRANCOUNT > 0 ROLLBACK;
THROW;
END CATCH;
GO
IF DB_NAME() <> N'PhotoCenterLab12'
    THROW 51002, N'Выбрана неверная база данных. Выполнение остановлено.', 1;

