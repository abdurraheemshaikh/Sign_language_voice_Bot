import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from backend.asl_inference import ASLInferencer, decode_image_b64


ROOT = Path(__file__).resolve().parents[1]
WEB_DIR = ROOT / "web"
FRONTEND_DIST_DIR = ROOT / "frontend" / "dist"
MODEL_PATH = os.environ.get("MODEL_PATH") or str(ROOT / "model2.p")


app = FastAPI(title="Whispering Hands", version="1.0.0")


class PredictRequest(BaseModel):
    image: str  # dataURL or base64


class PredictResponse(BaseModel):
    gesture: str | None
    confidence: float | None


_inferencer: ASLInferencer | None = None


def get_inferencer() -> ASLInferencer:
    global _inferencer
    if _inferencer is None:
        _inferencer = ASLInferencer(MODEL_PATH)
    return _inferencer


@app.get("/api/health")
def health():
    model_present = Path(MODEL_PATH).exists()
    return {"ok": True, "model_path": MODEL_PATH, "model_present": model_present}


@app.post("/api/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    try:
        frame_bgr = decode_image_b64(req.image)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {e}")

    try:
        inferencer = get_inferencer()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    pred = inferencer.predict_from_bgr(frame_bgr)
    return PredictResponse(gesture=pred.gesture, confidence=pred.confidence)


assets_dir = WEB_DIR / "assets"
if assets_dir.exists():
    app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

if FRONTEND_DIST_DIR.exists():
    app.mount(
        "/",
        StaticFiles(directory=str(FRONTEND_DIST_DIR), html=True),
        name="frontend",
    )


@app.get("/")
def index():
    if FRONTEND_DIST_DIR.exists():
        return HTMLResponse((FRONTEND_DIST_DIR / "index.html").read_text(encoding="utf-8"))
    index_path = WEB_DIR / "index.html"
    if not index_path.exists():
        raise HTTPException(status_code=500, detail="Missing web/index.html")
    return FileResponse(str(index_path))

