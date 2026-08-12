// GET /api/settings — public schedule + capacity info. Never includes admin_pin.

const { getSettings, getRegistrations } = require('./_lib/sheets');
const { capacityFor, countByPosition } = require('./_lib/capacity');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  try {
    const settings = await getSettings();
    const registrations = await getRegistrations();

    res.status(200).json({
      registration_open: settings.registration_open === 'TRUE',
      training_date: settings.training_date,
      training_time: settings.training_time,
      training_info: settings.training_info,
      capacity: {
        player: capacityFor(settings, 'player'),
        gk: capacityFor(settings, 'gk'),
        sub: capacityFor(settings, 'sub'),
      },
      counts: {
        player: countByPosition(registrations, 'player'),
        gk: countByPosition(registrations, 'gk'),
        sub: countByPosition(registrations, 'sub'),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load settings.' });
  }
};
