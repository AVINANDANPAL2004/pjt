# ==============================================================================
# Stage 1: Build the Rust WASM crate and React frontend
# ==============================================================================
FROM rust:1.85-slim-bookworm AS frontend-builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    build-essential \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

RUN rustup target add wasm32-unknown-unknown

RUN curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY web ./web

WORKDIR /app/web

# Build Rust WASM first so npm install finds local crate dependency
RUN wasm-pack build crates/timbre_kit --target web --out-dir pkg

RUN npm install

RUN npx tsc -b && npx vite build

# ==============================================================================
# Stage 2: Build the Elixir/Phoenix release
# ==============================================================================
FROM elixir:1.18-slim AS backend-builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/api

RUN mix local.hex --force && mix local.rebar --force

ENV MIX_ENV=prod

COPY api/mix.exs api/mix.lock ./
RUN mix deps.get --only prod
RUN mix deps.compile

COPY api/config ./config
COPY api/lib ./lib
COPY api/priv ./priv

# Copy compiled frontend from Stage 1 into Phoenix static directory
COPY --from=frontend-builder /app/web/dist ./priv/static

RUN mix phx.digest
RUN mix compile
RUN mix release

# ==============================================================================
# Stage 3: Minimal production runtime
# ==============================================================================
FROM debian:bookworm-slim AS runner

RUN apt-get update && apt-get install -y --no-install-recommends \
    libsqlite3-0 \
    libssl3 \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN mkdir -p /app/data /app/data/recordings

ENV MIX_ENV=prod
ENV PHX_SERVER=true
ENV PORT=10000
ENV DATABASE_PATH=/app/data/timbre.db
ENV RECORDINGS_PATH=/app/data/recordings

COPY --from=backend-builder /app/api/_build/prod/rel/timbre ./
COPY entrypoint.sh ./
RUN chmod +x ./entrypoint.sh

EXPOSE 10000

CMD ["./entrypoint.sh"]
