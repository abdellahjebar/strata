Set-Location "C:\perso\Projects\Strata"
& "C:\Users\Abdellah\AppData\Local\Programs\Python\Python312\python.exe" -m uvicorn backend.main:app --reload --port 8000 --host 0.0.0.0
