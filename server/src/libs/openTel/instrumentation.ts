import { NodeSDK } from '@opentelemetry/sdk-node';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_HOST } from '@/config';

const sdk = new NodeSDK({
  spanProcessors: [
    new LangfuseSpanProcessor({
      publicKey: LANGFUSE_PUBLIC_KEY,
      secretKey: LANGFUSE_SECRET_KEY,
      baseUrl: LANGFUSE_HOST || 'https://cloud.langfuse.com',
      // Filter out noisy low-level spans
      shouldExportSpan: (span) => {
        const spanName = span.otelSpan.name?.toLowerCase() || '';

        // Filter out low-level network operations that fragment traces
        const noisyOperations = [
          'dns.lookup',
          'tls.connect',
          'tcp.connect',
          'net.connect',
          'http.request',
          'https.request',
          'POST',
          'GET',
        ];

        // Keep the span if it's NOT a noisy operation
        return !noisyOperations.some((op) => spanName.includes(op));
      },
    }),
  ],
});

sdk.start();
