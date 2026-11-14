// ── God's Eye View ↔ Cooper Geospatial Intelligence Bridge ───────────
// Manages the 3D planetary Earth console daemon, keyless telemetry proxies
// (adsb.lol, CelesTrak, USGS, Open-Meteo), REST endpoints, and SSE dispatches.

import { spawn, execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { broadcastGlobal } from "./sse.js";

import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = join(__dirname, "..");
const GEV_DIR = join(APP_DIR, "Github Repos", "gods-eye-view-main");
const GEV_PORT = 4173;
const GEV_URL = `http://127.0.0.1:${GEV_PORT}`;

let gevProcess = null;
let gevRunning = false;
let gevBooting = false;
let lastKnownState = {
  activeStack: "esri-imagery", // Keyless Esri satellite basemap default
  activeOptics: "normal",      // "normal" | "thermal" | "night_vision" | "crt" | "noir"
  camera: {
    location: "Austin",
    lat: 30.2747,
    lon: -97.7403,
    altitude: 12000,
    pitch: -35,
    heading: 0,
  },
  layers: {
    flights: true,
    militaryFlights: true,
    satellites: true,
    earthquakes: true,
    cables: true,
    weather: true,
  },
};

/**
 * Ensure keyless .env exists in GEV directory
 */
export function ensureKeylessConfig() {
  const envPath = join(GEV_DIR, ".env");
  const config = [
    "# God's Eye View — Keyless Free Configuration for Cooper Agentic OS",
    "PORT=4173",
    "HOST=0.0.0.0",
    "OPENSKY_AUTH_MODE=anon",
    "",
  ].join("\n");

  if (!existsSync(envPath)) {
    writeFileSync(envPath, config, "utf8");
  } else {
    try {
      const existing = readFileSync(envPath, "utf8");
      if (existing.includes("HOST=127.0.0.1") || !existing.includes("HOST=0.0.0.0")) {
        writeFileSync(envPath, config, "utf8");
      }
    } catch {}
  }
}

/**
 * Check if the God's Eye View server is responding
 */
export async function checkGevHealth() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(GEV_URL, { signal: controller.signal });
    clearTimeout(timer);
    gevRunning = res.ok;
    return gevRunning;
  } catch {
    gevRunning = false;
    return false;
  }
}

/**
 * Start the God's Eye View Vite daemon
 */
export async function startGevDaemon() {
  if (gevRunning) return { success: true, running: true, message: "God's Eye View is already running." };
  if (gevBooting) return { success: true, booting: true, message: "God's Eye View is currently booting." };

  ensureKeylessConfig();
  gevBooting = true;
  broadcastGlobal({ type: "godseye:status", status: "booting", port: GEV_PORT });

  try {
    // Check if port already reachable
    const isUp = await checkGevHealth();
    if (isUp) {
      gevRunning = true;
      gevBooting = false;
      broadcastGlobal({ type: "godseye:status", status: "running", port: GEV_PORT });
      return { success: true, running: true, message: "Connected to existing God's Eye View instance." };
    }

    // Direct node invocation to vite.js avoids cmd.exe zombie wrapper issues on Windows
    const viteBin = join(GEV_DIR, "node_modules", "vite", "bin", "vite.js");
    if (existsSync(viteBin)) {
      gevProcess = spawn(process.execPath, [viteBin, "--port", String(GEV_PORT), "--host", "0.0.0.0", "--strictPort"], {
        cwd: GEV_DIR,
        stdio: ["ignore", "pipe", "pipe"],
        detached: false,
      });
    } else {
      const npmCmd = process.platform === "win32" ? "npx.cmd" : "npx";
      gevProcess = spawn(npmCmd, ["vite", "--port", String(GEV_PORT), "--host", "0.0.0.0", "--strictPort"], {
        cwd: GEV_DIR,
        shell: true,
        stdio: ["ignore", "pipe", "pipe"],
        detached: false,
      });
    }

    gevProcess.stdout?.on("data", (chunk) => {
      const msg = chunk.toString().trim();
      if (msg) console.log(`[GodsEye] ${msg}`);
    });
    gevProcess.stderr?.on("data", (chunk) => {
      const msg = chunk.toString().trim();
      if (msg) console.warn(`[GodsEye ERR] ${msg}`);
    });

    gevProcess.on("exit", (code) => {
      console.log(`[GodsEyeBridge] Process exited with code ${code}`);
      gevRunning = false;
      gevBooting = false;
      gevProcess = null;
      broadcastGlobal({ type: "godseye:status", status: "stopped" });
    });

    // Poll until ready (up to 15 seconds)
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 500));
      if (await checkGevHealth()) {
        gevRunning = true;
        gevBooting = false;
        broadcastGlobal({ type: "godseye:status", status: "running", port: GEV_PORT });
        return { success: true, running: true, message: "God's Eye View daemon booted successfully." };
      }
    }

    gevBooting = false;
    return { success: false, error: "Timed out waiting for God's Eye View to start." };
  } catch (err) {
    gevBooting = false;
    return { success: false, error: err.message };
  }
}

