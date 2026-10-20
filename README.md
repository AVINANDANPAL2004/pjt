# Timbre — Voice Recorder

A full-stack voice recorder built on Phoenix + SQLite + React + Rust/WASM.

🌐 **Live Deployment**: [https://timbre-0jrj.onrender.com](https://timbre-0jrj.onrender.com)  
🚀 **Hosting Platform**: [Render](https://render.com) (Docker Web Service)

---

## Live Deployment on Render

The application is deployed live on Render as a unified multi-stage containerized web service:

- **Frontend & WASM**: Compiled with Rust (`wasm-pack`) and Vite into a single-page React app bundled directly into Phoenix's static assets.
- **Backend API**: Phoenix 1.7 / Elixir 1.18 OTP release with SQLite storage and automated Ecto database migrations on startup.
- **Single-Origin Architecture**: Serves both UI and `/api/*` endpoints from the same HTTPS origin, eliminating cross-origin (CORS) complications and enabling secure browser microphone permissions.
- **Health Checks**: Automated liveness (`/healthz`) and readiness (`/readyz`) probes configured on Render.

### Production Environment Variables

| Variable | Description |
| --- | --- |
| `PORT` | Listening port (defaults to `10000` on Render) |
| `SECRET_KEY_BASE` | Cryptographic secret for signing session and tokens |
| `PHX_SERVER` | Set to `true` to enable the Phoenix web server in production releases |
| `PHX_HOST` | Hostname (falls back to `RENDER_EXTERNAL_HOSTNAME`) |
| `DATABASE_PATH` | Path to SQLite database file (`/app/data/timbre.db`) |
| `RECORDINGS_PATH` | Storage directory for uploaded audio files (`/app/data/recordings`) |

---

## Project Progress

### Part 1 — Record and Save (Implemented)

- Record microphone audio in the browser using `getUserMedia` and `MediaRecorder`.
- Preview a clip before saving and give it an optional title.
- Upload audio to Phoenix as multipart form data (25 MB maximum).
- Persist recording metadata in SQLite through Ecto and store audio files.
- List saved recordings, stream/play them back, refresh the list, and delete a recording.
- Show API connection status and user-facing loading/error/success states.

### Next Steps

**Part 2 — Voice processing with Rust/WASM**
- Implement audio-processing effects such as gain/volume, normalization, and silence trimming.
- Connect the Rust/WASM functions to the React interface and test processed audio.

**Part 3 — Multiplayer and audio merging**
- Allow participants to join a recording session through a shared link.
- Capture participant audio and mix it into a single recording.

**AI transcription and summary**
- Add speech-to-text transcription for a saved recording.
- Generate a concise summary of the conversation, key points, decisions, and action items.

---

## API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/healthz` | Liveness health check probe |
| `GET` | `/readyz` | Readiness health check probe (checks SQLite connection) |
| `GET` | `/api/hello` | API health and version status |
| `GET` | `/api/recordings` | List saved recordings |
| `POST` | `/api/recordings` | Upload an audio file (`audio`, optional `title`, `duration_ms`, `mime_type` multipart fields) |
| `GET` | `/api/recordings/:id/audio` | Stream a saved audio file |
| `DELETE` | `/api/recordings/:id` | Delete recording metadata and its audio file |

The API accepts supported browser audio formats (WebM, Ogg, MP4/M4A, MP3, WAV) up to 25 MB. Browser microphone access requires `localhost` or HTTPS.

---

## Run Locally

The recommended path is the repository's pinned Nix toolchain:

```bash
direnv allow       # or: nix develop --impure
just setup
just dev
```

Then open <http://localhost:5173>. The React app uses Vite to proxy `/api/*` to Phoenix on port `4010`.

Without Nix, install Elixir/OTP (see `flake.nix` for pinned versions), Node.js 22+, Rust with the `wasm32-unknown-unknown` target, `wasm-pack`, and `just`, then run the same commands.

### Running via Docker Locally

You can also run the full production container locally:

```bash
docker build -t timbre .
docker run -p 10000:10000 -e SECRET_KEY_BASE="some_secret_key_base_at_least_64_bytes_long" timbre
```

Then visit <http://localhost:10000>.

---

## Useful Commands

```bash
just db-migrate
just test
just check
```
