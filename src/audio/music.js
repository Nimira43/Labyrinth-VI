const BASE = `${import.meta.env.BASE_URL}sounds/`
const TITLE = `${BASE}title_screen.mp3`
const PLAYLIST = [
  'title_screen.mp3',
  'track_1.mp3',
  'track_2.mp3',
  'track_3.mp3',
  'track_4.mp3',
].map((f) => BASE + f)

const CROSSFADE = 4

export function createMusic(engine) {
  const { ctx } = engine

  const decks = [makeDeck(), makeDeck()]
  let active = 0
  let mode = null
  let queue = []
  let last = null
  let switching = false

  function makeDeck() {
    const el = new Audio()
    el.preload = 'auto'
    const gain = ctx.createGain()
    gain.gain.value = 0
    ctx.createMediaElementSource(el).connect(gain)
    gain.connect(engine.musicIn)
    const deck = { el, gain }

    el.addEventListener(
      'ended',
      () => deck === decks[active] && mode === 'game' && next(),
    )
    el.addEventListener('error', () => {
      if (deck !== decks[active]) return
      console.warn(`[music] couldn't play ${el.src}`)
      if (mode === 'game') setTimeout(next, 1000)
    })
    return deck
  }

  function fade(deck, to, seconds) {
    const g = deck.gain.gain
    const t = ctx.currentTime
    g.cancelScheduledValues(t)
    g.setValueAtTime(g.value, t)
    g.linearRampToValueAtTime(to, t + seconds)
  }

  function playOn(deck, src, loop, fadeIn) {
    deck.el.src = src
    deck.el.loop = loop
    deck.el.currentTime = 0
    fade(deck, 1, fadeIn)
    return deck.el.play().catch(() => {})
  }

  function stopDeck(deck, seconds) {
    fade(deck, 0, seconds)
    setTimeout(
      () => {
        if (deck !== decks[active]) deck.el.pause()
      },
      seconds * 1000 + 100,
    )
  }

  function refill() {
    queue = shuffle([...PLAYLIST])
    if (queue[0] === last && queue.length > 1) queue.push(queue.shift())
  }

  function next() {
    if (switching) return
    switching = true
    if (!queue.length) refill()
    const src = queue.shift()
    last = src
    const from = decks[active]
    active = 1 - active
    playOn(decks[active], src, false, CROSSFADE)
    stopDeck(from, CROSSFADE)
    setTimeout(() => (switching = false), CROSSFADE * 1000)
  }

  return {
    startTitle() {
      mode = 'title'
      last = TITLE
      return playOn(decks[active], TITLE, true, 2.5)
    },

    startGame() {
      if (mode === 'game') return
      mode = 'game'
      refill()

      if (queue[0] === TITLE) queue.push(queue.shift())
      next()
    },

    update() {
      if (mode !== 'game' || switching) return
      const el = decks[active].el
      if (
        el.duration &&
        isFinite(el.duration) &&
        el.duration - el.currentTime < CROSSFADE
      )
        next()
    },

    resume() {
      const el = decks[active].el
      if (el.src && el.paused) el.play().catch(() => {})
    },

    get nowPlaying() {
      return decks[active].el.src.split('/').pop()
    },
  }
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
