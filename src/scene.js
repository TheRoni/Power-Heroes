// scene.js: builds the 3D world (sky, floating island, trees, rocks, clouds, lights)
// and the camera that follows the hero.
import * as THREE from '../lib/three.module.min.js';

export const ISLAND_RADIUS = 12;   // the whole island, including its decorated edge
export const WALK_RADIUS = 10.2;   // how far from the centre the hero may walk

// Camera settings: change these numbers to change how the game is framed.
const FOV = 45;                                // lens angle, in degrees
export const CAMERA_PITCH = THREE.MathUtils.degToRad(56);   // other files use this to tilt things so they face the camera
const PITCH = CAMERA_PITCH;    // how steeply the camera looks down
const MIN_WIDTH = 12;                          // ground width that must always fit on screen (smaller = zoomed in)
const MIN_DEPTH = 11;                          // ground depth that must always fit on screen
const FOLLOW = 0.8;                            // 1 = camera stays right over the hero; less = the island edge stays in view
const LOOK_AHEAD = 0.2;                        // camera drifts a little ahead of where the hero is running

const dummy = new THREE.Object3D();            // scratch object for building instance positions
const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });

// A small random-number maker with a fixed starting number, so the island looks the same every time.
function makeRandom(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The same three numbers always give the same "random" answer. Used to roughen the rock.
function hash(x, y, z) {
  const s = Math.sin(Math.round(x * 100) * 12.9898 + Math.round(y * 100) * 78.233 + Math.round(z * 100) * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

// The sky: a blue-to-cream gradient painted on a tiny canvas and used as the background.
function makeSky() {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, '#4aa8ee');
  gradient.addColorStop(0.55, '#a6dcf8');
  gradient.addColorStop(1, '#fff0d6');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 2, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addLights(scene) {
  // Soft light from the sky above and bounced light from the grass below.
  scene.add(new THREE.HemisphereLight(0xdff3ff, 0x9bc46a, 1.5));
  // The sun: warm light that also casts shadows.
  const sun = new THREE.DirectionalLight(0xfff1d8, 2.2);
  sun.position.set(7, 14, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const box = sun.shadow.camera;
  box.left = -15; box.right = 15; box.top = 15; box.bottom = -15; box.near = 1; box.far = 45;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
}

// The island: a grassy top, a band of soil, and a chunky rock underneath.
function buildIsland() {
  const island = new THREE.Group();
  const grass = new THREE.Mesh(new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS, 0.6, 72), lambert(0x7ccf4a));
  grass.position.y = -0.3;                       // its flat top sits at height 0
  grass.receiveShadow = true;
  const soil = new THREE.Mesh(new THREE.CylinderGeometry(ISLAND_RADIUS * 0.99, ISLAND_RADIUS * 0.93, 1.2, 48), lambert(0xa97a4c));
  soil.position.y = -1.2;

  const rockShape = new THREE.ConeGeometry(ISLAND_RADIUS * 0.92, 9, 10, 4);
  rockShape.rotateX(Math.PI);                    // point downwards
  const points = rockShape.attributes.position;
  for (let i = 0; i < points.count; i++) {       // nudge each point so the rock looks chunky, not perfect
    const x = points.getX(i), y = points.getY(i), z = points.getZ(i);
    const n = hash(x, y, z);
    points.setXYZ(i, x * (0.88 + n * 0.16), y + (n - 0.5) * 0.5, z * (0.88 + n * 0.16));
  }
  const rock = new THREE.Mesh(rockShape, lambert(0x8f8272, { flatShading: true }));
  rock.position.y = -6.3;

  // A lighter ring along the walkable edge and a pale disc in the middle.
  // They help you see how far you have moved.
  const light = lambert(0xa6e06a, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const ring = new THREE.Mesh(new THREE.RingGeometry(WALK_RADIUS - 0.25, WALK_RADIUS, 72), light);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(2.4, 48), light);
  for (const flat of [ring, disc]) {
    flat.rotation.x = -Math.PI / 2;
    flat.position.y = 0.02;
    flat.receiveShadow = true;
  }
  island.add(grass, soil, rock, ring, disc);
  return island;
}

// Scatters many copies of one small shape over the grass using one "instanced" mesh (cheap to draw).
function scatter(count, rand, shape, palette, smallest, biggest) {
  const mesh = new THREE.InstancedMesh(shape, lambert(0xffffff), count);
  const color = new THREE.Color();
  const items = [];
  for (let i = 0; i < count; i++) {
    const angle = rand() * Math.PI * 2;
    const radius = Math.sqrt(rand()) * (WALK_RADIUS + 0.9);   // the square root spreads them evenly
    items.push({ x: Math.cos(angle) * radius, z: Math.sin(angle) * radius, spin: rand() * 6.28, size: smallest + rand() * (biggest - smallest), phase: rand() * 6.28 });
    mesh.setColorAt(i, color.set(palette[Math.floor(rand() * palette.length)]));
  }
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return { mesh, items };
}

// Puts every scattered item in place. "sway" tilts them gently back and forth, like wind.
function place(set, time, sway) {
  set.items.forEach((item, i) => {
    dummy.position.set(item.x, 0, item.z);
    dummy.rotation.set(Math.sin(time * 1.7 + item.phase) * sway, item.spin, Math.cos(time * 1.3 + item.phase) * sway);
    dummy.scale.setScalar(item.size);
    dummy.updateMatrix();
    set.mesh.setMatrixAt(i, dummy.matrix);
  });
  set.mesh.instanceMatrix.needsUpdate = true;
}

// Trees stand only along the far side of the island, so they never hide the hero from the camera.
function addTrees(scene, rand) {
  const trunkShape = new THREE.CylinderGeometry(0.16, 0.24, 1.3, 7);
  const roundTop = new THREE.IcosahedronGeometry(1.05, 1);
  const pineTop = new THREE.ConeGeometry(1.0, 2.2, 7);
  const trunkMaterial = lambert(0x8a5a35);
  const leaves = [0x4fae45, 0x3f9a4a, 0x66bd4f].map((c) => lambert(c, { flatShading: true }));
  for (let i = 0; i < 9; i++) {
    const angle = Math.PI * (1.08 + 0.84 * (i / 8)) + (rand() - 0.5) * 0.15;
    const radius = 11 + rand() * 0.6;
    const pine = i % 3 === 0;
    const trunk = new THREE.Mesh(trunkShape, trunkMaterial);
    trunk.position.y = 0.65;
    const top = new THREE.Mesh(pine ? pineTop : roundTop, leaves[i % 3]);
    top.position.y = pine ? 2.2 : 2.0;
    trunk.castShadow = true;
    top.castShadow = true;
    const tree = new THREE.Group();
    tree.add(trunk, top);
    tree.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    tree.scale.setScalar(0.85 + rand() * 0.5);
    tree.rotation.y = rand() * 6.28;
    scene.add(tree);
  }
}

// Low rocks around the rim. They are low enough that they never block the view.
function addRocks(scene, rand) {
  const shape = new THREE.DodecahedronGeometry(0.6, 0);
  const material = lambert(0xa3a09a, { flatShading: true });
  for (let i = 0; i < 9; i++) {
    const angle = (i / 9) * Math.PI * 2 + rand() * 0.5;
    const radius = 10.9 + rand() * 0.8;
    const rock = new THREE.Mesh(shape, material);
    rock.scale.set(0.7 + rand() * 0.8, 0.45 + rand() * 0.4, 0.7 + rand() * 0.8);
    rock.position.set(Math.cos(angle) * radius, 0.1, Math.sin(angle) * radius);
    rock.rotation.set(rand() * 3, rand() * 3, 0);
    rock.castShadow = true;
    rock.receiveShadow = true;
    scene.add(rock);
  }
}

// A few small rocks floating in the sky around the island. They bob slowly.
function addFloatingRocks(scene, rand) {
  const material = lambert(0x9b8c7d, { flatShading: true });
  const floaters = [];
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 + rand();
    const radius = 16 + rand() * 4;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.9 + rand() * 0.8, 0), material);
    rock.position.set(Math.cos(angle) * radius, -1 + rand() * 2.5, Math.sin(angle) * radius);
    rock.rotation.set(rand() * 3, rand() * 3, 0);
    rock.castShadow = true;
    scene.add(rock);
    floaters.push({ rock, baseY: rock.position.y, phase: rand() * 6.28 });
  }
  return floaters;
}

