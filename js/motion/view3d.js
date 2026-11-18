// three.js view of a pose from pose.js: a low-poly mannequin plus simple prop shapes,
// colored per body part by check status. Loaded lazily by player.js and by the
// contact-sheet page, so the rest of the app never downloads three.js.
import * as THREE from '../../vendor/three/three.module.min.js';
import { SHAPES, JOINT_SPHERES } from './skeleton.js';
import { evaluate } from './pose.js';

export const COLORS = { off: 0x8e96a4, good: 0x22c55e, warn: 0xfbbf24, bad: 0xf05252 };
const JOINT = 0x4b505c, METAL = 0xc5c9d1, DARK = 0x34373f, PAD = 0x2d3038, FOAM = 0x24262c;

// Camera azimuth (deg) of the preset views: side = the person's right, front, front-right.
export const VIEWS = { side: -90, front: 0, '45': -45 };

// Capsule with different end radii along +Y from 0 to length.
function limbGeometry(r0, r1, length) {
  const pts = [];
  for (let i = 0; i <= 4; i++) { const a = -Math.PI / 2 + (i / 4) * (Math.PI / 2); pts.push(new THREE.Vector2(r0 * Math.cos(a), r0 * Math.sin(a))); }
  for (let i = 0; i <= 4; i++) { const a = (i / 4) * (Math.PI / 2); pts.push(new THREE.Vector2(Math.max(1e-4, r1 * Math.cos(a)), length + r1 * Math.sin(a))); }
  return new THREE.LatheGeometry(pts, 12);
}

const Y = new THREE.Vector3(0, 1, 0);
function shapeMesh(s, mat) {
  let mesh;
  if (s.type === 'limb') {
    const from = new THREE.Vector3(...s.from), to = new THREE.Vector3(...s.to);
    const dir = to.clone().sub(from);
    mesh = new THREE.Mesh(limbGeometry(s.r[0], s.r[1], dir.length()), mat);
    mesh.position.copy(from);
    mesh.quaternion.setFromUnitVectors(Y, dir.normalize());
    if (s.depth) mesh.scale.set(1, 1, s.depth);
  } else if (s.type === 'ellipsoid') {
    mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), mat);
    mesh.position.set(...s.at);
    mesh.scale.set(...s.r);
  } else {
    mesh = new THREE.Mesh(new THREE.BoxGeometry(...s.size), mat);
    mesh.position.set(...s.at);
  }
  return mesh;
}

const material = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, flatShading: true });
// Plates are see-through so they never hide the body in the side view.
const glass = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, transparent: true, opacity: 0.35, depthWrite: false });
function cyl(r, length, mat, axis = 'y', segs = 14) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, length, segs), mat);
  if (axis === 'x') m.rotation.z = Math.PI / 2;
  if (axis === 'z') m.rotation.x = Math.PI / 2;
  return m;
}
function box(size, at, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  m.position.set(...at);
  return m;
}

