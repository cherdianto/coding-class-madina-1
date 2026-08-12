// POST /api/admin/add-player — admin manually adds a registration.
// Same capacity rules as the public endpoint, but no "registration open" check.

const crypto = require('crypto');
const { getSettings, getRegistrations, addRegistration } = require('../_lib/sheets');
const { requireAdmin } = require('../_lib/auth');
const { validateRegistrationInput } = require('../_lib/validate');
const { capacityFor, countByPosition } = require('../_lib/capacity');

module.exports = async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  try {
    const { errors, name, whatsapp, position } = validateRegistrationInput(req.body);
    if (errors.length > 0) {
      res.status(400).json({ error: errors.join(' ') });
      return;
    }

    const settings = await getSettings();
    const registrations = await getRegistrations();
    const capacity = capacityFor(settings, position);
    const current = countByPosition(registrations, position);
    if (current >= capacity) {
      res.status(409).json({ error: 'This category is already full.' });
      return;
    }

    const registration = {
      id: crypto.randomUUID(),
      name,
      whatsapp,
      position,
      created_at: new Date().toISOString(),
    };
    await addRegistration(registration);

    res.status(201).json({ registration });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not add player.' });
  }
};
