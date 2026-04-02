# Whispering Hands 🤟🗣️

Whispering Hands is an AI-powered real-time sign language translation system that converts hand gestures into spoken words. Using a live camera feed, the system recognizes sign language letters, forms words, and generates speech output—helping bridge communication gaps between Deaf and hearing individuals in everyday interactions.

---

## 🚀 Features

- 📷 Real-time hand gesture recognition using webcam  
- 🔤 Sign-to-text conversion (alphabet-based)  
- 🔊 Text-to-speech output for natural communication  
- ⚡ Low-latency processing for near real-time interaction  
- 🌐 Simple web interface for easy use  

---

## 🧠 How It Works

1. The user signs letters using hand gestures in front of the camera  
2. The model detects and classifies each gesture  
3. Recognized letters are combined into words  
4. The system converts text into speech output  

---

## 🛠️ Tech Stack

- **Frontend:** React (Vite)  
- **Backend:** FastAPI (Python)  
- **AI/ML:** Computer Vision model for gesture recognition  
- **Other:** Text-to-Speech (TTS), OpenCV / MediaPipe  

---

## ⚙️ Setup & Run (Windows PowerShell)

### 1. Install Dependencies

Make sure you have **Python** and **Node.js** installed.

### 2. Backend Setup

python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

### 3. Start Backend Server

python -m uvicorn backend.main:app --reload

### 4. Frontend Setup

Open a new terminal:

cd frontend
npm install
npm run dev

### 5. Open Application

Open in browser:

http://localhost:5173

### 🎯 Use Case

Whispering Hands is designed for basic, everyday communication, such as:

Greetings
Simple conversations
Asking for help or directions

It focuses on improving accessibility in informal interactions where interpreters may not be available.
