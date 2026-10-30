renderShell('reports.html', 'Отчёты');
document.getElementById('page-content').append(document.getElementById('reports-template').content.cloneNode(true));

function reportDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function summarizeOrders(orders, start, end, status) {
  const selected = orders.filter(order => {
    const date = reportDateKey(order.ДатаСоздания);
    return date && date >= start && date <= end && (!status || order.Статус === status);
  });
  return {
    orders: selected,
    total: selected.reduce((sum, order) => sum + Number(order.Сумма || 0), 0),
    paid: selected.reduce((sum, order) => sum + Number(order.Оплачено || 0), 0),
    debt: selected.reduce((sum, order) => sum + Math.max(0, Number(order.Сумма || 0) - Number(order.Оплачено || 0)), 0)
  };
}

const startInput = document.getElementById('reportStart');
const endInput = document.getElementById('reportEnd');
const statusInput = document.getElementById('reportStatus');
const printButton = document.getElementById('printReport');
const generateButton = document.getElementById('generateReport');
const resultElement = document.getElementById('reportResult');
const messageElement = document.getElementById('reportMessage');
const now = new Date();
startInput.value = reportDateKey(new Date(now.getFullYear(), now.getMonth(), 1));
endInput.value = reportDateKey(now);

function invalidateReport() {
  printButton.disabled = true;
  resultElement.innerHTML = '<div class="card empty-state">Параметры изменены. Нажмите «Сформировать отчёт».</div>';
  messageElement.textContent = '';
}
[startInput, endInput, statusInput].forEach(input => input.addEventListener('change', invalidateReport));
printButton.addEventListener('click', () => { if (!printButton.disabled) window.print(); });

document.getElementById('reportForm').addEventListener('submit', async event => {
  event.preventDefault();
  const start = startInput.value;
  const end = endInput.value;
  const status = statusInput.value;
  printButton.disabled = true;
  messageElement.textContent = '';
  resultElement.innerHTML = '';
  if (!start || !end || start > end) {
    messageElement.innerHTML = '<div class="alert alert-error">Укажите корректный период: дата начала не должна быть позже даты окончания.</div>';
    return;
  }
  generateButton.disabled = true;
  generateButton.textContent = 'Формирование…';
  resultElement.setAttribute('aria-busy', 'true');
  resultElement.innerHTML = '<div class="card empty-state">Загружаем данные для отчёта…</div>';
  try {
    const orders = await Api.get('/api/orders');
    // Do not display a response for filters changed while the request was running.
    if (startInput.value !== start || endInput.value !== end || statusInput.value !== status) return;
    const report = summarizeOrders(orders, start, end, status);
    const displayDay = value => value.split('-').reverse().join('.');
    const rows = report.orders.map(order => `<tr><td>№ ${escapeHtml(order.ID_Заказа)}</td><td>${escapeHtml(formatDate(order.ДатаСоздания))}</td><td>${escapeHtml(order.Заказчик)}</td><td>${escapeHtml(order.Статус)}</td><td class="num">${money(order.Сумма)}</td><td class="num">${money(order.Оплачено)}</td><td class="num">${money(Math.max(0, Number(order.Сумма || 0) - Number(order.Оплачено || 0)))}</td></tr>`).join('');
    resultElement.innerHTML = `<div class="report-title"><span class="info-kicker">ФОТОЦЕНТР / ОТЧЁТ</span><h2>Отчёт по заказам</h2><p>Период: ${displayDay(start)} — ${displayDay(end)} · Статус: ${escapeHtml(status || 'Все статусы')}</p><p class="report-hint">Сформирован: ${escapeHtml(formatDate(new Date()))}. Отбор по дате создания заказа. Оплаты по выбранным заказам учитываются за всё время.</p></div>
    <div class="stat-grid">${[
      ['Количество заказов', report.orders.length], ['Сумма заказов', money(report.total)], ['Оплачено по заказам', money(report.paid)], ['Остаток к оплате', money(report.debt)]
    ].map(([label, value]) => `<div class="card stat-card"><div class="label">${label}</div><div class="value">${value}</div></div>`).join('')}</div>
    <div class="card report-table">${report.orders.length ? `<table><thead><tr><th>Заказ</th><th>Создан</th><th>Заказчик</th><th>Статус</th><th>Сумма</th><th>Оплачено</th><th>Остаток</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><th colspan="4">Итого</th><td class="num">${money(report.total)}</td><td class="num">${money(report.paid)}</td><td class="num">${money(report.debt)}</td></tr></tfoot></table>` : '<div class="empty-state">За выбранный период заказы не найдены. Измените даты или статус.</div>'}</div>`;
    printButton.disabled = false;
  } catch (error) {
    resultElement.innerHTML = '';
    messageElement.innerHTML = `<div class="alert alert-error">Не удалось сформировать отчёт. ${escapeHtml(error.message)} Попробуйте ещё раз.</div>`;
  } finally {
    generateButton.disabled = false;
    generateButton.textContent = 'Сформировать отчёт';
    resultElement.removeAttribute('aria-busy');
  }
});
