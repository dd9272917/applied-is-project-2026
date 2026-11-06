const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { parseService } = require('../schemas/service');

function createServicesRouter(repository) {
  const router = Router();
  router.param('id', (req, res, next, value) => {
    const id = Number(value);
    if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(id) || id > 2147483647) {
      return res.status(422).json({ error: true, message: 'ID должен быть положительным INT', fields: { id: 'Некорректный ID' } });
    }
    req.serviceId = id;
    next();
  });
  function validate(req, res, next) {
    const parsed = parseService(req.body);
    if (parsed.fields) return res.status(422).json({ error: true, message: 'Проверьте входные данные', fields: parsed.fields });
    req.serviceInput = parsed.value;
    next();
  }
  router.get('/', asyncHandler(async (req, res) => res.json(await repository.list())));
  router.get('/:id', asyncHandler(async (req, res) => {
    const service = await repository.findById(req.serviceId);
    if (!service) throw new AppError(404, 'Услуга не найдена');
    res.json(service);
  }));
  router.post('/', validate, asyncHandler(async (req, res) => {
    const service = await repository.create(req.serviceInput);
    res.location(`/api/services/${service.ID_Услуги}`).status(201).json(service);
  }));
  router.put('/:id', validate, asyncHandler(async (req, res) => {
    const service = await repository.update(req.serviceId, req.serviceInput);
    if (!service) throw new AppError(404, 'Услуга не найдена');
    res.json(service);
  }));
  router.delete('/:id', asyncHandler(async (req, res) => {
    try {
      if (!await repository.remove(req.serviceId)) throw new AppError(404, 'Услуга не найдена');
    } catch (error) {
      if (error.number === 547) throw new AppError(409, 'Нельзя удалить услугу — она используется в заказах');
      throw error;
    }
    res.status(204).end();
  }));
  return router;
}
module.exports = { createServicesRouter };
