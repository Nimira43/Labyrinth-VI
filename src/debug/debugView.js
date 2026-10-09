import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { buildLabyrinth, shaftHoles } from '../maze/buildLabyrinth.js'
import { N, E, S, W } from '../maze/grid.js'
import { randomSeed } from '../maze/rng.js'
import { createLevelMaterials, shared } from '../materials/surfaceMaterials.js'
import beamVert from '../shaders/beam.vert'
import beamFrag from '../shaders/beam.frag'
import {
  CELL, WALL_HEIGHT, WALL_THICK, SLAB, LEVEL_HEIGHT,
  MAZE_WIDTH, MAZE_DEPTH, LOOP_CHANCE,
} from '../config.js'

// Generator debug view.
// Shows all three floors stacked like the concept sketch, with lifts, keycards and the exit.
//
// Keys:  R new maze · 1/2/3 show one floor · 0 show all · E explode/collapse
//        P toggle route · C toggle Level 3 roof

const LEVEL_TINT = ['#5b8cff', '#c9b23a', '#ff3344'] // HUD/route colours per floor
const LIFT_TINT = ['#7fd8ff', '#ffb347']
const EXPLODED = 5 // vertical spacing multiplier when floors are pulled apart

export function createDebugView(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#040405')

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true

  const levelMaterials = createLevelMaterials(3)
  const hud = createHud(container)

  const state = {
    seed: Number(new URLSearchParams(location.search).get('seed')) || randomSeed(),
    exploded: true,
    only: -1, // -1 = all floors
    showRoute: true,
    showRoof: false,
  }

  let world = null // everything built for the current maze

  function rebuild({ keepCamera = false } = {}) {
    if (world) disposeWorld(world)
    const lab = buildLabyrinth({
      width: MAZE_WIDTH, depth: MAZE_DEPTH, seed: state.seed, loopChance: LOOP_CHANCE,
    })
    world = buildWorld(lab, levelMaterials, state)
    scene.add(world.root)
    applyVisibility()
    hud.update(lab, state)
    if (!keepCamera) frameCamera(lab)
  }

  function frameCamera(lab) {
    const size = Math.max(lab.width, lab.depth) * CELL
    const midY = state.exploded ? LEVEL_HEIGHT * EXPLODED : LEVEL_HEIGHT
    controls.target.set(0, midY, 0)
    camera.position.set(size * 0.75, midY + size * 1.15, size * 0.95)
    controls.update()
  }

  function applyVisibility() {
    world.levels.forEach((g, i) => (g.visible = state.only === -1 || state.only === i))
    world.routes.forEach((r) => (r.visible = state.showRoute))
    world.roof.visible = state.showRoof
  }

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase()
    if (k === 'r') {
      state.seed = randomSeed()
      history.replaceState(null, '', `?seed=${state.seed}`)
      rebuild({ keepCamera: true })
    } else if (k === 'e') {
      state.exploded = !state.exploded
      rebuild()
    } else if (k === 'p') {
      state.showRoute = !state.showRoute
      applyVisibility()
    } else if (k === 'c') {
      state.showRoof = !state.showRoof
      applyVisibility()
    } else if ('0123'.includes(k)) {
      state.only = Number(k) - 1
      applyVisibility()
    }
    hud.update(world.lab, state)
  })

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  })

  rebuild()
  history.replaceState(null, '', `?seed=${state.seed}`)

  const timer = new THREE.Timer()
  renderer.setAnimationLoop((now) => {
    timer.update(now)
    const t = timer.getElapsed()
    shared.uTime.value = t
    shared.uCameraPos.value.copy(camera.position)
    world.animate(t, camera)
    controls.update()
    renderer.render(scene, camera)
  })
}

// World building

