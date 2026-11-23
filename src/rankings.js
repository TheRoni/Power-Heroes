// rankings.js: the Power Rankings. Everybody in the Sky Isles has a Power number and the clans post who is strongest.
// The board mixes the other heroes of the isle (fixed Power for now) with your own heroes, strongest first.
// Keeper Marlo is not on the board: he is retired and his Power is faded (still 9,999).

// The other heroes: from a beginner to Rook, number 1. They are spaced so that a new hero passes one every round or two.
export const RIVALS = [
  { name: 'Rook', type: 'storm', power: 2400 },
  { name: 'Fennel', type: 'nature', power: 480 },
  { name: 'Brindle', type: 'fire', power: 340 },
  { name: 'Marigold', type: 'water', power: 230 },
  { name: 'Juno', type: 'storm', power: 150 },
  { name: 'Pebble', type: 'nature', power: 80 },
  { name: 'Wren', type: 'water', power: 45 },
];
export const MARLO = { name: 'Keeper Marlo', power: 9999, note: 'Keeper Marlo is retired. His Power is still a faded 9,999.' };
export const TOP = 'Rook';   // number 1 when you arrive: passing him is a bigger moment

// The whole board, strongest first: [{ rank, name, type, power, you, kind }]. "yours" is [{ kind, name, type, power }].
// When a hero and a rival tie, the rival stays ahead (you have to pass them). The sort is stable, so rivals come first.
export function board(yours, rivals = RIVALS) {
  const rows = [
    ...rivals.map((r) => ({ name: r.name, type: r.type, power: r.power, you: false })),
    ...yours.map((h) => ({ name: h.name, type: h.type, power: h.power, you: true, kind: h.kind })),
  ];
  rows.sort((a, b) => b.power - a.power);
  rows.forEach((row, i) => { row.rank = i + 1; });
  return rows;
}

// The rivals a hero passed when their Power went from "before" to "after" (they were behind or level, and are ahead now),
// the strongest first.
export function passedBy(before, after, rivals = RIVALS) {
  return rivals.filter((r) => before <= r.power && r.power < after).sort((a, b) => b.power - a.power);
}

// What a round did on the board. "gains" is [{ kind, name, before, after }] and "rows" the board after the round.
// Returns { list: [{ hero, rival, rank, big }], more }: at most "limit" passes (the biggest first), and how many were left out.
export function passes(gains, rows, limit = 3) {
  const all = [];
  for (const gain of gains) {
    const rank = (rows.find((row) => row.you && row.kind === gain.kind) || {}).rank;
    for (const rival of passedBy(gain.before, gain.after)) all.push({ hero: gain.name, rival: rival.name, rank, big: rival.name === TOP, power: rival.power });
  }
  all.sort((a, b) => b.power - a.power);
  return { list: all.slice(0, limit).map(({ power, ...pass }) => pass), more: Math.max(0, all.length - limit) };
}

// A board short enough for a small screen: at most "max" rows. Number 1 always stays, then your heroes, then the rows
// nearest to them (the one above you first: that is who to beat next). A { gap: true } row marks where rows were left out.
export function windowed(rows, max = 9) {
  if (rows.length <= max) return rows;
  const mine = rows.map((row, i) => (row.you ? i : -1)).filter((i) => i >= 0);
  const far = (i) => (i === 0 ? -1 : Math.min(...mine.map((m) => Math.abs(m - i) + (i > m ? 0.5 : 0))));
  const keep = rows.map((_, i) => i).sort((a, b) => far(a) - far(b) || a - b).slice(0, max).sort((a, b) => a - b);
  const out = [];
  keep.forEach((i, n) => {
    if (n > 0 && i !== keep[n - 1] + 1) out.push({ gap: true });
    out.push(rows[i]);
  });
  return out;
}
