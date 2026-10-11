import * as THREE from 'three'
import vertexShader from '../shaders/surface.vert'
import fragmentShader from '../shaders/surface.frag'
import { CELL, WALL_HEIGHT, WALL_THICK } from '../config.js'

// One time uniform shared by every material, so a single update per frame drives all of them.
export const shared = {
  uTime: { value: 0 },
  uCameraPos: { value: new THREE.Vector3() },
  uFogDensity: { value: 0 },
  uTorch: { value: 0 },
}

function makeSurface(level, surface, breath) {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      ...shared, // same uniform objects, not copies
      uLevel: { value: level },
      uSurface: { value: surface },
      uBreath: { value: breath },
      uPanelSize: { value: new THREE.Vector2((CELL + WALL_THICK) / 2, WALL_HEIGHT / 2) },
    },
  })
}

// How far walls bulge per level: the higher you climb, the more alive it gets.
const BREATH = [0.04, 0.07, 0.11]

export function createLevelMaterials(levelCount = 3) {
  return Array.from({ length: levelCount }, (_, level) => ({
    wall: makeSurface(level, 0, BREATH[level]),
    floor: makeSurface(level, 1, 0),
  }))
}
