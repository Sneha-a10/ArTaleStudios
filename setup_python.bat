@echo off
echo Installing Python dependencies for ArTales...
pip install -r requirements.txt
echo.
echo Setup complete! Make sure you have:
echo 1. Python 3.8+ installed
echo 2. Valid API keys in .env file:
echo    - GEMINI_API_KEY (Google AI) - Already configured
echo    - ELEVENLABS_API_KEY (ElevenLabs) - Already configured
echo.
echo API keys are loaded from .env file using python-dotenv
echo.
echo You can now run the server with: npm start
pause
