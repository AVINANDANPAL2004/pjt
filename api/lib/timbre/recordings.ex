defmodule Timbre.Recordings do
  @moduledoc "Persistence and file storage for recorded audio."
  import Ecto.Query, only: [from: 2]
  alias Timbre.Repo
  alias Timbre.Recordings.Recording

  def list_recordings do
    Repo.all(from r in Recording, order_by: [desc: r.inserted_at])
  end

  def get_recording(id), do: Repo.get(Recording, id)

  def create_recording(attrs), do: %Recording{} |> Recording.changeset(attrs) |> Repo.insert()

  def delete_recording(%Recording{} = recording) do
    result = Repo.delete(recording)
    case result do
      {:ok, _} -> File.rm(recording.file_path)
      _ -> :ok
    end
    result
  end
end

