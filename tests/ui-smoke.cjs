const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/dinaa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const special = `O'Коннор "Фото" <студия>`;
const client = {ID_Заказчика:1,ФИО:special,Телефон:'+77000000000',Email:'photo@example.com'};
const service = {ID_Услуги:1,Название:special,Тип:'Фотопечать',Цена:500};
const material = {ID_Материала:1,Название:special,ЕдиницаИзм:'лист',Остаток:10};
const staff = [{ID_Сотрудника:1,ФИО:'Оператор',Роль:'оператор'}];
const order = {ID_Заказа:1,Заказчик:special,Заказчик_ФИО:special,Статус:'Новый',Сумма:1000,Оплачено:0,ДатаСоздания:'2026-10-16T10:00:00'};
const detail = {order,positions:[{ID_Позиции:1,Услуга:special,Количество:2,Стоимость:1000}],materials:[],payments:[],layouts:[]};
(async()=>{
 const browser = await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 let checks=0;
 try {
 for(const mode of ['filled','empty','error']) {
 const page=await browser.newPage();
 const errors=[];const writes=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*', async route=>{
  const url=new URL(route.request().url());
  if(url.origin!=='http://photocenter.test') return route.abort();
  if(url.pathname.startsWith('/api/')){
   if(url.pathname==='/api/auth/me') return route.fulfill({json:{...staff[0],Логин:'operator'}});
   if(url.pathname==='/api/auth/login') {
    const body=route.request().postDataJSON();
    return body.password==='test-password' ? route.fulfill({json:{...staff[0],Логин:'operator'}}) : route.fulfill({status:401,json:{message:'Неверный логин или пароль.'}});
   }
   if(mode==='error') return route.fulfill({status:500,json:{message:'Тестовая ошибка подключения'}});
   if(route.request().method()!=='GET'){writes.push({url:url.pathname,method:route.request().method(),body:route.request().postDataJSON()});return route.fulfill({json:{ID_Заказа:1}})}
   const empty=mode==='empty';
   const data=url.pathname==='/api/staff'?staff:url.pathname==='/api/clients'?(empty?[]:[client]):url.pathname==='/api/services'?(empty?[]:[service]):url.pathname==='/api/materials'?(empty?[]:[material]):url.pathname==='/api/orders/1'?{...detail,positions:empty?[]:detail.positions}:url.pathname==='/api/orders'?(empty?[]:[order]):url.pathname==='/api/dashboard'?{orders:empty?[]:[order],lowStock:empty?[]:[material],ordersInWork:empty?0:1,revenueToday:0}:null;
   assert.notEqual(data,null,'Unknown API '+url.pathname); return route.fulfill({json:data});
  }
  const file=path.join(__dirname,'../public',url.pathname==='/'?'index.html':url.pathname);
  return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'application/javascript'});
 });
 if(mode==='filled') {
  await page.goto('http://photocenter.test/login.html');
  await page.locator('#login').fill('operator');
  await page.locator('#password').fill('wrong');
  await page.locator('#loginButton').click();
  await page.waitForLoadState('networkidle');
  assert.match(await page.locator('#loginError').innerText(),/Неверный логин/);
  assert.equal(await page.locator('#password').inputValue(),'');
  await page.locator('#password').fill('test-password');
  await page.locator('#showPassword').check();
  assert.equal(await page.locator('#password').getAttribute('type'),'text');
  await page.locator('#loginButton').click();
  await page.waitForURL('**/index.html');
  await page.waitForLoadState('networkidle');
  assert.match(await page.locator('#currentUser').innerText(),/Оператор/);
  await page.locator('#logoutButton').click();
  await page.waitForURL('**/login.html');
  assert.deepEqual(errors,[]);
  console.log('PASS login: wrong password, show password, success, profile and logout');
 }
 for(const file of ['index.html','orders.html','clients.html','services.html','materials.html','order-detail.html?id=1','reports.html','about.html','help.html']) {
  await page.goto('http://photocenter.test/'+file); await page.waitForLoadState('networkidle');
  if(file==='reports.html') {
   assert(await page.locator('#printReport').isDisabled());
   await page.locator('#reportStart').fill('2026-10-01');
   await page.locator('#reportEnd').fill('2026-10-31');
   await page.locator('#reportEnd').press('Tab');
   await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/api/orders'),page.locator('#generateReport').click()]);
   await page.waitForFunction(()=>document.getElementById('reportResult').getAttribute('aria-busy')!=='true');
   if(mode!=='error') {
    assert(await page.locator('#printReport').isEnabled());
    if(mode==='filled') {
     assert.equal(await page.locator('#reportResult tbody tr').count(),1);
     assert((await page.locator('#reportResult').innerText()).includes(special));
     await page.locator('#reportStatus').selectOption('Выдан');
     assert(await page.locator('#printReport').isDisabled());
     await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/api/orders'),page.locator('#generateReport').click()]);await page.waitForFunction(()=>document.getElementById('reportResult').getAttribute('aria-busy')!=='true');
     assert.match(await page.locator('#reportResult').innerText(),/заказы не найдены/);
    }else assert.match(await page.locator('#reportResult').innerText(),/заказы не найдены/);
    await page.locator('#reportStart').fill('2026-11-01');
    await page.locator('#generateReport').click();
    assert.match(await page.locator('#reportMessage').innerText(),/корректный период/);
    assert(await page.locator('#printReport').isDisabled());
   }
  }
  assert.equal(await page.locator('.page-heading h1').count(),1);
  assert.equal(await page.locator('.nav-list a.active').count(),1);
  if(mode==='error' && !['about.html','help.html'].includes(file)) assert.match(await page.locator('#page-content').innerText(),/Тестовая ошибка/);
  else {
   if(file!=='reports.html') assert.equal(await page.locator('#page-content .alert-error').count(),0);
   if(['clients.html','services.html','materials.html'].includes(file)) {
    if(file==='clients.html') {
     await page.locator('#searchInput').fill(special);
     await page.waitForResponse(r=>r.url().includes('/api/clients?q=') && new URL(r.url()).searchParams.get('q')===special);
     await page.waitForLoadState('networkidle');
     assert.equal(await page.locator('#searchInput').inputValue(),special);
    }
    await page.getByRole('button',{name:/Новый заказчик|Новая услуга|Новый материал/}).click();
    await page.keyboard.press('Escape');assert(await page.locator('#modalBackdrop').isHidden());
    if(mode==='filled') {
     await page.getByRole('button',{name:'Изменить',exact:true}).click();
     assert.equal(await page.locator('#modalBackdrop input[name="id"]').inputValue(),'1');
     await page.locator('#modalBackdrop button[type="submit"]').click();
     await page.waitForLoadState('networkidle');
     assert.equal(writes.at(-1).method,'PUT');assert(writes.at(-1).url.endsWith('/1'));
     if(file==='materials.html') {
      await page.getByRole('button',{name:'Остаток +/-',exact:true}).click();
      await page.keyboard.press('Escape'); assert(await page.locator('#stockBackdrop').isHidden());
      await page.getByRole('button',{name:'Остаток +/-',exact:true}).click();
      await page.locator('#stockBackdrop').click({position:{x:5,y:5}});assert(await page.locator('#stockBackdrop').isHidden());
      await page.getByRole('button',{name:'Остаток +/-',exact:true}).click();
      await page.locator('#stockForm input[name="Дельта"]').fill('5');
      await page.getByRole('button',{name:'Применить',exact:true}).click();await page.waitForLoadState('networkidle');
      assert.equal(writes.at(-1).url,'/api/materials/1/stock');
     }
    }
   }
   if(file==='orders.html'){await page.getByRole('button',{name:'Новый заказ'}).click();await page.locator('#modalBackdrop').waitFor({state:'visible'});await page.keyboard.press('Escape');assert(await page.locator('#modalBackdrop').isHidden());}
   if(file.startsWith('order-detail')) {
    assert.equal(await page.locator('.page-heading h1').innerText(),'Заказ № 1');
    for(const [button,id] of [['+ Услуга','posBackdrop'],['+ Макет','layoutBackdrop'],['Внести оплату','payBackdrop']]) {
     await page.getByRole('button',{name:button,exact:true}).click();assert(await page.locator('#'+id).isVisible());await page.keyboard.press('Escape');assert(await page.locator('#'+id).isHidden());
    }
   }
  }
  assert.deepEqual(errors,[],file);checks++;console.log('PASS',mode,file);
 }
 await page.close();
 }
 console.log('Passed '+checks+' page scenarios');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
