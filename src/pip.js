// pip.js: Pip, a tiny floating light-sprite who guides the hero. A glowing ball with a face and two little wings.
import * as THREE from '../lib/three.module.min.js';

// A soft round glow (a sprite that always faces the camera), painted on a tiny canvas. "colors" are three CSS colours:
// the bright middle, the soft body, and the clear edge. "size" is how wide it is. Pip and Marlo's lantern both use it.
export function createGlow({ inner, mid, outer }, size) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(0.3, mid);
  gradient.addColorStop(1, outer);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.setScalar(size);
  return glow;
}

// "emit" throws one spark: emit(x, y, z, vx, vy, vz, life, size, colour, gravity). Pip leaves a trail of them.
export function createPip({ scene, emit }) {
  const group = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffd84a }));
  const glow = createGlow({ inner: 'rgba(255, 244, 170, 1)', mid: 'rgba(255, 214, 80, 0.75)', outer: 'rgba(255, 190, 40, 0)' }, 2.2);
  group.add(core, glow);

  const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x3a2b1a });
  const wingMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
  const wings = [];
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), eyeMaterial);
    eye.position.set(side * 0.09, 0.04, 0.235);
    const wing = new THREE.Mesh(new THREE.CircleGeometry(0.15, 12), wingMaterial);
    wing.position.set(side * 0.3, 0.1, -0.02);
    wings.push(wing);
    group.add(eye, wing);
  }

  group.position.set(-9, 6, -4);   // starts far away, so Pip flies in at the beginning
  scene.add(group);

  let excited = 0;       // Pip puffs up and bounces for a moment whenever they speak
  let sparkTimer = 0;

  function excite() {
    excited = 1;
  }

  // Called every frame. "leader" is the position Pip hovers near, and "height" is how high above the ground.
  function update(dt, time, leader, height = 2.7) {
    excited = Math.max(0, excited - dt * 2);
    const bob = Math.sin(time * 2.4) * 0.18 + Math.sin(time * 5.1) * 0.05;
    const follow = 1 - Math.exp(-3 * dt);   // Pip drifts after the hero rather than sticking to them
    const p = group.position;
    p.x += (leader.x - 1.6 - p.x) * follow;
    p.y += (height + bob + excited * 0.4 - p.y) * follow;
    p.z += (leader.z + 0.5 - p.z) * follow;
    group.scale.setScalar(1 + excited * 0.35);
    glow.material.opacity = 0.8 + Math.sin(time * 3) * 0.15 + excited * 0.2;
    for (const wing of wings) wing.scale.x = 0.4 + Math.abs(Math.sin(time * 25)) * 0.9;   // the wings flap

    sparkTimer -= dt;
    if (sparkTimer <= 0) {
      sparkTimer = 0.07;
      emit(p.x + (Math.random() - 0.5) * 0.2, p.y - 0.1, p.z + (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.4, -0.2, (Math.random() - 0.5) * 0.4, 0.7, 0.09, 0xffec9a, 0);
    }
  }

  return { group, update, excite };
}
