// Recurring page logic - WB/EK besser mit Intervall/Monat/Tag dynamisch

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

function formatDateGerman(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date)) return '-';
  // Format: TT.MM.JJJJ
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
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
        <th>Monat der ersten Fälligkeit</th>
        <th>Tag</th>
        <th>Startdatum</th>
        <th>Enddatum</th>
        <th>Aktionen</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  
  const monthName = m => {
    const names = ['-', 'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    return (m && m >= 1 && m <= 12) ? names[m] : '-';
  };

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
      <td>${item.interval || '-'}</td>
      <td>${item.due_month ? monthName(item.due_month) : '-'}</td>
      <td>${item.day_of_month ? item.day_of_month + '.' : '-'}</td>
      <td>${formatDateGerman(item.start_date)}</td>
      <td>${item.end_date ? formatDateGerman(item.end_date) : '-'}</td>
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
  updateRecurringFormFields(); // Intervall-Felder steuern
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
  document.getElementById('occurrence_amount').value = Math.abs(item.occurrence_amount); // Eingabefeld immer positiv anzeigen!
  document.getElementById('payment_method').value = item.payment_method;
  document.getElementById('start_date').value = item.start_date;
  document.getElementById('end_date').value = item.end_date || '';
  document.getElementById('category').value = item.category || '';
  document.getElementById('note').value = item.note || '';
  document.getElementById('booked_on_giro').checked = item.booked_on_giro;
  document.getElementById('day_of_month').value =
    item.day_of_month !== undefined && item.day_of_month !== null
      ? item.day_of_month
      : '';
  // Due month Feld
  const dm = document.getElementById('due_month');
  if (dm && item.due_month) {
    dm.value = item.due_month;
  }
  populateAccountSelect();
  populateCategorySelect();
  updateRecurringFormFields();
  document.getElementById('modal-overlay').classList.remove('hidden');
}

// Dynamische Anzeige von "Monat der ersten Fälligkeit"
function updateRecurringFormFields() {
  const interval = document.getElementById('interval').value;
  const dueMonthGroup = document.getElementById('due_month_group');
  // Tag im Monat ist immer sichtbar! (default im HTML)
  if (interval === 'monthly') {
    dueMonthGroup.style.display = 'none';
  } else {
    dueMonthGroup.style.display = '';
  }
}

async function saveRecurring() {
  try {
    function getFieldValue(id, type = 'text') {
      const el = document.getElementById(id);
      if (!el) {
        showError(`Fehler: Feld "${id}" (ID: "${id}") existiert nicht im Formular! Überprüfe das HTML oder die Sichtbarkeit.`);
        console.error(new Error(`Feld "${id}" fehlt im DOM!`));
        throw new Error(`Feld "${id}" fehlt im DOM!`);
      }
      return type === 'checkbox' ? el.checked : el.value;
    }

    function isValidDate(d) {
      return d instanceof Date && !isNaN(d);
    }

    const startDateString = getFieldValue('start_date');
    const endDateString = getFieldValue('end_date');
    const startDate = new Date(startDateString);
    const endDate = endDateString ? new Date(endDateString) : null;
    if (!isValidDate(startDate)) {
      showError('Fehler im Startdatum: Das angegebene Startdatum ist ungültig.');
      return;
    }
    if (endDate && !isValidDate(endDate)) {
      showError('Fehler im Enddatum: Das angegebene Enddatum ist ungültig.');
      return;
    }
    if (endDate && endDate < startDate) {
      showError('Fehler: Das Enddatum darf nicht vor dem Startdatum liegen.');
      return;
    }

    const art = getFieldValue('art');
    const interval = getFieldValue('interval');
    // due_month NUR wenn nicht monatlich:
    let due_month = null;
    if (interval !== 'monthly') {
      due_month = parseInt(getFieldValue('due_month'), 10);
      if (!due_month || due_month < 1 || due_month > 12) {
        showError('Bitte einen gültigen Monat für die erste Fälligkeit wählen.');
        return;
      }
    }

    // ----- VORZEICHENLOGIK: Nur EK positiv, alles andere negativ -----
    let occurrence_amount = parseFloat(getFieldValue('occurrence_amount'));
    if (art === 'EK') {
      occurrence_amount = Math.abs(occurrence_amount); // Einnahmen immer positiv
    } else {
      occurrence_amount = -Math.abs(occurrence_amount); // Ausgaben (und alles andere) immer negativ
    }
    // ---------------------------------------------------------------

    const data = {
      account_id: getFieldValue('account_id'),
      description: getFieldValue('description'),
      art,
      interval,
      interval_count:
        interval === 'monthly' ? 1
        : interval === 'quarterly' ? 3
        : interval === 'semiannual' ? 6
        : interval === 'yearly' ? 12
        : 1,
      occurrence_amount: occurrence_amount,
      start_date: startDateString,
      day_of_month: parseInt(getFieldValue('day_of_month'), 10),
      due_month: due_month, // Neu!
      end_date: endDateString || null,
      category: getFieldValue('category') || null,
      payment_method: getFieldValue('payment_method'),
      note: getFieldValue('note') || null,
      booked_on_giro: getFieldValue('booked_on_giro', 'checkbox')
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
    console.error(error);
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

  // Event Listener für Intervall-Auswahl (Dynamik)
  const intervalSel = document.getElementById('interval');
  if (intervalSel) {
    intervalSel.removeEventListener('change', updateRecurringFormFields); // doppelt vermeiden
    intervalSel.addEventListener('change', updateRecurringFormFields);
  }
}

// -------- Hilfsfunktion für ISO-Datum im Formular --------
function formatDateISO(date) {
  // Ausgabe: YYYY-MM-DD
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d)) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
