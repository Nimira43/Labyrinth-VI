// Shared fragment shader for walls (uSurface = 0) and floors (uSurface = 1).
// Everything is procedural: no textures, just noise, veins and a pulse per level.

#include ./common/noise.glsl;
#include ./common/pulse.glsl;

uniform float uTime;
uniform float uLevel;
uniform float uSurface;
uniform vec2 uPanelSize;
uniform vec3 uCameraPos;
uniform float uFogDensity;  // 0 in the debug view; the game will close it in tight
uniform float uTorch;       // 0 = overhead debug light, 1 = light carried by the player

varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vLocal;

struct Palette {
  vec3 base;
  vec3 vein;
  float veinScale;
  float flow;
};

Palette levelPalette(int L, vec3 p, float t) {
  Palette pal;

  if (L == 0) {
    // Cold blue: drowned stone, faint cyan veins.
    pal.base = vec3(0.008, 0.016, 0.045);
    pal.vein = vec3(0.20, 0.42, 0.95);
    pal.veinScale = 0.55;
    pal.flow = 0.04;
  } else if (L == 1) {
    // Dark green and mustard yellow, slowly bleeding into each other.
    float blend = smoothstep(-0.35, 0.45, snoise(p * 0.18 + vec3(0.0, t * 0.05, 0.0)));
    pal.base = mix(vec3(0.012, 0.030, 0.006), vec3(0.090, 0.068, 0.006), blend);
    pal.vein = mix(vec3(0.38, 0.58, 0.07), vec3(0.88, 0.66, 0.10), blend);
    pal.veinScale = 0.75;
    pal.flow = 0.09;
  } else {
    // Deep, rich blood red.
    pal.base = vec3(0.060, 0.002, 0.005);
    pal.vein = vec3(0.90, 0.025, 0.045);
    pal.veinScale = 0.9;
    pal.flow = 0.06;
  }
  return pal;
}

void main() {
  int L = int(uLevel + 0.5);
  vec3 p = vWorld;
  vec3 n = normalize(vNormal);
  float t = uTime;

  Palette pal = levelPalette(L, p, t);
  float pulse = levelPulse(t, uLevel, p);

  // Grime and stains: large blotches plus fine grit.
  float grime = fbm(p * 0.45) * 0.5 + 0.5;
  float grit = snoise(p * 6.0) * 0.5 + 0.5;
  vec3 col = pal.base * (0.65 + 0.7 * grime) * (0.85 + 0.3 * grit);

  // Veins: two layers of ridged noise drifting slowly through the surface.
  vec3 vp = p * pal.veinScale + vec3(0.0, t * pal.flow, t * pal.flow * 0.5);
  float v = veins(vp) * 0.85 + veins(vp * 2.3 + 11.0) * 0.4;
  v = smoothstep(0.25, 0.95, v);          // keep only the strongest threads
  v *= smoothstep(0.35, 0.75, grime);     // veins gather in patches, leaving dead stone between
  if (uSurface > 0.5) {
    v *= 0.3;                             // floors: faint veins
    col *= 0.45;                          // and darker than walls, so corridors read clearly
  }

  // Lighting.
  float light;
  if (uTorch > 0.5) {
    vec3 toCam = uCameraPos - p;
    float d = length(toCam);
    float lambert = max(dot(n, toCam / d), 0.0);
    light = (0.15 + 0.85 * lambert) / (1.0 + d * d * 0.06);
  } else {
    vec3 sun = normalize(vec3(0.4, 1.0, 0.3));
    light = 0.45 + 0.55 * max(dot(n, sun), 0.0);
  }

  // Walls darken toward the floor (cheap ambient occlusion).
  if (uSurface < 0.5) {
    float h = (vLocal.y + uPanelSize.y) / (2.0 * uPanelSize.y);
    light *= mix(0.35, 1.0, smoothstep(0.0, 0.35, h));
  }

  col *= light;

  // Veins glow on their own: they are alive, not lit.
  col += pal.vein * v * (0.06 + 0.95 * pulse);

  // Level 3: wet sheen that catches the heartbeat.
  if (L == 2) {
    float wet = smoothstep(0.55, 0.9, snoise(p * 0.9 + vec3(0.0, -t * 0.08, 0.0)) * 0.5 + 0.5);
    col += vec3(0.25, 0.01, 0.02) * wet * pulse * 0.35;
  }

  // Fog toward black.
  float dist = length(uCameraPos - p);
  float fog = 1.0 - exp(-pow(dist * uFogDensity, 2.0));
  col = mix(col, vec3(0.0), clamp(fog, 0.0, 1.0));

  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
