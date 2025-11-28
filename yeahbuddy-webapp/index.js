import * as THREE from "three";
import getLayer from "./libs/getLayer.js";
import getStarfield from "./libs/getStarfield.js";
import { RoundedBoxGeometry } from "jsm/geometries/RoundedBoxGeometry.js";

const w = window.innerWidth;
const h = window.innerHeight;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
camera.position.z = 5;
const canvas = document.getElementById('three-canvas');
const renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
renderer.setSize(w, h);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x000000, 0);
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
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(0, 0, fallbackCanvas.width, fallbackCanvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 80px Arial";
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
      texture.encoding = THREE.sRGBEncoding;
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
// MACBOOK MODEL FUNCTION
// ============================================
function createMacBookAir() {
  const laptopGroup = new THREE.Group();

  // Materials
  const aluminumMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xe8e8e8,
    metalness: 0.9,
    roughness: 0.1,
    clearcoat: 0.5,
    clearcoatRoughness: 0.1
  });

  const darkAluminumMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x4a4a4a,
    metalness: 0.8,
    roughness: 0.3
  });

  const bezelMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x1a1a1a,
    metalness: 0.3,
    roughness: 0.4
  });

  const screenMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff
  });

  const keyMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x2a2a2a,
    metalness: 0.2,
    roughness: 0.8
  });

  const trackpadMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x3a3a3a,
    metalness: 0.5,
    roughness: 0.2
  });

  // Base
  const baseGroup = new THREE.Group();

  const baseGeometry = new RoundedBoxGeometry(4.2, 0.1, 2.8, 8, 0.08);
  const base = new THREE.Mesh(baseGeometry, aluminumMaterial);
  base.position.set(0, 0.11, 0);
  baseGroup.add(base);

  // Keyboard area
  const keyboardAreaGeometry = new RoundedBoxGeometry(3.8, 0.05, 2.4, 6, 0.05);
  const keyboardArea = new THREE.Mesh(keyboardAreaGeometry, aluminumMaterial);
  keyboardArea.position.set(0, 0.15, -0.15);
  baseGroup.add(keyboardArea);

  // Keyboard keys
  const keyGeometry = new RoundedBoxGeometry(0.12, 0.03, 0.12, 4, 0.015);
  const keysGroup = new THREE.Group();

  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 16; col++) {
      const key = new THREE.Mesh(keyGeometry, keyMaterial);
      const x = -1.7 + (col * 0.22);
      const z = -1 + (row * 0.18);
      key.position.set(x, 0.19, z);
      keysGroup.add(key);
    }
  }

  // Spacebar
  const spacebarGeometry = new RoundedBoxGeometry(1.2, 0.03, 0.12, 6, 0.02);
  const spacebar = new THREE.Mesh(spacebarGeometry, keyMaterial);
  spacebar.position.set(0, 0.21, -0.1);
  keysGroup.add(spacebar);

  baseGroup.add(keysGroup);

  // Trackpad
  const trackpadGeometry = new RoundedBoxGeometry(1.4, 0.04, 0.9, 6, 0.08);
  const trackpad = new THREE.Mesh(trackpadGeometry, trackpadMaterial);
  trackpad.position.set(0, 0.19, 0.85);
  baseGroup.add(trackpad);

  laptopGroup.add(baseGroup);

  // Screen
  const screenGroup = new THREE.Group();
  screenGroup.position.set(0, 0.15, -1.45);

  const screenBackGeometry = new RoundedBoxGeometry(4.2, 2.6, 0.12, 8, 0.2);
  const screenBack = new THREE.Mesh(screenBackGeometry, aluminumMaterial);
  screenBack.position.set(0, 1.3, -0.06);
  screenGroup.add(screenBack);

  // Screen bezel
  const bezelGeometry = new RoundedBoxGeometry(4.15, 2.55, 0.08, 6, 0.12);
  const bezel = new THREE.Mesh(bezelGeometry, bezelMaterial);
  bezel.position.set(0, 1.3, 0.02);
  screenGroup.add(bezel);

  // Display screen
  const displayGeometry = new RoundedBoxGeometry(3.9, 2.3, 0.02, 4, 0.05);
  const display = new THREE.Mesh(displayGeometry, screenMaterial);
  display.position.set(0, 1.3, 0.051);
  display.name = 'screen';
  screenGroup.add(display);

  // Hinge
  const hingeGeometry = new THREE.CylinderGeometry(0.08, 0.08, 4.2, 32);
  const hingeMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xb8b8b8,
    metalness: 0.95,
    roughness: 0.05
  });
  const hinge = new THREE.Mesh(hingeGeometry, hingeMaterial);
  hinge.rotation.z = Math.PI / 2;
  hinge.position.set(0, 0, 0);
  screenGroup.add(hinge);

  screenGroup.rotation.x = -Math.PI / 2;

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
  setScreenImage(firstScreenSection?.dataset.screen || "./assets/Dog.jpg");

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 5, 5);
  scene.add(directionalLight);

  const pointLight = new THREE.PointLight(0xffffff, 0.4);
  pointLight.position.set(-5, 3, 5);
  scene.add(pointLight);

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444);
  scene.add(hemiLight);

  // Starfield
  const stars = getStarfield({ numStars: 4500 });
  //scene.add(stars);

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

    // Background parallax (optional)
    stars.position.z = THREE.MathUtils.lerp(0, -20, tOpen);

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
