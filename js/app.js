// Public page logic: loads settings + registrations, renders lists, handles
// the registration form and the WhatsApp copy button.

const POSITION_LABELS = { player: 'Player', gk: 'Goal Keeper', sub: 'Substitution' };

const scheduleInfoEl = document.getElementById('schedule-info');
const statusBadgeEl = document.getElementById('status-badge');
const formEl = document.getElementById('registration-form');
const positionSelectEl = document.getElementById('position');
const submitBtnEl = document.getElementById('submit-btn');
const closedMessageEl = document.getElementById('closed-message');
const formMessageEl = document.getElementById('form-message');
const playerListsEl = document.getElementById('player-lists');

let latestSettings = null;
let latestRegistrations = [];

async function loadData() {
  try {
    const [settingsRes, registrationsRes] = await Promise.all([
      fetch('/api/settings'),
      fetch('/api/registrations'),
    ]);
    if (!settingsRes.ok || !registrationsRes.ok) throw new Error('Failed to load data');

    latestSettings = await settingsRes.json();
    const registrationsData = await registrationsRes.json();
    latestRegistrations = registrationsData.registrations;

    renderSchedule();
    renderStatus();
    renderForm();
    renderLists();
  } catch (err) {
    console.error(err);
    scheduleInfoEl.innerHTML = '<p class="text-emerald-100">Could not load schedule. Please refresh.</p>';
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function renderSchedule() {
  const s = latestSettings;
  scheduleInfoEl.innerHTML = `
    <p class="font-medium">${formatDate(s.training_date)}</p>
    <p>${s.training_time || ''}</p>
    <p class="text-emerald-100">${escapeHtml(s.training_info || '')}</p>
  `;
}

function renderStatus() {
  const open = latestSettings.registration_open;
  statusBadgeEl.innerHTML = `
    <span class="w-2 h-2 rounded-full ${open ? 'bg-green-300' : 'bg-red-300'}"></span>
    <span>${open ? 'Registration Open' : 'Registration Closed'}</span>
  `;
}

function categoryCount(position) {
  return latestRegistrations.filter((r) => r.position === position).length;
}

function categoryFull(position) {
  const cap = latestSettings.capacity[position];
  return categoryCount(position) >= cap;
}

function renderForm() {
  const positions = ['player', 'gk', 'sub'];
  positionSelectEl.innerHTML = positions
    .map((pos) => {
      const cap = latestSettings.capacity[pos];
      const count = categoryCount(pos);
      const full = count >= cap;
      const label = full
        ? `${POSITION_LABELS[pos]} (FULL)`
        : `${POSITION_LABELS[pos]} (${count}/${cap})`;
      return `<option value="${pos}" ${full ? 'disabled' : ''}>${label}</option>`;
    })
    .join('');

  const allFull = positions.every((pos) => categoryFull(pos));
  const registrationOpen = latestSettings.registration_open;

  if (!registrationOpen) {
    formEl.classList.add('hidden');
    closedMessageEl.classList.remove('hidden');
  } else if (allFull) {
    formEl.classList.add('hidden');
    closedMessageEl.classList.remove('hidden');
    closedMessageEl.textContent = 'All categories are full. Registration is closed for now.';
  } else {
    formEl.classList.remove('hidden');
    closedMessageEl.classList.add('hidden');
    submitBtnEl.disabled = false;
  }
}

function renderLists() {
  const positions = ['player', 'gk', 'sub'];
  const sections = positions
    .map((pos) => {
      const list = latestRegistrations.filter((r) => r.position === pos);
      const cap = latestSettings.capacity[pos];

      const items = list
        .map(
          (r, i) => `
        <li class="rounded-lg bg-slate-50 px-3 py-2">
          <span class="font-medium">${i + 1}. ${escapeHtml(r.name)}</span>
        </li>`
        )
        .join('');

      const emptyState = `<p class="text-sm text-slate-400 italic">No one registered yet.</p>`;

      return `
        <div>
          <h3 class="font-semibold mb-2">${POSITION_LABELS[pos]} (${list.length}/${cap})</h3>
          <ul class="space-y-2">${items || emptyState}</ul>
        </div>
      `;
    })
    .join('');

  const copySection = `
    <div>
      <button data-copy="all" class="w-full rounded-lg border border-emerald-700 text-emerald-700 font-medium py-2 text-sm">Copy Player List for WhatsApp</button>
      <p data-copy-confirm class="hidden text-center text-xs text-emerald-700 mt-1">Copied!</p>
    </div>
  `;

  playerListsEl.innerHTML = sections + copySection;

  const copyBtn = playerListsEl.querySelector('[data-copy="all"]');
  copyBtn.addEventListener('click', async () => {
    const text = window.buildWhatsAppMessage(latestRegistrations);
    try {
      await navigator.clipboard.writeText(text);
      const confirmEl = playerListsEl.querySelector('[data-copy-confirm]');
      confirmEl.classList.remove('hidden');
      setTimeout(() => confirmEl.classList.add('hidden'), 2000);
    } catch (err) {
      console.error(err);
    }
  });
}

function showFormMessage(text, kind) {
  formMessageEl.textContent = text;
  formMessageEl.className =
    'mb-4 rounded-lg px-3 py-2 text-sm ' +
    (kind === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700');
}

function hideFormMessage() {
  formMessageEl.classList.add('hidden');
}

formEl.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideFormMessage();
  submitBtnEl.disabled = true;
  submitBtnEl.textContent = 'Submitting…';

  const payload = {
    name: document.getElementById('name').value,
    whatsapp: document.getElementById('whatsapp').value,
    position: positionSelectEl.value,
  };

  try {
    const res = await fetch('/api/registrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      showFormMessage(data.error || 'Could not submit registration.', 'error');
      submitBtnEl.disabled = false;
      submitBtnEl.textContent = 'Submit Registration';
      return;
    }

    showFormMessage('Registration submitted! Welcome to the training.', 'success');
    formEl.reset();
    await loadData();
  } catch (err) {
    console.error(err);
    showFormMessage('Network error. Please try again.', 'error');
  } finally {
    submitBtnEl.disabled = false;
    submitBtnEl.textContent = 'Submit Registration';
  }
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

loadData();
