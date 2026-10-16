defmodule Timbre.Recordings.Recording do
  @moduledoc "Persistence and file storage for recorded audio."

  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  schema "recordings" do
    field :title, :string
    field :file_path, :string
    field :mime_type, :string
    field :duration_ms, :integer
    field :size_bytes, :integer
    timestamps(type: :utc_datetime_usec, updated_at: false)
  end

  def changeset(recording, attrs) do
    recording
    |> cast(attrs, [:title, :file_path, :mime_type, :duration_ms, :size_bytes])
    |> validate_required([:title, :file_path, :mime_type, :duration_ms, :size_bytes])
    |> validate_length(:title, min: 1, max: 120)
    |> validate_number(:duration_ms, greater_than_or_equal_to: 0)
    |> validate_number(:size_bytes, greater_than: 0)
  end
end

