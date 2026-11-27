import * as THREE from 'three'
import { ROAD_CENTER_Z, STREET_LANTERN_Z, TREE_Z } from './world.ts'

const { clamp, lerp, smoothstep, degToRad } = THREE.MathUtils

/** Öffnungswinkel der Kamera beim Blick auf die Fassaden. */
export const FRONT_FOV = 38
/** Beim Blick die Straße entlang ist der Winkel weiter – so passt mehr Straße ins Bild. */
const TURN_FOV = 56

/** So viel Straße soll mindestens zu sehen sein (im Hochformat rund anderthalb Häuser). */
const MIN_VISIBLE_WIDTH = 7.4
const MIN_VISIBLE_HEIGHT = 13.2

/** Beim Blick die Straße entlang steht die Kamera ein Stück hinter ihrem Standort. */
const CAMERA_LEAD = 3.5
/** Vor dem Tor soll es samt einem Stück Hecke ins Bild passen. */
const GATE_VIEW_WIDTH = 8.6
/** So nah kommt die Kamera dem Weihnachtsbaum – sie steht dann schon hinter dem Tor. */
const TREE_VIEW_DISTANCE = 11.5

const TAN_HALF_FOV = Math.tan(degToRad(FRONT_FOV / 2))

export interface Pose {
  position: THREE.Vector3
  target: THREE.Vector3
  fov: number
}

/** Ein Eingang, den die Kamera anfliegen kann: eine Haustür oder das Tor. */
export interface Entrance {
  /** Mitte der Schwelle, am Boden. */
  center: THREE.Vector3
  /** Waagerechte Richtung, in die der Eingang zeigt (Länge 1). */
  normal: THREE.Vector3
  /** Breite und Höhe, die beim Anflug mindestens zu sehen sein sollen. */
  width: number
  height: number
  /**
   * Durch diesen Eingang sieht man hindurch (das Tor). Die Kamera bleibt dann
   * auf seiner Achse, damit das Dahinter – der Baum – in der Öffnung steht.
   */
  through?: boolean
}

/** Das Ende der Straße: Hinter dem letzten Haus steht das Tor, dahinter der Weihnachtsbaum. */
export interface StreetEnd {
  /** Standort vor dem letzten Haus. Ab hier dreht sich die Kamera von selbst zum Tor. */
  lastHouseX: number
  gateX: number
  treeX: number
}

export interface RigInput {
  /** Standort entlang der Straße. */
  x: number
  /** −1 = Blick zurück zum Anfang der Straße, 0 = geradeaus, 1 = Blick zum Weihnachtsbaum. */
  turn: number
  /** 0 … 1: Anflug auf den Eingang. */
  focus: number
  /** 0 … 1: Fahrt durch den geöffneten Eingang. */
  enter: number
  entrance: Entrance
  /** Breite durch Höhe des Bildes. */
  aspect: number
  end: StreetEnd
}

export function createPose(): Pose {
  return { position: new THREE.Vector3(), target: new THREE.Vector3(), fov: FRONT_FOV }
}

/** Von der Straße an der Laterne vorbei und mittig durch die Häuserlücke fahren. */
export function approachThroughGap(pose: Pose, destination: Pose, amount: number): void {
  const { position } = pose
  const end = destination.position
  const z = lerp(position.z, end.z, amount)
  const bendZ = STREET_LANTERN_Z - 0.45
  const side = position.x > end.x ? 1 : -1
  const approach = 1 - smoothstep(z, bendZ, position.z)
  const enter = 1 - smoothstep(z, 0.5, bendZ)
  const besideLantern = lerp(position.x, end.x + side * 0.72, approach)
  position.set(lerp(besideLantern, end.x, enter), lerp(position.y, end.y, approach), z)
  pose.target.lerp(destination.target, lerp(amount, 1, enter))
  pose.fov = lerp(pose.fov, destination.fov, amount)
}

/** 0 im Hochformat, 1 im Querformat, dazwischen fließend. */
function landscapeness(aspect: number): number {
  return clamp((aspect - 0.6) / 0.8, 0, 1)
}

/** Abstand der Kamera von den Fassaden beim Blick von vorn. */
export function frontDistance(aspect: number): number {
  return Math.max(
    MIN_VISIBLE_WIDTH / (2 * TAN_HALF_FOV * aspect),
    MIN_VISIBLE_HEIGHT / (2 * TAN_HALF_FOV),
  )
}

