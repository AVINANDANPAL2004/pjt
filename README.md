# Timbre — Voice Recorder

A full-stack voice recorder built on the provided Phoenix + SQLite + React + Rust/WASM scaffold.

## Project Progress

### Part 1 — Record and Save (implemented)

- Record microphone audio in the browser using `getUserMedia` and `MediaRecorder`.
- Preview a clip before saving and give it an optional title.
- Upload audio to Phoenix as multipart form data (25 MB maximum).
- Persist recording metadata in SQLite through Ecto and store audio files under `api/.tmp/recordings/`.
- List saved recordings, stream/play them back, refresh the list, and delete a recording.
- Show API connection status and user-facing loading/error/success states.

The record, save, list, playback, and deletion workflow has been implemented. Audio files and the SQLite database are stored locally for development. `api/.tmp/` is ignored by Git; do not rely on this local file storage for a deployed instance without attaching persistent storage.

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

These items are planned work and are not yet implemented in this milestone.

## Development Notes

Setting up the toolchain—including Rust, WebAssembly tooling, and Erlang/OTP—took additional time, and my personal computer has limitations running the development workflow. I plan to continue development on a laboratory computer with the required tools installed so I can implement and test the remaining features.

This is a progress note, not a formal extension request. Any revised submission timeline is subject to the assignment coordinator's approval.

## Run Locally

The recommended path is the repository's pinned Nix toolchain:

```bash
direnv allow       # or: nix develop --impure
just setup
just dev
```

Then open <http://localhost:5173>. The React app uses Vite to proxy `/api/*` to Phoenix on port `4010`.

Without Nix, install Elixir/OTP (see `flake.nix` for pinned versions), Node.js 22+, Rust with the `wasm32-unknown-unknown` target, `wasm-pack`, and `just`, then run the same commands.

## API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/recordings` | List saved recordings |
| `POST` | `/api/recordings` | Upload an audio file (`audio`, optional `title`, `duration_ms`, `mime_type` multipart fields) |
| `GET` | `/api/recordings/:id/audio` | Stream a saved audio file |
| `DELETE` | `/api/recordings/:id` | Delete recording metadata and its audio file |

The API accepts supported browser audio formats (WebM, Ogg, MP4/M4A, MP3, WAV) up to 25 MB. Browser microphone access generally requires `localhost` or HTTPS.

## Useful Commands

```bash
just db-migrate
just test
just check
```
