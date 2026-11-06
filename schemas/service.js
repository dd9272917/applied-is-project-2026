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
function parseService(body) {
  const fields = {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { fields: { body: 'Ожидается JSON-объект' } };
  for (const [field, limit] of [['Название', 150], ['Тип', 50]]) {
    if (typeof body[field] !== 'string' || !body[field].trim() || body[field].length > limit) {
      fields[field] = `Введите непустую строку длиной до ${limit} символов`;
    }
  }
  const price = body.Цена;
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0 || price > 99999999.99 ||
      Math.abs(price * 100 - Math.round(price * 100)) > 0.000001) {
    fields.Цена = 'Цена должна быть числом от 0.01 до 99999999.99 с точностью до копеек';
  }
  for (const key of Object.keys(body)) {
    if (!Object.hasOwn(serviceInputSchema.properties, key)) fields[key] = 'Поле не допускается во входных данных';
  }
  if (Object.keys(fields).length) return { fields };
  return { value: { Название: body.Название.trim(), Тип: body.Тип.trim(), Цена: price } };
}
module.exports = { serviceInputSchema, parseService };
