const router = require('express').Router();
const {sql,poolPromise} = require('../db');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const auth = require('../middleware/auth');
router.use((req,res,next) => {res.set('Cache-Control','no-store');next();});
router.post('/login',auth.loginLimit,asyncHandler(async(req,res) => {
  const {login,password} = req.body;
  if (typeof login !== 'string' || !login.trim() || login.trim().length > 50 || typeof password !== 'string' || !password || password.length > 256) {
    throw new AppError(400,'Введите логин и пароль.');
  }
  const pool = await poolPromise;
  const result = await pool.request().input('login',sql.NVarChar(50),login.trim())
    .query('SELECT ID_Сотрудника, ФИО, Роль, Логин, Пароль FROM Сотрудник WHERE Логин=@login');
  const employee = result.recordset[0];
  // Perform a password derivation even for unknown users.
  const stored = employee ? employee.Пароль : `scrypt$${'0'.repeat(32)}$${'0'.repeat(128)}`;
  const valid = await auth.verifyPassword(password,stored);
  if (!employee || !valid) throw new AppError(401,'Неверный логин или пароль.');
  if (!employee.Пароль.startsWith('scrypt$')) {
    const hash = await auth.hashPassword(password);
    try {
      await pool.request().input('id',sql.Int,employee.ID_Сотрудника).input('hash',sql.NVarChar(255),hash)
        .query('UPDATE Сотрудник SET Пароль=@hash WHERE ID_Сотрудника=@id');
    } catch (error) {
      if ([8152, 2628].includes(error.number)) {
        throw new AppError(503,'Нужно обновить поле пароля в базе. В папке приложения выполните: node scripts/migrate-auth.js');
      }
      throw error;
    }
  }
  const user = {ID_Сотрудника:employee.ID_Сотрудника,ФИО:employee.ФИО,Роль:employee.Роль,Логин:employee.Логин};
  auth.setSession(req,res,user);
  res.json(user);
}));
router.get('/me',auth.requireAuth,(req,res) => res.json(req.user));
router.post('/logout',(req,res) => {auth.logout(req,res);res.sendStatus(204);});
module.exports = router;
