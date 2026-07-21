import * as THREE from "three";
import { RoundedBoxGeometry } from "jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "jsm/environments/RoomEnvironment.js";

const w = window.innerWidth;
const h = window.innerHeight;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
camera.position.z = 5;
const canvas = document.getElementById('three-canvas');
// alpha: true is what lets the page's warm gradient show through behind the
// laptop — without it the canvas clears to opaque black whatever the clear
// colour's alpha says.
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, canvas });
renderer.setSize(w, h);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x000000, 0);
// Filmic tone mapping keeps the aluminium highlights from clipping to white.
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
let macbook;
const screenTextureLoader = new THREE.TextureLoader();
const screenTextureCache = new Map();
let fallbackScreenTexture = null;

let scrollPosY = 0;
const openScrollPortion = 0.05; // portion of scroll that opens the laptop
const contentRevealPortion = 0.05;
// Start laptop on the right side
const initialLaptopPosition = new THREE.Vector3(3.5, -0.3, -1.3); // moved right with x=3.5
let contentVisible = false;

function createFallbackTexture() {
  const fallbackCanvas = document.createElement("canvas");
  fallbackCanvas.width = 1920;
  fallbackCanvas.height = 1080;
  const ctx = fallbackCanvas.getContext("2d");
  ctx.fillStyle = "#2b211a";
  ctx.fillRect(0, 0, fallbackCanvas.width, fallbackCanvas.height);
  ctx.fillStyle = "#f5efe6";
  ctx.font = "bold 80px Work Sans, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Screen image missing", fallbackCanvas.width / 2, fallbackCanvas.height / 2);
  return new THREE.CanvasTexture(fallbackCanvas);
}

function applyScreenTexture(texture) {
  if (!macbook || !macbook.userData?.display) return;
  const material = macbook.userData.display.material;
  material.map = texture;
  material.needsUpdate = true;
}

function setScreenImage(path) {
  if (!path || !macbook) return;

  if (screenTextureCache.has(path)) {
    applyScreenTexture(screenTextureCache.get(path));
    return;
  }

  screenTextureLoader.load(
    path,
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      screenTextureCache.set(path, texture);
      applyScreenTexture(texture);
    },
    undefined,
    () => {
      if (!fallbackScreenTexture) {
        fallbackScreenTexture = createFallbackTexture();
      }
      applyScreenTexture(fallbackScreenTexture);
    }
  );
}

// ============================================
// MACBOOK MODEL
// ============================================
// Proportions follow a 13" MacBook Air: the body is 4.2 units wide and every
// other measurement is derived from that, so the thing stays believable.
const BODY_W = 4.2;
const BODY_D = 2.9;
const BODY_H = 0.16;
const LID_H = 2.78;
const LID_T = 0.055;

// Where the lid sits inside the hinge group. Rotating that group by +90° lays
// the lid flat on the body — which is what "closed" means to setOpenAngle().
const HINGE_Y = 0.09;
const HINGE_Z = -1.40;
const LID_Z = -0.10;

