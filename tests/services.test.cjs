const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createServicesRouter } = require('../routes/services');

test('injected repository: HTTP validation blocks SQL access and protects generated fields', async () => {
  let calls = 0;
  const repository = {
    list: async () => [],
    findById: async () => undefined,
    create: async input => { calls++; return { ID_Услуги: 41, ...input }; }
  };
  const app = express();
  app.use(express.json());
  app.use('/api/services', createServicesRouter(repository));
  app.use((err, req, res, next) => res.status(err.status || 500).json({ message: err.publicMessage }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/services`;
  const post = body => fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    const valid = { Название: '  Фото  ', Тип: 'Фотопечать', Цена: 15 };
    for (const body of [{ ...valid, Цена: -1 }, { ...valid, Название: 3 }, { ...valid, ID_Услуги: 7 }, []]) {
      assert.equal((await post(body)).status, 422);
    }
    assert.equal(calls, 0);
    const created = await post(valid);
    assert.equal(created.status, 201);
    assert.equal(created.headers.get('location'), '/api/services/41');
    assert.deepEqual(await created.json(), { ID_Услуги: 41, Название: 'Фото', Тип: 'Фотопечать', Цена: 15 });
    assert.equal(calls, 1);
    assert.equal((await fetch(base + '/abc')).status, 422);
    assert.equal((await fetch(base + '/42')).status, 404);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
