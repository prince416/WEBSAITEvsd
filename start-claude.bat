@echo off
set OPENROUTER_API_KEY=YOUR_OPENROUTER_API_KEY_HERE
set ANTHROPIC_BASE_URL=http://localhost:4000
set ANTHROPIC_API_KEY=sk-dummy-key
start /B "" "C:\Users\Prince\AppData\Local\Programs\Python\Python311\Scripts\litellm.exe" --model openrouter/nvidia/nemotron-3.5-lightning:free --port 4000
echo [SUCCESS] LiteLLM Proxy Started! Launching Claude Code with model: nvidia/nemotron-3.5-lightning:free
timeout /t 3 /nobreak >nul
claude
