import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { RectAreaLightHelper } from 'three/addons/helpers/RectAreaLightHelper.js';

// -----------------------------------------------------------------------------
// Beam — a lightweight, artist-facing lighting reference scene.
// The app is intentionally framework-free so it can run directly from GitHub Pages.
// -----------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const deg = THREE.MathUtils.degToRad;
const rad = THREE.MathUtils.radToDeg;

const dom = {
  mainViewport: $('main-viewport'),
  topView: $('top-view'),
  frontView: $('front-view'),
  lightList: $('light-list'),
  lightCount: $('light-count'),
  selectedLightName: $('selected-light-name'),
  statusPill: $('status-pill'),
  sceneLabel: $('scene-label'),
  loading: $('loading-overlay'),
  toast: $('toast'),
  modelSelect: $('model-select'),
  modelUpload: $('model-upload'),
  modelSource: $('model-source'),
  modelScale: $('model-scale'),
  modelScaleValue: $('model-scale-value'),
  modelZ: $('model-z'),
  modelZValue: $('model-z-value'),
  lightType: $('light-type'),
  lightIntensity: $('light-intensity'),
  lightTemperature: $('light-temperature'),
  lightColor: $('light-color'),
  lightX: $('light-x'),
  lightXValue: $('light-x-value'),
  lightY: $('light-y'),
  lightYValue: $('light-y-value'),
  lightZ: $('light-z'),
  lightZValue: $('light-z-value'),
  areaControls: $('area-controls'),
  areaSize: $('area-size'),
  areaSizeValue: $('area-size-value'),
  spotControls: $('spot-controls'),
  spotAngle: $('spot-angle'),
  spotAngleValue: $('spot-angle-value'),
  spotSoftness: $('spot-softness'),
  spotSoftnessValue: $('spot-softness-value'),
  worldColor: $('world-color'),
  hdriSelect: $('hdri-select'),
  envStrength: $('env-strength'),
  envStrengthValue: $('env-strength-value'),
  solidEnv: $('solid-env-controls'),
  hdriEnv: $('hdri-env-controls'),
  rigSection: $('rig-section'),
  rigLabel: $('rig-label'),
  animationSelect: $('animation-select'),
  animationToggle: $('animation-toggle'),
  boneSelect: $('bone-select'),
  boneX: $('bone-x'), boneXValue: $('bone-x-value'),
  boneY: $('bone-y'), boneYValue: $('bone-y-value'),
  boneZ: $('bone-z'), boneZValue: $('bone-z-value'),
  mainCoordinates: $('main-coordinates'),
};

const state = {
  lights: [],
  selectedLightId: null,
  maxLights: 10,
  lightId: 0,
  model: null,
  modelKind: 'neutral-head',
  modelScale: 1,
  modelZ: 0,
  modelBaseScale: 1,
  modelSource: 'Built-in',
  modelFiles: [],
  animationMixer: null,
  activeAction: null,
  bones: [],
  boneDefaults: new Map(),
  environmentMode: 'solid',
  envStrength: 0.35,
  envTexture: null,
  envCache: new Map(),
  lastToast: 0,
  drag: null,
};

const scene = new THREE.Scene();
scene.background = new THREE.Color('#151712');
scene.environmentIntensity = state.envStrength;

const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 100);
camera.position.set(4.5, -7.5, 3.7);
const controls = new OrbitControls(camera, dom.mainViewport);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.minDistance = 2.2;
controls.maxDistance = 25;
controls.target.set(0, 0, 1.45);
controls.update();
controls.saveState();

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
dom.mainViewport.appendChild(renderer.domElement);

// A small, fixed studio fill keeps the reference readable even before a user adds lights.
const hemi = new THREE.HemisphereLight(0xdce7ff, 0x221b16, 0.18);
hemi.name = 'Studio fill';
scene.add(hemi);

const ambient = new THREE.AmbientLight(0xffffff, 0.045);
scene.add(ambient);

const stageGroup = new THREE.Group();
scene.add(stageGroup);

const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x181a15, roughness: 0.78, metalness: 0.02 });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), floorMaterial);
floor.receiveShadow = true;
stageGroup.add(floor);

const backdrop = new THREE.Mesh(
  new THREE.CircleGeometry(4.6, 96),
  new THREE.MeshBasicMaterial({ color: 0x1a1c17, transparent: true, opacity: 0.55 })
);
backdrop.rotation.x = 0;
backdrop.position.z = 0.008;
backdrop.scale.set(1, 1, 1);
stageGroup.add(backdrop);

const pedestal = new THREE.Mesh(
  new THREE.CylinderGeometry(1.28, 1.38, 0.22, 96),
  new THREE.MeshStandardMaterial({ color: 0x242820, roughness: 0.48, metalness: 0.14 })
);
pedestal.position.z = 0.11;
pedestal.receiveShadow = true;
pedestal.castShadow = true;
stageGroup.add(pedestal);

// A subtle wire/grid cue gives the main viewport a neutral production-tool feel.
const grid = new THREE.GridHelper(14, 28, 0x394036, 0x252a23);
grid.rotation.x = 0;
grid.position.z = 0.015;
grid.material.transparent = true;
grid.material.opacity = 0.24;
stageGroup.add(grid);

const modelGroup = new THREE.Group();
modelGroup.position.set(0, 0, 0);
scene.add(modelGroup);

const lookTarget = new THREE.Object3D();
lookTarget.position.set(0, 0, 1.25);
scene.add(lookTarget);

const lightRoot = new THREE.Group();
scene.add(lightRoot);

const loaderManager = new THREE.LoadingManager();
const gltfLoader = new GLTFLoader(loaderManager);

const HDRIS = {
  royal: 'https://threejs.org/examples/textures/equirectangular/royal_esplanade_1k.hdr',
  venice: 'https://threejs.org/examples/textures/equirectangular/venice_sunset_1k.hdr',
  studio: 'https://threejs.org/examples/textures/equirectangular/empty_warehouse_01_1k.hdr',
};

