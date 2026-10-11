// Title / pause screen, crosshair and the "Level N" announcement.

export function createOverlay(container, { seed }) {
  const intro = document.createElement('div')
  intro.className = 'intro'
  intro.innerHTML = `
    <div class="intro-inner">
      <h1>Labyrinth <span>VI</span></h1>
      <p class="prompt">Click to enter</p>
      <div class="controls">
        <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move</span>
        <span><kbd>Shift</kbd> run</span>
        <span>Mouse look</span>
        <span><kbd>Esc</kbd> pause</span>
      </div>
      <div class="dev">
        dev · <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> jump to a floor ·
        seed ${seed} · <a href="?debug&seed=${seed}">generator view</a>
      </div>
    </div>`
  container.appendChild(intro)

  const crosshair = document.createElement('div')
  crosshair.className = 'crosshair'
  container.appendChild(crosshair)

  const banner = document.createElement('div')
  banner.className = 'level-banner'
  container.appendChild(banner)

  let enterHandler = () => {}
  intro.addEventListener('click', (e) => {
    if (e.target.closest('a')) return
    enterHandler()
  })

  let bannerTimer
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
    },
    announce(text) {
      banner.textContent = text
      banner.classList.remove('show')
      void banner.offsetWidth // restart the animation
      banner.classList.add('show')
      clearTimeout(bannerTimer)
      bannerTimer = setTimeout(() => banner.classList.remove('show'), 3200)
    },
  }
}
