const HEART_BPM = 68
const HEART_DELAY_PER_METRE = 0.025

export function createSfx(engine) {
  const { ctx, sfxOut, reverbSend, noise } = engine
  const now = () => ctx.currentTime

  const gain = (value = 0, dest) => {
    const g = ctx.createGain()
    g.gain.value = value
    if (dest) g.connect(dest)
    return g
  }
  const osc = (type, freq, dest) => {
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.value = freq
    if (dest) o.connect(dest)
    return o
  }
  const filter = (type, freq, q = 1, dest) => {
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    if (dest) f.connect(dest)
    return f
  }
  const noiseSource = (dest, loop = true) => {
    const s = ctx.createBufferSource()
    s.buffer = noise
    s.loop = loop
    if (loop) s.loopStart = Math.random() * 2
    if (dest) s.connect(dest)
    return s
  }
  const envelope = (g, t, peak, attack, decay) => {
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
  }
  const glide = (param, value, time = 0.25) =>
    param.setTargetAtTime(value, now(), time)

  const voiceOut = (wet = 0.3) => {
    const g = gain(1, sfxOut)
    g.connect(gain(wet, reverbSend))
    return g
  }

  let drone3Throb = null
  const drones = [buildDrone1(), buildDrone2(), buildDrone3()]

  function buildDrone1() {
    const out = gain(0, voiceOut(0.5))
    const tone = gain(0.16, out)
    osc('sine', 55, tone).start()
    osc('sine', 55.6, tone).start()
    osc('sine', 82.4, gain(0.05, out)).start()
    const wind = filter('bandpass', 420, 0.8, gain(0.1, out))
    noiseSource(wind).start()
    const lfo = osc('sine', 0.07)
    lfo.connect(gain(220, null)).connect(wind.frequency)
    lfo.start()
    return out
  }

  function buildDrone2() {
    const out = gain(0, voiceOut(0.45))
    const lp = filter('lowpass', 260, 2, out)
    const a = osc('sawtooth', 65.4, gain(0.1, lp))
    const b = osc('sawtooth', 69.3, gain(0.08, lp))
    const wobble = osc('sine', 0.17)
    const depth = gain(1.6)
    wobble.connect(depth)
    depth.connect(a.frequency)
    depth.connect(b.detune)
    a.start()
    b.start()
    wobble.start()
    const sweep = osc('sine', 0.05)
    sweep.connect(gain(120)).connect(lp.frequency)
    sweep.start()
    const murk = filter('lowpass', 500, 0.7, gain(0.05, out))
    noiseSource(murk).start()
    return out
  }

  function buildDrone3() {
    const out = gain(0, voiceOut(0.35))
    const throb = gain(0.5, out)
    const lp = filter('lowpass', 140, 1.2, throb)
    osc('sine', 41.2, gain(0.35, lp)).start()
    osc('triangle', 49, gain(0.12, lp)).start()
    osc('sawtooth', 82.4, gain(0.03, lp)).start()
    noiseSource(filter('lowpass', 90, 0.7, gain(0.25, out))).start()
    drone3Throb = throb
    return out
  }

  let droneLevel = -1
  function setLevel(level) {
    if (level === droneLevel) return
    droneLevel = level
    drones.forEach((d, i) => glide(d.gain, i === level ? 1 : 0, 1.2))
  }

  const heartBus = gain(0, voiceOut(0.25))

  function thump(when, strength) {
    const g = gain(0, heartBus)
    const o = osc('sine', 62, g)
    o.frequency.setValueAtTime(62, when)
    o.frequency.exponentialRampToValueAtTime(34, when + 0.18)
    envelope(g, when, 0.9 * strength, 0.012, 0.32)
    o.start(when)
    o.stop(when + 0.5)

    const c = gain(0, heartBus)
    const n = noiseSource(filter('lowpass', 180, 0.8, c), false)
    envelope(c, when, 0.35 * strength, 0.004, 0.07)
    n.start(when, Math.random() * 2, 0.15)
  }

  let heartN = null
  function updateHeart(gameT, x, z) {
    const period = 60 / HEART_BPM
    const delay = Math.hypot(x, z) * HEART_DELAY_PER_METRE
    const beatAt = (n) => n * period + delay
    if (heartN === null || beatAt(heartN) < gameT - 1)
      heartN = Math.ceil((gameT - delay) / period)
    while (beatAt(heartN) + 0.06 * period <= gameT + 0.25) {
      const lub = beatAt(heartN) + 0.06 * period
      const dub = beatAt(heartN) + 0.3 * period
      if (lub >= gameT - 0.02) thump(now() + Math.max(0, lub - gameT), 1)
      if (dub >= gameT - 0.02) thump(now() + Math.max(0, dub - gameT), 0.65)
      heartN++
    }
  }

  const stepBus = voiceOut(0.6)
  function step(speed) {
    const t = now()
    const loud = Math.min(1, 0.45 + speed * 0.12)
    const g = gain(0, stepBus)
    noiseSource(
      filter('lowpass', 520 + Math.random() * 200, 0.9, g),
      false,
    ).start(t, Math.random() * 2, 0.2)
    envelope(g, t, 0.22 * loud, 0.005, 0.12)
    const th = gain(0, stepBus)
    const o = osc('sine', 80 + Math.random() * 10, th)
    envelope(th, t, 0.18 * loud, 0.004, 0.09)
    o.start(t)
    o.stop(t + 0.2)
  }

  function clunk(dest, strength = 1, when = now()) {
    const t = when
    const g = gain(0, dest)
    const o = osc('sine', 95, g)
    o.frequency.setValueAtTime(95, t)
    o.frequency.exponentialRampToValueAtTime(42, t + 0.25)
    envelope(g, t, 0.7 * strength, 0.005, 0.45)
    o.start(t)
    o.stop(t + 0.6)

    const n = gain(0, dest)
    noiseSource(filter('bandpass', 320, 1.2, n), false).start(
      t,
      Math.random() * 2,
      0.4,
    )
    envelope(n, t, 0.45 * strength, 0.003, 0.22)

    for (const [f, a] of [
      [311, 0.06],
      [467, 0.04],
      [742, 0.025],
    ]) {
      const r = gain(0, dest)
      const ro = osc('sine', f * (0.99 + Math.random() * 0.02), r)
      envelope(r, t, a * strength, 0.004, 1.1)
      ro.start(t)
      ro.stop(t + 1.3)
    }
  }

  function buildLiftVoice() {
    const out = gain(1, null)
    const muffle = filter('lowpass', 2400, 0.7, voiceOut(0.45))
    out.connect(muffle)
    const motorGain = gain(0, out)
    const motor = filter('lowpass', 220, 1.5, motorGain)
    osc('sawtooth', 36, gain(0.25, motor)).start()
    osc('sawtooth', 36.7, gain(0.2, motor)).start()
    noiseSource(filter('lowpass', 160, 0.7, gain(0.5, motor))).start()
    const grindGain = gain(0, out)
    const grind = filter('bandpass', 700, 9, grindGain)
    noiseSource(grind).start()
    return { out, muffle, motorGain, grindGain, grind, running: false }
  }

  function buildBuzzVoice() {
    const out = gain(0, voiceOut(0.2))
    const hp = filter('highpass', 180, 0.7, out)
    osc('sawtooth', 100, gain(0.1, hp)).start()
    osc('square', 150, gain(0.03, hp)).start()
    return { out, sputterAt: 0 }
  }

  const liftVoices = [buildLiftVoice(), buildLiftVoice()]
  const buzzVoices = [buildBuzzVoice(), buildBuzzVoice()]

  function crackle(dest, strength = 1) {
    const t = now()
    const g = gain(0, dest)
    noiseSource(filter('highpass', 2500, 0.7, g), false).start(
      t,
      Math.random() * 2,
      0.08,
    )
    envelope(g, t, 0.25 * strength, 0.001, 0.04 + Math.random() * 0.05)
  }

  const lightOut = gain(0, voiceOut(0.7))
  for (const [f, a, rate] of [
    [110, 0.1, 0.11],
    [220, 0.08, 0.23],
    [277.18, 0.06, 0.31],
    [329.63, 0.06, 0.19],
    [440, 0.04, 0.41],
    [554.37, 0.025, 0.53],
  ]) {
    const g = gain(a, lightOut)
    osc('sine', f, g).start()
    const trem = osc('sine', rate)
    trem.connect(gain(a * 0.6)).connect(g.gain)
    trem.start()
  }
  noiseSource(filter('bandpass', 6500, 1.5, gain(0.03, lightOut))).start()

  const keyPan = ctx.createStereoPanner()
  const keyOut = gain(0, null)
  keyOut.connect(keyPan)
  keyPan.connect(voiceOut(0.5))
  for (const [f, a, rate] of [
    [1318.5, 0.05, 3.1],
    [1975.5, 0.03, 4.7],
    [2637, 0.015, 6.3],
  ]) {
    const g = gain(a, keyOut)
    osc('sine', f, g).start()
    const trem = osc('sine', rate)
    trem.connect(gain(a * 0.7)).connect(g.gain)
    trem.start()
  }
  noiseSource(filter('bandpass', 4200, 6, gain(0.04, keyOut))).start()

  function keycard() {
    const t = now()
    const bus = gain(1, sfxOut)
    bus.connect(gain(1.2, reverbSend))
    [659.25, 783.99, 987.77, 1318.5].forEach((f, i) => {
      const g = gain(0, bus)
      const o = osc('sine', f, g)
      o.detune.value = (Math.random() - 0.5) * 14
      envelope(g, t + i * 0.07, 0.11, 0.01, 3.2)
      o.start(t + i * 0.07)
      o.stop(t + 4)
    })
  }

  function powerUp(nearby) {
    const t = now() + 0.6
    const dest = filter(
      'lowpass',
      nearby ? 6000 : 700,
      0.7,
      gain(nearby ? 1 : 0.55, voiceOut(0.8)),
    )
    const g = gain(0, dest)
    const o = osc('sawtooth', 60, filter('bandpass', 900, 3, g))
    o.frequency.setValueAtTime(60, t)
    o.frequency.exponentialRampToValueAtTime(880, t + 1.6)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.35, t + 1.4)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2)
    o.start(t)
    o.stop(t + 2.3)
    clunk(dest, 0.8, t + 1.6)
  }

  function torchCrackle() {
    crackle(sfxOut, 0.5)
  }

  function update(game) {
    setLevel(game.level)

    const centre = Math.hypot(game.x, game.z)
    const heartVol =
      game.level === 2 ? 0.45 + 0.55 * (1 - Math.min(centre / 30, 1)) : 0
    glide(heartBus.gain, heartVol, 0.6)
    if (game.level === 2) updateHeart(game.t, game.x, game.z)
    else heartN = null

    if (drone3Throb) {
      const period = 60 / HEART_BPM
      const p =
        ((((game.t - centre * HEART_DELAY_PER_METRE) / period) % 1) + 1) % 1
      const beat =
        Math.exp(-(((p - 0.06) * 18) ** 2)) +
        0.65 * Math.exp(-(((p - 0.3) * 18) ** 2))
      drone3Throb.gain.setTargetAtTime(0.35 + 0.65 * beat, now(), 0.03)
    }

    game.lifts.forEach((lift, i) => {
      const v = liftVoices[i]
      const dist = lift.rider ? 0 : lift.distance
      const vol = lift.rider ? 1 : Math.min(1, 2.2 / (1 + dist * 0.35))
      glide(v.out.gain, vol, 0.2)
      glide(v.muffle.frequency, lift.rider || lift.sameFloor ? 2400 : 380, 0.4)
      glide(v.motorGain.gain, lift.moving ? 0.9 : 0, lift.moving ? 0.25 : 0.12)
      glide(v.grindGain.gain, lift.moving ? 0.22 : 0, 0.3)
      if (lift.moving)
        glide(
          v.grind.frequency,
          500 + lift.progress * 900 + Math.random() * 60,
          0.08,
        )

      const b = buzzVoices[i]
      const near =
        !lift.powered && lift.onShaftFloor
          ? Math.max(0, 1 - lift.shaftDist / 9)
          : 0
      glide(b.out.gain, near * near * 0.8, 0.3)
      if (near > 0 && Math.random() < 0.06) crackle(b.out, 1.6)
    })

    const keyNear = Math.max(0, 1 - game.keyDist / 16)
    glide(keyOut.gain, keyNear * keyNear * 1.1, 0.3)
    glide(keyPan.pan, game.keyPan * 0.8, 0.15)

    const lightVol =
      game.level === 2
        ? Math.pow(Math.max(0, 1 - game.exitDist / 16), 2) * 0.9
        : 0
    glide(lightOut.gain, lightVol, 0.5)
  }

  function liftDepart(i) {
    clunk(liftVoices[i].out, 1)
  }
  function liftArrive(i) {
    clunk(liftVoices[i].out, 1.1)
  }

  function escape() {
    drones.forEach((d) => glide(d.gain, 0, 1.0))
    glide(heartBus.gain, 0, 0.4)
    glide(keyOut.gain, 0, 0.4)
    const g = lightOut.gain
    const t = now()
    g.cancelScheduledValues(t)
    g.setValueAtTime(g.value, t)
    g.linearRampToValueAtTime(1.6, t + 2.0)
    g.linearRampToValueAtTime(0.9, t + 6)
    g.linearRampToValueAtTime(0, t + 14)
    // Freeze further updates so nothing turns back up.
    api.update = () => {}
  }

  const api = {
    update,
    step,
    keycard,
    powerUp,
    liftDepart,
    liftArrive,
    torchCrackle,
    escape,
  }
  return api
}
