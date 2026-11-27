import * as THREE from 'three'

/** Eine Farbe oder ein Verlauf von unten nach oben (entlang der lokalen y-Achse der Form). */
export type Paint = THREE.Color | readonly [bottom: THREE.Color, top: THREE.Color]

/** Leuchtverhalten im Glüh-Shader (siehe materials.ts). */
export interface Glow {
  /** Zufällige Phase, damit nicht alles im Takt funkelt. */
  phase: number
  /** Stärke des Funkelns, 0 = ruhiges Licht. */
  twinkle: number
  /** 0 = Deko-Licht (Lichterkette), 1 = Licht aus dem Hausinneren (Fenster). */
  interior: number
  /**
   * Geht erst an, wenn Haus 3 gelöst ist (siehe `STRING_LIGHTS`): `true` = Lämpchen einer
   * Lichterkette (aus: unsichtbar), `'lamp'` = Straßenlaterne (aus: glimmt nur schwach).
   */
  string?: boolean | 'lamp'
}

export interface Rotation {
  x?: number
  y?: number
  z?: number
}

export type Point = readonly [x: number, y: number]

const vertex = new THREE.Vector3()
const normal = new THREE.Vector3()
const normalMatrix = new THREE.Matrix3()
const blended = new THREE.Color()

/**
 * Sammelt viele kleine Formen in einer einzigen Geometrie mit Eckpunktfarben.
 * So braucht ein ganzes Haus nur eine Handvoll Draw-Calls – wichtig auf dem Handy.
 */
export class Batch {
  private readonly positions: number[] = []
  private readonly normals: number[] = []
  private readonly colors: number[] = []
  private readonly uvs: number[] = []
  private readonly glows: number[] = []
  private readonly strings: number[] = []
  private readonly sizes: number[] = []
  private readonly indices: number[] = []
  private vertexCount = 0

  get isEmpty(): boolean {
    return this.vertexCount === 0
  }

  /**
   * `billboard` (Breite, Höhe) macht aus einem Rechteck einen Lichthof, der sich
   * immer zur Kamera dreht: Alle Ecken liegen im Mittelpunkt, der Shader spannt sie auf.
   */
  add(
    geometry: THREE.BufferGeometry,
    matrix: THREE.Matrix4,
    paint: Paint,
    glow?: Glow,
    billboard?: readonly [width: number, height: number],
  ): void {
    const positions = geometry.getAttribute('position')
    const normals = geometry.getAttribute('normal')
    const uvs = geometry.getAttribute('uv')
    const index = geometry.getIndex()
    normalMatrix.getNormalMatrix(matrix)

    let minY = 0
    let spanY = 1
    if (!(paint instanceof THREE.Color)) {
      if (!geometry.boundingBox) geometry.computeBoundingBox()
      const box = geometry.boundingBox!
      minY = box.min.y
      spanY = Math.max(box.max.y - box.min.y, 1e-6)
    }

    for (let i = 0; i < positions.count; i++) {
      vertex.fromBufferAttribute(positions, i)
      const color =
        paint instanceof THREE.Color
          ? paint
          : blended.lerpColors(paint[0], paint[1], (vertex.y - minY) / spanY)
      this.colors.push(color.r, color.g, color.b)

      if (billboard) vertex.setFromMatrixPosition(matrix)
      else vertex.applyMatrix4(matrix)
      this.positions.push(vertex.x, vertex.y, vertex.z)
      normal.fromBufferAttribute(normals, i).applyMatrix3(normalMatrix).normalize()
      this.normals.push(normal.x, normal.y, normal.z)
      this.uvs.push(uvs ? uvs.getX(i) : 0, uvs ? uvs.getY(i) : 0)
      this.glows.push(glow?.phase ?? 0, glow?.twinkle ?? 0, glow?.interior ?? 0)
      this.strings.push(glow?.string === 'lamp' ? 2 : glow?.string ? 1 : 0)
      this.sizes.push(billboard?.[0] ?? 0, billboard?.[1] ?? 0)
    }

    if (index) {
      for (let i = 0; i < index.count; i++) this.indices.push(this.vertexCount + index.getX(i))
    } else {
      for (let i = 0; i < positions.count; i++) this.indices.push(this.vertexCount + i)
    }
    this.vertexCount += positions.count
  }

