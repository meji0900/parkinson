// GLSL for the neuron field. Firing timeline, in seconds after uFireT: a pulse runs in from the dendrite
// tips to the soma (0 to 0.55 s), the soma flashes, then a pulse runs down the axon (0.55 to 1.45 s).
const FADE = /* glsl */ `
uniform vec3 uPaper;
uniform vec4 uContent; // left and right edge of the text column in device pixels, feather, strength
uniform float uFogNear;
uniform float uFogFar;
uniform float uFade;
float fadeAmount(float depth) {
  float fog = smoothstep(uFogNear, uFogFar, depth);
  float x = gl_FragCoord.x;
  float inside = smoothstep(uContent.x - uContent.z, uContent.x + uContent.z, x)
               * (1.0 - smoothstep(uContent.y - uContent.z, uContent.y + uContent.z, x));
  return clamp(fog + inside * uContent.w + uFade, 0.0, 1.0);
}
`;

const FIRE = /* glsl */ `
uniform float uTime;
uniform float uFireT;
uniform float uSick;
uniform float uBorn;
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
  // the tissue gets sick from the tips in: dendrites retract as uSick rises
  float cut = 1.0 - 0.62 * uSick;
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
  col = mix(col, vec3(1.0, 0.86, 0.92), clamp(vBand - 0.55, 0.0, 1.0));
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
  float cut = 1.0 - 0.62 * uSick;
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
varying vec3 vN;
varying vec3 vObj;
varying float vDepth;
void main() {
  float born = clamp((uTime - uBorn) / 0.5, 0.0, 1.0);
  vec3 p = position * (born * born * (3.0 - 2.0 * born));
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
uniform vec3 uTangle;
varying vec3 vN;
varying vec3 vObj;
varying float vDepth;
void main() {
  float facing = abs(vN.z);
  // Nissl-stained cytoplasm, a pale vesicular nucleus, a dark nucleolus: a neuron in H&E
  vec3 col = mix(uInk * 0.72, mix(uInk, uPulse, 0.22) * 1.18, pow(facing, 1.6));
  col = mix(col, uNucleus, smoothstep(0.74, 0.84, facing) * 0.85);
  col = mix(col, uInk * 0.55, smoothstep(0.955, 0.985, facing));
  // tau: dark flame-shaped tangles fill the cell body as it gets sick
  float flame = smoothstep(0.42, 0.78, 0.5 + 0.5 * sin(vObj.y * 24.0 + sin(vObj.x * 13.0 + uSeed) * 2.6 + vObj.z * 6.0));
  col = mix(col, uTangle, flame * smoothstep(0.08, 0.85, uSick) * 0.95);
  float t = uTime - uFireT;
  float flash = exp(-pow((t - 0.55) / 0.13, 2.0)) * (1.0 - 0.7 * uSick);
  col = mix(col, uPulse, flash * 0.9);
  gl_FragColor = vec4(mix(col, uPaper, fadeAmount(vDepth) * (1.0 - flash * 0.6)), 1.0);
  #include <colorspace_fragment>
}
`;

export const plaqueVert = /* glsl */ `
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
  gl_PointSize = aSize * (0.35 + 0.65 * vAppear) * (1.0 + 0.03 * sin(uTime * 0.8 + aSeed * 20.0)) * uScale / vDepth;
  gl_Position = projectionMatrix * mv;
}
`;

export const plaqueFrag = /* glsl */ `
${FADE}
uniform vec3 uPlaque;
uniform vec3 uPlaqueCore;
varying float vSeed;
varying float vAppear;
varying float vDepth;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r = length(c);
  if (r > 1.0 || vAppear < 0.01) discard;
  float a = atan(c.y, c.x);
  // amyloid plaque: a dense core inside a halo of radiating fibrils
  float fib = 0.5 + 0.5 * sin(a * 13.0 + vSeed * 40.0 + r * 9.0) * sin(a * 5.0 - vSeed * 17.0 + r * 3.0);
  float core = 1.0 - smoothstep(0.1, 0.28, r);
  float halo = (1.0 - smoothstep(0.3, 1.0, r)) * (0.25 + 0.75 * fib) * smoothstep(0.08, 0.3, r);
  float alpha = max(core, halo * 0.55) * vAppear;
  vec3 col = mix(uPlaque, uPlaqueCore, core);
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
  // glial nuclei: the small dark dots between neurons on a stained slide
  float a = (1.0 - smoothstep(0.6, 1.0, r)) * 0.7;
  gl_FragColor = vec4(uInk, a * (1.0 - fadeAmount(vDepth)));
  #include <colorspace_fragment>
}
`;
