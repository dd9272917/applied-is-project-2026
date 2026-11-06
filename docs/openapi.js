const { serviceInputSchema } = require('../schemas/service');
const json = schema => ({ 'application/json': { schema } });
const ref = name => ({ $ref: `#/components/schemas/${name}` });
const error = description => ({ description, content: json(ref('Error')) });
const id = { name: 'id', in: 'path', required: true, schema: { type: 'integer', minimum: 1, maximum: 2147483647 } };
const input = { required: true, content: { 'application/json': { schema: ref('ServiceInput'), example: { Название: 'Учебная печать A5', Тип: 'Печать документов', Цена: 25 } } } };
const service = { description: 'Услуга', content: json(ref('Service')) };
const secured = { security: [{ sessionCookie: [] }] };
module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'REST API фотоцентра — лабораторная работа 3', version: '1.1.0',
    description: 'Express + SQL Server. Сначала выполните POST /api/auth/login с вашей учётной записью. Браузер сохранит HttpOnly-cookie и отправит её в последующих запросах. Вручную задавать cookie через Authorize не нужно. Для учебной базы PhotoCenterLab12: lab_ivanova / demo.'
  },
  servers: [{ url: '/' }],
  tags: [{ name: 'Проверка сервера' }, { name: 'Вход' }, { name: 'Услуги' }],
  paths: {
    '/api/health': { get: { tags: ['Проверка сервера'], summary: 'Проверка HTTP-сервера без обращения к БД', responses: { 200: { description: 'Сервер запущен', content: json({ type: 'object', properties: { status: { type: 'string', example: 'ok' }, service: { type: 'string' } } }) } } } },
    '/api/auth/login': { post: {
      tags: ['Вход'], summary: 'Вход сотрудника и получение сессии',
      requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['login', 'password'], properties: { login: { type: 'string', maxLength: 50 }, password: { type: 'string', format: 'password', maxLength: 256 } } }, example: { login: 'lab_ivanova', password: 'demo' } } } },
      responses: { 200: { description: 'Сессия создана; сервер устанавливает cookie', content: json({ type: 'object', properties: { ID_Сотрудника: { type: 'integer' }, ФИО: { type: 'string' }, Роль: { type: 'string' }, Логин: { type: 'string' } } }) }, 400: error('Некорректные реквизиты'), 401: error('Неверный логин или пароль'), 403: error('Запрос с другого сайта'), 429: error('Слишком много попыток') }
    } },
    '/api/auth/logout': { post: { tags: ['Вход'], summary: 'Завершить сессию', responses: { 204: { description: 'Сессия завершена' } } } },
    '/api/services': {
      get: { ...secured, tags: ['Услуги'], summary: 'Список услуг', responses: { 200: { description: 'Список услуг', content: json({ type: 'array', items: ref('Service') }) }, 401: error('Не выполнен вход') } },
      post: { ...secured, tags: ['Услуги'], summary: 'Создать услугу', requestBody: input, responses: { 201: { ...service, description: 'Услуга создана', headers: { Location: { schema: { type: 'string' } } } }, 400: error('Некорректный JSON'), 401: error('Не выполнен вход'), 422: error('Ошибка валидации, включая попытку задать ID') } }
    },
    '/api/services/{id}': {
      get: { ...secured, tags: ['Услуги'], summary: 'Найти услугу по ID', parameters: [id], responses: { 200: service, 401: error('Не выполнен вход'), 404: error('Услуга не найдена'), 422: error('Некорректный ID') } },
      put: { ...secured, tags: ['Услуги'], summary: 'Изменить услугу', parameters: [id], requestBody: input, responses: { 200: service, 401: error('Не выполнен вход'), 404: error('Услуга не найдена'), 422: error('Ошибка валидации') } },
      delete: { ...secured, tags: ['Услуги'], summary: 'Удалить неиспользуемую услугу', parameters: [id], responses: { 204: { description: 'Удалена' }, 401: error('Не выполнен вход'), 404: error('Услуга не найдена'), 409: error('Услуга используется в заказах'), 422: error('Некорректный ID') } }
    }
  },
  components: {
    securitySchemes: { sessionCookie: { type: 'apiKey', in: 'cookie', name: 'photocenter_session' } },
    schemas: {
      ServiceInput: serviceInputSchema,
      Service: { type: 'object', required: ['ID_Услуги', 'Название', 'Тип', 'Цена'], properties: { ID_Услуги: { type: 'integer', readOnly: true }, ...serviceInputSchema.properties } },
      Error: { type: 'object', properties: { error: { type: 'boolean' }, message: { type: 'string' }, fields: { type: 'object', additionalProperties: { type: 'string' } } } }
    }
  }
};
