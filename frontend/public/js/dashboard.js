// Dashboard page logic

let accounts = [];
let currentMonth = getCurrentMonth();
let selectedAccountId = null;

// Initialize
(async function() {
  if (!(await requireAuth())) return;

  // Load accounts
  await loadAccounts();

  // Setup month selector
  document.getElementById('month-select').value = currentMonth;
  document.getElementById('month-select').addEventListener('change', (e) => {
    currentMonth = e.target.value;
    loadDashboard();
  });

  // Load dashboard data
  loadDashboard();

  // Setup navigation
  setupNavigation();
})();

// Load accounts
async function loadAccounts() {
  try {
    accounts = await apiRequest('/accounts');
    
    if (accounts.length > 0) {
      const filterDiv = document.getElementById('account-filter');
      
      const select = document.createElement('select');
      select.className = 'form-control';
      select.style.width = '300px';
      
      const allOption = document.createElement('option');
      allOption.value = '';
      allOption.textContent = 'Alle Konten';
      select.appendChild(allOption);
      
      accounts.forEach(account => {
        const option = document.createElement('option');
        option.value = account.id;
        option.textContent = `${account.name} (${formatAmount(account.current_balance)})`;
        select.appendChild(option);
      });
      
      select.addEventListener('change', (e) => {
        selectedAccountId = e.target.value || null;
        loadDashboard();
      });
      
      const label = document.createElement('label');
      label.className = 'form-label';
      label.textContent = 'Konto: ';
      label.style.marginRight = 'var(--space-8)';
      
      filterDiv.appendChild(label);
      filterDiv.appendChild(select);
    }
  } catch (error) {
    showError('Fehler beim Laden der Konten');
  }
}

