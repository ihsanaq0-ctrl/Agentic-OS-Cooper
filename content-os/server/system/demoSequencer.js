import { runProject } from "./projectRunner.js";
import { startRecording, stopRecording } from "./mediaCapture.js";
import { createDraft } from "../db.js";
import { runBrowserTask } from "./browserAgentBridge.js";

/**
 * Autonomously runs a project, records a demo, and creates a LinkedIn draft.
 * @param {string} projectName - The name of the project to demo
 * @param {number} durationSeconds - How long to record the demo
 */
export async function recordProjectDemo(projectName, durationSeconds = 20) {
  // 1. Run the project
  console.log(`[DemoSequencer] Starting project: ${projectName}`);
  const runRes = await runProject(projectName);
  
  // Wait a few seconds for UI to fully load in the browser
  await new Promise(r => setTimeout(r, 6000));

  // 2. Start screen recording
  console.log(`[DemoSequencer] Starting screen recording...`);
  startRecording({ maxDurationSeconds: durationSeconds + 5 });

  // 3. Autonomous UI interaction using browser-use agent while recording
  console.log(`[DemoSequencer] Driving UI walkthrough with browser agent for ${durationSeconds}s...`);
  const demoUrl = (runRes.urls && runRes.urls.length) ? runRes.urls[0] : "http://localhost:5173";
  try {
    await Promise.race([
      runBrowserTask({
        prompt: `Navigate to ${demoUrl}. Click through the core features, tabs, dashboard charts, analytics, and buttons to actively showcase the project functionality for the demo video.`,
        url: demoUrl,
        browser: "chromium",
        durationSeconds: durationSeconds
      }),
      new Promise(r => setTimeout(r, durationSeconds * 1000))
    ]);
  } catch (err) {
    console.warn(`[DemoSequencer] Browser interaction note:`, err.message);
    await new Promise(r => setTimeout(r, durationSeconds * 1000));
  }

  // 4. Stop Recording
  console.log(`[DemoSequencer] Stopping screen recording...`);
  const recordRes = await stopRecording();

  // 5. Create LinkedIn Post Draft with the video
  const caption = `🚀 Excited to showcase my latest project: ${runRes.project}!\n\nI just finished building out the core architecture and UI. Check out the demo video to see the live data integration, analytics dashboard, and seamless UX in action.\n\nTech stack includes Node.js, Vite, and Python backend APIs.\n\n#BuildInPublic #AI #SoftwareEngineering #Automation`;
  
  const draft = createDraft({
    title: `${runRes.project} Launch Demo`,
    caption,
    media_url: recordRes.relativePath,
    media_type: "video"
  });

  return {
    success: true,
    message: `Recorded ${recordRes.durationSeconds}s demo of ${runRes.project} and drafted LinkedIn post.`,
    videoPath: recordRes.relativePath,
    draftId: draft.id
  };
}