/** Wie viele Meter Fassade beim Blick von vorn nebeneinander ins Bild passen. */
export function visibleWidth(aspect: number): number {
  return 2 * frontDistance(aspect) * TAN_HALF_FOV * aspect
}

/** Öffnungswinkel beim Blick die Straße entlang (im Hochformat enger – weniger leere Straße). */
function alongFov(aspect: number): number {
  return lerp(TURN_FOV - 8, TURN_FOV, landscapeness(aspect))
}

/** Abstand vor dem Tor, aus dem es ganz ins Bild passt. */
export function gateDistance(aspect: number): number {
  const tanHalf = Math.tan(degToRad(alongFov(aspect) / 2))
  return clamp(GATE_VIEW_WIDTH / (2 * tanHalf * aspect), 12.5, 19)
}

/** Standort, an dem die Kamera vor dem Tor steht. */
export function gateStopX(aspect: number, end: StreetEnd): number {
  return end.gateX - gateDistance(aspect) + CAMERA_LEAD
}

/** Standort hinter dem Tor, an dem die Kamera vor dem Weihnachtsbaum steht. */
export function treeStopX(end: StreetEnd): number {
  return end.treeX - TREE_VIEW_DISTANCE + CAMERA_LEAD
}

/** Wie weit die Kamera gehen darf: bis vors Tor – oder, wenn es offen steht, bis zum Weihnachtsbaum. */
export function maxPanX(aspect: number, end: StreetEnd, gateOpen: boolean): number {
  return gateOpen ? treeStopX(end) : gateStopX(aspect, end)
}

/**
 * Am Ende der Häuserzeile dreht sich die Kamera von selbst die Straße entlang,
 * bis sie vor dem Tor steht. 0 = noch bei den Häusern, 1 = ganz dem Tor zugewandt.
 */
export function endTurn(x: number, aspect: number, end: StreetEnd): number {
  return smoothstep(x, end.lastHouseX, gateStopX(aspect, end))
}

function frontPose(x: number, aspect: number, out: Pose): void {
  const distance = frontDistance(aspect)
  const visibleHeight = 2 * distance * TAN_HALF_FOV
  // Anteil der Bildhöhe, der unterhalb der Hauskante für die Straße bleibt.
  const street = lerp(0.25, 0.15, landscapeness(aspect))
  const lookY = visibleHeight * (0.5 - street)
  out.position.set(x, lookY + distance * 0.085, distance)
  out.target.set(x, lookY, 0)
  out.fov = FRONT_FOV
}

/** Mitten auf der Fahrbahn stehen und die Straße entlangschauen. */
function alongPose(x: number, direction: number, aspect: number, end: StreetEnd, out: Pose): void {
  // Im Hochformat rückt die Kamera näher an die Häuser und schaut etwas höher – weniger leere Straße.
  const wide = landscapeness(aspect)
  const stop = end.treeX - TREE_VIEW_DISTANCE
  const cameraX = clamp(x - direction * CAMERA_LEAD, -10, stop)
  out.position.set(cameraX, 2.1, ROAD_CENTER_Z + lerp(-0.7, 0.1, wide))
  out.target.set(cameraX + direction * 44, lerp(7.2, 4.4, wide), lerp(1.8, 2.4, wide))
  out.fov = alongFov(aspect)
  if (direction < 0) return

  // Am Ende der Straße rückt die Kamera in die Straßenmitte und nimmt Tor und Baum ins Visier.
  const closeness = 1 - smoothstep(end.treeX - cameraX, 30, 62)
  out.position.z = lerp(out.position.z, ROAD_CENTER_Z, closeness)
  out.target.x = lerp(out.target.x, end.treeX, closeness)
  out.target.y = lerp(out.target.y, 5.2, closeness)
  out.target.z = lerp(out.target.z, TREE_Z, closeness)
  // Hinter dem Tor weitet sich der Blick, bis der Baum von den Geschenken bis zum Stern im Bild
  // steht – im Hochformat stärker, damit er zwischen Titel und Leiste Platz findet.
  const arrival = smoothstep(cameraX, end.gateX - 4, stop)
  out.target.y = lerp(out.target.y, lerp(5.2, 4.9, wide), arrival)
  out.fov = lerp(out.fov, lerp(66, 58, wide), arrival)
}

const right = new THREE.Vector3()

