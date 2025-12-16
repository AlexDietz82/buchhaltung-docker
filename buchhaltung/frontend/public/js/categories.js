let categories = [];
let currentCategoryId = null;

(async function() {
  if (!(await requireAuth())) return;
  loadCategories();
  setupNavigation();
})();

async function loadCategories() {
  try {
    categories = await apiRequest('/categories');
    displayCategories();
  } catch (error) {
    showError('Fehler beim Laden der Kategorien');
  }
}

function displayCategories() {
  const container = document.getElementById('categories-list');
  const table = document.createElement('table');
  table.className = 'table';
  table.innerHTML = '<thead><tr><th>Farbe</th><th>Key</th><th>Bezeichnung</th><th>Status</th><th>Aktionen</th></tr></thead><tbody></tbody>';
  
  const tbody = table.querySelector('tbody');
  categories.forEach(category => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><span style="display: inline-block; width: 24px; height: 24px; background-color: ${category.color}; border-radius: 4px;"></span></td>
      <td>${category.key}</td>
      <td>${category.label}</td>
      <td>${category.active ? '<span class="badge badge-success">Aktiv</span>' : '<span class="badge badge-warning">Inaktiv</span>'}</td>
      <td>
        <button class="btn btn-small btn-secondary" onclick="editCategory('${category.id}')">Bearbeiten</button>
      </td>
    `;
    tbody.appendChild(row);
  });
  
  container.innerHTML = '';
  container.appendChild(table);
}

function editCategory(id) {
  const category = categories.find(c => c.id === id);
  if (!category) return;
  
  currentCategoryId = id;
  document.getElementById('modal-title').textContent = 'Kategorie bearbeiten';
  document.getElementById('category-id').value = id;
  document.getElementById('label').value = category.label;
  document.getElementById('color').value = category.color;
  document.getElementById('active').checked = category.active;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

async function saveCategory() {
  try {
    const category = categories.find(c => c.id === currentCategoryId);
    const data = {
      key: category.key,
      label: document.getElementById('label').value,
      color: document.getElementById('color').value,
      active: document.getElementById('active').checked
    };
    
    await apiRequest(`/categories/${currentCategoryId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    
    showSuccess('Kategorie aktualisiert');
    closeModal();
    loadCategories();
  } catch (error) {
    showError(error.message || 'Fehler beim Speichern');
  }
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  currentCategoryId = null;
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
