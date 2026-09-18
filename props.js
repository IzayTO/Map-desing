import * as THREE from "three";

/*
  Parte 5 · Biblioteca procedural ligera.

  Cada prop se construye con geometrías sencillas de Three.js.
  No se descargan modelos externos, por lo que el repositorio sigue liviano.

  Las geometrías y materiales se reutilizan entre objetos para reducir memoria.
*/

const G = {
  unitBox: new THREE.BoxGeometry(1, 1, 1),
  trunk: new THREE.CylinderGeometry(0.16, 0.22, 1, 7),
  slimCylinder: new THREE.CylinderGeometry(0.055, 0.07, 1, 7),
  sphereLow: new THREE.IcosahedronGeometry(1, 1),
  sphereVeryLow: new THREE.IcosahedronGeometry(1, 0),
  leaf: new THREE.ConeGeometry(0.38, 1.7, 4),
  bowl: new THREE.CylinderGeometry(0.9, 1.05, 0.26, 16),
  fountainBase: new THREE.CylinderGeometry(1.25, 1.35, 0.28, 18),
  fountainStem: new THREE.CylinderGeometry(0.12, 0.15, 1, 8),
  fountainWaterLarge: new THREE.CylinderGeometry(1.02, 1.02, 0.035, 18),
  fountainWaterSmall: new THREE.CylinderGeometry(0.44, 0.44, 0.025, 16),
  lampTop: new THREE.SphereGeometry(0.13, 8, 6),
};

const M = {
  trunk: new THREE.MeshStandardMaterial({
    color: 0x8b6b4b,
    roughness: 0.95,
    metalness: 0,
  }),

  trunkDark: new THREE.MeshStandardMaterial({
    color: 0x625444,
    roughness: 0.96,
    metalness: 0,
  }),

  palmLeaf: new THREE.MeshStandardMaterial({
    color: 0x5d8a61,
    roughness: 0.92,
    metalness: 0,
    side: THREE.DoubleSide,
  }),

  foliage: new THREE.MeshStandardMaterial({
    color: 0x6f9266,
    roughness: 0.96,
    metalness: 0,
  }),

  foliageLight: new THREE.MeshStandardMaterial({
    color: 0x819f75,
    roughness: 0.96,
    metalness: 0,
  }),

  shrub: new THREE.MeshStandardMaterial({
    color: 0x738d67,
    roughness: 0.98,
    metalness: 0,
  }),

  metal: new THREE.MeshStandardMaterial({
    color: 0x575957,
    roughness: 0.72,
    metalness: 0.22,
  }),

  lamp: new THREE.MeshStandardMaterial({
    color: 0xf1dfad,
    emissive: 0x5c4d2b,
    emissiveIntensity: 0.22,
    roughness: 0.58,
  }),

  stone: new THREE.MeshStandardMaterial({
    color: 0xb8b3aa,
    roughness: 0.93,
    metalness: 0,
  }),

  fountainWater: new THREE.MeshStandardMaterial({
    color: 0x87bbc4,
    roughness: 0.35,
    metalness: 0.02,
    transparent: true,
    opacity: 0.82,
  }),

  bridgeDeck: new THREE.MeshStandardMaterial({
    color: 0xa58d72,
    roughness: 0.94,
    metalness: 0,
  }),

  bridgeRail: new THREE.MeshStandardMaterial({
    color: 0x796856,
    roughness: 0.93,
    metalness: 0,
  }),

  path: new THREE.MeshStandardMaterial({
    color: 0xc7beb1,
    roughness: 1,
    metalness: 0,
  }),

  water: new THREE.MeshStandardMaterial({
    color: 0x8fc2ca,
    roughness: 0.28,
    metalness: 0.03,
    transparent: true,
    opacity: 0.78,
  }),
};

