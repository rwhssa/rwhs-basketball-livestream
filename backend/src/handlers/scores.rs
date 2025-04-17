use axum::{
    extract::State,
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

    Json(score_data)
}