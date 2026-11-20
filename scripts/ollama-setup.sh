#!/usr/bin/env bash
set -euo pipefail

MODEL="${1:-llama3.2}"

if ! command -v ollama >/dev/null 2>&1; then
  echo "No se encontró Ollama. Instálalo desde https://ollama.com/download" >&2
  exit 1
fi

if curl -fsS --max-time 2 http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  echo "Ollama ya está en marcha."
else
  echo "Arrancando Ollama con CORS habilitado para el estudio web…"
  OLLAMA_ORIGINS="*" nohup ollama serve >/tmp/vidora-ollama.log 2>&1 &
  sleep 3
fi

echo "Descargando el modelo ${MODEL} (si ya existe, se reutiliza)…"
ollama pull "$MODEL"

echo
echo "Listo. Endpoint: http://localhost:11434"
echo "En Vidora: Ajustes → IA local → modelo ${MODEL}"
