// Admin dashboard logic. Token is kept in memory (a variable) + sessionStorage
// so a page refresh during the demo doesn't force re-login; it is never the
// PIN itself, just a signed, expiring token issued by /api/admin/login.

const POSITION_LABELS = { player: 'Player', gk: 'Goal Keeper', sub: 'Substitution' };
const TOKEN_KEY = 'madina_admin_token';

let token = sessionStorage.getItem(TOKEN_KEY) || null;
let latestSettings = null;
let latestRegistrations = [];

const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const loginForm = document.getElementById('login-form');
const loginMessage = document.getElementById('login-message');
const dashboardMessage = document.getElementById('dashboard-message');
const logoutBtn = document.getElementById('logout-btn');

const scheduleForm = document.getElementById('schedule-form');
const capacityForm = document.getElementById('capacity-form');
const toggleRegistrationBtn = document.getElementById('toggle-registration-btn');
const registrationStatusLabel = document.getElementById('registration-status-label');
const adminPlayerLists = document.getElementById('admin-player-lists');
const addPlayerForm = document.getElementById('add-player-form');
const addPlayerMessage = document.getElementById('add-player-message');
const copyListBtn = document.getElementById('copy-list-btn');
const copyConfirm = document.getElementById('copy-confirm');
const newSessionBtn = document.getElementById('new-session-btn');

function showLogin() {
  loginScreen.classList.remove('hidden');
  dashboardScreen.classList.add('hidden');
}

function showDashboard() {
  loginScreen.classList.add('hidden');
  dashboardScreen.classList.remove('hidden');
}

function showMessage(el, text, kind) {
  el.textContent = text;
  el.className = 'mb-4 rounded-lg px-3 py-2 text-sm ' + (kind === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700');
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3000);
}

async function authedFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
  if (res.status === 401) {
    token = null;
    sessionStorage.removeItem(TOKEN_KEY);
    showLogin();
    throw new Error('Session expired. Please log in again.');
  }
  return res;
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginMessage.classList.add('hidden');
  const pin = document.getElementById('pin').value.trim();

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    const data = await res.json();
    if (!res.ok) {
      loginMessage.textContent = data.error || 'Login failed.';
      loginMessage.classList.remove('hidden');
      return;
    }
    token = data.token;
    sessionStorage.setItem(TOKEN_KEY, token);
    loginForm.reset();
    await enterDashboard();
  } catch (err) {
    console.error(err);
    loginMessage.textContent = 'Network error. Please try again.';
    loginMessage.classList.remove('hidden');
  }
});

logoutBtn.addEventListener('click', () => {
  token = null;
  sessionStorage.removeItem(TOKEN_KEY);
  showLogin();
});

async function enterDashboard() {
  showDashboard();
  await loadAll();
}

async function loadAll() {
  try {
    const [settingsRes, registrationsRes] = await Promise.all([
      authedFetch('/api/admin/settings'),
      authedFetch('/api/registrations'),
    ]);
    const settingsData = await settingsRes.json();
    const registrationsData = await registrationsRes.json();

    latestSettings = settingsData.settings;
    latestRegistrations = registrationsData.registrations;

    renderSchedule();
    renderRegistrationToggle();
    renderCapacity();
    renderPlayerLists();
  } catch (err) {
    console.error(err);
  }
}

function renderSchedule() {
  document.getElementById('training_date').value = latestSettings.training_date || '';
  document.getElementById('training_time').value = latestSettings.training_time || '';
  document.getElementById('training_info').value = latestSettings.training_info || '';
}

function renderRegistrationToggle() {
  const open = latestSettings.registration_open === 'TRUE';
  registrationStatusLabel.innerHTML = `
    <span class="w-2 h-2 rounded-full ${open ? 'bg-green-500' : 'bg-red-500'}"></span>
    <span>Registration: ${open ? 'OPEN' : 'CLOSED'}</span>
  `;
  toggleRegistrationBtn.textContent = open ? 'Close Registration' : 'Open Registration';
}

function renderCapacity() {
  document.getElementById('player_capacity').value = latestSettings.player_capacity;
  document.getElementById('gk_capacity').value = latestSettings.gk_capacity;
  document.getElementById('sub_capacity').value = latestSettings.sub_capacity;
}

