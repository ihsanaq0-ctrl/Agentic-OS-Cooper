import { spawn } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import screenshot from "screenshot-desktop";
import ffmpegPath from "ffmpeg-static";
import { ROOT_DIR } from "../config.js";

// Ensure media directories exist
const MEDIA_DIR = join(ROOT_DIR, "storage", "media");
const SCREENSHOTS_DIR = join(MEDIA_DIR, "screenshots");
const RECORDINGS_DIR = join(MEDIA_DIR, "recordings");

mkdirSync(SCREENSHOTS_DIR, { recursive: true });
mkdirSync(RECORDINGS_DIR, { recursive: true });

let recordingProcess = null;
let currentRecordingInfo = null;

/**
 * Capture a persistent screenshot and save it to the media gallery.
 * @returns {object} { path, relativePath, filename }
 */
export async function captureScreenshot() {
  const filename = `screenshot-${Date.now()}.png`;
  const filePath = join(SCREENSHOTS_DIR, filename);

  try {
    await screenshot({ filename: filePath });
  } catch (err) {
    throw new Error(`Screenshot capture failed: ${err.message}`);
  }

  if (!existsSync(filePath)) {
    throw new Error("Screenshot was not saved.");
  }

  return {
    path: filePath,
    relativePath: `/storage/media/screenshots/${filename}`,
    filename,
  };
}

/**
 * Starts recording the desktop using FFmpeg.
 * @param {object} options
 * @param {number} options.maxDurationSeconds - Auto-stop safeguard
 * @returns {object} { success, message, filePath }
 */
export function startRecording(options = {}) {
  if (recordingProcess) {
    throw new Error("A screen recording is already in progress.");
  }

  if (!ffmpegPath) {
    throw new Error("ffmpeg-static is not available.");
  }

  const filename = `recording-${Date.now()}.mp4`;
  const filePath = join(RECORDINGS_DIR, filename);
  
  // Windows desktop capture using gdigrab
  // 30 fps, H.264, YUV420p (for high compatibility)
  const args = [
    "-y", // Overwrite output files without asking
    "-f", "gdigrab",
    "-framerate", "30",
    "-i", "desktop",
    "-c:v", "libx264",
    "-preset", "veryfast", // Fast encoding
    "-crf", "22",          // High quality
    "-pix_fmt", "yuv420p", // Important for web/social media compatibility
    "-movflags", "+faststart",
    filePath
  ];

  console.log(`Starting screen recording: ${ffmpegPath} ${args.join(" ")}`);

  recordingProcess = spawn(ffmpegPath, args, {
    stdio: ["pipe", "pipe", "pipe"]
  });

  const startTime = Date.now();
  currentRecordingInfo = {
    filename,
    filePath,
    relativePath: `/storage/media/recordings/${filename}`,
    startTime,
    maxDurationSeconds: options.maxDurationSeconds || 600 // default 10 minutes
  };

  // Optional: Auto-stop timeout
  if (currentRecordingInfo.maxDurationSeconds > 0) {
    currentRecordingInfo.timeout = setTimeout(() => {
      console.log(`Auto-stopping recording after ${currentRecordingInfo.maxDurationSeconds} seconds.`);
      stopRecording();
    }, currentRecordingInfo.maxDurationSeconds * 1000);
  }

  recordingProcess.on("error", (err) => {
    console.error("FFmpeg recording error:", err);
    cleanupRecordingState();
  });

  recordingProcess.on("close", (code) => {
    console.log(`FFmpeg recording process exited with code ${code}`);
    cleanupRecordingState();
  });

  return {
    success: true,
    message: "Screen recording started.",
    filePath,
    relativePath: currentRecordingInfo.relativePath
  };
}

/**
 * Stops the ongoing screen recording gracefully.
 * @returns {Promise<object>} { success, filePath, durationSeconds, thumbnailPath }
 */
export function stopRecording() {
  return new Promise((resolve, reject) => {
    if (!recordingProcess) {
      return reject(new Error("No active recording to stop."));
    }

    const info = { ...currentRecordingInfo };
    const durationSeconds = Math.round((Date.now() - info.startTime) / 1000);

    // Stop FFmpeg gracefully by sending 'q' to stdin
    recordingProcess.stdin.write("q\n");
    
    // Wait for process to close
    recordingProcess.once("close", async () => {
      cleanupRecordingState();
      
      // Generate thumbnail
      let thumbRelPath = null;
      try {
        const thumbRes = await generateThumbnail(info.filePath, info.filename);
        thumbRelPath = thumbRes.relativePath;
      } catch (err) {
        console.error("Thumbnail generation failed:", err.message);
      }
      
      resolve({
        success: true,
        message: "Recording saved successfully.",
        filePath: info.filePath,
        relativePath: info.relativePath,
        thumbnailPath: thumbRelPath,
        durationSeconds
      });
    });

    // Fallback if process doesn't close
    setTimeout(() => {
      if (recordingProcess) {
        recordingProcess.kill("SIGKILL");
        cleanupRecordingState();
        resolve({
          success: true,
          message: "Recording stopped (force killed).",
          filePath: info.filePath,
          relativePath: info.relativePath,
          durationSeconds
        });
      }
    }, 5000);
  });
}

function cleanupRecordingState() {
  if (currentRecordingInfo && currentRecordingInfo.timeout) {
    clearTimeout(currentRecordingInfo.timeout);
  }
  recordingProcess = null;
  currentRecordingInfo = null;
}

/**
 * Generates a thumbnail for the video at the 1-second mark.
 */
function generateThumbnail(videoPath, videoFilename) {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error("ffmpeg-static is not available."));
    
    const thumbFilename = videoFilename.replace(".mp4", "-thumb.jpg");
    const thumbPath = join(RECORDINGS_DIR, thumbFilename);
    
    const args = [
      "-y",
      "-i", videoPath,
      "-ss", "00:00:01.000",
      "-vframes", "1",
      thumbPath
    ];

    const thumbProc = spawn(ffmpegPath, args);
    
    thumbProc.on("close", (code) => {
      if (code === 0 && existsSync(thumbPath)) {
        resolve({
          path: thumbPath,
          relativePath: `/storage/media/recordings/${thumbFilename}`
        });
      } else {
        reject(new Error(`Thumbnail generation failed with code ${code}`));
      }
    });
    
    thumbProc.on("error", (err) => reject(err));
  });
}

export function getRecordingStatus() {
  if (!recordingProcess || !currentRecordingInfo) {
    return { isRecording: false };
  }
  return {
    isRecording: true,
    durationSeconds: Math.round((Date.now() - currentRecordingInfo.startTime) / 1000),
    filePath: currentRecordingInfo.filePath,
    relativePath: currentRecordingInfo.relativePath
  };
}
