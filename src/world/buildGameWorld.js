import * as THREE from 'three'
import { shaftHoles } from '../maze/buildLabyrinth.js'
import { N, E, S, W } from '../maze/grid.js'
import { shared } from '../materials/surfaceMaterials.js'
import beamVert from '../shaders/beam.vert'
import beamFrag from '../shaders/beam.frag'
import { CELL, WALL_HEIGHT, WALL_THICK, SLAB, LEVEL_HEIGHT } from '../config.js'
import { makeCoords } from './coords.js'

// Builds the labyrinth at true scale for first-person play:
// three floors stacked with no gaps, each with walls, a floor and a ceiling.
// Only the player's current floor is drawn; the others are hidden (see setVisibleLevel).

const LIFT_TINT = ['#7fd8ff', '#ffb347']

export function buildGameWorld(lab, levelMaterials) {
  const { cx, cz } = makeCoords(lab)
  const baseY = (level) => level * LEVEL_HEIGHT
  const { floorHoles, ceilingHoles } = shaftHoles(lab)
  const exitIdx = lab.exit.z * lab.width + lab.exit.x

  const root = new THREE.Group()
  const animators = []
  const disposables = []
  const track = (...items) => (disposables.push(...items), items[0])

  const wallGeo = track(new THREE.BoxGeometry(CELL + WALL_THICK, WALL_HEIGHT, WALL_THICK, 10, 8, 1))
  const slabGeo = track(new THREE.BoxGeometry(CELL, SLAB, CELL))
  const ceilGeo = track(new THREE.PlaneGeometry(CELL, CELL).rotateX(Math.PI / 2)) // faces down

  const instanced = (geo, mat, matrices) => {
    const mesh = new THREE.InstancedMesh(geo, mat, matrices.length)
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m))
    return mesh
  }

  // The three floors
  const levels = lab.floors.map((grid, level) => {
    const group = new THREE.Group()
    const y = baseY(level)
    const wallY = y + WALL_HEIGHT / 2
    const q = new THREE.Quaternion()
    const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)
    const one = new THREE.Vector3(1, 1, 1)
    const at = (px, pz, rot) => new THREE.Matrix4().compose(new THREE.Vector3(px, wallY, pz), rot, one)

    const walls = []
    for (let z = 0; z < grid.depth; z++) {
      for (let x = 0; x < grid.width; x++) {
        const c = grid.cells[z * grid.width + x]
        const px = cx(x)
        const pz = cz(z)
        if (c & N) walls.push(at(px, pz - CELL / 2, q))
        if (c & W) walls.push(at(px - CELL / 2, pz, turn))
        if (x === grid.width - 1 && c & E) walls.push(at(px + CELL / 2, pz, turn))
        if (z === grid.depth - 1 && c & S) walls.push(at(px, pz + CELL / 2, q))
      }
    }
    const wallMesh = instanced(wallGeo, levelMaterials[level].wall, walls)
    wallMesh.frustumCulled = false // breathing vertices move outside the computed bounds
    group.add(wallMesh)

    // Floor slabs and ceiling tiles, leaving holes for the lift shafts (and the exit light).
    const floors = []
    const ceilings = []
    for (let i = 0; i < grid.cells.length; i++) {
      const px = cx(i % grid.width)
      const pz = cz(Math.floor(i / grid.width))
      if (!floorHoles[level].has(i)) floors.push(new THREE.Matrix4().makeTranslation(px, y - SLAB / 2, pz))
      const roofGap = level === lab.exit.level && i === exitIdx
      if (!ceilingHoles[level].has(i) && !roofGap)
        ceilings.push(new THREE.Matrix4().makeTranslation(px, y + WALL_HEIGHT - 0.005, pz))
    }
    group.add(instanced(slabGeo, levelMaterials[level].floor, floors))
    group.add(instanced(ceilGeo, levelMaterials[level].floor, ceilings))

    root.add(group)
    return group
  })

  // ── Lift shafts: the Tron columns ─────────────────────────
  lab.lifts.forEach((lift, i) => {
    const bottom = baseY(lift.fromLevel)
    const height = baseY(lift.toLevel) - bottom + WALL_HEIGHT
    const size = CELL - WALL_THICK * 1.5

    const shaftGeo = track(new THREE.BoxGeometry(size, height, size))
    const edgeGeo = track(new THREE.EdgesGeometry(shaftGeo))
    const edgeMat = track(new THREE.LineBasicMaterial({ color: LIFT_TINT[i], transparent: true }))
    const glassMat = track(
      new THREE.MeshBasicMaterial({
        color: LIFT_TINT[i], transparent: true, opacity: 0.05, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      }),
    )
    const shaft = new THREE.Mesh(shaftGeo, glassMat)
    shaft.position.set(cx(lift.x), bottom + height / 2, cz(lift.z))
    shaft.add(new THREE.LineSegments(edgeGeo, edgeMat))
    root.add(shaft)

    // The platform waits at the bottom for now. Riding it comes next.
    const platMat = track(new THREE.MeshBasicMaterial({ color: LIFT_TINT[i] }))
    const platGeo = track(new THREE.BoxGeometry(size * 0.92, 0.08, size * 0.92))
    const platform = new THREE.Mesh(platGeo, platMat)
    platform.position.set(cx(lift.x), bottom + 0.04, cz(lift.z))
    root.add(platform)

    // A slow electrical hum in the edge glow.
    animators.push((t) => {
      edgeMat.opacity = 0.65 + 0.25 * Math.sin(t * 2.1 + i) + (Math.random() < 0.01 ? -0.4 : 0)
    })
  })

  // Keycards: spinning, with a soft halo you can spot down a corridor
  const haloTex = track(makeGlowTexture())
  lab.keycards.forEach((card) => {
    const y = baseY(card.level) + 1.15
    const holder = new THREE.Group()
    holder.position.set(cx(card.x), y, cz(card.z))

    const cardMat = track(new THREE.MeshBasicMaterial({ color: '#ffd23f' }))
    const cardGeo = track(new THREE.BoxGeometry(0.5, 0.32, 0.03))
    const mesh = new THREE.Mesh(cardGeo, cardMat)
    holder.add(mesh)

    const haloMat = track(
      new THREE.SpriteMaterial({
        map: haloTex, color: '#ffbb33', transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    const halo = new THREE.Sprite(haloMat)
    halo.scale.setScalar(2.2)
    holder.add(halo)

    levels[card.level].add(holder)
    animators.push((t) => {
      mesh.rotation.y = t * 1.4
      holder.position.y = y + Math.sin(t * 1.8 + card.id) * 0.08
      haloMat.opacity = 0.55 + 0.2 * Math.sin(t * 3.0 + card.id)
    })
  })

  // Exit: the shimmering light through Level 3's roof
  {
    const beamHeight = WALL_HEIGHT + 14
    const beamMat = track(
      new THREE.ShaderMaterial({
        vertexShader: beamVert,
        fragmentShader: beamFrag,
        uniforms: { uTime: shared.uTime, uCameraPos: shared.uCameraPos, uBeamHeight: { value: beamHeight } },
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      }),
    )
    const beamGeo = track(new THREE.CylinderGeometry(CELL * 0.32, CELL * 0.4, beamHeight, 32, 1, true))
    const beam = new THREE.Mesh(beamGeo, beamMat)
    beam.position.set(cx(lab.exit.x), baseY(lab.exit.level) + beamHeight / 2, cz(lab.exit.z))
    levels[lab.exit.level].add(beam)
  }

  return {
    root,
    levels,
    setVisibleLevel(level) {
      levels.forEach((g, i) => (g.visible = i === level))
    },
    animate(t) {
      animators.forEach((fn) => fn(t))
    },
    dispose() {
      root.removeFromParent()
      disposables.forEach((d) => d.dispose())
    },
  }
}

function makeGlowTexture() {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const g = canvas.getContext('2d')
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, 'rgba(255,255,255,0.9)')
  grad.addColorStop(0.25, 'rgba(255,255,255,0.35)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}
