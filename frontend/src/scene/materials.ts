import * as THREE from 'three'
import { DARK_GLASS } from './palette.ts'

export type TimeUniform = THREE.IUniform<number>

/** Alle Lichterketten an bzw. aus (Grenze ganz rechts bzw. ganz links). */
export const STRINGS_ON = 1e9
export const STRINGS_OFF = -1e9

/**
 * Schalter für alle Lichterketten an Häusern und Bäumen – gemeinsam für jedes Leuchtmaterial.
 * Der Wert ist eine Grenze entlang der Straße (Welt-x): Lämpchen links davon leuchten. So können
 * die Ketten nach dem Lichterketten-Schlamassel (Haus 3) Haus für Haus angehen.
 */
export const STRING_LIGHTS: THREE.IUniform<number> = { value: STRINGS_ON }

const GLOW_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uPower;
uniform float uDim;
uniform vec3 uGlassOff;
uniform float uStrings;
attribute vec3 aGlow;
attribute float aString;
attribute vec2 aSize;
varying vec3 vColor;
#ifdef HALO
  varying vec2 vUv;
#endif
#include <fog_pars_vertex>

void main() {
  // Ausgeschaltet: Lichterketten verschwinden ganz, Laternen glimmen nur schwach.
  bool off = aString > 0.5 && (modelMatrix * vec4(position, 1.0)).x > uStrings;
  bool hide = off && aString < 1.5;
  if (hide) {
    vColor = vec3(0.0);
    #ifdef HALO
      vUv = vec2(0.5);
    #endif
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    return;
  }
  float speed = 1.3 + fract(aGlow.x * 0.731) * 2.4;
  float wave = 0.5 + 0.5 * sin(uTime * speed + aGlow.x);
  vec3 lit = color * (1.0 - aGlow.y * wave);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  // Gedimmte Laterne: Glas und Lichtschein nur zu einem Bruchteil.
  float dimmed = off ? 0.28 : 1.0;
  #ifdef HALO
    vColor = lit * mix(mix(uDim, 1.0, uPower), uPower, aGlow.z) * dimmed * dimmed;
    vUv = uv;
    // Billboards: zur Kamera aufspannen und ein Stück vorziehen, damit Wände sie nicht anschneiden.
    mvPosition.xy += (uv - 0.5) * aSize;
    mvPosition.z += min(aSize.x, 1.0) * 0.6;
  #else
    vec3 asleep = mix(color * uDim, uGlassOff, aGlow.z);
    vColor = mix(asleep, lit, uPower) * dimmed;
  #endif
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`

const GLOW_FRAGMENT = /* glsl */ `
uniform float uFogAmount;
varying vec3 vColor;
#ifdef HALO
  varying vec2 vUv;
#endif
#include <fog_pars_fragment>

void main() {
  gl_FragColor = linearToOutputTexel(vec4(vColor, 1.0));
  #ifdef HALO
    float falloff = max(0.0, 1.0 - length(vUv - 0.5) * 2.0);
    gl_FragColor.rgb *= falloff * falloff;
  #endif
  #ifdef USE_FOG
    #ifdef FOG_EXP2
      float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
    #else
      float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
    #endif
    fogFactor *= uFogAmount;
    #ifdef HALO
      gl_FragColor.rgb *= 1.0 - fogFactor;
    #else
      gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
    #endif
  #endif
}
`

export interface GlowMaterialOptions {
  /** Lichthof: weich auslaufend und additiv statt deckend. */
  halo?: boolean
  /** Wie stark Nebel das Licht schluckt (0 = leuchtet durch den Nebel). */
  fogAmount?: number
  /** Helligkeit der Lichterketten, solange ein Haus noch schläft. */
  dim?: number
}

/**
 * Selbstleuchtendes Material für Fenster, Lämpchen und Lichthöfe.
 * `uPower` blendet ein Haus zwischen „schläft“ (0) und „wach“ (1) über.
 */
export function createGlowMaterial(
  time: TimeUniform,
  options: GlowMaterialOptions = {},
): THREE.ShaderMaterial {
  const halo = options.halo ?? false
  return new THREE.ShaderMaterial({
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uTime: time,
      uStrings: STRING_LIGHTS,
      uPower: { value: 1 },
      uDim: { value: options.dim ?? 0.42 },
      uGlassOff: { value: new THREE.Color(DARK_GLASS) },
      uFogAmount: { value: options.fogAmount ?? 1 },
    },
    defines: halo ? { HALO: '' } : {},
    vertexShader: GLOW_VERTEX,
    fragmentShader: GLOW_FRAGMENT,
    vertexColors: true,
    fog: true,
    ...(halo
      ? { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }
      : {}),
  })
}

/** Beleuchtetes Standardmaterial – alle Farben stecken in den Eckpunkten. */
export function createSolidMaterial(): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ vertexColors: true })
}

/**
 * Additive Materialien sollen im Nebel verblassen statt die Nebelfarbe
 * aufzuaddieren (sonst würden ferne Lichter zu hellen Flecken).
 */
export function fadeInFog<T extends THREE.Material>(material: T): T {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <fog_fragment>',
      /* glsl */ `
      #ifdef USE_FOG
        #ifdef FOG_EXP2
          float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
        #else
          float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
        #endif
        gl_FragColor.rgb *= 1.0 - fogFactor;
      #endif
      `,
    )
  }
  return material
}
