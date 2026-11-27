import * as THREE from 'three'
import { GATE_DAY, SKI_HOUSE_DAY, TREE_PLACE } from '../lib/places.ts'
import { Builder } from './batch.ts'
import {
  approachThroughGap,
  computePose,
  createPose,
  endTurn,
  gateStopX,
  maxPanX,
  treeStopX,
  visibleWidth,
} from './cameraRig.ts'
import type { Entrance, StreetEnd } from './cameraRig.ts'
import { createCakeConveyor } from './cakeConveyor.ts'
import { buildBalconyCat } from './cat.ts'
import type { CakeConveyor } from './cakeConveyor.ts'
import { buildEaselFrame, createPicture, loadSvgTexture } from './easel.ts'
import { buildPeekingElf } from './elf.ts'
import { createChimneyFlames, createFireplaceWindow } from './fireplace.ts'
import type { ChimneyFlames, Fireplace } from './fireplace.ts'
import { buildGingerbreadHouse, GINGER_SCALE } from './gingerbreadHouse.ts'
import type { GingerbreadDesign } from './gingerbreadHouse.ts'
import { buildGableReindeer } from './reindeer.ts'
import { createMeadowHerd } from './meadowReindeer.ts'
import type { MeadowHerd } from './meadowReindeer.ts'
import { buildLightChain } from './lightChain.ts'
import { createGluehweinStand, GLUEHWEIN_STAND_Z, standOffset } from './gluehweinStand.ts'
import { buildEntrancePresents } from './presentStacks.ts'
import { HoopShot } from './hoopShot.ts'
import { createSantaWindows } from './santaWindows.ts'
import { createFrostedWindows } from './frostedWindows.ts'
import type { FrostedWindows } from './frostedWindows.ts'
import type { SantaWindows } from './santaWindows.ts'
import { buildHoop, GARAGE_PLAQUE } from './garage.ts'
import { buildSleighWithSanta } from './sleigh.ts'
import { buildSquirrel } from './squirrel.ts'
import { createEnvironment, streetLanternXs } from './environment.ts'
import type { Environment } from './environment.ts'
import { GATE_FOCUS, GATE_HEIGHT, GATE_WIDTH, buildGate } from './gate.ts'
import { buildHouse } from './houseBuilder.ts'
import type { HouseAnchors, ShowcaseWindow } from './houseBuilder.ts'
import {
  DOOR_HEIGHT,
  DOOR_WIDTH,
  GARAGE_AFTER_DAY,
  GROUND_FLOOR,
  STREET_SEED,
  UPPER_FLOOR,
  columnX,
  createStreetLayout,
  ridgeHeight,
} from './houseSpec.ts'
import type { Plot, StreetLayout } from './houseSpec.ts'
import { attachGestures } from './input.ts'
import { createGlowMaterial, createSolidMaterial, STRING_LIGHTS, STRINGS_OFF, STRINGS_ON } from './materials.ts'
import type { TimeUniform } from './materials.ts'
import { SKY, col } from './palette.ts'
import { createSmoke, createSnowfall } from './particles.ts'
import type { Smoke, Snowfall } from './particles.ts'
import { PHOTO_RADIUS, haloOf } from './props.ts'
import { createSkiHalfpipe } from './skiHalfpipe.ts'
import { createSky } from './sky.ts'
import type { Sky } from './sky.ts'
import {
  createDoorLightTexture,
  createNumberAtlas,
  createSparkleTexture,
  loadPhotoTexture,
} from './textures.ts'
import type { NumberAtlas } from './textures.ts'
import { ROAD_CENTER_Z, TREE_HEIGHT, TREE_Z } from './world.ts'

export interface HouseState {
  /** Bewohnt: Die Fenster leuchten, die Lichterketten funkeln, der Schornstein raucht. */
  awake: boolean
  /** Mit dem QR-Schlüssel aufgeschlossen: Die Tür bleibt offen und der Eingang leuchtet. */
  opened: boolean
  /** Ein Stern schwebt über dem Haus: Hier gibt es heute etwas zu entdecken. */
  marked: boolean
}

/** −1 = Blick zurück zum Anfang der Straße, 0 = geradeaus, 1 = Blick die Straße entlang zum Baum. */
export type LookDirection = -1 | 0 | 1

export interface StreetSceneOptions {
  canvas: HTMLCanvasElement
  /** Ein Haus (1–23) oder das Tor (24) wurde angetippt. */
  onHouseTap(day: number): void
  /** Tippen oder Wischen neben das gerade angeflogene Ziel. */
  onBackgroundTap(): void
  /** Wo die Kamera gerade steht: vor einem Tag (1–24) oder – als `TREE_PLACE` – vor dem Weihnachtsbaum. */
  onPlaceChange(place: number): void
  onLookChange(direction: LookDirection): void
  onInteract(): void
  /** Ein Eichhörnchen auf der Straße wurde mit einem Schneeball getroffen. */
  onSquirrelHit?(): void
  /** Die Kamera zoomt auf ein Objekt (mit dessen Namen) – oder wieder zurück (null). */
  onInspectChange?(label: string | null): void
}

/** So weit hebt sich die Kamera für den Blick auf den Mond – über alle Dächer hinweg. */
const MOON_LIFT = new THREE.Vector3(0, 14, 3)
/** Easter Egg nach Santa Bibber: So lange braucht der Schlitten quer übers Bild – und so lange wartet er, bis man sich umgedreht hat. */
const FLYBY_SECONDS = 4.6
const FLYBY_DELAY = 0.7
/** Flugbahn: so weit hinter dem Baum und so hoch über seiner Spitze. */
const FLYBY_BEHIND_TREE = 4
const FLYBY_ABOVE_TREE = 3.5
const CAMERA_NEAR = 0.8
const GAP_NEAR = 0.25

/** Ein Objekt auf der Straße, das man antippen und aus der Nähe ansehen kann. */
/** Aus dieser Höhe fallen die Geschenke von Haus 23 – und so schnell. */
const PRESENT_DROP_HEIGHT = 14
const PRESENT_GRAVITY = 24

interface Inspectable {
  id: string
  label: string
  object: THREE.Object3D
  /** Liegt es hinter einem Haus? Dann zählt der Tipp nur, wenn kein Haus davor ist. */
  hidden?: boolean
  /** Fährt durch die Lücke, sobald die Kamera an der Laterne vorbei ist. */
  throughGap?: boolean
  /** Wohin die Kamera fliegt (Weltkoordinaten) – jedes Bild neu, denn manches bewegt sich. */
  view(out: { position: THREE.Vector3; target: THREE.Vector3; fov: number }): void
}

/** Eichhörnchen auf der Straße: kleiner als im Spiel, etwa einen Meter hoch. */
const CRITTER_SCALE = 0.75
/** Die Wiese gegenüber: im Park hinter dem Zaun (z = 12,5) – die Rentiere laufen nicht auf den Gehweg. */
const MEADOW_NEAR_Z = 13.5
const MEADOW_FAR_Z = 16.5
/**
 * Lichterketten-Auftritt: Wartezeit, bis der Blick beim Baum ist, und Takt von Haus zu Haus –
 * er beginnt mit `REVEAL_STEP` Sekunden und wird mit jedem Haus um `REVEAL_SPEEDUP` schneller.
 */
const REVEAL_DELAY = 1.3
/** Farbe des Sternblitzes, der kurz die Straße erhellt. */
const FLASH_COLOR = new THREE.Color('#ffe6b0')
const REVEAL_STEP = 0.32
const REVEAL_SPEEDUP = 1.1
/** Nach dem letzten Licht (und dem Sternblitz) noch so lange staunen, bevor der Blick zurückgeht. */
const REVEAL_LINGER = 2.6

type CritterState = 'waiting' | 'rising' | 'up' | 'ducking' | 'hit'

