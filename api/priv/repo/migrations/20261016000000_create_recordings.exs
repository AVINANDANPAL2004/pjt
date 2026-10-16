defmodule Timbre.Repo.Migrations.CreateRecordings do
  use Ecto.Migration

  def change do
    create table(:recordings, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :title, :string, null: false
      add :file_path, :string, null: false
      add :mime_type, :string, null: false
      add :duration_ms, :integer, null: false, default: 0
      add :size_bytes, :integer, null: false
      add :inserted_at, :utc_datetime_usec, null: false
    end
  end
end