// A Mac keyboard reads as a Mac keyboard because of the key *widths* — a grid
// of identical squares is the single biggest giveaway of a fake laptop model.
function createKeyboard(keycapMaterial) {
  const keys = new THREE.Group();
  // One unit cube scaled per key: ~78 keycaps off a single shared geometry.
  const keyGeometry = new RoundedBoxGeometry(1, 1, 1, 2, 0.16);

  const wellW = 3.42;
  const wellD = 1.30;
  const gap = 0.032;
  const keyH = 0.03;

  const rows = [
    { depth: 0.66, keys: [1.55, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },  // esc + F1–F12
    { depth: 1, keys: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.55] },  // ` 1…0 – = delete
    { depth: 1, keys: [1.55, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },  // tab q…\
    { depth: 1, keys: [1.8, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.75] },   // caps a…return
    { depth: 1, keys: [2.3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.8] },       // shift z…shift
    { depth: 1, bottom: true }                                           // modifiers + arrows
  ];

  const addKey = (x, w, z, d) => {
    const key = new THREE.Mesh(keyGeometry, keycapMaterial);
    key.scale.set(w, keyH, d);
    key.position.set(x, 0, z);
    keys.add(key);
  };

  const depthUnits = rows.reduce((sum, r) => sum + r.depth, 0);
  const rowDepth = wellD / depthUnits;
  let zCursor = -wellD / 2;

  for (const row of rows) {
    const d = row.depth * rowDepth;
    const z = zCursor + d / 2;
    zCursor += d;

    if (!row.bottom) {
      const units = row.keys.reduce((a, b) => a + b, 0);
      const unitW = (wellW - gap * (row.keys.length - 1)) / units;
      let x = -wellW / 2;
      for (const widthInUnits of row.keys) {
        const w = widthInUnits * unitW;
        addKey(x + w / 2, w, z, d - gap);
        x += w + gap;
      }
      continue;
    }

    // Bottom row: fn/ctrl/opt/cmd, the spacebar, then the inverted-T arrow
    // cluster where up and down are half-height keys stacked in one column.
    const mods = [1, 1, 1.25, 1.25, 5, 1.25, 1];
    const arrowColumns = 3;
    const units = mods.reduce((a, b) => a + b, 0) + arrowColumns;
    const unitW = (wellW - gap * (mods.length + arrowColumns - 1)) / units;
    let x = -wellW / 2;

    for (const widthInUnits of mods) {
      const w = widthInUnits * unitW;
      addKey(x + w / 2, w, z, d - gap);
      x += w + gap;
    }

    addKey(x + unitW / 2, unitW, z, d - gap);          // ←
    x += unitW + gap;
    const halfD = (d - 2 * gap) / 2;
    addKey(x + unitW / 2, unitW, z - (halfD + gap) / 2, halfD);  // ↑
    addKey(x + unitW / 2, unitW, z + (halfD + gap) / 2, halfD);  // ↓
    x += unitW + gap;
    addKey(x + unitW / 2, unitW, z, d - gap);          // →
  }

  return { keys, wellW, wellD };
}

function createMacBookAir() {
  const laptopGroup = new THREE.Group();

  // ---- Materials ----
  // metalness 1 only looks like metal when there is an environment to reflect;
  // scene.environment is set up in initScene() for exactly this reason.
  const aluminium = new THREE.MeshPhysicalMaterial({
    color: 0xd8cec0, metalness: 1, roughness: 0.34,
    clearcoat: 0.2, clearcoatRoughness: 0.4, envMapIntensity: 1.1
  });
  const aluminiumDark = new THREE.MeshPhysicalMaterial({
    color: 0xb4a999, metalness: 1, roughness: 0.45, envMapIntensity: 0.85
  });
  const keyboardWell = new THREE.MeshPhysicalMaterial({
    color: 0x211c17, metalness: 0.45, roughness: 0.62
  });
  const keycap = new THREE.MeshPhysicalMaterial({
    color: 0x1b1712, metalness: 0.05, roughness: 0.78
  });
  const trackpadGlass = new THREE.MeshPhysicalMaterial({
    color: 0xcdc3b5, metalness: 0.55, roughness: 0.18,
    clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.2
  });
  const displayGlass = new THREE.MeshPhysicalMaterial({
    color: 0x080706, metalness: 0.2, roughness: 0.12,
    clearcoat: 1, clearcoatRoughness: 0.06
  });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x15120f, roughness: 0.9 });
  // The screen is unlit and opted out of tone mapping so the screenshots stay
  // as crisp and bright as the source images.
  const screenMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });

  // ---- Base ----
  const baseGroup = new THREE.Group();

  const body = new THREE.Mesh(
    new RoundedBoxGeometry(BODY_W, BODY_H, BODY_D, 6, 0.045), aluminium);
  body.position.y = BODY_H / 2;
  baseGroup.add(body);

  const { keys, wellW, wellD } = createKeyboard(keycap);
  const wellZ = -0.62;

  // A dark recess under the keys, so they read as sunk into the deck.
  const well = new THREE.Mesh(
    new RoundedBoxGeometry(wellW + 0.10, 0.05, wellD + 0.10, 3, 0.022), keyboardWell);
  well.position.set(0, BODY_H - 0.020, wellZ);
  baseGroup.add(well);

  keys.position.set(0, BODY_H + 0.010, wellZ);
  baseGroup.add(keys);

  const trackpad = new THREE.Mesh(
    new RoundedBoxGeometry(1.62, 0.018, 1.08, 3, 0.022), trackpadGlass);
  trackpad.position.set(0, BODY_H - 0.003, 0.72);
  baseGroup.add(trackpad);

  // A slim hinge bar, and it belongs to the body — the old model span the full
  // width and rotated with the lid, which is what made it look mechanical.
  const hinge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.042, BODY_W * 0.72, 24), aluminiumDark);
  hinge.rotation.z = Math.PI / 2;
  hinge.position.set(0, HINGE_Y, HINGE_Z + 0.03);
  baseGroup.add(hinge);

  const footGeometry = new THREE.CylinderGeometry(0.07, 0.07, 0.018, 16);
  for (const [fx, fz] of [[-1.72, -1.12], [1.72, -1.12], [-1.72, 1.12], [1.72, 1.12]]) {
    const foot = new THREE.Mesh(footGeometry, rubber);
    foot.position.set(fx, 0.004, fz);
    baseGroup.add(foot);
  }

  laptopGroup.add(baseGroup);

  // ---- Lid ----
  const screenGroup = new THREE.Group();
  screenGroup.position.set(0, HINGE_Y, HINGE_Z);

  const lidShell = new THREE.Mesh(
    new RoundedBoxGeometry(BODY_W, LID_H, LID_T, 6, 0.045), aluminium);
  lidShell.position.set(0, LID_H / 2, LID_Z);
  screenGroup.add(lidShell);

  // One sheet of black glass across the whole lid: this is what produces the
  // thin-bezel look instead of the old grey frame around a smaller panel.
  const lidFace = LID_Z + LID_T / 2;
  const glass = new THREE.Mesh(
    new RoundedBoxGeometry(BODY_W - 0.03, LID_H - 0.03, 0.012, 3, 0.04), displayGlass);
  glass.position.set(0, LID_H / 2, lidFace + 0.004);
  screenGroup.add(glass);

  // A plane rather than a box: the screenshot maps 1:1 with no UV surprises.
  const bezelTop = 0.075;
  const displayW = BODY_W - 0.14;
  const displayH = displayW * 10 / 16;              // 16:10, like the real panel
  const display = new THREE.Mesh(
    new THREE.PlaneGeometry(displayW, displayH), screenMaterial);
  display.position.set(0, LID_H - bezelTop - displayH / 2, lidFace + 0.012);
  display.name = 'screen';
  screenGroup.add(display);

  // The notch — the most recognisable detail on a current MacBook.
  const notch = new THREE.Mesh(
    new RoundedBoxGeometry(0.44, 0.072, 0.008, 2, 0.024), displayGlass);
  notch.position.set(0, LID_H - bezelTop - 0.036, lidFace + 0.017);
  screenGroup.add(notch);

  laptopGroup.add(screenGroup);

  laptopGroup.userData = {
    screenGroup: screenGroup,
    baseGroup: baseGroup,
    display: display,
    setOpenAngle: function (angle) {
      const radians = -Math.PI / 2 + (angle * Math.PI / 180);
      screenGroup.rotation.x = radians;
    }
  };

  return laptopGroup;
}