function buildWorld(lab, levelMaterials, state) {
  const spacing = state.exploded ? EXPLODED : 1
  const baseY = (level) => level * LEVEL_HEIGHT * spacing
  const cx = (x) => (x - (lab.width - 1) / 2) * CELL
  const cz = (z) => (z - (lab.depth - 1) / 2) * CELL

  const root = new THREE.Group()
  const owned = [] // materials created here, disposed on rebuild
  const animators = []
  const { floorHoles } = shaftHoles(lab)

  const wallGeo = new THREE.BoxGeometry(CELL + WALL_THICK, WALL_HEIGHT, WALL_THICK, 10, 8, 1)
  const slabGeo = new THREE.BoxGeometry(CELL, SLAB, CELL)

  // Floors: walls + floor slabs
  const levels = lab.floors.map((grid, level) => {
    const group = new THREE.Group()
    const y = baseY(level)
    const wallY = y + WALL_HEIGHT / 2
    const walls = []
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)
    const one = new THREE.Vector3(1, 1, 1)

    for (let z = 0; z < grid.depth; z++) {
      for (let x = 0; x < grid.width; x++) {
        const c = grid.cells[z * grid.width + x]
        const px = cx(x)
        const pz = cz(z)
        // Each cell owns its north and west walls; the outer east and south edges close the box.
        if (c & N) walls.push(m.clone().compose(new THREE.Vector3(px, wallY, pz - CELL / 2), q, one))
        if (c & W) walls.push(m.clone().compose(new THREE.Vector3(px - CELL / 2, wallY, pz), turn, one))
        if (x === grid.width - 1 && c & E)
          walls.push(m.clone().compose(new THREE.Vector3(px + CELL / 2, wallY, pz), turn, one))
        if (z === grid.depth - 1 && c & S)
          walls.push(m.clone().compose(new THREE.Vector3(px, wallY, pz + CELL / 2), q, one))
      }
    }

    const wallMesh = new THREE.InstancedMesh(wallGeo, levelMaterials[level].wall, walls.length)
    walls.forEach((mat, i) => wallMesh.setMatrixAt(i, mat))
    wallMesh.frustumCulled = false // bulging vertices move outside the computed bounds
    group.add(wallMesh)

    // Floor slabs, one per cell, skipping the shaft hole.
    const holes = floorHoles[level]
    const tiles = []
    for (let i = 0; i < grid.cells.length; i++) {
      if (holes.has(i)) continue
      const x = i % grid.width
      const z = Math.floor(i / grid.width)
      tiles.push(new THREE.Matrix4().makeTranslation(cx(x), y - SLAB / 2, cz(z)))
    }
    const floorMesh = new THREE.InstancedMesh(slabGeo, levelMaterials[level].floor, tiles.length)
    tiles.forEach((mat, i) => floorMesh.setMatrixAt(i, mat))
    group.add(floorMesh)

    root.add(group)
    return group
  })

  // ── Level 3 roof, with the gap the light falls through ────
  const roof = new THREE.Group()
  {
    const tiles = []
    const exitIdx = lab.exit.z * lab.width + lab.exit.x
    const y = baseY(2) + WALL_HEIGHT + SLAB / 2
    for (let i = 0; i < lab.width * lab.depth; i++) {
      if (i === exitIdx) continue
      tiles.push(new THREE.Matrix4().makeTranslation(cx(i % lab.width), y, cz(Math.floor(i / lab.width))))
    }
    const mesh = new THREE.InstancedMesh(slabGeo, levelMaterials[2].floor, tiles.length)
    tiles.forEach((mat, i) => mesh.setMatrixAt(i, mat))
    roof.add(mesh)
    root.add(roof)
  }

  // Lift shafts and platforms 
  lab.lifts.forEach((lift, i) => {
    const bottom = baseY(lift.fromLevel)
    const top = baseY(lift.toLevel)
    const height = top - bottom + WALL_HEIGHT
    const size = CELL - WALL_THICK * 1.5

    const shaftGeo = new THREE.BoxGeometry(size, height, size)
    const edgeMat = new THREE.LineBasicMaterial({ color: LIFT_TINT[i], transparent: true, opacity: 0.8 })
    const glassMat = new THREE.MeshBasicMaterial({
      color: LIFT_TINT[i], transparent: true, opacity: 0.06, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    })
    owned.push(edgeMat, glassMat)

    const shaft = new THREE.Mesh(shaftGeo, glassMat)
    shaft.position.set(cx(lift.x), bottom + height / 2, cz(lift.z))
    shaft.add(new THREE.LineSegments(new THREE.EdgesGeometry(shaftGeo), edgeMat))
    root.add(shaft)

    // The platform rides up and down so you can see what goes where.
    const platMat = new THREE.MeshBasicMaterial({ color: LIFT_TINT[i] })
    owned.push(platMat)
    const platform = new THREE.Mesh(new THREE.BoxGeometry(size * 0.92, 0.12, size * 0.92), platMat)
    platform.position.set(cx(lift.x), bottom, cz(lift.z))
    root.add(platform)

    animators.push((t) => {
      // Wait at the bottom, ride up, wait at the top, ride down.
      const cycle = (t * 0.12 + i * 0.5) % 1
      const k = cycle < 0.2 ? 0 : cycle < 0.5 ? (cycle - 0.2) / 0.3 : cycle < 0.7 ? 1 : 1 - (cycle - 0.7) / 0.3
      const eased = k * k * (3 - 2 * k)
      platform.position.y = THREE.MathUtils.lerp(bottom + 0.06, top + 0.06, eased)
    })
  })

  // Start marker 
  {
    const mat = new THREE.MeshBasicMaterial({ color: '#ffffff', wireframe: true })
    owned.push(mat)
    const start = new THREE.Mesh(new THREE.OctahedronGeometry(0.6), mat)
    start.position.set(cx(lab.start.x), baseY(0) + 1.4, cz(lab.start.z))
    levels[0].add(start)
    animators.push((t) => {
      start.rotation.y = t * 0.8
      start.position.y = baseY(0) + 1.4 + Math.sin(t * 1.5) * 0.15
    })
  }

  // Keycards
  lab.keycards.forEach((card) => {
    const mat = new THREE.MeshBasicMaterial({ color: '#ffd23f' })
    owned.push(mat)
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.6), mat)
    const y = baseY(card.level) + 1.1
    mesh.position.set(cx(card.x), y, cz(card.z))
    levels[card.level].add(mesh)
    animators.push((t) => {
      mesh.rotation.set(0.5, t * 1.6, 0)
      mesh.position.y = y + Math.sin(t * 2 + card.id) * 0.12
    })
  })

  // Exit: shimmering beam through the roof gap 
  {
    const beamHeight = WALL_HEIGHT + 14
    const beamMat = new THREE.ShaderMaterial({
      vertexShader: beamVert,
      fragmentShader: beamFrag,
      uniforms: {
        uTime: shared.uTime,
        uCameraPos: shared.uCameraPos,
        uBeamHeight: { value: beamHeight },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
    owned.push(beamMat)
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(CELL * 0.32, CELL * 0.4, beamHeight, 32, 1, true),
      beamMat,
    )
    beam.position.set(cx(lab.exit.x), baseY(2) + beamHeight / 2, cz(lab.exit.z))
    levels[2].add(beam)
  }

  // Intended route per floor (debug only) 
  const routes = lab.routes.map((route, level) => {
    const pts = route.map((c) => new THREE.Vector3(cx(c.x), baseY(level) + 0.25, cz(c.z)))
    const mat = new THREE.LineDashedMaterial({
      color: LEVEL_TINT[level], dashSize: 0.8, gapSize: 0.5, transparent: true, opacity: 0.9,
      depthTest: false, // draw through walls so the whole route is visible
    })
    owned.push(mat)
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat)
    line.computeLineDistances()
    line.renderOrder = 10
    levels[level].add(line)
    return line
  })

  return {
    lab,
    root,
    levels,
    routes,
    roof,
    owned,
    animate: (t) => animators.forEach((fn) => fn(t)),
  }
}

