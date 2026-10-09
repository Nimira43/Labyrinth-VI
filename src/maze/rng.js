// Seeded random number generator (mulberry32).
// Same seed = same labyrinth, which makes bugs reproducible: ?seed=1234 in the URL.

export function createRng(seed) {
  let a = seed >>> 0

  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  return {
    next,
    int: (max) => Math.floor(next() * max), // 0 .. max-1
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        ;[arr[i], arr[j]] = [arr[j], arr[i]]
      }
      return arr
    },
  }
}

export function randomSeed() {
  return Math.floor(Math.random() * 1_000_000)
}
