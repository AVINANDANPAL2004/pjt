# Timbre — Voice Recorder

A small full-stack voice recorder built on the provided Phoenix + SQLite + React + Rust/WASM scaffold.

## Part 1 implemented

- Record microphone audio in the browser using `getUserMedia` and `MediaRecorder`.
- Preview a clip before saving and give it an optional title.
- Upload audio to Phoenix as multipart form data (25 MB maximum).
- Persist recording metadata in SQLite through Ecto and store audio files under `api/.tmp/recordings/`.
- List saved recordings, stream/play them back, refresh the list, and delete a recording.
- Show API connection status and user-facing loading/error/success states.

Audio files and the SQLite database are stored locally for development. `api/.tmp/` is ignored by Git; do not rely on this local file storage for a deployed instance without attaching persistent storage.

## Run locally

The recommended path is the repository's pinned Nix toolchain:

```bash
direnv allow       # or: nix develop --impure
just setup
just dev
```

Then open <http://localhost:5173>. The React app uses Vite to proxy `/api/*` to Phoenix on port `4010`.

Without Nix, install Elixir/OTP (see `flake.nix` for pinned versions), Node.js 22+, Rust with the `wasm32-unknown-unknown` target, `wasm-pack`, and `just`, then run the same commands.

## API endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/recordings` | List saved recordings |
| `POST` | `/api/recordings` | Upload an audio file (`audio`, optional `title`, `duration_ms`, `mime_type` multipart fields) |
| `GET` | `/api/recordings/:id/audio` | Stream a saved audio file |
| `DELETE` | `/api/recordings/:id` | Delete recording metadata and its audio file |

The API accepts supported browser audio formats (WebM, Ogg, MP4/M4A, MP3, WAV) up to 25 MB. Browser microphone access generally requires `localhost` or HTTPS.

## Useful commands

```bash
just db-migrate
just test
just check
```

Part 2 (Rust/WASM effects), multiplayer merging, and transcription are not included in this first milestone.