function disposeWorld(world) {
  world.root.removeFromParent()
  const geos = new Set()
  world.root.traverse((o) => o.geometry && geos.add(o.geometry))
  geos.forEach((g) => g.dispose())
  world.owned.forEach((m) => m.dispose())
}

// HUD

function createHud(container) {
  const el = document.createElement('div')
  el.className = 'hud'
  container.appendChild(el)

  return {
    update(lab, state) {
      const floorName = ['Level 1', 'Level 2', 'Level 3']
      const legs = ['start → card → lift 1', 'lift 1 → card → lift 2', 'lift 2 → exit']
      const rows = lab.routes
        .map(
          (r, i) => `
          <div class="row ${state.only === -1 || state.only === i ? '' : 'dim'}">
            <span class="swatch" style="background:${LEVEL_TINT[i]}"></span>
            <span>${floorName[i]}</span>
            <span class="muted">${legs[i]}</span>
            <span class="num">${r.length - 1}</span>
          </div>`,
        )
        .join('')
      const total = lab.routes.reduce((s, r) => s + r.length - 1, 0)

      el.innerHTML = `
        <h1>Labyrinth VI <span class="muted">· generator</span></h1>
        <div class="meta">seed <b>${lab.seed}</b> · ${lab.width}×${lab.depth} cells</div>
        ${rows}
        <div class="row total"><span></span><span class="span2">Shortest escape (cells walked)</span><span class="num">${total}</span></div>
        <div class="keys">
          <span><kbd>R</kbd> new maze</span>
          <span><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> one floor · <kbd>0</kbd> all</span>
          <span><kbd>E</kbd> ${state.exploded ? 'collapse' : 'explode'}</span>
          <span><kbd>P</kbd> route ${state.showRoute ? 'on' : 'off'}</span>
          <span><kbd>C</kbd> roof ${state.showRoof ? 'on' : 'off'}</span>
        </div>`
    },
  }
}