const lightGlyphs = new Map();
const areaHelpers = new Map();
const lightDefaults = [
  { name: 'Key', type: 'area', x: 2.8, y: -2, z: 3.8, intensity: 35, temperature: 5200, size: 2.4, colorMode: 'temp', enabled: true },
  { name: 'Fill', type: 'point', x: -2.8, y: -1.2, z: 2.2, intensity: 9, temperature: 4200, size: 1.6, colorMode: 'temp', enabled: true },
  { name: 'Rim', type: 'spot', x: 1.6, y: 2.6, z: 4.4, intensity: 16, temperature: 6200, size: 1.4, angle: 30, softness: 0.38, colorMode: 'temp', enabled: true },
];

function setStatus(textValue, busy = false) {
  dom.statusPill.childNodes[1].textContent = textValue;
  dom.statusPill.querySelector('i').style.background = busy ? '#d8b27a' : '#91aa75';
}

function showToast(message) {
  const now = performance.now();
  if (now - state.lastToast < 250) return;
  state.lastToast = now;
  dom.toast.textContent = message;
  dom.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => dom.toast.classList.remove('show'), 1800);
}

function disposeObject(root) {
  if (!root) return;
  root.traverse((object) => {
    if (object.geometry) object.geometry.dispose?.();
    if (object.material) {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        Object.values(material).forEach((value) => {
          if (value?.isTexture) value.dispose?.();
        });
        material.dispose?.();
      });
    }
  });
}

function kelvinToHex(kelvin) {
  const temperature = clamp(Number(kelvin) || 6500, 1000, 40000) / 100;
  let red, green, blue;
  if (temperature <= 66) {
    red = 255;
    green = 99.4708025861 * Math.log(temperature) - 161.1195681661;
    blue = temperature <= 19 ? 0 : 138.5177312231 * Math.log(temperature - 10) - 305.0447927307;
  } else {
    red = 329.698727446 * Math.pow(temperature - 60, -0.1332047592);
    green = 288.1221695283 * Math.pow(temperature - 60, -0.0755148492);
    blue = 255;
  }
  const c = new THREE.Color(clamp(red,0,255)/255, clamp(green,0,255)/255, clamp(blue,0,255)/255);
  return `#${c.getHexString()}`;
}

function powerScale(type) {
  return { point: 0.45, spot: 0.55, area: 24, sun: 0.022 }[type] ?? 1;
}

function lightIcon(type) {
  return { area: '▣', point: '●', spot: '◒', sun: '↗' }[type] ?? '●';
}

function makeLightState(config) {
  const id = ++state.lightId;
  const stateItem = {
    id,
    name: config.name ?? `Light ${id}`,
    type: config.type ?? 'point',
    x: config.x ?? 0,
    y: config.y ?? -2,
    z: config.z ?? 3,
    intensity: config.intensity ?? 10,
    temperature: config.temperature ?? 5600,
    color: config.color ?? kelvinToHex(config.temperature ?? 5600),
    colorMode: config.colorMode ?? 'temp',
    size: config.size ?? 2,
    angle: config.angle ?? 30,
    softness: config.softness ?? 0.35,
    enabled: config.enabled ?? true,
  };
  stateItem.object = createLightObject(stateItem);
  lightRoot.add(stateItem.object);
  state.lights.push(stateItem);
  return stateItem;
}

function createLightObject(item) {
  let light;
  const color = item.colorMode === 'temp' ? kelvinToHex(item.temperature) : item.color;
  const intensity = item.intensity * powerScale(item.type);

  if (item.type === 'area') {
    light = new THREE.RectAreaLight(color, intensity, item.size, item.size);
  } else if (item.type === 'spot') {
    light = new THREE.SpotLight(color, intensity, 30, deg(item.angle), item.softness, 2);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.bias = -0.0002;
    light.target = lookTarget;
  } else if (item.type === 'sun') {
    light = new THREE.DirectionalLight(color, intensity);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.camera.near = 0.5;
    light.shadow.camera.far = 20;
    light.shadow.camera.left = -8;
    light.shadow.camera.right = 8;
    light.shadow.camera.top = 8;
    light.shadow.camera.bottom = -8;
    light.shadow.bias = -0.00015;
    light.target = lookTarget;
  } else {
    light = new THREE.PointLight(color, intensity, 0, 2);
  }

  light.position.set(item.x, item.y, Math.max(0, item.z));
  light.userData.beamLightId = item.id;
  light.userData.kind = item.type;
  light.userData.sourceState = item;
  if (item.type === 'area' || item.type === 'spot' || item.type === 'sun') light.lookAt(lookTarget.position);

  const glyph = new THREE.Mesh(
    new THREE.SphereGeometry(item.type === 'area' ? 0.12 : 0.105, 16, 12),
    new THREE.MeshBasicMaterial({ color: color, toneMapped: false })
  );
  glyph.userData.beamGlyph = true;
  glyph.userData.beamLightId = item.id;
  glyph.visible = true;
  glyph.position.copy(light.position);
  lightRoot.add(glyph);
  lightGlyphs.set(item.id, glyph);

  if (item.type === 'area') {
    const helper = new RectAreaLightHelper(light);
    helper.position.copy(light.position);
    light.add(helper);
    areaHelpers.set(item.id, helper);
  }
  applyLightState(item, light);
  return light;
}

