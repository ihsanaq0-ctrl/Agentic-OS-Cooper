// Git repo inspector + project launcher for Cooper.
// Lists all git repositories in the projects directory, checks git status,
// and can open projects in VS Code.
import { execSync } from "child_process";
import { readdirSync, statSync, existsSync } from "fs";
import { join, basename } from "path";
import { config } from "../config.js";

const DEFAULT_PROJECTS_DIR = "E:\\ihsan\\Ihsans_Projects";

function getProjectsDir() {
  return config.projectsDir || DEFAULT_PROJECTS_DIR;
}

/**
 * List all git repositories in the projects directory.
 * Scans one level deep for directories containing a .git folder.
 *
 * @returns {Array<{name, path, hasGit}>}
 */
export function listProjects() {
  const dir = getProjectsDir();
  if (!existsSync(dir)) {
    return [{ error: `Projects directory not found: ${dir}. Set PROJECTS_DIR in .env` }];
  }

  const entries = readdirSync(dir, { withFileTypes: true });
  const projects = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    // Skip hidden directories and node_modules
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;

    const projPath = join(dir, entry.name);
    const hasGit = existsSync(join(projPath, ".git"));

    projects.push({
      name: entry.name,
      path: projPath,
      hasGit,
    });
  }

  return projects.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get git status for a specific project.
 *
 * @param {string} projectName - Project folder name or full path
 * @returns {object} { branch, clean, changes, lastCommit }
 */
export function gitStatus(projectName) {
  const dir = getProjectsDir();
  const projPath = existsSync(projectName) ? projectName : join(dir, projectName);

  if (!existsSync(projPath)) {
    return { error: `Project not found: ${projectName}` };
  }
  if (!existsSync(join(projPath, ".git"))) {
    return { error: `Not a git repository: ${projectName}` };
  }

  try {
    const branch = execSync("git branch --show-current", {
      cwd: projPath,
      encoding: "utf8",
      timeout: 5000,
      windowsHide: true,
    }).trim();

    const statusOutput = execSync("git status --porcelain", {
      cwd: projPath,
      encoding: "utf8",
      timeout: 5000,
      windowsHide: true,
    }).trim();

    const changes = statusOutput
      ? statusOutput.split("\n").map((line) => ({
          status: line.slice(0, 2).trim(),
          file: line.slice(3),
        }))
      : [];

    let lastCommit = "";
    try {
      lastCommit = execSync('git log -1 --format="%h %s (%cr)"', {
        cwd: projPath,
        encoding: "utf8",
        timeout: 5000,
        windowsHide: true,
      }).trim();
    } catch { /* no commits yet */ }

    return {
      project: basename(projPath),
      branch: branch || "main",
      clean: changes.length === 0,
      changes,
      lastCommit,
    };
  } catch (err) {
    return { error: `Git error: ${err.message}` };
  }
}

/**
 * Open a project in VS Code.
 *
 * @param {string} projectName - Project folder name or full path
 * @returns {object} { opened, path }
 */
export function openProject(projectName) {
  const dir = getProjectsDir();
  const projPath = existsSync(projectName) ? projectName : join(dir, projectName);

  if (!existsSync(projPath)) {
    return { error: `Project not found: ${projectName}` };
  }

  try {
    execSync(`code "${projPath}"`, {
      timeout: 5000,
      windowsHide: true,
    });
    return { opened: true, path: projPath };
  } catch (err) {
    return { error: `Failed to open VS Code: ${err.message}` };
  }
}
