let paypalItems = [];

(async function() {
  if (!(await requireAuth())) return;
  loadPayPal();
  setupNavigation();
})();

async function loadPayPal() {
  try {
    const items = await apiRequest('/recurring');
    paypalItems = items.filter(r => r.art === 'PP');
    displayPayPal();
  } catch (error) {
    showError('Fehler beim Laden der PayPal-Pläne: ' + (error?.message || error));
  }
}

async function deletePayPal(id) {
  if (!window.confirm('Diese PayPal Ratenzahlung wirklich löschen?')) return;
  try {
    await apiRequest(`/recurring/${id}`, { method: 'DELETE' });
    showSuccess('PayPal-Ratenzahlung gelöscht');
    loadPayPal();
  } catch (error) {
    showError(error.message || 'Fehler beim Löschen');
  }
}

function formatShortDate(dateString) {
  // z.B. 2025-12-17 --> 17.12.25
  if (!dateString) return '-';
  const d = new Date(dateString);
  if (isNaN(d)) return '-';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}.${mm}.${yy}`;
}

function displayPayPal() {
  const container = document.getElementById('paypal-list');
  
  if (paypalItems.length === 0) {
    container.innerHTML = '<p class="text-muted">Keine PayPal-Ratenzahlungen vorhanden.</p>';
    return;
  }
  let sumRaten = 0;
  let sumRest = 0;
  paypalItems.forEach(item => {
    sumRaten += Number(item.occurrence_amount) || 0;
    sumRest += Number(item.total_remaining) || 0;
  });

  const table = document.createElement('table');
  table.className = 'table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Beschreibung</th>
        <th>Abbuchungstag</th>
        <th>Monatliche Rate</th>
        <th>Restbetrag</th>
        <th>Verbleibende Raten</th>
        <th>Datum letzte Rate</th>
        <th>Letzte Rate</th>
        <th>Status</th>
        <th>Aktion</th>
      </tr>
    </thead>
    <tbody></tbody>
    <tfoot>
      <tr>
        <td colspan="2" class="text-right text-bold">Summe:</td>
        <td class="table-amount text-bold">${formatAmount(Math.abs(sumRaten))}</td>
        <td class="table-amount text-bold">${formatAmount(Math.abs(sumRest))}</td>
        <td colspan="5"></td>
      </tr>
    </tfoot>
`  ;
  
  const tbody = table.querySelector('tbody');
  paypalItems.sort((a, b) => {
    if (a.remaining_installments == null) return 1;
    if (b.remaining_installments == null) return -1;
    return a.remaining_installments - b.remaining_installments;
  });
  paypalItems.forEach(item => {
    const row = document.createElement('tr');
    const statusBadge = item.booked_on_giro 
      ? '<span class="badge is-booked">Gebucht</span>' 
      : '<span class="badge badge-warning">Offen</span>';
    
    row.innerHTML = `
      <td>${item.description}</td>
      <td>${item.debit_day
          ? String(item.debit_day).padStart(2, '0')
          : (item.day_of_month
              ? String(item.day_of_month).padStart(2, '0')
              : '-')}</td>
      <td class="table-amount text-bold">${formatAmount(Math.abs(item.occurrence_amount))}</td>
      <td class="table-amount">${item.total_remaining ? formatAmount(Math.abs(item.total_remaining)) : '-'}</td>
      <td>${item.remaining_installments || '-'}</td>
      <td>${item.end_date ? formatShortDate(item.end_date) : '-'}</td>
      <td class="table-amount">${item.last_installment ? formatAmount(Math.abs(item.last_installment)) : '-'}</td>
      <td>${statusBadge}</td>
      <td>
        <button class="btn btn-small btn-danger" onclick="deletePayPal('${item.id}')">Löschen</button>
      </td>
    `;
    tbody.appendChild(row);
  });
  
  container.innerHTML = '';
  container.appendChild(table);
}

function setupNavigation() {
  const navMenu = document.getElementById('nav-menu');
  const pages = [
    { name: 'dashboard', label: 'Dashboard', url: '/dashboard.html' },
    { name: 'transactions', label: 'Transaktionen', url: '/transactions.html' },
    { name: 'recurring', label: 'Wiederkehrend', url: '/recurring.html' },
    { name: 'paypal', label: 'PayPal', url: '/paypal.html' },
    { name: 'reports', label: 'Berichte', url: '/reports.html' },
    { name: 'charts', label: 'Diagramme', url: '/charts.html' },
    { name: 'admin', label: 'Admin', url: '/admin.html' },
    { name: 'categories', label: 'Kategorien', url: '/categories.html' }
  ];
  
  pages.forEach(page => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = page.url;
    a.textContent = page.label;
    if (window.location.pathname.endsWith(page.url)) a.className = 'active';
    li.appendChild(a);
    navMenu.appendChild(li);
  });
}