function applyLightState(item, object) {
  if (!object) return;
  const color = item.colorMode === 'temp' ? kelvinToHex(item.temperature) : item.color;
  object.position.set(item.x, item.y, Math.max(0, item.z));
  object.intensity = item.intensity * powerScale(item.type);
  object.color?.set(color);
  object.visible = item.enabled;
  object.userData.kind = item.type;
  object.userData.sourceState = item;
  if (item.type === 'spot') {
    object.angle = deg(item.angle);
    object.penumbra = item.softness;
    object.target = lookTarget;
    object.lookAt(lookTarget.position);
    object.castShadow = true;
  }
  if (item.type === 'sun') {
    object.target = lookTarget;
    object.lookAt(lookTarget.position);
    object.castShadow = true;
  }
  if (item.type === 'area') {
    object.width = item.size;
    object.height = item.size;
    object.lookAt(lookTarget.position);
  }
  const glyph = lightGlyphs.get(item.id);
  if (glyph) {
    glyph.position.copy(object.position);
    glyph.visible = item.enabled;
    glyph.material.color.set(color);
  }
  const helper = areaHelpers.get(item.id);
  if (helper) helper.update?.();
}

function replaceLightObject(item) {
  const existing = item.object;
  if (existing) {
    lightRoot.remove(existing);
    existing.target && existing.target !== lookTarget && lightRoot.remove(existing.target);
    disposeObject(existing);
  }
  const glyph = lightGlyphs.get(item.id);
  if (glyph) { lightRoot.remove(glyph); glyph.geometry.dispose(); glyph.material.dispose(); }
  lightGlyphs.delete(item.id);
  areaHelpers.delete(item.id);
  item.object = createLightObject(item);
}

function removeLight(item) {
  lightRoot.remove(item.object);
  item.object?.target && item.object.target !== lookTarget && lightRoot.remove(item.object.target);
  disposeObject(item.object);
  const glyph = lightGlyphs.get(item.id);
  if (glyph) { lightRoot.remove(glyph); glyph.geometry.dispose(); glyph.material.dispose(); }
  lightGlyphs.delete(item.id);
  areaHelpers.delete(item.id);
  const index = state.lights.findIndex((light) => light.id === item.id);
  if (index >= 0) state.lights.splice(index, 1);
}

function selectLight(id) {
  state.selectedLightId = id;
  refreshLightUI();
  drawControlViews();
}

function getSelectedLight() {
  return state.lights.find((light) => light.id === state.selectedLightId) ?? state.lights[0] ?? null;
}

function renderLightList() {
  dom.lightList.innerHTML = '';
  state.lights.forEach((item) => {
    const button = document.createElement('button');
    button.className = `light-item${item.id === state.selectedLightId ? ' selected' : ''}`;
    button.type = 'button';
    button.innerHTML = `
      <span class="light-icon">${lightIcon(item.type)}</span>
      <span>
        <span class="light-name">${escapeHtml(item.name)}</span>
        <span class="light-meta">${item.type === 'sun' ? 'Sun' : item.type[0].toUpperCase() + item.type.slice(1)} · ${Math.round(item.intensity)}</span>
      </span>
      <span class="light-on${item.enabled ? '' : ' off'}"></span>
    `;
    button.addEventListener('click', () => selectLight(item.id));
    button.addEventListener('dblclick', () => {
      item.enabled = !item.enabled;
      applyLightState(item, item.object);
      renderLightList();
      drawControlViews();
    });
    dom.lightList.appendChild(button);
  });
  dom.lightCount.textContent = `${state.lights.length} / ${state.maxLights}`;
}

function refreshLightUI() {
  const item = getSelectedLight();
  if (!item) return;
  dom.selectedLightName.textContent = item.name;
  dom.lightType.value = item.type;
  dom.lightIntensity.value = item.intensity.toFixed(0);
  dom.lightTemperature.value = item.temperature;
  dom.lightColor.value = item.color;
  dom.lightX.value = item.x;
  dom.lightXValue.textContent = item.x.toFixed(2);
  dom.lightY.value = item.y;
  dom.lightYValue.textContent = item.y.toFixed(2);
  dom.lightZ.value = item.z;
  dom.lightZValue.textContent = item.z.toFixed(2);
  dom.areaSize.value = item.size;
  dom.areaSizeValue.textContent = item.size.toFixed(2);
  dom.spotAngle.value = item.angle;
  dom.spotAngleValue.textContent = `${Math.round(item.angle)}°`;
  dom.spotSoftness.value = item.softness;
  dom.spotSoftnessValue.textContent = Number(item.softness).toFixed(2);
  dom.areaControls.style.display = item.type === 'area' ? 'grid' : 'none';
  dom.spotControls.style.display = item.type === 'spot' ? 'block' : 'none';
  document.querySelectorAll('[data-color-mode]').forEach(btn => btn.classList.toggle('active', btn.dataset.colorMode === item.colorMode));
  renderLightList();
}

function updateSelectedLight(patch, { rebuild = false } = {}) {
  const item = getSelectedLight();
  if (!item) return;
  Object.assign(item, patch);
  if (rebuild) replaceLightObject(item); else applyLightState(item, item.object);
  refreshLightUI();
  drawControlViews();
}

function addLight(config = {}) {
  if (state.lights.length >= state.maxLights) {
    showToast('10 lights is the current scene limit');
    return;
  }
  const base = getSelectedLight();
  const item = makeLightState({
    name: config.name ?? `Light ${state.lights.length + 1}`,
    type: config.type ?? 'point',
    x: clamp((base?.x ?? 0) * -0.65, -7, 7),
    y: clamp((base?.y ?? -2) + 0.6, -7, 7),
    z: clamp((base?.z ?? 3) + 0.2, 0.5, 7.5),
    intensity: config.intensity ?? 12,
    temperature: config.temperature ?? 5600,
    colorMode: 'temp',
    size: config.size ?? 2,
    angle: config.angle ?? 30,
    softness: config.softness ?? .35,
    enabled: true,
  });
  state.selectedLightId = item.id;
  refreshLightUI();
  drawControlViews();
}

