import { createAudioEngine } from './engine.js'
import { createMusic } from './music.js'
import { createSfx } from './sfx.js'

export function createAudio() {
  const engine = createAudioEngine()
  const music = createMusic(engine)

  let real = null
  const build = () => {
    if (!real && engine.unlocked) real = createSfx(engine)
    return real
  }
  build()

  const sfx = new Proxy(
    {},
    {
      get:
        (_, name) =>
        (...args) =>
          build()?.[name]?.(...args),
    },
  )

  return { engine, music, sfx }
}