/**
 * Stop the God's Eye View daemon
 */
export function stopGevDaemon() {
  if (gevProcess) {
    try {
      if (process.platform === "win32" && gevProcess.pid) {
        try { execSync(`taskkill /pid ${gevProcess.pid} /f /t`, { stdio: "ignore" }); } catch {}
      } else {
        gevProcess.kill();
      }
    } catch {}
    gevProcess = null;
  }
  gevRunning = false;
  gevBooting = false;
  broadcastGlobal({ type: "godseye:status", status: "stopped" });
  return { success: true, running: false };
}

/**
 * Dispatch spatial or optical command to the God's Eye View console
 */
export function dispatchGevCommand(cmd = {}) {
  const { action, location, lat, lon, altitude, pitch, heading, mode, layer, enabled } = cmd;

  if (action === "flyTo" || location) {
    lastKnownState.camera = {
      location: location || "Custom Coordinates",
      lat: typeof lat === "number" ? lat : lastKnownState.camera.lat,
      lon: typeof lon === "number" ? lon : lastKnownState.camera.lon,
      altitude: typeof altitude === "number" ? altitude : 12000,
      pitch: typeof pitch === "number" ? pitch : -35,
      heading: typeof heading === "number" ? heading : 0,
    };
  }

  if (action === "setOptics" || mode) {
    lastKnownState.activeOptics = String(mode || "normal").toLowerCase();
  }

  if (action === "toggleLayer" && layer) {
    lastKnownState.layers[layer] = typeof enabled === "boolean" ? enabled : !lastKnownState.layers[layer];
  }

  broadcastGlobal({
    type: "godseye:command",
    command: cmd,
    state: lastKnownState,
  });

  return { success: true, state: lastKnownState };
}

/**
 * Fetch live flight telemetry via 100% free, keyless adsb.lol API
 */
export async function getFreeFlightTelemetry(lat = 33.6844, lon = 73.0479, radiusNm = 250, militaryOnly = false) {
  try {
    const url = militaryOnly
      ? "https://api.adsb.lol/v2/mil"
      : `https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/${radiusNm}`;

    const res = await fetch(url, { headers: { "User-Agent": "Cooper-Agentic-OS/1.0" } });
    if (!res.ok) throw new Error(`adsb.lol returned ${res.status}`);
    const data = await res.json();
    const ac = data.ac || [];

    return {
      success: true,
      source: "adsb.lol (Keyless ODbL)",
      count: ac.length,
      aircraft: ac.slice(0, 30).map((a) => ({
        hex: a.hex,
        flight: (a.flight || a.r || "UNKNOWN").trim(),
        type: a.t || "Aircraft",
        lat: a.lat,
        lon: a.lon,
        alt: a.alt_baro || a.alt_geom || 0,
        speed: a.gs || 0,
        heading: a.track || 0,
        isMilitary: Boolean(a.dbFlags === 1 || militaryOnly),
      })),
    };
  } catch (err) {
    return { success: false, error: err.message, aircraft: [] };
  }
}

/**
 * Fetch live active satellite orbital elements from 100% free CelesTrak API
 */
