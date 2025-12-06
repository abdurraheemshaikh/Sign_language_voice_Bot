from gtts import gTTS
import playsound
import os
import time
import uuid

def speak_word(word):
    if not word.strip():
        return
    
    filename = f"tts_{uuid.uuid4().hex}.mp3"

    # Generate speech
    tts = gTTS(text=word, lang="en")
    tts.save(filename)

    # Play sound
    playsound.playsound(filename)

    # Remove file after speaking
    time.sleep(0.5)
    os.remove(filename)