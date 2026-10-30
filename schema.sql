-- =========================================================
-- АРМ фотоцентра и полиграфических услуг — схема БД
-- Соответствует ER-диаграмме проекта (SSMS).
-- Если таблицы уже созданы у вас в SSMS — просто проверьте,
-- что имена столбцов совпадают, и пропустите этот скрипт.
-- =========================================================

IF DB_ID('PhotoCenterDB') IS NULL
    CREATE DATABASE PhotoCenterDB;
GO
USE PhotoCenterDB;
GO

IF OBJECT_ID('dbo.Расход_материала', 'U') IS NOT NULL DROP TABLE dbo.Расход_материала;
IF OBJECT_ID('dbo.Макет', 'U') IS NOT NULL DROP TABLE dbo.Макет;
IF OBJECT_ID('dbo.Оплата', 'U') IS NOT NULL DROP TABLE dbo.Оплата;
IF OBJECT_ID('dbo.Позиция_заказа', 'U') IS NOT NULL DROP TABLE dbo.Позиция_заказа;
IF OBJECT_ID('dbo.Заказ', 'U') IS NOT NULL DROP TABLE dbo.Заказ;
IF OBJECT_ID('dbo.Материал', 'U') IS NOT NULL DROP TABLE dbo.Материал;
IF OBJECT_ID('dbo.Услуга', 'U') IS NOT NULL DROP TABLE dbo.Услуга;
IF OBJECT_ID('dbo.Заказчик', 'U') IS NOT NULL DROP TABLE dbo.Заказчик;
IF OBJECT_ID('dbo.Сотрудник', 'U') IS NOT NULL DROP TABLE dbo.Сотрудник;
GO

CREATE TABLE dbo.Сотрудник (
    ID_Сотрудника INT IDENTITY(1,1) PRIMARY KEY,
    ФИО           NVARCHAR(150) NOT NULL,
    Роль          NVARCHAR(50)  NOT NULL,
    Логин         NVARCHAR(50)  NOT NULL UNIQUE,
    Пароль        NVARCHAR(255) NOT NULL
);

CREATE TABLE dbo.Заказчик (
    ID_Заказчика INT IDENTITY(1,1) PRIMARY KEY,
    ФИО          NVARCHAR(150) NOT NULL,
    Телефон      NVARCHAR(20)  NULL,
    Email        NVARCHAR(100) NULL
);

CREATE TABLE dbo.Услуга (
    ID_Услуги INT IDENTITY(1,1) PRIMARY KEY,
    Название  NVARCHAR(150) NOT NULL,
    Тип       NVARCHAR(50)  NOT NULL,
    Цена      DECIMAL(10,2) NOT NULL
);

CREATE TABLE dbo.Материал (
    ID_Материала INT IDENTITY(1,1) PRIMARY KEY,
    Название     NVARCHAR(150) NOT NULL,
    ЕдиницаИзм   NVARCHAR(20)  NOT NULL,
    Остаток      DECIMAL(10,2) NOT NULL DEFAULT 0
);

CREATE TABLE dbo.Заказ (
    ID_Заказа      INT IDENTITY(1,1) PRIMARY KEY,
    ID_Заказчика   INT NOT NULL FOREIGN KEY REFERENCES dbo.Заказчик(ID_Заказчика),
    ID_Сотрудника  INT NOT NULL FOREIGN KEY REFERENCES dbo.Сотрудник(ID_Сотрудника),
    ДатаСоздания   DATETIME NOT NULL DEFAULT GETDATE(),
    Статус         NVARCHAR(30) NOT NULL DEFAULT N'Новый',
    Сумма          DECIMAL(10,2) NOT NULL DEFAULT 0
);

CREATE TABLE dbo.Позиция_заказа (
    ID_Позиции  INT IDENTITY(1,1) PRIMARY KEY,
    ID_Заказа   INT NOT NULL FOREIGN KEY REFERENCES dbo.Заказ(ID_Заказа),
    ID_Услуги   INT NOT NULL FOREIGN KEY REFERENCES dbo.Услуга(ID_Услуги),
    Количество  INT NOT NULL,
    Стоимость   DECIMAL(10,2) NOT NULL
);

CREATE TABLE dbo.Расход_материала (
    ID_Расхода   INT IDENTITY(1,1) PRIMARY KEY,
    ID_Позиции   INT NOT NULL FOREIGN KEY REFERENCES dbo.Позиция_заказа(ID_Позиции),
    ID_Материала INT NOT NULL FOREIGN KEY REFERENCES dbo.Материал(ID_Материала),
    Количество   DECIMAL(10,2) NOT NULL
);

CREATE TABLE dbo.Макет (
    ID_Макета     INT IDENTITY(1,1) PRIMARY KEY,
    ID_Заказа     INT NOT NULL FOREIGN KEY REFERENCES dbo.Заказ(ID_Заказа),
    ID_Дизайнера  INT NOT NULL FOREIGN KEY REFERENCES dbo.Сотрудник(ID_Сотрудника),
    ФайлМакета    NVARCHAR(255) NULL,
    Статус        NVARCHAR(30) NOT NULL DEFAULT N'В работе'
);

CREATE TABLE dbo.Оплата (
    ID_Оплаты  INT IDENTITY(1,1) PRIMARY KEY,
    ID_Заказа  INT NOT NULL FOREIGN KEY REFERENCES dbo.Заказ(ID_Заказа),
    Сумма      DECIMAL(10,2) NOT NULL,
    Тип        NVARCHAR(30) NOT NULL,   -- Полная / Частичная / Предоплата
    Способ     NVARCHAR(30) NOT NULL,   -- Наличные / Карта / Перевод
    Дата       DATETIME NOT NULL DEFAULT GETDATE()
);
GO

-- =========================== Тестовые данные ===========================

INSERT INTO dbo.Сотрудник (ФИО, Роль, Логин, Пароль) VALUES
(N'Иванова Мария Сергеевна', N'Приёмщик', N'ivanova', N'demo'),
(N'Петров Алексей Викторович', N'Дизайнер', N'petrov', N'demo'),
(N'Сидорова Ольга Николаевна', N'Кассир', N'sidorova', N'demo');

INSERT INTO dbo.Заказчик (ФИО, Телефон, Email) VALUES
(N'Кузнецов Дмитрий Игоревич', N'+7 900 111-22-33', N'kuznetsov@mail.ru'),
(N'Смирнова Анна Павловна', N'+7 900 222-33-44', N'smirnova@mail.ru'),
(N'ООО "Ромашка"', N'+7 812 333-44-55', N'info@romashka.ru');

INSERT INTO dbo.Услуга (Название, Тип, Цена) VALUES
(N'Печать фото 10x15', N'Фотопечать', 15.00),
(N'Печать фото 15x21', N'Фотопечать', 35.00),
(N'Печать документа A4 ч/б', N'Печать документов', 5.00),
(N'Печать документа A4 цвет', N'Печать документов', 15.00),
(N'Разработка визитки', N'Дизайн', 800.00),
(N'Разработка баннера', N'Дизайн', 2500.00),
(N'Печать визиток (100 шт)', N'Изготовление продукции', 1200.00),
(N'Ламинация A4', N'Изготовление продукции', 50.00);

INSERT INTO dbo.Материал (Название, ЕдиницаИзм, Остаток) VALUES
(N'Фотобумага 10x15', N'лист', 500),
(N'Фотобумага 15x21', N'лист', 300),
(N'Бумага A4', N'лист', 2000),
(N'Картридж CMYK', N'шт', 8),
(N'Плёнка для ламинации A4', N'лист', 150),
(N'Визитная бумага', N'лист', 400);
GO
