// Shared helper for talking to the Google Sheet "database".
// Every API route imports getDoc() to get an authenticated, loaded document,
// then reads/writes the "Registrations" and "Settings" sheets.

const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const REGISTRATIONS_SHEET = 'Registrations';
const SETTINGS_SHEET = 'Settings';

const REGISTRATIONS_HEADERS = ['id', 'name', 'whatsapp', 'position', 'created_at'];

const DEFAULT_SETTINGS = {
  admin_pin: '000000',
  registration_open: 'TRUE',
  training_date: '2026-08-12',
  training_time: '20:00',
  training_info: 'Weekly football training',
  player_capacity: '6',
  gk_capacity: '3',
  sub_capacity: '4',
};

let cachedDoc = null;

async function getDoc() {
  if (cachedDoc) return cachedDoc;

  const { GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY } = process.env;

  if (!GOOGLE_SHEET_ID || !GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
    throw new Error('Missing Google Sheets environment variables. Check .env.example.');
  }

  const jwt = new JWT({
    email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    // Vercel env vars store \n as a literal backslash-n, so unescape it here.
    key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, jwt);
  await doc.loadInfo();

  await ensureSheets(doc);

  cachedDoc = doc;
  return doc;
}

// Creates the Registrations and Settings sheets (with default rows) if they
// don't exist yet, so a brand new spreadsheet can bootstrap itself.
async function ensureSheets(doc) {
  let registrationsSheet = doc.sheetsByTitle[REGISTRATIONS_SHEET];
  if (!registrationsSheet) {
    registrationsSheet = await doc.addSheet({
      title: REGISTRATIONS_SHEET,
      headerValues: REGISTRATIONS_HEADERS,
    });
  }

  let settingsSheet = doc.sheetsByTitle[SETTINGS_SHEET];
  if (!settingsSheet) {
    settingsSheet = await doc.addSheet({
      title: SETTINGS_SHEET,
      headerValues: ['key', 'value'],
    });
    const rows = Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({ key, value }));
    await settingsSheet.addRows(rows);
  }
}

async function getSettings() {
  const doc = await getDoc();
  const sheet = doc.sheetsByTitle[SETTINGS_SHEET];
  const rows = await sheet.getRows();

  const settings = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    const key = row.get('key');
    if (key) settings[key] = row.get('value');
  }
  return settings;
}

async function setSettingValues(updates) {
  const doc = await getDoc();
  const sheet = doc.sheetsByTitle[SETTINGS_SHEET];
  const rows = await sheet.getRows();

  const rowByKey = new Map(rows.map((row) => [row.get('key'), row]));

  for (const [key, value] of Object.entries(updates)) {
    const row = rowByKey.get(key);
    if (row) {
      row.set('value', String(value));
      await row.save();
    } else {
      await sheet.addRow({ key, value: String(value) });
    }
  }
}

async function getRegistrations() {
  const doc = await getDoc();
  const sheet = doc.sheetsByTitle[REGISTRATIONS_SHEET];
  const rows = await sheet.getRows();

  return rows.map((row) => ({
    rowNumber: row.rowNumber,
    id: row.get('id'),
    name: row.get('name'),
    whatsapp: row.get('whatsapp'),
    position: row.get('position'),
    created_at: row.get('created_at'),
  }));
}

async function addRegistration({ id, name, whatsapp, position, created_at }) {
  const doc = await getDoc();
  const sheet = doc.sheetsByTitle[REGISTRATIONS_SHEET];
  await sheet.addRow({ id, name, whatsapp, position, created_at });
}

async function removeRegistrationById(id) {
  const doc = await getDoc();
  const sheet = doc.sheetsByTitle[REGISTRATIONS_SHEET];
  const rows = await sheet.getRows();
  const row = rows.find((r) => r.get('id') === id);
  if (!row) return false;
  await row.delete();
  return true;
}

module.exports = {
  getDoc,
  getSettings,
  setSettingValues,
  getRegistrations,
  addRegistration,
  removeRegistrationById,
};
