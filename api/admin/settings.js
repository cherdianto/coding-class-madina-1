// GET  /api/admin/settings — full settings for the admin dashboard (still no PIN).
// POST /api/admin/settings — update schedule, capacity, or registration_open.
// All requests require a valid admin bearer token.

const { getSettings, setSettingValues } = require('../_lib/sheets');
const { requireAdmin } = require('../_lib/auth');
const { cleanString } = require('../_lib/validate');

module.exports = async function handler(req, res) {
  if (!requireAdmin(req, res)) return;

  if (req.method === 'GET') {
    return handleGet(req, res);
  }
  if (req.method === 'POST') {
    return handlePost(req, res);
  }
  res.status(405).json({ error: 'Method not allowed.' });
};

async function handleGet(req, res) {
  try {
    const settings = await getSettings();
    const { admin_pin, ...safeSettings } = settings;
    res.status(200).json({ settings: safeSettings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load settings.' });
  }
}

async function handlePost(req, res) {
  try {
    const body = req.body || {};
    const updates = {};

    if (typeof body.registration_open === 'boolean') {
      updates.registration_open = body.registration_open ? 'TRUE' : 'FALSE';
    }
    if (body.training_date !== undefined) {
      updates.training_date = cleanString(body.training_date, 40);
    }
    if (body.training_time !== undefined) {
      updates.training_time = cleanString(body.training_time, 40);
    }
    if (body.training_info !== undefined) {
      updates.training_info = cleanString(body.training_info, 200);
    }
    for (const key of ['player_capacity', 'gk_capacity', 'sub_capacity']) {
      if (body[key] !== undefined) {
        const value = Number(body[key]);
        if (!Number.isFinite(value) || value < 0 || value > 999) {
          res.status(400).json({ error: `Invalid value for ${key}.` });
          return;
        }
        updates[key] = String(Math.floor(value));
      }
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'No valid fields to update.' });
      return;
    }

    await setSettingValues(updates);
    const settings = await getSettings();
    const { admin_pin, ...safeSettings } = settings;
    res.status(200).json({ settings: safeSettings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not save settings.' });
  }
}
