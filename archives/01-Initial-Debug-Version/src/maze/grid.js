// A single maze floor stored as a flat array of wall bitmasks.
// Each cell records which of its four sides has a wall.
//
//          N (-z)
//    W (-x)  +  E (+x)
//          S (+z)

export const N = 1
export const E = 2
export const S = 4
export const W = 8
export const ALL_WALLS = N | E | S | W

export const DIRS = [
  { bit: N, dx: 0, dz: -1, opposite: S },
  { bit: E, dx: 1, dz: 0, opposite: W },
  { bit: S, dx: 0, dz: 1, opposite: N },
  { bit: W, dx: -1, dz: 0, opposite: E },
]

export function createGrid(width, depth) {
  return {
    width,
    depth,
    cells: new Uint8Array(width * depth).fill(ALL_WALLS),
  }
}

export const index = (grid, x, z) => z * grid.width + x
export const cellOf = (grid, i) => ({ x: i % grid.width, z: Math.floor(i / grid.width) })
export const inBounds = (grid, x, z) => x >= 0 && z >= 0 && x < grid.width && z < grid.depth

export const hasWall = (grid, x, z, bit) => (grid.cells[index(grid, x, z)] & bit) !== 0

// Knock down the wall between a cell and its neighbour (both sides).
export function carve(grid, x, z, dir) {
  grid.cells[index(grid, x, z)] &= ~dir.bit
  grid.cells[index(grid, x + dir.dx, z + dir.dz)] &= ~dir.opposite
}

export function wallCount(grid, i) {
  const c = grid.cells[i]
  return ((c & N) && 1) + ((c & E) && 1) + ((c & S) && 1) + ((c & W) && 1)
}

export const isDeadEnd = (grid, i) => wallCount(grid, i) === 3
