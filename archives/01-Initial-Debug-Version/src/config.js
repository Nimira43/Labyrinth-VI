// World dimensions shared by the debug view and, later, the game itself.

export const CELL = 4          // corridor width (world units, roughly metres)
export const WALL_HEIGHT = 3.2
export const WALL_THICK = 0.3
export const SLAB = 0.4        // floor/ceiling slab thickness between levels
export const LEVEL_HEIGHT = WALL_HEIGHT + SLAB

export const MAZE_WIDTH = 15   // cells
export const MAZE_DEPTH = 15
export const LOOP_CHANCE = 0.06
