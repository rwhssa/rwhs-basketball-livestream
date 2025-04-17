use axum::{
    extract::{State, ws::Message},
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use crate::models::scores::AppState;

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ScoreData {
    pub phase: String,
    pub scores: Scores,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Scores {
    pub game1: Option<std::collections::HashMap<String, u32>>,
    pub game2: Option<std::collections::HashMap<String, u32>>,
    pub final_game: Option<std::collections::HashMap<String, u32>>,
}

pub async fn receive_scores_handler(
    State(state): State<Arc<AppState>>,
    Json(score_data): Json<ScoreData>,
) -> Json<ScoreData> {
    // Update scores in shared state
    let mut scores = state.scores.lock().unwrap();
    *scores = Some(score_data.clone());

    // Broadcast the score update to all connected WebSocket clients
    if let Ok(json) = serde_json::to_string(&score_data) {
        state.score_tx.send(Message::Text(json)).ok();
    }

    Json(score_data)
}