// Prop meshes in the prop's own frame (docs/MOTION-FORMAT.md, "Props"). `main` is the
// material that turns green/amber/red when a check lists the prop.
function buildProp(p) {
  const g = new THREE.Group(), main = material(METAL), dark = material(DARK);
  const add = (m, x = 0, y = 0, z = 0) => { m.position.x += x; m.position.y += y; m.position.z += z; g.add(m); return m; };
  if (p.type === 'barbell') {
    const plate = glass(0x7d838f);
    const L = p.length ?? 2.2, half = L / 2, inner = Math.min(0.655, half - 0.1);
    add(cyl(0.014, inner * 2, main, 'x'));
    for (const s of [-1, 1]) {
      add(cyl(0.026, half - inner, main, 'x'), s * (inner + half) / 2);
      if (p.plates !== false) {
        add(cyl(p.plateRadius ?? 0.225, 0.05, plate, 'x', 24), s * (inner + 0.06));
        add(cyl(0.035, 0.03, main, 'x'), s * (inner + 0.1));
      }
    }
  } else if (p.type === 'dumbbell') {
    add(cyl(0.016, 0.14, main, 'z'));
    for (const s of [-1, 1]) add(cyl(p.headRadius ?? 0.055, 0.08, dark, 'z', 6), 0, 0, s * 0.11);
  } else if (p.type === 'rod') {
    add(cyl(p.radius ?? 0.016, p.length ?? 1.2, main, 'x'));
  } else if (p.type === 'roller') {
    add(cyl(p.radius ?? 0.05, p.length ?? 0.35, main, 'x', 16));
    main.color.set(FOAM);
  } else if (p.type === 'box') {
    main.color.set(PAD);
    add(new THREE.Mesh(new THREE.BoxGeometry(...(p.size || [0.4, 0.4, 0.4])), main));
  } else if (p.type === 'handle') {
    const w = p.width ?? (p.neutral ? 0.12 : 0.15);
    if (p.neutral) {
      for (const s of [-1, 1]) add(cyl(0.016, 0.12, main), s * w / 2);
      add(cyl(0.01, w, main, 'x'), 0, 0.07);
    } else add(cyl(0.016, w, main, 'x'));
  } else if (p.type === 'rope') {
    for (const s of [-1, 1]) {
      const strand = new THREE.Vector3(s * 0.06, -0.3, 0);
      const m = add(cyl(0.012, strand.length(), main));
      m.quaternion.setFromUnitVectors(Y, strand.clone().normalize());
      m.position.copy(strand.clone().multiplyScalar(0.5));
      add(new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), dark), s * 0.06, -0.3);
    }
    main.color.set(0xb79b6b);
  } else if (p.type === 'bench') {
    main.color.set(PAD);
    const h = p.height ?? 0.43, w = p.width ?? 0.28;
    if (p.incline) {
      const a = (p.incline * Math.PI) / 180, L = p.backLength ?? 0.8;
      add(box([w, 0.06, 0.4], [0, h - 0.03, 0.2], main));
      const back = add(box([w, 0.06, L], [0, 0, 0], main));
      back.rotation.x = a; // raises the end toward -Z
      back.position.set(0, h - 0.03 + (Math.sin(a) * L) / 2, (-Math.cos(a) * L) / 2);
      add(box([0.06, h - 0.06, 0.06], [0, (h - 0.06) / 2, 0.2], dark));
      add(box([0.06, h, 0.06], [0, h / 2, -0.35], dark));
    } else {
      const L = p.length ?? 1.2;
      add(box([w, 0.06, L], [0, h - 0.03, 0], main));
      for (const s of [-1, 1]) add(box([0.3, h - 0.06, 0.06], [0, (h - 0.06) / 2, s * (L / 2 - 0.15)], dark));
    }
  }
  return { group: g, main, base: main.color.getHex() };
}

