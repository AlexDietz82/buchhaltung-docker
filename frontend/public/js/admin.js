let users = [];
let accounts = [];
let currentUserId = null;
let currentAccountId = null;

(async function() {
  if (!(await requireAuth())) return;
  loadUsers();
  loadAccounts();
  setupNavigation();
})();

async function loadUsers() {
  try {
    users = await apiRequest('/users');
    displayUsers();
  } catch (error) {
    showError('Fehler beim Laden der Benutzer');
  }
}

async function loadAccounts() {
  try {
    accounts = await apiRequest('/accounts');
    displayAccounts();
  } catch (error) {
    showError('Fehler beim Laden der Konten');
  }
}

function displayUsers() {
  const container = document.getElementById('users-list');
  const table = document.createElement('table');
  table.className = 'table';
  table.innerHTML = '<thead><tr><th>Benutzername</th><th>Rolle</th><th>Status</th><th>Aktionen</th></tr></thead><tbody></tbody>';
  
  const tbody = table.querySelector('tbody');
  users.forEach(user => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${user.username}</td>
      <td>${user.role}</td>
      <td>${user.active ? '<span class="badge badge-success">Aktiv</span>' : '<span class="badge badge-warning">Inaktiv</span>'}</td>
      <td>
        <button class="btn btn-small btn-secondary" onclick="editUser('${user.id}')">Bearbeiten</button>
        <button class="btn btn-small btn-danger" onclick="deleteUser('${user.id}')">Löschen</button>
      </td>
    `;
    tbody.appendChild(row);
  });
  
  container.innerHTML = '';
  container.appendChild(table);
}

function displayAccounts() {
  const container = document.getElementById('accounts-list');
  const table = document.createElement('table');
  table.className = 'table';
  table.innerHTML = '<thead><tr><th>Name</th><th>Eröffnungssaldo</th><th>Aktueller Saldo</th><th>Aktionen</th></tr></thead><tbody></tbody>';
  
  const tbody = table.querySelector('tbody');
  accounts.forEach(account => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${account.name}</td>
      <td class="table-amount">${formatAmount(account.opening_balance)}</td>
      <td class="table-amount text-bold">${formatAmount(account.current_balance)}</td>
      <td>
        <button class="btn btn-small btn-secondary" onclick="editAccount('${account.id}')">Bearbeiten</button>
        <button class="btn btn-small btn-danger" onclick="deleteAccount('${account.id}')">Löschen</button>
      </td>
    `;
    tbody.appendChild(row);
  });
  
  container.innerHTML = '';
  container.appendChild(table);
}

function showAddUserModal() {
  currentUserId = null;
  document.getElementById('user-modal-title').textContent = 'Neuer Benutzer';
  document.getElementById('user-form').reset();
  document.getElementById('password').required = true;
  document.getElementById('user-modal-overlay').classList.remove('hidden');
}

function editUser(id) {
  const user = users.find(u => u.id === id);
  if (!user) return;
  
  currentUserId = id;
  document.getElementById('user-modal-title').textContent = 'Benutzer bearbeiten';
  document.getElementById('user-id').value = id;
  document.getElementById('username').value = user.username;
  document.getElementById('password').value = '';
  document.getElementById('password').required = false;
  document.getElementById('role').value = user.role;
  document.getElementById('active').checked = user.active;
  document.getElementById('user-modal-overlay').classList.remove('hidden');
}

async function saveUser() {
  try {
    const data = {
      username: document.getElementById('username').value,
      password: document.getElementById('password').value || undefined,
      role: document.getElementById('role').value,
      pages: ['dashboard', 'transactions', 'recurring', 'paypal', 'paypalneu', 'reports', 'charts', 'admin', 'categories'],
      accounts: [],
      active: document.getElementById('active').checked
    };
    
    if (currentUserId) {
      await apiRequest(`/users/${currentUserId}`, { method: 'PUT', body: JSON.stringify(data) });
      showSuccess('Benutzer aktualisiert');
    } else {
      await apiRequest('/users', { method: 'POST', body: JSON.stringify(data) });
      showSuccess('Benutzer erstellt');
    }
    
    closeUserModal();
    loadUsers();
  } catch (error) {
    showError(error.message || 'Fehler beim Speichern');
  }
}

async function deleteUser(id) {
  if (!confirm('Benutzer wirklich löschen?')) return;
  
  try {
    await apiRequest(`/users/${id}`, { method: 'DELETE' });
    showSuccess('Benutzer gelöscht');
    loadUsers();
  } catch (error) {
    showError(error.message || 'Fehler beim Löschen');
  }
}

function closeUserModal() {
  document.getElementById('user-modal-overlay').classList.add('hidden');
  currentUserId = null;
}

function showAddAccountModal() {
  currentAccountId = null;
  document.getElementById('account-modal-title').textContent = 'Neues Konto';
  document.getElementById('account-form').reset();
  document.getElementById('account-modal-overlay').classList.remove('hidden');
}

function editAccount(id) {
  const account = accounts.find(a => a.id === id);
  if (!account) return;
  
  currentAccountId = id;
  document.getElementById('account-modal-title').textContent = 'Konto bearbeiten';
  document.getElementById('account-id').value = id;
  document.getElementById('account-name').value = account.name;
  document.getElementById('opening_balance').value = account.opening_balance;
  document.getElementById('account-modal-overlay').classList.remove('hidden');
}

async function saveAccount() {
  try {
    const data = {
      name: document.getElementById('account-name').value,
      opening_balance: parseFloat(document.getElementById('opening_balance').value),
      currency: 'EUR'
    };
    
    if (currentAccountId) {
      await apiRequest(`/accounts/${currentAccountId}`, { method: 'PUT', body: JSON.stringify(data) });
      showSuccess('Konto aktualisiert');
    } else {
      await apiRequest('/accounts', { method: 'POST', body: JSON.stringify(data) });
      showSuccess('Konto erstellt');
    }
    
    closeAccountModal();
    loadAccounts();
  } catch (error) {
    showError(error.message || 'Fehler beim Speichern');
  }
}

async function deleteAccount(id) {
  if (!confirm('Konto wirklich löschen?')) return;
  
  try {
    await apiRequest(`/accounts/${id}`, { method: 'DELETE' });
    showSuccess('Konto gelöscht');
    loadAccounts();
  } catch (error) {
    showError(error.message || 'Fehler beim Löschen');
  }
}

function closeAccountModal() {
  document.getElementById('account-modal-overlay').classList.add('hidden');
  currentAccountId = null;
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
