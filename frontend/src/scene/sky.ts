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
  /** Der große Stern über dem Ende der Straße – erst da, wenn die Lichter brennen (Haus 3). */
  setChristmasStar(visible: boolean): void
  /** Lässt den Stern mit einem Lichtblitz erscheinen – der krönende Abschluss des Lichter-Auftritts. */
  flashChristmasStar(): void
  /** Wie hell der Sternblitz die Szene gerade erleuchtet (0 = gar nicht, 1 = voller Blitz). */
  flashLight(): number
  /** Mondphase: 0 = Neumond, 0,5 = Vollmond. */
  setMoonPhase(phase: number): void
  /** Steht der Mondstaub-Mann aus Haus 5 auf dem Mond? */
  setMoonSnowman(visible: boolean): void
  /** Der Mond selbst – zum Antippen und Heranzoomen. */
  moon: THREE.Sprite
  dispose(): void
}

/** Strahlenkranz für den Sternblitz: lange, spitze Strahlen ohne runden Schein. */
function createStarburstTexture(): THREE.CanvasTexture {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.translate(size / 2, size / 2)
    const ray = (angle: number, length: number, width: number, alpha: number) => {
      ctx.save()
      ctx.rotate(angle)
      const gradient = ctx.createLinearGradient(0, 0, length, 0)
      gradient.addColorStop(0, `rgba(255, 250, 230, ${alpha})`)
      gradient.addColorStop(1, 'rgba(255, 230, 170, 0)')
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.moveTo(0, -width)
      ctx.quadraticCurveTo(length * 0.3, -width * 0.3, length, 0)
      ctx.quadraticCurveTo(length * 0.3, width * 0.3, 0, width)
      ctx.fill()
      ctx.restore()
    }
    // Vier lange Hauptstrahlen, vier kürzere dazwischen, dazu feine Nebenstrahlen
    for (let i = 0; i < 4; i++) ray((i * Math.PI) / 2, size / 2, 9, 1)
    for (let i = 0; i < 4; i++) ray((i * Math.PI) / 2 + Math.PI / 4, size * 0.3, 6, 0.85)
    for (let i = 0; i < 8; i++) ray((i * Math.PI) / 4 + Math.PI / 8, size * 0.17, 3, 0.6)
    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, 22)
    core.addColorStop(0, 'rgba(255, 255, 245, 1)')
    core.addColorStop(1, 'rgba(255, 245, 210, 0)')
    ctx.fillStyle = core
    ctx.fillRect(-22, -22, 44, 44)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
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
  const sparkle = createSparkleTexture()
  const christmasStar = sprite(sparkle, new THREE.Vector3(1, 0.3, -0.1), 46)
  // Der Lichtblitz beim Erscheinen: ein Strahlenkranz in Sternform, der aufblitzt und sich dreht.
  const starburst = createStarburstTexture()
  const burst = sprite(starburst, new THREE.Vector3(1, 0.3, -0.1), 1)
  burst.material = new THREE.SpriteMaterial({
    map: starburst, color: '#fff1c8', transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
  })
  burst.renderOrder = -7
  burst.visible = false
  let starVisible = true
  /** Sekunden seit dem Blitz, solange er läuft. */
  let flash: number | null = null
  let lastSeconds = 0

  const group = new THREE.Group()
  group.add(dome, stars, moon, christmasStar, burst)
  for (const object of group.children) object.frustumCulled = false

  return {
    group,
    moon,
    follow(camera, seconds) {
      group.position.copy(camera.position)
      const dt = Math.min(0.1, Math.max(0, seconds - lastSeconds))
      lastSeconds = seconds
      const pulse = 1 + 0.07 * Math.sin(seconds * 1.3)
      christmasStar.visible = starVisible
      if (flash === null) {
        christmasStar.scale.setScalar(46 * pulse)
        christmasStar.material.rotation = 0
        return
      }
      flash += dt
      const t = flash
      // Stern: schießt in 0,3 s groß auf, federt dann auf seine Größe zurück und dreht sich dabei ein.
      const pop = t < 0.3 ? 1 - (1 - t / 0.3) ** 3 : 1
      const settle = t < 0.3 ? 0 : Math.min(1, (t - 0.3) / 1.4)
      const overshoot = 2 - 1 * (1 - (1 - settle) ** 3) + Math.sin(settle * Math.PI * 3) * 0.12 * (1 - settle)
      christmasStar.scale.setScalar(46 * pulse * pop * overshoot)
      christmasStar.material.rotation = (1 - Math.min(1, t / 1.6)) ** 2 * 0.9
      // Blitz: blüht in 0,25 s riesig auf und verglüht in gut einer Sekunde.
      const bloom = Math.min(1, t / 0.25)
      burst.visible = t < 1.5
      burst.scale.setScalar(40 + 200 * (1 - (1 - bloom) ** 2) + t * 40)
      burst.material.rotation = -0.5 + t * 0.6
      burst.material.opacity = t < 0.25 ? bloom : Math.max(0, 1 - (t - 0.25) / 1.25) ** 1.5
      if (t > 1.9) {
        flash = null
        burst.visible = false
      }
    },
    setChristmasStar(visible) {
      starVisible = visible
      if (!visible) {
        flash = null
        burst.visible = false
      }
    },
    flashChristmasStar() {
      starVisible = true
      flash = 0
    },
    flashLight() {
      if (flash === null) return 0
      // Schlagartig hell, dann in gut einer Sekunde wieder abklingen.
      return flash < 0.12 ? flash / 0.12 : Math.max(0, 1 - (flash - 0.12) / 1.3) ** 2
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
      burst.material.dispose()
      starburst.dispose()
    },
  }
}