function duplicateSelectedLight() {
  const item = getSelectedLight();
  if (!item) return;
  addLight({
    name: `${item.name} copy`, type: item.type, intensity: item.intensity,
    temperature: item.temperature, size: item.size, angle: item.angle, softness: item.softness
  });
  const copy = getSelectedLight();
  copy.x = item.x + 0.8;
  copy.y = item.y + 0.4;
  copy.z = item.z + 0.2;
  copy.color = item.color;
  copy.colorMode = item.colorMode;
  applyLightState(copy, copy.object);
  refreshLightUI();
  drawControlViews();
}

function deleteSelectedLight() {
  const item = getSelectedLight();
  if (!item) return;
  if (state.lights.length <= 1) {
    showToast('Keep at least one light in the scene');
    return;
  }
  removeLight(item);
  state.selectedLightId = state.lights[Math.max(0, state.lights.length - 1)].id;
  refreshLightUI();
  drawControlViews();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>\"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}

// -----------------------------------------------------------------------------
// Procedural reference models
// -----------------------------------------------------------------------------

function makeSkinMaterial(variant) {
  const colors = {
    neutral: 0xb8896d,
    masculine: 0xa9765c,
    feminine: 0xc38f76,
    hand: 0xb68167,
  };
  return new THREE.MeshStandardMaterial({
    color: colors[variant] ?? colors.neutral,
    roughness: 0.68,
    metalness: 0,
  });
}

function addSoftSphere(parent, radius, position, scale, material) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 32), material);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addCapsuleLike(parent, radius, length, position, rotation, material, segments = 32) {
  const group = new THREE.Group();
  group.position.set(...position);
  group.rotation.set(...rotation);
  const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * .98, length, segments, 1, false), material);
  cylinder.rotation.x = Math.PI / 2;
  cylinder.castShadow = true;
  cylinder.receiveShadow = true;
  cylinder.position.z = length / 2;
  group.add(cylinder);
  addSoftSphere(group, radius, [0, 0, 0], [1,1,1], material);
  addSoftSphere(group, radius * .98, [0, 0, length], [1,1,1], material);
  parent.add(group);
  return group;
}

function createHead(variant = 'neutral') {
  const root = new THREE.Group();
  const material = makeSkinMaterial(variant);
  const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x2d251f, roughness: .8 });
  const innerMaterial = new THREE.MeshStandardMaterial({ color: 0x5c3e31, roughness: .9 });

  const profile = {
    neutral: { cranium: [0.83,0.74,1.02], face: [0.69,0.62,0.76], jaw: [0.7,0.65,0.5], noseZ: 0.12, noseScale: [0.16,0.15,0.34], chin: [0,0,0] },
    masculine: { cranium: [0.9,0.78,1.0], face: [0.73,0.64,0.77], jaw: [0.77,0.7,0.55], noseZ: 0.15, noseScale: [0.18,0.17,0.36], chin: [0,0,0.02] },
    feminine: { cranium: [0.79,0.71,1.01], face: [0.66,0.59,0.76], jaw: [0.66,0.59,0.46], noseZ: 0.1, noseScale: [0.14,0.13,0.3], chin: [0,0,0] },
  }[variant] ?? null;

  addSoftSphere(root, 1, [0, 0, 2.02], profile.cranium, material);
  addSoftSphere(root, .82, [0, -0.03, 1.47], profile.face, material);
  addSoftSphere(root, .66, [0, -0.01, 0.98], profile.jaw, material);
  addSoftSphere(root, .34, [0, -0.02, 0.67], [1.0,.88,.88], material);
  addCapsuleLike(root, .27, 1.0, [0, 0.02, 0], [0,0,0], material, 32);

  // Ears.
  addSoftSphere(root, .17, [-.76, 0, 1.56], [0.58, .7, 1.18], material);
  addSoftSphere(root, .17, [.76, 0, 1.56], [0.58, .7, 1.18], material);

  // Nose and cheek planes.
  addSoftSphere(root, 1, [0, -0.63, 1.46], profile.noseScale, material);
  addSoftSphere(root, .38, [-.33,-.43,1.35], [.92,.7,.64], material);
  addSoftSphere(root, .38, [.33,-.43,1.35], [.92,.7,.64], material);

  // Eyes are intentionally simple and low-contrast: they are orientation cues, not a character.
  addSoftSphere(root, .09, [-.28,-.58,1.7], [1.15,.55,.72], eyeMaterial);
  addSoftSphere(root, .09, [.28,-.58,1.7], [1.15,.55,.72], eyeMaterial);
  addSoftSphere(root, .035, [-.28,-.65,1.70], [1,1,1], innerMaterial);
  addSoftSphere(root, .035, [.28,-.65,1.70], [1,1,1], innerMaterial);

  const mouth = new THREE.Mesh(new THREE.BoxGeometry(.34,.05,.035), innerMaterial);
  mouth.position.set(0,-.61,1.07);
  mouth.castShadow = true;
  root.add(mouth);

  // Shoulders.
  addSoftSphere(root, 1, [0,0,0.1], [1.45, .88, .38], material);

  return root;
}

function createHand() {
  const root = new THREE.Group();
  const material = makeSkinMaterial('hand');
  const palm = new THREE.Mesh(new THREE.BoxGeometry(1.4, .56, 1.62), material);
  palm.position.set(0, 0, 0.96);
  palm.scale.set(.98, .9, 1);
  palm.castShadow = true;
  palm.receiveShadow = true;
  root.add(palm);

  const fingerXs = [-.54,-.27,0,.27,.54];
  const fingerLengths = [1.0,1.28,1.48,1.3,1.05];
  fingerXs.forEach((x, index) => {
    const length = fingerLengths[index];
    const group = new THREE.Group();
    group.position.set(x, 0, 1.73);
    const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(.12, .13, length, 28), material);
    cylinder.position.z = length / 2;
    cylinder.castShadow = true;
    cylinder.receiveShadow = true;
    group.add(cylinder);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(.12, 28, 18), material);
    tip.position.z = length;
    tip.castShadow = true;
    group.add(tip);
    root.add(group);
  });

  const thumb = new THREE.Group();
  thumb.position.set(-.78,0,1.05);
  thumb.rotation.y = deg(-35);
  addCapsuleLike(thumb, .16, .86, [0,0,0], [0,0,deg(-24)], material, 28);
  root.add(thumb);

  return root;
}

