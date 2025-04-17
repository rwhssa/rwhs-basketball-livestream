use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    extract::State,
    response::Response,
};
use futures::{sink::SinkExt, stream::StreamExt};
use std::sync::Arc;
use tokio::sync::broadcast;
use tracing::{error, info};

use crate::models::scores::AppState;

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> Response {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: Arc<AppState>) {
    let (mut sender, mut receiver) = socket.split();

    // Create a broadcast channel for score updates
    let (tx, _rx) = broadcast::channel(100);
    let mut rx = tx.subscribe();

    // Clone state for the sender task
    let state_clone = state.clone();

    // Spawn task to forward messages from broadcast to websocket
    let mut send_task = tokio::spawn(async move {
        loop {
            match rx.recv().await {
                Ok(msg) => {
                    if let Err(e) = sender.send(msg).await {
                        error!("Error sending websocket message: {}", e);
                        break;
                    }
                },
                Err(e) => {
                    error!("Error receiving from broadcast: {}", e);
                    break;
                }
            }
        }
    });

    // Handle incoming messages
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            match msg {
                Message::Text(_) => {
                    // Send current scores if available
                    if let Ok(scores) = state_clone.scores.lock() {
                        if let Some(score_data) = scores.as_ref() {
                            if let Ok(json) = serde_json::to_string(score_data) {
                                tx.send(Message::Text(json)).ok();
                            }
                        }
                    }
                }
                Message::Close(_) => break,
                _ => continue,
            }
        }
    });

    // Wait for either task to finish
    tokio::select! {
        _ = (&mut send_task) => recv_task.abort(),
        _ = (&mut recv_task) => send_task.abort(),
    }

    info!("WebSocket connection closed");
}