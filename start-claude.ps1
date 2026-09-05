# Start OpenRouter LiteLLM proxy & Launch Claude Code
$env:OPENROUTER_API_KEY = "YOUR_OPENROUTER_API_KEY_HERE"
$env:ANTHROPIC_BASE_URL = "http://localhost:4000"
$env:ANTHROPIC_API_KEY = "sk-dummy-key"

$litellmPath = "C:\Users\Prince\AppData\Local\Programs\Python\Python311\Scripts\litellm.exe"

Write-Host "Starting LiteLLM Proxy for model: nvidia/nemotron-3.5-lightning:free..." -ForegroundColor Cyan
Start-Process -FilePath $litellmPath -ArgumentList "--model openrouter/nvidia/nemotron-3.5-lightning:free --port 4000" -WindowStyle Hidden

Start-Sleep -Seconds 3
Write-Host "Connecting Claude Code..." -ForegroundColor Green
claude