  /** `lit`: für beleuchtete Oberflächen. `glow`: für selbstleuchtende Flächen und Lichthöfe. */
  build(kind: 'lit' | 'glow'): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3))
    if (kind === 'lit') {
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3))
    } else {
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2))
      geometry.setAttribute('aGlow', new THREE.Float32BufferAttribute(this.glows, 3))
      geometry.setAttribute('aString', new THREE.Float32BufferAttribute(this.strings, 1))
      geometry.setAttribute('aSize', new THREE.Float32BufferAttribute(this.sizes, 2))
    }
    geometry.setIndex(this.indices)
    geometry.computeBoundingSphere()
    return geometry
  }
}

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1)
const UNIT_QUAD = new THREE.PlaneGeometry(1, 1)
const UNIT_SPHERE = new THREE.IcosahedronGeometry(1, 1)
const UNIT_BULB = new THREE.OctahedronGeometry(1, 0)
const UNIT_PYRAMID = (() => {
  const geometry = new THREE.CylinderGeometry(0, Math.SQRT1_2, 1, 4, 1)
    .rotateY(Math.PI / 4)
    .toNonIndexed()
  geometry.computeVertexNormals()
  return geometry
})()

const shapeCache = new Map<string, THREE.BufferGeometry>()

function cached(key: string, create: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let geometry = shapeCache.get(key)
  if (!geometry) {
    geometry = create()
    shapeCache.set(key, geometry)
  }
  return geometry
}

const position = new THREE.Vector3()
const scale = new THREE.Vector3()
const euler = new THREE.Euler()
const quaternion = new THREE.Quaternion()

/** Bequeme Formen (Quader, Zylinder, Dachflächen …) für einen Batch. Alle Maße in Metern. */
export class Builder {
  readonly batch = new Batch()
  private readonly base = new THREE.Matrix4()
  private readonly local = new THREE.Matrix4()

  /** Alles, was `build` hinzufügt, wird zusätzlich mit `transform` verschoben/gedreht. */
  within(transform: THREE.Matrix4, build: () => void): void {
    const saved = this.base.clone()
    this.base.multiply(transform)
    try {
      build()
    } finally {
      this.base.copy(saved)
    }
  }

  private place(
    geometry: THREE.BufferGeometry,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    paint: Paint,
    rotation?: Rotation,
    glow?: Glow,
  ): void {
    euler.set(rotation?.x ?? 0, rotation?.y ?? 0, rotation?.z ?? 0)
    quaternion.setFromEuler(euler)
    this.local.compose(position.set(x, y, z), quaternion, scale.set(sx, sy, sz))
    this.local.premultiply(this.base)
    this.batch.add(geometry, this.local, paint, glow)
  }

  /** Quader um seinen Mittelpunkt. */
  box(
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    paint: Paint,
    rotation?: Rotation,
    glow?: Glow,
  ): void {
    this.place(UNIT_BOX, x, y, z, sx, sy, sz, paint, rotation, glow)
  }

  /** Stehender Zylinder oder Kegelstumpf um seinen Mittelpunkt. */
  cylinder(
    x: number,
    y: number,
    z: number,
    radiusBottom: number,
    radiusTop: number,
    height: number,
    segments: number,
    paint: Paint,
    rotation?: Rotation,
    glow?: Glow,
  ): void {
    const ratio = Math.round((radiusTop / radiusBottom) * 100) / 100
    const geometry = cached(
      `cylinder:${segments}:${ratio}`,
      () => new THREE.CylinderGeometry(ratio, 1, 1, segments, 1),
    )
    this.place(geometry, x, y, z, radiusBottom, height, radiusBottom, paint, rotation, glow)
  }

  /** Kegel mit der Grundfläche bei `yBase`. */
  cone(
    x: number,
    yBase: number,
    z: number,
    radius: number,
    height: number,
    segments: number,
    paint: Paint,
  ): void {
    this.cylinder(x, yBase + height / 2, z, radius, 0, height, segments, paint)
  }

  sphere(x: number, y: number, z: number, rx: number, ry: number, rz: number, paint: Paint): void {
    this.place(UNIT_SPHERE, x, y, z, rx, ry, rz, paint)
  }

  /** Kleines Lämpchen (Oktaeder). */
  bulb(x: number, y: number, z: number, radius: number, paint: Paint, glow?: Glow): void {
    this.place(UNIT_BULB, x, y, z, radius, radius, radius, paint, undefined, glow)
  }

  /** Rechteck, das ohne Drehung nach vorn (+z) zeigt. */
  quad(
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    paint: Paint,
    rotation?: Rotation,
    glow?: Glow,
  ): void {
    this.place(UNIT_QUAD, x, y, z, width, height, 1, paint, rotation, glow)
  }

  /** Lichthof, der sich immer zur Kamera dreht (nur für Lichthof-Batches). */
  billboard(
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    paint: Paint,
    glow?: Glow,
  ): void {
    this.local.makeTranslation(x, y, z).premultiply(this.base)
    this.batch.add(UNIT_QUAD, this.local, paint, glow, [width, height])
  }

