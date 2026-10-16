// The statistics the atlas tests need, written out so every number can be traced.

export const mean = (x: number[]) => x.reduce((a, b) => a + b, 0) / (x.length || 1);

export function ranks(x: number[]): number[] {
  const idx = x.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
  const r = new Array<number>(x.length);
  for (let i = 0; i < idx.length; ) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
    i = j + 1;
  }
  return r;
}

export function pearson(x: number[], y: number[]): number {
  const mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < x.length; i++) {
    const a = x[i] - mx, b = y[i] - my;
    sxy += a * b;
    sxx += a * a;
    syy += b * b;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
}

// ---------------------------------------------------------------- distributions
function lgamma(z: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let x = z, y = z;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (const k of c) ser += k / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

function betacf(a: number, b: number, x: number): number {
  const MAXIT = 300, EPS = 3e-16, FPMIN = 1e-300;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Regularized incomplete beta I_x(a, b). */
export function ibeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** Two-sided p for Student's t. */
export const tP = (t: number, df: number) => (df <= 0 ? 1 : Math.min(1, ibeta(df / (df + t * t), df / 2, 0.5)));

/** Two-sided p for a standard normal z (via the t distribution's limit, accurate in the tails). */
export function zP(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  // erfc by continued fraction for large x, series for small x
  if (x < 2) {
    let sum = x, term = x;
    for (let n = 1; n < 80; n++) {
      term *= (-x * x) / n;
      sum += term / (2 * n + 1);
    }
    return Math.max(0, Math.min(1, 1 - (2 / Math.sqrt(Math.PI)) * sum));
  }
  let f = 0;
  for (let n = 60; n >= 1; n--) f = n / 2 / (x + f);
  return Math.exp(-x * x) / Math.sqrt(Math.PI) / (x + f);
}

// ---------------------------------------------------------------- tests
export type Stat = { effect: number; p: number; n: number; stat: string };

const corrP = (r: number, df: number) => {
  const rr = Math.min(0.999999, Math.abs(r));
  return tP((rr * Math.sqrt(df)) / Math.sqrt(1 - rr * rr), df);
};

export function spearman(x: number[], y: number[]): Stat {
  const n = x.length;
  const r = pearson(ranks(x), ranks(y));
  return { effect: r, p: n > 3 ? corrP(r, n - 2) : 1, n, stat: "spearman rho" };
}

/** Rank-biserial r: positive when group a sits higher than group b. */
export function rankBiserial(a: number[], b: number[]): Stat {
  const n1 = a.length, n2 = b.length, n = n1 + n2;
  if (!n1 || !n2) return { effect: 0, p: 1, n, stat: "rank-biserial r" };
  const r = ranks([...a, ...b]);
  const R1 = r.slice(0, n1).reduce((s, v) => s + v, 0);
  const U = R1 - (n1 * (n1 + 1)) / 2;
  const counts = new Map<number, number>();
  for (const v of r) counts.set(v, (counts.get(v) ?? 0) + 1);
  let ties = 0;
  for (const t of counts.values()) ties += t * t * t - t;
  const sd = Math.sqrt(((n1 * n2) / 12) * (n + 1 - ties / (n * (n - 1))));
  const z = sd ? (U - (n1 * n2) / 2) / sd : 0;
  return { effect: (2 * U) / (n1 * n2) - 1, p: zP(z), n, stat: "rank-biserial r" };
}

/** OLS residuals of y on the columns of X (an intercept is added). */
export function residualize(y: number[], X: number[][]): number[] {
  const n = y.length, k = X.length + 1;
  const cols = [new Array(n).fill(1), ...X];
  const A = Array.from({ length: k }, (_, i) => Array.from({ length: k + 1 }, (_, j) =>
    j < k ? cols[i].reduce((s, v, t) => s + v * cols[j][t], 0) : cols[i].reduce((s, v, t) => s + v * y[t], 0)));
  for (let c = 0; c < k; c++) {
    let p = c;
    for (let r = c + 1; r < k; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    const piv = A[c][c] || 1e-12;
    for (let j = c; j <= k; j++) A[c][j] /= piv;
    for (let r = 0; r < k; r++) if (r !== c) {
      const f = A[r][c];
      for (let j = c; j <= k; j++) A[r][j] -= f * A[c][j];
    }
  }
  const beta = A.map((row) => row[k]);
  return y.map((v, t) => v - cols.reduce((s, col, i) => s + beta[i] * col[t], 0));
}

/** Spearman correlation of x and y with the covariates partialled out (all on ranks). */
export function partialSpearman(x: number[], y: number[], covs: number[][]): Stat {
  const rc = covs.map(ranks);
  const r = pearson(residualize(ranks(x), rc), residualize(ranks(y), rc));
  const df = x.length - 2 - covs.length;
  return { effect: r, p: df > 1 ? corrP(r, df) : 1, n: x.length, stat: "partial spearman rho" };
}

export function fisherCI(r: number, n: number): [number, number] {
  if (n < 4) return [-1, 1];
  const z = Math.atanh(Math.max(-0.999999, Math.min(0.999999, r))), se = 1 / Math.sqrt(n - 3);
  return [Math.tanh(z - 1.96 * se), Math.tanh(z + 1.96 * se)];
}

export const fmtP = (p: number) => (p < 0.001 ? p.toExponential(1) : p.toFixed(p < 0.01 ? 4 : 3));
export const fmtE = (e: number) => `${e >= 0 ? "+" : ""}${e.toFixed(2)}`;

/** Two-sided Fisher exact test for the 2x2 table [[a, b], [c, d]]. */
export function fisherExact(a: number, b: number, c: number, d: number): number {
  const lf = (n: number) => lgammaInt(n + 1);
  const n = a + b + c + d, r1 = a + b, c1 = a + c;
  const prob = (x: number) => Math.exp(lf(r1) + lf(n - r1) + lf(c1) + lf(n - c1) - lf(n) - lf(x) - lf(r1 - x) - lf(c1 - x) - lf(n - r1 - c1 + x));
  const lo = Math.max(0, r1 + c1 - n), hi = Math.min(r1, c1);
  const p0 = prob(a);
  let p = 0;
  for (let x = lo; x <= hi; x++) { const px = prob(x); if (px <= p0 * (1 + 1e-7)) p += px; }
  return Math.min(1, p);
}
const lgCache: number[] = [0, 0];
function lgammaInt(n: number): number {
  // log((n-1)!) for whole n >= 1
  for (let k = lgCache.length; k <= n; k++) lgCache[k] = lgCache[k - 1] + Math.log(k - 1);
  return lgCache[n];
}
