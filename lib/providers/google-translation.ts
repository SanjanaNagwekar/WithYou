import { AppError } from '@/lib/errors';
import type {
  TranslationInput,
  TranslationProvider,
  TranslationResult,
} from '@/lib/providers/translation-provider';

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
};

type CachedToken = { value: string; expiresAt: number };
let cachedToken: CachedToken | undefined;

export class GoogleTranslationProvider implements TranslationProvider {
  private readonly credential: ServiceAccount;

  constructor(
    serviceAccountJson: string,
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {
    this.credential = parseServiceAccount(serviceAccountJson);
  }

  async translate(input: TranslationInput): Promise<TranslationResult> {
    if (input.targetLanguage === input.sourceLanguage) {
      return { translatedText: input.text, provider: 'none' };
    }

    const token = await this.accessToken();
    const project = encodeURIComponent(this.credential.project_id);
    const response = await this.fetchImplementation(
      `https://translation.googleapis.com/v3/projects/${project}/locations/global:translateText`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [input.text],
          mimeType: 'text/plain',
          sourceLanguageCode: input.sourceLanguage,
          targetLanguageCode: input.targetLanguage,
        }),
        signal: AbortSignal.timeout(30000),
      },
    );

    if (!response.ok) throw translationError(response.status);
    const body = (await response.json()) as {
      translations?: Array<{ translatedText?: string }>;
    };
    const translatedText = body.translations?.[0]?.translatedText?.trim();
    if (!translatedText) {
      throw new AppError('The translation service returned an invalid translation.', 502);
    }
    return { translatedText, provider: 'google' };
  }

  private async accessToken(): Promise<string> {
    if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) return cachedToken.value;

    const tokenUri = this.credential.token_uri || 'https://oauth2.googleapis.com/token';
    const now = Math.floor(Date.now() / 1000);
    const assertion = await createSignedAssertion(this.credential, tokenUri, now);
    const response = await this.fetchImplementation(tokenUri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw translationError(response.status);
    const body = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!body.access_token) {
      throw new AppError('Google Cloud did not return a translation access token.', 503);
    }
    cachedToken = {
      value: body.access_token,
      expiresAt: Date.now() + Math.max(60, body.expires_in ?? 3600) * 1000,
    };
    return cachedToken.value;
  }
}

function parseServiceAccount(value: string): ServiceAccount {
  try {
    const parsed = JSON.parse(value) as Partial<ServiceAccount>;
    if (
      typeof parsed.project_id !== 'string' ||
      !parsed.project_id ||
      typeof parsed.client_email !== 'string' ||
      !parsed.client_email ||
      typeof parsed.private_key !== 'string' ||
      !parsed.private_key.includes('BEGIN PRIVATE KEY')
    ) {
      throw new Error('missing service-account fields');
    }
    return parsed as ServiceAccount;
  } catch {
    throw new AppError('Google Translation credentials are invalid.', 503);
  }
}

async function createSignedAssertion(
  credential: ServiceAccount,
  audience: string,
  issuedAt: number,
): Promise<string> {
  const header = base64UrlJson({ alg: 'RS256', typ: 'JWT' });
  const claims = base64UrlJson({
    iss: credential.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-translation',
    aud: audience,
    iat: issuedAt,
    exp: issuedAt + 3600,
  });
  const unsigned = `${header}.${claims}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemBytes(credential.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned),
  );
  return `${unsigned}.${base64Url(new Uint8Array(signature))}`;
}

function pemBytes(value: string): ArrayBuffer {
  const base64 = value
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return bytes.buffer;
}

function base64UrlJson(value: unknown): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function translationError(status: number): AppError {
  if (status === 401 || status === 403) {
    return new AppError('Google Translation is not authorized. Please contact the app owner.', 503);
  }
  if (status === 429) {
    return new AppError('Translation is temporarily at its usage limit. Please try again later.', 429);
  }
  return new AppError('The message could not be translated. Please try again.', 502);
}
