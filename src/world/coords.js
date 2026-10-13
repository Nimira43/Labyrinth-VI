import { CELL } from '../config.js'

export function makeCoords(lab) {
  const ox = (lab.width - 1) / 2
  const oz = (lab.depth - 1) / 2
  return {
    cx: (x) => (x - ox) * CELL,
    cz: (z) => (z - oz) * CELL,
    gx: (wx) => Math.round(wx / CELL + ox),
    gz: (wz) => Math.round(wz / CELL + oz),
  }
}
