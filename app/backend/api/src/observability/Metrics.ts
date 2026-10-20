type Labels = Record<string, string | number>;

function escapeLabel(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n');
}

function labelsKey(labelNames: string[], labels: Labels): string {
  return labelNames.map((name) => String(labels[name] ?? '')).join('\u0001');
}

function labelsText(labelNames: string[], labels: Labels): string {
  if (!labelNames.length) return '';
  return `{${labelNames.map((name) => `${name}="${escapeLabel(String(labels[name] ?? ''))}"`).join(',')}}`;
}

class CounterMetric {
  private readonly values = new Map<string, { labels: Labels; value: number }>();

  constructor(private readonly name: string, private readonly help: string, private readonly labelNames: string[] = []) {
    if (!labelNames.length) this.values.set('', { labels: {}, value: 0 });
  }

  inc(labels: Labels = {}, amount = 1) {
    const key = labelsKey(this.labelNames, labels);
    const current = this.values.get(key) ?? { labels, value: 0 };
    current.value += amount;
    this.values.set(key, current);
  }

  render() {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} counter`];
    for (const { labels, value } of this.values.values()) lines.push(`${this.name}${labelsText(this.labelNames, labels)} ${value}`);
    return lines.join('\n');
  }
}

class HistogramMetric {
  private readonly values = new Map<string, { labels: Labels; buckets: number[]; count: number; sum: number }>();

  constructor(private readonly name: string, private readonly help: string, private readonly labelNames: string[], private readonly bucketValues: number[]) {}

  observe(labels: Labels, value: number) {
    const key = labelsKey(this.labelNames, labels);
    const current = this.values.get(key) ?? { labels, buckets: this.bucketValues.map(() => 0), count: 0, sum: 0 };
    this.bucketValues.forEach((bucket, index) => { if (value <= bucket) current.buckets[index] += 1; });
    current.count += 1;
    current.sum += value;
    this.values.set(key, current);
  }

  render() {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} histogram`];
    for (const { labels, buckets, count, sum } of this.values.values()) {
      const base = labelsText(this.labelNames, labels);
      const labelPrefix = this.labelNames.length ? `${this.labelNames.map((name) => `${name}="${escapeLabel(String(labels[name] ?? ''))}"`).join(',')},` : '';
      this.bucketValues.forEach((bucket, index) => lines.push(`${this.name}_bucket{${labelPrefix}le="${bucket}"} ${buckets[index]}`));
      lines.push(`${this.name}_bucket{${labelPrefix}le="+Inf"} ${count}`);
      lines.push(`${this.name}_sum${base} ${sum}`);
      lines.push(`${this.name}_count${base} ${count}`);
    }
    return lines.join('\n');
  }
}

export class ApiMetrics {
  readonly httpRequestsTotal = new CounterMetric('http_requests_total', 'Nombre total de requêtes HTTP terminées.', ['method', 'route', 'status']);
  readonly httpResponseBytesTotal = new CounterMetric('http_response_bytes_total', 'Nombre total d’octets dans les réponses HTTP.', ['route']);
  readonly paymentsTotal = new CounterMetric('payments_total', 'Transactions de paiement traitées.', ['status']);
  readonly dbErrorsTotal = new CounterMetric('db_errors_total', 'Erreurs d’accès à la base de données.');
  readonly loginFailuresTotal = new CounterMetric('login_failures_total', 'Échecs d’authentification.');
  readonly httpRequestDurationSeconds = new HistogramMetric('http_request_duration_seconds', 'Durée de traitement des requêtes HTTP en secondes.', ['route'], [.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10]);
  readonly httpRequestBytes = new HistogramMetric('http_request_bytes', 'Taille de l’URL et du corps de requête HTTP.', ['route'], [64, 128, 256, 512, 1024, 2048, 4096, 16384]);

  constructor() {
    for (const status of ['accepted', 'rejected', 'error']) this.paymentsTotal.inc({ status }, 0);
  }

  renderPrometheus() {
    return [
      this.httpRequestsTotal.render(),
      this.httpRequestDurationSeconds.render(),
      this.httpResponseBytesTotal.render(),
      this.httpRequestBytes.render(),
      this.paymentsTotal.render(),
      this.dbErrorsTotal.render(),
      this.loginFailuresTotal.render(),
    ].join('\n') + '\n';
  }
}
