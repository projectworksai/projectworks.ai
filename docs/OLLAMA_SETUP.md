# Using Ollama (local AI) with Plan Forge

The app uses **Ollama** as the default AI backend so you can run models locally—no API keys or cloud costs.

## Prerequisites

1. **Install Ollama**  
   - https://ollama.com

2. **Start Ollama** (usually starts automatically after install)
   ```bash
   ollama serve
   ```

3. **Pull a model** (e.g. phi3:mini)
   ```bash
   ollama pull phi3:mini
   ```

## Optional environment variables

Add to `.env` or `.env.local`:

```env
# Ollama server (default: http://localhost:11434)
OLLAMA_BASE_URL=http://localhost:11434

# Model to use (default: phi3:mini)
OLLAMA_MODEL=phi3:mini

# Max output tokens (default: 4096)
OLLAMA_MAX_TOKENS=4096
```

## Supported models

Works with any Ollama model. Recommended for structured project plans:

- **phi3:mini** – Default; good balance of speed and quality
- **mistral** – Good JSON output, fast
- **llama2** – General purpose
- **qwen2.5** – Strong at structured output
