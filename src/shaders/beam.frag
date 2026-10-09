// Shimmering light: soft at the edges, motes drifting down through it.
// The only warm, clean colour in the whole labyrinth, so it should feel like hope.

#include ./common/noise.glsl;

uniform float uTime;
uniform vec3 uCameraPos;

varying vec3 vWorld;
varying vec3 vNormal;
varying float vHeight;

void main() {
  vec3 viewDir = normalize(uCameraPos - vWorld);
  float facing = abs(dot(normalize(vNormal), viewDir));

  // Brightest through the middle of the column, fading out at its silhouette.
  float core = pow(facing, 2.5);

  // Shimmer: bands of noise sliding downward.
  float shimmer = snoise(vec3(vWorld.x * 1.5, vWorld.y * 0.6 + uTime * 0.9, vWorld.z * 1.5)) * 0.5 + 0.5;
  float motes = smoothstep(0.82, 0.95, snoise(vWorld * 3.0 + vec3(0.0, uTime * 1.4, 0.0)));

  // Fade at the floor and at the top.
  float ends = smoothstep(0.0, 0.08, vHeight) * smoothstep(1.0, 0.6, vHeight);

  float flicker = 0.9 + 0.1 * sin(uTime * 7.3) * sin(uTime * 3.1);
  float a = (0.18 + 0.45 * core * (0.6 + 0.4 * shimmer) + motes * 0.6) * ends * flicker;

  vec3 col = mix(vec3(1.0, 0.86, 0.62), vec3(1.0, 0.98, 0.92), core);
  gl_FragColor = vec4(col * a, a);
  #include <colorspace_fragment>
}
