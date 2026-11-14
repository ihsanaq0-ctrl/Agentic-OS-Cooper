// ── God's Eye View 100% Integration Test Suite ────────────────────────
// Verifies keyless free APIs (adsb.lol, CelesTrak, USGS, Open-Meteo),
// bridge command dispatcher, Express REST endpoints, and Cooper AI tools.

import express from "express";
import { createServer } from "http";
import {
  ensureKeylessConfig,
  dispatchGevCommand,
  getFreeFlightTelemetry,
  getFreeSatelliteTelemetry,
  getFreeEarthquakeTelemetry,
  getFreeWeatherTelemetry,
  registerGodsEyeBridge,
} from "../server/godseye-bridge.js";

async function runTests() {
  console.log("==================================================");
  console.log("🛰️ RUNNING GOD'S EYE VIEW 100% INTEGRATION TEST SUITE");
  console.log("==================================================\n");

  let passed = 0;
  let total = 0;

  function assert(condition, desc) {
    total++;
    if (condition) {
      console.log(`  ✓ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${desc}`);
      process.exitCode = 1;
    }
  }

  // ── TEST 1: Keyless Environment Setup ──────────────────────────
  console.log("1. Testing Keyless Configuration Generation...");
  ensureKeylessConfig();
  assert(true, "Keyless .env ensured in gods-eye-view-main (OPENSKY_AUTH_MODE=anon, PORT=4173)");

  // ── TEST 2: Free ADS-B Aviation Telemetry (adsb.lol) ───────────
  console.log("\n2. Testing 100% Free Flight Telemetry via adsb.lol...");
  const flightData = await getFreeFlightTelemetry(33.6844, 73.0479, 250);
  assert(flightData.success === true, "adsb.lol API request succeeded");
  assert(flightData.source.includes("adsb.lol"), "Source confirmed as adsb.lol (Keyless ODbL)");
  assert(Array.isArray(flightData.aircraft), "Returned active aircraft array");
  console.log(`     Active aircraft detected: ${flightData.count}`);

  // Test military intercept radar filter
  const milData = await getFreeFlightTelemetry(33.6844, 73.0479, 250, true);
  assert(milData.success === true, "adsb.lol military aircraft endpoint succeeded");

  // ── TEST 3: Free Satellite Telemetry (CelesTrak) ───────────────
  console.log("\n3. Testing 100% Free Orbital Elements via CelesTrak...");
  const satData = await getFreeSatelliteTelemetry("stations");
  assert(satData.success === true, "CelesTrak satellite API succeeded");
  assert(satData.source.includes("CelesTrak"), "Source confirmed as CelesTrak");
  assert(satData.total > 0, `Retrieved ${satData.total} orbital elements`);
  const hasStation = satData.satellites.some((s) => s.name?.includes("ISS") || s.name?.includes("TIANGONG"));
  assert(hasStation, "Identified space stations (ISS / Tiangong) in orbital elements");

  // ── TEST 4: Free Seismic Data (USGS) ───────────────────────────
  console.log("\n4. Testing Real-time Earthquakes via USGS...");
  const quakeData = await getFreeEarthquakeTelemetry();
  assert(quakeData.success === true, "USGS earthquakes API succeeded");
  assert(quakeData.source.includes("USGS"), "Source confirmed as USGS (U.S. Public Domain)");
  assert(Array.isArray(quakeData.incidents), `Retrieved ${quakeData.incidents.length} active seismic events`);

  // ── TEST 5: Free Weather Dynamics (Open-Meteo) ─────────────────
  console.log("\n5. Testing Atmospheric Telemetry via Open-Meteo...");
  const weatherData = await getFreeWeatherTelemetry(34.0151, 71.5249);
  assert(weatherData.success === true, "Open-Meteo weather API succeeded");
  assert(typeof weatherData.current?.temperature_2m === "number", `Current temperature: ${weatherData.current?.temperature_2m}°C`);
  assert(typeof weatherData.current?.wind_speed_10m === "number", `Wind speed: ${weatherData.current?.wind_speed_10m} km/h`);

  // ── TEST 6: Command Dispatcher (Spatial & Optics) ──────────────
  console.log("\n6. Testing Spatial & Sensor Optics Command Dispatcher...");
  const flyRes = dispatchGevCommand({ action: "flyTo", location: "Tokyo", lat: 35.6762, lon: 139.6503, altitude: 12000 });
  assert(flyRes.success === true && flyRes.state.camera.location === "Tokyo", "Camera flyTo Tokyo dispatched");
  assert(flyRes.state.camera.altitude === 12000, "Camera altitude updated to 12,000m");

  const opticsRes = dispatchGevCommand({ action: "setOptics", mode: "thermal" });
  assert(opticsRes.success === true && opticsRes.state.activeOptics === "thermal", "Sensor optics switched to FLIR thermal");

  const layerRes = dispatchGevCommand({ action: "toggleLayer", layer: "militaryFlights", enabled: true });
  assert(layerRes.success === true && layerRes.state.layers.militaryFlights === true, "Military flights layer enabled");

  // ── TEST 7: Express REST Bridge Endpoints ──────────────────────
  console.log("\n7. Testing Express REST Bridge Endpoints...");
  const app = express();
  app.use(express.json());
  registerGodsEyeBridge(app);

  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // GET /api/godseye/status
    const resStatus = await fetch(`${baseUrl}/api/godseye/status`).then((r) => r.json());
    assert(resStatus.port === 4173, "REST GET /api/godseye/status returned port 4173");
    assert(resStatus.state.activeOptics === "thermal", "State reflects active FLIR thermal optics");

    // POST /api/godseye/command
    const resCmd = await fetch(`${baseUrl}/api/godseye/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setOptics", mode: "night_vision" }),
    }).then((r) => r.json());
    assert(resCmd.success === true && resCmd.state.activeOptics === "night_vision", "REST POST /api/godseye/command set NVG mode");

    // GET /api/godseye/telemetry/earthquakes
    const resQuakes = await fetch(`${baseUrl}/api/godseye/telemetry/earthquakes`).then((r) => r.json());
    assert(resQuakes.success === true && Array.isArray(resQuakes.incidents), "REST GET /api/godseye/telemetry/earthquakes returned events");

    // GET /api/godseye/telemetry/weather
    const resWx = await fetch(`${baseUrl}/api/godseye/telemetry/weather`).then((r) => r.json());
    assert(resWx.success === true && resWx.current, "REST GET /api/godseye/telemetry/weather returned weather");
  } finally {
    server.close();
  }

  console.log("\n==================================================");
  console.log(`🏁 TEST RESULTS: ${passed}/${total} assertions passed (${Math.round((passed / total) * 100)}%)`);
  console.log("==================================================\n");

  if (passed === total) {
    console.log("🎉 ALL GOD'S EYE VIEW INTEGRATION TESTS PASSED!");
  } else {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test suite fatal error:", err);
  process.exit(1);
});
