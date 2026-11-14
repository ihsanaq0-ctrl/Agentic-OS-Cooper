import { spawn } from "child_process";
import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { config } from "../config.js";
import { openBrowser } from "./controller.js";

const DEFAULT_PROJECTS_DIR = "E:\\ihsan\\Ihsans_Projects";

function getProjectsDir() {
  return config.projectsDir || DEFAULT_PROJECTS_DIR;
}

const activeProjects = new Map();

/**
 * Searches for a project by name in the projects directory.
 */
export function findProject(projectName) {
  const dir = getProjectsDir();
  const searchStr = projectName.toLowerCase();
  
  if (!existsSync(dir)) return null;

  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.toLowerCase().includes(searchStr)) {
      return {
        name: entry.name,
        path: join(dir, entry.name)
      };
    }
  }
  return null;
}

/**
 * Detects the run command and directory for a given project path.
 * Handles nested subdirectories like 'trading-app' or 'backend'.
 */
export function detectProjectRunStrategy(projectPath) {
  const strategies = [];
  
  // Helper to check for package.json
  const checkNode = (dirPath) => {
    const pkgPath = join(dirPath, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        if (pkg.scripts && (pkg.scripts.dev || pkg.scripts.start)) {
          strategies.push({
            dir: dirPath,
            cmd: /^win/.test(process.platform) ? "npm.cmd" : "npm",
            args: ["run", pkg.scripts.dev ? "dev" : "start"],
            type: "node"
          });
        }
      } catch (e) {
        // ignore JSON parse error
      }
    }
  };

  // Helper to check for Python
  const checkPython = (dirPath) => {
    const mainPy = join(dirPath, "main.py");
    const reqs = join(dirPath, "requirements.txt");
    const venv = join(dirPath, ".venv");
    
    if (existsSync(mainPy) || existsSync(reqs)) {
      let pyCmd = "python";
      if (existsSync(venv)) {
        pyCmd = join(venv, "Scripts", "python.exe");
      }
      
      // Look for uvicorn or standard python run
      let args = ["main.py"];
      try {
        const mainContent = readFileSync(mainPy, "utf-8");
        if (mainContent.includes("FastAPI") || mainContent.includes("uvicorn")) {
           // We might just run main.py if it has if __name__ == '__main__'
        }
      } catch (e) {}

      strategies.push({
        dir: dirPath,
        cmd: pyCmd,
        args: args,
        type: "python"
      });
    }
  };

  // 1. Check root
  checkNode(projectPath);
  checkPython(projectPath);

  // 2. Check 1-level deep subdirectories (e.g. trading-app, frontend, backend)
  const subDirs = readdirSync(projectPath, { withFileTypes: true });
  for (const entry of subDirs) {
    if (entry.isDirectory() && !entry.name.startsWith(".")) {
      const subPath = join(projectPath, entry.name);
      checkNode(subPath);
      checkPython(subPath);
    }
  }

  return strategies;
}

/**
 * Start a project (auto-detecting the best strategy).
 * @param {string} projectName 
 */
export async function runProject(projectName) {
  const project = findProject(projectName);
  if (!project) {
    throw new Error(`Project not found matching: ${projectName}`);
  }

  // Already running?
  if (activeProjects.has(project.path)) {
    return { 
      success: true, 
      message: `${project.name} is already running.`, 
      project: project.name,
      urls: activeProjects.get(project.path).urls 
    };
  }

  const strategies = detectProjectRunStrategy(project.path);
  if (strategies.length === 0) {
    throw new Error(`Could not determine how to run project: ${project.name}`);
  }

  const processes = [];
  const discoveredUrls = [];

  // Run all discovered valid strategies (e.g. frontend + backend)
  for (const strat of strategies) {
    console.log(`Starting ${strat.type} in ${strat.dir} -> ${strat.cmd} ${strat.args.join(" ")}`);
    
    const proc = spawn(strat.cmd, strat.args, {
      cwd: strat.dir,
      env: { ...process.env, BROWSER: "none" } // Prevent auto-opening browser directly
    });
    
    processes.push(proc);

    proc.stdout.on("data", (data) => {
      const output = data.toString();
      // Heuristic to detect localhost ports
      const portMatch = output.match(/http:\/\/(?:localhost|127\.0\.0\.1):(\d+)/i);
      if (portMatch && portMatch[0]) {
        const url = portMatch[0].toLowerCase().replace("127.0.0.1", "localhost");
        if (!discoveredUrls.includes(url)) {
          console.log(`Discovered URL: ${url}`);
          discoveredUrls.push(url);
          // Auto-open the frontend URL in browser
          if (strat.type === "node") {
             openBrowser(url).catch(console.error);
          }
        }
      }
    });

    proc.stderr.on("data", (data) => {
      // console.error(`[${strat.type}]`, data.toString());
    });
  }

  activeProjects.set(project.path, { processes, urls: discoveredUrls });

  // Give it a moment to boot and detect ports
  await new Promise(r => setTimeout(r, 4000));

  const urls = activeProjects.get(project.path).urls;

  // Fallback opening if port parsing failed but it's a node project
  if (urls.length === 0 && strategies.some(s => s.type === "node")) {
    urls.push("http://localhost:5173");
    urls.push("http://localhost:3000");
    openBrowser("http://localhost:5173").catch(e => {});
  }

  return {
    success: true,
    message: `Started ${project.name}`,
    project: project.name,
    urls
  };
}

/**
 * Stop a running project.
 */
export function stopProject(projectName) {
  const project = findProject(projectName);
  if (!project) throw new Error("Project not found.");

  const active = activeProjects.get(project.path);
  if (!active) return { success: true, message: "Project is not running." };

  for (const proc of active.processes) {
    try {
      proc.kill("SIGINT");
    } catch (e) {}
  }
  
  activeProjects.delete(project.path);
  return { success: true, message: `Stopped ${project.name}` };
}
