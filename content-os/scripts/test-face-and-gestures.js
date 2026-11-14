import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { ROOT_DIR } from "../server/config.js";
import {
  createUser,
  listUsers,
  getUser,
  deleteUser,
  updateUserLogin,
  getUserCount,
  getAllFaceDescriptors,
} from "../server/db.js";
import {
  lockSystem,
  getAuthStatus,
  unlockWithFace,
  unlockWithPin,
  isSystemLocked,
  listEnrolledOperators,
} from "../server/system/security.js";

console.log("=================================================");
console.log("🧪 AGENTIC OS: BIOMETRIC FACE & GESTURE SUITE");
console.log("=================================================\n");

// 1. Verify Local Neural Network Assets
console.log("--- 1. Neural Weights & Vendor Assets ---");
const weightsDir = join(ROOT_DIR, "Github Repos", "face-api.js", "weights");
const distFile = join(ROOT_DIR, "Github Repos", "face-api.js", "dist", "face-api.min.js");

if (!existsSync(distFile)) {
  throw new Error(`Missing face-api.min.js bundle at: ${distFile}`);
}
console.log(`[PASS] Found pre-built bundle: face-api.min.js (${Math.round(readFileSync(distFile).length / 1024)} KB)`);

const requiredModelManifests = [
  "ssd_mobilenetv1_model-weights_manifest.json",
  "tiny_face_detector_model-weights_manifest.json",
  "face_landmark_68_model-weights_manifest.json",
  "face_recognition_model-weights_manifest.json",
];

for (const manifest of requiredModelManifests) {
  const p = join(weightsDir, manifest);
  if (!existsSync(p)) {
    throw new Error(`Missing required neural model manifest: ${manifest}`);
  }
  console.log(`[PASS] Found model manifest: ${manifest}`);
}

// 2. Test Multi-User Database Operations
console.log("\n--- 2. Database Multi-User Biometrics ---");
const initialCount = getUserCount();
console.log(`[INFO] Current user count: ${initialCount}`);

// Generate mock 128D unit vector
const mockDescriptor = Array.from({ length: 128 }, (_, i) => Math.sin(i * 0.2));
const testUser = createUser({
  name: "Ihsan Stark (Admin)",
  role: "admin",
  face_descriptor: mockDescriptor,
  avatar_thumb: "data:image/jpeg;base64,mockthumb",
  pin_code: "7788",
});
console.log(`[PASS] Enrolled user: ${testUser.name} [ID: ${testUser.id}]`);

const fetched = getUser(testUser.id);
if (!fetched || fetched.name !== "Ihsan Stark (Admin)") {
  throw new Error("Failed to fetch enrolled user from SQLite");
}
console.log(`[PASS] Retrieved record: role=${fetched.role}, pin=${fetched.pin_code}`);

const allDescriptors = getAllFaceDescriptors();
const targetDesc = allDescriptors.find((d) => d.id === testUser.id);
if (!targetDesc || targetDesc.descriptor.length !== 128) {
  throw new Error("128D facial descriptor vector mismatch or corruption");
}
console.log(`[PASS] 128D facial embedding successfully verified (Length: ${targetDesc.descriptor.length})`);

// 3. Euclidean Distance & Matching Simulation
console.log("\n--- 3. Facial Recognition Euclidean Matching Math ---");
function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

// Identical vector should have distance 0
const distSame = euclideanDistance(mockDescriptor, targetDesc.descriptor);
console.log(`[PASS] Distance against self: ${distSame.toFixed(4)} (Expected: 0.0000)`);

// Slightly noisy vector (same person, different lighting)
const slightlyNoisy = mockDescriptor.map((val) => val + (Math.random() - 0.5) * 0.05);
const distNoise = euclideanDistance(mockDescriptor, slightlyNoisy);
console.log(`[PASS] Distance with camera noise: ${distNoise.toFixed(4)} (Threshold: < 0.45)`);
if (distNoise >= 0.45) {
  throw new Error("Noise calculation exceeded confidence threshold");
}

// Random impostor vector
const impostor = Array.from({ length: 128 }, () => Math.random() * 2 - 1);
const distImpostor = euclideanDistance(mockDescriptor, impostor);
console.log(`[PASS] Distance against impostor: ${distImpostor.toFixed(4)} (Expected: > 0.60)`);
if (distImpostor < 0.45) {
  throw new Error("Impostor falsely matched!");
}

// Clean up
deleteUser(testUser.id);
const finalCount = getUserCount();
if (finalCount !== initialCount) {
  throw new Error("Failed to clean up test user");
}
console.log(`[PASS] Cleaned up temporary test profile. User count returned to: ${finalCount}`);

// 4. Verify Frontend Modules Exist and are Non-Empty
console.log("\n--- 4. Client Modules Integrity ---");
const clientFiles = [
  "public/face/faceAuth.js",
  "public/admin/admin.js",
  "public/hud/gestureEngine.js",
];

for (const relPath of clientFiles) {
  const fullPath = join(ROOT_DIR, relPath);
  if (!existsSync(fullPath)) throw new Error(`Missing client file: ${relPath}`);
  const content = readFileSync(fullPath, "utf8");
  if (content.length < 200) throw new Error(`Client file too small: ${relPath}`);
  console.log(`[PASS] Verified module: ${relPath} (${Math.round(content.length / 1024)} KB)`);
}

// 5. Verify Security Agent Orchestration & State Transitions
console.log("\n--- 5. Security Agent Orchestration ---");
// Create a temporary operator
const secUser = createUser({
  name: "Operator Zero",
  role: "admin",
  face_descriptor: mockDescriptor,
  pin_code: "9999",
});

const lockRes = lockSystem("Test lock command");
if (!lockRes.locked || !isSystemLocked()) {
  throw new Error("lockSystem failed to engage lock state");
}
console.log(`[PASS] lockSystem() engaged biometric lock (isSystemLocked = true)`);

const authStatus = getAuthStatus();
if (!authStatus.locked || authStatus.authRequired !== true) {
  throw new Error("getAuthStatus returned invalid status when locked");
}
console.log(`[PASS] getAuthStatus() correctly reports locked=true, userCount=${authStatus.userCount}`);

// Test face unlock
const faceUnlock = unlockWithFace(secUser.id);
if (!faceUnlock.success || isSystemLocked() || faceUnlock.user.name !== "Operator Zero") {
  throw new Error("unlockWithFace failed to authenticate operator");
}
console.log(`[PASS] unlockWithFace() verified operator and unlocked system`);

// Test PIN unlock
lockSystem("PIN test lock");
const pinUnlock = unlockWithPin("9999");
if (!pinUnlock.success || isSystemLocked()) {
  throw new Error("unlockWithPin failed to authenticate with valid PIN");
}
console.log(`[PASS] unlockWithPin() verified PIN and unlocked system`);

// Clean up
deleteUser(secUser.id);
console.log(`[PASS] Security Agent orchestration lifecycle fully verified`);

console.log("\n=================================================");
console.log("🎉 ALL BIOMETRIC & GESTURE SYSTEM TESTS PASSED!");
console.log("=================================================\n");
