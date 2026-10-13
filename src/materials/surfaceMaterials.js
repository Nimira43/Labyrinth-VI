import * as THREE from 'three'
import vertexShader from '../shaders/surface.vert'
import fragmentShader from '../shaders/surface.frag'
import { CELL, WALL_HEIGHT, WALL_THICK } from '../config.js'

export const shared = {
  uTime: { value: 0 },
  uCameraPos: { value: new THREE.Vector3() },
  uFogDensity: { value: 0 },
  uTorch: { value: 0 },
  uTorchPower: { value: 1 },
  uViewDir: { value: new THREE.Vector3(0, 0, -1) },
}

function makeSurface(level, surface, breath) {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      ...shared, 
      uLevel: { value: level },
      uSurface: { value: surface },
      uBreath: { value: breath },
      uPanelSize: {
        value: new THREE.Vector2((CELL + WALL_THICK) / 2, WALL_HEIGHT / 2),
      },
    },
  })
}

const BREATH = [0.04, 0.07, 0.11]

export function createLevelMaterials(levelCount = 3) {
  return Array.from({ length: levelCount }, (_, level) => ({
    wall: makeSurface(level, 0, BREATH[level]),
    floor: makeSurface(level, 1, 0),
  }))
}
