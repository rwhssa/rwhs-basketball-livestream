use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct TokenResponse {
    pub token: String,
    pub room: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveKitMetadata {
    pub phase: String,  // "semi" or "final"
    pub game: Option<String>,  // "game1", "game2", "final"
    pub angle: Option<String>,  // "main", "angle1", "angle2"
}