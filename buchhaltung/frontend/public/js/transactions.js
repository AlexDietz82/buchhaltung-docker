// Transactions page logic

let accounts = [];
let categories = [];
let transactions = [];
let selectedAccountId = null;
let currentTransactionId = null;

// Initialize
(async function() {
  if (!(await requireAuth())) return;

  await loadAccounts();
  await loadCategories();
  setupFilters();
  loadTransactions();
  setupNavigation();
})();

// Load accounts
async function loadAccounts() {
  try {
    accounts = await apiRequest('/accounts');
  } catch (error) {
    showError('Fehler beim Laden der Konten');
  }
}

// Load categories
async function loadCategories() {
  try {
    categories = await apiRequest('/categories');
  } catch (error) {
    showError('Fehler beim Laden der Kategorien');
  }
}


// Setup filters
function setupFilters() {
  const filterDiv = document.getElementById('filters');
  
  if (accounts.length > 0) {
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
      option.textContent = account.name;
      select.appendChild(option);
    });
    
    select.addEventListener('change', (e) => {
      selectedAccountId = e.target.value || null;
      loadTransactions();
    });
    
    const label = document.createElement('label');
    label.className = 'form-label';
    label.textContent = 'Konto: ';
    label.style.marginRight = 'var(--space-8)';
    
    filterDiv.appendChild(label);
    filterDiv.appendChild(select);
  }
}

// Load transactions
async function loadTransactions() {
  try {
    let endpoint = '/transactions?';
    if (selectedAccountId) {
      endpoint += `account_id=${selectedAccountId}`;
    }
    
    transactions = await apiRequest(endpoint);
    
    // Filter to only EB transactions
    transactions = transactions.filter(t => t.art === 'EB');
    
    displayTransactions();
  } catch (error) {
    showError('Fehler beim Laden der Transaktionen');
  }
}

function formatDateGerman(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date)) return '-';
  // Format: TT.MM.JJJJ
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
}

// Display transactions
function displayTransactions() {
  const container = document.getElementById('transactions-list');
  
  if (transactions.length === 0) {
    container.innerHTML = '<p class="text-muted">Keine Transaktionen vorhanden.</p>';
    return;
  }
    // Direkt am Anfang von displayTransactions
    transactions.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      // Null/undefiniert immer ans Ende:
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return dateA - dateB;
    });

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
        <th>Zahlungsmethode</th>
        <th>Status</th>
        <th>Aktionen</th>
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
    
    const fileCount = item.files && item.files.length > 0 ? ` (${item.files.length} PDF)` : '';
    
    row.innerHTML = `
      <td>${formatDateGerman(item.date)}</td>
      <td>${item.description}${fileCount}</td>
      <td>${item.account_name || ''}</td>
      <td class="table-amount ${amountClass}">${formatAmount(amount)}</td>
      <td>${item.category || '-'}</td>
      <td>${item.payment_method}</td>
      <td>${statusBadge}</td>
      <td>
        <button class="btn btn-small btn-secondary" onclick="editTransaction('${item.id}')">Bearbeiten</button>
        <button class="btn btn-small btn-danger" onclick="deleteTransaction('${item.id}')">Löschen</button>
      </td>
    `;
    
    tbody.appendChild(row);
  });
  
  container.innerHTML = '';
  container.appendChild(table);
}

// Show add modal
function showAddModal() {
  currentTransactionId = null;
  document.getElementById('modal-title').textContent = 'Neue Buchung';
  document.getElementById('transaction-form').reset();
  document.getElementById('transaction-id').value = '';
  document.getElementById('date').value = formatDateISO(new Date());
  
  populateAccountSelect();
  populateCategorySelect();
  
  document.getElementById('modal-overlay').classList.remove('hidden');
}

