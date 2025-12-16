let currentMonth = getCurrentMonth();
let chart = null;

(async function() {
  if (!(await requireAuth())) return;
  document.getElementById('month-select').value = currentMonth;
  document.getElementById('month-select').addEventListener('change', (e) => {
    currentMonth = e.target.value;
    loadChart();
  });
  loadChart();
  setupNavigation();
})();

async function loadChart() {
  try {
    const data = await apiRequest(`/reports/charts?month=${currentMonth}`);
    displayChart(data.data);
  } catch (error) {
    showError('Fehler beim Laden der Chart-Daten');
  }
}

function displayChart(data) {
  if (data.length === 0) {
    document.getElementById('chart-container').innerHTML = '<p class="text-muted">Keine Daten für diesen Monat.</p>';
    return;
  }
  
  const ctx = document.getElementById('pie-chart').getContext('2d');
  
  if (chart) {
    chart.destroy();
  }
  
  chart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: data.map(d => d.label),
      datasets: [{
        data: data.map(d => d.amount),
        backgroundColor: data.map(d => d.color)
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  });
  
  displayLegend(data);
}

function displayLegend(data) {
  const container = document.getElementById('legend-container');
  const table = document.createElement('table');
  table.className = 'table';
  table.innerHTML = '<thead><tr><th>Kategorie</th><th>Betrag</th><th>Anteil</th></tr></thead><tbody></tbody>';
  
  const total = data.reduce((sum, d) => sum + d.amount, 0);
  const tbody = table.querySelector('tbody');
  
  data.forEach(d => {
    const row = document.createElement('tr');
    const percentage = ((d.amount / total) * 100).toFixed(1);
    row.innerHTML = `
      <td><span style="display: inline-block; width: 16px; height: 16px; background-color: ${d.color}; margin-right: 8px; border-radius: 3px;"></span>${d.label}</td>
      <td class="table-amount text-bold">${formatAmount(d.amount)}</td>
      <td>${percentage}%</td>
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
