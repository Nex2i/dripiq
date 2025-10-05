import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_HOST, NODE_ENV } from '@/config';

if (!LANGFUSE_PUBLIC_KEY || !LANGFUSE_SECRET_KEY || !LANGFUSE_HOST || !NODE_ENV) {
  throw new Error(
    'LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_HOST, and NODE_ENV must be set'
  );
}

const sdk = new NodeSDK({
  spanProcessors: [
    new LangfuseSpanProcessor({
      publicKey: LANGFUSE_PUBLIC_KEY!,
      secretKey: LANGFUSE_SECRET_KEY!,
      baseUrl: LANGFUSE_HOST || 'https://cloud.langfuse.com',
      environment: NODE_ENV || 'development',
    }),
  ],
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-http': {
        enabled: false,
      },
      '@opentelemetry/instrumentation-net': {
        enabled: false,
      },
    }),
  ],
});
sdk.start();
