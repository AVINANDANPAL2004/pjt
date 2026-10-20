defmodule TimbreWeb.RecordingController do
  use TimbreWeb, :controller

  alias Timbre.Recordings
  alias Timbre.Recordings.Recording

  @max_bytes 25 * 1024 * 1024
  @allowed_types %{
    "audio/webm" => ".webm",
    "audio/webm;codecs=opus" => ".webm",
    "audio/ogg" => ".ogg",
    "audio/mp4" => ".m4a",
    "audio/mpeg" => ".mp3",
    "audio/wav" => ".wav",
    "audio/x-wav" => ".wav"
  }

  def index(conn, _params) do
    json(conn, %{recordings: Enum.map(Recordings.list_recordings(), &serialize/1)})
  end

  def create(conn, %{"audio" => %Plug.Upload{} = upload} = params) do
    mime_type = Map.get(params, "mime_type", upload.content_type || "audio/webm")
    extension = Map.get(@allowed_types, mime_type) || Map.get(@allowed_types, upload.content_type)

    with {:ok, size} <- File.stat(upload.path) |> file_size(),
         true <- size > 0,
         true <- size <= @max_bytes,
         true <- is_binary(extension) do
      id = Ecto.UUID.generate()
      storage_dir = System.get_env("RECORDINGS_PATH") || Path.expand("../../../.tmp/recordings", __DIR__)
      File.mkdir_p!(storage_dir)
      destination = Path.join(storage_dir, id <> extension)

      case File.cp(upload.path, destination) do
        :ok ->
          attrs = %{
            title: params |> Map.get("title", "Untitled recording") |> String.trim() |> fallback_title(),
            file_path: destination,
            mime_type: mime_type,
            duration_ms: parse_duration(params["duration_ms"]),
            size_bytes: size
          }

          case Recordings.create_recording(attrs) do
            {:ok, recording} ->
              conn |> put_status(:created) |> json(%{recording: serialize(recording)})
            {:error, changeset} ->
              File.rm(destination)
              conn |> put_status(:unprocessable_entity) |> json(%{errors: format_errors(changeset)})
          end
        {:error, _reason} ->
          conn |> put_status(:internal_server_error) |> json(%{error: "Could not store audio file"})
      end
    else
      false -> conn |> put_status(:unprocessable_entity) |> json(%{error: "Audio must be non-empty, no larger than 25 MB, and use a supported audio format"})
      {:error, _} -> conn |> put_status(:unprocessable_entity) |> json(%{error: "Could not read uploaded audio"})
    end
  end

  def create(conn, _params) do
    conn |> put_status(:bad_request) |> json(%{error: "Upload an audio file using the 'audio' field"})
  end

  def audio(conn, %{"id" => id}) do
    case Recordings.get_recording(id) do
      %Recording{} = recording ->
        if File.regular?(recording.file_path) do
          conn
          |> put_resp_content_type(recording.mime_type)
          |> put_resp_header("accept-ranges", "bytes")
          |> send_file(200, recording.file_path)
        else
          conn |> put_status(:not_found) |> json(%{error: "Audio file not found"})
        end
      nil -> conn |> put_status(:not_found) |> json(%{error: "Recording not found"})
    end
  end

  def delete(conn, %{"id" => id}) do
    case Recordings.get_recording(id) do
      %Recording{} = recording ->
        case Recordings.delete_recording(recording) do
          {:ok, _} -> send_resp(conn, :no_content, "")
          {:error, _} -> conn |> put_status(:internal_server_error) |> json(%{error: "Could not delete recording"})
        end
      nil -> conn |> put_status(:not_found) |> json(%{error: "Recording not found"})
    end
  end

  defp serialize(recording) do
    %{
      id: recording.id,
      title: recording.title,
      mime_type: recording.mime_type,
      duration_ms: recording.duration_ms,
      size_bytes: recording.size_bytes,
      inserted_at: recording.inserted_at,
      audio_url: "/api/recordings/#{recording.id}/audio"
    }
  end

  defp file_size({:ok, stat}), do: {:ok, stat.size}
  defp file_size(error), do: error
  defp parse_duration(value) when is_integer(value), do: max(value, 0)
  defp parse_duration(value) when is_binary(value) do
    case Integer.parse(value) do
      {number, _} -> min(max(number, 0), 86_400_000)
      :error -> 0
    end
  end
  defp parse_duration(_), do: 0
  defp fallback_title(""), do: "Untitled recording"
  defp fallback_title(title), do: title
  defp format_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {message, opts} ->
      Enum.reduce(opts, message, fn {key, value}, acc -> String.replace(acc, "%{#{key}}", to_string(value)) end)
    end)
  end
end
