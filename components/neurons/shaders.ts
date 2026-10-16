// GLSL for the nigral field. Firing timeline, in seconds after uFireT: a pulse runs in from the dendrite
// tips to the soma (0 to 0.55 s), the soma flashes, then a pulse runs down the axon (0.55 to 1.45 s).
// uSick walks a cell through Lewy pathology (a Lewy body forms, the neuromelanin pales, dendrites retract);
// uGone takes the vulnerable ones away entirely, the way the pigmented neurons of the nigra are lost.
const FADE = /* glsl */ `
uniform vec3 uPaper;
uniform vec4 uContent; // left and right edge of the text column in device pixels, feather, strength
uniform float uFogNear;
uniform float uFogFar;
uniform float uFade;
uniform float uGone;
float fadeAmount(float depth) {
  float fog = smoothstep(uFogNear, uFogFar, depth);
  float x = gl_FragCoord.x;
  float inside = smoothstep(uContent.x - uContent.z, uContent.x + uContent.z, x)
               * (1.0 - smoothstep(uContent.y - uContent.z, uContent.y + uContent.z, x));
  return clamp(fog + inside * uContent.w + uFade + uGone, 0.0, 1.0);
}
`;

const FIRE = /* glsl */ `
uniform float uTime;
uniform float uFireT;
uniform float uSick;
uniform float uBorn;
uniform float uGone;
// grows from 0 to a little past 1 in the first two seconds after the cell is born
float grown() {
  float g = clamp((uTime - uBorn) / 1.9, 0.0, 1.0);
  return (1.0 - pow(1.0 - g, 3.0)) * 1.1;
}
float front(float kind) {
  float t = uTime - uFireT;
  return kind < 0.5 ? 1.0 - t / 0.55 : (t - 0.55) / 0.9;
}
float wave(float dist, float kind) {
  float t = uTime - uFireT;
  float on = step(0.0, t) * step(t, 1.6);
  return on * exp(-pow((dist - front(kind)) * 12.0, 2.0));
}
`;

export const dendriteVert = /* glsl */ `
${FIRE}
uniform float uVel;
attribute vec3 aNormal;
attribute float aRadius;
attribute float aDist;
attribute float aKind;
attribute float aSeed;
varying float vBand;
varying float vDepth;
varying float vShade;
void main() {
  float b = wave(aDist, aKind) * (1.0 - 0.7 * uSick);
  // the tissue gets sick from the tips in: dendrites retract as uSick rises, and a lost cell goes entirely
  float cut = (1.0 - 0.62 * uSick) * (1.0 - uGone);
  float g = grown();
  float alive = (1.0 - smoothstep(cut - 0.07, cut, aDist)) * (1.0 - smoothstep(g - 0.06, g, aDist));
  vec3 p = position + aNormal * aRadius * alive * (1.0 + 1.8 * b);
  // inertia: the far branches lag the soma when the page moves fast
  p.y += uVel * aDist * 0.45;
  p.x += sin(uTime * 0.55 + aSeed * 6.2831 + position.y * 2.3) * 0.014 * aDist;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vDepth = -mv.z;
  vec3 n = normalize(normalMatrix * aNormal);
  vShade = 0.64 + 0.36 * max(dot(n, normalize(vec3(-0.45, 0.7, 0.55))), 0.0);
  vBand = b;
  gl_Position = projectionMatrix * mv;
}
`;

export const dendriteFrag = /* glsl */ `
${FADE}
uniform vec3 uInk;
uniform vec3 uSickInk;
uniform vec3 uPulse;
uniform float uSick;
varying float vBand;
varying float vDepth;
varying float vShade;
void main() {
  vec3 ink = mix(uInk, uSickInk, uSick * 0.8) * vShade;
  vec3 col = mix(ink, uPulse, clamp(vBand * 1.25, 0.0, 1.0));
  col = mix(col, vec3(0.86, 0.92, 1.0), clamp(vBand - 0.55, 0.0, 1.0));
  gl_FragColor = vec4(mix(col, uPaper, fadeAmount(vDepth) * (1.0 - vBand * 0.6)), 1.0);
  #include <colorspace_fragment>
}
`;

export const tipVert = /* glsl */ `
${FIRE}
uniform float uScale;
attribute float aDist;
attribute float aKind;
varying float vGlow;
varying float vDepth;
void main() {
  float cut = (1.0 - 0.62 * uSick) * (1.0 - uGone);
  float g = grown();
  float alive = (1.0 - smoothstep(cut - 0.07, cut, aDist)) * step(aDist, g);
  vGlow = wave(aDist, aKind) * (1.0 - 0.7 * uSick);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDepth = -mv.z;
  gl_PointSize = (aKind > 0.5 ? 7.0 : 5.0) * (1.0 + 1.6 * vGlow) * alive * uScale / vDepth;
  gl_Position = projectionMatrix * mv;
}
`;

