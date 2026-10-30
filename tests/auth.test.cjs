const assert = require('node:assert/strict');
const { test } = require('node:test');
const auth = require('../middleware/auth');
const employee={ID_Сотрудника:7,ФИО:'Тестовый сотрудник',Роль:'Оператор',Логин:'tester',Пароль:'test-password'};
let author=null;
const pool={request(){const inputs={};return {input(name,type,value){inputs[name]=value;return this;},async query(query){
 if(query.startsWith('SELECT ID_Сотрудника, ФИО, Роль, Логин, Пароль'))return {recordset:inputs.login===employee.Логин?[{...employee}]:[]};
 if(query.startsWith('UPDATE Сотрудник SET Пароль')){employee.Пароль=inputs.hash;return {recordset:[]};}
 if(query.startsWith('INSERT INTO Заказ')){author=inputs.ID_Сотрудника;return {recordset:[{ID_Заказа:1,ID_Сотрудника:author}]};}
 throw Error('Unexpected query');
}}}};
require.cache[require.resolve('../db')]={id:require.resolve('../db'),filename:require.resolve('../db'),loaded:true,exports:{sql:require('mssql'),poolPromise:Promise.resolve(pool)}};
const app=require('../server');
test('password hashing rejects wrong and malformed hashes',async()=>{
 const hash=await auth.hashPassword('test-password');assert(hash.startsWith('scrypt$'));assert(await auth.verifyPassword('test-password',hash));assert.equal(await auth.verifyPassword('wrong',hash),false);assert.equal(await auth.verifyPassword('x','scrypt$bad'),false);
});
test('login, protected routes, session, author binding and logout',async()=>{
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
 try{
  let r=await fetch(base+'/',{redirect:'manual'});assert.equal(r.status,302);assert.equal(r.headers.get('location'),'/login.html');
  r=await fetch(base+'/login.html');assert.equal(r.status,200);
  for(const path of ['/api/orders','/api/staff','/api/auth/me'])assert.equal((await fetch(base+path)).status,401);
  const post=(path,body,cookie,origin)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{cookie}:{}),...(origin?{origin}:{})},body:JSON.stringify(body)});
  r=await post('/api/auth/login',{login:'tester',password:'wrong'});assert.equal(r.status,401);
  r=await post('/api/auth/login',{login:'unknown',password:'wrong'});assert.equal(r.status,401);
  r=await post('/api/auth/login',{login:'tester',password:'test-password'},null,'https://other.example');assert.equal(r.status,403);
  r=await post('/api/auth/login',{login:'tester',password:'test-password'});assert.equal(r.status,200);let user=await r.json();assert.equal(user.ID_Сотрудника,7);assert(!('Пароль' in user));assert(employee.Пароль.startsWith('scrypt$'));
  const setCookie=r.headers.get('set-cookie');assert.match(setCookie,/HttpOnly/i);assert.match(setCookie,/SameSite=Strict/i);const cookie=setCookie.split(';')[0];
  r=await fetch(base+'/api/auth/me',{headers:{cookie}});assert.equal(r.status,200);assert.equal((await r.json()).Логин,'tester');
  r=await fetch(base+'/',{headers:{cookie},redirect:'manual'});assert.equal(r.status,200);
  r=await post('/api/orders',{ID_Заказчика:1,ID_Сотрудника:999},cookie);assert.equal(r.status,201);assert.equal(author,7);
  r=await post('/api/auth/logout',{},cookie);assert.equal(r.status,204);
  r=await fetch(base+'/api/auth/me',{headers:{cookie}});assert.equal(r.status,401);
  r=await post('/api/auth/login',{login:'tester',password:'test-password'});assert.equal(r.status,200);
 }finally{await new Promise(r=>server.close(r));}
});
