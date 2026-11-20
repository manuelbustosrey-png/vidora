param(
  [string]$Model = "llama3.2"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) {
  Write-Host "No se encontró Ollama." -ForegroundColor Red
  Write-Host "Instálalo desde https://ollama.com/download y vuelve a ejecutar este script."
  exit 1
}

$running = $false
try {
  Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/tags" -TimeoutSec 2 | Out-Null
  $running = $true
} catch {
  $running = $false
}

if ($running) {
  Write-Host "Ollama ya está en marcha." -ForegroundColor Green
} else {
  Write-Host "Arrancando Ollama con CORS habilitado para el estudio web…"
  $env:OLLAMA_ORIGINS = "*"
  Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden
  Start-Sleep -Seconds 3
}

Write-Host "Descargando el modelo $Model (si ya existe, se reutiliza)…"
ollama pull $Model

Write-Host ""
Write-Host "Listo. Endpoint: http://localhost:11434" -ForegroundColor Green
Write-Host "En Vidora: Ajustes → IA local → modelo $Model"