// Puffy clouds far below the island, which makes it feel high up.
function addClouds(scene, rand) {
  const puffs = [];
  for (let c = 0; c < 8; c++) {
    const angle = rand() * Math.PI * 2, radius = 15 + rand() * 22, y = -4 - rand() * 9, size = 1.6 + rand() * 1.4;
    for (let k = 0; k < 4; k++) {
      puffs.push({
        x: Math.cos(angle) * radius + (k - 1.5) * size,
        y: y + (rand() - 0.5) * 0.6,
        z: Math.sin(angle) * radius + (rand() - 0.5) * size,
        size: size * (k === 1 || k === 2 ? 1.2 : 0.85),
      });
    }
  }
  const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), lambert(0xffffff, { emissive: 0x7fa6cc }), puffs.length);
  puffs.forEach((p, i) => {
    dummy.position.set(p.x, p.y, p.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(p.size * 1.3, p.size * 0.7, p.size);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.frustumCulled = false;
  const group = new THREE.Group();   // turning this group makes the clouds drift around the island
  group.add(mesh);
  scene.add(group);
  return group;
}

export function createWorld() {
  const scene = new THREE.Scene();
  const rand = makeRandom(7);
  scene.background = makeSky();
  addLights(scene);
  scene.add(buildIsland());

  // Grass tufts (which sway) and flowers, so you can see yourself moving across the ground.
  const tuftShape = new THREE.ConeGeometry(0.12, 0.5, 4).translate(0, 0.25, 0);
  const flowerShape = new THREE.SphereGeometry(0.1, 6, 4).translate(0, 0.1, 0);
  const tufts = scatter(190, rand, tuftShape, ['#5cb83a', '#6cc944', '#4ea32f', '#8ad955'], 0.55, 1.1);
  const flowers = scatter(70, rand, flowerShape, ['#ffffff', '#ffe24a', '#ff8fb3', '#9fd4ff'], 0.8, 1.3);
  place(flowers, 0, 0);
  scene.add(tufts.mesh, flowers.mesh);

  addTrees(scene, rand);
  addRocks(scene, rand);
  const floaters = addFloatingRocks(scene, rand);
  const clouds = addClouds(scene, rand);

  // The camera looks down at the hero from above and behind.
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 150);
  const focus = new THREE.Vector3();    // the spot the camera looks at
  const wanted = new THREE.Vector3();   // where that spot is heading
  let distance = 20;                    // how far back the camera sits

  // Called whenever the screen changes shape. The camera backs up as far as needed so the
  // same patch of ground stays visible on tall phone screens and wide computer screens.
  function resize(width, height) {
    camera.aspect = width / height;
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const forWidth = MIN_WIDTH / 2 / (tanHalf * camera.aspect);
    const forDepth = (MIN_DEPTH / 2) * Math.sin(PITCH) / tanHalf;
    distance = Math.max(forWidth, forDepth);
    camera.updateProjectionMatrix();
  }

  // Glides the camera after the hero. "snap" jumps straight there (used once, at the start).
  function follow(position, velocity, dt, snap) {
    wanted.set(position.x * FOLLOW + velocity.x * LOOK_AHEAD, 0.5, position.z * FOLLOW + velocity.z * LOOK_AHEAD);
    if (snap) focus.copy(wanted);
    else focus.lerp(wanted, 1 - Math.exp(-5 * dt));
    camera.position.set(focus.x, focus.y + distance * Math.sin(PITCH), focus.z + distance * Math.cos(PITCH));
    camera.lookAt(focus);
  }

  // Small things that move all the time: swaying grass, bobbing rocks, drifting clouds.
  function update(dt, time) {
    place(tufts, time, 0.1);
    for (const f of floaters) {
      f.rock.position.y = f.baseY + Math.sin(time * 0.6 + f.phase) * 0.35;
      f.rock.rotation.y += dt * 0.1;
    }
    clouds.rotation.y += dt * 0.012;
  }

  return { scene, camera, resize, follow, update };
}
