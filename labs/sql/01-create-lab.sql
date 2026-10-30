-- Отдельная учебная база. Выполнять в SSMS целиком.
USE master;
GO
IF DB_ID(N'PhotoCenterLab12') IS NOT NULL
BEGIN
    THROW 51000, N'PhotoCenterLab12 уже существует. Создание остановлено.', 1;
END;
GO
-- Повторная проверка нужна, поскольку SSMS продолжает следующие пакеты после ошибки.
IF DB_ID(N'PhotoCenterLab12') IS NULL
BEGIN
    EXEC(N'CREATE DATABASE PhotoCenterLab12');
    EXEC(N'USE PhotoCenterLab12;
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
    Статус         NVARCHAR(30) NOT NULL DEFAULT N''Новый'',
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
    Статус        NVARCHAR(30) NOT NULL DEFAULT N''В работе''
);

CREATE TABLE dbo.Оплата (
    ID_Оплаты  INT IDENTITY(1,1) PRIMARY KEY,
    ID_Заказа  INT NOT NULL FOREIGN KEY REFERENCES dbo.Заказ(ID_Заказа),
    Сумма      DECIMAL(10,2) NOT NULL,
    Тип        NVARCHAR(30) NOT NULL,   -- Полная / Частичная / Предоплата
    Способ     NVARCHAR(30) NOT NULL,   -- Наличные / Карта / Перевод
    Дата       DATETIME NOT NULL DEFAULT GETDATE()
);

');
END;
GO
