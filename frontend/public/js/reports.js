let currentMonth = getCurrentMonth();

(async function() {
  if (!(await requireAuth())) return;
  document.getElementById('month-select').value = currentMonth;
  document.getElementById('month-select').addEventListener('change', (e) => {
    currentMonth = e.target.value;
    loadReport();
  });
  loadReport();
  setupNavigation();
})();

async function loadReport() {
  try {
    const data = await apiRequest(`/reports/monthly?month=${currentMonth}`);
    displaySummary(data.totals);
    displayTransactions(data.transactions);
  } catch (error) {
    showError('Fehler beim Laden des Berichts');
  }
}

function displaySummary(totals) {
  const container = document.getElementById('summary-block');
  container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-16); margin-bottom: var(--space-24);">
      <div class="card" style="text-align: center;">
        <h4>Einnahmen</h4>
        <p class="text-bold amount-positive" style="font-size: 1.5rem;">${formatAmount(totals.income)}</p>
      </div>
      <div class="card" style="text-align: center;">
        <h4>Ausgaben</h4>
        <p class="text-bold amount-negative" style="font-size: 1.5rem;">${formatAmount(totals.expenses)}</p>
      </div>
      <div class="card" style="text-align: center;">
        <h4>Saldo</h4>
        <p class="text-bold ${totals.balance >= 0 ? 'amount-positive' : 'amount-negative'}" style="font-size: 1.5rem;">${formatAmount(totals.balance)}</p>
      </div>
    </div>
  `;
}

function displayTransactions(transactions) {
  const container = document.getElementById('transactions-list');
  
  if (transactions.length === 0) {
    container.innerHTML = '<p class="text-muted">Keine Transaktionen in diesem Monat.</p>';
    return;
  }
  
  const table = document.createElement('table');
  table.className = 'table';
  table.innerHTML = '<thead><tr><th>Datum</th><th>Beschreibung</th><th>Konto</th><th>Betrag</th><th>Kategorie</th></tr></thead><tbody></tbody>';
  
  const tbody = table.querySelector('tbody');
  transactions.forEach(t => {
    const row = document.createElement('tr');
    const amount = parseFloat(t.amount);
    const amountClass = amount >= 0 ? 'amount-positive' : 'amount-negative';
    row.innerHTML = `
      <td>${formatDateGerman(t.date)}</td>
      <td>${t.description}</td>
      <td>${t.account_name}</td>
      <td class="table-amount ${amountClass}">${formatAmount(amount)}</td>
      <td>${t.category || '-'}</td>
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
