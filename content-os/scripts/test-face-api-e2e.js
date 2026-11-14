// End-to-end verification of HTTP routes and static face-api asset serving
import express from "express";
import { join } from "path";
import { ROOT_DIR } from "../server/config.js";
import { getAuthStatus, lockSystem, unlockWithFace, unlockWithPin, isSystemLocked } from "../server/system/security.js";
import { listUsers, getUserCount, getAllFaceDescriptors } from "../server/db.js";

console.log("=================================================");
console.log("🌐 AGENTIC OS: E2E HTTP & ASSET TEST");
console.log("=================================================\n");

const app = express();
app.use(express.json());
app.use("/vendor/face-api", express.static(join(ROOT_DIR, "Github Repos", "face-api.js", "dist")));
app.use("/models/face", express.static(join(ROOT_DIR, "Github Repos", "face-api.js", "weights")));

app.get("/api/auth/status", (_req, res) => res.json(getAuthStatus()));
app.get("/api/users", (_req, res) => res.json({ users: listUsers(), total: getUserCount() }));

const server = app.listen(0, async () => {
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`[PASS] Ephemeral test server listening on port ${port}`);

  try {
    // 1. Check face-api.min.js
    const rBundle = await fetch(`${baseUrl}/vendor/face-api/face-api.min.js`);
    if (!rBundle.ok) throw new Error(`Failed to fetch face-api.min.js: ${rBundle.status}`);
    const bundleText = await rBundle.text();
    console.log(`[PASS] /vendor/face-api/face-api.min.js returned HTTP 200 (${Math.round(bundleText.length / 1024)} KB)`);

    // 2. Check model manifests
    const models = [
      "ssd_mobilenetv1_model-weights_manifest.json",
      "tiny_face_detector_model-weights_manifest.json",
      "face_landmark_68_model-weights_manifest.json",
      "face_recognition_model-weights_manifest.json",
    ];

    for (const m of models) {
      const rm = await fetch(`${baseUrl}/models/face/${m}`);
      if (!rm.ok) throw new Error(`Failed to fetch model ${m}: ${rm.status}`);
      const json = await rm.json();
      if (!Array.isArray(json)) throw new Error(`Manifest ${m} is not valid JSON array`);
      console.log(`[PASS] /models/face/${m} returned HTTP 200`);
    }

    // 3. Check /api/auth/status
    const rStatus = await fetch(`${baseUrl}/api/auth/status`);
    const statusData = await rStatus.json();
    console.log(`[PASS] /api/auth/status returned:`, statusData);

    // 4. Check /api/users
    const rUsers = await fetch(`${baseUrl}/api/users`);
    const usersData = await rUsers.json();
    console.log(`[PASS] /api/users returned: total=${usersData.total} users`);

    console.log("\n=================================================");
    console.log("🎉 ALL E2E HTTP & STATIC ASSET TESTS PASSED!");
    console.log("=================================================\n");
  } catch (err) {
    console.error("[FAIL] Test error:", err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