function makeBuiltIn(kind) {
  const root = kind === 'hand' ? createHand() : createHead(kind === 'masculine-head' ? 'masculine' : kind === 'feminine-head' ? 'feminine' : 'neutral');
  root.userData.builtIn = true;
  root.userData.kind = kind;
  return root;
}

function setModel(root, sourceLabel = 'Built-in') {
  if (state.model) {
    modelGroup.remove(state.model);
    disposeObject(state.model);
  }
  state.model = root;
  state.modelSource = sourceLabel;
  state.modelScale = 1;
  state.modelZ = 0;
  dom.modelScale.value = '1';
  dom.modelScaleValue.textContent = '1.00×';
  dom.modelZ.value = '0';
  dom.modelZValue.textContent = '0.00';
  root.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
      if (object.material?.roughness == null && object.material?.isMeshStandardMaterial) object.material.roughness = .7;
    }
  });

  // Center X/Y and put the lowest point on Z=0 so only the deliberate Z offset remains user-controlled.
  root.position.set(0,0,0);
  root.scale.setScalar(1);
  const box = new THREE.Box3().setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  root.position.x -= center.x;
  root.position.y -= center.y;
  root.position.z -= box.min.z;
  modelGroup.add(root);
  state.modelKind = root.userData.kind ?? 'uploaded-model';
  state.modelSource = sourceLabel;
  dom.modelSource.textContent = sourceLabel;
  dom.sceneLabel.textContent = root.userData.builtIn ? modelDisplayName(root.userData.kind) : 'Uploaded model';
  setupRigFromModel(root);
  frameModel(false);
}

function modelDisplayName(kind) {
  return {
    'neutral-head': 'Neutral Head',
    'masculine-head': 'Masculine Head',
    'feminine-head': 'Feminine Head',
    'hand': 'Right Hand',
  }[kind] ?? 'Reference Model';
}

function frameModel(save = true) {
  if (!state.model) return;
  const box = new THREE.Box3().setFromObject(state.model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z);
  const distance = clamp(maxSize * 2.8, 3.4, 12);
  const direction = new THREE.Vector3(0.66, -0.78, 0.44).normalize();
  camera.position.copy(center).addScaledVector(direction, distance);
  controls.target.copy(center);
  controls.minDistance = Math.max(.8, maxSize * .8);
  controls.maxDistance = Math.max(14, maxSize * 8);
  controls.update();
  if (save) controls.saveState();
}

function updateModelTransform() {
  if (!state.model) return;
  state.model.scale.setScalar(state.modelScale);
  state.model.position.z = state.modelZ;
  dom.modelScaleValue.textContent = `${state.modelScale.toFixed(2)}×`;
  dom.modelZValue.textContent = state.modelZ.toFixed(2);
}

function setupRigFromModel(root) {
  if (state.animationMixer) state.animationMixer.stopAllAction();
  state.animationMixer = null;
  state.activeAction = null;
  state.bones = [];
  state.boneDefaults = new Map();
  dom.animationSelect.innerHTML = '';
  dom.boneSelect.innerHTML = '';
  dom.animationToggle.checked = false;

  const animations = root.userData.gltfAnimations ?? [];
  const bones = [];
  root.traverse((object) => {
    if (object.isBone) bones.push(object);
  });
  state.bones = bones;
  bones.forEach((bone) => state.boneDefaults.set(bone.uuid, bone.rotation.clone()));

  if (animations.length || bones.length) {
    dom.rigSection.classList.remove('hidden');
    dom.rigLabel.textContent = bones.length ? `${bones.length} bones` : `${animations.length} clips`;
  } else {
    dom.rigSection.classList.add('hidden');
    return;
  }

  if (animations.length) {
    const none = document.createElement('option');
    none.value = '';
    none.textContent = 'None';
    dom.animationSelect.appendChild(none);
    animations.forEach((clip) => {
      const option = document.createElement('option');
      option.value = clip.uuid;
      option.textContent = clip.name || 'Animation';
      dom.animationSelect.appendChild(option);
    });
    state.animationMixer = new THREE.AnimationMixer(root);
  }

  if (bones.length) {
    bones.slice(0, 120).forEach((bone) => {
      const option = document.createElement('option');
      option.value = bone.uuid;
      option.textContent = bone.name || `Bone ${bones.indexOf(bone)+1}`;
      dom.boneSelect.appendChild(option);
    });
    dom.boneSelect.value = bones[0].uuid;
    syncBoneUI();
  }
}

function syncBoneUI() {
  const bone = state.bones.find((candidate) => candidate.uuid === dom.boneSelect.value);
  if (!bone) return;
  dom.boneX.value = Math.round(rad(bone.rotation.x));
  dom.boneY.value = Math.round(rad(bone.rotation.y));
  dom.boneZ.value = Math.round(rad(bone.rotation.z));
  dom.boneXValue.textContent = `${Math.round(rad(bone.rotation.x))}°`;
  dom.boneYValue.textContent = `${Math.round(rad(bone.rotation.y))}°`;
  dom.boneZValue.textContent = `${Math.round(rad(bone.rotation.z))}°`;
}

function updateBone(axis, value) {
  const bone = state.bones.find((candidate) => candidate.uuid === dom.boneSelect.value);
  if (!bone) return;
  bone.rotation[axis] = deg(Number(value));
  syncBoneUI();
}

