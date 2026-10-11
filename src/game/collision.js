import { N, E, S, W } from '../maze/grid.js'
import { CELL, WALL_THICK } from '../config.js'

// Keeps the player (a circle on the X/Z plane) out of the walls.
// Each wall is a thin box on a cell edge; we only test the 3×3 cells around the player.
// Cells in `blocked` (e.g. an open lift-shaft hole in the floor) act as solid blocks.

const HALF = CELL / 2
const LONG = (CELL + WALL_THICK) / 2
const THIN = WALL_THICK / 2

export function resolveCollisions(grid, pos, radius, coords, blocked) {
  for (let pass = 0; pass < 3; pass++) {
    const gx = coords.gx(pos.x)
    const gz = coords.gz(pos.z)
    let moved = false

    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = gx + dx
        const z = gz + dz
        if (x < 0 || z < 0 || x >= grid.width || z >= grid.depth) continue
        const i = z * grid.width + x
        const c = grid.cells[i]
        const px = coords.cx(x)
        const pz = coords.cz(z)

        if (blocked?.has(i)) moved = pushOut(pos, radius, px, pz, HALF, HALF) || moved
        if (c & N) moved = pushOut(pos, radius, px, pz - HALF, LONG, THIN) || moved
        if (c & S) moved = pushOut(pos, radius, px, pz + HALF, LONG, THIN) || moved
        if (c & W) moved = pushOut(pos, radius, px - HALF, pz, THIN, LONG) || moved
        if (c & E) moved = pushOut(pos, radius, px + HALF, pz, THIN, LONG) || moved
      }
    }
    if (!moved) break
  }
}

// Circle vs axis-aligned box, pushing the circle out along the shortest route.
function pushOut(pos, r, bx, bz, hx, hz) {
  const qx = Math.max(bx - hx, Math.min(pos.x, bx + hx))
  const qz = Math.max(bz - hz, Math.min(pos.z, bz + hz))
  let dx = pos.x - qx
  let dz = pos.z - qz
  const d2 = dx * dx + dz * dz
  if (d2 >= r * r) return false

  if (d2 > 1e-8) {
    const d = Math.sqrt(d2)
    pos.x += (dx / d) * (r - d)
    pos.z += (dz / d) * (r - d)
  } else {
    // Centre is inside the box: leave by the nearest face.
    const ox = hx - Math.abs(pos.x - bx)
    const oz = hz - Math.abs(pos.z - bz)
    if (ox < oz) pos.x += Math.sign(pos.x - bx || 1) * (ox + r)
    else pos.z += Math.sign(pos.z - bz || 1) * (oz + r)
  }
  return true
}