function renderPlayerLists() {
  const positions = ['player', 'gk', 'sub'];
  adminPlayerLists.innerHTML = positions
    .map((pos) => {
      const list = latestRegistrations.filter((r) => r.position === pos);
      const cap = pos === 'player' ? latestSettings.player_capacity : pos === 'gk' ? latestSettings.gk_capacity : latestSettings.sub_capacity;

      const items = list
        .map(
          (r) => `
        <li class="rounded-lg bg-slate-50 px-3 py-3 flex items-center justify-between gap-3">
          <div>
            <p class="font-medium">${escapeHtml(r.name)}</p>
            <p class="text-sm text-slate-500">${escapeHtml(r.whatsapp)}</p>
            <p class="text-xs text-slate-400">${formatDateTime(r.created_at)}</p>
          </div>
          <button data-remove-id="${escapeAttr(r.id)}" class="shrink-0 rounded-lg border border-red-600 text-red-600 text-sm font-medium px-3 py-2">Remove</button>
        </li>`
        )
        .join('');

      return `
        <div>
          <h3 class="font-semibold mb-2">${POSITION_LABELS[pos]} (${list.length}/${cap})</h3>
          <ul class="space-y-2">${items || '<p class="text-sm text-slate-400 italic">No one registered yet.</p>'}</ul>
        </div>
      `;
    })
    .join('');

  adminPlayerLists.querySelectorAll('[data-remove-id]').forEach((btn) => {
    btn.addEventListener('click', () => removePlayer(btn.getAttribute('data-remove-id')));
  });
}

async function removePlayer(id) {
  const registration = latestRegistrations.find((r) => r.id === id);
  const name = registration ? registration.name : 'this player';
  if (!confirm(`Remove ${name} from the list?`)) return;

  try {
    const res = await authedFetch('/api/admin/remove-player', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (!res.ok) {
      showMessage(dashboardMessage, data.error || 'Could not remove player.', 'error');
      return;
    }
    showMessage(dashboardMessage, `${name} removed.`, 'success');
    await loadAll();
  } catch (err) {
    console.error(err);
  }
}

scheduleForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const res = await authedFetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        training_date: document.getElementById('training_date').value,
        training_time: document.getElementById('training_time').value,
        training_info: document.getElementById('training_info').value,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showMessage(dashboardMessage, data.error || 'Could not save schedule.', 'error');
      return;
    }
    latestSettings = data.settings;
    showMessage(dashboardMessage, 'Schedule saved.', 'success');
  } catch (err) {
    console.error(err);
  }
});

capacityForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const res = await authedFetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player_capacity: document.getElementById('player_capacity').value,
        gk_capacity: document.getElementById('gk_capacity').value,
        sub_capacity: document.getElementById('sub_capacity').value,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showMessage(dashboardMessage, data.error || 'Could not save capacity.', 'error');
      return;
    }
    latestSettings = data.settings;
    showMessage(dashboardMessage, 'Capacity saved.', 'success');
    await loadAll();
  } catch (err) {
    console.error(err);
  }
});

toggleRegistrationBtn.addEventListener('click', async () => {
  const currentlyOpen = latestSettings.registration_open === 'TRUE';
  try {
    const res = await authedFetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registration_open: !currentlyOpen }),
    });
    const data = await res.json();
    if (!res.ok) {
      showMessage(dashboardMessage, data.error || 'Could not update status.', 'error');
      return;
    }
    latestSettings = data.settings;
    renderRegistrationToggle();
    showMessage(dashboardMessage, `Registration is now ${!currentlyOpen ? 'open' : 'closed'}.`, 'success');
  } catch (err) {
    console.error(err);
  }
});

newSessionBtn.addEventListener('click', async () => {
  if (!confirm('Start a new session? This removes ALL current registrations and reopens registration. This cannot be undone.')) return;

  try {
    const res = await authedFetch('/api/admin/new-session', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      showMessage(dashboardMessage, data.error || 'Could not start a new session.', 'error');
      return;
    }
    latestSettings = data.settings;
    showMessage(dashboardMessage, 'New session started. All registrations cleared and registration is open.', 'success');
    await loadAll();
  } catch (err) {
    console.error(err);
  }
});

addPlayerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    name: document.getElementById('add-name').value,
    whatsapp: document.getElementById('add-whatsapp').value,
    position: document.getElementById('add-position').value,
  };

  try {
    const res = await authedFetch('/api/admin/add-player', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      showMessage(addPlayerMessage, data.error || 'Could not add player.', 'error');
      return;
    }
    showMessage(addPlayerMessage, 'Player added.', 'success');
    addPlayerForm.reset();
    await loadAll();
  } catch (err) {
    console.error(err);
  }
});

copyListBtn.addEventListener('click', async () => {
  const text = window.buildWhatsAppMessage(latestRegistrations);
  try {
    await navigator.clipboard.writeText(text);
    copyConfirm.classList.remove('hidden');
    setTimeout(() => copyConfirm.classList.add('hidden'), 2000);
  } catch (err) {
    console.error(err);
  }
});

function formatDateTime(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;');
}

// Boot: if we already have a token from a previous session, verify it by
// trying to load data; a 401 will bounce us back to the login screen.
if (token) {
  enterDashboard();
} else {
  showLogin();
}
