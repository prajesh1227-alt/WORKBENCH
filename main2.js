import * as THREE from 'three';
import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest";

let handLandmarker, cityGroup, lastVideoTime = -1;

// --- 1. HUD DATA ENGINE ---
function updateHUD() {
    const now = new Date();
    document.getElementById('time').innerText = now.toLocaleTimeString('en-GB', { hour12: false });
    document.getElementById('date').innerText = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase();
}
setInterval(updateHUD, 1000);

// --- 2. THREE.JS SCENE (Stark City) ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('container').appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 1.2));
camera.position.set(0, 5, 12);

function createCity() {
    cityGroup = new THREE.Group();
    scene.add(new THREE.GridHelper(30, 30, 0x00d2ff, 0x002233));
    for (let i = 0; i < 70; i++) {
        const h = Math.random() * 3 + 1;
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, h, 0.5), new THREE.MeshPhongMaterial({ color: 0x00d2ff, transparent: true, opacity: 0.25, wireframe: true }));
        b.position.set((Math.random() - 0.5) * 25, h / 2, (Math.random() - 0.5) * 25);
        cityGroup.add(b);
    }
    scene.add(cityGroup);
}
createCity();

// --- 3. DUAL-HAND GESTURE PROTOCOL ---
async function startAI() {
    const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task" },
        runningMode: "VIDEO",
        numHands: 2 // Detect both hands for keyboard trigger
    });
}

function handleDualProtocol(results) {
    const keyboard = document.getElementById('stark-keyboard');
    const iris = document.getElementById('iris-core');

    // SPECIAL MOVE: If 2 hands are seen, show the keyboard and shift color
    if (results.landmarks && results.landmarks.length >= 2) {
        keyboard.classList.add('active');
        iris.style.filter = "hue-rotate(160deg) brightness(1.4)";
    } else {
        keyboard.classList.remove('active');
        iris.style.filter = "none";
    }

    if (results.landmarks.length > 0) {
        const wrist = results.landmarks[0][0];
        cityGroup.rotation.y = THREE.MathUtils.lerp(cityGroup.rotation.y, (wrist.x - 0.5) * 2, 0.1);
    }
}

// --- 4. ENGINE RUNTIME ---
const video = document.getElementById("webcam");
function run() {
    if (video.currentTime !== lastVideoTime && handLandmarker) {
        lastVideoTime = video.currentTime;
        const result = handLandmarker.detectForVideo(video, performance.now());
        handleDualProtocol(result);
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
    updateHUD();
});