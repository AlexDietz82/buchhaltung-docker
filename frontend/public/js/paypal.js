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
    showError('Fehler beim Laden der PayPal-Pläne');
  }
}

function displayPayPal() {
  const container = document.getElementById('paypal-list');
  
  if (paypalItems.length === 0) {
    container.innerHTML = '<p class="text-muted">Keine PayPal-Ratenzahlungen vorhanden.</p>';
    return;
  }
  
  const table = document.createElement('table');
  table.className = 'table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Beschreibung</th>
        <th>Startdatum</th>
        <th>Monatliche Rate</th>
        <th>Restbetrag</th>
        <th>Verbleibende Raten</th>
        <th>Letzte Rate</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  
  const tbody = table.querySelector('tbody');
  paypalItems.forEach(item => {
    const row = document.createElement('tr');
    const statusBadge = item.booked_on_giro 
      ? '<span class="badge is-booked">Gebucht</span>' 
      : '<span class="badge badge-warning">Offen</span>';
    
    row.innerHTML = `
      <td>${item.description}</td>
      <td>${formatDatePayPal(item.start_date)}</td>
      <td class="table-amount text-bold">${formatAmount(item.occurrence_amount)}</td>
      <td class="table-amount">${item.total_remaining ? formatAmount(item.total_remaining) : '-'}</td>
      <td>${item.remaining_installments || '-'}</td>
      <td class="table-amount">${item.last_installment ? formatAmount(item.last_installment) : '-'}</td>
      <td>${statusBadge}</td>
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
