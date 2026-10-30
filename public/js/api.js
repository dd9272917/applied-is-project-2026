// Компонент логики представления: единая точка обращения к API.
// Централизует обработку сетевых ошибок и разбор сообщений сервера,
// чтобы UI-компоненты не дублировали эту логику (см. лаб. 3).
const Api = {
  async request(method, url, body) {
    let res;
    try {
      res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined
      });
    } catch (networkErr) {
      throw { message: 'Нет соединения с сервером. Проверьте, что сервер запущен, и повторите попытку.' };
    }

    if (res.status === 204) return null;

    let data = null;
    try { data = await res.json(); } catch (_) { /* пустой ответ */ }

    if (res.status === 401 && !url.startsWith('/api/auth/')) {
      location.replace('login.html');
    }
    if (!res.ok) {
      const err = new Error((data && data.message) || 'Произошла ошибка. Попробуйте ещё раз.');
      err.fields = data && data.fields;
      err.status = res.status;
      throw err;
    }
    return data;
  },
  get(url) { return this.request('GET', url); },
  post(url, body) { return this.request('POST', url, body); },
  put(url, body) { return this.request('PUT', url, body); },
  patch(url, body) { return this.request('PATCH', url, body); },
  del(url) { return this.request('DELETE', url); }
};

// ---------- Уведомления (сквозная функциональность UI) ----------
function toast(message, type = 'success') {
  let region = document.querySelector('.toast-region');
  if (!region) {
    region = document.createElement('div');
    region.className = 'toast-region';
    document.body.appendChild(region);
  }
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  region.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

function showFieldErrors(formEl, fields) {
  formEl.querySelectorAll('.form-group').forEach(g => g.classList.remove('has-error'));
  if (!fields) return;
  Object.entries(fields).forEach(([name, msg]) => {
    const input = formEl.querySelector(`[name="${name}"]`);
    if (!input) return;
    const group = input.closest('.form-group');
    group.classList.add('has-error');
    const errEl = group.querySelector('.field-error');
    if (errEl) errEl.textContent = msg;
  });
}

function money(v) {
  return Number(v || 0).toLocaleString('ru-KZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₸';
}

function formatDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  return d.toLocaleDateString('ru-RU') + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

const STATUS_BADGE = {
  'Новый': 'badge-cyan',
  'В дизайне': 'badge-magenta',
  'В печати': 'badge-yellow',
  'Готов': 'badge-green',
  'Выдан': 'badge-gray'
};
function statusBadge(status) {
  const cls = STATUS_BADGE[status] || 'badge-gray';
  return `<span class="badge ${cls}">${escapeHtml(status)}</span>`;
}

function paymentBadge(order) {
  const paid = Number(order.Оплачено || 0);
  const sum = Number(order.Сумма || 0);
  if (paid <= 0) return '<span class="badge badge-red">Не оплачен</span>';
  if (paid < sum) return '<span class="badge badge-yellow">Частично</span>';
  return '<span class="badge badge-green">Оплачен</span>';
}
