use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use base64::Engine as _;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use hmac::{Hmac, Mac};
use secrecy::{ExposeSecret, SecretString};
use serde::{Deserialize, Serialize};
use sha2::Sha256;

const TOKEN_SCOPE_WS: &str = "ws";
const TOKEN_VERSION: u32 = 1;
const DEFAULT_ATTACH_TTL_SECS: u64 = 300;

type HmacSha256 = Hmac<Sha256>;

#[derive(Debug, Clone)]
pub enum WebAuthMode {
    EphemeralBearer { token: Arc<String> },
    SignedAttach { root: Arc<SecretString> },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum WebAuthSource {
    Generated,
    Env,
    Keyring,
    SecretStore,
    Vault,
}

#[derive(Debug, Clone)]
pub struct WebAuthState {
    mode: WebAuthMode,
    source: WebAuthSource,
}

impl WebAuthState {
    pub fn ephemeral_generated(token: String) -> Self {
        Self {
            mode: WebAuthMode::EphemeralBearer {
                token: Arc::new(token),
            },
            source: WebAuthSource::Generated,
        }
    }

    pub fn signed_attach(root: SecretString, source: WebAuthSource) -> Self {
        Self {
            mode: WebAuthMode::SignedAttach {
                root: Arc::new(root),
            },
            source,
        }
    }

    pub fn source(&self) -> WebAuthSource {
        self.source
    }

    pub fn mode_name(&self) -> &'static str {
        match self.mode {
            WebAuthMode::EphemeralBearer { .. } => "ephemeral-bearer",
            WebAuthMode::SignedAttach { .. } => "signed-attach",
        }
    }

    pub fn issue_query_token(&self) -> String {
        match &self.mode {
            WebAuthMode::EphemeralBearer { token } => token.as_ref().clone(),
            WebAuthMode::SignedAttach { root } => mint_signed_attach_token(root),
        }
    }

    pub fn verify_query_token(&self, candidate: Option<&str>) -> bool {
        match (&self.mode, candidate) {
            (WebAuthMode::EphemeralBearer { token }, Some(candidate)) => {
                constant_time_eq(token.as_bytes(), candidate.as_bytes())
            }
            (WebAuthMode::SignedAttach { root }, Some(candidate)) => {
                verify_signed_attach_token(root, candidate)
            }
            _ => false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SignedAttachClaims {
    v: u32,
    scope: String,
    exp: u64,
    nonce: String,
    pid: u32,
}

fn mint_signed_attach_token(root: &SecretString) -> String {
    let now = unix_now_secs();
    let claims = SignedAttachClaims {
        v: TOKEN_VERSION,
        scope: TOKEN_SCOPE_WS.into(),
        exp: now + DEFAULT_ATTACH_TTL_SECS,
        nonce: generate_nonce(),
        pid: std::process::id(),
    };
    let payload = serde_json::to_vec(&claims).expect("signed attach token payload must serialize");
    let payload_encoded = URL_SAFE_NO_PAD.encode(payload.as_slice());
    let signature = sign(root.expose_secret().as_bytes(), payload_encoded.as_bytes());
    format!("v1.{payload_encoded}.{signature}")
}

fn verify_signed_attach_token(root: &SecretString, token: &str) -> bool {
    let Some((prefix, rest)) = token.split_once('.') else {
        return false;
    };
    if prefix != "v1" {
        return false;
    }
    let Some((payload_encoded, signature)) = rest.rsplit_once('.') else {
        return false;
    };

    let expected = sign(root.expose_secret().as_bytes(), payload_encoded.as_bytes());
    if !constant_time_eq(expected.as_bytes(), signature.as_bytes()) {
        return false;
    }

    let Ok(payload) = URL_SAFE_NO_PAD.decode(payload_encoded) else {
        return false;
    };
    let Ok(claims) = serde_json::from_slice::<SignedAttachClaims>(&payload) else {
        return false;
    };

    claims.v == TOKEN_VERSION
        && claims.scope == TOKEN_SCOPE_WS
        && claims.exp >= unix_now_secs()
        && !claims.nonce.is_empty()
}

fn sign(secret: &[u8], payload: &[u8]) -> String {
    let mut mac = HmacSha256::new_from_slice(secret).expect("HMAC accepts any key length");
    mac.update(payload);
    let signature = mac.finalize().into_bytes();
    URL_SAFE_NO_PAD.encode(signature)
}

fn generate_nonce() -> String {
    let mut bytes = [0_u8; 16];
    getrandom::fill(&mut bytes).expect("nonce generation must succeed");
    URL_SAFE_NO_PAD.encode(bytes)
}

fn unix_now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0_u8;
    for (left, right) in a.iter().zip(b.iter()) {
        diff |= left ^ right;
    }
    diff == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ephemeral_state_round_trips_bearer_token() {
        let auth = WebAuthState::ephemeral_generated("abc123".into());
        let issued = auth.issue_query_token();

        assert_eq!(auth.mode_name(), "ephemeral-bearer");
        assert_eq!(auth.source(), WebAuthSource::Generated);
        assert_eq!(issued, "abc123");
        assert!(auth.verify_query_token(Some(&issued)));
        assert!(!auth.verify_query_token(Some("wrong")));
    }

    #[test]
    fn signed_attach_state_issues_verifiable_token() {
        let auth = WebAuthState::signed_attach(
            SecretString::from("super-secret-root".to_string()),
            WebAuthSource::Keyring,
        );
        let token = auth.issue_query_token();

        assert_eq!(auth.mode_name(), "signed-attach");
        assert_eq!(auth.source(), WebAuthSource::Keyring);
        assert!(token.starts_with("v1."));
        assert!(auth.verify_query_token(Some(&token)));
    }

    #[test]
    fn signed_attach_rejects_tampered_payload() {
        let auth = WebAuthState::signed_attach(
            SecretString::from("super-secret-root".to_string()),
            WebAuthSource::SecretStore,
        );
        let token = auth.issue_query_token();
        let tampered = token.replace("v1.", "v1.x");

        assert!(!auth.verify_query_token(Some(&tampered)));
    }
}
