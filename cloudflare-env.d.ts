declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    CARTESIA_API_KEY?: string;
    CARTESIA_MODEL_ID?: string;
    BUCKET?: R2Bucket;
  }
}
