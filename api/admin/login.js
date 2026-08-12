// POST /api/admin/login — checks the submitted PIN against Google Sheets
// and returns a short-lived signed token if it matches.

const { getSettings } = require('../_lib/sheets');
const { createAdminToken } = require('../_lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  try {
    const pin = typeof req.body?.pin === 'string' ? req.body.pin.trim() : '';
    if (!/^\d{6}$/.test(pin)) {
      res.status(400).json({ error: 'PIN must be 6 digits.' });
      return;
    }

    const settings = await getSettings();
    if (pin !== settings.admin_pin) {
      res.status(401).json({ error: 'Incorrect PIN.' });
      return;
    }

    res.status(200).json({ token: createAdminToken() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not verify PIN.' });
  }
};
