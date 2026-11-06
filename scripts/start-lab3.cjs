// Учебный запуск всегда использует отдельную БД лабораторных 1 и 2.
process.env.DB_DATABASE = 'PhotoCenterLab12';
process.env.PORT = process.env.LAB3_PORT || '3001';
const app = require('../server');
app.listen(Number(process.env.PORT), '127.0.0.1', () => {
  console.log(`Лабораторные 3 и 4: http://127.0.0.1:${process.env.PORT}/docs/`);
  console.log('База: PhotoCenterLab12; учебный вход: lab_ivanova / demo');
});