export const tipFrag = /* glsl */ `
${FADE}
uniform vec3 uInk;
uniform vec3 uPulse;
varying float vGlow;
varying float vDepth;
void main() {
  float r = length(gl_PointCoord * 2.0 - 1.0);
  if (r > 1.0) discard;
  vec3 col = mix(uInk, uPulse, clamp(vGlow * 1.4, 0.0, 1.0));
  col = mix(col, uPaper, smoothstep(0.55, 1.0, r) * (1.0 - vGlow));
  gl_FragColor = vec4(mix(col, uPaper, fadeAmount(vDepth) * (1.0 - vGlow * 0.6)), 1.0);
  #include <colorspace_fragment>
}
`;

export const somaVert = /* glsl */ `
uniform float uTime;
uniform float uSeed;
uniform float uBorn;
uniform float uGone;
varying vec3 vN;
varying vec3 vObj;
varying float vDepth;
void main() {
  float born = clamp((uTime - uBorn) / 0.5, 0.0, 1.0);
  vec3 p = position * (born * born * (3.0 - 2.0 * born)) * (1.0 - 0.55 * uGone);
  float lump = sin(p.x * 7.0 + uSeed) * sin(p.y * 5.0 + uSeed * 2.0) * sin(p.z * 6.0 - uSeed);
  p *= 1.0 + 0.09 * lump + 0.02 * sin(uTime * 1.3 + uSeed * 4.0);
  vObj = position;
  vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

export const somaFrag = /* glsl */ `
${FADE}
uniform float uTime;
uniform float uFireT;
uniform float uSick;
uniform float uSeed;
uniform vec3 uInk;
uniform vec3 uPulse;
uniform vec3 uNucleus;
uniform vec3 uMelanin;
uniform vec3 uLewy;
uniform vec3 uHalo;
varying vec3 vN;
varying vec3 vObj;
varying float vDepth;
float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
void main() {
  float facing = abs(vN.z);
  // A nigral dopamine neuron as H&E shows it: the cytoplasm packed with brown neuromelanin granules, an eccentric
  // pale nucleus with a dark nucleolus. As the cell sickens the pigment thins out (the nigra turns pale).
  float coarse = hash(floor(vObj * 8.0 + uSeed));
  float fine = hash(floor(vObj * 21.0 + uSeed * 1.7));
  vec3 pig = mix(uMelanin * 1.55, uMelanin * 0.55, step(0.42, fine));
  pig = mix(pig, uMelanin * 0.4, step(0.78, coarse) * 0.8);
  pig *= 0.82 + 0.3 * pow(facing, 1.2);
  vec3 pale = mix(uInk * 0.55 + 0.42, vec3(0.80, 0.78, 0.80), 0.4) * (0.9 + 0.1 * facing);
  float depig = smoothstep(0.2, 0.92, uSick);
  vec3 col = mix(pig, pale, depig * (0.55 + 0.45 * step(0.5, fine)));
  vec2 nuc = vec2(0.24 * cos(uSeed * 2.3), 0.2 * sin(uSeed * 1.7));
  float dn = length(vN.xy - nuc);
  col = mix(col, uNucleus, 1.0 - smoothstep(0.2, 0.26, dn));
  col = mix(col, uInk * 0.6, 1.0 - smoothstep(0.045, 0.075, dn));
  col = mix(col, uMelanin * 0.35, smoothstep(0.86, 1.0, 1.0 - facing) * 0.5);
  // Lewy bodies: round, a dense eosinophilic core inside a pale halo, set in the pigment opposite the nucleus;
  // a second one forms later in the disease
  vec2 lb = -nuc * 1.15 + vec2(0.04 * sin(uSeed * 5.0), 0.05);
  float d = length(vN.xy - lb);
  float lewy = smoothstep(0.12, 0.34, uSick);
  col = mix(col, uHalo, (1.0 - smoothstep(0.19, 0.25, d)) * lewy);
  col = mix(col, uLewy, (1.0 - smoothstep(0.1, 0.15, d)) * lewy);
  vec2 lb2 = vec2(-nuc.y, nuc.x) * 1.2;
  float d2 = length(vN.xy - lb2);
  float lewy2 = smoothstep(0.5, 0.7, uSick);
  col = mix(col, uHalo, (1.0 - smoothstep(0.13, 0.18, d2)) * lewy2);
  col = mix(col, uLewy, (1.0 - smoothstep(0.06, 0.1, d2)) * lewy2);
  float t = uTime - uFireT;
  float flash = exp(-pow((t - 0.55) / 0.13, 2.0)) * (1.0 - 0.7 * uSick);
  col = mix(col, uPulse, flash * 0.85);
  gl_FragColor = vec4(mix(col, uPaper, fadeAmount(vDepth) * (1.0 - flash * 0.6)), 1.0);
  #include <colorspace_fragment>
}
`;

// Lewy neurites: swollen, thread-like processes filled with α-synuclein, drawn in DAB brown
export const neuriteVert = /* glsl */ `
uniform float uPath;
uniform float uScale;
uniform float uTime;
attribute float aSeed;
attribute float aOnset;
attribute float aSize;
varying float vSeed;
varying float vAppear;
varying float vDepth;
void main() {
  vAppear = smoothstep(aOnset, aOnset + 0.14, uPath);
  vSeed = aSeed;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDepth = -mv.z;
  gl_PointSize = aSize * (0.45 + 0.55 * vAppear) * (1.0 + 0.03 * sin(uTime * 0.8 + aSeed * 20.0)) * uScale / vDepth;
  gl_Position = projectionMatrix * mv;
}
`;

export const neuriteFrag = /* glsl */ `
${FADE}
uniform vec3 uThread;
uniform vec3 uBead;
varying float vSeed;
varying float vAppear;
varying float vDepth;
void main() {
  if (vAppear < 0.01) discard;
  float a = vSeed * 6.2831;
  mat2 rot = mat2(cos(a), -sin(a), sin(a), cos(a));
  vec2 c = rot * (gl_PointCoord * 2.0 - 1.0);
  float y = 0.22 * sin(c.x * 3.2 + vSeed * 9.0);
  float line = 1.0 - smoothstep(0.035, 0.075, abs(c.y - y));
  float ends = 1.0 - smoothstep(0.7, 0.95, abs(c.x));
  // varicosities: the beads along a diseased neurite
  float bead = 1.0 - smoothstep(0.1, 0.16, length(vec2(fract(c.x * 1.6 + vSeed * 3.0) - 0.5, (c.y - y) * 1.6)));
  float alpha = max(line * ends, bead * ends * 0.95) * vAppear;
  if (alpha < 0.02) discard;
  vec3 col = mix(uThread, uBead, bead);
  gl_FragColor = vec4(col, alpha * (1.0 - fadeAmount(vDepth)));
  #include <colorspace_fragment>
}
`;

export const dustVert = /* glsl */ `
uniform float uTime;
uniform float uScale;
attribute float aSeed;
attribute float aSize;
varying float vDepth;
void main() {
  vec3 p = position;
  p.x += sin(uTime * 0.21 + aSeed * 31.0) * 0.05;
  p.y += cos(uTime * 0.17 + aSeed * 17.0) * 0.06;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vDepth = -mv.z;
  gl_PointSize = aSize * uScale / vDepth;
  gl_Position = projectionMatrix * mv;
}
`;

export const dustFrag = /* glsl */ `
${FADE}
uniform vec3 uInk;
varying float vDepth;
void main() {
  float r = length(gl_PointCoord * 2.0 - 1.0);
  if (r > 1.0) discard;
  // glial nuclei: the small blue dots between neurons on a stained slide
  float a = (1.0 - smoothstep(0.6, 1.0, r)) * 0.7;
  gl_FragColor = vec4(uInk, a * (1.0 - fadeAmount(vDepth)));
  #include <colorspace_fragment>
}
`;

// Where a pigmented neuron died: free neuromelanin left in the tissue, and the glial nuclei that gather to
// clear it (neuronophagia). Each point belongs to one lost neuron and appears as that neuron goes.
export const pigmentVert = /* glsl */ `
uniform float uPath;
uniform float uScale;
uniform float uTime;
attribute float aSeed;
attribute float aOnset;
attribute float aSize;
attribute float aKind;
varying float vSeed;
varying float vAppear;
varying float vKind;
varying float vDepth;
void main() {
  vAppear = smoothstep(aOnset, aOnset + 0.08, uPath);
  vSeed = aSeed;
  vKind = aKind;
  vec3 p = position;
  p.x += sin(uTime * 0.19 + aSeed * 23.0) * 0.02;
  p.y += cos(uTime * 0.15 + aSeed * 11.0) * 0.02;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vDepth = -mv.z;
  gl_PointSize = aSize * (0.4 + 0.6 * vAppear) * uScale / vDepth;
  gl_Position = projectionMatrix * mv;
}
`;

export const pigmentFrag = /* glsl */ `
${FADE}
uniform vec3 uMelanin;
uniform vec3 uGlia;
varying float vSeed;
varying float vAppear;
varying float vKind;
varying float vDepth;
void main() {
  if (vAppear < 0.01) discard;
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float a = atan(c.y, c.x);
  // pigment clumps are ragged; glial nuclei are smooth ovals
  float edge = vKind > 0.5 ? 1.0 : 0.72 + 0.28 * sin(a * 5.0 + vSeed * 30.0) * sin(a * 3.0 - vSeed * 11.0);
  float r = length(c * vec2(1.0, vKind > 0.5 ? 1.25 : 1.0)) / edge;
  if (r > 1.0) discard;
  vec3 col = vKind > 0.5 ? uGlia : mix(uMelanin * 0.55, uMelanin * 1.3, smoothstep(0.2, 1.0, r));
  float alpha = (1.0 - smoothstep(0.75, 1.0, r)) * vAppear * (vKind > 0.5 ? 0.85 : 0.95);
  gl_FragColor = vec4(col, alpha * (1.0 - fadeAmount(vDepth)));
  #include <colorspace_fragment>
}
`;
