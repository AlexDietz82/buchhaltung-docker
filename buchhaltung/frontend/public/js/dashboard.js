// Dashboard page logic

let accounts = [];
let currentMonth = getCurrentMonth();
let selectedAccountId = null;
let allRecurringItems = []; // immer aktuell befüllt!

// --- Prüft, ob eine Recurring-Buchung im gegebenen Monat fällig ist ---
function isRecurringInMonth(r, year, month) {
  // month: 1-basiert (Januar = 1)
  if (!r.start_date || !r.interval) return false;
  const [sy, sm] = r.start_date.split('-').map(Number);

  // Vor dem Startmonat?
  if (year < sy || (year === sy && month < sm)) return false;

  // Enddatum prüfen, falls vorhanden
  if (r.end_date) {
    const [ey, em] = r.end_date.split('-').map(Number);
    if (year > ey || (year === ey && month > em)) return false;
  }

  // Monatlicher Rhythmus
  if (r.interval === "monthly") {
    return true;
  }
  // Quartalsweise
  if (r.interval === "quarterly") {
    const diffMonths = (year - sy) * 12 + (month - sm);
    return diffMonths >= 0 && diffMonths % 3 === 0;
  }
  // Halbjährlich
  if (r.interval === "halfyearly" || r.interval === "halbjährlich") {
    const diffMonths = (year - sy) * 12 + (month - sm);
    return diffMonths >= 0 && diffMonths % 6 === 0;
  }
  // Jährlich
  if (r.interval === "yearly" || r.interval === "jährlich") {
    return sm === month;
  }

  // Standard: nicht erkannt
  return false;
}

// --- Rücklagenberechnung pro Recurring (pro Monat/Buchung) ---
function getMonthlyReserve(r) {
  if (!r.interval || !r.occurrence_amount) return 0;
  if (r.interval === "monthly") return 0; // Rücklage nicht nötig für reine Monatsbuchung
  if (r.interval === "quarterly") return (Number(r.occurrence_amount) || 0) / 3;
  if (r.interval === "halfyearly" || r.interval === "halbjährlich") return (Number(r.occurrence_amount) || 0) / 6;
  if (r.interval === "yearly" || r.interval === "jährlich") return (Number(r.occurrence_amount) || 0) / 12;
  return 0;
}

// ===============================

