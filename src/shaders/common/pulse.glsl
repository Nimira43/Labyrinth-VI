// Each level has its own "life rhythm". Returns roughly 0..1.
//   Level 1: slow, cold breathing
//   Level 2: uneasy, irregular churn (two out-of-sync rhythms fighting)
//   Level 3: a heartbeat, lub-dub, rippling through the walls

float heartbeat(float t, float bpm) {
  float p = fract(t * bpm / 60.0);
  float lub = exp(-pow((p - 0.06) * 18.0, 2.0));
  float dub = 0.65 * exp(-pow((p - 0.30) * 18.0, 2.0));
  return lub + dub;
}

float levelPulse(float t, float level, vec3 wp) {
  int L = int(level + 0.5);

  if (L == 0) {
    return 0.5 + 0.5 * sin(t * 0.8 + wp.x * 0.12 + wp.z * 0.08);
  }

  if (L == 1) {
    float a = sin(t * 1.3 + wp.x * 0.35);
    float b = sin(t * 2.17 - wp.z * 0.28 + 1.7);
    float churn = 0.5 + 0.25 * (a + b);
    return churn * churn;
  }

  // Level 3: the beat travels outward from the centre of the maze.
  float delay = length(wp.xz) * 0.025;
  return heartbeat(t - delay, 68.0);
}
