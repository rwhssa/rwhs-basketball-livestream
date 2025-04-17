use serde::Deserialize;
use dotenv::dotenv;

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    pub livekit_url: String,
    pub livekit_api_key: String,
    pub livekit_api_secret: String,
}

pub fn load_config() -> anyhow::Result<Config> {
    // Load environment variables from .env file if it exists
    dotenv().ok();
    
    let config = Config {
        livekit_url: std::env::var("LIVEKIT_URL")
            .unwrap_or_else(|_| "ws://localhost:7880".to_string()),
        livekit_api_key: std::env::var("LIVEKIT_API_KEY")
            .unwrap_or_else(|_| "devkey".to_string()),
        livekit_api_secret: std::env::var("LIVEKIT_API_SECRET")
            .unwrap_or_else(|_| "secret".to_string()),
    };
    Ok(config)
}