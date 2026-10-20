defmodule TimbreWeb.PageController do
  use TimbreWeb, :controller

  def index(conn, _params) do
    index_file = Path.join(:code.priv_dir(:timbre), "static/index.html")

    if File.exists?(index_file) do
      conn
      |> put_resp_content_type("text/html")
      |> send_file(200, index_file)
    else
      json(conn, %{message: "Timbre Phoenix API is running."})
    end
  end
end
