use std::sync::{Arc, Mutex};
use tokio::sync::broadcast;
use axum::extract::ws::Message;
use crate::config::Config;
use crate::handlers::scores::ScoreData;

pub struct AppState {
    pub scores: Mutex<Option<ScoreData>>,
    pub config: Arc<Config>,
    pub score_tx: broadcast::Sender<Message>,
}