// bounds: { min: [x,y,z], max: [x,y,z] } of everything over the rep (see motionBounds).
export function createView(canvas, motion, { bounds, pixelRatio = Math.min(2, window.devicePixelRatio || 1) } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: false });
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1c1d21);
  scene.add(new THREE.HemisphereLight(0xdfe6f3, 0x2a2b30, 1.7));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(-2, 4, 3);
  scene.add(sun);

  // Floor: a dark disc with a faint 25 cm grid.
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1.8, 48), new THREE.MeshBasicMaterial({ color: 0x23252a }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const grid = new THREE.GridHelper(3.5, 14, 0x34373f, 0x2c2e34);
  grid.position.y = 0.001;
  scene.add(grid);

  // Body: one group per segment, one material per segment so each can be colored.
  const segs = {};
  const jointMat = material(JOINT);
  for (const name of ['pelvis', 'lumbar', 'thorax', 'neck', 'head', 'upperArmL', 'forearmL', 'handL', 'upperArmR', 'forearmR', 'handR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR']) {
    const mat = material(COLORS.off), group = new THREE.Group();
    for (const s of SHAPES[name.replace(/[LR]$/, '')]) group.add(shapeMesh(s, mat));
    scene.add(group);
    segs[name] = { group, mat };
  }
  const joints = {};
  for (const [j, r] of Object.entries(JOINT_SPHERES)) {
    for (const s of ['L', 'R']) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), jointMat);
      scene.add(m);
      joints[j + s] = m;
    }
  }

  const props = {};
  for (const p of motion.props || []) {
    if (p.type === 'cable') {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xaab0bb }));
      const pulley = cyl(0.05, 0.03, material(DARK), 'x', 16);
      scene.add(line, pulley);
      props[p.id] = { line, pulley, main: pulley.material, base: DARK };
    } else {
      const built = buildProp(p);
      scene.add(built.group);
      props[p.id] = built;
    }
  }

  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
  const lo = new THREE.Vector3(...bounds.min), hi = new THREE.Vector3(...bounds.max);
  const target = lo.clone().add(hi).multiplyScalar(0.5);
  let az = VIEWS.side, el = 8;

  // Distance that fits the whole rep's bounding box at this azimuth.
  function fitDistance() {
    const right = new THREE.Vector3(Math.cos((az * Math.PI) / 180), 0, -Math.sin((az * Math.PI) / 180));
    const back = new THREE.Vector3(Math.sin((az * Math.PI) / 180), 0, Math.cos((az * Math.PI) / 180));
    let w = 0, d = 0;
    for (const x of [lo.x, hi.x]) for (const z of [lo.z, hi.z]) {
      const c = new THREE.Vector3(x, 0, z).sub(target);
      w = Math.max(w, Math.abs(c.dot(right)));
      d = Math.max(d, Math.abs(c.dot(back)));
    }
    const h = (hi.y - lo.y) / 2, vf = (camera.fov * Math.PI) / 360, hf = Math.atan(Math.tan(vf) * camera.aspect);
    return Math.max(h / Math.tan(vf), w / Math.tan(hf)) * 1.1 + d * 0.4;
  }
  function placeCamera() {
    const dist = fitDistance(), a = (az * Math.PI) / 180, e = (el * Math.PI) / 180;
    camera.position.set(target.x + dist * Math.sin(a) * Math.cos(e), target.y + dist * Math.sin(e), target.z + dist * Math.cos(a) * Math.cos(e));
    camera.lookAt(target);
  }

  const m4 = new THREE.Matrix4();
  const setFrame = (obj, { o, R }) => {
    obj.position.set(o[0], o[1], o[2]);
    m4.set(R[0], R[1], R[2], 0, R[3], R[4], R[5], 0, R[6], R[7], R[8], 0, 0, 0, 0, 1);
    obj.quaternion.setFromRotationMatrix(m4);
  };

  // statusOf(part) → 'off' | 'good' | 'warn' | 'bad'
  function draw(pose, statusOf = (part) => pose.parts[part] || 'off') {
    for (const [name, s] of Object.entries(segs)) {
      setFrame(s.group, pose.segments[name]);
      s.mat.color.setHex(COLORS[statusOf(name)]);
    }
    for (const [name, m] of Object.entries(joints)) m.position.set(...pose.points[name]);
    for (const [id, p] of Object.entries(props)) {
      const f = pose.props[id];
      const st = statusOf(id);
      p.main.color.setHex(st === 'off' ? p.base : COLORS[st]);
      if (p.line) {
        p.line.geometry.setFromPoints([new THREE.Vector3(...f.o), new THREE.Vector3(...f.to)]);
        p.pulley.position.set(...f.o);
      } else setFrame(p.group, f);
    }
    renderer.render(scene, camera);
  }

  function resize(w, h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    placeCamera();
  }

  return {
    renderer,
    draw,
    resize,
    setView(name) { az = VIEWS[name] ?? (Number(name) || az); el = 8; placeCamera(); },
    orbit(dAz, dEl) { az += dAz; el = Math.max(-10, Math.min(70, el + dEl)); placeCamera(); },
    dispose() {
      scene.traverse((o) => {
        o.geometry?.dispose();
        [o.material].flat().forEach((m) => m?.dispose());
      });
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}

// Local box (centre, half size) around a prop's shape, for framing the camera.
function propExtent(p) {
  const L = p.length, h = p.height ?? 0.43;
  switch (p.type) {
    case 'barbell': return [[0, 0, 0], [(L ?? 2.2) / 2, p.plateRadius ?? 0.225, p.plateRadius ?? 0.225]];
    case 'rod': return [[0, 0, 0], [(L ?? 1.2) / 2, 0.02, 0.02]];
    case 'dumbbell': return [[0, 0, 0], [0.06, 0.06, 0.15]];
    case 'roller': return [[0, 0, 0], [(L ?? 0.35) / 2, 0.05, 0.05]];
    case 'box': return [[0, 0, 0], (p.size || [0.4, 0.4, 0.4]).map((v) => v / 2)];
    case 'bench': return p.incline ? [[0, 0.5, -0.1], [0.15, 0.5, 0.5]] : [[0, h / 2, 0], [0.15, h / 2, (L ?? 1.2) / 2]];
    default: return [[0, 0, 0], [0.05, 0.05, 0.05]];
  }
}

// Bounding box of every body point and prop over the rep and its mistakes.
export function motionBounds(motion) {
  const min = [Infinity, 0, Infinity], max = [-Infinity, -Infinity, -Infinity];
  const grow = (p) => { for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], p[i]); max[i] = Math.max(max[i], p[i]); } };
  for (const id of [null, ...(motion.mistakes || []).map((m) => m.id)]) {
    for (let i = 0; i <= 12; i++) {
      const pose = evaluate(motion, i / 12, id);
      Object.values(pose.points).forEach(grow);
      Object.values(pose.propPoints).forEach(grow);
      for (const p of motion.props || []) {
        const f = pose.props[p.id];
        if (p.type === 'cable') continue;
        const [c, hs] = propExtent(p);
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
          const l = [c[0] + sx * hs[0], c[1] + sy * hs[1], c[2] + sz * hs[2]];
          const R = f.R;
          grow([f.o[0] + R[0] * l[0] + R[1] * l[1] + R[2] * l[2], f.o[1] + R[3] * l[0] + R[4] * l[1] + R[5] * l[2], f.o[2] + R[6] * l[0] + R[7] * l[1] + R[8] * l[2]]);
        }
      }
    }
  }
  max[1] += 0.12; // top of the head above the head-centre landmark
  return { min, max };
}
