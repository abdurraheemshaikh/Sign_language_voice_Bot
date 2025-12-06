import pickle
import cv2
import mediapipe as mp
import numpy as np
import pyttsx3
from speaking import speak_word

# ---------------------- TTS SETUP ----------------------
tts = pyttsx3.init()
tts.setProperty('rate', 160)
tts.setProperty('volume', 1.0)

# ---------------------- LOAD MODEL ----------------------
model_dict = pickle.load(open('./model2.p', 'rb'))
model = model_dict['model']

cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)

mp_hands = mp.solutions.hands
mp_drawing = mp.solutions.drawing_utils
mp_drawing_styles = mp.solutions.drawing_styles

hands = mp_hands.Hands(static_image_mode=True, min_detection_confidence=0.3)

last_predicted = None
predicted_sequence = []

labels_dict = {
    0: 'A', 1: 'B', 2: 'C',3: 'D',4: 'E',5: 'F',6: 'G',7: 'H',
    8: 'K',9: 'L',10: 'M',11: 'N',12: 'O',13: 'P',14: 'Q',15: 'R',
    16: 'S',17: 'T',18: 'U',19: 'V',20: 'W',21: 'X',22: 'Y',23: 'Z',
    24: '1',25: '2',26: '3',27: '4',28: '5',29: '6',30: '7',31: '8',32: '9',
    33: ' ',     # SPACE
    34: 'DELETE'
}

DEBOUNCE_FRAMES = 7
THRESHOLD = 0

debounce_letter = None
debounce_count = 0
word=[]
while True:

    ret, frame = cap.read()
    if not ret:
        break

    H, W, _ = frame.shape
    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

    results = hands.process(frame_rgb)
    
    if results.multi_hand_landmarks:

        # ---------------------- USE ONLY FIRST HAND ----------------------
        hand_landmarks = results.multi_hand_landmarks[0]

        mp_drawing.draw_landmarks(
            frame,
            hand_landmarks,
            mp_hands.HAND_CONNECTIONS,
            mp_drawing_styles.get_default_hand_landmarks_style(),
            mp_drawing_styles.get_default_hand_connections_style())

        data_aux = []
        x_ = []
        y_ = []

        # Extract the single hand
        for lm in hand_landmarks.landmark:
            x_.append(lm.x)
            y_.append(lm.y)

        for lm in hand_landmarks.landmark:
            data_aux.append(lm.x - min(x_))
            data_aux.append(lm.y - min(y_))

        # ---- Bounding box coordinates ----
        x1 = int(min(x_) * W) - 10
        y1 = int(min(y_) * H) - 10
        x2 = int(max(x_) * W) + 10
        y2 = int(max(y_) * H) + 10

        # ---- Predict ----
        prediction = model.predict([np.asarray(data_aux)])
        probs = model.predict_proba([np.asarray(data_aux)])[0] 
        
        predicted_character = labels_dict[int(prediction[0])]
        gesture = predicted_character
        

        # ---------------------- DEBOUNCE ----------------------
        if gesture == debounce_letter:
            debounce_count += 1
        else:
            debounce_letter = gesture
            debounce_count = 1

        if debounce_count == DEBOUNCE_FRAMES:

            # -------- DELETE FUNCTION --------
            if gesture == "DELETE":
                if predicted_sequence:
                    predicted_sequence.pop()
                last_predicted = None

            # -------- IGNORE UNKNOWN --------
            elif gesture == "UNKNOWN":
                pass

            # -------- SPACE: Speak the word --------
            elif gesture == " ":
                speak_word("".join(predicted_sequence))
                predicted_sequence.append(" ")

            # -------- ADD NORMAL LETTER --------
            else:
                if gesture != last_predicted:
                    predicted_sequence.append(gesture)
                    
                    last_predicted = gesture


        # Display output text
        predicted_word = "".join(predicted_sequence)
        cv2.putText(frame, predicted_word, (50, 50),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.5, (255, 0, 0), 3)

        # Show bounding box + gesture
        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 0), 4)
        cv2.putText(frame, gesture, (x1, y1 - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.3, (0, 0, 0), 3)

    cv2.imshow('frame', frame)
    cv2.waitKey(1)

cap.release()
cv2.destroyAllWindows()
