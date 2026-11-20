// Небольшой учебный HTTP load test, без внешних зависимостей.
// Запуск: LOAD_URL=http://127.0.0.1:3000/api/health USERS=5 DURATION=60 npm run load
const url = process.env.LOAD_URL || 'http://127.0.0.1:3000/api/health';
const users = Math.max(1, Number(process.env.USERS || 5));
const duration = Math.max(1, Number(process.env.DURATION || 60));
const stopAt = Date.now() + duration * 1000;
const samples = [];
let requests = 0;
let failures = 0;

async function worker() {
  while (Date.now() < stopAt) {
    const start = performance.now();
    try {
      const response = await fetch(url);
      await response.arrayBuffer();
      if (!response.ok) failures++;
    } catch { failures++; }
    samples.push(performance.now() - start);
    requests++;
  }
}

function percentile(values, p) {
  if (!values.length) return 0;
  return values[Math.min(values.length - 1, Math.ceil(values.length * p) - 1)];
}

(async () => {
  console.log(`Target=${url} users=${users} duration=${duration}s`);
  await Promise.all(Array.from({ length: users }, worker));
  samples.sort((a, b) => a - b);
  // Avoid spreading a potentially very large sample array into a function call.
  const maxLatency = samples.length ? samples[samples.length - 1] : 0;
  console.log(JSON.stringify({ requests, failures, errorRatePercent: +(failures / requests * 100).toFixed(2), throughputRps: +(requests / duration).toFixed(2), responseMs: { median: +percentile(samples, .5).toFixed(2), p95: +percentile(samples, .95).toFixed(2), max: +maxLatency.toFixed(2) } }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
