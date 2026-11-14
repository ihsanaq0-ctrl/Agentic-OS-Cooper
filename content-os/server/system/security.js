// ── Biometric Multi-User Security & Gatekeeper Agent ─────────────
// Coordinates local MediaPipe biometrics, session locking, operator
// identity verification, and role-based execution guards.

import {
  createUser,
  listUsers,
  getUser,
  deleteUser,
  updateUserLogin,
  getUserCount,
  getAllFaceDescriptors,
} from "../db.js";
import { broadcastGlobal } from "../sse.js";

// Active in-memory authentication session
export const authSession = {
  locked: false,
  currentUser: null,
  lastUnlockedAt: null,
};

/**
 * Get current system authentication & lock status
 */
export function getAuthStatus() {
  const count = getUserCount();
  const required = count > 0;
  return {
    authRequired: required,
    userCount: count,
    locked: required && authSession.locked,
    currentUser: authSession.currentUser,
    lastUnlockedAt: authSession.lastUnlockedAt,
  };
}

/**
 * Checks if the system is currently locked
 */
export function isSystemLocked() {
  const count = getUserCount();
  return count > 0 && authSession.locked;
}

/**
 * Get active authenticated operator
 */
export function getCurrentOperator() {
  return authSession.currentUser;
}

/**
 * Lock Cooper OS and activate biometric visor across all connected clients
 */
export function lockSystem(reason = "Operator locked system") {
  authSession.locked = true;
  authSession.currentUser = null;

  // Real-time broadcast to all browser clients
  broadcastGlobal({
    type: "auth:lock",
    reason,
    timestamp: new Date().toISOString(),
  });

  return { success: true, locked: true, reason };
}

/**
 * Unlock Cooper OS via facial recognition match
 */
export function unlockWithFace(nameOrId) {
  let user = null;
  if (!nameOrId) return { success: false, error: "Identifier required" };

  user = getUser(nameOrId);
  if (!user) {
    const all = listUsers();
    user = all.find((u) => u.name.toLowerCase() === String(nameOrId).toLowerCase());
  }

  if (!user) {
    return { success: false, error: "Enrolled operator not found" };
  }

  updateUserLogin(user.id);
  authSession.locked = false;
  authSession.currentUser = { id: user.id, name: user.name, role: user.role };
  authSession.lastUnlockedAt = new Date().toISOString();

  // Real-time broadcast to browser HUD
  broadcastGlobal({
    type: "auth:unlock",
    user: authSession.currentUser,
    method: "face",
    timestamp: authSession.lastUnlockedAt,
  });

  return { success: true, user: authSession.currentUser };
}

/**
 * Unlock Cooper OS via emergency PIN bypass
 */
export function unlockWithPin(pin) {
  if (!pin) return { success: false, error: "PIN code required" };
  const users = listUsers();
  const match = users.find((u) => u.pin_code && String(u.pin_code) === String(pin).trim());

  if (!match) {
    return { success: false, error: "Invalid PIN code" };
  }

  updateUserLogin(match.id);
  authSession.locked = false;
  authSession.currentUser = { id: match.id, name: match.name, role: match.role };
  authSession.lastUnlockedAt = new Date().toISOString();

  broadcastGlobal({
    type: "auth:unlock",
    user: authSession.currentUser,
    method: "pin",
    timestamp: authSession.lastUnlockedAt,
  });

  return { success: true, user: authSession.currentUser };
}

/**
 * Open Biometric Enrollment Portal on HUD
 */
export function triggerOpenBiometricPortal() {
  broadcastGlobal({
    type: "auth:open-portal",
    timestamp: new Date().toISOString(),
  });
  return { triggered: true };
}

/**
 * List authorized operators with sanitized metadata (no raw descriptors or pins)
 */
export function listEnrolledOperators() {
  const users = listUsers();
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    role: u.role,
    avatar: u.avatar_thumb ? "available" : "none",
    createdAt: u.created_at,
    lastLoginAt: u.last_login_at,
  }));
}

/**
 * Gatekeeper guard for sensitive system automation tools
 */
export function assertUnlocked(actionDescription = "perform sensitive actions") {
  if (isSystemLocked()) {
    throw new Error(
      `Biometric security lock engaged. Authentication required before Cooper can ${actionDescription}.`
    );
  }
}