export async function getFreeSatelliteTelemetry(group = "active") {
  try {
    const url = `https://celestrak.org/NORAD/elements/gp.php?GROUP=${encodeURIComponent(group)}&FORMAT=json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`CelesTrak returned ${res.status}`);
    const items = await res.json();

    return {
      success: true,
      source: "CelesTrak (celestrak.org)",
      total: items.length,
      satellites: items.slice(0, 25).map((s) => ({
        name: s.OBJECT_NAME,
        noradId: s.NORAD_CAT_ID,
        epoch: s.EPOCH,
        meanMotion: s.MEAN_MOTION,
        inclination: s.INCLINATION,
      })),
    };
  } catch (err) {
    return { success: false, error: err.message, satellites: [] };
  }
}

/**
 * Fetch real-time earthquakes from 100% free USGS GeoJSON API
 */
export async function getFreeEarthquakeTelemetry() {
  try {
    const url = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson";
    const res = await fetch(url);
    if (!res.ok) throw new Error(`USGS returned ${res.status}`);
    const data = await res.json();

    const features = data.features || [];
    return {
      success: true,
      source: "USGS (U.S. Public Domain)",
      count: features.length,
      incidents: features.slice(0, 20).map((f) => ({
        id: f.id,
        magnitude: f.properties.mag,
        place: f.properties.place,
        time: new Date(f.properties.time).toISOString(),
        lon: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
        depthKm: f.geometry.coordinates[2],
      })),
    };
  } catch (err) {
    return { success: false, error: err.message, incidents: [] };
  }
}

/**
 * Fetch current local weather and wind vectors via 100% free Open-Meteo API
 */
export async function getFreeWeatherTelemetry(lat = 34.0151, lon = 71.5249) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Open-Meteo returned ${res.status}`);
    const data = await res.json();
    return {
      success: true,
      source: "Open-Meteo (CC BY 4.0)",
      current: data.current,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Register God's Eye View Express routes on Cooper
 */
export function registerGodsEyeBridge(app) {
  // Status check
  app.get("/api/godseye/status", async (_req, res) => {
    const isUp = await checkGevHealth();
    res.json({
      running: isUp,
      booting: gevBooting,
      port: GEV_PORT,
      url: GEV_URL,
      state: lastKnownState,
    });
  });

  // Start daemon
  app.post("/api/godseye/start", async (_req, res) => {
    const result = await startGevDaemon();
    res.json(result);
  });

  // Stop daemon
  app.post("/api/godseye/stop", (_req, res) => {
    const result = stopGevDaemon();
    res.json(result);
  });

  // Dispatch command (flyTo, setOptics, toggleLayer)
  app.post("/api/godseye/command", (req, res) => {
    const result = dispatchGevCommand(req.body || {});
    res.json(result);
  });

  // Telemetry: Live Flights (adsb.lol)
  app.get("/api/godseye/telemetry/flights", async (req, res) => {
    const lat = Number(req.query.lat) || 33.6844;
    const lon = Number(req.query.lon) || 73.0479;
    const radius = Number(req.query.radius) || 250;
    const mil = req.query.military === "true";
    const data = await getFreeFlightTelemetry(lat, lon, radius, mil);
    res.json(data);
  });

  // Telemetry: Satellites (CelesTrak)
  app.get("/api/godseye/telemetry/satellites", async (req, res) => {
    const group = req.query.group || "active";
    const data = await getFreeSatelliteTelemetry(group);
    res.json(data);
  });

  // Telemetry: Earthquakes (USGS)
  app.get("/api/godseye/telemetry/earthquakes", async (_req, res) => {
    const data = await getFreeEarthquakeTelemetry();
    res.json(data);
  });

  // Telemetry: Weather (Open-Meteo)
  app.get("/api/godseye/telemetry/weather", async (req, res) => {
    const lat = Number(req.query.lat) || 34.0151;
    const lon = Number(req.query.lon) || 71.5249;
    const data = await getFreeWeatherTelemetry(lat, lon);
    res.json(data);
  });

  // Geospatial Planar Clustering (GeoPandas inspired algorithm)
  app.post("/api/godseye/telemetry/clusters", (req, res) => {
    const { points, maxDistanceKm } = req.body || {};
    const clusters = clusterTelemetryPoints(points || [], maxDistanceKm || 150);
    res.json({
      success: true,
      totalPoints: (points || []).length,
      clustersCount: clusters.length,
      clusters,
    });
  });
}

/**
 * Great-circle Haversine distance in kilometers
 */
export function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Cluster geospatial telemetry points within maxDistanceKm (Geopandas style)
 */
export function clusterTelemetryPoints(points = [], maxDistanceKm = 150) {
  const clusters = [];
  for (const pt of points) {
    if (typeof pt.lat !== "number" || typeof pt.lon !== "number") continue;
    let matchedCluster = null;
    for (const c of clusters) {
      const dist = haversineDistanceKm(pt.lat, pt.lon, c.centroid.lat, c.centroid.lon);
      if (dist <= maxDistanceKm) {
        matchedCluster = c;
        break;
      }
    }

    if (matchedCluster) {
      matchedCluster.points.push(pt);
      const totalLat = matchedCluster.points.reduce((s, p) => s + p.lat, 0);
      const totalLon = matchedCluster.points.reduce((s, p) => s + p.lon, 0);
      matchedCluster.centroid = {
        lat: totalLat / matchedCluster.points.length,
        lon: totalLon / matchedCluster.points.length,
      };
      matchedCluster.count = matchedCluster.points.length;
    } else {
      clusters.push({
        id: `cluster_${clusters.length + 1}`,
        centroid: { lat: pt.lat, lon: pt.lon },
        count: 1,
        points: [pt],
      });
    }
  }
  return clusters;
}
