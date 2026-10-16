# Timbre API

Phoenix JSON API backed by SQLite and Ecto. Run `mix setup` and then `mix phx.server` (or use `just setup` and `just dev` from the repository root).

## Recording endpoints

- `GET /api/recordings` — list recording metadata.
- `POST /api/recordings` — multipart upload with `audio` file and optional `title`, `duration_ms`, `mime_type` fields.
- `GET /api/recordings/:id/audio` — stream the stored audio file.
- `DELETE /api/recordings/:id` — remove metadata and the associated audio file.

Audio files are stored in `.tmp/recordings` under the API directory and metadata is stored in the SQLite `recordings` table. Upload limit: 25 MB.
