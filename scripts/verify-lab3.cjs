const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
process.env.DB_DATABASE = 'PhotoCenterLab12';
const app = require('../server');
const { poolPromise } = require('../db');
const results = [];

async function main() {
  const pool = await poolPromise;
  const db = await pool.request().query('SELECT DB_NAME() AS name');
  assert.equal(db.recordset[0].name, 'PhotoCenterLab12');
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie, createdId;
  async function call(method, url, body, expected, authenticated = true) {
    const res = await fetch(base + url, {
      method, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie && authenticated ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const data = res.status === 204 ? null : await res.json();
    assert.equal(res.status, expected, `${method} ${url}: ${JSON.stringify(data)}`);
    results.push({ method, url, expected, actual: res.status, ...(body !== undefined && !url.includes('/auth/') ? { request: body } : {}),
      ...(!url.includes('/auth/') ? { response: data } : {}) });
    return { res, data };
  }
  try {
    await call('GET', '/api/health', undefined, 200);
    await call('GET', '/api/services', undefined, 401, false);
    const login = await call('POST', '/api/auth/login', { login: 'lab_ivanova', password: 'demo' }, 200);
    cookie = login.res.headers.get('set-cookie').split(';')[0];
    const spec = await fetch(base + '/openapi.json').then(r => r.json());
    assert.equal(spec.openapi, '3.0.3');
    assert(spec.paths['/api/services/{id}'].get);
    const docs = await fetch(base + '/docs/');
    assert.equal(docs.status, 200);
    assert.match(await docs.text(), /swagger-ui/);
    const list = (await call('GET', '/api/services', undefined, 200)).data;
    assert(list.length >= 3);
    await call('GET', `/api/services/${list[0].ID_Услуги}`, undefined, 200);
    await call('GET', '/api/services/2147483647', undefined, 404);
    for (const id of ['abc', '0', '-1', '1.5', '2147483648']) {
      await call('GET', `/api/services/${id}`, undefined, 422);
    }
    const valid = { Название: 'ЛР3 временная проверка', Тип: 'Печать документов', Цена: 25.5 };
    for (const body of [
      { ...valid, Цена: -1 }, { ...valid, Цена: 0 }, { ...valid, Цена: '25' },
      { ...valid, Цена: null }, { ...valid, Цена: 1.001 }, { ...valid, Цена: 100000000 },
      { ...valid, Название: '   ' }, { ...valid, Название: 123 },
      { ...valid, Название: 'x'.repeat(151) }, { ...valid, Тип: 'x'.repeat(51) },
      { ...valid, ID_Услуги: 999 }, {}, []
    ]) await call('POST', '/api/services', body, 422);
    const malformed = await fetch(base + '/api/services', {
      method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: '{broken'
    });
    assert.equal(malformed.status, 400);
    results.push({ method: 'POST', url: '/api/services', expected: 400, actual: 400, case: 'malformed JSON' });
    const created = await call('POST', '/api/services', valid, 201);
    createdId = created.data.ID_Услуги;
    assert(Number.isInteger(createdId));
    assert.equal(created.res.headers.get('location'), `/api/services/${createdId}`);
    assert.equal((await call('GET', `/api/services/${createdId}`, undefined, 200)).data.Цена, 25.5);
    await call('PUT', `/api/services/${createdId}`, { ...valid, Цена: 30 }, 200);
    await call('DELETE', `/api/services/${list[0].ID_Услуги}`, undefined, 409);
    await call('DELETE', `/api/services/${createdId}`, undefined, 204);
    const deletedId = createdId;
    createdId = undefined;
    await call('GET', `/api/services/${deletedId}`, undefined, 404);
    await call('DELETE', `/api/services/${deletedId}`, undefined, 404);
    assert.equal((await call('GET', '/api/services', undefined, 200)).data.length, list.length);
    await call('POST', '/api/auth/logout', {}, 204);
    await call('GET', '/api/services', undefined, 401);
    const report = { date: new Date().toISOString(), database: 'PhotoCenterLab12', passed: true,
      checks: results.length, docs: '/docs/', temporaryServiceRemoved: true, results };
    fs.writeFileSync(path.join(__dirname, '../labs/lab3-verification.json'), JSON.stringify(report, null, 2));
    console.log(`PASS: ${results.length} HTTP-проверок; Swagger и OpenAPI доступны; временная услуга удалена.`);
  } finally {
    // Удаляем только строку, созданную этим запуском, даже если проверка прервалась.
    if (createdId) await pool.request().input('id', require('mssql').Int, createdId)
      .query('DELETE FROM dbo.Услуга WHERE ID_Услуги=@id');
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; })
  .finally(async () => { try { await (await poolPromise).close(); } catch {} });