export const PROP_CATALOG = Object.freeze({
  palm: {
    label: "Palmera",
    kind: "vegetation",
    scalePolicy: "uniform",
    defaultName: "Palmera",
  },
  tree: {
    label: "Árbol",
    kind: "vegetation",
    scalePolicy: "uniform",
    defaultName: "Árbol",
  },
  shrub: {
    label: "Arbusto",
    kind: "vegetation",
    scalePolicy: "uniform",
    defaultName: "Arbusto",
  },
  lamp: {
    label: "Poste",
    kind: "fixture",
    scalePolicy: "uniform",
    defaultName: "Poste",
  },
  fountain: {
    label: "Fuente",
    kind: "fixture",
    scalePolicy: "uniform",
    defaultName: "Fuente",
  },
  bridge: {
    label: "Puente",
    kind: "structure",
    scalePolicy: "free",
    defaultName: "Puente",
  },
  path: {
    label: "Camino",
    kind: "surface",
    scalePolicy: "free",
    defaultName: "Camino",
  },
  water: {
    label: "Agua",
    kind: "surface",
    scalePolicy: "free",
    defaultName: "Zona de agua",
  },
});

function mesh(geometry, material) {
  const result = new THREE.Mesh(geometry, material);
  result.castShadow = false;
  result.receiveShadow = false;
  return result;
}

function prepareRoot(type) {
  const info = PROP_CATALOG[type];
  const root = new THREE.Group();

  root.userData.editorType = "prop";
  root.userData.propType = type;
  root.userData.kind = info.kind;
  root.userData.scalePolicy = info.scalePolicy;
  root.userData.defaultScale = 1;

  return root;
}

function makePalm() {
  const root = prepareRoot("palm");

  const trunk = mesh(G.trunk, M.trunk);
  trunk.scale.set(1, 4.4, 1);
  trunk.position.y = 2.2;
  root.add(trunk);

  const crown = new THREE.Group();
  crown.position.y = 4.45;

  for (let i = 0; i < 6; i += 1) {
    const leaf = mesh(G.leaf, M.palmLeaf);

    leaf.scale.set(1.0, 1.0, 0.42);
    leaf.rotation.z = Math.PI / 2.5;
    leaf.rotation.y = (Math.PI * 2 * i) / 6;
    leaf.position.set(
      Math.cos(leaf.rotation.y) * 0.55,
      0.05,
      Math.sin(leaf.rotation.y) * 0.55
    );

    crown.add(leaf);
  }

  const center = mesh(G.sphereVeryLow, M.foliage);
  center.scale.setScalar(0.42);
  crown.add(center);

  root.add(crown);

  root.userData.baseHeight = 5.1;
  return root;
}

function makeTree() {
  const root = prepareRoot("tree");

  const trunk = mesh(G.trunk, M.trunkDark);
  trunk.scale.set(1.15, 2.6, 1.15);
  trunk.position.y = 1.3;
  root.add(trunk);

  const crownA = mesh(G.sphereLow, M.foliage);
  crownA.scale.set(1.25, 1.35, 1.18);
  crownA.position.set(-0.42, 3.05, 0);
  root.add(crownA);

  const crownB = mesh(G.sphereLow, M.foliageLight);
  crownB.scale.set(1.12, 1.22, 1.1);
  crownB.position.set(0.55, 3.18, 0.25);
  root.add(crownB);

  const crownC = mesh(G.sphereVeryLow, M.foliage);
  crownC.scale.set(1.05, 1.05, 1.05);
  crownC.position.set(0.08, 3.72, -0.22);
  root.add(crownC);

  root.userData.baseHeight = 4.8;
  return root;
}

function makeShrub() {
  const root = prepareRoot("shrub");

  const a = mesh(G.sphereLow, M.shrub);
  a.scale.set(0.82, 0.56, 0.74);
  a.position.set(-0.42, 0.52, 0);
  root.add(a);

  const b = mesh(G.sphereVeryLow, M.foliageLight);
  b.scale.set(0.72, 0.52, 0.68);
  b.position.set(0.42, 0.48, 0.14);
  root.add(b);

  const c = mesh(G.sphereVeryLow, M.shrub);
  c.scale.set(0.58, 0.45, 0.62);
  c.position.set(0, 0.68, -0.33);
  root.add(c);

  root.userData.baseHeight = 1.25;
  return root;
}

