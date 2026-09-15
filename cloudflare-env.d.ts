declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    CARTESIA_API_KEY?: string;
    CARTESIA_MODEL_ID?: string;
    WITHYOU_VOICE_PROVIDER?: string;
    WITHYOU_ALLOW_MOCK_PROVIDER?: string;
    BETTER_AUTH_SECRET?: string;
    BETTER_AUTH_URL?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    RESEND_API_KEY?: string;
    AUTH_EMAIL_FROM?: string;
    BUCKET?: R2Bucket;
  }
}
