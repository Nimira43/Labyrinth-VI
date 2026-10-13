import { randomSeed } from '../maze/rng.js'

export function createOverlay(container, { seed }) {
  const el = (cls, html = '') => {
    const div = document.createElement('div')
    div.className = cls
    div.innerHTML = html
    container.appendChild(div)
    return div
  }

  const intro = el(
    'intro',
    `<div class='intro-inner'>
      <h1>Labyrinth <span>VI</span></h1>
      <p class='prompt'>Click to enter</p>
      <div class='controls'>
        <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move</span>
        <span><kbd>Shift</kbd> run</span>
        <span><kbd>E</kbd> use lift</span>
        <span>Mouse look</span>
        <span><kbd>Esc</kbd> pause</span>
      </div>
      <div class='dev'>
        ${import.meta.env.DEV ? 'dev · <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> jump to a floor · <kbd>K</kbd> keycards · ' : ''}
        seed ${seed} · <a href='?debug&seed=${seed}'>generator view</a>
      </div>
    </div>`,
  )

  const crosshair = el('crosshair hidden')
  const banner = el('level-banner')
  const prompt = el('prompt-hud')
  const message = el('message-hud')

  const cards = el(
    'cards-hud hidden',
    [1, 2]
      .map(
        (n) => `<div class='card-slot' data-id='${n}'><span>${n}</span></div>`,
      )
      .join(''),
  )

  const escapeEl = el(
    'escape',
    `<div class='escape-card'>
      <h2>You've Escaped<br />the Labyrinth</h2>
      <p class='escape-time'></p>
      <div class='escape-actions'>
        <button data-act='new'>Enter a new labyrinth</button>
        <button data-act='again'>Replay this one</button>
      </div>
    </div>`,
  )
  escapeEl.addEventListener('click', (e) => {
    const act = e.target.closest('button')?.dataset.act
    if (act === 'new') location.href = `?seed=${randomSeed()}`
    if (act === 'again') location.reload()
  })

  let enterHandler = () => {}
  intro.addEventListener('click', (e) => {
    if (e.target.closest('a')) return
    enterHandler()
  })

  let bannerTimer
  let messageTimer
  let lastPrompt = null

  return {
    onEnter(fn) {
      enterHandler = fn
    },
    showIntro() {
      intro.classList.remove('hidden')
      intro.querySelector('.prompt').textContent = 'Click to continue'
      crosshair.classList.add('hidden')
    },
    hideIntro() {
      intro.classList.add('hidden')
      crosshair.classList.remove('hidden')
      cards.classList.remove('hidden')
    },
    announce(text) {
      banner.textContent = text
      banner.classList.remove('show')
      void banner.offsetWidth 
      banner.classList.add('show')
      clearTimeout(bannerTimer)
      bannerTimer = setTimeout(() => banner.classList.remove('show'), 3200)
    },
    prompt(text) {
      if (text === lastPrompt) return
      lastPrompt = text
      prompt.textContent = text ?? ''
      prompt.classList.toggle('show', !!text)
    },
    message(text) {
      message.textContent = text
      message.classList.remove('show')
      void message.offsetWidth
      message.classList.add('show')
      clearTimeout(messageTimer)
      messageTimer = setTimeout(() => message.classList.remove('show'), 4500)
    },
    setKeycards(ids) {
      cards.querySelectorAll('.card-slot').forEach((slot) => {
        const has = ids.includes(Number(slot.dataset.id))
        if (has && !slot.classList.contains('have')) {
          slot.classList.add('have', 'flash')
          setTimeout(() => slot.classList.remove('flash'), 900)
        }
      })
    },
    startEscape({ time }) {
      crosshair.classList.add('hidden')
      cards.classList.add('hidden')
      prompt.classList.remove('show')
      escapeEl.querySelector('.escape-time').textContent =
        `Escaped in ${formatTime(time)}`
      escapeEl.classList.add('show') 
      setTimeout(() => escapeEl.classList.add('settle'), 2200) 
    },
  }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