// Initialize
(async function() {
  if (!(await requireAuth())) return;

  // Load accounts
  await loadAccounts();

  // Setup month selector
  const monthSelect = document.getElementById('month-select');
    // Ab VORMONAT bis 24 Monate in die Zukunft (Vor-Monat + aktueller + 23 weitere = 25 Monate)
    const now = new Date();
    const options = [];

    // Vormonat berechnen
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    options.push({
      value: `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`,
      label: `${prevMonth.toLocaleString('de-DE', { month: 'long' })} ${prevMonth.getFullYear()}`
    });

    // Aktuelle und 23 weitere Monate (24 "Zukunfts"-Monate ab jetzt)
    for (let i = 0; i < 24; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${d.toLocaleString('de-DE', { month: 'long' })} ${d.getFullYear()}`;
      options.push({ value: ym, label });
    }
  monthSelect.innerHTML = "";
  options.forEach(opt => {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    monthSelect.appendChild(option);
  });
  // Falls currentMonth leer oder nicht dabei: Standard auf ersten künftigen Monat
  monthSelect.value = currentMonth || options[0].value;

  monthSelect.addEventListener('change', (e) => {
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

      // Clear previous (so reloads don't duplicate!)
      filterDiv.innerHTML = '';

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
    console.error('Fehler beim Laden der Konten:', error);
  }
}

// ---- loadDashboard, displayAllBookings ----

async function loadDashboard() {
  document.getElementById('month-name').textContent = getMonthName(currentMonth);

  try {
    if (!accounts.length) accounts = await apiRequest('/accounts');
    const [year, month] = currentMonth.split('-').map(Number);

    // ALLE wiederkehrenden Buchungen für alle Monate
    let allRecurrings = await apiRequest('/recurring' + (selectedAccountId ? `?account_id=${selectedAccountId}` : ''));

    // ALLE Einzel-Buchungen (art=EB), für alle Monate
    let transactionsEndpoint = `/transactions?art=EB`;
    if (selectedAccountId) transactionsEndpoint += `&account_id=${selectedAccountId}`;
    let allTransactions = await apiRequest(transactionsEndpoint);

    // Recurrings und Transaktionen für die Monats-TABELLE (nur gewählter Monat)
    const monthRecurrings = allRecurrings.filter(r => isRecurringInMonth(r, year, month)).map(r => ({
      id: r.id,
      art: r.art || 'RECURRING',
      type: 'recurring',
      day_of_month: r.day_of_month,
      description: r.description,
      account_id: r.account_id,
      account_name: r.account_name,
      amount: Number(r.occurrence_amount) || 0,
      category: r.category,
      interval_count: r.interval_count,
      remaining_installments: r.remaining_installments,
      booked_on_giro: r.booked_on_giro,
      date: r.date || null
    }));

    const monthTransactions = allTransactions.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === year && (d.getMonth() + 1) === month;
    }).map(t => ({
      id: t.id,
      art: 'EB',
      type: 'transaction',
      day_of_month: new Date(t.date).getDate(),
      description: t.description,
      account_id: t.account_id,
      account_name: t.account_name,
      amount: Number(t.amount) || 0,
      category: t.category,
      interval_count: null,
      remaining_installments: null,
      booked_on_giro: t.booked_on_giro,
      date: t.date
    }));

    const monthEntries = [...monthRecurrings, ...monthTransactions];

    displayMonthlyInfo({
      allTransactions,
      allRecurrings,
      accounts,
      selYear: year,
      selMonth: month,
      selectedAccountId
    });

    displayAllBookings(monthEntries);

    allRecurringItems = allRecurrings;
  } catch (error) {
    showError('Fehler beim Laden der Dashboard-Daten');
    console.error("Fehler bei recurring- oder transactions-Request:", error);
  }
}

// --- Dashboard-Table (alle Monatsbuchungen) ---
function displayAllBookings(entries) {
  const container = document.getElementById('transactions-list');

  if (!entries || entries.length === 0) {
    container.innerHTML = '<p class="text-muted">Keine Buchungen in diesem Monat.</p>';
    return;
  }

  // Sortiere nach Tag im Monat
  entries.sort((a, b) => {
    if (!a.day_of_month && !b.day_of_month) return 0;
    if (!a.day_of_month) return 1;
    if (!b.day_of_month) return -1;
    return a.day_of_month - b.day_of_month;
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
        <th>Status</th>
        <th>Buchen</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector('tbody');

  entries.forEach(item => {
    const row = document.createElement('tr');
    const amountClass = item.amount >= 0 ? 'amount-positive' : 'amount-negative';
    
    let statusBadge = '';
    if (item.booked_on_giro === true || item.booked_on_giro === "true") {
      statusBadge = '<span class="badge is-booked">Gebucht</span>';
    } else {
      statusBadge = '<span class="badge badge-warning">Vorgemerkt</span>';
    }

    // Checkbox-Spalte
    let bookingBox = '';
    if (item.art === 'PP') {
      const remaining = Number(item.remaining_installments);
      if (remaining > 0) {
        bookingBox = `
          <input type="checkbox"
            ${item.booked_on_giro ? 'checked' : ''}
            onchange="toggleBookedStatus('${item.id}', this.checked, 'PP')"
            aria-label="Buchung ${item.description} als gebucht markieren">
        `;
      }
    } else if (item.art === 'WB' || item.art === 'EK' || item.art === 'EB') {
      bookingBox = `
        <input type="checkbox" 
          ${item.booked_on_giro ? 'checked' : ''} 
          onchange="toggleBookedStatus('${item.id}', this.checked, 'WB')" 
          aria-label="Buchung ${item.description} als gebucht markieren">
      `;
    }
    // Für art === 'EB': Keine Checkbox

    row.innerHTML = `
      <td>${item.day_of_month ? item.day_of_month + '.' : ''}</td>
      <td>${item.description || '-'}</td>
      <td>${item.account_name || ''}</td>
      <td class="table-amount ${amountClass}">${formatAmount(item.amount)}</td>
      <td>${item.category || '-'}</td>
      <td>${statusBadge}</td>
      <td style="text-align: center">${bookingBox}</td>
    `;
    tbody.appendChild(row);
  });

  container.innerHTML = '';
  container.appendChild(table);
}

// --- Dashboard-Monatsboxen (Anzeige Summen etc) ---
function displayMonthlyInfo({ allTransactions, allRecurrings, accounts, selYear, selMonth, selectedAccountId }) {
  const container = document.getElementById('monthly-info');
  const accIds = selectedAccountId ? [String(selectedAccountId)] : accounts.map(a => String(a.id));

  // Opening Balance korrekt ziehen
  const getAccountStartBalance = (account) => Number(account.opening_balance ?? 0);
  const basis = selectedAccountId
    ? (accounts.find(a => String(a.id) === String(selectedAccountId))
        ? getAccountStartBalance(accounts.find(a => String(a.id) === String(selectedAccountId))) : 0)
    : accounts.reduce((sum, a) => sum + getAccountStartBalance(a), 0);

  // Datum vor aktuellem Monat?
  function beforeThisMonth(dateStr) {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return (d.getFullYear() < selYear) ||
      (d.getFullYear() === selYear && (d.getMonth() + 1) < selMonth);
  }

  // Gebuchte Einzelbuchungen bis Monatsanfang
  let bookedTransBefore = allTransactions
    .filter(t =>
      accIds.includes(String(t.account_id)) &&
      (t.booked_on_giro === true || t.booked_on_giro === "true") &&
      beforeThisMonth(t.date)
    )
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  // Vorgemerkte Einzelbuchungen bis Monatsanfang (für Forecast!)
  let vorgemerkteTransBefore = allTransactions
    .filter(t =>
      accIds.includes(String(t.account_id)) &&
      (t.booked_on_giro === false || t.booked_on_giro === "false") &&
      beforeThisMonth(t.date)
    )
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  // Recurrings gebucht/vorgemerkt bis Monatsanfang (Forecast)
  let bookedRecBefore = 0, vorgemerkteRecBefore = 0;
  for (const r of allRecurrings) {
    if (!accIds.includes(String(r.account_id))) continue;
    for (let y = 1970; y <= selYear; y++) {
      for (let m = 1; m <= 12; m++) {
        if (y === selYear && m >= selMonth) break;
        if (isRecurringInMonth(r, y, m)) {
          if (r.booked_on_giro === true || r.booked_on_giro === "true") {
            bookedRecBefore += Number(r.occurrence_amount) || 0;
          } else if (r.booked_on_giro === false || r.booked_on_giro === "false") {
            vorgemerkteRecBefore += Number(r.occurrence_amount) || 0;
          }
        }
      }
    }
  }

  // Das Forecast-Anfangsguthaben: opening + gebucht + vorgemerkt bis inkl. Vormonat
  const anfangsGuthaben = basis + bookedTransBefore + vorgemerkteTransBefore + bookedRecBefore + vorgemerkteRecBefore;

  // Hilfsfunktion: Ist im Monat/Jahr?
  function imMonatJahr(dateStr, year, month) {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d.getFullYear() === year && (d.getMonth() + 1) === month;
  }

  // ---- VORGEMERKT: Summe aller negativen, noch nicht gebuchten Buchungen IM aktuellen Monat
  const vorgemerktTrans = allTransactions.filter(t =>
    accIds.includes(String(t.account_id)) &&
    (t.booked_on_giro === false || t.booked_on_giro === "false") &&
    (Number(t.amount) || 0) < 0 &&
    imMonatJahr(t.date, selYear, selMonth)
  );
  const vorgemerktRec = allRecurrings.filter(r =>
    accIds.includes(String(r.account_id)) &&
    isRecurringInMonth(r, selYear, selMonth) &&
    (r.booked_on_giro === false || r.booked_on_giro === "false") &&
    (Number(r.occurrence_amount) || 0) < 0
  );
  const sumVorgemerkt = [...vorgemerktTrans, ...vorgemerktRec]
    .reduce((sum, t) => sum + (Number(t.amount ?? t.occurrence_amount) || 0), 0);

  // ---- GEBUCHT (nur negative, aber im aktuellen Monat und gebucht)
  const gebuchtTrans = allTransactions.filter(t =>
    accIds.includes(String(t.account_id)) &&
    (t.booked_on_giro === true || t.booked_on_giro === "true") &&
    (Number(t.amount) || 0) < 0 &&
    imMonatJahr(t.date, selYear, selMonth)
  );
  const gebuchtRec = allRecurrings.filter(r =>
    accIds.includes(String(r.account_id)) &&
    isRecurringInMonth(r, selYear, selMonth) &&
    (r.booked_on_giro === true || r.booked_on_giro === "true") &&
    (Number(r.occurrence_amount) || 0) < 0
  );
  const sumGebucht = [...gebuchtTrans, ...gebuchtRec]
    .reduce((sum, t) => sum + (Number(t.amount ?? t.occurrence_amount) || 0), 0);

  // ---- RÜCKLAGEN: Monats-Anteil nichtmonatlicher laufender Recurrings im aktuellen Monat
  const ruecklageRecurrings = allRecurrings.filter(r => {
    if (!accIds.includes(String(r.account_id))) return false;
    if (!r.start_date) return false;
    if (r.interval === "monthly") return false;
    const [sy, sm] = r.start_date.split('-').map(Number);
    let isActive = (selYear > sy || (selYear === sy && selMonth >= sm));
    let isNotEnded = true;
    if (r.end_date) {
      const [ey, em] = r.end_date.split('-').map(Number);
      isNotEnded = (selYear < ey || (selYear === ey && selMonth <= em));
    }
    return isActive && isNotEnded;
  });
  const sumRuecklage = ruecklageRecurrings.reduce((sum, r) => {
    const val = Number(r.occurrence_amount) || 0;
    let anteil = 0;
    if (r.interval === "quarterly") anteil = val / 3;
    else if (r.interval === "halfyearly" || r.interval === "halbjährlich") anteil = val / 6;
    else if (r.interval === "yearly" || r.interval === "jährlich") anteil = val / 12;
    return sum + anteil;
  }, 0);

  // Summe ALLER (negativen UND positiven) noch nicht gebuchten Buchungen im Monat (Transaktionen + Recurrings)
  const vorgemerktTransAll = allTransactions.filter(t =>
    accIds.includes(String(t.account_id)) &&
    (t.booked_on_giro === false || t.booked_on_giro === "false") &&
    imMonatJahr(t.date, selYear, selMonth)
  );
  const vorgemerktRecAll = allRecurrings.filter(r =>
    accIds.includes(String(r.account_id)) &&
    isRecurringInMonth(r, selYear, selMonth) &&
    (r.booked_on_giro === false || r.booked_on_giro === "false")
  );
  const sumVorgemerktAll = [...vorgemerktTransAll, ...vorgemerktRecAll]
    .reduce((sum, t) => sum + (Number(t.amount ?? t.occurrence_amount) || 0), 0);

  // ---- Zwischensumme: Anfangsguthaben + ALLE gebuchten Buchungen (positiv UND negativ, Einzel & Recurring) im aktuellen Monat
  const gebuchtTransAll = allTransactions.filter(t =>
    accIds.includes(String(t.account_id)) &&
    (t.booked_on_giro === true || t.booked_on_giro === "true") &&
    imMonatJahr(t.date, selYear, selMonth)
  );
  const gebuchtRecAll = allRecurrings.filter(r =>
    accIds.includes(String(r.account_id)) &&
    isRecurringInMonth(r, selYear, selMonth) &&
    (r.booked_on_giro === true || r.booked_on_giro === "true")
  );
  const sumGebuchtAll = [...gebuchtTransAll, ...gebuchtRecAll]
    .reduce((sum, t) => sum + (Number(t.amount ?? t.occurrence_amount) || 0), 0);

  const zwischenSumme = anfangsGuthaben + sumGebuchtAll;
  const endGuthaben = anfangsGuthaben + sumVorgemerktAll + sumGebuchtAll;

  // ---- Anzeige ----
  container.innerHTML = `
    <div style="display: flex; justify-content: flex-start; gap: 48px; align-items: flex-end; flex-wrap: wrap;">
      <div>
        <div class="text-muted mb-4">Anfangsguthaben</div>
        <div class="text-bold" style="font-size:2rem">${formatAmount(anfangsGuthaben)}</div>
      </div>
      <div>
        <div class="text-muted mb-4">Vorgemerkte Buchungen</div>
        <div class="text-bold amount-negative" style="font-size:2rem">${formatAmount(sumVorgemerkt)}</div>
      </div>
      <div>
        <div class="text-muted mb-4">Gebuchte Buchungen</div>
        <div class="text-bold amount-negative" style="font-size:2rem">${formatAmount(sumGebucht)}</div>
      </div>
      <div>
        <div class="text-muted mb-4">Rücklage</div>
        <div class="text-bold amount-negative" style="font-size:2rem">${formatAmount(sumRuecklage)}</div>
      </div>
      <div>
        <div class="text-muted mb-4">Zwischensumme</div>
        <div class="text-bold" style="font-size:2rem">${formatAmount(zwischenSumme)}</div>
      </div>
      <div>
        <div class="text-muted mb-4">Endguthaben</div>
        <div class="text-bold" style="font-size:2rem">${formatAmount(endGuthaben)}</div>
      </div>
    </div>
  `;
}
function toggleBookedStatus(id, booked, art) {
  // Das aktuelle Objekt aus dem geladenen Array holen:
  const current = allRecurringItems.find(r => r.id === id);
  if (!current) {
    showError('Buchung nicht gefunden – bitte Seite neu laden!');
    return;
  }

  let updated = { ...current, booked_on_giro: booked };

  if (art === 'PP') {
    let remaining = Number(current.remaining_installments) || 0;
    if (!current.booked_on_giro && booked && remaining > 1) {
      remaining = remaining - 1;
    } else if (current.booked_on_giro && !booked) {
      remaining = remaining + 1;
    }
    updated.remaining_installments = remaining;
  }
  
  // Logging OUTSIDE the object!
  console.log('PUT recurring:', updated);
  apiRequest(`/recurring/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updated)
  })
    .then(() => loadDashboard())
    .catch(error => {
      showError('Fehler beim Aktualisieren des Status');
      console.error('Fehler beim Aktualisieren des Status:', error);
    });
}

// Navigation
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
