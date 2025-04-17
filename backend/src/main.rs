use std::net::SocketAddr;
use std::sync::{Arc, Mutex};

use axum::{
    routing::{get, post},
    Router,
};
use tower_http::cors::{Any, CorsLayer};
use tracing::{info, Level};
use tracing_subscriber::FmtSubscriber;

mod config;
mod handlers;
mod models;
mod routes;
mod websocket;

use crate::handlers::token::create_token_handler;
use crate::handlers::scores::receive_scores_handler;
use crate::models::scores::AppState;
use crate::websocket::ws_handler;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize logging
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .finish();
    tracing::subscriber::set_global_default(subscriber)?;
    info!("Starting Basketball Livestream Backend");

    // Load configuration
    let config = config::load_config()?;
    info!("Configuration loaded");

    // Create shared application state
    let state = Arc::new(AppState {
        scores: Mutex::new(None),
        config: Arc::new(config),
    });

    // Set up CORS
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Build our application with routes
    let app = Router::new()
        .route("/api/token", get(create_token_handler))
        .route("/api/scores", post(receive_scores_handler))
        .route("/ws", get(ws_handler))
        .with_state(state)
        .layer(cors);

    // Run the server
    let addr = SocketAddr::from(([0, 0, 0, 0], 8080));
    info!("Listening on {}", addr);
    
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}