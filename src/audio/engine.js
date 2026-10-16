const DEFAULT_MUSIC = 0.32
const DEFAULT_SFX = 0.9
const STORAGE_KEY = 'labyrinth-vi-volume'

export function createAudioEngine() {
  const AC = window.AudioContext || window.webkitAudioContext
  const ctx = new AC()

  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = -8
  limiter.knee.value = 6
  limiter.ratio.value = 6
  limiter.attack.value = 0.003
  limiter.release.value = 0.25
  limiter.connect(ctx.destination)

  const master = ctx.createGain()
  master.connect(limiter)

  const saved = loadVolumes()

  const musicBus = ctx.createGain()
  musicBus.gain.value = saved.music
  musicBus.connect(master)

  const musicDuck = ctx.createGain()
  musicDuck.connect(musicBus)

  const sfxBus = ctx.createGain()
  sfxBus.gain.value = saved.sfx
  sfxBus.connect(master)

  const sfxPause = ctx.createGain()
  sfxPause.connect(sfxBus)

  const reverb = ctx.createConvolver()
  reverb.buffer = makeImpulse(ctx, 3.2, 2.6)
  const reverbReturn = ctx.createGain()
  reverbReturn.gain.value = 0.55
  reverb.connect(reverbReturn)
  reverbReturn.connect(sfxPause)

  const reverbSend = ctx.createGain()
  reverbSend.connect(reverb)

  const noise = makeNoise(ctx, 3)

  let paused = false

  return {
    ctx,
    musicIn: musicDuck,
    sfxOut: sfxPause,
    reverbSend,
    noise,

    get unlocked() {
      return ctx.state === 'running'
    },
    unlock() {
      return ctx.resume()
    },

    duck(depth = 0.35, hold = 1.2, release = 2.5) {
      if (paused) return
      const g = musicDuck.gain
      const t = ctx.currentTime
      g.cancelScheduledValues(t)
      g.setValueAtTime(g.value, t)
      g.linearRampToValueAtTime(depth, t + 0.25)
      g.setValueAtTime(depth, t + 0.25 + hold)
      g.linearRampToValueAtTime(1, t + 0.25 + hold + release)
    },

    setPaused(p) {
      paused = p
      const t = ctx.currentTime
      musicDuck.gain.cancelScheduledValues(t)
      musicDuck.gain.setTargetAtTime(p ? 0.6 : 1, t, 0.3)
      sfxPause.gain.setTargetAtTime(p ? 0.08 : 1, t, 0.3)
    },

    get musicVolume() {
      return musicBus.gain.value
    },
    get sfxVolume() {
      return sfxBus.gain.value
    },
    setMusicVolume(v) {
      musicBus.gain.setTargetAtTime(v, ctx.currentTime, 0.05)
      saveVolumes({ music: v, sfx: sfxBus.gain.value })
    },
    setSfxVolume(v) {
      sfxBus.gain.setTargetAtTime(v, ctx.currentTime, 0.05)
      saveVolumes({ music: musicBus.gain.value, sfx: v })
    },
  }
}

function makeImpulse(ctx, seconds, decay) {
  const rate = ctx.sampleRate
  const len = Math.floor(rate * seconds)
  const buf = ctx.createBuffer(2, len, rate)
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch)
    let lp = 0
    for (let i = 0; i < len; i++) {
      const k = i / len
      const white = Math.random() * 2 - 1
      lp += (white - lp) * (0.9 - 0.75 * k)
      data[i] = lp * Math.pow(1 - k, decay)
    }
  }
  return buf
}

function makeNoise(ctx, seconds) {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  return buf
}

function loadVolumes() {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (v && typeof v.music === 'number' && typeof v.sfx === 'number') return v
  } catch {}
  return { music: DEFAULT_MUSIC, sfx: DEFAULT_SFX }
}

function saveVolumes(v) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v))
  } catch {
    /* storage unavailable: volumes just won't be remembered */
  }
}
