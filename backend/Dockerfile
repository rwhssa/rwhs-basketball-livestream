FROM rust:1.83 as builder

WORKDIR /usr/src/app
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /usr/src/app/target/release/basketball-livestream-backend .

# Environment variables will be provided at runtime
ENV LIVEKIT_API_KEY=""
ENV LIVEKIT_API_SECRET=""
ENV LIVEKIT_URL=""

EXPOSE 8080

CMD ["./basketball-livestream-backend"]
