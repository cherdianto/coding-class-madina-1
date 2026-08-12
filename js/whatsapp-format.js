// Shared by the public page and the admin dashboard: builds the WhatsApp
// share text from a list of registrations. Loaded as a plain <script>, so it
// attaches itself to `window` instead of using ES module imports.

function buildWhatsAppMessage(registrations) {
  const byPosition = {
    player: registrations.filter((r) => r.position === 'player'),
    gk: registrations.filter((r) => r.position === 'gk'),
    sub: registrations.filter((r) => r.position === 'sub'),
  };

  const lines = ['⚽ *Madina United Training Session*', ''];

  lines.push('👥 *Players*', '');
  byPosition.player.forEach((r, i) => lines.push(`${i + 1}. ${r.name}`));

  lines.push('', '🧤 *Goal Keeper*', '');
  byPosition.gk.forEach((r, i) => lines.push(`${i + 1}. ${r.name}`));

  lines.push('', '🔄 *Substitution*', '');
  byPosition.sub.forEach((r, i) => lines.push(`${i + 1}. ${r.name}`));

  lines.push(
    '',
    `📊 Players: ${byPosition.player.length}`,
    `🧤 GK: ${byPosition.gk.length}`,
    `🔄 Subs: ${byPosition.sub.length}`
  );

  return lines.join('\n');
}

window.buildWhatsAppMessage = buildWhatsAppMessage;
