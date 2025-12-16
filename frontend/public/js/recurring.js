// Recurring page logic - similar structure to transactions
let accounts = [];
let categories = [];
let recurringItems = [];
let currentRecurringId = null;

(async function() {
  if (!(await requireAuth())) return;
  await loadAccounts();
  await loadCategories();
  loadRecurring();
  setupNavigation();
})();

async function loadAccounts() {
  try {
    accounts = await apiRequest('/accounts');
  } catch (error) {
    showError('Fehler beim Laden der Konten');
  }
}

async function loadCategories() {
  try {
    categories = await apiRequest('/categories');
  } catch (error) {
    showError('Fehler beim Laden der Kategorien');
  }
}

async function loadRecurring() {
  try {
    recurringItems = await apiRequest('/recurring');
    recurringItems = recurringItems.filter(r => r.art === 'WB' || r.art === 'EK');
    displayRecurring();
  } catch (error) {
    showError('Fehler beim Laden der wiederkehrenden Buchungen');
  }
}

function displayRecurring() {
  const container = document.getElementById('recurring-list');
  
  if (recurringItems.length === 0) {
    container.innerHTML = '<p class="text-muted">Keine wiederkehrenden Buchungen vorhanden.</p>';
    return;
  }
  
  const table = document.createElement('table');
  table.className = 'table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Beschreibung</th>
        <th>Art</th>
        <th>Konto</th>
        <th>Betrag</th>
        <th>Intervall</th>
        <th>Startdatum</th>
        <th>Aktionen</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  
  const tbody = table.querySelector('tbody');
  recurringItems.forEach(item => {
    const row = document.createElement('tr');
    const amount = parseFloat(item.occurrence_amount);
    const amountClass = amount >= 0 ? 'amount-positive' : 'amount-negative';
    
    row.innerHTML = `
      <td>${item.description}</td>
      <td>${item.art}</td>
      <td>${item.account_name || ''}</td>
      <td class="table-amount ${amountClass}">${formatAmount(amount)}</td>
      <td>${item.interval}</td>
      <td>${formatDateGerman(item.start_date)}</td>
      <td>
        <button class="btn btn-small btn-secondary" onclick="editRecurring('${item.id}')">Bearbeiten</button>
        <button class="btn btn-small btn-danger" onclick="deleteRecurring('${item.id}')">Löschen</button>
      </td>
    `;
    tbody.appendChild(row);
  });
  
  container.innerHTML = '';
  container.appendChild(table);
}

function showAddModal() {
  currentRecurringId = null;
  document.getElementById('modal-title').textContent = 'Neue wiederkehrende Buchung';
  document.getElementById('recurring-form').reset();
  document.getElementById('start_date').value = formatDateISO(new Date());
  populateAccountSelect();
  populateCategorySelect();
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function editRecurring(id) {
  const item = recurringItems.find(r => r.id === id);
  if (!item) return;
  
  currentRecurringId = id;
  document.getElementById('modal-title').textContent = 'Wiederkehrende Buchung bearbeiten';
  document.getElementById('recurring-id').value = id;
  document.getElementById('account_id').value = item.account_id;
  document.getElementById('description').value = item.description;
  document.getElementById('art').value = item.art;
  document.getElementById('interval').value = item.interval;
  document.getElementById('occurrence_amount').value = item.occurrence_amount;
  document.getElementById('payment_method').value = item.payment_method;
  document.getElementById('start_date').value = item.start_date;
  document.getElementById('end_date').value = item.end_date || '';
  document.getElementById('category').value = item.category || '';
  document.getElementById('note').value = item.note || '';
  document.getElementById('booked_on_giro').checked = item.booked_on_giro;
  
  populateAccountSelect();
  populateCategorySelect();
  document.getElementById('modal-overlay').classList.remove('hidden');
}

async function saveRecurring() {
  try {
    const data = {
      account_id: document.getElementById('account_id').value,
      description: document.getElementById('description').value,
      art: document.getElementById('art').value,
      interval: document.getElementById('interval').value,
      occurrence_amount: parseFloat(document.getElementById('occurrence_amount').value),
      payment_method: document.getElementById('payment_method').value,
      start_date: document.getElementById('start_date').value,
      end_date: document.getElementById('end_date').value || null,
      category: document.getElementById('category').value || null,
      note: document.getElementById('note').value || null,
      booked_on_giro: document.getElementById('booked_on_giro').checked,
      interval_count: 1
    };
    
    if (currentRecurringId) {
      await apiRequest(`/recurring/${currentRecurringId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      showSuccess('Wiederkehrende Buchung aktualisiert');
    } else {
      await apiRequest('/recurring', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      showSuccess('Wiederkehrende Buchung erstellt');
    }
    
    closeModal();
    loadRecurring();
  } catch (error) {
    showError(error.message || 'Fehler beim Speichern');
  }
}

async function deleteRecurring(id) {
  if (!confirm('Wiederkehrende Buchung wirklich löschen?')) return;
  
  try {
    await apiRequest(`/recurring/${id}`, { method: 'DELETE' });
    showSuccess('Wiederkehrende Buchung gelöscht');
    loadRecurring();
  } catch (error) {
    showError('Fehler beim Löschen');
  }
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  currentRecurringId = null;
}

function populateAccountSelect() {
  const select = document.getElementById('account_id');
  select.innerHTML = '';
  accounts.forEach(account => {
    const option = document.createElement('option');
    option.value = account.id;
    option.textContent = account.name;
    select.appendChild(option);
  });
}

function populateCategorySelect() {
  const select = document.getElementById('category');
  select.innerHTML = '<option value="">Keine Kategorie</option>';
  categories.filter(c => c.active).forEach(category => {
    const option = document.createElement('option');
    option.value = category.key;
    option.textContent = category.label;
    select.appendChild(option);
  });
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
