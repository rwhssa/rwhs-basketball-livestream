use axum::{extract::Query, Json};
use livekit_api::access_token::{AccessToken, VideoGrants};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;

#[derive(Debug, Deserialize)]
pub struct TokenQuery {
    pub r#type: String,
    pub phase: String,
}

#[derive(Debug, Serialize)]
pub struct TokenResponse {
    pub token: String,
    pub room: String,
}

pub async fn create_token_handler(
    Query(query): Query<TokenQuery>,
    state: axum::extract::State<Arc<crate::models::scores::AppState>>,
) -> Json<TokenResponse> {
    let room_name = match query.phase.as_str() {
        "semi" => "basketball-semi",
        "final" => "basketball-final",
        _ => "basketball-default",
    };

    let mut grant = VideoGrants::default();
    grant.room = room_name.to_string();

    // Set different permissions based on type
    match query.r#type.as_str() {
        "camera" => {
            grant.can_publish = true;
            grant.can_subscribe = true; // Allow camera to see other participants
            grant.can_publish_data = true; // Allow data publishing
            grant.room_join = true; // Explicitly allow room joining
            grant.can_update_own_metadata = true; // Allow updating own metadata
        }
        "admin" => {
            grant.can_publish = false;
            grant.can_subscribe = true;
            grant.room_admin = true;
            grant.can_publish_data = true; // Allow data publishing
            grant.room_join = true; // Explicitly allow room joining
        }
        "output" => {
            grant.can_publish = false;
            grant.can_subscribe = true;
            grant.can_publish_data = true; // Allow data publishing
            grant.room_join = true; // Explicitly allow room joining
        }
        _ => {
            grant.can_publish = false;
            grant.can_subscribe = false;
        }
    }

    let api_key = state.config.livekit_api_key.clone();
    let api_secret = state.config.livekit_api_secret.clone();

    // Generate a random identifier without uuid or rand
    let random_id = format!(
        "{}-{}-{}",
        query.r#type,
        query.phase,
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or(Duration::from_secs(0))
            .as_millis()
    );

    // Create the access token
    let token = AccessToken::with_api_key(&api_key, &api_secret)
        .with_identity(&random_id)
        .with_name(&format!("{}-{}", query.r#type, query.phase))
        .with_grants(grant);

    let token_str = token.to_jwt().unwrap_or_default();

    Json(TokenResponse {
        token: token_str,
        room: room_name.to_string(),
    })
}
