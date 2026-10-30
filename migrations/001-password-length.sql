-- Run in the application database. Existing passwords and other data are preserved.
-- A scrypt password hash uses 168 characters; older databases used NVARCHAR(100).
IF EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = N'dbo' AND TABLE_NAME = N'Сотрудник'
      AND COLUMN_NAME = N'Пароль' AND DATA_TYPE = N'nvarchar'
      AND CHARACTER_MAXIMUM_LENGTH BETWEEN 1 AND 254
)
BEGIN
    IF EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = N'dbo' AND TABLE_NAME = N'Сотрудник'
          AND COLUMN_NAME = N'Пароль' AND IS_NULLABLE = 'YES'
    )
        ALTER TABLE dbo.Сотрудник ALTER COLUMN Пароль NVARCHAR(255) NULL;
    ELSE
        ALTER TABLE dbo.Сотрудник ALTER COLUMN Пароль NVARCHAR(255) NOT NULL;
END;
