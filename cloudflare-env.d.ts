declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    CARTESIA_API_KEY?: string;
    CARTESIA_MODEL_ID?: string;
    WITHYOU_VOICE_PROVIDER?: string;
    WITHYOU_ALLOW_MOCK_PROVIDER?: string;
    BUCKET?: R2Bucket;
  }
}
