const { test } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../server');

async function withServer(run) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}

test('API health responds successfully', async () => withServer(async base => {
  const response = await fetch(base + '/api/health');
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, 'ok');
}));

test('protected orders require a session', async () => withServer(async base => {
  assert.equal((await fetch(base + '/api/orders')).status, 401);
}));

test('unknown API route is still protected by authentication', async () => withServer(async base => {
  // Authentication middleware runs before the API 404 handler.
  assert.equal((await fetch(base + '/api/not-found')).status, 401);
}));

test('invalid JSON returns 400', async () => withServer(async base => {
  const response = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).message, 'Некорректный JSON');
}));

test('empty login and password are rejected', async () => withServer(async base => {
  const response = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login: '', password: '' }) });
  assert.equal(response.status, 400);
}));

test('incorrect login is rejected with generic message', async () => withServer(async base => {
  const response = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login: 'lab8_missing_user', password: 'wrong-password' }) });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).message, 'Неверный логин или пароль.');
  assert.equal(response.headers.get('set-cookie'), null);
}));

test('cross-origin write request is rejected', async () => withServer(async base => {
  const response = await fetch(base + '/api/orders', { method: 'POST', headers: { Origin: 'https://untrusted.example', 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(response.status, 403);
}));

test('invalid login field types are rejected', async () => withServer(async base => {
  const response = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login: 123, password: [] }) });
  assert.equal(response.status, 400);
}));

test('protected employee data is unavailable without authentication', async () => withServer(async base => {
  assert.equal((await fetch(base + '/api/staff')).status, 401);
}));

test('session introspection requires authentication', async () => withServer(async base => {
  assert.equal((await fetch(base + '/api/auth/me')).status, 401);
}));