  /** Kreisscheibe oder Kreisausschnitt, zeigt ohne Drehung nach vorn (+z). */
  disc(
    x: number,
    y: number,
    z: number,
    radius: number,
    paint: Paint,
    options: {
      segments?: number
      start?: number
      length?: number
      rotation?: Rotation
      glow?: Glow
    } = {},
  ): void {
    const { segments = 16, start = 0, length = Math.PI * 2 } = options
    const geometry = cached(
      `disc:${segments}:${start.toFixed(3)}:${length.toFixed(3)}`,
      () => new THREE.CircleGeometry(1, segments, start, length),
    )
    this.place(geometry, x, y, z, radius, radius, 1, paint, options.rotation, options.glow)
  }

  /** Ring in der x-y-Ebene (z. B. ein Kranz). */
  torus(x: number, y: number, z: number, radius: number, tube: number, paint: Paint): void {
    const ratio = Math.round((tube / radius) * 100) / 100
    const geometry = cached(`torus:${ratio}`, () => new THREE.TorusGeometry(1, ratio, 6, 20))
    this.place(geometry, x, y, z, radius, radius, radius, paint)
  }

  /** Pyramide mit rechteckiger Grundfläche bei `yBase`. */
  pyramid(
    x: number,
    yBase: number,
    z: number,
    width: number,
    height: number,
    depth: number,
    paint: Paint,
  ): void {
    this.place(UNIT_PYRAMID, x, yBase + height / 2, z, width, height, depth, paint)
  }

  /** Konvexes Vieleck in der x-y-Ebene (Punkte gegen den Uhrzeigersinn), zeigt nach +z. */
  polygon(
    points: readonly Point[],
    z: number,
    paint: Paint,
    options: { flip?: boolean; glow?: Glow } = {},
  ): void {
    this.fan(points, null, z, paint, options.flip ?? false, options.glow)
  }

  /** Stern mit `tips` Zacken, zeigt nach +z. */
  star(
    x: number,
    y: number,
    z: number,
    outer: number,
    inner: number,
    tips: number,
    paint: Paint,
    glow?: Glow,
  ): void {
    const ring: Point[] = []
    for (let i = 0; i < tips * 2; i++) {
      const angle = Math.PI / 2 + (i * Math.PI) / tips
      const radius = i % 2 === 0 ? outer : inner
      ring.push([x + Math.cos(angle) * radius, y + Math.sin(angle) * radius])
    }
    this.fan(ring, [x, y], z, paint, false, glow)
  }

  /** Dreiecksfächer um `center` (oder um den ersten Punkt, wenn `center` fehlt). */
  private fan(
    ring: readonly Point[],
    center: Point | null,
    z: number,
    paint: Paint,
    flip: boolean,
    glow?: Glow,
  ): void {
    const points = center ? [center, ...ring, ring[0]] : ring
    const xs = points.map((point) => point[0])
    const ys = points.map((point) => point[1])
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    const spanX = Math.max(Math.max(...xs) - minX, 1e-6)
    const spanY = Math.max(Math.max(...ys) - minY, 1e-6)

    const positions: number[] = []
    const normals: number[] = []
    const uvs: number[] = []
    for (const [px, py] of points) {
      positions.push(px, py, 0)
      normals.push(0, 0, flip ? -1 : 1)
      uvs.push((px - minX) / spanX, (py - minY) / spanY)
    }
    const indices: number[] = []
    for (let i = 1; i < points.length - 1; i++) {
      if (flip) indices.push(0, i + 1, i)
      else indices.push(0, i, i + 1)
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geometry.setIndex(indices)
    this.place(geometry, 0, 0, z, 1, 1, 1, paint, undefined, glow)
    geometry.dispose()
  }

  /**
   * Platte entlang der Strecke `from` → `to` in der x-y-Ebene, zwischen `zFront`
   * und `zBack`. Sie liegt links der Laufrichtung auf der Strecke auf – bei einem
   * Dachprofil von links nach rechts also außen. `lift` hebt sie zusätzlich ab.
   */
  slab(
    from: Point,
    to: Point,
    thickness: number,
    zFront: number,
    zBack: number,
    paint: Paint,
    lift = 0,
  ): void {
    const dx = to[0] - from[0]
    const dy = to[1] - from[1]
    const length = Math.hypot(dx, dy)
    const angle = Math.atan2(dy, dx)
    const offset = lift + thickness / 2
    this.box(
      (from[0] + to[0]) / 2 - Math.sin(angle) * offset,
      (from[1] + to[1]) / 2 + Math.cos(angle) * offset,
      (zFront + zBack) / 2,
      length,
      thickness,
      Math.abs(zFront - zBack),
      paint,
      { z: angle },
    )
  }
}
