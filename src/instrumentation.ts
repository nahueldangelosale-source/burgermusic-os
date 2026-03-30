import { trace } from '@opentelemetry/api';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { NodeSDK } = require('@opentelemetry/sdk-node');
    const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
    const { resourceFromAttributes } = require('@opentelemetry/resources');

    const sdk = new NodeSDK({
      resource: resourceFromAttributes({ 'service.name': 'burgermusic-cortex-edge' }),
      traceExporter: new OTLPTraceExporter()
    });

    sdk.start();
    console.log("[Instrumentación SRE] TraceProvider Node inyectado O(1) con OTLP (NodeSDK).");
  }
}
