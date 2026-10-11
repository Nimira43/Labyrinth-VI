import { CELL } from '../config.js'

// Converts between maze grid cells and world positions.
// The maze is centred on the origin, so cell (0, 0) is the north-west corner.

export function makeCoords(lab) {
  const ox = (lab.width - 1) / 2
  const oz = (lab.depth - 1) / 2
  return {
    cx: (x) => (x - ox) * CELL,           // cell -> world centre
    cz: (z) => (z - oz) * CELL,
    gx: (wx) => Math.round(wx / CELL + ox), // world -> cell
    gz: (wz) => Math.round(wz / CELL + oz),
  }
}
