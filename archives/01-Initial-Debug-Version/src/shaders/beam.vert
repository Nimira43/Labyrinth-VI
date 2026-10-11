// The exit: a column of light falling through a gap in Level 3's ceiling.

varying vec3 vWorld;
varying vec3 vNormal;
varying float vHeight; // 0 at the floor, 1 at the top of the beam

uniform float uBeamHeight;

void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vHeight = position.y / uBeamHeight + 0.5;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
