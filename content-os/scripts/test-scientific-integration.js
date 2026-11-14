// ── Phase 5 Integration Test: Scientific & Geospatial Intelligence ──────
import assert from "node:assert";
import {
  searchScientificLiterature,
  getScientificEngineStatus,
} from "../server/ai/scientificResearch.js";
import {
  clusterTelemetryPoints,
  haversineDistanceKm,
} from "../server/godseye-bridge.js";

async function runTests() {
  console.log("==================================================");
  console.log("🔬 🛰️ TESTING PHASE 5: SCIENTIFIC & GEOSPATIAL SUBSYSTEM");
  console.log("==================================================");

  // ── 1. Scientific Engine Catalog Status ────────────────────────
  console.log("\n1. Testing Scientific Engine Catalog Status...");
  const status = getScientificEngineStatus();
  assert.strictEqual(status.success, true);
  assert.strictEqual(status.skillsCount, 177);
  assert.ok(status.databasesSupported.some((d) => d.includes("OpenAlex")));
  assert.ok(status.databasesSupported.some((d) => d.includes("arXiv")));
  console.log(`  ✓ PASS: Catalog verified with ${status.skillsCount} scientific skills`);
  console.log(`  ✓ PASS: Supported databases: ${status.databasesSupported.join(", ")}`);

  // ── 2. Scholarly Literature Multi-Database Search ─────────────
  console.log("\n2. Testing Scholarly Literature Search across OpenAlex & arXiv...");
  const searchRes = await searchScientificLiterature({
    query: "agentic AI memory architecture",
    database: "all",
    limit: 3,
    autoCommit: true,
  });

  assert.strictEqual(searchRes.success, true);
  assert.ok(searchRes.papers.length > 0);
  console.log(`  ✓ PASS: Retrieved ${searchRes.papers.length} scholarly papers`);

  const topPaper = searchRes.papers[0];
  assert.ok(topPaper.title, "Paper has title");
  assert.ok(topPaper.year, "Paper has publication year");
  assert.ok(topPaper.source, "Paper has database source attribution");
  console.log(`  ✓ Top Result: "${topPaper.title}" (${topPaper.year})`);
  console.log(`  ✓ Source: ${topPaper.source} | DOI: ${topPaper.doi}`);

  // ── 3. Geospatial Planar Clustering (GeoPandas algorithm) ─────
  console.log("\n3. Testing Geospatial Clustering Algorithm...");
  // Distance between Austin (30.2672, -97.7431) and San Antonio (29.4241, -98.4936) is ~120 km
  const dist = haversineDistanceKm(30.2672, -97.7431, 29.4241, -98.4936);
  assert.ok(dist > 100 && dist < 140, `Haversine distance calculated: ${dist.toFixed(1)} km`);
  console.log(`  ✓ PASS: Haversine distance between Austin & San Antonio: ${dist.toFixed(1)} km`);

  const testTelemetryPoints = [
    { id: "A1", lat: 30.2672, lon: -97.7431, type: "aircraft" }, // Austin
    { id: "A2", lat: 30.2747, lon: -97.7403, type: "aircraft" }, // Austin nearby (~1 km)
    { id: "B1", lat: 29.4241, lon: -98.4936, type: "aircraft" }, // San Antonio (~120 km)
    { id: "T1", lat: 35.6762, lon: 139.6503, type: "satellite" }, // Tokyo (thousands of km away)
  ];

  // Cluster with 50 km radius: A1 and A2 cluster together; B1 is separate; T1 is separate
  const clusters = clusterTelemetryPoints(testTelemetryPoints, 50);
  assert.strictEqual(clusters.length, 3, "Expected 3 distinct spatial clusters");
  const austinCluster = clusters.find((c) => c.points.some((p) => p.id === "A1"));
  assert.strictEqual(austinCluster.count, 2, "Austin cluster grouped 2 nearby points");
  console.log(`  ✓ PASS: Correctly grouped ${testTelemetryPoints.length} telemetry points into ${clusters.length} spatial clusters`);

  console.log("\n==================================================");
  console.log("🎉 ALL PHASE 5 INTEGRATION TESTS PASSED (100%)");
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