function resetPose() {
  state.bones.forEach((bone) => {
    const original = state.boneDefaults.get(bone.uuid);
    if (original) bone.rotation.copy(original);
  });
  syncBoneUI();
  showToast('Pose reset');
}

// -----------------------------------------------------------------------------
// GLTF / GLB upload support
// -----------------------------------------------------------------------------

async function loadModelFiles(files) {
  const list = Array.from(files);
  const modelFile = list.find((file) => /\.(glb|gltf)$/i.test(file.name));
  if (!modelFile) {
    showToast('Choose a .glb or .gltf model');
    return;
  }

  const objectURLs = new Map();
  list.forEach((file) => objectURLs.set(file.name, URL.createObjectURL(file)));
  state.modelFiles = list;
  setStatus('Loading model', true);
  dom.loading.classList.remove('done');

  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => {
    const clean = decodeURIComponent(url).split('?')[0];
    const base = clean.split('/').pop();
    return objectURLs.get(url) ?? objectURLs.get(base) ?? url;
  });
  const localLoader = new GLTFLoader(manager);

  try {
    const gltf = await localLoader.loadAsync(URL.createObjectURL(modelFile));
    const root = gltf.scene || gltf.scenes?.[0];
    if (!root) throw new Error('No scene found in model');

    // glTF uses Y-up; Beam uses Blender-like Z-up controls internally.
    root.rotation.x = -Math.PI / 2;
    root.userData.kind = 'uploaded-model';
    root.userData.gltfAnimations = gltf.animations ?? [];
    root.userData.sourceFile = modelFile.name;
    setModel(root, modelFile.name);
    showToast(`Loaded ${modelFile.name}`);
    setStatus('Ready');
  } catch (error) {
    console.error(error);
    showToast('Model could not be loaded. Try a GLB first.');
    setStatus('Ready');
  } finally {
    list.forEach((file) => {
      const url = objectURLs.get(file.name);
      // Keep URLs alive for textures until the current model is replaced.
      if (!/\.(png|jpg|jpeg|webp)$/i.test(file.name)) URL.revokeObjectURL(url);
    });
    dom.loading.classList.add('done');
  }
}

// -----------------------------------------------------------------------------
// Environment
// -----------------------------------------------------------------------------

async function loadHDRI(key) {
  if (!HDRIS[key]) return;
  if (state.envCache.has(key)) {
    applyHDRTexture(state.envCache.get(key));
    return;
  }
  setStatus('Loading HDRI', true);
  try {
    const loader = new HDRLoader();
    const texture = await loader.loadAsync(HDRIS[key]);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    state.envCache.set(key, texture);
    applyHDRTexture(texture);
    setStatus('Ready');
  } catch (error) {
    console.error(error);
    showToast('HDRI failed to load; using solid world');
    setStatus('Ready');
    setEnvironmentMode('solid');
  }
}

function applyHDRTexture(texture) {
  scene.background = texture;
  scene.environment = texture;
  scene.environmentIntensity = state.envStrength;
}

function setEnvironmentMode(mode) {
  state.environmentMode = mode;
  document.querySelectorAll('[data-env-mode]').forEach((btn) => btn.classList.toggle('active', btn.dataset.envMode === mode));
  dom.solidEnv.classList.toggle('hidden', mode !== 'solid');
  dom.hdriEnv.classList.toggle('hidden', mode !== 'hdri');
  if (mode === 'solid') {
    scene.background = new THREE.Color(dom.worldColor.value);
    scene.environment = null;
    scene.environmentIntensity = state.envStrength;
    setStatus('Ready');
  } else {
    loadHDRI(dom.hdriSelect.value);
  }
}

// -----------------------------------------------------------------------------
// Top / Front control maps
// -----------------------------------------------------------------------------

function fitCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio, 2);
  const width = Math.max(1, Math.floor(rect.width * dpr));
  const height = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return { width, height, dpr };
}

function worldToCanvas(canvas, a, b, range = 8) {
  const { width, height } = fitCanvas(canvas);
  const margin = 24;
  const scale = Math.min((width - margin*2) / (range*2), (height - margin*2) / (range*2));
  return {
    x: width/2 + a * scale,
    y: height/2 - b * scale,
    scale,
  };
}

function canvasToWorld(canvas, px, py, range = 8) {
  const { width, height } = fitCanvas(canvas);
  const margin = 24;
  const scale = Math.min((width - margin*2) / (range*2), (height - margin*2) / (range*2));
  return {
    a: clamp((px - width/2) / scale, -range, range),
    b: clamp((height/2 - py) / scale, -range, range),
  };
}

function drawMapBase(ctx, width, height, range, label) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0b0d0a';
  ctx.fillRect(0,0,width,height);
  const margin = 24;
  const scale = Math.min((width - margin*2) / (range*2), (height - margin*2) / (range*2));
  const cx = width/2, cy = height/2;

  ctx.strokeStyle = 'rgba(255,255,255,.05)';
  ctx.lineWidth = 1;
  for (let n = -range; n <= range; n++) {
    const x = cx + n*scale;
    const y = cy - n*scale;
    ctx.beginPath(); ctx.moveTo(x, margin); ctx.lineTo(x, height-margin); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(margin, y); ctx.lineTo(width-margin, y); ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(200,215,163,.2)';
  ctx.beginPath(); ctx.moveTo(cx, margin); ctx.lineTo(cx,height-margin); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(margin,cy); ctx.lineTo(width-margin,cy); ctx.stroke();

  // model footprint / silhouette cue
  ctx.strokeStyle = 'rgba(240,243,236,.10)';
  ctx.lineWidth = 1.5;
  if (label === 'top') {
    ctx.beginPath(); ctx.ellipse(cx, cy+scale*.25, scale*.82, scale*.47, 0, 0, Math.PI*2); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.ellipse(cx, cy-scale*.2, scale*.82, scale*1.14, 0, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx-scale*.9,cy+scale*1.18); ctx.quadraticCurveTo(cx,cy+scale*.8,cx+scale*.9,cy+scale*1.18); ctx.stroke();
  }

  ctx.fillStyle = 'rgba(240,243,236,.33)';
  ctx.font = '9px ui-sans-serif, system-ui';
  ctx.fillText(label === 'top' ? 'Y' : 'Z', cx + 5, margin + 6);
  ctx.fillText('X', width - margin - 5, cy - 5);
}