// Load dashboard data
async function loadDashboard() {
  document.getElementById('month-name').textContent = getMonthName(currentMonth);
  
  try {
    // Load recurring bookings
    const recurring = await apiRequest('/recurring' + (selectedAccountId ? `?account_id=${selectedAccountId}` : ''));
    displayRecurring(recurring);
    
    // Load transactions for the month
    const [year, month] = currentMonth.split('-');
    const startDate = `${year}-${month}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    
    let endpoint = `/transactions?from=${startDate}&to=${endDate}`;
    if (selectedAccountId) {
      endpoint += `&account_id=${selectedAccountId}`;
    }
    
    const transactions = await apiRequest(endpoint);
    displayTransactions(transactions);
    
    // Calculate and display summary
    displaySummary(transactions, recurring);
  } catch (error) {
    showError('Fehler beim Laden der Dashboard-Daten');
  }
}

// Display recurring bookings
function displayRecurring(recurring) {
  const container = document.getElementById('recurring-list');
  
  if (recurring.length === 0) {
    container.innerHTML = '<p class="text-muted">Keine wiederkehrenden Buchungen vorhanden.</p>';
    return;
  }
  
  const table = document.createElement('table');
  table.className = 'table';
  
  table.innerHTML = `
    <thead>
      <tr>
        <th>Status</th>
        <th>Beschreibung</th>
        <th>Konto</th>
        <th>Betrag</th>
        <th>Intervall</th>
        <th>Kategorie</th>
      </tr>
    </thead>
    <tbody>
    </tbody>
  `;
  
  const tbody = table.querySelector('tbody');
  
  recurring.forEach(item => {
    const row = document.createElement('tr');
    
    const amount = parseFloat(item.occurrence_amount);
    const amountClass = amount >= 0 ? 'amount-positive' : 'amount-negative';
    
    // Determine checkbox display based on art
    let statusCell = '';
    if (item.art === 'PP') {
      // PayPal: Persistent checkbox with rest logic
      const checked = item.booked_on_giro ? 'checked' : '';
      statusCell = `<input type="checkbox" ${checked} onchange="toggleBookedStatus('${item.id}', this.checked)">`;
    } else if (item.art === 'EB') {
      // One-time booking: No checkbox, just "Gebucht" text
      statusCell = '<span class="badge is-booked">Gebucht</span>';
    } else {
      // EK/WB: Checkbox with status badge
      const checked = item.booked_on_giro ? 'checked' : '';
      const badgeClass = item.booked_on_giro ? 'badge-success' : 'badge-warning';
      const badgeText = item.booked_on_giro ? 'Gebucht' : 'Vorgemerkt';
      statusCell = `
        <input type="checkbox" ${checked} onchange="toggleBookedStatus('${item.id}', this.checked)">
        <span class="badge ${badgeClass}">${badgeText}</span>
      `;
    }
    
    row.innerHTML = `
      <td>${statusCell}</td>
      <td>${item.description}</td>
      <td>${item.account_name || ''}</td>
      <td class="table-amount ${amountClass}">${formatAmount(amount)}</td>
      <td>${item.interval}</td>
      <td>${item.category || '-'}</td>
    `;
    
    tbody.appendChild(row);
  });
  
  container.innerHTML = '';
  container.appendChild(table);
}

// Display transactions
function displayTransactions(transactions) {
  const container = document.getElementById('transactions-list');
  
  if (transactions.length === 0) {
    container.innerHTML = '<p class="text-muted">Keine Transaktionen in diesem Monat.</p>';
    return;
  }
  
  const table = document.createElement('table');
  table.className = 'table';
  
  table.innerHTML = `
    <thead>
      <tr>
        <th>Datum</th>
        <th>Beschreibung</th>
        <th>Konto</th>
        <th>Betrag</th>
        <th>Kategorie</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
    </tbody>
  `;
  
  const tbody = table.querySelector('tbody');
  
  transactions.forEach(item => {
    const row = document.createElement('tr');
    
    const amount = parseFloat(item.amount);
    const amountClass = amount >= 0 ? 'amount-positive' : 'amount-negative';
    
    const statusBadge = item.booked_on_giro 
      ? '<span class="badge is-booked">Gebucht</span>' 
      : '<span class="badge badge-warning">Vorgemerkt</span>';
    
    row.innerHTML = `
      <td>${formatDateDay(item.date)}</td>
      <td>${item.description}</td>
      <td>${item.account_name || ''}</td>
      <td class="table-amount ${amountClass}">${formatAmount(amount)}</td>
      <td>${item.category || '-'}</td>
      <td>${statusBadge}</td>
    `;
    
    tbody.appendChild(row);
  });
  
  container.innerHTML = '';
  container.appendChild(table);
}

// Display summary
function displaySummary(transactions, recurring) {
  const container = document.getElementById('summary');
  
  let income = 0;
  let expenses = 0;
  
  // Sum transactions
  transactions.forEach(t => {
    const amount = parseFloat(t.amount);
    if (amount > 0) {
      income += amount;
    } else {
      expenses += Math.abs(amount);
    }
  });
  
  // Sum recurring (monthly normalized)
  recurring.forEach(r => {
    const monthlyAmount = calculateNormalizedMonthlyAmount(parseFloat(r.occurrence_amount), r.interval);
    if (monthlyAmount > 0) {
      income += monthlyAmount;
    } else {
      expenses += Math.abs(monthlyAmount);
    }
  });
  
  const balance = income - expenses;
  const balanceClass = balance >= 0 ? 'amount-positive' : 'amount-negative';
  
  container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-16);">
      <div class="card" style="text-align: center;">
        <h4>Einnahmen</h4>
        <p class="text-bold amount-positive" style="font-size: 1.5rem;">${formatAmount(income)}</p>
      </div>
      <div class="card" style="text-align: center;">
        <h4>Ausgaben</h4>
        <p class="text-bold amount-negative" style="font-size: 1.5rem;">${formatAmount(expenses)}</p>
      </div>
      <div class="card" style="text-align: center;">
        <h4>Saldo</h4>
        <p class="text-bold ${balanceClass}" style="font-size: 1.5rem;">${formatAmount(balance)}</p>
      </div>
    </div>
  `;
}

// Toggle booked status
async function toggleBookedStatus(id, booked) {
  try {
    await apiRequest(`/recurring/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ booked_on_giro: booked })
    });
    
    loadDashboard();
  } catch (error) {
    showError('Fehler beim Aktualisieren des Status');
  }
}

// Setup navigation
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
    
    if (window.location.pathname.endsWith(page.url)) {
      a.className = 'active';
    }
    
    li.appendChild(a);
    navMenu.appendChild(li);
  });
}
