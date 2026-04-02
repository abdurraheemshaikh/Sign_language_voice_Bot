/* Whispering Hands - browser camera client */

const $ = (id) => document.getElementById(id);

const video = $("video");
const canvas = $("canvas");
const statusPill = $("statusPill");
const fpsPill = $("fpsPill");
const detectedValue = $("detectedValue");
const confidenceValue = $("confidenceValue");
const debounceValue = $("debounceValue");
const transcriptEl = $("transcript");
const ariaLive = $("ariaLive");

const startBtn = $("startBtn");
const stopBtn = $("stopBtn");
const speakBtn = $("speakBtn");
const clearBtn = $("clearBtn");
const backspaceBtn = $("backspaceBtn");
const spaceBtn = $("spaceBtn");
const copyBtn = $("copyBtn");

const autoSpeak = $("autoSpeak");
const autoCommit = $("autoCommit");
const threshold = $("threshold");
const thresholdValue = $("thresholdValue");
const toggleContrast = $("toggleContrast");

let stream = null;
let running = false;
let loopTimer = null;

const DEBOUNCE_FRAMES = 5;
let lastGesture = null;
let stableCount = 0;
let lastCommittedAt = 0;

let lastFpsSampleAt = 0;
let framesSent = 0;

function setStatus(text) {
  statusPill.textContent = text;
}

function announce(text) {
  ariaLive.textContent = text;
}

function fmtConf(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return (Math.round(v * 100) / 100).toFixed(2);
}

function supportsTTS() {
  return "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

function stopSpeaking() {
  if (supportsTTS()) window.speechSynthesis.cancel();
}

function speak(text) {
  const value = (text ?? "").trim();
  if (!value) return;
  if (!supportsTTS()) {
    announce("Text-to-speech is not supported in this browser.");
    return;
  }
  stopSpeaking();
  const u = new SpeechSynthesisUtterance(value);
  u.rate = 1;
  u.pitch = 1;
  u.volume = 1;
  window.speechSynthesis.speak(u);
}

function getCurrentWord(transcript) {
  const t = (transcript ?? "").trimEnd();
  if (!t) return "";
  const parts = t.split(/\s+/);
  return parts[parts.length - 1] || "";
}

function commitGesture(gesture) {
  const g = gesture ?? "";
  if (!g) return;

  if (g === "DELETE") {
    transcriptEl.value = transcriptEl.value.slice(0, -1);
    announce("Deleted.");
    return;
  }

  transcriptEl.value += g;
  if (g === " ") {
    const word = getCurrentWord(transcriptEl.value);
    if (autoSpeak.checked) speak(word);
  } else {
    announce(`Added ${g}`);
  }
}

function updateDebounceUI() {
  debounceValue.textContent = `${stableCount}/${DEBOUNCE_FRAMES}`;
}

async function predictOnce() {
  if (!running || !stream) return;
  if (video.readyState < 2) return;

  const w = 480;
  const h = Math.round((video.videoHeight / video.videoWidth) * w) || 300;
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d", { willReadFrequently: false });
  ctx.drawImage(video, 0, 0, w, h);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.7);

  const res = await fetch("/api/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: dataUrl }),
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg);
  }
  const json = await res.json();
  return json;
}

function updateFps() {
  const now = performance.now();
  framesSent += 1;
  if (!lastFpsSampleAt) lastFpsSampleAt = now;
  const dt = now - lastFpsSampleAt;
  if (dt >= 1000) {
    const fps = Math.round((framesSent * 1000) / dt);
    fpsPill.textContent = `${fps} fps`;
    framesSent = 0;
    lastFpsSampleAt = now;
  }
}

async function loop() {
  if (!running) return;

  try {
    const { gesture, confidence } = (await predictOnce()) ?? {};

    detectedValue.textContent = gesture ?? "—";
    confidenceValue.textContent = fmtConf(confidence);

    const confOk =
      confidence === null || confidence === undefined
        ? true
        : confidence >= Number(threshold.value);

    if (!gesture || !confOk) {
      lastGesture = null;
      stableCount = 0;
      updateDebounceUI();
      setStatus("Looking for hand…");
      return;
    }

    setStatus("Detecting…");
    if (gesture === lastGesture) stableCount += 1;
    else {
      lastGesture = gesture;
      stableCount = 1;
    }
    updateDebounceUI();

    if (autoCommit.checked && stableCount >= DEBOUNCE_FRAMES) {
      const now = Date.now();
      if (now - lastCommittedAt > 550) {
        commitGesture(gesture);
        lastCommittedAt = now;
      }
      stableCount = 0;
      lastGesture = null;
      updateDebounceUI();
    }
  } catch (e) {
    setStatus("Backend error");
    announce("Backend error. Check /api/health and server logs.");
    console.error(e);
  } finally {
    updateFps();
  }
}

async function start() {
  if (running) return;
  setStatus("Requesting camera…");

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
  } catch (e) {
    setStatus("Camera blocked");
    announce("Camera permission was denied or unavailable.");
    throw e;
  }

  video.srcObject = stream;
  await video.play();

  running = true;
  startBtn.disabled = true;
  stopBtn.disabled = false;
  setStatus("Running");

  loopTimer = window.setInterval(loop, 140);
}

function stop() {
  running = false;
  startBtn.disabled = false;
  stopBtn.disabled = true;
  setStatus("Stopped");
  fpsPill.textContent = "—";

  if (loopTimer) window.clearInterval(loopTimer);
  loopTimer = null;

  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  video.srcObject = null;
  lastGesture = null;
  stableCount = 0;
  updateDebounceUI();
  stopSpeaking();
}

function toggleHighContrast() {
  const root = document.documentElement;
  const v = root.getAttribute("data-contrast") === "high" ? "normal" : "high";
  if (v === "high") root.setAttribute("data-contrast", "high");
  else root.removeAttribute("data-contrast");
}

threshold.addEventListener("input", () => {
  thresholdValue.textContent = Number(threshold.value).toFixed(2);
});

startBtn.addEventListener("click", () => void start());
stopBtn.addEventListener("click", stop);
toggleContrast.addEventListener("click", toggleHighContrast);

speakBtn.addEventListener("click", () => speak(transcriptEl.value));
clearBtn.addEventListener("click", () => {
  transcriptEl.value = "";
  announce("Cleared.");
});
backspaceBtn.addEventListener("click", () => {
  transcriptEl.value = transcriptEl.value.slice(0, -1);
  announce("Deleted.");
});
spaceBtn.addEventListener("click", () => {
  transcriptEl.value += " ";
  if (autoSpeak.checked) speak(getCurrentWord(transcriptEl.value));
});
copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(transcriptEl.value);
    announce("Copied to clipboard.");
  } catch {
    announce("Copy failed.");
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    speak(transcriptEl.value);
    return;
  }
  if (e.key === "Escape") {
    stopSpeaking();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "Backspace") {
    transcriptEl.value = "";
    announce("Cleared.");
  }
});

// Initial UI
thresholdValue.textContent = Number(threshold.value).toFixed(2);
updateDebounceUI();
setStatus("Idle");

