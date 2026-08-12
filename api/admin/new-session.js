// POST /api/admin/new-session — clears all registrations and reopens
// registration, so the admin can start a fresh weekly training session
// without touching Google Sheets by hand.

const { clearAllRegistrations, setSettingValues, getSettings } = require('../_lib/sheets');
const { requireAdmin } = require('../_lib/auth');

module.exports = async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  try {
    await clearAllRegistrations();
    await setSettingValues({ registration_open: 'TRUE' });

    const settings = await getSettings();
    const { admin_pin, ...safeSettings } = settings;
    res.status(200).json({ settings: safeSettings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not start a new session.' });
  }
};
