# Whispering Hands

**Whispering Hands** is an AI-powered system that translates sign language into spoken words in real time. Using a live camera feed, the model recognizes hand gestures (sign language letters), converts them into text, and generates speech output. The system aims to reduce communication barriers between Deaf and hearing individuals by enabling fast, natural interaction in everyday situations.

This repository includes:
- Your existing training/inference scripts (OpenCV + MediaPipe + scikit-learn)
- A **React web app** (browser camera + modern accessible UI) backed by a **FastAPI** inference API

---

## Web app (recommended)

### Requirements
- Python 3.10+ (3.11 is fine)
- A webcam
- A modern browser (Chrome/Edge recommended for camera + speech)

### Setup (Windows PowerShell)

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### Run (development)

In one terminal (backend):

```powershell
uvicorn backend.main:app --reload
```

In a second terminal (frontend):

```powershell
cd frontend
npm install
npm run dev
```

Then open:
- `http://127.0.0.1:5173`

### Model file

By default, the backend loads:
- `model2.p` (repo root)

If you want to use a different model file, set an environment variable:

```powershell
$env:MODEL_PATH="C:\path\to\your\model2.p"
uvicorn backend.main:app --reload
```

### How it works

- **Frontend (React)**: uses `getUserMedia()` to access the camera, periodically captures frames, and calls `/api/predict` (proxied in dev via Vite).
- **Backend**: runs MediaPipe Hands → extracts 21 landmark coordinates → feeds a 42-feature vector into your trained classifier → returns predicted gesture + confidence.
- **Speech**: done in the browser via the Web Speech API (no server-side TTS files needed).

### Production (single server)

Build the React app:

```powershell
cd frontend
npm run build
cd ..
```

Then run the backend and open `http://127.0.0.1:8000`:

```powershell
uvicorn backend.main:app --reload
```

---

## Existing scripts (original workflow)

These files are still in the repo and can be run directly:
- `collect_imgs.py` / `create_dataset.py` / `train_classifier.py`
- `inference_classifier.py` (desktop OpenCV window + speaking)

`train_classifier.py` currently:
- Reads `data3.pickle`
- Trains a RandomForest classifier
- Saves `model2.p` using key `"model"` (compatible with inference/backend)

Example:

```powershell
python inference_classifier.py
```

---

## API endpoints

- `GET /api/health` – basic status + whether the model file is found
- `POST /api/predict` – send a base64/dataURL image and get a prediction

---

## Project structure

```
backend/
  main.py            # FastAPI app
  asl_inference.py   # MediaPipe + model inference helpers
frontend/            # React (Vite)
  src/
    ui/
      App.tsx
      styles.css
web/                 # older static UI (kept as fallback)
```

---

## Accessibility notes

The UI is designed to be usable with:
- Keyboard controls (Enter = speak, Esc = stop speaking, Ctrl+Backspace = clear)
- Screen reader announcements for key actions
- Reduced motion support and a high-contrast toggle
