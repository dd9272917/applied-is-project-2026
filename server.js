require('dotenv').config();
const express = require('express');
const path = require('path');
const auth = require('./middleware/auth');
const swaggerUi = require('swagger-ui-express');
const openapi = require('./docs/openapi');
const { createServicesRouter } = require('./routes/services');
const { createServicesRepository } = require('./repositories/services');
const { sql, poolPromise } = require('./db');

const app = express();

app.use(express.json());
app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'photocenter-api' }));
app.get('/openapi.json', (req, res) => res.json(openapi));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi, {
  swaggerOptions: { validatorUrl: null, tryItOutEnabled: false },
  customSiteTitle: 'Фотоцентр — лабораторные 3 и 4'
}));
app.use('/api', auth.sameOrigin);
app.use('/api/auth', require('./routes/auth'));
app.use('/api', auth.requireAuth);
app.use((req, res, next) => {
  if (req.path === '/' || req.path.endsWith('.html')) {
    res.set('Cache-Control', 'no-store');
    if (req.path !== '/login.html' && !auth.sessionFor(req)) return res.redirect('/login.html');
  }
  next();
});
app.use(express.static(path.join(__dirname, 'public')));

// ---- Слой сервисов / доступа к данным, подключённый через маршруты ----
app.use('/api/clients', require('./routes/clients'));
app.use('/api/services', createServicesRouter(createServicesRepository({
  getPool: () => poolPromise, sql
})));
app.use('/api/materials', require('./routes/materials'));
app.use('/api/staff', require('./routes/staff'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/dashboard', require('./routes/dashboard'));

// 404 для неизвестных API-маршрутов
app.use('/api', (req, res) => {
  res.status(404).json({ error: true, message: 'Такого API-маршрута не существует' });
});

// ---- Сквозная функциональность: централизованная обработка исключений ----
// Перехватывает всё, что "всплыло" из routes/*, логирует полную информацию
// на сервере и возвращает пользователю только безопасное сообщение —
// без деталей SQL/стека вызовов (см. лаб. 3, задача 3).
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: true, message: 'Некорректный JSON' });
  }
  console.error('[Ошибка]', err);
  const status = err.status || 500;
  const message = err.publicMessage || 'Внутренняя ошибка сервера. Попробуйте ещё раз позже.';
  res.status(status).json({ error: true, message });
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`АРМ фотоцентра запущен: http://localhost:${PORT}`);
  });
}
module.exports = app;