type Ease = (t: number) => number
const easeInOut: Ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const easeIn: Ease = (t) => t * t
const easeOutBack: Ease = (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2

/** Eine Zahl, die sich über die Zeit auf einen Zielwert zubewegt. */
class Animated {
  value: number
  private from = 0
  private to = 0
  private elapsed = 0
  private duration = 0
  private ease = easeInOut
  private finish: (() => void) | null = null

  constructor(value: number) {
    this.value = value
  }

  get moving(): boolean {
    return this.duration > 0
  }

  set(value: number): void {
    this.value = value
    this.stop()
  }

  /** Das Versprechen erfüllt sich am Ziel – oder sobald die Bewegung abgelöst wird. */
  animate(to: number, duration: number, ease: Ease = easeInOut, delay = 0): Promise<void> {
    this.stop()
    this.from = this.value
    this.to = to
    this.elapsed = -delay
    this.duration = Math.max(duration, 1e-3)
    this.ease = ease
    return new Promise((resolve) => {
      this.finish = resolve
    })
  }

  update(dt: number): void {
    if (this.duration <= 0) return
    this.elapsed += dt
    const t = Math.min(Math.max(this.elapsed / this.duration, 0), 1)
    this.value = this.from + (this.to - this.from) * this.ease(t)
    if (t >= 1) this.stop()
  }

  private stop(): void {
    this.duration = 0
    const finish = this.finish
    this.finish = null
    finish?.()
  }
}

type PhotoMesh = THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>

interface Door {
  pivot: THREE.Group
  /** Drehung um das Scharnier, wenn die Tür ganz offen steht. */
  swing: number
  /** Warmer Lichtschein auf der Innenseite – wird heller, je weiter die Tür aufsteht. */
  shine?: THREE.MeshBasicMaterial
}

interface DoorLight {
  group: THREE.Group
  portal: THREE.Mesh
  flare: THREE.ShaderMaterial
}

/** Ein Ziel auf der Straße: eines der 23 Häuser – oder das Tor am 24. */
interface Stop {
  day: number
  group: THREE.Group
  /** Haustür bzw. die beiden Torflügel. */
  doors: Door[]
  entrance: Entrance
  /** Standort der Kamera auf der Straße vor diesem Ziel. */
  panX(): number
  /** Alle leuchtenden Materialien – sie teilen sich den Wert „wach“. */
  materials: THREE.ShaderMaterial[]
  /** Die vier Adventskerzen (links nach rechts) – wie viele brennen, hängt vom Datum ab. */
  candles: THREE.Group[] | null
  bounds: THREE.Box3
  /** Wo der Stern für „heute“ schwebt. */
  marker: THREE.Vector3
  /**
   * Wo das Selfie hängt (im Koordinatensystem der Gruppe): bei Häusern mitten im
   * hell erleuchteten Türrahmen, beim Tor im Kranz am linken Pfeiler.
   */
  photoAnchor: { x: number; y: number; z: number }
  /** Mitte des Kranzes oben an der Fassade (im Koordinatensystem der Gruppe) – dort hängt das Giebel-Rentier. */
  wreathAnchor: { x: number; y: number; z: number }
  /** Größe des Selfies relativ zu `PHOTO_RADIUS` – in der Tür etwas kleiner als im Kranz. */
  photoScale: number
  /** Hausnummernschilder (im Koordinatensystem der Gruppe). */
  plaques: { x: number; y: number; z: number; radius: number }[]
  /** Schornsteinöffnung, falls vorhanden. */
  smokeOrigin: THREE.Vector3 | null
  /** Hinter einer Haustür leuchtet es hell; durch das Gittertor sieht man hindurch. */
  opaqueDoor: boolean
  opened: boolean
  heldDoor: Animated
  entranceLight: DoorLight | null
  power: Animated
  powerTarget: number
  appliedPower: number
  chimney: number | null
  photo: PhotoMesh | null
  photoUrl: string | null
  photoPop: Animated
}

const MAX_PIXEL_RATIO = 2
/** Negativ dreht das Türblatt vom linken Scharnier nach vorn (+z) aus der Fassade heraus. */
const DOOR_SWING = -1.9
const FLAT = { x: -Math.PI / 2 }

/**
 * Die Weihnachtsstraße als 3D-Szene: baut Häuser, Tor und Umgebung, bewegt die
 * Kamera und meldet Berührungen. Sie weiß nichts von Kalender, Schlüsseln oder
 * React – das steuert die Oberfläche über die öffentlichen Methoden.
 */
export class StreetScene {
  readonly layout: StreetLayout = createStreetLayout(STREET_SEED)
  /** Wo Laternen vor den Häuserlücken stehen – an ihnen fährt der Blick durch die Lücke vorbei. */
  private readonly lanternXs = streetLanternXs(this.layout)

  private readonly options: StreetSceneOptions
  private readonly canvas: HTMLCanvasElement
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(38, 1, CAMERA_NEAR, 700)
  private readonly time: TimeUniform = { value: 0 }
  private readonly solidMaterial = createSolidMaterial()
  private readonly photoGeometry = new THREE.CircleGeometry(PHOTO_RADIUS, 40)
  private readonly streetEnd: StreetEnd = {
    lastHouseX: this.layout.plots[this.layout.plots.length - 1].x,
    gateX: this.layout.gateX,
    treeX: this.layout.treeX,
  }

  /** Die Häuser 1–23 und als letztes das Tor. */
  private readonly stops: Stop[]
  private readonly gate: Stop
  private readonly environment: Environment
  private readonly sky: Sky
  /** Himmels- und Mondlicht – beim Sternblitz kurz heller und wärmer. */
  private readonly skyLight = new THREE.HemisphereLight('#b9c6ff', '#f6dccb', 2.4)
  private readonly moonlight = new THREE.DirectionalLight('#dfe5ff', 1.5)
  private readonly snowfall: Snowfall
  private readonly smoke: Smoke
  private readonly atlas: NumberAtlas
  private readonly marker: THREE.Sprite
  private readonly doorLight: THREE.Group
  private readonly doorPortal: THREE.Mesh
  private readonly doorFlare: THREE.ShaderMaterial
  private readonly disposables: { dispose(): void }[] = []
  private readonly cleanups: (() => void)[] = []

  private width = 1
  private height = 1
  private pixelRatio = 1
  private lastFrame = 0
  private running = false
  private disposed = false
  private slowFrames = { time: 0, count: 0, warmup: 60 }

  // Kamera
  private panX = 0
  private velocity = 0
  private readonly panTween = new Animated(0)
  private readonly turn = new Animated(0)
  private readonly focus = new Animated(0)
  private readonly enter = new Animated(0)
  private readonly doorOpen = new Animated(0)
  /** Gemeinsame Form des Lichtscheins auf den Türinnenseiten. */
  private doorShineGeometry: THREE.BufferGeometry | null = null
  private focusDay: number | null = null
  /** Der Eingang, auf den die Kamera gerade zielt – er gleitet seinem Ziel hinterher. */
  private readonly entrance: Entrance = {
    center: new THREE.Vector3(),
    normal: new THREE.Vector3(0, 0, 1),
    width: 3.6,
    height: 5.8,
  }
  private entranceTarget: Entrance = this.entrance
  private escapeDrag = 0
  private readonly pose = createPose()

  private statesApplied = false
  private markedStop: Stop | null = null
  private enteringStop: Stop | null = null
  private place: number | undefined = undefined
  /** Steht das Tor offen, ist der Weg zum Weihnachtsbaum frei. */
  private gateOpen = false
  private gateKnown = false
  private readonly gateSwing = new Animated(0)
  /** Easter Egg: der Wichtel, der hinter einem gelösten Haus hervorlugt. */
  private elf: { mesh: THREE.Mesh; cornerX: number; day: number } | null = null
  private readonly elfShow = new Animated(0)
  /** Heranzoomen an ein Easter Egg: 0 = normale Straßenansicht, 1 = ganz nah dran. */
  private readonly inspectBlend = new Animated(0)
  /** Das Objekt, auf das (noch) gezoomt wird – bleibt beim Zurückfliegen bis zum Ende stehen. */
  private inspecting: Inspectable | null = null
  /** true, solange man herangezoomt ist; beim Zurückfliegen schon false. */
  private inspectOpen = false
  private readonly inspectView = { position: new THREE.Vector3(), target: new THREE.Vector3(), fov: 38 }
  private moonSnowman = false
  /** Easter Egg: das Rentier im Giebel. */
  private reindeer: { group: THREE.Group; day: number } | null = null
  private readonly reindeerShow = new Animated(0)
  /** Easter Egg: Kuchen auf dem Förderband hinter den Schaufenstern. */
  private conveyor: { conveyor: CakeConveyor; stop: Stop } | null = null
  private readonly showcases = new Map<number, ShowcaseWindow[]>()
  /** Kaminfenster (oben rechts) je Haus. */
  private readonly hearths = new Map<number, ShowcaseWindow>()
  /** Balkone (Mitte der Bodenplatte) je Haus. */
  private readonly balconies = new Map<number, THREE.Vector3>()
  /** Easter Egg nach „Durch den Schornstein“: die Katze auf dem Balkon von Haus 12. */
  private balconyCat: { root: THREE.Group; group: THREE.Group; tail: THREE.Mesh; day: number } | null = null
  private presentStacks: { day: number; side: -1 | 1; mesh: THREE.Mesh }[] | null = null
  private presentStacksOn = false
  /** Geschenke fallen vom Himmel: t < 0 heißt, es geht los, sobald man wieder auf der Straße steht. */
  private presentDrop: { t: number; delays: number[] } | null = null
  private readonly doors = new Map<number, number>()
  /** Vordere Dachkante je Haus – für die Lichterkette. */
  private readonly eaves = new Map<number, HouseAnchors['eaves']>()
  /** Nach dem Lichterketten-Schlamassel: die bunte Kette an der Dachkante. */
  private lightChain: { group: THREE.Group; day: number } | null = null
  /** Wo vor jedem Haus ein Glühweinstand neben der Tür Platz hätte (x relativ zur Hausmitte). */
  private readonly standSpots = new Map<number, number>()
  /** Nach dem Glühwein-Fieber: der Glühweinstand auf dem Gehweg vor Haus 13 – ein Wichtel schenkt dort aus. */
  private gluehweinStand: { group: THREE.Group; update(time: number): void; day: number } | null = null
  /** Nach dem Weihnachtskugelball: Korb antippen wirft eine Kugel durch – die Scherben bleiben liegen. */
  private hoopShot: HoopShot | null = null
  /** Großer Auftritt der Lichterketten nach Haus 3: t < 0 = wartet auf die Rückkehr zur Straße. */
  private lightsReveal: { t: number; steps: number[]; times: number[]; starred?: boolean } | null = null
  /** Der Basketballkorb über der Garage – erst ab Tag 14 angeschraubt. */
  private garageHoop: THREE.Group | null = null
  /** Nach dem Plätzchen-Hüpfer: kleiner Santa, der hinter den oberen Fenstern von Haus 15 hüpft. */
  private santaWindows: { windows: SantaWindows; day: number } | null = null
  /** Fenster je Haus – für die vereisten Scheiben von Haus 9. */
  private readonly facadeWindows = new Map<number, HouseAnchors['windows']>()
  /** Vor „Eingeschneit!“: Eisblumen und Schnee auf den Fenstern von Haus 9. */
  private frosted: { windows: FrostedWindows; day: number } | null = null
  /** Nach dem Holzhacken: Wichtel am Kamin und Flammen aus dem Schornstein. */
  private fireplace: { window: Fireplace; flames: ChimneyFlames | null; day: number } | null = null
  /** Das selbst verzierte Lebkuchenhaus im Fenster von Haus 7. */
  private gingerbread: { mesh: THREE.Mesh; key: string } | null = null
  private skiHalfpipe: ReturnType<typeof createSkiHalfpipe> | null = null
  /** Easter Egg aus Haus 11: Der Weihnachtsmann fliegt beim Blick zum Baum darüber hinweg. */
  private flyby: { group: THREE.Group; t: number; active: boolean } | null = null
  private flybyEnabled = false
  /** Easter Egg aus Haus 16: Rudolph und seine Freunde auf der Wiese gegenüber. */
  private meadowHerd: MeadowHerd | null = null
  /** Easter Egg nach Haus 6: Eichhörnchen tauchen auf der Straße auf und lassen sich abwerfen. */
  private critter: {
    group: THREE.Group
    squirrel: THREE.Mesh
    pile: THREE.Mesh
    state: CritterState
    t: number
    stay: number
    wait: number
  } | null = null
  private critterBall: { mesh: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3; t: number } | null = null
  /** Staffelei mit dem selbst ausgemalten Bild vor einem Haus. */
  private easel: { group: THREE.Group; picture: THREE.MeshBasicMaterial; day: number; svg: string | null } | null = null

  private readonly raycaster = new THREE.Raycaster()
  private readonly pointer = new THREE.Vector2()
  private readonly hit = new THREE.Vector3()

  constructor(options: StreetSceneOptions) {
    this.options = options
    this.canvas = options.canvas
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    })
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO)
    this.renderer.setPixelRatio(this.pixelRatio)

    this.scene.background = new THREE.Color(SKY.horizon)
    this.scene.fog = new THREE.FogExp2(SKY.horizon, 0.0085)
    this.scene.add(this.skyLight)
    const moonlight = this.moonlight
    moonlight.position.set(-0.4, 0.8, 0.9)
    this.scene.add(moonlight)

    this.gate = this.createGate()
    this.stops = [...this.layout.plots.map((plot) => this.createHouse(plot)), this.gate]
    this.environment = createEnvironment(this.layout, this.solidMaterial, this.time, STREET_SEED)
    this.sky = createSky(this.time)
    this.snowfall = createSnowfall(this.time)
    this.smoke = this.createSmoke()
    this.atlas = createNumberAtlas()
    this.marker = this.createMarker()
    const doorLight = this.createDoorLight()
    this.doorLight = doorLight.group
    this.doorPortal = doorLight.portal
    this.doorFlare = doorLight.flare

    this.scene.add(
      this.environment.group,
      this.sky.group,
      this.snowfall.points,
      this.smoke.points,
      this.createPlaques(),
      this.marker,
      this.doorLight,
    )
    this.disposables.push(this.environment, this.sky, this.snowfall, this.smoke)

    this.panX = this.layout.plots[0].x
    this.attachInput()
    this.resize()
    const observer = new ResizeObserver(() => this.resize())
    observer.observe(this.canvas)
    this.cleanups.push(() => observer.disconnect())

    // Hausnummern und Straßenschild neu malen, sobald die Schrift da ist.
    void document.fonts
      ?.load('700 100px "Fredoka Variable"')
      .then(() => {
        if (this.disposed) return
        this.atlas.repaint()
        this.environment.repaintText()
      })
      .catch(() => undefined)

    this.setPaused(false)
  }

  // ------------------------------------------------------------- Aufbau

  /** Was Häuser und Tor als Ziel gemeinsam haben – noch ohne Licht und Selfie. */
  private blankStop() {
    return {
      opened: false,
      heldDoor: new Animated(0),
      entranceLight: null,
      power: new Animated(0),
      powerTarget: 0,
      appliedPower: -1,
      chimney: null,
      photo: null,
      photoUrl: null,
      photoPop: new Animated(1),
      candles: null,
    }
  }

  private createHouse(plot: Plot): Stop {
    const { spec } = plot
    const geometry = buildHouse(spec)
    const { anchors } = geometry
    const group = new THREE.Group()
    group.position.x = plot.x

    const glow = createGlowMaterial(this.time)
    glow.side = THREE.DoubleSide
    const halo = createGlowMaterial(this.time, { halo: true })
    const materials = [glow, halo]
    group.add(
      new THREE.Mesh(geometry.solid, this.solidMaterial),
      new THREE.Mesh(geometry.glow, glow),
      new THREE.Mesh(geometry.halo, halo),
    )

    const doorPivot = new THREE.Group()
    doorPivot.position.copy(anchors.hinge)
    doorPivot.add(new THREE.Mesh(geometry.door, this.solidMaterial))
    const doorShine = this.createDoorShine()
    doorPivot.add(doorShine.mesh)
    if (geometry.doorGlow) {
      const doorGlow = createGlowMaterial(this.time)
      materials.push(doorGlow)
      doorPivot.add(new THREE.Mesh(geometry.doorGlow, doorGlow))
    }
    group.add(doorPivot)
    this.scene.add(group)

    if (anchors.showcase.length) this.showcases.set(spec.day, anchors.showcase)
    if (anchors.hearth) this.hearths.set(spec.day, anchors.hearth)
    if (anchors.balcony) this.balconies.set(spec.day, anchors.balcony)
    this.eaves.set(spec.day, anchors.eaves)
    this.facadeWindows.set(spec.day, anchors.windows)
    this.standSpots.set(spec.day, standOffset(anchors.doorX, spec.width))
    this.doors.set(spec.day, anchors.doorX)
    let candles: Stop['candles'] = null
    if (geometry.candles) {
      // Kerzen brennen immer hell – auch an Häusern, deren Tag noch nicht gekommen ist.
      const flame = createGlowMaterial(this.time)
      flame.side = THREE.DoubleSide
      const flameHalo = createGlowMaterial(this.time, { halo: true })
      this.disposables.push(flame, flameHalo)
      candles = geometry.candles.map((candle) => {
        const candleGroup = new THREE.Group()
        candleGroup.add(new THREE.Mesh(candle.glow, flame), new THREE.Mesh(candle.halo, flameHalo))
        candleGroup.visible = false
        group.add(candleGroup)
        this.disposables.push(candle.glow, candle.halo)
        return candleGroup
      })
    }
    const half = spec.width / 2
    return {
      ...this.blankStop(),
      candles,
      day: spec.day,
      group,
      doors: [{ pivot: doorPivot, swing: DOOR_SWING, shine: doorShine.material }],
      entrance: {
        center: new THREE.Vector3(plot.x + anchors.doorX, 0, 0),
        normal: new THREE.Vector3(0, 0, 1),
        width: 3.6,
        height: 5.8,
      },
      panX: () => plot.x,
      materials,
      bounds: new THREE.Box3(
        new THREE.Vector3(plot.x - half, 0, -spec.depth),
        new THREE.Vector3(plot.x + half, ridgeHeight(spec) + 0.6, 0.7),
      ),
      marker: new THREE.Vector3(plot.x, anchors.height + 1.2, 0.3),
      // Das Selfie steht im Licht der geöffneten Tür – knapp vor dem Lichtschein (z = 0.5),
      // der es sonst überstrahlen würde.
      photoAnchor: { x: anchors.doorX, y: DOOR_HEIGHT * 0.55, z: 0.6 },
      photoScale: 0.72,
      wreathAnchor: anchors.photo,
      // Haus 14 trägt seine Nummer auch an der Garage nebenan.
      plaques: spec.day === GARAGE_AFTER_DAY
        ? [anchors.plaque, { ...GARAGE_PLAQUE, x: this.layout.garage.x - plot.x + GARAGE_PLAQUE.x }]
        : [anchors.plaque],
      smokeOrigin: anchors.smoke ? anchors.smoke.clone().add(group.position) : null,
      opaqueDoor: true,
    }
  }

  /** Das Tor steht quer über der Straße; seine Vorderseite zeigt die Straße hinunter zu den Häusern. */
  private createGate(): Stop {
    const { gateX } = this.layout
    const geometry = buildGate(STREET_SEED)
    const group = new THREE.Group()
    group.position.set(gateX, 0, ROAD_CENTER_Z)
    group.rotation.y = -Math.PI / 2

    // Das Tor soll schon vom Anfang der Straße zu sehen sein: Seine Lichter dringen durch
    // den Dunst und brennen auch an den Tagen vor dem 24. fast in voller Stärke.
    const glow = createGlowMaterial(this.time, { fogAmount: 0.35, dim: 0.8 })
    glow.side = THREE.DoubleSide
    const halo = createGlowMaterial(this.time, { halo: true, fogAmount: 0.4, dim: 0.8 })
    group.add(
      new THREE.Mesh(geometry.solid, this.solidMaterial),
      new THREE.Mesh(geometry.glow, glow),
      new THREE.Mesh(geometry.halo, halo),
    )
    const doors = geometry.wings.map((wing) => {
      const pivot = new THREE.Group()
      pivot.position.copy(wing.hinge)
      pivot.add(new THREE.Mesh(wing.geometry, this.solidMaterial))
      group.add(pivot)
      return { pivot, swing: wing.swing }
    })
    this.scene.add(group)

    const half = GATE_WIDTH / 2 + 0.2
    return {
      ...this.blankStop(),
      day: GATE_DAY,
      group,
      doors,
      entrance: {
        center: new THREE.Vector3(gateX, 0, ROAD_CENTER_Z),
        normal: new THREE.Vector3(-1, 0, 0),
        ...GATE_FOCUS,
        through: true,
      },
      panX: () => gateStopX(this.camera.aspect, this.streetEnd),
      materials: [glow, halo],
      bounds: new THREE.Box3(
        new THREE.Vector3(gateX - 0.7, 0, ROAD_CENTER_Z - half),
        new THREE.Vector3(gateX + 0.7, GATE_HEIGHT, ROAD_CENTER_Z + half),
      ),
      marker: new THREE.Vector3(gateX, GATE_HEIGHT + 1.2, ROAD_CENTER_Z),
      photoAnchor: geometry.photo,
      photoScale: 1,
      wreathAnchor: geometry.photo,
      plaques: geometry.plaques,
      smokeOrigin: null,
      opaqueDoor: false,
    }
  }

  private createSmoke(): Smoke {
    const origins: THREE.Vector3[] = []
    for (const stop of this.stops) {
      if (!stop.smokeOrigin) continue
      stop.chimney = origins.length
      origins.push(stop.smokeOrigin)
    }
    return createSmoke(origins, this.time)
  }

  /** Alle Hausnummern in einem einzigen Netz – das Tor trägt seine 24 auf beiden Pfeilern. */
  private createPlaques(): THREE.Mesh {
    const positions: number[] = []
    const uvs: number[] = []
    const indices: number[] = []
    const corner = new THREE.Vector3()
    let count = 0
    for (const stop of this.stops) {
      stop.group.updateMatrixWorld(true)
      const [u0, v0, u1, v1] = this.atlas.cell(stop.day)
      for (const { x, y, z, radius } of stop.plaques) {
        for (const [dx, dy] of [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ]) {
          corner.set(x + dx * radius, y + dy * radius, z).applyMatrix4(stop.group.matrixWorld)
          positions.push(corner.x, corner.y, corner.z)
        }
        uvs.push(u0, v0, u1, v0, u1, v1, u0, v1)
        const first = count * 4
        indices.push(first, first + 1, first + 2, first, first + 2, first + 3)
        count += 1
      }
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geometry.setIndex(indices)
    const material = new THREE.MeshBasicMaterial({
      map: this.atlas.texture,
      alphaTest: 0.5,
      color: '#efe9f3',
    })
    this.disposables.push(geometry, material, this.atlas.texture)
    const plaques = new THREE.Mesh(geometry, material)
    plaques.frustumCulled = false
    return plaques
  }

  private createMarker(): THREE.Sprite {
    const texture = createSparkleTexture()
    const material = new THREE.SpriteMaterial({
      map: texture,
      color: '#ffe7a3',
      depthWrite: false,
      fog: false,
    })
    this.disposables.push(texture, material)
    const marker = new THREE.Sprite(material)
    marker.visible = false
    marker.renderOrder = 6
    return marker
  }

  /** Das Licht hinter der Tür: eine helle Fläche plus Lichthof, der beim Öffnen anschwillt. */
  /**
   * Lichtschein auf der Innenseite der Haustür (Koordinaten des Scharniers): am Scharnier, direkt
   * neben dem hellen Flur, am stärksten, zur Außenkante hin weich auslaufend. Additiv, damit er
   * die Türfarbe nur aufhellt – so gibt es keinen harten Sprung vom Licht zur dunklen Tür.
   */
  private createDoorShine(): { mesh: THREE.Mesh; material: THREE.MeshBasicMaterial } {
    if (!this.doorShineGeometry) {
      const b = new Builder()
      const strips = 12
      const warm = col('#ffcf86')
      for (let i = 0; i < strips; i++) {
        const k = 1 - (i + 0.5) / strips
        const strength = 0.12 + 0.88 * k ** 1.6
        const bottom = warm.clone().multiplyScalar(strength * 0.75)
        const top = warm.clone().multiplyScalar(strength)
        // Rückseite der Tür (z < 0), nach hinten zeigend
        b.quad(((i + 0.5) / strips) * DOOR_WIDTH, DOOR_HEIGHT / 2, -0.034, DOOR_WIDTH / strips + 0.002, DOOR_HEIGHT, [bottom, top], { y: Math.PI })
      }
      this.doorShineGeometry = b.batch.build('glow')
      this.disposables.push(this.doorShineGeometry)
    }
    const material = new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    })
    this.disposables.push(material)
    return { mesh: new THREE.Mesh(this.doorShineGeometry, material), material }
  }

  private createDoorLight(): DoorLight {
    const texture = createDoorLightTexture()
    const portalGeometry = new THREE.PlaneGeometry(DOOR_WIDTH, DOOR_HEIGHT)
    const portalMaterial = new THREE.MeshBasicMaterial({ map: texture, fog: false })
    const portal = new THREE.Mesh(portalGeometry, portalMaterial)
    portal.position.set(0, DOOR_HEIGHT / 2, 0.02)

    const builder = new Builder()
    const inside = { phase: 0, twinkle: 0, interior: 1 }
    const warm = col('#ffd98a')
    // Hinter dem Türblatt (zwischen Lichtfläche z 0,02 und Türinnenseite z 0,03): Die aufschwingende
    // Tür verdeckt den Schein in jeder Stellung – so leuchtet ihre Außenseite nicht mit.
    builder.quad(0, 1.15, 0.025, 4.6, 5.4, haloOf(warm, 0.95), undefined, inside)
    builder.quad(0, 0.07, 1.9, 3.6, 4.8, haloOf(warm, 0.7), FLAT, inside)
    const flareGeometry = builder.batch.build('glow')
    const flare = createGlowMaterial(this.time, { halo: true, fogAmount: 0 })
    flare.uniforms.uPower.value = 0

    this.disposables.push(texture, portalGeometry, portalMaterial, flareGeometry, flare)
    const group = new THREE.Group()
    group.add(portal, new THREE.Mesh(flareGeometry, flare))
    group.visible = false
    return { group, portal, flare }
  }

  // ------------------------------------------------------------ Eingabe

  private get unitsPerPixel(): number {
    // Wer die Straße entlangschaut, geht mit jedem Wisch ein größeres Stück.
    const along = THREE.MathUtils.lerp(
      Math.abs(this.turn.value),
      1,
      endTurn(this.panX, this.camera.aspect, this.streetEnd),
    )
    return (visibleWidth(this.camera.aspect) / this.width) * (1 + 1.4 * along)
  }

  private attachInput(): void {
    const detach = attachGestures(this.canvas, {
      onGrab: () => {
        this.velocity = 0
        this.escapeDrag = 0
        this.options.onInteract()
      },
      onPan: (dx) => {
        if (this.locked) return
        if (this.inspectOpen) {
          // Wischen bringt einen zurück auf die Straße.
          this.escapeDrag += Math.abs(dx)
          if (this.escapeDrag > 28) this.stopInspecting()
          return
        }
        if (this.focusDay !== null) {
          // Wer vor einer Haustür weiterwischt, will zurück auf die Straße.
          this.escapeDrag += Math.abs(dx)
          if (this.escapeDrag > 28) this.options.onBackgroundTap()
          return
        }
        this.panTween.set(this.panX)
        this.panX -= dx * this.unitsPerPixel
      },
      onPanEnd: (velocity) => {
        if (this.locked || this.focusDay !== null) return
        this.velocity = THREE.MathUtils.clamp(-velocity * this.unitsPerPixel, -70, 70)
      },
      onTurn: (dx) => {
        if (this.locked || this.focusDay !== null || this.inspectOpen) return
        this.turn.set(THREE.MathUtils.clamp(this.turn.value - dx / (this.width * 0.55), -1, 1))
      },
      onTurnEnd: () => {
        if (this.locked || this.focusDay !== null) return
        const target = Math.abs(this.turn.value) < 0.5 ? 0 : this.turn.value < 0 ? -1 : 1
        void this.turn.animate(target, 0.2 + Math.abs(target - this.turn.value) * 0.8)
        this.options.onLookChange(target)
      },
      onTap: (x, y) => {
        if (this.locked) return
        if (this.inspectOpen) {
          this.stopInspecting()
          return
        }
        if (this.hoopShot?.hits(x, y, this.canvas, this.camera) && this.hoopShot.shoot(this.camera)) {
          this.options.onInteract()
          return
        }
        if (this.throwAtCritter(x, y)) return
        if (this.focusDay === null && this.inspectAt(x, y)) return
        const day = this.pick(x, y)
        if (day !== null) this.options.onHouseTap(day)
        else if (this.focusDay !== null) this.options.onBackgroundTap()
      },
      onHover: (x, y) => {
        const hoop = this.hoopShot?.hits(x, y, this.canvas, this.camera) ?? false
        this.canvas.style.cursor = !this.locked && (hoop || this.pick(x, y) !== null) ? 'pointer' : 'grab'
      },
    })

    const onKey = (event: KeyboardEvent) => {
      if (this.inspectOpen && (event.key === 'Escape' || event.key.startsWith('Arrow'))) {
        this.stopInspecting()
        return
      }
      if (this.locked || this.focusDay !== null || event.target !== document.body) return
      const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
      if (step === 0) return
      // Nach dem Tor kommt – wenn es offen steht – noch der Platz mit dem Baum.
      const next = THREE.MathUtils.clamp((this.place ?? 1) + step, 1, TREE_PLACE)
      if (next === TREE_PLACE) this.goToTree()
      else this.goToHouse(next)
      this.options.onInteract()
    }
    window.addEventListener('keydown', onKey)
    this.cleanups.push(detach, () => window.removeEventListener('keydown', onKey))
  }

  /** Während der Fahrt durch die Tür reagiert die Straße nicht auf Eingaben. */
  private get locked(): boolean {
    return this.enteringStop !== null
  }

  private pick(clientX: number, clientY: number): number | null {
    const rect = this.canvas.getBoundingClientRect()
    this.pointer.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(this.pointer, this.camera)
    let nearest: Stop | null = null
    let nearestDistance = Infinity
    for (const stop of this.stops) {
      if (!this.raycaster.ray.intersectBox(stop.bounds, this.hit)) continue
      const distance = this.hit.distanceToSquared(this.raycaster.ray.origin)
      if (distance < nearestDistance) {
        nearest = stop
        nearestDistance = distance
      }
    }
    return nearest ? nearest.day : null
  }

  // ------------------------------------------------ Öffentliche Steuerung

  private stop(day: number): Stop {
    return this.stops[THREE.MathUtils.clamp(day, 1, this.stops.length) - 1]
  }

  /** Vor dem geschlossenen Tor ist Schluss; steht es offen, geht es weiter bis zum Baum. */
  private clampPan(x: number): number {
    const max = maxPanX(this.camera.aspect, this.streetEnd, this.gateOpen)
    return THREE.MathUtils.clamp(x, this.layout.cameraMinX, max)
  }

  private panTo(x: number, duration?: number): void {
    const target = this.clampPan(x)
    const distance = Math.abs(target - this.panX)
    this.velocity = 0
    this.panTween.set(this.panX)
    void this.panTween.animate(
      target,
      duration ?? THREE.MathUtils.clamp(0.5 + distance * 0.03, 0.6, 2.4),
    )
  }

  /** Richtet die Kamera für Anflug und Eintreten auf den Eingang eines Ziels aus. */
  private aimAt(stop: Stop): void {
    this.entranceTarget = stop.entrance
    this.entrance.through = stop.entrance.through
    if (this.focus.value > 0) return
    // Kein Anflug im Gang: sofort übernehmen statt hinüberzugleiten.
    this.entrance.center.copy(stop.entrance.center)
    this.entrance.normal.copy(stop.entrance.normal)
    this.entrance.width = stop.entrance.width
    this.entrance.height = stop.entrance.height
  }

  /** Fährt die Kamera vor ein Haus (oder das Tor), ohne es anzufliegen. */
  goToHouse(day: number, instant = false): void {
    const target = this.stop(day).panX()
    if (!instant) return this.panTo(target)
    this.velocity = 0
    this.panX = this.clampPan(target)
    this.panTween.set(this.panX)
  }

  /** Geht durch das offene Tor bis vor den Weihnachtsbaum. */
  goToTree(): void {
    if (this.gateOpen) this.panTo(Infinity)
  }

  /** Fliegt nah an den Eingang heran (oder mit null zurück auf die Straße). */
  focusHouse(day: number | null): void {
    if (day === null) {
      if (this.focusDay === null) return
      this.focusDay = null
      void this.focus.animate(0, 0.8)
      return
    }
    const stop = this.stop(day)
    this.aimAt(stop)
    this.focusDay = day
    this.panTo(stop.panX(), 1)
    void this.focus.animate(1, 1)
    if (this.turn.value !== 0) {
      void this.turn.animate(0, 0.9)
      this.options.onLookChange(0)
    }
  }

  /** Dreht den Blick: die Straße entlang zum Baum (1), zurück zu ihrem Anfang (−1) oder wieder geradeaus (0). */
  look(direction: LookDirection): void {
    if (this.focusDay !== null) return
    // Vor dem Tor zeigt die Kamera ohnehin nach vorn – die Kehrtwende beginnt dann ohne Leerlauf.
    const facingGate = endTurn(this.panX, this.camera.aspect, this.streetEnd) >= 1
    if (direction < 0 && this.turn.value > 0 && facingGate) this.turn.set(0)
    void this.turn.animate(direction, 0.5 + Math.abs(direction - this.turn.value) * 0.8)
    this.options.onLookChange(direction)
  }

  /** Zeigt das Aufschließen vor dem Selfie: erst vor die Tür fahren, dann nach außen aufschwingen. */
  async playUnlock(day: number): Promise<void> {
    const stop = this.stop(day)
    if (!stop.opaqueDoor) return
    stop.heldDoor.set(0)
    this.focusHouse(day)
    await this.focus.animate(1, 0.9)
    await stop.heldDoor.animate(1, 1.35)
  }

  /** Öffnet Tür oder Tor und fährt ins gleißende Licht. Erfüllt sich, wenn die Kamera „drin“ ist. */
  async playEnter(day: number): Promise<void> {
    const stop = this.stop(day)
    this.enteringStop = stop
    this.focusDay = day
    this.aimAt(stop)
    if (this.focus.value < 1 && !this.focus.moving) void this.focus.animate(1, 0.6)

    const { center, normal } = stop.entrance
    this.doorLight.position.copy(center)
    this.doorLight.rotation.y = Math.atan2(normal.x, normal.z)
    // Das Tor ist breiter als eine Haustür, und hinter seinen Gitterstäben liegt kein heller Flur.
    this.doorLight.scale.setScalar(stop.opaqueDoor ? 1 : 1.8)
    this.doorPortal.visible = stop.opaqueDoor
    this.doorLight.visible = true
    void this.doorOpen.animate(1, 1.15)
    await this.enter.animate(1, 1.6, easeIn)
  }

  /**
   * Stellt die Kamera nach dem Besuch wieder auf die Straße. Wer das letzte
   * Rätsel gelöst hat, steht danach hinter dem Tor – vor dem Weihnachtsbaum.
   */
  finishLeave(day: number): void {
    const stop = this.stop(day)
    const throughGate = stop === this.gate && this.gateOpen
    this.enteringStop = null
    this.focusDay = null
    this.enter.set(0)
    this.focus.set(0)
    this.doorOpen.set(0)
    this.turn.set(0)
    this.doorLight.visible = false
    if (throughGate) this.gateSwing.set(1)
    this.velocity = 0
    this.panX = this.clampPan(throughGate ? Infinity : stop.panX())
    this.panTween.set(this.panX)
    this.updateDoors()
    this.options.onLookChange(0)
    // Gerade die Lichterkette entwirrt? Dann zum Baum schauen und zusehen, wie alles angeht.
    if (this.lightsReveal && this.lightsReveal.t < 0) {
      this.lightsReveal.t = 0
      this.look(1)
    }
    // Gerade Geschenke-Tetris gelöst? Dann regnet es jetzt Geschenke vor die Haustüren.
    if (this.presentDrop && this.presentDrop.t < 0) this.startPresentDrop()
    // Das Selfie ploppt noch einmal auf – jetzt sieht man es auch.
    if (stop.photo) {
      stop.photoPop.set(0)
      void stop.photoPop.animate(1, 0.8, easeOutBack, 0.7)
    }
  }

  /**
   * Öffnet das Tor dauerhaft (oder schließt es wieder): Die Flügel schwingen
   * auf, der Weg zum Baum ist frei. Beim ersten Aufruf steht es sofort richtig.
   */
  setGateOpen(open: boolean): void {
    const animate = this.gateKnown && this.running
    this.gateKnown = true
    if (open === this.gateOpen) return
    this.gateOpen = open
    if (animate) void this.gateSwing.animate(open ? 1 : 0, 1.6)
    else this.gateSwing.set(open ? 1 : 0)
  }

  /** Ein Zustand pro Tag. Beim ersten Aufruf gehen die Lichter der bewohnten Häuser nacheinander an. */
  setHouseStates(states: readonly HouseState[]): void {
    let marked: Stop | null = null
    for (const [index, stop] of this.stops.entries()) {
      const state = states[index]
      const target = state?.awake ? 1 : 0
      const opened = stop.opaqueDoor && state?.opened === true
      if (opened && !stop.entranceLight) {
        const light = this.createDoorLight()
        light.group.position.copy(stop.entrance.center)
        light.group.rotation.y = Math.atan2(stop.entrance.normal.x, stop.entrance.normal.z)
        stop.entranceLight = light
        this.scene.add(light.group)
      }
      if (!this.statesApplied) stop.heldDoor.set(opened ? 1 : 0)
      else if (opened !== stop.opened) void stop.heldDoor.animate(opened ? 1 : 0, 1.15)
      stop.opened = opened
      if (state?.marked) marked ??= stop
      if (!this.statesApplied) {
        stop.power.set(0)
        if (target === 1) void stop.power.animate(1, 0.9, easeInOut, 0.6 + index * 0.1)
      } else if (target !== stop.powerTarget) {
        void stop.power.animate(target, 1.2)
      }
      stop.powerTarget = target
    }
    this.markedStop = marked
    this.statesApplied = true
    this.updateDoors()
  }

  /**
   * Lässt den Wichtel hinter der rechten Ecke von Haus `day` hervorlugen – oder
   * schickt ihn mit null wieder weg.
   */
  setPeekingElf(day: number | null): void {
    const plotIndex = day === null ? -1 : this.layout.plots.findIndex((plot) => plot.spec.day === day)
    if (plotIndex < 0) {
      if (this.elf) void this.elfShow.animate(0, 0.4, easeIn)
      return
    }
    if (this.elf?.day === day) {
      void this.elfShow.animate(1, 0.9, easeOutBack, 0.4)
      return
    }
    const plot = this.layout.plots[plotIndex]
    const next = this.layout.plots[plotIndex + 1]
    const cornerX = plot.x + plot.spec.width / 2
    // In schmalen Lücken etwas kleiner, damit er nicht im Nachbarhaus steckt.
    const gap = next ? next.x - next.spec.width / 2 - cornerX : 1
    const mesh = this.elf?.mesh ?? new THREE.Mesh(buildPeekingElf(), this.solidMaterial)
    if (!this.elf) {
      this.disposables.push(mesh.geometry)
      this.scene.add(mesh)
    }
    mesh.scale.setScalar(THREE.MathUtils.clamp((gap - 0.05) / 0.6, 0.6, 1.2))
    // Ganz hinter dem Haus: Nur der Kopf lugt an der hinteren rechten Ecke vorbei.
    mesh.position.set(cornerX, 0, -plot.spec.depth - 0.4)
    this.elf = { mesh, cornerX, day: day! }
    if (!this.statesApplied) this.elfShow.set(1)
    else {
      this.elfShow.set(0)
      void this.elfShow.animate(1, 0.9, easeOutBack, 0.4)
    }
    this.updateElf(0)
  }

  /**
   * Stellt das Lebkuchenhaus (so verziert, wie es im Spiel gebaut wurde) ins mittlere
   * Fenster über der Haustür von Haus `day` – auf die Fensterbank. Mit null verschwindet es wieder.
   */
  setGingerbreadHouse(day: number | null, design: GingerbreadDesign | null = null): void {
    const plot = day === null ? undefined : this.layout.plots.find((p) => p.spec.day === day)
    if (!plot || !design) {
      if (this.gingerbread) this.gingerbread.mesh.visible = false
      return
    }
    const key = `${day}|${JSON.stringify(design)}`
    if (this.gingerbread?.key === key) {
      this.gingerbread.mesh.visible = true
      return
    }
    if (this.gingerbread) {
      this.gingerbread.mesh.removeFromParent()
      this.gingerbread.mesh.geometry.dispose()
    }
    const mesh = new THREE.Mesh(buildGingerbreadHouse(design), this.solidMaterial)
    const spec = plot.spec
    // Erstes Obergeschoss, mittlere Fensterachse; die Fensterbank liegt 0,6 m über dem Geschossboden.
    const floor = Math.min(1, spec.floors - 1)
    const sill = floor === 0 ? 1.05 : GROUND_FLOOR + (floor - 1) * UPPER_FLOOR + 0.6
    const column = Math.floor(spec.columns / 2)
    // Etwas schmaler als das Fenster, damit Süßigkeiten an den Dachenden nicht vom Rahmen verdeckt werden;
    // in der Tiefe flach, damit es nicht aus der Wand ragt.
    const scale = (0.76 / 1.1) * GINGER_SCALE
    mesh.scale.set(scale, scale, scale * 0.35)
    mesh.position.set(columnX(spec, column), sill + 0.03, 0.2)
    this.stop(spec.day).group.add(mesh)
    this.gingerbread = { mesh, key }
  }

  /**
   * Holzhacken geschafft: Hinter dem Fenster oben rechts von Haus `day` wirft ein Wichtel
   * Scheite in den Kamin, und aus dem Schornstein schlagen Flammen. Mit null ist der Kamin aus.
   */
  setFireplace(day: number | null): void {
    const hearth = day === null ? undefined : this.hearths.get(day)
    if (!hearth) {
      if (this.fireplace) {
        this.fireplace.window.group.visible = false
        if (this.fireplace.flames) this.fireplace.flames.points.visible = false
        if (this.inspecting?.id === 'fireplace') this.stopInspecting()
      }
      return
    }
    if (this.fireplace?.day !== day) {
      if (this.fireplace) {
        this.fireplace.window.group.removeFromParent()
        this.fireplace.window.dispose()
        this.fireplace.flames?.points.removeFromParent()
        this.fireplace.flames?.dispose()
      }
      const stop = this.stop(day!)
      const window = createFireplaceWindow(hearth)
      stop.group.add(window.group)
      const flames = stop.smokeOrigin ? createChimneyFlames(stop.smokeOrigin, this.time) : null
      if (flames) this.scene.add(flames.points)
      this.fireplace = { window, flames, day: day! }
      this.disposables.push(window)
      if (flames) this.disposables.push(flames)
    }
    this.fireplace!.window.group.visible = true
    if (this.fireplace!.flames) this.fireplace!.flames.points.visible = true
    this.fireplace!.window.update(this.time.value)
  }

  /**
   * Lichterketten-Schlamassel geschafft: Die entwirrte Kette hängt in bunten Bögen an der
   * Dachkante von Haus `day`. Mit null wird sie wieder abgenommen.
   */
  setLightChain(day: number | null, colors: readonly string[] = []): void {
    const eaves = day === null ? undefined : this.eaves.get(day)
    if (!eaves || !colors.length) {
      if (this.lightChain) this.lightChain.group.visible = false
      if (this.inspecting?.id === 'light-chain') this.stopInspecting()
      return
    }
    if (this.lightChain?.day !== day) {
      if (this.lightChain) this.lightChain.group.removeFromParent()
      const geometry = buildLightChain(eaves, colors)
      const glow = createGlowMaterial(this.time)
      const halo = createGlowMaterial(this.time, { halo: true })
      const group = new THREE.Group()
      group.add(
        new THREE.Mesh(geometry.solid, this.solidMaterial),
        new THREE.Mesh(geometry.glow, glow),
        new THREE.Mesh(geometry.halo, halo),
      )
      this.disposables.push(geometry.solid, geometry.glow, geometry.halo, glow, halo)
      this.stop(day!).group.add(group)
      this.lightChain = { group, day: day! }
    }
    this.lightChain!.group.visible = true
  }

  /** Hinter den oberen Fenstern von Haus `day` hüpft Santa von Keks zu Keks – mit null ist er weg. */
  setSantaWindows(day: number | null): void {
    const windows = day === null ? undefined : this.showcases.get(day)
    if (!windows) {
      if (this.santaWindows) this.santaWindows.windows.group.visible = false
      return
    }
    if (this.santaWindows?.day !== day) {
      if (this.santaWindows) {
        this.santaWindows.windows.group.removeFromParent()
        this.santaWindows.windows.dispose()
      }
      const santa = createSantaWindows(windows)
      this.disposables.push(santa)
      this.stop(day!).group.add(santa.group)
      this.santaWindows = { windows: santa, day: day! }
    }
    this.santaWindows!.windows.group.visible = true
    this.santaWindows!.windows.update(this.time.value)
  }

  /** Die Fenster von Haus `day` sind vereist und zugeschneit – mit null tauen sie auf. */
  setFrostedWindows(day: number | null): void {
    const windows = day === null ? undefined : this.facadeWindows.get(day)
    if (!windows) {
      if (this.frosted) this.frosted.windows.group.visible = false
      return
    }
    if (this.frosted?.day !== day) {
      if (this.frosted) {
        this.frosted.windows.group.removeFromParent()
        this.frosted.windows.dispose()
      }
      const frosted = createFrostedWindows(windows)
      this.disposables.push(frosted)
      this.stop(day!).group.add(frosted.group)
      this.frosted = { windows: frosted, day: day! }
    }
    this.frosted!.windows.group.visible = true
  }

  /** Lichterketten an Häusern und Bäumen an- oder ausschalten (an erst nach Haus 3). */
  setStringLights(on: boolean): void {
    // Steht der große Auftritt noch aus oder läuft er gerade, bestimmt er selbst, was leuchtet.
    if (this.lightsReveal) return
    STRING_LIGHTS.value = on ? STRINGS_ON : STRINGS_OFF
    this.sky.setChristmasStar(on)
  }

  /**
   * Haus 3 wurde eben gelöst: Die Ketten bleiben noch aus. Sobald man wieder auf der Straße
   * steht, dreht sich der Blick zum Baum und die Lichter gehen Haus für Haus an – 1 bis 24.
   */
  prepareLightsReveal(): void {
    STRING_LIGHTS.value = STRINGS_OFF
    this.sky.setChristmasStar(false)
    const steps = this.revealSteps()
    // Wann jeder Schritt dran ist: erst gemächlich, dann immer schneller.
    const times: number[] = []
    let at = REVEAL_DELAY
    steps.forEach((_, i) => {
      times.push(at)
      at += REVEAL_STEP / REVEAL_SPEEDUP ** i
    })
    this.lightsReveal = { t: -1, steps, times }
  }

  /** Die Grenzen, bis zu denen nacheinander alles leuchtet: nach jedem Haus, dann Allee, Tor, Platz. */
  private revealSteps(): number[] {
    const { plots } = this.layout
    const steps = plots.map((plot, i) => {
      const next = plots[i + 1]
      return next ? (plot.x + plot.spec.width / 2 + next.x - next.spec.width / 2) / 2 : plot.x + plot.spec.width / 2 + 0.5
    })
    // Die Allee in zwei Schritten, dann das Tor (24), die Laternen am Platz und zuletzt der große Baum
    const end = steps[steps.length - 1]
    const { gateX, treeX } = this.layout
    steps.push(end + (gateX - end) / 2, gateX + 2, treeX - 3, STRINGS_ON)
    return steps
  }

  /** Der Sternblitz erhellt kurz die ganze Straße in warmem Licht. */
  private updateFlashLight(): void {
    const flash = this.sky.flashLight()
    this.skyLight.intensity = 2.4 * (1 + 0.9 * flash)
    this.skyLight.color.set('#b9c6ff').lerp(FLASH_COLOR, flash * 0.8)
    this.moonlight.intensity = 1.5 * (1 + 1.6 * flash)
    this.moonlight.color.set('#dfe5ff').lerp(FLASH_COLOR, flash)
  }

  private updateLightsReveal(dt: number): void {
    const reveal = this.lightsReveal
    if (!reveal || reveal.t < 0) return
    reveal.t += dt
    let index = -1
    while (index + 1 < reveal.times.length && reveal.t >= reveal.times[index + 1]) index++

    if (index < 0) return
    STRING_LIGHTS.value = reveal.steps[index]
    // Ganz zum Schluss: der große Stern erscheint mit einem Lichtblitz.
    if (index === reveal.steps.length - 1 && !reveal.starred) {
      reveal.starred = true
      this.sky.flashChristmasStar()
    }
    // Kurz bewundern, dann wieder zu den Häusern schauen.
    if (index === reveal.steps.length - 1 && reveal.t > reveal.times[index] + REVEAL_LINGER) {
      STRING_LIGHTS.value = STRINGS_ON
      this.lightsReveal = null
      this.look(0)
    }
  }

  /** Vor Tag 14 hat die Garage noch keinen Korb – im Spiel von Haus 14 wird er angeschraubt. */
  setGarageHoop(visible: boolean): void {
    if (!visible) {
      if (this.garageHoop) this.garageHoop.visible = false
      return
    }
    if (!this.garageHoop) {
      const geometry = buildHoop()
      const glow = createGlowMaterial(this.time)
      const halo = createGlowMaterial(this.time, { halo: true })
      const group = new THREE.Group()
      group.position.x = this.layout.garage.x
      group.add(new THREE.Mesh(geometry.solid, this.solidMaterial), new THREE.Mesh(geometry.glow, glow), new THREE.Mesh(geometry.halo, halo))
      this.disposables.push(geometry.solid, geometry.glow, geometry.halo, glow, halo)
      this.scene.add(group)
      this.garageHoop = group
    }
    this.garageHoop.visible = true
  }

  /** Weihnachtskugelball geschafft: Ab jetzt lässt sich auf der Straße der Korb über der Garage antippen. */
  setHoopShot(enabled: boolean): void {
    if (!enabled) {
      if (this.hoopShot) this.hoopShot.group.visible = false
      return
    }
    if (!this.hoopShot) {
      this.hoopShot = new HoopShot(this.layout.garage.x)
      this.scene.add(this.hoopShot.group)
      this.disposables.push(this.hoopShot)
    }
    this.hoopShot.group.visible = true
  }

  /**
   * Glühwein-Fieber geschafft: Der Glühweinstand steht ab dann dauerhaft auf dem Gehweg vor
   * Haus `day`, neben der Haustür – ein Wichtel steht als Barkeeper dahinter und rührt im Topf.
   * Mit null wird er wieder abgebaut.
   */
  setGluehweinStand(day: number | null): void {
    const offset = day === null ? undefined : this.standSpots.get(day)
    if (offset === undefined) {
      if (this.gluehweinStand) this.gluehweinStand.group.visible = false
      if (this.inspecting?.id === 'gluehwein-stand') this.stopInspecting()
      this.placePresentStacks()
      return
    }
    if (this.gluehweinStand?.day !== day) {
      if (this.gluehweinStand) this.gluehweinStand.group.removeFromParent()
      const stand = createGluehweinStand(this.solidMaterial, this.time, { bartender: true })
      stand.group.position.set(offset, 0, GLUEHWEIN_STAND_Z)
      this.disposables.push(stand)
      this.stop(day!).group.add(stand.group)
      this.gluehweinStand = { group: stand.group, update: stand.update, day: day! }
    }
    this.gluehweinStand!.group.visible = true
    this.placePresentStacks()
  }

  /** Nach dem Wohnzimmer-Abenteuer sitzt die Katze draußen auf dem Balkon von Haus `day` – mit null ist sie wieder drin. */
  setBalconyCat(day: number | null): void {
    const spot = day === null ? undefined : this.balconies.get(day)
    if (!spot) {
      if (this.balconyCat) this.balconyCat.root.visible = false
      if (this.inspecting?.id === 'balcony-cat') this.stopInspecting()
      return
    }
    if (!this.balconyCat) {
      const cat = buildBalconyCat()
      const group = new THREE.Group()
      const tail = new THREE.Mesh(cat.tail, this.solidMaterial)
      tail.position.copy(cat.tailBase)
      group.add(new THREE.Mesh(cat.body, this.solidMaterial), tail)
      this.disposables.push(cat.body, cat.tail)
      // Etwas größer als echt, damit man sie von der Straße aus erkennt – etwas links
      // von der Mitte, damit sie zwischen den Gitterstäben gut zu sehen ist.
      group.scale.setScalar(1.35)
      group.position.set(-0.3, 0, -0.05)
      group.rotation.y = 0.25
      // Unsichtbare Tippfläche über den ganzen Balkon – die Katze allein ist zu klein zum Treffen.
      const hitGeometry = new THREE.BoxGeometry(1.85, 1.2, 1.05)
      const hitbox = new THREE.Mesh(hitGeometry, this.solidMaterial)
      hitbox.position.set(0, 0.5, 0.02)
      hitbox.visible = false
      this.disposables.push(hitGeometry)
      const root = new THREE.Group()
      root.add(group, hitbox)
      this.balconyCat = { root, group, tail, day: day! }
    }
    const cat = this.balconyCat
    cat.root.position.copy(spot)
    if (cat.day !== day || !cat.root.parent) this.stop(day!).group.add(cat.root)
    cat.day = day!
    cat.root.visible = true
  }

  /** Geschenke-Tetris geschafft: Vor jeder Haustür der Straße stapeln sich Geschenke – mit false sind sie wieder weg. */
  setPresentStacks(enabled: boolean): void {
    this.presentStacksOn = enabled
    if (!enabled && this.inspecting?.id.startsWith('present-stack')) this.stopInspecting()
    if (enabled && !this.presentStacks) {
      this.presentStacks = [...this.doors].flatMap(([day, doorX]) =>
        ([-1, 1] as const).map((side) => {
          const geometry = buildEntrancePresents(day, doorX, side)
          this.disposables.push(geometry)
          const mesh = new THREE.Mesh(geometry, this.solidMaterial)
          this.stop(day).group.add(mesh)
          return { day, side, mesh }
        }),
      )
    }
    this.placePresentStacks()
  }

  /**
   * Haus 23 wurde eben gelöst: Die Stapel warten noch hoch über den Dächern. Zurück auf der
   * Straße fallen sie herunter – erst vor den Häusern in der Nähe, dann immer weiter weg.
   */
  preparePresentDrop(): void {
    this.presentDrop = { t: -1, delays: [] }
  }

  private startPresentDrop(): void {
    const drop = this.presentDrop
    if (!drop) return
    drop.t = 0
    drop.delays = (this.presentStacks ?? []).map(({ day, side }) => {
      const doorX = this.stop(day).group.position.x + (this.doors.get(day) ?? 0)
      const jitter = ((day * 7 + (side + 1) * 3) % 10) / 10
      return 0.6 + Math.min(4, Math.abs(doorX - this.panX) * 0.045) + jitter * 0.35
    })
  }

  private updatePresentDrop(dt: number): void {
    const drop = this.presentDrop
    if (!drop || !this.presentStacks) return
    if (drop.t >= 0) drop.t += dt
    let falling = false
    this.presentStacks.forEach(({ mesh }, i) => {
      if (drop.t < 0) {
        mesh.position.y = PRESENT_DROP_HEIGHT * 3
        falling = true
        return
      }
      const since = drop.t - drop.delays[i]
      const landing = Math.sqrt((2 * PRESENT_DROP_HEIGHT) / PRESENT_GRAVITY)
      if (since < landing) {
        // Freier Fall aus dem Nachthimmel …
        mesh.position.y = PRESENT_DROP_HEIGHT - 0.5 * PRESENT_GRAVITY * Math.max(0, since) ** 2
        falling = true
      } else {
        // … und ein kleiner Hopser beim Aufsetzen.
        const after = since - landing
        mesh.position.y = Math.abs(Math.sin(after * 11)) * 0.22 * Math.exp(-after * 6)
        if (after < 1) falling = true
      }
    })
    if (!falling) {
      for (const { mesh } of this.presentStacks) mesh.position.y = 0
      this.presentDrop = null
    }
  }

  /** Steht der Glühweinstand neben einer Tür, bleibt auf seiner Seite der Platz frei. */
  private placePresentStacks(): void {
    const stand = this.gluehweinStand?.group.visible ? this.gluehweinStand : null
    for (const { day, side, mesh } of this.presentStacks ?? []) {
      const blocked = stand?.day === day && Math.sign((this.standSpots.get(day) ?? 0) - (this.doors.get(day) ?? 0)) === side
      mesh.visible = this.presentStacksOn && !blocked
    }
  }

  private updateBalconyCat(): void {
    const cat = this.balconyCat
    if (!cat?.root.visible) return
    const t = this.time.value
    // Schwanz wedelt gemächlich, ab und zu zuckt die Spitze.
    cat.tail.rotation.y = Math.sin(t * 1.3) * 0.45 + Math.max(0, Math.sin(t * 0.37)) ** 8 * Math.sin(t * 14) * 0.25
    cat.tail.rotation.z = Math.sin(t * 0.9) * 0.12
  }

  /** Nach Santa Bibber (Haus 11) fliegt der Weihnachtsmann bei jedem Blick zum Baum vorbei. */
  setSantaFlyby(enabled: boolean): void {
    this.flybyEnabled = enabled
    if (!enabled && this.flyby) {
      this.flyby.active = false
      this.flyby.group.visible = false
    }
  }

  /**
   * Schickt den Schlitten einmal von links nach rechts über den Baum – aus Sicht der Kamera,
   * die gerade die Straße entlang zum Baum schaut. Ohne gelöstes Haus 11 passiert nichts.
   */
  flySanta(): void {
    if (!this.flybyEnabled) return
    if (!this.flyby) {
      const group = buildSleighWithSanta(this.solidMaterial)
      group.visible = false
      group.traverse((object) => {
        const mesh = object as THREE.Mesh
        if (mesh.geometry) this.disposables.push(mesh.geometry)
      })
      this.scene.add(group)
      this.flyby = { group, t: 0, active: false }
    }
    // Läuft er schon, darf er erst zu Ende fliegen.
    if (this.flyby.active) return
    this.flyby.t = -FLYBY_DELAY
    this.flyby.active = true
  }

  private updateFlyby(dt: number): void {
    const flyby = this.flyby
    if (!flyby?.active) return
    flyby.t += dt
    const u = flyby.t / FLYBY_SECONDS
    flyby.group.visible = u >= 0 && u <= 1
    if (u > 1) {
      flyby.active = false
      return
    }
    if (u < 0) return
    // In echter Entfernung und Größe: knapp hinter dem Baum, ein paar Meter über der Spitze.
    // Er zieht von Bildrand zu Bildrand – je weiter weg, desto länger der Weg.
    const camera = this.camera.position
    const x = this.layout.treeX + FLYBY_BEHIND_TREE
    const distance = Math.max(10, x - camera.x)
    const across = Math.max(14, distance * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.aspect * 1.15)
    const y = TREE_HEIGHT + FLYBY_ABOVE_TREE + Math.sin(u * Math.PI) * 1.2
    flyby.group.position.set(x, y, TREE_Z - across + u * across * 2)
    // Der Schlitten fährt in +x; gedreht fliegt er nach +z – vom Baum aus gesehen nach rechts.
    flyby.group.rotation.set(Math.sin(this.time.value * 2.4) * 0.05, -Math.PI / 2, Math.sin(this.time.value * 2.4 + 1) * 0.06)
  }

  /** Hinter Haus 8 fährt der Skiwichtel, sobald sein Spiel gelöst ist. */
  setSkiHalfpipe(visible: boolean): void {
    if ((this.skiHalfpipe?.group.visible ?? false) === visible) return
    if (!this.skiHalfpipe) {
      const halfpipe = createSkiHalfpipe(this.solidMaterial)
      halfpipe.group.position.copy(this.environment.halfpipeSite)
      this.scene.add(halfpipe.group)
      this.disposables.push(halfpipe)
      this.skiHalfpipe = halfpipe
    }
    this.skiHalfpipe.group.visible = visible
    this.environment.setHalfpipeClearing(visible)
    if (visible) this.skiHalfpipe.update(this.time.value)
    else if (this.inspecting?.id === 'ski-halfpipe') this.stopInspecting()
  }

  /**
   * Alles, was man nach gelösten Spielen antippen und heranzoomen kann. Neue Easter Eggs
   * aus späteren Spielen bekommen hier einfach einen Eintrag.
   */
  private inspectables(): Inspectable[] {
    const list: Inspectable[] = []
    const world = (object: THREE.Object3D, x = 0, y = 0, z = 0) => object.localToWorld(new THREE.Vector3(x, y, z))
    /** Von vorn auf einen Punkt schauen, aus `distance` Metern, leicht erhöht. */
    const front = (target: THREE.Vector3, distance: number, fov = 38, lift = 0.25) =>
      (out: { position: THREE.Vector3; target: THREE.Vector3; fov: number }) => {
        out.target.copy(target)
        out.position.set(target.x, target.y + lift, target.z + distance)
        out.fov = fov
      }

    const conveyor = this.conveyor
    if (conveyor?.conveyor.group.visible) {
      const box = new THREE.Box3().setFromObject(conveyor.conveyor.group)
      list.push({ id: 'cakes', label: 'Kuchen-Förderband', object: conveyor.conveyor.group, view: front(box.getCenter(new THREE.Vector3()), 4.2) })
    }
    const santaWindows = this.santaWindows
    if (santaWindows?.windows.group.visible) {
      const box = new THREE.Box3().setFromObject(santaWindows.windows.group)
      list.push({ id: 'santa-windows', label: 'Santa hüpft im Obergeschoss', object: santaWindows.windows.group, view: front(box.getCenter(new THREE.Vector3()), 4.2) })
    }
    const reindeer = this.reindeer
    if (reindeer?.group.visible) {
      list.push({ id: 'reindeer', label: 'Rentier im Giebel', object: reindeer.group, view: (out) => front(world(reindeer.group), 3.6, 38, -0.4)(out) })
    }
    const elf = this.elf
    if (elf?.mesh.visible) {
      const plot = this.layout.plots.find((p) => p.spec.day === elf.day)
      const next = this.layout.plots.find((p) => p.spec.day === elf.day + 1)
      const gapX = next ? (elf.cornerX + next.x - next.spec.width / 2) / 2 : elf.cornerX + 0.5
      list.push({
        id: 'elf',
        label: 'Wichtel hinter Haus 9',
        object: elf.mesh,
        hidden: true,
        // Die Lücke ist schmal: ohne kleinere Nahgrenze schneidet die Kamera die Hauswand von Haus 10 an.
        throughGap: true,
        view: (out) => {
          // Durch die Lücke zwischen den Häusern nach hinten schauen – etwas rechts der Mitte,
          // damit der Wichtel hinter der Ecke von Haus 9 zu sehen ist.
          const head = world(elf.mesh, 0.06, 1.05, 0)
          out.target.set(elf.cornerX + 0.1, head.y, head.z)
          out.position.set(gapX + 0.13, 1.5, -(plot?.spec.depth ?? 4) + 2.4)
          out.fov = 42
        },
      })
    }
    const easel = this.easel
    if (easel?.group.visible) {
      list.push({ id: 'easel', label: 'Bild auf der Staffelei', object: easel.group, view: (out) => front(world(easel.group, 0, 1.12, 0.06), 2.3, 38, 0.1)(out) })
    }
    const ginger = this.gingerbread
    if (ginger?.mesh.visible) {
      list.push({ id: 'gingerbread', label: 'Lebkuchenhaus im Fenster', object: ginger.mesh, view: (out) => front(world(ginger.mesh, 0, 110, 0), 1.9, 38, 0.1)(out) })
    }
    const chain = this.lightChain
    if (chain?.group.visible) {
      const box = new THREE.Box3().setFromObject(chain.group)
      list.push({ id: 'light-chain', label: 'Lichterkette an Haus 3', object: chain.group, view: front(box.getCenter(new THREE.Vector3()), 6.5, 40, -0.6) })
    }
    const stand = this.gluehweinStand
    if (stand?.group.visible) {
      list.push({ id: 'gluehwein-stand', label: 'Glühweinstand vor Haus 13', object: stand.group, view: (out) => front(world(stand.group, 0, 1.6, 0), 5.5, 40, -0.2)(out) })
    }
    const balconyCat = this.balconyCat
    if (balconyCat?.root.visible) {
      list.push({
        id: 'balcony-cat',
        label: 'Katze auf dem Balkon',
        object: balconyCat.root,
        view: (out) => front(world(balconyCat.group, 0, 0.3, 0), 2.4, 38, 0.15)(out),
      })
    }
    for (const { day, side, mesh } of this.presentStacks ?? []) {
      if (!mesh.visible) continue
      const door = this.doors.get(day) ?? 0
      list.push({
        id: `present-stack-${day}${side < 0 ? 'l' : 'r'}`,
        label: `Geschenke vor Haus ${day}`,
        object: mesh,
        view: (out) => front(world(mesh, door, 0.5, 1.1), 6, 38, 0.3)(out),
      })
    }
    const fireplace = this.fireplace
    if (fireplace?.window.group.visible) {
      list.push({
        id: 'fireplace',
        label: 'Wichtel am Kamin',
        object: fireplace.window.group,
        view: (out) => front(world(fireplace.window.group.children[0]), 2.6, 38, 0.1)(out),
      })
    }
    const halfpipe = this.skiHalfpipe
    if (halfpipe?.group.visible) {
      list.push({
        id: 'ski-halfpipe',
        label: 'Wichtel auf der Halfpipe',
        object: halfpipe.group,
        hidden: true,
        throughGap: true,
        view: (out) => {
          const target = world(halfpipe.group, 0, 1.06, 0)
          const left = this.stop(SKI_HOUSE_DAY).bounds
          const right = this.stop(SKI_HOUSE_DAY + 1).bounds
          const cameraZ = Math.max(left.min.z, right.min.z) + 0.93
          // Beide Wände bleiben an der hinteren Kante der Lücke im Vordergrund.
          out.target.copy(target)
          out.position.set(target.x, 1.59, cameraZ)
          // Halfpipe samt Plattformen links und rechts (je gut 1,9 m von der Mitte) soll ins Bild passen.
          const fitPipe = THREE.MathUtils.radToDeg(2 * Math.atan(2.25 / ((cameraZ - target.z) * this.camera.aspect)))
          out.fov = THREE.MathUtils.clamp(fitPipe, 48, 104)
        },
      })
    }
    const herd = this.meadowHerd
    if (herd?.group.visible) {
      herd.deer.forEach((deer, index) => {
        list.push({
          id: `meadow-reindeer-${index}`,
          label: index === 0 ? 'Rudolph auf der Wiese' : 'Rentier aus dem Wimmelbild',
          object: deer,
          // Die Rentiere laufen weiter herum – die Kamera folgt ihnen von der Straße aus.
          view: (out) => {
            const target = world(deer, 0.15, 1.1, 0)
            out.target.copy(target)
            out.position.set(target.x - 1.2, target.y + 0.5, target.z - 4.4)
            out.fov = 38
          },
        })
      })
    }
    if (this.moonSnowman) {
      const moon = this.sky.moon
      list.push({
        id: 'moon',
        label: 'Mondstaub-Mann auf dem Mond',
        object: moon,
        view: (out) => {
          // Über die Dächer schweben, zum Mond hochschauen und weit hineinzoomen.
          // Der Himmel wandert mit der Kamera – der Mond bleibt in derselben Richtung.
          out.position.copy(this.pose.position).add(MOON_LIFT)
          out.target.copy(out.position).add(moon.position)
          out.fov = 7
        },
      })
    }
    return list
  }

  /** Wurde ein Easter Egg angetippt? Dann fliegt die Kamera hin. */
  private inspectAt(clientX: number, clientY: number): boolean {
    const rect = this.canvas.getBoundingClientRect()
    this.pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const ray = this.raycaster.ray
    // Wie weit ist das nächste Haus entfernt? Was dahinter liegt, ist verdeckt.
    let houseDistance = Infinity
    for (const stop of this.stops) {
      if (ray.intersectBox(stop.bounds, this.hit)) houseDistance = Math.min(houseDistance, this.hit.distanceTo(ray.origin))
    }
    let best: { item: Inspectable; distance: number } | null = null
    for (const item of this.inspectables()) {
      const hits = this.raycaster.intersectObject(item.object, true)
      // Der Mond ist ein Bild am Himmel: Für ihn reicht ein Tipp in seine Nähe.
      let distance = hits[0]?.distance ?? Infinity
      if (!hits.length && item.id === 'moon') {
        const center = this.camera.position.clone().add(this.sky.moon.position)
        if (ray.distanceToPoint(center) < 12) distance = 1e5
      }
      if (!Number.isFinite(distance)) continue
      if (item.hidden && houseDistance < distance) continue
      if (!best || distance < best.distance) best = { item, distance }
    }
    if (!best) return false
    this.startInspecting(best.item)
    return true
  }

  private startInspecting(item: Inspectable): void {
    this.holdMeadowReindeer(item)
    this.inspecting = item
    this.inspectOpen = true
    this.escapeDrag = 0
    this.velocity = 0
    if (item.throughGap) this.panTween.set(this.panX)
    void this.inspectBlend.animate(1, 1.1, easeInOut)
    this.options.onInspectChange?.(item.label)
    this.options.onInteract()
  }

  /** Zurück zur normalen Straßenansicht. */
  stopInspecting(): void {
    if (!this.inspectOpen) return
    this.inspectOpen = false
    this.holdMeadowReindeer(null)
    const leaving = this.inspecting
    void this.inspectBlend.animate(0, 0.9, easeInOut).then(() => {
      if (!this.inspectOpen && this.inspecting === leaving) this.inspecting = null
    })
    this.options.onInspectChange?.(null)
  }

  /** Schaltet die Eichhörnchen auf der Straße ein oder aus. */
  setSquirrels(enabled: boolean): void {
    if (!enabled) {
      if (this.critter) this.critter.group.visible = false
      this.critter = null
      return
    }
    if (this.critter) return
    const squirrel = new THREE.Mesh(buildSquirrel(), this.solidMaterial)
    squirrel.scale.setScalar(CRITTER_SCALE)
    const pile = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#f3f6ff' }))
    pile.scale.set(1, 0.55, 1)
    const group = new THREE.Group()
    group.add(squirrel, pile)
    group.visible = false
    this.scene.add(group)
    this.disposables.push(squirrel.geometry, pile.geometry, pile.material as THREE.Material)
    this.critter = { group, squirrel, pile, state: 'waiting', t: 0, stay: 0, wait: 4 + Math.random() * 4 }
  }

  /** Trifft der Tipp ein Eichhörnchen, fliegt ein Schneeball los – dann zählt der Tipp nicht fürs Haus. */
  private throwAtCritter(clientX: number, clientY: number): boolean {
    const critter = this.critter
    if (!critter || (critter.state !== 'rising' && critter.state !== 'up') || this.critterBall) return false
    const rect = this.canvas.getBoundingClientRect()
    this.pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const center = critter.group.position.clone().add(new THREE.Vector3(0, critter.squirrel.position.y + 0.6 * CRITTER_SCALE, 0))
    // Großzügig: Auf dem Handy ist so ein Eichhörnchen klein.
    if (!this.raycaster.ray.intersectsSphere(new THREE.Sphere(center, 0.75 * CRITTER_SCALE + 0.25))) return false
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#3a4060' }))
    const from = this.camera.localToWorld(new THREE.Vector3(0.3, -0.45, -0.8))
    mesh.position.copy(from)
    this.scene.add(mesh)
    this.critterBall = { mesh, from, to: center, t: 0 }
    critter.stay = Math.max(critter.stay, critter.t + 0.5)
    this.options.onInteract()
    return true
  }

  /** Auftauchen, neugierig schauen, abtauchen – und irgendwann woanders wieder. */
  private updateCritter(dt: number): void {
    const critter = this.critter
    if (!critter) return
    critter.t += dt
    const { squirrel, pile, group } = critter

    const ball = this.critterBall
    if (ball) {
      ball.t = Math.min(1, ball.t + dt / 0.32)
      ball.mesh.position.lerpVectors(ball.from, ball.to, ball.t)
      ball.mesh.position.y += Math.sin(ball.t * Math.PI) * 0.4
      if (ball.t >= 1) {
        this.scene.remove(ball.mesh)
        ball.mesh.geometry.dispose()
        ;(ball.mesh.material as THREE.Material).dispose()
        this.critterBall = null
        if (critter.state === 'rising' || critter.state === 'up' || critter.state === 'ducking') {
          critter.state = 'hit'
          critter.t = 0
          this.options.onSquirrelHit?.()
        }
      }
    }

    // Ist man weitergegangen, taucht es ab und kommt bald im neuen Ausschnitt wieder.
    const outOfView = Math.abs(group.position.x - this.panX) > visibleWidth(this.camera.aspect) * 0.55
    if ((critter.state === 'rising' || critter.state === 'up') && outOfView) {
      this.resetCritter()
      critter.wait = 2 + Math.random() * 2
      return
    }

    switch (critter.state) {
      case 'waiting': {
        critter.wait -= dt
        // Nur auftauchen, wenn man gerade gemütlich vor den Häusern steht.
        const calm = !this.locked && this.focusDay === null && !this.inspectOpen && this.inspectBlend.value === 0 && Math.abs(this.turn.value) < 0.15 && this.enter.value === 0
        if (critter.wait > 0 || !calm) return
        const spread = visibleWidth(this.camera.aspect) * 0.34
        group.position.set(this.panX + (Math.random() * 2 - 1) * spread, 0, 1.55 + Math.random() * 0.5)
        group.rotation.y = (Math.random() - 0.5) * 0.6
        group.visible = true
        squirrel.rotation.set(0, 0, 0)
        critter.state = 'rising'
        critter.t = 0
        critter.stay = 3.2 + Math.random() * 2
        break
      }
      case 'rising': {
        const k = Math.min(1, critter.t / 0.35)
        pile.scale.set(k, 0.55 * k, k)
        squirrel.position.y = -1.3 * CRITTER_SCALE * (1 - k)
        if (k >= 1) { critter.state = 'up'; critter.t = 0 }
        break
      }
      case 'up':
        squirrel.rotation.z = Math.sin(this.time.value * 4) * 0.08
        if (critter.t >= critter.stay) { critter.state = 'ducking'; critter.t = 0 }
        break
      case 'ducking': {
        const k = Math.min(1, critter.t / 0.3)
        squirrel.position.y = -1.3 * CRITTER_SCALE * k
        pile.scale.set(1 - k * 0.999, 0.55 * (1 - k * 0.999), 1 - k * 0.999)
        if (k >= 1) this.resetCritter()
        break
      }
      case 'hit': {
        // Rückwärts in den Schnee plumpsen
        const k = Math.min(1, critter.t / 0.8)
        squirrel.rotation.x = -k * 1.5
        squirrel.position.y = Math.sin(k * Math.PI) * 0.35 - k * k * 1.2 * CRITTER_SCALE
        pile.scale.set(1 - k * 0.999, 0.55 * (1 - k * 0.999), 1 - k * 0.999)
        if (k >= 1) this.resetCritter()
        break
      }
    }
  }

  private resetCritter(): void {
    const critter = this.critter!
    critter.state = 'waiting'
    critter.t = 0
    critter.wait = 9 + Math.random() * 12
    critter.group.visible = false
    critter.squirrel.rotation.set(0, 0, 0)
  }

  /**
   * Lässt Rudolph und die fünf Rentiere aus dem Wimmelbild von Haus `day` auf der Wiese
   * gegenüber den Häusern umherstreifen – rechts, wenn man zum Baum schaut. Mit null verschwinden sie.
   */
  setMeadowReindeer(day: number | null): void {
    const plot = day === null ? undefined : this.layout.plots.find((p) => p.spec.day === day)
    if (!plot) {
      if (this.meadowHerd) this.meadowHerd.group.visible = false
      if (this.inspecting?.id.startsWith('meadow-reindeer')) this.stopInspecting()
      return
    }
    if (!this.meadowHerd) {
      // Etwas voraus: Wer vor Haus 16 zum Baum schaut, sieht sie rechts auf der Wiese grasen.
      const maxX = Math.min(plot.x + 40, this.layout.gateX - 3)
      this.meadowHerd = createMeadowHerd(this.solidMaterial, this.time, {
        minX: Math.max(plot.x + 14, this.layout.cameraMinX),
        maxX,
        minZ: MEADOW_NEAR_Z,
        maxZ: MEADOW_FAR_Z,
      })
      this.disposables.push(this.meadowHerd)
      this.scene.add(this.meadowHerd.group)
    }
    this.meadowHerd.group.visible = true
  }

  /** Das betrachtete Rentier der Herde bleibt stehen und schaut zur Kamera. */
  private holdMeadowReindeer(item: Inspectable | null): void {
    const prefix = 'meadow-reindeer-'
    this.meadowHerd?.hold(item?.id.startsWith(prefix) ? Number(item.id.slice(prefix.length)) : null)
  }

  /** Setzt das Rentier mittig in den Giebel von Haus `day` – oder nimmt es mit null wieder weg. */
  setGableReindeer(day: number | null): void {
    if (day === null) {
      if (this.reindeer) void this.reindeerShow.animate(0, 0.4, easeIn)
      return
    }
    if (!this.reindeer || this.reindeer.day !== day) {
      if (!this.reindeer) {
        const geometry = buildGableReindeer()
        const halo = createGlowMaterial(this.time, { halo: true })
        const group = new THREE.Group()
        group.add(new THREE.Mesh(geometry.solid, this.solidMaterial), new THREE.Mesh(geometry.halo, halo))
        this.disposables.push(geometry.solid, geometry.halo, halo)
        this.reindeer = { group, day }
      }
      this.reindeer.day = day
      this.stop(day).group.add(this.reindeer.group)
    }
    if (!this.statesApplied) this.reindeerShow.set(1)
    else void this.reindeerShow.animate(1, 0.9, easeOutBack, 0.5)
    this.updateReindeer(0)
  }

  /** Lässt hinter den Schaufenstern von Haus `day` Kuchen vorbeifahren – oder hält das Band mit null an. */
  setCakeConveyor(day: number | null): void {
    const windows = day === null ? undefined : this.showcases.get(day)
    if (!windows) {
      if (this.conveyor) this.conveyor.conveyor.group.visible = false
      return
    }
    if (this.conveyor?.stop.day !== day) {
      if (this.conveyor) {
        this.conveyor.stop.group.remove(this.conveyor.conveyor.group)
        this.conveyor.conveyor.dispose()
      }
      const conveyor = createCakeConveyor(windows)
      this.disposables.push(conveyor)
      const stop = this.stop(day!)
      stop.group.add(conveyor.group)
      this.conveyor = { conveyor, stop }
    }
    this.conveyor!.conveyor.group.visible = true
    this.conveyor!.conveyor.update(this.time.value)
  }

  /**
   * Stellt eine Staffelei mit dem Bild (SVG-Text) vor Haus `day` – zwischen die beiden
   * Fensterachsen ohne Tür. Mit null verschwindet sie wieder.
   */
  setEasel(day: number | null, svg: string | null = null): void {
    if (day === null || svg === null) {
      if (this.easel) this.easel.group.visible = false
      return
    }
    if (!this.easel) {
      const frame = buildEaselFrame()
      const picture = createPicture()
      const group = new THREE.Group()
      group.add(new THREE.Mesh(frame, this.solidMaterial), picture.mesh)
      this.disposables.push(frame, picture.mesh.geometry, picture.material)
      this.easel = { group, picture: picture.material, day, svg: null }
    }
    const easel = this.easel
    const plot = this.layout.plots.find((p) => p.spec.day === day)
    if (!plot) return
    if (easel.day !== day || !easel.group.parent) {
      const spec = plot.spec
      const free = Array.from({ length: spec.columns }, (_, c) => c).filter((c) => c !== spec.door.column)
      const x = free.length >= 2 ? (columnX(spec, free[0]) + columnX(spec, free[1])) / 2 : columnX(spec, free[0])
      // Etwas zur Seite der Tür abgewandt, damit sie Schneemann & Co. nicht verdeckt.
      const away = free.length >= 2 ? -0.16 : 0
      easel.group.position.set(x + away, 0, 1.2)
      easel.group.rotation.y = 0.12
      easel.group.scale.setScalar(1.3)
      this.stop(day).group.add(easel.group)
      easel.day = day
    }
    easel.group.visible = true
    if (easel.svg === svg) return
    easel.svg = svg
    loadSvgTexture(svg)
      .then((texture) => {
        if (this.disposed || easel.svg !== svg) {
          texture.dispose()
          return
        }
        easel.picture.map?.dispose()
        easel.picture.map = texture
        easel.picture.needsUpdate = true
      })
      .catch((error: unknown) => console.warn(error))
  }

  /** Zündet an allen Adventskränzen die ersten `count` Kerzen an (0–4). */
  setAdventCandles(count: number): void {
    for (const stop of this.stops) {
      stop.candles?.forEach((candle, index) => {
        candle.visible = index < count
      })
    }
  }

  /** Mondphase am Himmel: 0 = Neumond, 0,5 = Vollmond. */
  /** Easter Egg: der Mondstaub-Mann aus Haus 5 steht auf dem Mond. */
  setMoonSnowman(visible: boolean): void {
    this.moonSnowman = visible
    this.sky.setMoonSnowman(visible)
  }

  setMoonPhase(phase: number): void {
    this.sky.setMoonPhase(phase)
  }

    /** Zeigt ein Selfie (Data-URL) im Kranz von Haus oder Tor – oder entfernt es mit null. */
  setSelfie(day: number, dataUrl: string | null): void {
    const stop = this.stop(day)
    if (stop.photoUrl === dataUrl) return
    stop.photoUrl = dataUrl
    if (dataUrl === null) {
      if (stop.photo) {
        stop.group.remove(stop.photo)
        stop.photo.material.map?.dispose()
        stop.photo.material.dispose()
        stop.photo = null
      }
      return
    }
    loadPhotoTexture(dataUrl)
      .then((texture) => {
        if (this.disposed || stop.photoUrl !== dataUrl) {
          texture.dispose()
          return
        }
        if (stop.photo) {
          stop.photo.material.map?.dispose()
          stop.photo.material.map = texture
        } else {
          const material = new THREE.MeshBasicMaterial({ map: texture, color: '#f4eef6' })
          stop.photo = new THREE.Mesh(this.photoGeometry, material)
          const { x, y, z } = stop.photoAnchor
          stop.photo.position.set(x, y, z)
          stop.group.add(stop.photo)
        }
        stop.photoPop.set(0)
        void stop.photoPop.animate(1, 0.7, easeOutBack)
      })
      .catch(() => undefined)
  }

  /** 0 = ein paar Flocken, 1 = dichtes Schneetreiben. */
  setSnowAmount(amount: number): void {
    this.snowfall.setAmount(amount)
  }

  /** Hält die Darstellung an, solange die Straße nicht zu sehen ist (z. B. im Haus). */
  setPaused(paused: boolean): void {
    if (this.disposed || this.running === !paused) return
    this.running = !paused
    this.lastFrame = 0
    this.renderer.setAnimationLoop(paused ? null : this.frame)
  }

  /** Anzahl der Zeichenaufrufe im letzten Bild – zum Prüfen der Leistung. */
  get drawCalls(): number {
    return this.renderer.info.render.calls
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.easel?.picture.map?.dispose()
    this.running = false
    this.renderer.setAnimationLoop(null)
    for (const cleanup of this.cleanups) cleanup()
    for (const stop of this.stops) {
      stop.group.traverse((object) => {
        if (object instanceof THREE.Mesh && object.geometry !== this.photoGeometry) object.geometry.dispose()
      })
      for (const material of stop.materials) material.dispose()
      stop.photo?.material.map?.dispose()
      stop.photo?.material.dispose()
    }
    for (const item of this.disposables) item.dispose()
    this.photoGeometry.dispose()
    this.solidMaterial.dispose()
    this.renderer.dispose()
  }

  // ------------------------------------------------------------ Schleife

  private resize(): void {
    const width = this.canvas.clientWidth
    const height = this.canvas.clientHeight
    if (width === 0 || height === 0) return
    this.width = width
    this.height = height
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.sky.setPixelRatio(this.pixelRatio)
  }

  private readonly frame = (now: number): void => {
    const dt = this.lastFrame === 0 ? 1 / 60 : Math.min((now - this.lastFrame) / 1000, 0.1)
    this.lastFrame = now
    this.time.value += dt

    this.updateCamera(dt)
    this.updateDoors()
    this.updateStops(dt)
    this.updateMarker()
    this.updateElf(dt)
    this.updateCritter(dt)
    this.updateReindeer(dt)
    if (this.meadowHerd?.group.visible) this.meadowHerd.update(dt)
    this.updateFlyby(dt)
    this.updateBalconyCat()
    if (this.conveyor?.conveyor.group.visible) this.conveyor.conveyor.update(this.time.value)
    if (this.skiHalfpipe?.group.visible) this.skiHalfpipe.update(this.time.value)
    if (this.fireplace?.window.group.visible) this.fireplace.window.update(this.time.value)
    if (this.gluehweinStand?.group.visible) this.gluehweinStand.update(this.time.value)
    this.hoopShot?.update(dt)
    this.updateLightsReveal(dt)
    this.updatePresentDrop(dt)
    if (this.santaWindows?.windows.group.visible) this.santaWindows.windows.update(this.time.value)

    const pixelsPerUnit =
      (this.height * this.pixelRatio) /
      (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)))
    this.fireplace?.flames?.update(pixelsPerUnit)
    this.sky.follow(this.camera, this.time.value)
    this.updateFlashLight()
    this.snowfall.update(this.camera, pixelsPerUnit, this.pixelRatio)
    this.smoke.update(pixelsPerUnit)

    this.renderer.render(this.scene, this.camera)
    this.watchPerformance(dt)
  }

  private updateCamera(dt: number): void {
    if (this.panTween.moving) {
      this.panTween.update(dt)
      this.panX = this.panTween.value
    } else if (Math.abs(this.velocity) > 0.02) {
      this.panX += this.velocity * dt
      this.velocity *= Math.exp(-dt * 4.2)
    }
    const clamped = this.clampPan(this.panX)
    if (clamped !== this.panX) {
      this.panX = clamped
      this.velocity = 0
    }

    this.turn.update(dt)
    this.focus.update(dt)
    this.enter.update(dt)
    this.doorOpen.update(dt)
    this.gateSwing.update(dt)

    const { entrance, entranceTarget } = this
    const follow = 1 - Math.exp(-dt * 7)
    entrance.center.lerp(entranceTarget.center, follow)
    entrance.normal.lerp(entranceTarget.normal, follow).normalize()
    entrance.width += (entranceTarget.width - entrance.width) * follow
    entrance.height += (entranceTarget.height - entrance.height) * follow

    computePose(
      {
        x: this.panX,
        turn: this.turn.value,
        focus: this.focus.value,
        enter: this.enter.value,
        entrance,
        aspect: this.camera.aspect,
        end: this.streetEnd,
      },
      this.pose,
    )
    this.inspectBlend.update(dt)
    const blend = this.inspectBlend.value
    if (blend > 0 && this.inspecting) {
      // Zwischen Straßenansicht und Nahaufnahme überblenden.
      this.inspecting.view(this.inspectView)
      if (this.inspecting.throughGap) {
        // Nur wo vor der Lücke wirklich eine Laterne steht, fährt die Kamera an ihr vorbei.
        const gapX = this.inspectView.position.x
        const lantern = this.lanternXs.some((x) => Math.abs(x - gapX) < 0.9)
        approachThroughGap(this.pose, this.inspectView, blend, lantern)
      } else {
        this.pose.position.lerp(this.inspectView.position, blend)
        this.pose.target.lerp(this.inspectView.target, blend)
        this.pose.fov += (this.inspectView.fov - this.pose.fov) * blend
      }
    }
    this.camera.position.copy(this.pose.position)
    this.camera.fov = this.pose.fov
    this.camera.near = this.inspecting?.throughGap ? THREE.MathUtils.lerp(CAMERA_NEAR, GAP_NEAR, blend) : CAMERA_NEAR
    this.camera.lookAt(this.pose.target)
    this.camera.updateProjectionMatrix()

    const place = this.findPlace()
    if (place !== this.place) {
      this.place = place
      this.options.onPlaceChange(place)
    }
  }

  /** Besuchte Häuser behalten offene Türen und Licht; das Tor folgt seiner eigenen Freischaltung. */
  private updateDoors(): void {
    const entering = this.enteringStop
    const opening = entering ? this.doorOpen.value : 0
    this.doorFlare.uniforms.uPower.value = Math.max(opening, entering?.heldDoor.value ?? 0)
    for (const stop of this.stops) {
      const held = stop === this.gate ? this.gateSwing.value : stop.heldDoor.value
      const amount = Math.max(held, stop === entering ? opening : 0)
      for (const door of stop.doors) {
        door.pivot.rotation.y = amount * door.swing
        // Das Licht aus dem Flur fällt auf die Innenseite der aufschwingenden Tür.
        if (door.shine) door.shine.opacity = Math.min(1, amount * 1.15) * 0.8
      }
      if (stop.entranceLight) {
        // Beim Betreten übernimmt der gemeinsame Effekt, damit sich das Licht nicht verdoppelt.
        stop.entranceLight.group.visible = amount > 0 && stop !== entering
        stop.entranceLight.flare.uniforms.uPower.value = amount
      }
    }
  }

  /** Der Ort, an dem die Kamera steht: der nächstgelegene Tag – oder der Platz mit dem Baum. */
  private findPlace(): number {
    // Hinter dem Tor gehört der Standort zu keinem Tag mehr.
    if (this.panX > (this.gate.panX() + treeStopX(this.streetEnd)) / 2) return TREE_PLACE
    let nearest = this.stops[0]
    let shortest = Infinity
    for (const stop of this.stops) {
      const distance = Math.abs(stop.panX() - this.panX)
      if (distance < shortest) {
        nearest = stop
        shortest = distance
      }
    }
    return nearest.day
  }

  private updateStops(dt: number): void {
    for (const stop of this.stops) {
      stop.heldDoor.update(dt)
      stop.power.update(dt)
      if (stop.power.value !== stop.appliedPower) {
        stop.appliedPower = stop.power.value
        for (const material of stop.materials) material.uniforms.uPower.value = stop.power.value
        if (stop.chimney !== null) this.smoke.setStrength(stop.chimney, stop.power.value)
      }
      if (stop.photo) {
        stop.photoPop.update(dt)
        // Hinter einer Haustür ist das Selfie nur zu sehen, solange sie offen steht.
        stop.photo.visible = !stop.opaqueDoor || stop.heldDoor.value > 0.5
        stop.photo.scale.setScalar(Math.max(stop.photoPop.value * stop.photoScale, 0.001))
      }
    }
  }

  /** Lugt hervor, zieht ab und zu blitzschnell den Kopf ein – und schaut dann wieder. */
  private updateElf(dt: number): void {
    const elf = this.elf
    if (!elf) return
    this.elfShow.update(dt)
    const shown = this.elfShow.value
    elf.mesh.visible = shown > 0.001
    if (!elf.mesh.visible) return
    const cycle = (this.time.value % 7) / 7
    // 0 = ganz draußen, 1 = hinter der Ecke versteckt
    const duck = cycle < 0.78 ? 0 : cycle < 0.82 ? (cycle - 0.78) / 0.04 : cycle < 0.92 ? 1 : 1 - (cycle - 0.92) / 0.08
    const scale = elf.mesh.scale.x
    elf.mesh.position.x = elf.cornerX - (1 - shown + duck * 0.9) * 0.45 * scale
    elf.mesh.rotation.z = Math.sin(this.time.value * 1.3) * 0.06 - 0.08
  }

  /** Mittig im Giebel, an der Stelle des Kranzes – das Selfie steht ja unten in der Tür. */
  private updateReindeer(dt: number): void {
    const reindeer = this.reindeer
    if (!reindeer) return
    this.reindeerShow.update(dt)
    const shown = this.reindeerShow.value
    reindeer.group.visible = shown > 0.001
    if (!reindeer.group.visible) return
    const { x, y } = this.stop(reindeer.day).wreathAnchor
    const scale = 1.4
    reindeer.group.position.set(x, y, 0.08)
    reindeer.group.scale.setScalar(Math.max(shown, 0.001) * scale)
    reindeer.group.rotation.z = Math.sin(this.time.value * 0.9) * 0.07
  }

  private updateMarker(): void {
    const stop = this.markedStop
    this.marker.visible = stop !== null && this.enter.value === 0
    if (!stop) return
    const time = this.time.value
    this.marker.position.copy(stop.marker)
    this.marker.position.y += Math.sin(time * 2) * 0.14
    this.marker.scale.setScalar(2 + Math.sin(time * 3.1) * 0.16)
  }

  /** Ruckelt es dauerhaft, wird die Auflösung etwas gesenkt. */
  private watchPerformance(dt: number): void {
    const stats = this.slowFrames
    if (stats.warmup > 0) {
      stats.warmup -= 1
      return
    }
    stats.time += dt
    stats.count += 1
    if (stats.count < 90) return
    const average = stats.time / stats.count
    stats.time = 0
    stats.count = 0
    if (average > 1 / 42 && this.pixelRatio > 1.5) {
      this.pixelRatio = Math.max(1.5, this.pixelRatio - 0.25)
      this.renderer.setPixelRatio(this.pixelRatio)
      this.resize()
      stats.warmup = 30
    }
  }
}
