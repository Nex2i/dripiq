import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { LangfuseSpanProcessor } from '@langfuse/otel';

const sdk = new NodeSDK({
  instrumentations: getNodeAutoInstrumentations({
    '@opentelemetry/instrumentation-http': { enabled: false },
    '@opentelemetry/instrumentation-undici': { enabled: false },
    '@opentelemetry/instrumentation-net': { enabled: false },
    '@opentelemetry/instrumentation-dns': { enabled: false },
  }),
  spanProcessors: [
    new LangfuseSpanProcessor({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
      secretKey: process.env.LANGFUSE_SECRET_KEY!,
      baseUrl: process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com',
      environment: process.env.NODE_ENV || 'development',
    }),
  ],
});
sdk.start();