// Edit transaction
async function editTransaction(id) {
  try {
    const transaction = transactions.find(t => t.id === id);
    
    if (!transaction) {
      showError('Transaktion nicht gefunden');
      return;
    }
    
    currentTransactionId = id;
    document.getElementById('modal-title').textContent = 'Buchung bearbeiten';
    document.getElementById('transaction-id').value = id;
    
    document.getElementById('account_id').value = transaction.account_id;
    document.getElementById('date').value = transaction.date;
    document.getElementById('amount').value = transaction.amount;
    document.getElementById('description').value = transaction.description;
    document.getElementById('payment_method').value = transaction.payment_method;
    document.getElementById('category').value = transaction.category || '';
    document.getElementById('note').value = transaction.note || '';
    document.getElementById('booked_on_giro').checked = transaction.booked_on_giro;
    
    populateAccountSelect();
    populateCategorySelect();
    
    // Display existing files
    displayFiles(transaction.files || []);
    
    document.getElementById('modal-overlay').classList.remove('hidden');
  } catch (error) {
    showError('Fehler beim Laden der Transaktion');
  }
}

// Save transaction
async function saveTransaction() {
  try {
    // Hole Typ und Betrag
    const rawAmount = Math.abs(parseFloat(document.getElementById('amount').value) || 0);
    const type = document.getElementById('transaction_type').value; // 'income' oder 'expense'
    const amount = (type === 'expense') ? -rawAmount : rawAmount;

    const data = {
      account_id: document.getElementById('account_id').value,
      date: document.getElementById('date').value,
      amount: amount, // <-- Vorzeichen jetzt automatisch korrekt
      description: document.getElementById('description').value,
      payment_method: document.getElementById('payment_method').value,
      category: document.getElementById('category').value || null,
      note: document.getElementById('note').value || null,
      art: 'EB',
      booked_on_giro: document.getElementById('booked_on_giro').checked
    };
    
    let result;
    if (currentTransactionId) {
      result = await apiRequest(`/transactions/${currentTransactionId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      showSuccess('Buchung aktualisiert');
    } else {
      result = await apiRequest('/transactions', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      showSuccess('Buchung erstellt');
    }
    
    // Handle file uploads
    const fileInput = document.getElementById('file-input');
    if (fileInput.files.length > 0) {
      await uploadFiles(result.id || currentTransactionId, fileInput.files);
    }
    
    closeModal();
    loadTransactions();
  } catch (error) {
    showError(error.message || 'Fehler beim Speichern');
  }
}

// Upload files
async function uploadFiles(transactionId, files) {
  for (const file of files) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('kind', 'receipt');
    
    try {
      await fetch(`/api/transactions/${transactionId}/files`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
    } catch (error) {
      console.error('Error uploading file:', error);
    }
  }
}

// Display files
function displayFiles(files) {
  const fileList = document.getElementById('file-list');
  fileList.innerHTML = '';
  
  files.forEach(file => {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    fileItem.innerHTML = `
      <span>${file.filename_original}</span>
      <div>
        <a href="/api/files/${file.id}" class="btn btn-small btn-secondary" download>Download</a>
        <button class="btn btn-small btn-danger" onclick="deleteFile('${file.id}')">Löschen</button>
      </div>
    `;
    fileList.appendChild(fileItem);
  });
}

// Delete file
async function deleteFile(fileId) {
  if (!confirm('Datei wirklich löschen?')) return;
  
  try {
    await apiRequest(`/transactions/${currentTransactionId}/files/${fileId}`, {
      method: 'DELETE'
    });
    
    showSuccess('Datei gelöscht');
    loadTransactions();
    
    // Reload current transaction to update file list
    if (currentTransactionId) {
      editTransaction(currentTransactionId);
    }
  } catch (error) {
    showError('Fehler beim Löschen der Datei');
  }
}

// Delete transaction
async function deleteTransaction(id) {
  if (!confirm('Buchung wirklich löschen?')) return;
  
  try {
    await apiRequest(`/transactions/${id}`, { method: 'DELETE' });
    showSuccess('Buchung gelöscht');
    loadTransactions();
  } catch (error) {
    showError('Fehler beim Löschen');
  }
}

// Close modal
function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('transaction-form').reset();
  currentTransactionId = null;
}

// Populate account select
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

// Populate category select
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

// Setup navigation (reuse from dashboard)
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

// -------- Hilfsfunktion für ISO-Datum im Formular --------
function formatDateISO(date) {
  // Ausgabe: YYYY-MM-DD
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d)) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
