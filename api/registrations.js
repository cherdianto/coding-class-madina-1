// GET  /api/registrations — public list of players (no PIN, no secrets).
// POST /api/registrations — public registration submission.

const crypto = require('crypto');
const { getSettings, getRegistrations, addRegistration } = require('./_lib/sheets');
const { validateRegistrationInput } = require('./_lib/validate');
const { capacityFor, countByPosition, isDuplicateName } = require('./_lib/capacity');

module.exports = async function handler(req, res) {
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
    const registrations = await getRegistrations();
    const publicList = registrations.map((r) => ({
      id: r.id,
      name: r.name,
      whatsapp: r.whatsapp,
      position: r.position,
      created_at: r.created_at,
    }));
    res.status(200).json({ registrations: publicList });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load registrations.' });
  }
}

async function handlePost(req, res) {
  try {
    const { errors, name, whatsapp, position } = validateRegistrationInput(req.body);
    if (errors.length > 0) {
      res.status(400).json({ error: errors.join(' ') });
      return;
    }

    const settings = await getSettings();
    if (settings.registration_open !== 'TRUE') {
      res.status(403).json({ error: 'Registration is currently closed.' });
      return;
    }

    const registrations = await getRegistrations();
    const capacity = capacityFor(settings, position);
    const current = countByPosition(registrations, position);
    if (current >= capacity) {
      res.status(409).json({ error: 'This category is already full.' });
      return;
    }

    if (isDuplicateName(registrations, name)) {
      res.status(409).json({ error: 'This name is already registered.' });
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
    res.status(500).json({ error: 'Could not save registration.' });
  }
}
