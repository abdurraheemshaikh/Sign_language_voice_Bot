import React, { useEffect, useMemo, useRef, useState } from "react";

type PredictResponse = {
  gesture: string | null;
  confidence: number | null;
};

const DEBOUNCE_FRAMES = 5;

function supportsTTS(): boolean {
  return "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

function speakText(text: string) {
  const value = text.trim();
  if (!value) return;
  if (!supportsTTS()) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(value);
  u.rate = 1;
  u.pitch = 1;
  u.volume = 1;
  window.speechSynthesis.speak(u);
}

function stopSpeaking() {
  if (supportsTTS()) window.speechSynthesis.cancel();
}

function getLastWord(transcript: string): string {
  const t = transcript.trimEnd();
  if (!t) return "";
  const parts = t.split(/\s+/);
  return parts[parts.length - 1] ?? "";
}

async function postPredict(dataUrl: string): Promise<PredictResponse> {
  const res = await fetch("/api/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: dataUrl }),
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as PredictResponse;
}

export function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("Idle");
  const [detected, setDetected] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [stableCount, setStableCount] = useState(0);
  const [lastGesture, setLastGesture] = useState<string | null>(null);
  const [lastCommittedAt, setLastCommittedAt] = useState(0);
  const [threshold, setThreshold] = useState(0.6);
  const [autoCommit, setAutoCommit] = useState(true);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [transcript, setTranscript] = useState("");
  const [contrastHigh, setContrastHigh] = useState(false);
  const [ariaLive, setAriaLive] = useState("");

  const debounceLabel = useMemo(
    () => `${stableCount}/${DEBOUNCE_FRAMES}`,
    [stableCount],
  );

  useEffect(() => {
    document.documentElement.toggleAttribute("data-contrast-high", contrastHigh);
  }, [contrastHigh]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        speakText(transcript);
      } else if (e.key === "Escape") {
        stopSpeaking();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "Backspace") {
        setTranscript("");
        setAriaLive("Cleared.");
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [transcript]);

  useEffect(() => {
    return () => {
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function commit(gesture: string) {
    if (gesture === "DELETE") {
      setTranscript((t) => t.slice(0, -1));
      setAriaLive("Deleted.");
      return;
    }
    setTranscript((t) => t + gesture);
    if (gesture === " ") {
      if (autoSpeak) speakText(getLastWord(transcript + " "));
    } else {
      setAriaLive(`Added ${gesture}`);
    }
  }

  async function predictOnce() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    if (video.readyState < 2) return;

    const width = 480;
    const height =
      Math.round((video.videoHeight / video.videoWidth) * width) || 300;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.7);

    const { gesture, confidence } = await postPredict(dataUrl);
    setDetected(gesture);
    setConfidence(confidence);

    const confOk =
      confidence === null || confidence === undefined ? true : confidence >= threshold;

    if (!gesture || !confOk) {
      setStatus("Looking for hand…");
      setLastGesture(null);
      setStableCount(0);
      return;
    }

    setStatus("Detecting…");
    setStableCount((c) => {
      const next = gesture === lastGesture ? c + 1 : 1;
      return next;
    });
    setLastGesture(gesture);

    if (autoCommit) {
      const now = Date.now();
      const countNow = gesture === lastGesture ? stableCount + 1 : 1;
      if (countNow >= DEBOUNCE_FRAMES && now - lastCommittedAt > 550) {
        commit(gesture);
        setLastCommittedAt(now);
        setLastGesture(null);
        setStableCount(0);
      }
    }
  }

  async function start() {
    if (running) return;
    setStatus("Requesting camera…");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setRunning(true);
      setStatus("Running");
      timerRef.current = window.setInterval(() => {
        void predictOnce().catch((e) => {
          console.error(e);
          setStatus("Backend error");
          setAriaLive("Backend error. Check the server logs.");
        });
      }, 140);
    } catch (e) {
      setStatus("Camera blocked");
      setAriaLive("Camera permission denied or unavailable.");
      throw e;
    }
  }

  function stop() {
    setRunning(false);
    setStatus("Stopped");
    setDetected(null);
    setConfidence(null);
    setLastGesture(null);
    setStableCount(0);
    stopSpeaking();

    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    const video = videoRef.current;
    if (video) video.srcObject = null;
  }

  return (
    <div className="page">
      <a className="skip" href="#main">
        Skip to content
      </a>

      <header className="topbar">
        <div className="container topbarInner">
          <div className="brand">
            <div className="mark" aria-hidden="true">
              WH
            </div>
            <div>
              <div className="name">Whispering Hands</div>
              <div className="tag">Real-time sign-to-speech</div>
            </div>
          </div>
          <div className="actions">
            <button className="btn ghost" onClick={() => setContrastHigh((v) => !v)}>
              High contrast
            </button>
            <a className="btn ghost" href="/api/health">
              API health
            </a>
          </div>
        </div>
      </header>

      <main id="main" className="container grid">
        <section className="card">
          <div className="cardHeader">
            <h1 className="h1">Live camera</h1>
            <div className="row">
              <button className="btn" onClick={() => void start()} disabled={running}>
                Start
              </button>
              <button className="btn ghost" onClick={stop} disabled={!running}>
                Stop
              </button>
            </div>
          </div>

          <div className="stage" aria-label="Camera preview">
            <video ref={videoRef} playsInline muted />
            <canvas ref={canvasRef} className="srOnly" aria-hidden="true" />
            <div className="overlay">
              <div className="pill" aria-live="polite">
                {status}
              </div>
            </div>
          </div>

          <div className="metrics">
            <div className="metric">
              <div className="metricLabel">Detected</div>
              <div className="metricValue mono">{detected ?? "—"}</div>
            </div>
            <div className="metric">
              <div className="metricLabel">Confidence</div>
              <div className="metricValue mono">
                {confidence === null ? "—" : confidence.toFixed(2)}
              </div>
            </div>
            <div className="metric">
              <div className="metricLabel">Debounce</div>
              <div className="metricValue mono">{debounceLabel}</div>
            </div>
          </div>

          <div className="hint" role="note">
            Tip: If the camera is blocked, allow permissions in the browser.
          </div>
        </section>

        <section className="card">
          <div className="cardHeader">
            <h2 className="h2">Transcript</h2>
            <div className="row">
              <button className="btn" onClick={() => speakText(transcript)}>
                Speak
              </button>
              <button className="btn ghost" onClick={() => setTranscript("")}>
                Clear
              </button>
            </div>
          </div>

          <div className="controls">
            <label className="toggle">
              <input
                type="checkbox"
                checked={autoSpeak}
                onChange={(e) => setAutoSpeak(e.target.checked)}
              />
              <span>Auto-speak on SPACE</span>
            </label>

            <label className="toggle">
              <input
                type="checkbox"
                checked={autoCommit}
                onChange={(e) => setAutoCommit(e.target.checked)}
              />
              <span>Auto-commit letters (debounced)</span>
            </label>

            <label className="field">
              <span className="fieldLabel">Confidence threshold</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
              />
              <span className="fieldValue mono">{threshold.toFixed(2)}</span>
            </label>
          </div>

          <div className="textbox">
            <div className="srAnnounce" aria-live="polite">
              {ariaLive}
            </div>
            <textarea
              className="textarea"
              rows={8}
              spellCheck={false}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Your recognized letters will appear here..."
              aria-label="Transcript text"
            />
            <div className="row wrap">
              <button className="btn ghost" onClick={() => setTranscript((t) => t.slice(0, -1))}>
                Backspace
              </button>
              <button
                className="btn ghost"
                onClick={() => {
                  setTranscript((t) => t + " ");
                  if (autoSpeak) speakText(getLastWord(transcript + " "));
                }}
              >
                SPACE
              </button>
              <button
                className="btn ghost"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(transcript);
                    setAriaLive("Copied to clipboard.");
                  } catch {
                    setAriaLive("Copy failed.");
                  }
                }}
              >
                Copy
              </button>
            </div>
          </div>

          <details className="details">
            <summary>Keyboard shortcuts</summary>
            <ul className="list">
              <li>
                <kbd>Enter</kbd> Speak transcript
              </li>
              <li>
                <kbd>Esc</kbd> Stop speaking
              </li>
              <li>
                <kbd>Ctrl</kbd> + <kbd>Backspace</kbd> Clear
              </li>
            </ul>
          </details>
        </section>
      </main>

      <footer className="footer">
        <div className="container footInner">
          Built for accessibility: keyboard-friendly, reduced motion support, and
          screen-reader announcements.
        </div>
      </footer>
    </div>
  );
}