function drawLightGlyph(ctx, canvas, item, x, y, selected, type) {
  const color = item.enabled ? (item.colorMode === 'temp' ? kelvinToHex(item.temperature) : item.color) : '#575c53';
  ctx.save();
  ctx.translate(x,y);
  ctx.globalAlpha = item.enabled ? 1 : .45;
  ctx.fillStyle = color;
  ctx.strokeStyle = selected ? '#f2f4eb' : 'rgba(242,244,235,.55)';
  ctx.lineWidth = selected ? 2 : 1;

  if (item.type === 'area') {
    const s = 8 + item.size*1.7;
    ctx.fillRect(-s/2,-s/2,s,s);
    ctx.strokeRect(-s/2,-s/2,s,s);
  } else if (item.type === 'sun') {
    ctx.beginPath(); ctx.arc(0,0,7,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(8,-8); ctx.lineTo(17,-17); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(12,-17); ctx.lineTo(17,-17); ctx.lineTo(17,-12); ctx.stroke();
  } else if (item.type === 'spot') {
    ctx.beginPath(); ctx.moveTo(-7,-6); ctx.lineTo(7,0); ctx.lineTo(-7,6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(16,0); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(0,0,7,0,Math.PI*2); ctx.fill(); ctx.stroke();
  }

  if (selected) {
    ctx.strokeStyle = 'rgba(200,215,163,.65)';
    ctx.beginPath(); ctx.arc(0,0,13,0,Math.PI*2); ctx.stroke();
  }
  ctx.restore();
}

function drawControlViews() {
  drawSingleMap(dom.topView, 'top');
  drawSingleMap(dom.frontView, 'front');
}

function drawSingleMap(canvas, view) {
  const { width, height } = fitCanvas(canvas);
  const ctx = canvas.getContext('2d');
  drawMapBase(ctx, width, height, 8, view);
  state.lights.forEach((item) => {
    const p = view === 'top' ? worldToCanvas(canvas, item.x, item.y) : worldToCanvas(canvas, item.x, item.z);
    drawLightGlyph(ctx, canvas, item, p.x, p.y, item.id === state.selectedLightId, view);
  });
}

function findClosestLight(canvas, px, py, view) {
  let closest = null;
  let dist = Infinity;
  state.lights.forEach((item) => {
    const p = view === 'top' ? worldToCanvas(canvas, item.x, item.y) : worldToCanvas(canvas, item.x, item.z);
    const d = Math.hypot(p.x - px, p.y - py);
    if (d < 24 && d < dist) { closest = item; dist = d; }
  });
  return closest;
}

function bindControlCanvas(canvas, view) {
  const getXY = (event) => {
    const rect = canvas.getBoundingClientRect();
    const dprX = canvas.width / rect.width;
    const dprY = canvas.height / rect.height;
    return { x: (event.clientX - rect.left) * dprX, y: (event.clientY - rect.top) * dprY };
  };

  canvas.addEventListener('pointerdown', (event) => {
    const {x,y} = getXY(event);
    const hit = findClosestLight(canvas, x, y, view);
    if (!hit) return;
    state.drag = { view, id: hit.id, pointerId: event.pointerId };
    selectLight(hit.id);
    canvas.setPointerCapture?.(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!state.drag || state.drag.view !== view || state.drag.pointerId !== event.pointerId) return;
    const {x,y} = getXY(event);
    const world = canvasToWorld(canvas, x, y);
    const item = state.lights.find((light) => light.id === state.drag.id);
    if (!item) return;
    item.x = world.a;
    if (view === 'top') item.y = world.b;
    else item.z = clamp(world.b, 0, 8);
    applyLightState(item, item.object);
    refreshLightUI();
    drawControlViews();
  });
  const release = (event) => {
    if (state.drag?.pointerId === event.pointerId) state.drag = null;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
}

bindControlCanvas(dom.topView, 'top');
bindControlCanvas(dom.frontView, 'front');

// -----------------------------------------------------------------------------
// UI bindings
// -----------------------------------------------------------------------------

$('add-light').addEventListener('click', () => addLight());
$('duplicate-light').addEventListener('click', duplicateSelectedLight);
$('delete-light').addEventListener('click', deleteSelectedLight);
$('frame-model').addEventListener('click', () => frameModel(true));
$('focus-model').addEventListener('click', () => frameModel(true));
$('reset-model').addEventListener('click', () => {
  state.modelScale = 1;
  state.modelZ = 0;
  updateModelTransform();
  frameModel(true);
});
$('reset-scene').addEventListener('click', () => resetScene());
$('open-tools').addEventListener('click', () => $('tool-panel').classList.add('open'));
$('close-tools').addEventListener('click', () => $('tool-panel').classList.remove('open'));

window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 'f' && !/input|select|textarea/.test(event.target.tagName?.toLowerCase() || '')) frameModel(true);
  if (event.key === 'Escape') $('tool-panel').classList.remove('open');
});

dom.modelSelect.addEventListener('change', () => {
  const kind = dom.modelSelect.value;
  setModel(makeBuiltIn(kind), 'Built-in');
});
dom.modelScale.addEventListener('input', () => { state.modelScale = Number(dom.modelScale.value); updateModelTransform(); });
dom.modelZ.addEventListener('input', () => { state.modelZ = Number(dom.modelZ.value); updateModelTransform(); });

