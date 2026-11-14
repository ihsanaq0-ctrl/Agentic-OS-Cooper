/**
 * Command Sandbox for Agentic OS
 * Validates and sanitizes commands before execution to prevent LLM prompt injection.
 */

// Blocklist of dangerous shell characters
const DANGEROUS_CHARS = /[&|;><$\\]/;

// Blocklist of dangerous command prefixes
const DANGEROUS_PREFIXES = [
  "rm", "del", "format", "diskpart", "powershell", "cmd", "wmic",
  "net", "ipconfig", "vssadmin", "schtasks", "reg", "taskkill"
];

// Allowlist of explicitly safe commands (exact match or prefix)
const SAFE_PREFIXES = [
  "dir", "echo", "ping", "whoami", "date", "time", "git", "npm", "node"
];

/**
 * Validates a command against the sandbox rules.
 * @param {string} command - The raw command string.
 * @returns {object} { safe: boolean, reason?: string, sanitizedCommand?: string }
 */
export function validateCommand(command) {
  if (!command || typeof command !== "string") {
    return { safe: false, reason: "Command must be a non-empty string." };
  }

  const trimmed = command.trim();
  const lower = trimmed.toLowerCase();
  
  // 1. Check for dangerous characters (Command Injection via chaining)
  if (DANGEROUS_CHARS.test(trimmed)) {
    return { safe: false, reason: "Command contains dangerous shell characters (&, |, ;, >, <, $, \\)." };
  }

  // 2. Extract the base command (first word)
  const baseCommand = lower.split(/\s+/)[0];

  // 3. Check against dangerous prefixes
  if (DANGEROUS_PREFIXES.includes(baseCommand)) {
    return { safe: false, reason: `Command '${baseCommand}' is explicitly blocked by the sandbox.` };
  }

  // 4. (Optional) Strict Allowlist check - If you want to be extremely strict, uncomment below:
  /*
  const isSafe = SAFE_PREFIXES.some(prefix => baseCommand === prefix);
  if (!isSafe) {
    return { safe: false, reason: `Command '${baseCommand}' is not in the safe allowlist.` };
  }
  */

  return { safe: true, sanitizedCommand: trimmed };
}

/**
 * Throws an error if the command is unsafe.
 */
export function assertSafeCommand(command) {
  const result = validateCommand(command);
  if (!result.safe) {
    throw new Error(`Sandbox Violation: ${result.reason}`);
  }
  return result.sanitizedCommand;
}
