import base64
import os
import pickle
from dataclasses import dataclass
from typing import Any, Optional

import cv2
import mediapipe as mp
import numpy as np


@dataclass(frozen=True)
class Prediction:
    gesture: Optional[str]
    confidence: Optional[float]


LABELS_DICT = {
    0: "A",
    1: "B",
    2: "C",
    3: "D",
    4: "E",
    5: "F",
    6: "G",
    7: "H",
    8: "K",
    9: "L",
    10: "M",
    11: "N",
    12: "O",
    13: "P",
    14: "Q",
    15: "R",
    16: "S",
    17: "T",
    18: "U",
    19: "V",
    20: "W",
    21: "X",
    22: "Y",
    23: "Z",
    24: "1",
    25: "2",
    26: "3",
    27: "4",
    28: "5",
    29: "6",
    30: "7",
    31: "8",
    32: "9",
    33: " ",  # SPACE
    34: "DELETE",
}


def _strip_data_url_prefix(data_url_or_b64: str) -> str:
    if "," in data_url_or_b64 and data_url_or_b64.strip().lower().startswith("data:"):
        return data_url_or_b64.split(",", 1)[1]
    return data_url_or_b64


def decode_image_b64(data_url_or_b64: str) -> np.ndarray:
    b64 = _strip_data_url_prefix(data_url_or_b64)
    img_bytes = base64.b64decode(b64, validate=False)
    arr = np.frombuffer(img_bytes, dtype=np.uint8)
    img_bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img_bgr is None:
        raise ValueError("Could not decode image")
    return img_bgr


def load_model(model_path: str) -> Any:
    if not os.path.exists(model_path):
        raise FileNotFoundError(
            f"Model file not found at '{model_path}'. Put your trained model pickle here or set MODEL_PATH."
        )
    model_dict = pickle.load(open(model_path, "rb"))
    if isinstance(model_dict, dict):
        for key in ("model", "model2", "model4"):
            if key in model_dict:
                return model_dict[key]
    return model_dict


class ASLInferencer:
    def __init__(self, model_path: str):
        self.model_path = model_path
        self.model = load_model(model_path)
        self._mp_hands = mp.solutions.hands
        self._hands = self._mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=1,
            min_detection_confidence=0.3,
            min_tracking_confidence=0.3,
        )

    def predict_from_bgr(self, frame_bgr: np.ndarray) -> Prediction:
        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        results = self._hands.process(frame_rgb)
        if not results.multi_hand_landmarks:
            return Prediction(gesture=None, confidence=None)

        hand_landmarks = results.multi_hand_landmarks[0]
        x_: list[float] = []
        y_: list[float] = []

        for lm in hand_landmarks.landmark:
            x_.append(lm.x)
            y_.append(lm.y)

        data_aux: list[float] = []
        min_x = min(x_)
        min_y = min(y_)
        for lm in hand_landmarks.landmark:
            data_aux.append(lm.x - min_x)
            data_aux.append(lm.y - min_y)

        features = np.asarray(data_aux, dtype=np.float32).reshape(1, -1)
        pred = self.model.predict(features)[0]

        gesture = LABELS_DICT.get(int(pred), str(pred))
        confidence: Optional[float] = None
        if hasattr(self.model, "predict_proba"):
            probs = self.model.predict_proba(features)[0]
            confidence = float(np.max(probs))

        return Prediction(gesture=gesture, confidence=confidence)

