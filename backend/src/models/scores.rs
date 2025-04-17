use std::sync::{Arc, Mutex};
use crate::config::Config;
use crate::handlers::scores::ScoreData;

pub struct AppState {
    pub scores: Mutex<Option<ScoreData>>,
    pub config: Arc<Config>,
}