/** Nah vor dem Eingang; im Hochformat bleibt unten Platz für die Karte, im Querformat rechts. */
function entrancePose(entrance: Entrance, aspect: number, out: Pose): void {
  const distance = Math.max(
    entrance.width / (2 * TAN_HALF_FOV * aspect),
    entrance.height / (2 * TAN_HALF_FOV),
  )
  const visibleHeight = 2 * distance * TAN_HALF_FOV
  const wide = landscapeness(aspect)
  const lookY = visibleHeight * (0.5 - lerp(0.42, 0.2, wide))
  // „Rechts“ aus Sicht der Kamera, die auf den Eingang schaut.
  right.set(entrance.normal.z, 0, -entrance.normal.x)
  out.target.copy(entrance.center).addScaledVector(right, wide * visibleHeight * aspect * 0.17)
  out.target.y = lookY
  // Vor einer Fassade rückt die Kamera mit zur Seite; vor dem Tor schwenkt sie nur den Blick.
  out.position.copy(entrance.through ? entrance.center : out.target)
  out.position.addScaledVector(entrance.normal, distance)
  out.position.y = lookY + distance * 0.05
  out.fov = FRONT_FOV
}

/** Unmittelbar vor der Schwelle, den Blick ins Innere gerichtet. */
function thresholdPose(entrance: Entrance, out: Pose): void {
  out.position.copy(entrance.center).addScaledVector(entrance.normal, 1.45)
  out.position.y = 1.3
  out.target.copy(entrance.center).addScaledVector(entrance.normal, -3)
  out.target.y = 1.25
  out.fov = FRONT_FOV
}

function blend(out: Pose, to: Pose, amount: number): void {
  out.position.lerp(to.position, amount)
  out.target.lerp(to.target, amount)
  out.fov = lerp(out.fov, to.fov, amount)
}

/** Blickrichtung um die Hochachse: 0 = auf die Häuser, +90° = zum Baum, −90° = zum Anfang der Straße. */
function yawOf(pose: Pose): number {
  return Math.atan2(pose.target.x - pose.position.x, pose.position.z - pose.target.z)
}

function pitchOf(pose: Pose): number {
  const across = Math.hypot(pose.target.x - pose.position.x, pose.target.z - pose.position.z)
  return Math.atan2(pose.target.y - pose.position.y, across)
}

/**
 * Wie `blend`, aber der Blick schwenkt gleichmäßig um die Hochachse – über die
 * Häuserseite hinweg. So gelingt auch die Kehrtwende vor dem Tor, ohne dass
 * die Kamera dabei in den Himmel kippt.
 */
function swing(out: Pose, to: Pose, amount: number): void {
  const yaw = lerp(yawOf(out), yawOf(to), amount)
  const pitch = lerp(pitchOf(out), pitchOf(to), amount)
  const reach = lerp(out.position.distanceTo(out.target), to.position.distanceTo(to.target), amount)
  const across = Math.cos(pitch) * reach
  out.position.lerp(to.position, amount)
  out.target.set(Math.sin(yaw) * across, Math.sin(pitch) * reach, -Math.cos(yaw) * across)
  out.target.add(out.position)
  out.fov = lerp(out.fov, to.fov, amount)
}

const scratch = createPose()

/** Berechnet Standort, Blickziel und Öffnungswinkel der Kamera aus dem Zustand der Szene. */
export function computePose(input: RigInput, out: Pose): Pose {
  const { x, aspect, end } = input
  frontPose(x, aspect, out)

  // Nach vorn schaut die Kamera, wenn der Besucher es so will – oder weil die Häuser zu Ende sind.
  const turned = smoothstep(Math.abs(input.turn), 0, 1)
  const ending = endTurn(x, aspect, end)
  const ahead = input.turn > 0 ? ending + turned - ending * turned : ending
  if (ahead > 0) {
    alongPose(x, 1, aspect, end, scratch)
    swing(out, scratch, ahead)
  }
  if (input.turn < 0) {
    alongPose(x, -1, aspect, end, scratch)
    swing(out, scratch, turned)
  }
  if (input.focus > 0) {
    entrancePose(input.entrance, aspect, scratch)
    blend(out, scratch, input.focus)
  }
  if (input.enter > 0) {
    thresholdPose(input.entrance, scratch)
    blend(out, scratch, input.enter)
  }
  return out
}
