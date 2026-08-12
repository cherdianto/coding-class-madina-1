const POSITION_LABELS = { player: 'Player', gk: 'Goal Keeper', sub: 'Substitution' };

function capacityFor(settings, position) {
  const map = { player: 'player_capacity', gk: 'gk_capacity', sub: 'sub_capacity' };
  return Number(settings[map[position]]) || 0;
}

function countByPosition(registrations, position) {
  return registrations.filter((r) => r.position === position).length;
}

module.exports = { POSITION_LABELS, capacityFor, countByPosition };
