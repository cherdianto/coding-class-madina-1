// Small server-side validation helpers. The frontend also validates, but the
// server must never trust it.

const VALID_POSITIONS = ['player', 'gk', 'sub'];

function cleanString(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function validateRegistrationInput(body) {
  const errors = [];

  const name = cleanString(body && body.name, 80);
  const whatsapp = cleanString(body && body.whatsapp, 30);
  const position = cleanString(body && body.position, 20).toLowerCase();

  if (!name) errors.push('Name is required.');
  if (!whatsapp) errors.push('WhatsApp is required.');
  else if (!/^[0-9+\-\s]{6,20}$/.test(whatsapp)) errors.push('WhatsApp number looks invalid.');
  if (!VALID_POSITIONS.includes(position)) errors.push('Position must be player, gk, or sub.');

  return { errors, name, whatsapp, position };
}

module.exports = { validateRegistrationInput, cleanString, VALID_POSITIONS };
