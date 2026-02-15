import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FaceLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest";

let faceLandmarker, helmetGroup, lastVideoTime = -1;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 2.5));

// --- 1. LOADER WITH "ULTRA" SCALING ---
new GLTFLoader().load('./helmet.glb', (gltf) => {
    const rawModel = gltf.scene;

    // Measure the current size of the "dot"
    const box = new THREE.Box3().setFromObject(rawModel);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    // SCALING UP: Force the model to be 5.0 units wide
    // This is designed to counteract models exported in millimeters.
    const targetWidth = 5.0;
    let scaleFactor = targetWidth / size.x;

    // Safety check: if scale is still too low, multiply by 10
    if (scaleFactor < 100) scaleFactor *= 10;

    rawModel.scale.setScalar(scaleFactor);

    // Center the model's geometry
    rawModel.position.set(-center.x * scaleFactor, -center.y * scaleFactor, -center.z * scaleFactor);

    // Create tracking anchor
    helmetGroup = new THREE.Group();
    helmetGroup.add(rawModel);
    scene.add(helmetGroup);

    console.log("JARVIS: Ultra-Scale Factor Applied:", scaleFactor);
});

async function initFaceAI() {
    const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
    faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task" },
        runningMode: "VIDEO",
        outputFacialTransformationMatrixes: true // For 360-degree rotation
    });
}

function updateHelmet(results) {
    if (results.facialTransformationMatrixes?.length > 0) {
        const matrix = new THREE.Matrix4().fromArray(results.facialTransformationMatrixes[0].data);

        // Match helmet group to face movement
        helmetGroup.position.setFromMatrixPosition(matrix);
        helmetGroup.quaternion.setFromRotationMatrix(matrix);

        // OFFSET: Higher values to align the center with your head
        helmetGroup.translateY(0.2);
        helmetGroup.translateZ(-0.25);

        document.getElementById('status-overlay').innerText = "JARVIS: PILOT DETECTED. SYSTEM NOMINAL.";
    }
}

const video = document.getElementById("webcam");
function run() {
    if (video.currentTime !== lastVideoTime && faceLandmarker) {
        lastVideoTime = video.currentTime;
        const result = faceLandmarker.detectForVideo(video, performance.now());
        if (helmetGroup) updateHelmet(result);
    }
    renderer.render(scene, camera);
    requestAnimationFrame(run);
}

document.getElementById('startBtn').addEventListener('click', async () => {
    document.getElementById('startBtn').style.display = 'none';
    await initFaceAI();
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
    video.srcObject = stream;
    video.addEventListener("loadeddata", run);
});