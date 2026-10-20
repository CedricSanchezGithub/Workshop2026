import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiMetrics } from '../../backend/api/src/observability/Metrics.js';

test('les métriques exposent les noms et buckets du contrat', () => {
  const metrics = new ApiMetrics();
  metrics.httpRequestsTotal.inc({ method: 'GET', route: '/health', status: '200' });
  metrics.httpRequestDurationSeconds.observe({ route: '/health' }, 0.01);
  metrics.httpRequestBytes.observe({ route: '/health' }, 128);
  metrics.httpResponseBytesTotal.inc({ route: '/health' }, 24);

  const output = metrics.renderPrometheus();
  assert.match(output, /# TYPE http_requests_total counter/);
  assert.ok(output.includes('http_requests_total{method="GET",route="/health",status="200"} 1'));
  assert.ok(output.includes('http_request_duration_seconds_bucket{route="/health",le="0.01"} 1'));
  assert.ok(output.includes('http_request_bytes_bucket{route="/health",le="128"} 1'));
  assert.ok(output.includes('payments_total{status="accepted"} 0'));
  assert.match(output, /# TYPE db_errors_total counter/);
});
