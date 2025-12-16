// Authentication Module

let currentUser = null;

// Check if admin exists
async function checkAdminExists() {
  try {
    const data = await apiRequest('/auth/admin-exists');
    return data.adminExists;
  } catch (error) {
    console.error('Error checking admin existence:', error);
    return false;
  }
}

// Setup admin
async function setupAdmin(username, password, passwordConfirm) {
  try {
    const data = await apiRequest('/auth/setup', {
      method: 'POST',
      body: JSON.stringify({ username, password, password_confirm: passwordConfirm })
    });
    
    currentUser = data.user;
    return data;
  } catch (error) {
    throw error;
  }
}

// Login
async function login(username, password) {
  try {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    
    currentUser = data.user;
    return data;
  } catch (error) {
    throw error;
  }
}

// Logout
async function logout() {
  try {
    await apiRequest('/auth/logout', { method: 'POST' });
    currentUser = null;
    window.location.href = '/login.html';
  } catch (error) {
    console.error('Logout failed:', error);
    window.location.href = '/login.html';
  }
}

// Check authentication
async function checkAuth() {
  // Try to access a protected endpoint to verify session
  try {
    const accounts = await apiRequest('/accounts');
    return true;
  } catch (error) {
    return false;
  }
}

// Require authentication (redirect if not authenticated)
async function requireAuth() {
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) {
    window.location.href = '/login.html';
    return false;
  }
  return true;
}

// Get current user
function getCurrentUser() {
  return currentUser;
}

// Check if user has access to page
function hasPageAccess(pageName) {
  if (!currentUser) return false;
  return currentUser.pages.includes(pageName);
}

// Check if user is admin
function isAdmin() {
  if (!currentUser) return false;
  return currentUser.role === 'ADMIN';
}