['dragenter','dragover'].forEach(type => dom.modelUpload.parentElement.addEventListener(type, (event) => {
  event.preventDefault();
  dom.modelUpload.parentElement.classList.add('dragging');
}));
['dragleave','drop'].forEach(type => dom.modelUpload.parentElement.addEventListener(type, (event) => {
  event.preventDefault();
  dom.modelUpload.parentElement.classList.remove('dragging');
}));
dom.modelUpload.parentElement.addEventListener('drop', (event) => loadModelFiles(event.dataTransfer.files));
dom.modelUpload.addEventListener('change', (event) => loadModelFiles(event.target.files));

dom.lightType.addEventListener('change', () => updateSelectedLight({ type: dom.lightType.value }, { rebuild: true }));
dom.lightIntensity.addEventListener('input', () => updateSelectedLight({ intensity: Number(dom.lightIntensity.value) }));
dom.lightTemperature.addEventListener('input', () => updateSelectedLight({ temperature: Number(dom.lightTemperature.value), color: kelvinToHex(Number(dom.lightTemperature.value)), colorMode: 'temp' }));
dom.lightColor.addEventListener('input', () => updateSelectedLight({ color: dom.lightColor.value, colorMode: 'custom' }));
dom.lightX.addEventListener('input', () => updateSelectedLight({ x: Number(dom.lightX.value) }));
dom.lightY.addEventListener('input', () => updateSelectedLight({ y: Number(dom.lightY.value) }));
dom.lightZ.addEventListener('input', () => updateSelectedLight({ z: Number(dom.lightZ.value) }));
dom.areaSize.addEventListener('input', () => updateSelectedLight({ size: Number(dom.areaSize.value) }));
dom.spotAngle.addEventListener('input', () => updateSelectedLight({ angle: Number(dom.spotAngle.value) }));
dom.spotSoftness.addEventListener('input', () => updateSelectedLight({ softness: Number(dom.spotSoftness.value) }));

document.querySelectorAll('[data-color-mode]').forEach((button) => button.addEventListener('click', () => {
  const item = getSelectedLight();
  if (!item) return;
  if (button.dataset.colorMode === 'temp') {
    item.colorMode = 'temp';
    item.color = kelvinToHex(item.temperature);
  } else {
    item.colorMode = 'custom';
  }
  applyLightState(item, item.object);
  refreshLightUI();
  drawControlViews();
}));

document.querySelectorAll('[data-env-mode]').forEach((button) => button.addEventListener('click', () => setEnvironmentMode(button.dataset.envMode)));
dom.worldColor.addEventListener('input', () => { if (state.environmentMode === 'solid') scene.background = new THREE.Color(dom.worldColor.value); });
dom.envStrength.addEventListener('input', () => {
  state.envStrength = Number(dom.envStrength.value);
  dom.envStrengthValue.textContent = state.envStrength.toFixed(2);
  scene.environmentIntensity = state.envStrength;
});
dom.hdriSelect.addEventListener('change', () => loadHDRI(dom.hdriSelect.value));

dom.animationSelect.addEventListener('change', () => {
  if (!state.animationMixer) return;
  state.animationMixer.stopAllAction();
  state.activeAction = null;
  const clip = state.model?.userData.gltfAnimations?.find((candidate) => candidate.uuid === dom.animationSelect.value);
  if (clip) {
    state.activeAction = state.animationMixer.clipAction(clip);
    state.activeAction.play();
    dom.animationToggle.checked = true;
  } else {
    dom.animationToggle.checked = false;
  }
});
dom.animationToggle.addEventListener('change', () => {
  if (!state.activeAction) return;
  if (dom.animationToggle.checked) state.activeAction.play(); else state.activeAction.stop();
});
dom.boneSelect.addEventListener('change', syncBoneUI);
['x','y','z'].forEach((axis) => $(axis === 'x' ? 'bone-x' : axis === 'y' ? 'bone-y' : 'bone-z').addEventListener('input', (event) => updateBone(axis, event.target.value)));
$('reset-pose').addEventListener('click', resetPose);

controls.addEventListener('change', () => {
  const p = controls.target;
  dom.mainCoordinates.textContent = `X ${p.x.toFixed(2)} · Y ${p.y.toFixed(2)} · Z ${p.z.toFixed(2)}`;
});

function resetScene() {
  state.lights.slice().forEach(removeLight);
  state.selectedLightId = null;
  lightDefaults.forEach((config) => makeLightState(config));
  state.selectedLightId = state.lights[0].id;
  dom.modelSelect.value = 'neutral-head';
  setModel(makeBuiltIn('neutral-head'), 'Built-in');
  dom.worldColor.value = '#151712';
  dom.envStrength.value = '.35';
  state.envStrength = .35;
  dom.envStrengthValue.textContent = '.35';
  setEnvironmentMode('solid');
  frameModel(true);
  refreshLightUI();
  drawControlViews();
  showToast('Scene reset');
}

// -----------------------------------------------------------------------------
// Render loop and sizing
// -----------------------------------------------------------------------------

function resize() {
  const width = Math.max(1, dom.mainViewport.clientWidth);
  const height = Math.max(1, dom.mainViewport.clientHeight);
  const aspect = width / height;
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  drawControlViews();
}

window.addEventListener('resize', resize);
const resizeObserver = new ResizeObserver(resize);
resizeObserver.observe(dom.mainViewport);
resizeObserver.observe(dom.topView);
resizeObserver.observe(dom.frontView);

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  controls.update();
  if (state.animationMixer && state.activeAction && dom.animationToggle.checked) state.animationMixer.update(delta);
  renderer.render(scene, camera);
}

// Initial scene.
lightDefaults.forEach((config) => makeLightState(config));
state.selectedLightId = state.lights[0].id;
setModel(makeBuiltIn('neutral-head'), 'Built-in');
refreshLightUI();
resize();
drawControlViews();
dom.loading.classList.add('done');
setStatus('Ready');
animate();
