import * as THREE from 'three'
import { createRandom } from '../lib/rng.ts'
import type { TimeUniform } from './materials.ts'

/** Raum um die Kamera, in dem es schneit. Flocken, die ihn verlassen, tauchen gegenüber wieder auf. */
const SNOW_BOX = new THREE.Vector3(36, 26, 34)

const SNOW_VERTEX = /* glsl */ `
uniform float uTime;
uniform vec3 uCenter;
uniform vec3 uBox;
uniform float uScale;
uniform float uMaxSize;
attribute float aSize;
varying float vAlpha;
void main() {
  vec3 flake = position * uBox;
  flake.y -= uTime * (0.9 + position.x * 1.3);
  flake.x += uTime * 0.45 + sin(uTime * (0.5 + position.y) + position.z * 6.283) * 0.5;
  flake.z += cos(uTime * (0.4 + position.x * 0.6) + position.y * 6.283) * 0.4;
  flake = mod(flake - uCenter, uBox) + uCenter - uBox * 0.5;

  vec4 mvPosition = modelViewMatrix * vec4(flake, 1.0);
  float away = -mvPosition.z;
  gl_PointSize = min(aSize * uScale / max(away, 0.1), uMaxSize);
  // Nahe Flocken sind groß und zart (unscharf), ferne klein und deutlich.
  vAlpha = smoothstep(0.8, 3.0, away)
    * mix(0.45, 0.95, smoothstep(3.0, 16.0, away))
    * (1.0 - smoothstep(42.0, 58.0, away));
  gl_Position = projectionMatrix * mvPosition;
}
`

const SOFT_DOT_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
void main() {
  float alpha = smoothstep(0.5, 0.15, length(gl_PointCoord - 0.5)) * vAlpha;
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(uColor, alpha);
}
`

export interface Snowfall {
  points: THREE.Points
  /** `pixelsPerUnit`: Bildpunkte, die eine Längeneinheit in einem Meter Entfernung einnimmt. */
  update(camera: THREE.Camera, pixelsPerUnit: number, pixelRatio: number): void
  /** 0 = ein paar Flocken, 1 = dichtes Schneetreiben. */
  setAmount(amount: number): void
  dispose(): void
}

export function createSnowfall(time: TimeUniform, count = 2400): Snowfall {
  const rnd = createRandom(1224)
  const seeds: number[] = []
  const sizes: number[] = []
  for (let i = 0; i < count; i++) {
    seeds.push(rnd.next(), rnd.next(), rnd.next())
    sizes.push(rnd.range(0.035, 0.09))
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(seeds, 3))
  geometry.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1))

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: time,
      uCenter: { value: new THREE.Vector3() },
      uBox: { value: SNOW_BOX },
      uScale: { value: 1 },
      uMaxSize: { value: 30 },
      uColor: { value: new THREE.Color(0.97, 0.98, 1) },
    },
    vertexShader: SNOW_VERTEX,
    fragmentShader: SOFT_DOT_FRAGMENT,
    transparent: true,
    depthWrite: false,
    fog: false,
  })

  const points = new THREE.Points(geometry, material)
  points.frustumCulled = false
  points.renderOrder = 10
  const forward = new THREE.Vector3()

  const setAmount = (amount: number) => {
    const share = 0.3 + 0.7 * Math.min(Math.max(amount, 0), 1)
    geometry.setDrawRange(0, Math.round(count * share))
  }
  setAmount(0)

  return {
    points,
    update(camera, pixelsPerUnit, pixelRatio) {
      camera.getWorldDirection(forward)
      material.uniforms.uCenter.value.copy(camera.position).addScaledVector(forward, 14)
      material.uniforms.uScale.value = pixelsPerUnit
      material.uniforms.uMaxSize.value = 30 * pixelRatio
    },
    setAmount,
    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}

const PUFFS_PER_CHIMNEY = 6

const SMOKE_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uScale;
attribute float aPhase;
attribute float aActive;
varying float vAlpha;
void main() {
  float life = fract(uTime * 0.09 + aPhase);
  vec3 puff = position;
  puff.y += life * 3.0;
  puff.x += life * life * 1.6 + sin(life * 7.0 + aPhase * 40.0) * 0.14;
  vec4 mvPosition = modelViewMatrix * vec4(puff, 1.0);
  gl_PointSize = (0.8 + life * 1.8) * uScale / max(-mvPosition.z, 0.1);
  vAlpha = aActive * smoothstep(0.0, 0.1, life) * (1.0 - life) * 0.3
    * exp(-0.00012 * mvPosition.z * mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}
`

export interface Smoke {
  points: THREE.Points
  /** Wie kräftig der Schornstein mit diesem Index raucht (0 = aus). */
  setStrength(chimney: number, strength: number): void
  update(pixelsPerUnit: number): void
  dispose(): void
}

/** Rauchwölkchen über den Schornsteinen der bewohnten Häuser. */
export function createSmoke(origins: readonly THREE.Vector3[], time: TimeUniform): Smoke {
  const rnd = createRandom(77)
  const positions: number[] = []
  const phases: number[] = []
  for (const origin of origins) {
    const offset = rnd.next()
    for (let puff = 0; puff < PUFFS_PER_CHIMNEY; puff++) {
      positions.push(origin.x, origin.y, origin.z)
      phases.push(offset + puff / PUFFS_PER_CHIMNEY)
    }
  }
  const active = new THREE.Float32BufferAttribute(new Float32Array(phases.length), 1)
  active.setUsage(THREE.DynamicDrawUsage)

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1))
  geometry.setAttribute('aActive', active)

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: time,
      uScale: { value: 1 },
      uColor: { value: new THREE.Color(0.9, 0.88, 0.96) },
    },
    vertexShader: SMOKE_VERTEX,
    fragmentShader: SOFT_DOT_FRAGMENT,
    transparent: true,
    depthWrite: false,
    fog: false,
  })

  const points = new THREE.Points(geometry, material)
  points.frustumCulled = false
  points.renderOrder = 5

  return {
    points,
    setStrength(chimney, strength) {
      const start = chimney * PUFFS_PER_CHIMNEY
      if (active.getX(start) === strength) return
      for (let puff = 0; puff < PUFFS_PER_CHIMNEY; puff++) active.setX(start + puff, strength)
      active.needsUpdate = true
    },
    update(pixelsPerUnit) {
      material.uniforms.uScale.value = pixelsPerUnit
    },
    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}
