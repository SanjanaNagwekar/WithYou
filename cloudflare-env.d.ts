declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    CARTESIA_API_KEY?: string;
    CARTESIA_MODEL_ID?: string;
    WITHYOU_VOICE_PROVIDER?: string;
    WITHYOU_ALLOW_MOCK_PROVIDER?: string;
    WITHYOU_TRANSLATION_PROVIDER?: string;
    WITHYOU_ALLOW_MOCK_TRANSLATION?: string;
    GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON?: string;
    BETTER_AUTH_SECRET?: string;
    BETTER_AUTH_URL?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    RESEND_API_KEY?: string;
    AUTH_EMAIL_FROM?: string;
    BUCKET?: R2Bucket;
  }
}
