import * as THREE from 'three'
import { createRandom } from '../lib/rng.ts'
import type { TimeUniform } from './materials.ts'
import { SKY } from './palette.ts'
import { createMoonTexture, createSparkleTexture } from './textures.ts'

const DOME_RADIUS = 300
const STAR_COUNT = 420

const DOME_VERTEX = /* glsl */ `
varying vec3 vDirection;
void main() {
  vDirection = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const DOME_FRAGMENT = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uMiddle;
uniform vec3 uHorizon;
varying vec3 vDirection;
void main() {
  float height = normalize(vDirection).y;
  vec3 color = mix(uHorizon, uMiddle, smoothstep(0.0, 0.2, height));
  color = mix(color, uTop, smoothstep(0.12, 0.62, height));
  gl_FragColor = linearToOutputTexel(vec4(color, 1.0));
}
`

const STAR_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uPixelRatio;
attribute float aSize;
attribute float aPhase;
varying float vAlpha;
void main() {
  float twinkle = 0.6 + 0.4 * sin(uTime * (0.5 + fract(aPhase) * 1.6) + aPhase * 6.283);
  // Zum Horizont hin verschwinden die Sterne im Dunst.
  vAlpha = twinkle * smoothstep(0.06, 0.32, normalize(position).y);
  gl_PointSize = aSize * uPixelRatio;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const STAR_FRAGMENT = /* glsl */ `
varying float vAlpha;
void main() {
  float alpha = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5)) * vAlpha;
  gl_FragColor = vec4(1.0, 0.97, 0.88, alpha);
}
`

export interface Sky {
  group: THREE.Group
  /** Der Himmel wandert mit der Kamera mit – er ist unerreichbar weit weg. */
  follow(camera: THREE.Camera, time: number): void
  setPixelRatio(ratio: number): void
  /** Mondphase: 0 = Neumond, 0,5 = Vollmond. */
  setMoonPhase(phase: number): void
  /** Steht der Mondstaub-Mann aus Haus 5 auf dem Mond? */
  setMoonSnowman(visible: boolean): void
  /** Der Mond selbst – zum Antippen und Heranzoomen. */
  moon: THREE.Sprite
  dispose(): void
}

/** Abendhimmel mit Farbverlauf, Sternen, Mond und einem großen Stern über dem Weihnachtsbaum. */
export function createSky(time: TimeUniform): Sky {
  const rnd = createRandom(24)

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(DOME_RADIUS, 32, 16),
    new THREE.ShaderMaterial({
      uniforms: {
        uTop: { value: new THREE.Color(SKY.top) },
        uMiddle: { value: new THREE.Color(SKY.middle) },
        uHorizon: { value: new THREE.Color(SKY.horizon) },
      },
      vertexShader: DOME_VERTEX,
      fragmentShader: DOME_FRAGMENT,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    }),
  )
  dome.renderOrder = -10

  const positions: number[] = []
  const sizes: number[] = []
  const phases: number[] = []
  for (let i = 0; i < STAR_COUNT; i++) {
    const y = rnd.range(0.06, 1)
    const angle = rnd.range(0, Math.PI * 2)
    const ring = Math.sqrt(1 - y * y)
    const radius = DOME_RADIUS - 12
    positions.push(Math.cos(angle) * ring * radius, y * radius, Math.sin(angle) * ring * radius)
    sizes.push(rnd.range(1.1, 3.1))
    phases.push(rnd.range(0, 100))
  }
  const starGeometry = new THREE.BufferGeometry()
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  starGeometry.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1))
  starGeometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1))
  const starMaterial = new THREE.ShaderMaterial({
    uniforms: { uTime: time, uPixelRatio: { value: 1 } },
    vertexShader: STAR_VERTEX,
    fragmentShader: STAR_FRAGMENT,
    transparent: true,
    depthWrite: false,
    fog: false,
  })
  const stars = new THREE.Points(starGeometry, starMaterial)
  stars.renderOrder = -9

  const sprite = (texture: THREE.Texture, direction: THREE.Vector3, size: number) => {
    const material = new THREE.SpriteMaterial({ map: texture, depthWrite: false, fog: false })
    const result = new THREE.Sprite(material)
    result.position.copy(direction.normalize().multiplyScalar(DOME_RADIUS - 30))
    result.scale.setScalar(size)
    result.renderOrder = -8
    return result
  }
  // Der Mond steht über den Dächern, der große Stern über dem Ende der Straße.
  let moonPhase = 0.5
  let moonSnowman = false
  const repaintMoon = () => {
    moon.material.map?.dispose()
    moon.material.map = createMoonTexture(moonPhase, moonSnowman)
    moon.material.needsUpdate = true
  }
  const moon = sprite(createMoonTexture(moonPhase), new THREE.Vector3(-0.1, 0.168, -1), 36)
  const christmasStar = sprite(createSparkleTexture(), new THREE.Vector3(1, 0.3, -0.1), 46)

  const group = new THREE.Group()
  group.add(dome, stars, moon, christmasStar)
  for (const object of group.children) object.frustumCulled = false

  return {
    group,
    moon,
    follow(camera, seconds) {
      group.position.copy(camera.position)
      christmasStar.scale.setScalar(46 * (1 + 0.07 * Math.sin(seconds * 1.3)))
    },
    setMoonPhase(phase) {
      // Auf ein Hundertstel gerundet – öfter muss nicht neu gemalt werden.
      const rounded = Math.round(phase * 100) / 100
      if (rounded === moonPhase) return
      moonPhase = rounded
      repaintMoon()
    },
    setMoonSnowman(visible) {
      if (visible === moonSnowman) return
      moonSnowman = visible
      repaintMoon()
    },
    setPixelRatio(ratio) {
      starMaterial.uniforms.uPixelRatio.value = ratio
    },
    dispose() {
      dome.geometry.dispose()
      dome.material.dispose()
      starGeometry.dispose()
      starMaterial.dispose()
      for (const item of [moon, christmasStar]) {
        item.material.map?.dispose()
        item.material.dispose()
      }
    },
  }
}
