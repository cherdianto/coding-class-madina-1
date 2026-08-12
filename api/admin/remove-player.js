// POST /api/admin/remove-player — body: { id }

const { removeRegistrationById } = require('../_lib/sheets');
const { requireAdmin } = require('../_lib/auth');

module.exports = async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  try {
    const id = typeof req.body?.id === 'string' ? req.body.id : '';
    if (!id) {
      res.status(400).json({ error: 'id is required.' });
      return;
    }

    const removed = await removeRegistrationById(id);
    if (!removed) {
      res.status(404).json({ error: 'Registration not found.' });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not remove player.' });
  }
};
