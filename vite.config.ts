import vinext from 'vinext';
import { defineConfig } from 'vite';
import deploymentConfig from './deployment.json' with { type: 'json' };

const LOCAL_DATABASE_ID = '00000000-0000-4000-8000-000000000000';
const { d1, r2, production } = deploymentConfig;
const isProductionDeployment = process.env.WITHYOU_DEPLOY_TARGET === 'production';

const database = isProductionDeployment
  ? {
      binding: d1,
      database_name: production.d1DatabaseName,
      database_id: production.d1DatabaseId,
    }
  : {
      binding: d1,
      database_name: 'withyou-db',
      database_id: LOCAL_DATABASE_ID,
    };

const bucket = isProductionDeployment
  ? {
      binding: r2,
      bucket_name: production.r2BucketName,
    }
  : {
      binding: r2,
      bucket_name: 'withyou-audio',
    };

const localBindingConfig = {
  name: production.workerName,
  main: 'vinext/server/fetch-handler',
  compatibility_flags: ['nodejs_compat'],
  d1_databases: d1 ? [database] : [],
  r2_buckets: r2 ? [bucket] : [],
  vars: {
    WITHYOU_VOICE_PROVIDER: process.env.WITHYOU_VOICE_PROVIDER || 'cartesia',
    WITHYOU_ALLOW_MOCK_PROVIDER: process.env.WITHYOU_ALLOW_MOCK_PROVIDER || 'false',
    CARTESIA_MODEL_ID: process.env.CARTESIA_MODEL_ID || 'sonic-3.6',
    WITHYOU_TRANSLATION_PROVIDER: process.env.WITHYOU_TRANSLATION_PROVIDER || 'google',
    WITHYOU_ALLOW_MOCK_TRANSLATION:
      process.env.WITHYOU_ALLOW_MOCK_TRANSLATION || 'false',
    BETTER_AUTH_URL: isProductionDeployment
      ? production.url
      : process.env.BETTER_AUTH_URL || 'http://localhost:5173',
  },
  secrets: {
    required: [
      'CARTESIA_API_KEY',
      'BETTER_AUTH_SECRET',
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON',
    ],
  },
};

export default defineConfig(async () => {
  process.env.CLOUDFLARE_CF_FETCH_ENABLED ??= 'false';
  process.env.WRANGLER_SEND_METRICS ??= 'false';
  process.env.WRANGLER_WRITE_LOGS ??= 'false';
  process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
  process.env.WRANGLER_REGISTRY_PATH ??= '.wrangler/dev-registry';
  process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';

  const { cloudflare } = await import('@cloudflare/vite-plugin');

  return {
    server: {
      ...(process.platform === 'darwin'
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
    plugins: [
      vinext(),
      cloudflare({
        viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
        inspectorPort: false,
        persistState: { path: process.env.WITHYOU_PERSIST_PATH || '.wrangler/state' },
        config: localBindingConfig,
      }),
    ],
  };
});
