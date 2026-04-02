# Whispering Hands

## Run Steps (Windows PowerShell)

1. Install Python and Node.js.
2. In project root:
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   ```
3. Start backend:
   ```powershell
   python -m uvicorn backend.main:app --reload
   ```
4. Start frontend in a new terminal:
   ```powershell
   cd frontend
   npm install
   npm run dev
   ```
5. Open:
   - `http://localhost:5173`

## UI Changes Applied

- Removed `API health` button.
- Removed detected confidence display.
- Removed debounce display.
- Removed confidence threshold control.
- Removed both checkboxes.
- Updated color scheme to a cleaner, calmer look.
- Fixed the stretched `Stopped` pill/oval in camera preview.
