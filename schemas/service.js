// Входная схема не содержит ID: идентификатор назначает SQL Server.
const serviceInputSchema = {
  type: 'object', additionalProperties: false,
  required: ['Название', 'Тип', 'Цена'],
  properties: {
    Название: { type: 'string', minLength: 1, maxLength: 150, pattern: '\\S' },
    Тип: { type: 'string', minLength: 1, maxLength: 50, pattern: '\\S' },
    Цена: { type: 'number', exclusiveMinimum: true, minimum: 0, maximum: 99999999.99, multipleOf: 0.01 }
  }
};
const serviceUpdateSchema = {
  type: 'object', additionalProperties: false, minProperties: 1,
  properties: serviceInputSchema.properties
};
function parseService(body, { partial = false } = {}) {
  const fields = Object.create(null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { fields: { body: 'Ожидается JSON-объект' } };
  if (partial && !Object.keys(body).length) fields.body = 'Передайте хотя бы одно изменяемое поле';
  for (const [field, limit] of [['Название', 150], ['Тип', 50]]) {
    if (partial && !Object.hasOwn(body, field)) continue;
    if (typeof body[field] !== 'string' || !body[field].trim() || body[field].length > limit) {
      fields[field] = `Введите непустую строку длиной до ${limit} символов`;
    }
  }
  const price = body.Цена;
  if ((!partial || Object.hasOwn(body, 'Цена')) &&
      (typeof price !== 'number' || !Number.isFinite(price) || price <= 0 || price > 99999999.99 ||
      Math.abs(price * 100 - Math.round(price * 100)) > 0.000001)) {
    fields.Цена = 'Цена должна быть числом от 0.01 до 99999999.99 с точностью до копеек';
  }
  for (const key of Object.keys(body)) {
    if (!Object.hasOwn(serviceInputSchema.properties, key)) fields[key] = 'Поле не допускается во входных данных';
  }
  if (Object.keys(fields).length) return { fields };
  const value = {};
  for (const key of Object.keys(serviceInputSchema.properties)) {
    if (Object.hasOwn(body, key)) value[key] = typeof body[key] === 'string' ? body[key].trim() : body[key];
  }
  return { value };
}

function parseServiceFilters(query) {
  const fields = Object.create(null), value = {};
  for (const key of Object.keys(query)) {
    if (!['search', 'min_price', 'max_price', 'type'].includes(key)) fields[key] = 'Неизвестный параметр фильтра';
  }
  for (const [field, limit] of [['search', 150], ['type', 50]]) {
    if (!Object.hasOwn(query, field)) continue;
    if (typeof query[field] !== 'string' || query[field].length > limit) {
      fields[field] = `Ожидается одна строка длиной до ${limit} символов`;
    } else if (query[field].trim()) value[field] = query[field].trim();
  }
  for (const field of ['min_price', 'max_price']) {
    if (!Object.hasOwn(query, field)) continue;
    const raw = query[field];
    if (typeof raw !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(raw) || Number(raw) > 99999999.99) {
      fields[field] = 'Ожидается цена от 0 до 99999999.99 с точностью до копеек';
    } else value[field] = Number(raw);
  }
  if (value.min_price !== undefined && value.max_price !== undefined && value.min_price > value.max_price) {
    fields.min_price = 'Минимальная цена не должна превышать максимальную';
  }
  return Object.keys(fields).length ? { fields } : { value };
}
module.exports = { serviceInputSchema, serviceUpdateSchema, parseService, parseServiceFilters };
