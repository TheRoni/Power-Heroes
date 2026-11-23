// village.js: the Home Village, a calm isle to walk about on, with no enemies and no timer. Its places: the Hero Hall (the door starts
// the next battle), the training yard, the sparring ring, the pond, the campfire square, the lookout tower and the notice board (the
// Power Rankings). The arena is hidden while you are here. The buildings are in village-props.js.
import * as THREE from '../lib/three.module.min.js';
import { buildIsle, buildPath, buildHall, buildYard, buildRing, buildPond, buildSquare, buildTower, buildBoard, buildTree, buildLamp } from './village-props.js';
import { buildFire, animateFire } from './campfire.js';

export const VILLAGE_RADIUS = 18;   // the whole isle
export const VILLAGE_WALK = 16.4;   // how far from the middle the hero may walk
const BODY = 0.45;                  // how close to a solid thing the hero's middle may come (on top of its size)

// Where everything is: x to the east, z to the south (the camera looks north). "solid" is circles [x, z, size] the hero cannot walk through.
export const PLACES = {
  hall: { x: 0, z: -13.5, solid: [[-2.8, -13.5, 1.9], [0, -13.5, 2.1], [2.8, -13.5, 1.9], [-3.8, -13.1, 1.2], [3.8, -13.1, 1.2]] },
  yard: { x: -11.5, z: -3 },
  ring: { x: 11.5, z: -3, solid: [[16.1, -3, 0.3]] },
  pond: { x: -10, z: 8, solid: [[-10, 8, 3.7]] },
  square: { x: 1.5, z: 5.5, solid: [[1.5, 5.5, 1.1]] },
  tower: { x: 12.5, z: 9, solid: [[12.5, 9, 1.8]] },
  board: { x: -5, z: -9.5, solid: [[-5, -9.5, 1.3]] },
};
export const DOOR = { x: 0, z: -10.6 };   // in front of the Hall's door: you arrive here, and the Hall's button is here

// What the big button does when you stand near something: { id, label, x, z, size }.
const ACTIONS = [
  { id: 'hall', label: 'Hero Hall', x: DOOR.x, z: DOOR.z, size: 2.2 },
  { id: 'board', label: 'Rankings', x: -5, z: -8.1, size: 1.9 },
];

// The paths, from point to point.
const PATHS = [[0, -10.4, 0, 3.5], [0, -3, -8, -3], [0, -3, 8, -3], [1.5, 5.5, -6.8, 7.4], [1.5, 5.5, 10.6, 8.6], [-3.4, -8.3, 0, -8.3]];

// "scene" is the world's scene, and "arena" the group with the arena's island and trees (hidden while you are in the village).
export function createVillage({ scene, arena }) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);
  group.add(buildIsle(VILLAGE_RADIUS));
  for (const [ax, az, bx, bz] of PATHS) group.add(buildPath(ax, az, bx, bz));
  const put = (object, x, z, turn = 0) => { object.position.set(x, 0, z); object.rotation.y = turn; group.add(object); return object; };
  put(buildHall(), PLACES.hall.x, PLACES.hall.z);
  put(buildYard(), PLACES.yard.x, PLACES.yard.z);
  put(buildRing(), PLACES.ring.x, PLACES.ring.z);
  put(buildPond(), PLACES.pond.x, PLACES.pond.z);
  put(buildSquare(), PLACES.square.x, PLACES.square.z);
  put(buildTower(), PLACES.tower.x, PLACES.tower.z, -0.5);
  put(buildBoard(), PLACES.board.x, PLACES.board.z, 0.3);
  const fire = buildFire();
  fire.group.visible = true;
  put(fire.group, PLACES.square.x, PLACES.square.z).scale.setScalar(0.8);

  // Trees all round the edge (with a gap by the Hall), a few in the middle, and lamps along the main street.
  const ring = 24;
  for (let i = 0; i < ring; i++) {
    const a = (i / ring) * Math.PI * 2 + 0.1;
    const r = 15.8 + (i % 3) * 0.6;
    const x = Math.sin(a) * r;
    const z = Math.cos(a) * r;
    if (z < -12 && Math.abs(x) < 7) continue;
    put(buildTree(0.9 + (i % 4) * 0.12), x, z, a);
  }
  for (const [x, z, s] of [[-14, 3.5, 1], [6.5, 11.5, 0.9], [-3.5, 12.5, 1.1], [14, -9, 1], [-14, -9.5, 1.1], [5.5, -6.5, 0.8]]) put(buildTree(s), x, z);
  for (const [x, z] of [[-1.3, -8.2], [1.3, -8.2], [-1.3, -1.5], [1.3, -1.5], [-1.3, 2.5], [1.3, 2.5]]) put(buildLamp(), x, z);

  // A pushing-out of everything solid (the Hall, the pond, the tower, the fire, the board): "position" is moved if it is inside one.
  const solids = Object.values(PLACES).flatMap((place) => place.solid || []);
  function keepOut(position) {
    for (const [x, z, size] of solids) {
      const dx = position.x - x;
      const dz = position.z - z;
      const distance = Math.hypot(dx, dz);
      const least = size + BODY;
      if (distance < least) {
        const push = distance > 0.0001 ? least / distance : 0;
        position.x = distance > 0.0001 ? x + dx * push : x + least;
        position.z = distance > 0.0001 ? z + dz * push : z;
      }
    }
  }

  // The thing the big button would do where you stand (the Hall's door, the notice board), or null.
  function actionAt(position) {
    return ACTIONS.find((a) => Math.hypot(position.x - a.x, position.z - a.z) < a.size) || null;
  }

  function enter() { arena.visible = false; group.visible = true; }
  function leave() { group.visible = false; arena.visible = true; }
  function update(dt, time) { if (group.visible) animateFire(fire, time, dt); }

  return {
    group, enter, leave, update, keepOut, actionAt,
    get active() { return group.visible; },
  };
}
