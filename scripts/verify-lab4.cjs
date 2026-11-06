const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
process.env.DB_DATABASE = 'PhotoCenterLab12';
const app = require('../server');
const { poolPromise, sql } = require('../db');
const results = [], owned = new Set();

async function main() {
  const pool = await poolPromise;
  assert.equal((await pool.request().query('SELECT DB_NAME() AS name')).recordset[0].name, 'PhotoCenterLab12');
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie;
  async function call(method, url, body, expected, authenticated = true) {
    const res = await fetch(base + url, { method,
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(cookie && authenticated ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body) });
    const data = res.status === 204 ? null : await res.json();
    // Track ownership before assertions to guarantee cleanup of successful inserts.
    if (method === 'POST' && url === '/api/services' && res.status === 201) owned.add(data.ID_Услуги);
    assert.equal(res.status, expected, `${method} ${url}: ${JSON.stringify(data)}`);
    results.push({ method, url, expected, actual: res.status,
      ...(!url.includes('/auth/') ? { ...(body === undefined ? {} : { request: body }), response: data } : {}) });
    return data;
  }
  const list = filters => call('GET', '/api/services?' + new URLSearchParams(filters), undefined, 200);
  const snapshot = async () => (await pool.request().query('SELECT ID_Услуги, Название, Тип, Цена FROM Услуга ORDER BY ID_Услуги')).recordset;
  const initial = await snapshot();
  try {
    await call('PATCH', '/api/services/1', { Цена: 25 }, 401, false);
    const login = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login: 'lab_ivanova', password: 'demo' }) });
    assert.equal(login.status, 200);
    cookie = login.headers.get('set-cookie').split(';')[0];
    const prefix = 'ЛР4-' + randomUUID().slice(0, 8);
    const category = prefix;
    const a = await call('POST', '/api/services', { Название: prefix + ' фото', Тип: category, Цена: 10 }, 201);
    const b = await call('POST', '/api/services', { Название: prefix + ' ламинация', Тип: category, Цена: 30 }, 201);
    const c = await call('POST', '/api/services', { Название: prefix + ' 100%_[~', Тип: category, Цена: 50 }, 201);
    assert.equal((await list({ search: prefix })).length, 3);
    assert.equal((await list({ search: prefix, min_price: '10', max_price: '30' })).length, 2);
    assert.deepEqual((await list({ search: prefix, min_price: '30', max_price: '30' })).map(s => s.ID_Услуги), [b.ID_Услуги]);
    assert.equal((await list({ search: prefix, min_price: '0', max_price: '9.99' })).length, 0);
    assert.equal((await list({ type: category })).length, 3);
    for (const literal of ['%', '_', '[', '~']) {
      assert.deepEqual((await list({ search: literal, type: category })).map(s => s.ID_Услуги), [c.ID_Услуги]);
    }
    assert.equal((await list({ search: "' OR 1=1--", type: category })).length, 0);
    const rangeOnly = await list({ min_price: '10', max_price: '30' });
    assert(rangeOnly.every(s => s.Цена >= 10 && s.Цена <= 30));
    for (const raw of [
      'min_price=30&max_price=10', 'min_price=-1', 'max_price=oops', 'min_price=',
      'max_price=100000000', 'min_price=1.001', 'min_price=Infinity',
      'search[x]=y', 'type[]=a&type[]=b', 'min_price=1&min_price=2', 'unknown=1',
      'search=' + 'x'.repeat(151), 'type=' + 'x'.repeat(51)
    ]) await call('GET', '/api/services?' + raw, undefined, 422);
    const changed = await call('PATCH', `/api/services/${a.ID_Услуги}`, { Цена: 25 }, 200);
    assert.deepEqual(changed, { ...a, Цена: 25 });
    assert.deepEqual(await call('GET', `/api/services/${a.ID_Услуги}`, undefined, 200), changed);
    const renamed = await call('PATCH', `/api/services/${a.ID_Услуги}`, { Название: prefix + ' новое имя' }, 200);
    assert.equal(renamed.Цена, 25); assert.equal(renamed.Тип, category);
    const twoFields = await call('PATCH', `/api/services/${a.ID_Услуги}`, { Тип: category + '2', Цена: 0.01 }, 200);
    assert.equal(twoFields.Название, renamed.Название); assert.equal(twoFields.Цена, 0.01);
    for (const body of [{}, [], { Цена: null }, { Название: null }, { Цена: -1 }, { Цена: '25' },
      { Цена: true }, { Цена: 1.001 }, { Название: ' ' }, { Тип: 'x'.repeat(51) },
      { ID_Услуги: b.ID_Услуги }, { 'Цена]=0;--': 1 }]) {
      await call('PATCH', `/api/services/${a.ID_Услуги}`, body, 422);
    }
    assert.deepEqual(await call('GET', `/api/services/${a.ID_Услуги}`, undefined, 200), twoFields);
    // PUT remains a complete replacement of the editable fields.
    await call('PUT', `/api/services/${a.ID_Услуги}`, { Цена: 15 }, 422);
    await call('PATCH', '/api/services/abc', { Цена: 15 }, 422);
    await call('DELETE', '/api/services/0', undefined, 422);
    const linked = (await pool.request().query('SELECT TOP 1 ID_Услуги FROM Позиция_заказа ORDER BY ID_Услуги')).recordset[0];
    assert(linked, 'Учебная база должна содержать позиции заказа');
    await call('DELETE', `/api/services/${linked.ID_Услуги}`, undefined, 409);
    await call('DELETE', `/api/services/${a.ID_Услуги}`, undefined, 204);
    owned.delete(a.ID_Услуги);
    assert.equal((await pool.request().input('id', sql.Int, a.ID_Услуги).query('SELECT COUNT(*) AS n FROM Услуга WHERE ID_Услуги=@id')).recordset[0].n, 0);
    await call('PATCH', `/api/services/${a.ID_Услуги}`, { Цена: 15 }, 404);
    await call('DELETE', `/api/services/${a.ID_Услуги}`, undefined, 404);
    for (const id of [b.ID_Услуги, c.ID_Услуги]) {
      await call('DELETE', `/api/services/${id}`, undefined, 204);
      owned.delete(id);
    }
    assert.deepEqual(await snapshot(), initial);
    const spec = await fetch(base + '/openapi.json').then(r => r.json());
    assert(spec.paths['/api/services/{id}'].patch);
    assert.equal(spec.paths['/api/services'].get.parameters.length, 4);
    const report = { date: new Date().toISOString(), database: 'PhotoCenterLab12', passed: true,
      checks: results.length, originalServicesUnchanged: true, temporaryServicesRemoved: true, results };
    fs.writeFileSync(path.join(__dirname, '../labs/lab4-verification.json'), JSON.stringify(report, null, 2));
    console.log(`PASS: ${results.length} HTTP-проверок. PATCH, DELETE, фильтры и защита SQL; исходные услуги не изменены.`);
  } finally {
    for (const id of owned) await pool.request().input('id', sql.Int, id).query('DELETE FROM Услуга WHERE ID_Услуги=@id');
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; })
  .finally(async () => { try { await (await poolPromise).close(); } catch {} });