function makeLamp() {
  const root = prepareRoot("lamp");

  const pole = mesh(G.slimCylinder, M.metal);
  pole.scale.set(1, 3.4, 1);
  pole.position.y = 1.7;
  root.add(pole);

  const top = mesh(G.lampTop, M.lamp);
  top.position.y = 3.5;
  root.add(top);

  const cap = mesh(G.unitBox, M.metal);
  cap.scale.set(0.32, 0.08, 0.32);
  cap.position.y = 3.35;
  root.add(cap);

  root.userData.baseHeight = 3.7;
  return root;
}

function makeFountain() {
  const root = prepareRoot("fountain");

  const base = mesh(G.fountainBase, M.stone);
  base.position.y = 0.14;
  root.add(base);

  const water = mesh(
    G.fountainWaterLarge,
    M.fountainWater
  );
  water.position.y = 0.31;
  root.add(water);

  const stem = mesh(G.fountainStem, M.stone);
  stem.scale.set(1, 0.95, 1);
  stem.position.y = 0.77;
  root.add(stem);

  const bowl = mesh(G.bowl, M.stone);
  bowl.scale.set(0.52, 0.52, 0.52);
  bowl.position.y = 1.18;
  root.add(bowl);

  const topWater = mesh(
    G.fountainWaterSmall,
    M.fountainWater
  );
  topWater.position.y = 1.27;
  root.add(topWater);

  root.userData.baseHeight = 1.35;
  return root;
}

function makeBridge() {
  const root = prepareRoot("bridge");

  const deck = mesh(G.unitBox, M.bridgeDeck);
  deck.scale.set(4.8, 0.22, 1.65);
  deck.position.y = 0.5;
  root.add(deck);

  const railLeft = mesh(G.unitBox, M.bridgeRail);
  railLeft.scale.set(4.8, 0.08, 0.08);
  railLeft.position.set(0, 1.0, -0.78);
  root.add(railLeft);

  const railRight = railLeft.clone();
  railRight.position.z = 0.78;
  root.add(railRight);

  const postPositions = [-2.25, -0.75, 0.75, 2.25];

  for (const x of postPositions) {
    for (const z of [-0.78, 0.78]) {
      const post = mesh(G.unitBox, M.bridgeRail);
      post.scale.set(0.08, 0.78, 0.08);
      post.position.set(x, 0.82, z);
      root.add(post);
    }
  }

  root.userData.baseDimensions = { x: 4.8, y: 1.25, z: 1.65 };
  return root;
}

function makePath() {
  const root = prepareRoot("path");

  const path = mesh(G.unitBox, M.path);
  path.scale.set(5.5, 0.08, 1.6);
  path.position.y = 0.04;
  root.add(path);

  root.userData.baseDimensions = { x: 5.5, y: 0.08, z: 1.6 };
  return root;
}

function makeWater() {
  const root = prepareRoot("water");

  const water = mesh(G.unitBox, M.water);
  water.scale.set(5.5, 0.06, 4.0);
  water.position.y = 0.03;
  root.add(water);

  root.userData.baseDimensions = { x: 5.5, y: 0.06, z: 4.0 };
  return root;
}

const FACTORIES = {
  palm: makePalm,
  tree: makeTree,
  shrub: makeShrub,
  lamp: makeLamp,
  fountain: makeFountain,
  bridge: makeBridge,
  path: makePath,
  water: makeWater,
};

export function createProp(type) {
  const factory = FACTORIES[type];

  if (!factory) {
    throw new Error(`Tipo de prop desconocido: ${type}`);
  }

  const root = factory();
  const info = PROP_CATALOG[type];

  root.name = info.defaultName;

  root.traverse((object) => {
    object.userData.editorRoot = root;
  });

  return root;
}

export function disposePropLibrary() {
  const geometries = new Set(Object.values(G));
  const materials = new Set(Object.values(M));

  for (const geometry of geometries) {
    geometry.dispose?.();
  }

  for (const material of materials) {
    material.dispose?.();
  }
}
