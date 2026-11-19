import { Shader, reduceMotion, token } from "nsh";

/**
 * The window's backdrop: a rainy night city lit from behind a rooftop figure, with a few bats crossing on paths of their
 * own. Everything is drawn in a 1120×720 "frame" anchored to the window's right edge and scaled by its
 * height, so the light, the figure and the flock keep their place as the window resizes. The left side is darkened
 * so the sidebar and the package table stay readable over it.
 */
const SCENE = /* wgsl */ `
struct Uniforms { sky: vec4f, glow: vec4f, gold: vec4f, base: vec4f }

const PI: f32 = 3.14159265;
const BATS: i32 = 16;

fn hash(n: f32) -> f32 { return fract(sin(n * 127.1 + 11.7) * 43758.5453); }

// A point of the frame (1120 × 720 design units) in window points.
fn frame(p: vec2f, k: f32) -> vec2f { return vec2f(nsh.size.x - (1120.0 - p.x) * k, p.y * k); }

fn cubic(a: vec2f, b: vec2f, c: vec2f, d: vec2f, t: f32) -> vec2f {
  let u = 1.0 - t;
  return u * u * u * a + 3.0 * u * u * t * b + 3.0 * u * t * t * c + t * t * t * d;
}
fn cubicTangent(a: vec2f, b: vec2f, c: vec2f, d: vec2f, t: f32) -> vec2f {
  let u = 1.0 - t;
  return 3.0 * u * u * (b - a) + 6.0 * u * t * (c - b) + 3.0 * t * t * (d - c);
}

// A bat seen from below, head along +y, wingspan 1. f is the wing beat, -1 (down) .. 1 (up).
fn bat(q: vec2f, f: f32, aa: f32) -> f32 {
  let ax = abs(q.x);
  let body = (length(vec2f(q.x / 0.05, (q.y + 0.02) / 0.12)) - 1.0) * 0.05;
  let head = length(q - vec2f(0.0, 0.12)) - 0.04;
  var m = 1.0 - smoothstep(-aa, aa, min(body, head));
  let span = 0.5 * (1.0 - 0.2 * abs(f));
  let u = clamp(ax / span, 0.0, 1.0);
  let top = 0.03 + f * 0.34 * ax + 0.035 * sin(u * PI) * (1.0 - u);
  let bottom = top - mix(0.17, 0.02, u) + 0.05 * abs(sin(u * PI * 3.0));
  let wing = min(min(top - q.y, q.y - bottom), span - ax);
  m = max(m, smoothstep(-aa, aa, wing));
  return m;
}

// The height of a skyline above its base at x, in frame units; spires on some blocks.
fn skyline(x: f32, w: f32, seed: f32, low: f32, high: f32) -> f32 {
  let id = floor(x / w);
  let fx = fract(x / w);
  var h = mix(low, high, hash(id + seed));
  if (hash(id * 1.7 + seed) > 0.78) { h = h + 46.0 * max(0.0, 1.0 - abs(fx - 0.5) / 0.1); }
  if (hash(id * 3.1 + seed) > 0.7) { h = h - 10.0 * abs(fx - 0.5); }
  if (fx < 0.03) { h = h * 0.92; }
  return h;
}

fn windows(x: f32, depth: f32, seed: f32) -> f32 {
  let c = vec2f(floor(x / 5.0), floor(depth / 7.0));
  let inside = step(fract(x / 5.0), 0.45) * step(fract(depth / 7.0), 0.5);
  return inside * step(0.86, hash(c.x * 13.1 + c.y * 7.7 + seed)) * (0.4 + 0.6 * hash(c.x + c.y * 3.3));
}

fn smin(a: f32, b: f32, k: f32) -> f32 {
  let h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
fn rot(p: vec2f, a: f32) -> vec2f { let c = cos(a); let s = sin(a); return vec2f(c * p.x + s * p.y, -s * p.x + c * p.y); }
fn segment(p: vec2f, a: vec2f, b: vec2f) -> f32 {
  let pa = p - a; let ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}
// The two armor plates over the shoulders: angular, sloping down and out.
fn plates(p: vec2f) -> f32 {
  let l = box(rot(p - vec2f(846.0, 416.0), -0.38), vec2f(0.0), vec2f(17.0, 7.0)) - 1.5;
  let r = box(rot(p - vec2f(914.0, 416.0), 0.38), vec2f(0.0), vec2f(17.0, 7.0)) - 1.5;
  return min(l, r);
}
fn box(p: vec2f, c: vec2f, half: vec2f) -> f32 {
  let d = abs(p - c) - half;
  return length(max(d, vec2f(0.0))) + min(max(d.x, d.y), 0.0);
}
// The cape's half-widths at height y: narrow at the shoulders, wide and wind-blown below, its hem cut in scallops.
fn cape(p: vec2f) -> f32 {
  let y = p.y;
  let fall = pow(clamp((y - 404.0) / 186.0, 0.0, 1.0), 1.1);
  let gust = sin(nsh.time * 0.9 + y * 0.03) * smoothstep(430.0, 590.0, y);
  let left = 40.0 + 58.0 * fall + 6.0 * gust;
  let right = 40.0 + 104.0 * fall + 16.0 * gust;
  let side = max((880.0 - left) - p.x, p.x - (880.0 + right));
  let u = (p.x - (880.0 - left)) / (left + right);
  let hem = 588.0 - 14.0 * abs(sin(u * 3.14159 * 5.0)) - 10.0 * u;   // five scallops, lifting to the windward side
  return max(side, max(404.0 - y, y - hem));
}
// Signed distance (frame units) to the figure: an angular hood with a brow, armored shoulders, a tapering torso
// and a scalloped cape, standing on a rooftop with a parapet.
fn figure(p: vec2f) -> f32 {
  let skull = length((p - vec2f(880.0, 365.0)) / vec2f(1.0, 1.22)) - 15.5;
  let jaw = max(box(p, vec2f(880.0, 382.0), vec2f(12.5, 10.0)), abs(p.x - 880.0) * 0.8 + (p.y - 394.0));
  let head = smin(skull, jaw, 5.0);
  // The hood drapes from the head onto the shoulders: a neck that widens as it falls.
  let neck = max(abs(p.x - 880.0) - mix(12.0, 26.0, clamp((p.y - 388.0) / 18.0, 0.0, 1.0)), max(386.0 - p.y, p.y - 410.0));
  let shoulders = max(abs(p.x - 880.0) - mix(26.0, 44.0, clamp((p.y - 400.0) / 22.0, 0.0, 1.0)), max(400.0 - p.y, p.y - 426.0));
  let pauldrons = plates(p);
  let taper = mix(34.0, 22.0, clamp((p.y - 412.0) / 88.0, 0.0, 1.0));
  let torso = max(abs(p.x - 880.0) - taper, max(408.0 - p.y, p.y - 504.0));
  let legs = min(box(p, vec2f(870.0, 548.0), vec2f(8.0, 44.0)), box(p, vec2f(892.0, 548.0), vec2f(8.0, 44.0)));
  var body = smin(head, neck, 5.0);
  body = smin(body, min(shoulders, pauldrons), 6.0);
  body = min(body, min(torso, legs));
  body = min(body, cape(p));
  let roof = max(752.0 - p.x, 590.0 - p.y);
  let parapet = max(max(744.0 - p.x, p.x - 770.0), 578.0 - p.y);
  return min(body, min(roof, parapet));
}
// The eyes: two narrow slanted slits in the hood, lit from within; they blink every few seconds.
fn eyes(p: vec2f) -> f32 {
  let blink = 1.0 - step(0.965, fract(nsh.time / 5.3));
  var glow = 0.0;
  for (var s = -1.0; s <= 1.0; s = s + 2.0) {
    let q = p - vec2f(880.0 + s * 6.2, 370.5);
    let r = vec2f(q.x, q.y + s * q.x * 0.32);          // slanted down toward the nose
    let d = box(r, vec2f(0.0), vec2f(4.2, 1.1 * blink + 0.05));
    glow = max(glow, (1.0 - smoothstep(-0.4, 0.6, d)) + 0.55 * exp(-max(d, 0.0) / 2.2));
  }
  return glow;
}
// Light caught on the armor: the pauldrons' rims, the chest plate's edge and a glint on the belt.
fn armor(p: vec2f) -> vec2f {
  let rims = exp(-abs(plates(p)) / 0.9);
  let v = min(segment(p, vec2f(858.0, 424.0), vec2f(880.0, 458.0)), segment(p, vec2f(902.0, 424.0), vec2f(880.0, 458.0)));
  let chest = exp(-v / 0.8);
  let belt = exp(-abs(p.y - 499.0) / 1.2) * step(abs(p.x - 880.0), 23.0);
  return vec2f((rims + chest * 0.6) * step(p.x, 930.0), belt);
}

// Slanted rain, falling from the upper right toward the lower left: three layers, far to near, each thinner, fainter
// and slower the farther it is. Each column of a layer carries drops of its own length, spacing and phase.
fn rain(p: vec2f, t: f32, k: f32, first: i32, last: i32) -> f32 {
  var total = 0.0;
  for (var l = first; l <= last; l = l + 1) {
    let fl = f32(l);
    let w = mix(5.0, 11.0, fl / 2.0);              // column spacing
    let speed = mix(240.0, 460.0, fl / 2.0);
    let len = mix(10.0, 24.0, fl / 2.0);
    let alpha = mix(0.08, 0.22, fl / 2.0);
    let q = rot(p, 0.3) * vec2f(1.0, 1.0);          // streaks are vertical in this space
    let column = floor(q.x / w);
    let jitter = (hash(column * 1.3 + fl * 17.0) - 0.5) * 0.6;
    let gap = mix(70.0, 160.0, hash(column * 2.7 + fl * 5.0));
    let y = q.y - t * speed * mix(0.85, 1.15, hash(column + fl * 3.0)) + hash(column * 9.1 + fl) * 900.0;   // falls: y grows down
    let cell = floor(y / gap);
    let v = y - cell * gap;
    let id = cell * 3.7 + column * 1.9 + fl * 11.0;
    let present = step(0.28, hash(id));
    // Each drop has its own size and opacity: its length, its thickness and how much light it catches.
    let size = mix(0.5, 1.5, hash(id + 0.31));
    let dropLen = len * size;
    let opacity = mix(0.35, 1.0, hash(id + 0.77));
    // Brightest at its leading (lower) end, fading up its tail.
    let streak = smoothstep(0.0, dropLen * 0.85, v) * (1.0 - smoothstep(dropLen * 0.9, dropLen, v));
    let across = abs(q.x - (column + 0.5 + jitter) * w);
    let thin = 1.0 - smoothstep(0.05, (0.3 + 0.12 * fl) * mix(0.7, 1.5, size - 0.5) + 0.45 / k, across);
    total = total + present * streak * thin * alpha * opacity;
  }
  return total;
}

// Where rain falling straight down at x first meets something: the figure, the parapet, the roof, or the near
// skyline's roofs to the left. Traced down the column with the figure's distance field.
fn surfaceAt(x: f32) -> f32 {
  if (x < 740.0) { return 650.0 - skyline(x + 80.0, 62.0, 9.0, 20.0, 90.0); }
  var y = 320.0;
  for (var i = 0; i < 40; i = i + 1) {
    let d = figure(vec2f(x, y));
    if (d < 0.35) { break; }
    y = y + max(d, 0.4);
  }
  return y;
}

// Splashes where drops land: each 6-unit cell along a surface is hit now and then; a hit throws two droplets up and
// out on a parabola and leaves a small ring. Only points near a surface pay for the trace.
fn splashes(p: vec2f, t: f32) -> f32 {
  let w = 6.0;
  let cell = floor(p.x / w);
  var glow = 0.0;
  for (var n = -1.0; n <= 1.0; n = n + 1.0) {
    let c = cell + n;
    let x = (c + 0.5 + (hash(c * 3.1) - 0.5) * 0.6) * w;
    let y = surfaceAt(x);
    if (abs(p.y - y) > 14.0) { continue; }
    let rate = mix(0.7, 1.6, hash(c * 7.7));
    let phase = fract(t * rate + hash(c * 1.9));
    let life = 0.22;
    if (phase > life) { continue; }
    let tau = phase / life;
    let fade = 1.0 - tau;
    for (var s = -1.0; s <= 1.0; s = s + 2.0) {
      let vx = mix(2.5, 5.0, hash(c * 5.3 + s));
      let vy = mix(6.0, 11.0, hash(c * 2.3 + s));
      let drop = vec2f(x + s * vx * tau * 1.4, y - (vy * tau - 0.5 * 14.0 * tau * tau) * 1.2);
      glow = glow + exp(-length(p - drop) / 0.45) * fade;
    }
    let ring = abs(length((p - vec2f(x, y)) / vec2f(1.0, 0.35)) - tau * 4.0);
    glow = glow + exp(-ring / 0.35) * fade * 0.6 * step(p.y, y + 1.0);
  }
  return glow;
}

// Puddle ripples on the near roof: rings that spread and fade, flattened by the roof's slant.
fn ripples(p: vec2f, t: f32) -> f32 {
  if (p.x < 752.0 || p.y < 592.0) { return 0.0; }
  let g = vec2f(14.0, 8.0);
  let cell = floor(p / g);
  var total = 0.0;
  for (var j = -1.0; j <= 1.0; j = j + 1.0) {
    for (var i = -1.0; i <= 1.0; i = i + 1.0) {
      let c = cell + vec2f(i, j);
      let h = hash(c.x * 7.1 + c.y * 31.7);
      let phase = fract(t * mix(0.5, 1.1, h) + hash(c.x * 2.9 + c.y * 5.3));
      let centre = (c + vec2f(0.5) + (vec2f(hash(c.x + c.y * 3.0), hash(c.y + c.x * 5.0)) - 0.5) * 0.7) * g;
      let r = phase * 9.0;
      let d = abs(length((p - centre) / vec2f(1.0, 0.32)) - r);
      total = total + exp(-d / 0.4) * (1.0 - phase) * step(r, 9.0);
    }
  }
  return total;
}

fn shade(uv: vec2f) -> vec4f {
  let k = nsh.size.y / 720.0;
  let p = uv * nsh.size;
  let fp = vec2f((p.x - (nsh.size.x - 1120.0 * k)) / k, p.y / k);   // this point in frame units
  let t = nsh.time;

  // Sky, and the light behind the figure.
  var col = mix(uniforms.sky.rgb * 1.25, uniforms.sky.rgb * 0.3, smoothstep(0.0, 1.0, uv.y));
  // Distant lightning: some 11-second spans begin with a double flicker that lights the clouds from above.
  let span = floor(t / 11.0);
  let since = t - span * 11.0;
  let strike = step(0.55, hash(span * 4.1 + 2.0)) * (exp(-since * 9.0) + 0.7 * exp(-abs(since - 0.22) * 16.0));
  col = col + uniforms.glow.rgb * strike * 0.22 * (1.0 - smoothstep(0.0, 0.75, uv.y));
  let d = length(fp - vec2f(905.0, 430.0));
  let breathe = 0.92 + 0.08 * sin(t * 0.8);
  col = col + uniforms.glow.rgb * (0.9 * exp(-d / 46.0) + 0.5 * exp(-d / 190.0) + 0.16 * exp(-d / 480.0)) * breathe;

  // Far skyline in haze, then the middle city with lit windows.
  let far = skyline(fp.x + 37.0, 34.0, 3.0, 60.0, 190.0);
  col = mix(col, mix(uniforms.sky.rgb * 1.7, uniforms.glow.rgb * 0.2, 0.3), (1.0 - smoothstep(-1.5, 1.5, 560.0 - far - fp.y)) * 0.75);
  let mid = skyline(fp.x, 46.0, 5.0, 40.0, 150.0);
  let inMid = 1.0 - smoothstep(-0.8, 0.8, 600.0 - mid - fp.y);
  col = mix(col, uniforms.base.rgb * 1.6, inMid);
  col = col + uniforms.gold.rgb * windows(fp.x, 600.0 - fp.y, 5.0) * inMid * 0.9;

  // Drifting mist low over the city.
  let mist = exp(-pow((fp.y - 540.0) / 60.0, 2.0)) * (0.5 + 0.5 * sin(fp.x * 0.006 + t * 0.15));
  col = col + uniforms.glow.rgb * mist * 0.08;

  // Bats: a few at a time, each on a path of its own. Every flight picks a new side to enter from, a heading, a
  // curve, a speed and a size; some flights are skipped, so the sky goes from empty to a small flock and back.
  for (var i = 0; i < BATS; i = i + 1) {
    let fi = f32(i);
    let duration = mix(7.0, 16.0, hash(fi * 2.1));
    let clock = t / duration + hash(fi * 9.7);
    let flight = floor(clock);
    let s = fract(clock);
    let seed = fi * 13.7 + flight * 7.31;
    let busy = 0.5 + 0.5 * sin(t * 0.07 + 1.3);           // the sky's density drifts over a minute or so
    if (hash(seed) > mix(0.35, 0.85, busy)) { continue; }
    let fromLeft = step(0.5, hash(seed + 1.0));
    let y0 = mix(60.0, 470.0, hash(seed + 2.0));
    let y1 = mix(-60.0, 420.0, hash(seed + 3.0));
    let a = vec2f(mix(1220.0, -120.0, fromLeft), y0);
    let e = vec2f(mix(-160.0, 1260.0, fromLeft), y1);
    let b = mix(a, e, 0.33) + vec2f(0.0, (hash(seed + 4.0) - 0.5) * 260.0);
    let c = mix(a, e, 0.66) + vec2f(0.0, (hash(seed + 5.0) - 0.5) * 260.0);
    let near = step(0.8, hash(seed + 6.0));
    let tangent = normalize(cubicTangent(a, b, c, e, s));
    let side = vec2f(-tangent.y, tangent.x);
    let pos = cubic(a, b, c, e, s) + side * sin(t * mix(1.2, 2.4, hash(seed + 7.0)) + fi) * 8.0;
    let span = mix(14.0, 26.0, hash(seed + 8.0)) * (1.0 + near * 1.4);
    let rel = (fp - pos) / span;
    if (abs(rel.x) > 0.7 || abs(rel.y) > 0.7) { continue; }
    let q = vec2f(dot(rel, side), dot(rel, tangent));
    let beat = sin(t * mix(14.0, 22.0, hash(seed + 9.0)) + fi * 1.9);
    let aa = (1.2 + near * 2.5) / (span * k);
    let fade = smoothstep(0.0, 0.05, s) * (1.0 - smoothstep(0.95, 1.0, s));
    let rim = exp(-length(pos - vec2f(905.0, 430.0)) / 260.0) * 0.25;
    col = mix(col, uniforms.base.rgb * 0.4 + uniforms.glow.rgb * rim * 0.4, bat(q, beat, aa) * fade);
  }

  // The far rain falls behind the near roofs and the figure.
  let lit0 = exp(-length(fp - vec2f(905.0, 430.0)) / 220.0);
  col = col + mix(uniforms.glow.rgb * 0.8, vec3f(1.0), 0.3) * rain(fp, t, k, 0, 1) * (0.6 + 1.6 * lit0 + strike * 2.0);

  // Near rooftops, the figure on its ledge, and the rim light the backlight puts around it.
  let near = skyline(fp.x + 80.0, 62.0, 9.0, 20.0, 90.0);
  col = mix(col, uniforms.base.rgb * 0.5, 1.0 - smoothstep(-0.8, 0.8, 650.0 - near - fp.y));
  col = col + uniforms.gold.rgb * windows(fp.x + 3.0, 650.0 - fp.y, 9.0) * (1.0 - smoothstep(-0.8, 0.8, 650.0 - near - fp.y)) * 0.5;
  let fd = figure(fp);
  let lit = exp(-length(fp - vec2f(905.0, 430.0)) / 220.0);
  let inside = 1.0 - smoothstep(-0.8 / k, 0.8 / k, fd);
  col = mix(col, uniforms.base.rgb * 0.3, inside);
  col = col + uniforms.glow.rgb * exp(-abs(fd) / 2.2) * lit * 0.6 * step(fd, 4.0);
  let shine = armor(fp);
  col = col + uniforms.glow.rgb * shine.x * 0.12 * inside + uniforms.gold.rgb * shine.y * 0.45 * inside;
  let e = eyes(fp);
  col = col + mix(uniforms.gold.rgb, vec3f(1.0), 0.6) * e * inside * 1.1 + uniforms.gold.rgb * e * 0.15 * (1.0 - inside);

  // The rain, in front of the city and the figure, catching the backlight more where it is brighter.
  // The near rain stops where it meets the figure and the roof; where it lands it splashes, and the roof's puddles
  // ripple and catch the backlight.
  let solid = 1.0 - smoothstep(-0.5, 0.5, fd);
  let rainLight = mix(uniforms.glow.rgb * 0.8, vec3f(1.0), 0.3);
  col = col + rainLight * rain(fp, t, k, 2, 2) * (0.6 + 1.6 * lit + strike * 2.0) * (1.0 - solid);
  if (fd > -2.0 && fd < 16.0 || fp.y > 560.0) {
    col = col + rainLight * splashes(fp, t) * (0.35 + 1.2 * lit) * 0.55;
  }
  let roof = step(752.0, fp.x) * step(592.0, fp.y);
  let sheen = roof * exp(-abs(fp.x - 905.0) / 70.0) * exp(-(fp.y - 592.0) / 40.0);
  col = col + uniforms.glow.rgb * (sheen * 0.12 + ripples(fp, t) * 0.18 * (0.3 + sheen * 3.0));
  col = mix(col, uniforms.sky.rgb * 1.6, 0.06);                   // the haze rain leaves in the air

  // Readability: darken the left where the sidebar and table sit, and the edges.
  col = col * mix(0.22, 1.0, smoothstep(0.08, 0.8, uv.x));
  let v = length((uv - vec2f(0.62, 0.48)) * vec2f(1.0, 1.25));
  col = col * (1.0 - 0.5 * smoothstep(0.45, 1.0, v));
  return vec4f(col, 1.0);
}`;

/** The night backdrop, behind everything; still while the system asks for reduced motion. */
export function NightScene() {
  return <Shader source={SCENE} paused={reduceMotion()} accessibilityElementsHidden
    uniforms={{sky: token("night"), glow: token("beam"), gold: token("primary"), base: token("background")}}
    class="absolute inset-0"/>;
}
