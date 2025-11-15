// app.js
import * as THREE from './libs/three.js-r132/build/three.module.js';
import { GLTFLoader } from './libs/three.js-r132/examples/jsm/loaders/GLTFLoader.js';
import { ARButton } from './libs/three.js-r132/examples/jsm/webxr/ARButton.js';

let camera, scene, renderer;
let controller;
let reticle;
let hitTestSource = null;
let hitTestSourceRequested = false;
let model = null;

init();
renderLoop();

function init() {
  // Scene & camera
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera();
    const ambient = new THREE.AmbientLight(0xffffff, 1.5);
  scene.add(ambient);

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.8);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 2);
  dirLight.position.set(3, 3, 3);
  scene.add(dirLight);

  // Light
  const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
  light.position.set(0.5, 1, 0.25);
  scene.add(light);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  document.body.appendChild(renderer.domElement);

  // AR Button
  document.body.appendChild(
    ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] })
  );

  // Reticle (placement indicator)
  const geometry = new THREE.RingGeometry(0.08, 0.12, 32).rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  reticle = new THREE.Mesh(geometry, material);
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  // Controller for select (tap)
  controller = renderer.xr.getController(0);
  controller.addEventListener('select', onSelect);
  scene.add(controller);

  // Load the model but do not place yet
  const loader = new GLTFLoader();
  loader.load(
    './models/furniture.glb',
    (gltf) => {
      model = gltf.scene;
      // initial scale; you may need to adjust depending on your model units
      model.scale.set(0.6, 0.6, 0.6);
      model.visible = false; // will set visible when placed
      scene.add(model);
      showMessage('Model loaded — enter AR and tap to place it.');
    },
    (xhr) => {
      // progress
      // console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );
    },
    (err) => {
      console.error('Error loading GLB:', err);
      showMessage('Failed to load model. Check console for details.');
    }
  );

  window.addEventListener('resize', onWindowResize, false);

  // Add a small debug element
  addDebugUI();
}

function onWindowResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
}

let modelPlaced = false;

function onSelect() {
  if (!reticle.visible || !model) return;

  // Move the model to the reticle position
  model.position.setFromMatrixPosition(reticle.matrix);
  model.quaternion.setFromRotationMatrix(reticle.matrix);
  model.visible = true;

  // 🔥 Hide reticle after placement
  reticle.visible = false;

  // 🔥 Model is now placed (prevents reticle from showing again)
  modelPlaced = true;

  showMessage('Model placed.');
}


function renderLoop() {
  renderer.setAnimationLoop(render);
}

function render(timestamp, frame) {
  if (frame) {
    const session = renderer.xr.getSession();

    if (!hitTestSourceRequested) {
      // Request a hit-test source once the session is available
      session.requestReferenceSpace('viewer').then((referenceSpace) => {
        session.requestHitTestSource({ space: referenceSpace }).then((source) => {
          hitTestSource = source;
        });
      });

      session.addEventListener('end', () => {
        hitTestSourceRequested = false;
        hitTestSource = null;
      });

      hitTestSourceRequested = true;
    }

    if (!modelPlaced && hitTestSource) {
  const referenceSpace = renderer.xr.getReferenceSpace();
  const hitTestResults = frame.getHitTestResults(hitTestSource);

  if (hitTestResults.length > 0) {
    const hit = hitTestResults[0];
    const pose = hit.getPose(referenceSpace);

    reticle.visible = true;
    reticle.matrix.fromArray(pose.transform.matrix);
  } else {
    reticle.visible = false;
  }
}

  }

  renderer.render(scene, camera);
}

/* Small helper UI for messages */
function addDebugUI() {
  const el = document.createElement('div');
  el.id = 'msg';
  Object.assign(el.style, {
    position: 'absolute',
    left: '8px',
    bottom: '8px',
    padding: '8px 12px',
    background: 'rgba(0,0,0,0.6)',
    color: '#fff',
    fontFamily: 'sans-serif',
    fontSize: '13px',
    borderRadius: '4px',
    zIndex: 9999,
  });
  el.textContent = 'Initializing...';
  document.body.appendChild(el);
}

function showMessage(text) {
  const el = document.getElementById('msg');
  if (el) el.textContent = text;
}
