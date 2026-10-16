defmodule TimbreWeb.RecordingControllerTest do
  use TimbreWeb.ConnCase, async: false

  setup do
    :ok = Ecto.Adapters.SQL.Sandbox.checkout(Timbre.Repo)
    :ok
  end

  test "lists recordings and returns an empty list initially", %{conn: conn} do
    conn = get(conn, "/api/recordings")
    assert %{"recordings" => []} = json_response(conn, 200)
  end

  test "uploads, lists, streams, and deletes an audio recording", %{conn: conn} do
    path = Path.join(System.tmp_dir!(), "timbre-test-#{System.unique_integer([:positive])}.webm")
    File.write!(path, <<0, 1, 2, 3, 4, 5>>)
    upload = %Plug.Upload{path: path, filename: "voice.webm", content_type: "audio/webm"}

    conn = post(conn, "/api/recordings", %{
      "audio" => upload,
      "title" => "Test voice note",
      "duration_ms" => "1500",
      "mime_type" => "audio/webm"
    })

    assert %{"recording" => %{"id" => id, "title" => "Test voice note", "duration_ms" => 1500}} = json_response(conn, 201)

    list_conn = get(build_conn(), "/api/recordings")
    assert [%{"id" => ^id}] = json_response(list_conn, 200)["recordings"]

    audio_conn = get(build_conn(), "/api/recordings/#{id}/audio")
    assert response(audio_conn, 200) == <<0, 1, 2, 3, 4, 5>>

    delete_conn = delete(build_conn(), "/api/recordings/#{id}")
    assert response(delete_conn, 204) == ""
    assert json_response(get(build_conn(), "/api/recordings"), 200)["recordings"] == []
  end

  test "rejects requests without an audio upload", %{conn: conn} do
    conn = post(conn, "/api/recordings", %{"title" => "Missing audio"})
    assert %{"error" => _} = json_response(conn, 400)
  end
end