// ============================================
// SCENE INITIALIZATION
// ============================================
function initScene() {
  macbook = createMacBookAir();
  macbook.position.copy(initialLaptopPosition);
  macbook.scale.set(0.9, 0.9, 0.9);
  scene.add(macbook);

  macbook.rotation.y = -0.50; // Rotate ~35 degrees left to face the camera
  macbook.userData.screenGroup.rotation.z = 0.012; // Counter-roll so the display edge stays level
  // Camera stays centered, looking straight ahead
  camera.position.set(0, 0.12, 12);
  macbook.userData.setOpenAngle(180);

  const firstScreenSection = document.querySelector('[data-screen]');
  setScreenImage(firstScreenSection?.dataset.screen || "./assets/yeahbuddy_logo_img.png");

  // A soft studio interior, generated once and used purely as a reflection
  // source. This is the single biggest reason the aluminium now reads as metal
  // instead of flat grey — lights alone cannot do it.
  // RoomEnvironment must be handed the renderer: it checks _useLegacyLights to
  // decide its light intensity (5 vs 900). Constructed without it, the room
  // comes out nearly black on three r161 and the reflections do nothing.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  pmrem.dispose();

  const keyLight = new THREE.DirectionalLight(0xfff3e2, 1.7);
  keyLight.position.set(4, 6, 5);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xe3c193, 0.45);
  fillLight.position.set(-5, 2, 3);
  scene.add(fillLight);

  const ambientLight = new THREE.AmbientLight(0xfff6e8, 0.22);
  scene.add(ambientLight);

  // ANIMATION LOOP
  function animate() {
    requestAnimationFrame(animate);

    // Opening animation (first 5% of scroll)
    const openProgressRaw = Math.min(Math.max(scrollPosY / openScrollPortion, 0), 1);
    const tOpen = openProgressRaw * openProgressRaw * (3 - 2 * openProgressRaw); // smoothstep

    // HINGE: start 180°, end 90° (opens away from camera)
    const openDeg = THREE.MathUtils.lerp(180, 90, tOpen);
    macbook.userData.setOpenAngle(openDeg);

    // ZOOM IN while opening - camera stays centered
    camera.position.z = THREE.MathUtils.lerp(8, 3.8, tOpen);
    camera.position.y = THREE.MathUtils.lerp(0.12, 0.2, tOpen);

    // Camera looks at a fixed point that's slightly right of center
    // This way the laptop on the right is visible
    const lookAtPoint = new THREE.Vector3(0.3, 0.2, 0);
    camera.lookAt(lookAtPoint);

    if (scrollPosY >= contentRevealPortion && !contentVisible) {
      document.body.classList.add('content-visible');
      contentVisible = true;
    } else if (scrollPosY < contentRevealPortion && contentVisible) {
      document.body.classList.remove('content-visible');
      contentVisible = false;
    }

    renderer.render(scene, camera);
  }
  animate();

  // Tells the page the 3D stage is live. If this never fires — no WebGL, the
  // three.js CDN blocked, an import map the browser does not support — the
  // fallback in index.html reveals the copy anyway, so the page still reads.
  document.documentElement.dataset.scene = 'ready';
}

initScene();

const screenSections = document.querySelectorAll('.hero-panel, .content-panel');
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        setScreenImage(entry.target.dataset.screen);
      }
    });
  },
  { threshold: 0.6 }
);
screenSections.forEach((section) => observer.observe(section));

function updateScrollProgress() {
  const maxScroll = document.body.scrollHeight - window.innerHeight;
  scrollPosY = maxScroll > 0 ? window.scrollY / maxScroll : 0;
}

window.addEventListener("scroll", updateScrollProgress);
updateScrollProgress();

function handleWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
}
window.addEventListener('resize', handleWindowResize, false);
