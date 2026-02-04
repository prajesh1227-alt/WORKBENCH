import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest";

let handLandmarker, targetModel, lastVideoTime = -1;
let keyboardGroup, keys = [];
let baseScale = 1;

// --- 1. HUD DATA ENGINE (TIME & DATE) ---
function updateHUD() {
    const now = new Date();
    // 24-hour clock format
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = now.toLocaleDateString('en-US', {
        weekday: 'long', month: 'short', day: '2-digit', year: 'numeric'
    }).toUpperCase();

    document.getElementById('time').innerText = timeStr;
    document.getElementById('date').innerText = dateStr;
}
setInterval(updateHUD, 1000);
updateHUD();

// --- 2. BALANCED THREE.JS SETUP ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

// Correct Color Space for original designs
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('container').appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 1.2));
const light = new THREE.DirectionalLight(0x00d2ff, 4);
light.position.set(5, 10, 7);
scene.add(light);

camera.position.set(0, 0, 6);

// --- 3. HOLOGRAPHIC HUD KEYBOARD ---
function initKeyboard() {
    keyboardGroup = new THREE.Group();
    ['A', 'B', 'C', 'D', 'E'].forEach((text, i) => {
        const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(0.4, 0.4),
            new THREE.MeshBasicMaterial({ color: 0x00d2ff, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
        );
        mesh.position.set(-1.2 + i * 0.6, -1.8, 2);
        mesh.userData = { id: text };
        keys.push(mesh);
        keyboardGroup.add(mesh);
    });
    scene.add(keyboardGroup);
}
initKeyboard();

// --- 4. LOADER WITH TEXTURE & SCALE NORMALIZATION ---
new GLTFLoader().load('./computer.glb', (gltf) => {
    targetModel = gltf.scene;

    targetModel.traverse((child) => {
        if (child.isMesh) {
            child.material.transparent = true;
            child.material.side = THREE.DoubleSide;
            if (child.material.map) {
                child.material.map.colorSpace = THREE.SRGBColorSpace;
                child.material.emissive = child.material.color;
                child.material.emissiveIntensity = 1.2;
            }
        }
    });

    const box = new THREE.Box3().setFromObject(targetModel);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const targetSize = 3.5;
    baseScale = targetSize / Math.max(size.x, size.y, size.z);
    targetModel.scale.setScalar(baseScale);

    // Auto-centering
    targetModel.position.set(-center.x * baseScale, -center.y * baseScale, -center.z * baseScale);

    scene.add(targetModel);
    console.log("JARVIS: System recalibrated.");
});

// --- 5. GESTURE ENGINE (ZOOM + ROTATION) ---
async function startAI() {
    const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task" },
        runningMode: "VIDEO", numHands: 1
    });
}

function updateGestures(landmarks) {
    if (!targetModel) return;
    const wrist = landmarks[0];
    const thumb = landmarks[4];
    const index = landmarks[8];

    // Smooth Rotation
    targetModel.rotation.y = THREE.MathUtils.lerp(targetModel.rotation.y, (wrist.x - 0.5) * 4, 0.1);
    targetModel.rotation.x = THREE.MathUtils.lerp(targetModel.rotation.x, (wrist.y - 0.5) * 2, 0.1);

    // CLAMPED PINCH ZOOM
    const pinchDist = Math.hypot(thumb.x - index.x, thumb.y - index.y);
    const targetZ = THREE.MathUtils.mapLinear(pinchDist, 0, 0.3, 12, 3);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ, 0.1);

    targetModel.scale.setScalar(baseScale);

    const fingerPos = new THREE.Vector3((index.x - 0.5) * 8, -(index.y - 0.5) * 6, 2);
    keys.forEach(key => {
        key.material.opacity = fingerPos.distanceTo(key.position) < 0.4 ? 0.8 : 0.3;
    });
}

// --- 6. RUNTIME ---
const video = document.getElementById("webcam");
function run() {
    if (video.currentTime !== lastVideoTime && handLandmarker) {
        lastVideoTime = video.currentTime;
        const result = handLandmarker.detectForVideo(video, performance.now());
        if (result.landmarks?.length > 0) updateGestures(result.landmarks[0]);
    }
    renderer.render(scene, camera);
    requestAnimationFrame(run);
}

document.getElementById('startBtn').addEventListener('click', async () => {
    document.getElementById('startBtn').style.display = 'none';
    await startAI();
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    video.addEventListener("loadeddata", run);
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});