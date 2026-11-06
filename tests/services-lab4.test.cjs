const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createServicesRouter } = require('../routes/services');

test('PATCH changes only supplied fields; invalid bodies and filters never reach repository', async () => {
  let record = { ID_Услуги: 7, Название: 'Фото', Тип: 'Фотопечать', Цена: 15 };
  let patches = 0, lists = 0;
  const repo = {
    patch: async (id, changes) => { patches++; return id === 7 ? (record = { ...record, ...changes }) : undefined; },
    list: async filters => { lists++; return [filters]; },
    remove: async () => false
  };
  const app = express();
  app.use(express.json());
  app.use('/api/services', createServicesRouter(repo));
  app.use((err, req, res, next) => res.status(err.status || 500).json({ message: err.publicMessage }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/services`;
  const patch = body => fetch(base + '/7', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    for (const body of [{}, [], { Цена: null }, { Цена: -1 }, { Тип: ' ' }, { Название: false }, { ID_Услуги: 8 }, JSON.parse('{"__proto__":"extra"}')]) {
      assert.equal((await patch(body)).status, 422);
    }
    assert.equal(patches, 0);
    const changed = await patch({ Цена: 25 });
    assert.equal(changed.status, 200);
    assert.deepEqual(await changed.json(), { ID_Услуги: 7, Название: 'Фото', Тип: 'Фотопечать', Цена: 25 });
    for (const query of ['min_price=20&max_price=10', 'search[x]=y', 'min_price=1&min_price=2']) {
      assert.equal((await fetch(base + '?' + query)).status, 422);
    }
    assert.equal(lists, 0);
    const filtered = await fetch(base + '?' + new URLSearchParams({ search: ' Фото ', min_price: '0', max_price: '25.50' }));
    assert.deepEqual(await filtered.json(), [{ search: 'Фото', min_price: 0, max_price: 25.5 }]);
    assert.equal((await fetch(base + '/8', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{"Цена":25}' })).status, 404);
    assert.equal((await fetch(base + '/8', { method: 'DELETE' })).status, 404);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
