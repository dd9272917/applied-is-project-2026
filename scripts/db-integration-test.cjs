// Safe SQL Server integration probe. All rows live in a session-local temp
// table and the transaction is rolled back; permanent application data is untouched.
const sql = require('mssql');
require('dotenv').config();

const pool = new sql.ConnectionPool({
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER || 'localhost',
  port: Number(process.env.DB_PORT || 1433),
  database: process.env.DB_DATABASE || 'photocenter',
  options: { encrypt: process.env.DB_ENCRYPT === 'true', trustServerCertificate: process.env.DB_TRUST_CERT !== 'false' }
});

const probe = `
SET NOCOUNT ON;
SET IMPLICIT_TRANSACTIONS OFF;
CREATE TABLE #Lab8Probe (id INT IDENTITY(1,1) PRIMARY KEY, title NVARCHAR(100) NOT NULL, price DECIMAL(10,2) NOT NULL CHECK (price >= 0));
BEGIN TRANSACTION;
INSERT INTO #Lab8Probe(title, price) VALUES (N'DB integration probe', 125.50);
IF (SELECT COUNT(*) FROM #Lab8Probe) <> 1 THROW 51000, 'INSERT/SELECT failed', 1;
UPDATE #Lab8Probe SET price=200 WHERE id=1;
IF (SELECT price FROM #Lab8Probe WHERE id=1) <> 200 THROW 51001, 'UPDATE failed', 1;
DELETE FROM #Lab8Probe WHERE id=1;
IF (SELECT COUNT(*) FROM #Lab8Probe) <> 0 THROW 51002, 'DELETE failed', 1;
DECLARE @constraintRejected bit = 0;
BEGIN TRY
  INSERT INTO #Lab8Probe(title, price) VALUES (NULL, 10);
END TRY
BEGIN CATCH
  IF ERROR_NUMBER() <> 515 THROW;
  SET @constraintRejected = 1;
END CATCH;
IF @constraintRejected = 0 THROW 51003, 'NOT NULL violation was not rejected', 1;
ROLLBACK TRANSACTION;
SELECT @constraintRejected AS constraintRejected,
       (SELECT COUNT(*) FROM #Lab8Probe) AS remainingRows,
       @@TRANCOUNT AS transactionCount;
DROP TABLE #Lab8Probe;
`;

(async () => {
  try {
    await pool.connect();
    const result = await pool.request().query(probe);
    const row = result.recordset[0];
    if (!row?.constraintRejected || row.remainingRows !== 0 || row.transactionCount !== 0) throw new Error(`Rollback/integrity verification failed: ${JSON.stringify(row)}`);
    console.log(JSON.stringify({ database: process.env.DB_DATABASE || 'photocenter', insertRead: 'PASS', update: 'PASS', delete: 'PASS', notNullViolationRejected: 'PASS', rollback: 'PASS', persistentRowsChanged: 0 }, null, 2));
  } catch (error) {
    console.error('DB integration test failed:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.close();
  }
})();
