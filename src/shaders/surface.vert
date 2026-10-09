// Shared vertex shader for walls and floors.
// Walls "breathe": their large faces bulge outward in time with the level's pulse.
// The bulge fades to zero at each panel's edges, so panels stay sealed to each other.

#include ./common/pulse.glsl;

uniform float uTime;
uniform float uLevel;
uniform float uBreath;      // bulge strength in world units (0 = flat)
uniform vec2 uPanelSize;    // local half-extents (x, y) of a wall panel face

varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vLocal;

void main() {
  vec3 pos = position;

  #ifdef USE_INSTANCING
    mat4 world = modelMatrix * instanceMatrix;
  #else
    mat4 world = modelMatrix;
  #endif

  // Bulge only the two big faces (normal along local z).
  if (uBreath > 0.0 && abs(normal.z) > 0.5) {
    vec2 edge = 1.0 - abs(position.xy / uPanelSize);
    float mask = smoothstep(0.0, 0.35, edge.x) * smoothstep(0.0, 0.35, edge.y);
    vec3 wp = (world * vec4(position, 1.0)).xyz;
    float pulse = levelPulse(uTime, uLevel, wp);
    pos += normal * mask * pulse * uBreath;
  }

  vec4 worldPos = world * vec4(pos, 1.0);
  vWorld = worldPos.xyz;
  vNormal = normalize(mat3(world) * normal);
  vLocal = position;

  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
