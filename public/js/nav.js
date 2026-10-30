// Компонент UI, общий для всех страниц: боковая навигация и шапка.
// Реализует шаблон "единообразное представление навигации" (лаб. 3).
const NAV_ITEMS = [
  { href: 'index.html', icon: 'grid', label: 'Обзор' },
  { href: 'orders.html', icon: 'orders', label: 'Заказы' },
  { href: 'clients.html', icon: 'users', label: 'Заказчики' },
  { href: 'services.html', icon: 'print', label: 'Услуги' },
  { href: 'materials.html', icon: 'box', label: 'Материалы' },
  { href: 'reports.html', icon: 'report', label: 'Отчёты' },
  { href: 'help.html', icon: 'book', label: 'Как пользоваться' },
  { href: 'about.html', icon: 'info', label: 'О программе' }
];

function icon(name) {
  const paths = {
    report: '<path d="M5 3h10l4 4v14H5zM14 3v5h5M9 17v-3M12 17v-6M15 17v-4"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
    book: '<path d="M12 5v16M3 3h4a5 5 0 0 1 5 2 5 5 0 0 1 5-2h4v16h-4a5 5 0 0 0-5 2 5 5 0 0 0-5-2H3z"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    orders: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v4H9zM9 12h6M9 16h4"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 5"/>',
    print: '<path d="M7 8V3h10v5M7 17H3V9h18v8h-4M7 14h10v7H7zM17 11h1"/>',
    box: '<path d="m12 3 9 5-9 5-9-5 9-5ZM3 8v10l9 5 9-5V8M12 13v10M7 5.8l9 5"/>',
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    wallet: '<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 9h18m-6 4h6M5 5V3h12"/>'
  };
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.grid}</svg>`;
}

function renderShell(activeHref, pageTitle) {
  const shell = document.getElementById('app-shell');
  const navHtml = NAV_ITEMS.map(item => `
    <li>
      <a href="${item.href}" class="${item.href === activeHref ? 'active' : ''}">
        <span class="icon">${icon(item.icon)}</span><span class="label">${item.label}</span>
      </a>
    </li>`).join('');

  shell.insertAdjacentHTML('afterbegin', `
    <aside class="sidebar">
      <a class="brand" href="index.html"><span class="brand-mark">${icon('print')}</span><span>фотоцентр<span class="brand-dot">.</span><small>ПЕЧАТЬ. ЛЮДИ. ПОРЯДОК.</small></span></a>
      <div class="nav-caption">РАБОЧЕЕ ПРОСТРАНСТВО</div>
      <ul class="nav-list">${navHtml}</ul>
      <div class="sidebar-note"><span class="status-dot"></span> Всё под контролем<small>Ваш рабочий день в одном месте</small></div>
      <div class="sidebar-footer">Фотоцентр <span>Workspace / 1.0</span></div>
    </aside>
    <div class="main">
      <header class="topbar">
        <div class="breadcrumb">Рабочее пространство <span>/</span> <strong>${pageTitle}</strong></div>
        <div class="topbar-right">
          <div class="form-group" style="margin:0;min-width:220px;">
            <div id="currentUser" class="current-user">Проверка входа…</div>
          </div>
          <button class="btn btn-sm" id="logoutButton" type="button">Выйти</button>
        </div>
      </header>
      <div class="page-heading"><div><div class="eyebrow">ФОТОЦЕНТР / УПРАВЛЕНИЕ</div><h1>${activeHref === 'index.html' ? 'Всё начинается с хорошего дня' : pageTitle}<span class="heading-dot">.</span></h1><p>${({ 'index.html': 'Заказы, команда и производство — вся картина перед вами.', 'orders.html': 'От первого обращения до готового результата.', 'clients.html': 'Люди, которые доверяют вам свои идеи.', 'services.html': 'Всё, что вы можете создать для своих клиентов.', 'materials.html': 'Всё необходимое для бесперебойной работы.', 'reports.html': 'Результаты работы за выбранный период.', 'help.html': 'Понятные инструкции для ежедневной работы.', 'about.html': 'Ваш помощник в управлении фотоцентром.' })[activeHref] || 'Все детали заказа в одном месте.'}</p></div><div class="heading-date">${new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' }).format(new Date())}</div></div>
      <main class="content" id="page-content"></main>
    </div>
  `);

  loadCurrentUser();
  document.getElementById('logoutButton').addEventListener('click', async () => {
    try { await Api.post('/api/auth/logout'); localStorage.removeItem('currentStaffId'); location.replace('login.html'); }
    catch (error) { toast(error.message, 'error'); }
  });
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    const dialog = backdrop.querySelector('.modal');
    if (dialog) { dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); const title = dialog.querySelector('h2'); if (title) { title.id ||= `${backdrop.id}-title`; dialog.setAttribute('aria-labelledby', title.id); } }
    backdrop.addEventListener('click', e => { if (e.target === backdrop) backdrop.classList.add('hidden'); });
    backdrop.querySelectorAll('.modal-close').forEach(b => b.setAttribute('aria-label', 'Закрыть'));
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const backdrop = document.querySelector('.modal-backdrop:not(.hidden)');
      if (backdrop) backdrop.classList.add('hidden');
    }
  });
}

let signedInUser = null;
let userRequest = null;
function getCurrentUser() {
  if (!userRequest) userRequest = Api.get('/api/auth/me').then(user => { signedInUser = user; return user; }).catch(error => { userRequest = null; if (error.status === 401) location.replace('login.html'); throw error; });
  return userRequest;
}
async function loadCurrentUser() {
  try {
    const user = await getCurrentUser();
    document.getElementById('currentUser').textContent = user.ФИО + ' — ' + user.Роль;
  } catch (error) {
    document.getElementById('currentUser').textContent = 'Не удалось проверить вход';
    if (error.status !== 401) toast(error.message, 'error');
  }
}
function currentStaffId() { return signedInUser ? signedInUser.ID_Сотрудника : null; }
