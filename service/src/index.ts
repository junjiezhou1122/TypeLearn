import { createServer } from 'node:http';
import type { HealthStatus, ProviderSettings } from '../../shared/src/index';
import { getSupportedProviderModes } from './provider.js';
import { LearningStore } from './store.js';
import { restoreChineseFromRomanized } from './translator.js';

const port = Number.parseInt(process.env.PORT ?? '43010', 10);
const host = process.env.HOST ?? '127.0.0.1';
const store = new LearningStore();

const server = createServer((request, response) => {
  // CORS Headers
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  if (!request.url) {
    response.writeHead(400).end();
    return;
  }

  const requestUrl = new URL(request.url, `http://${host}:${port}`);

  if (request.method === 'GET' && request.url === '/health') {
    const payload: HealthStatus = {
      status: 'ok',
      service: 'orchestrator-service',
      providerModes: getSupportedProviderModes(),
    };
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(payload));
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/artifacts') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ items: store.list() }));
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/records') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ items: store.listRecords() }));
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/stories') {
    const day = requestUrl.searchParams.get('day');
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ items: day ? store.listStoriesForDay(day) : store.listStories() }));
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/settings') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(store.getSettings()));
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/choices') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ items: store.listChoices() }));
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/patterns') {
    const day = requestUrl.searchParams.get('day') ?? new Date().toISOString().slice(0, 10);
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ items: store.getPatterns(day) }));
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/daily') {
    const day = requestUrl.searchParams.get('day') ?? new Date().toISOString().slice(0, 10);
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ item: store.getDailyLesson(day) }));
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/digests') {
    const day = requestUrl.searchParams.get('day') ?? new Date().toISOString().slice(0, 10);
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ item: store.getDayDigest(day) }));
    return;
  }

  if (request.method === 'POST' && request.url === '/artifacts') {
    const chunks: Buffer[] = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      void (async () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
            sourceText?: string;
            sourceApp?: string | null;
            settings?: ProviderSettings;
          };
          const sourceText = body.sourceText?.trim();

          if (!sourceText) {
            response.writeHead(400, { 'content-type': 'application/json' });
            response.end(JSON.stringify({ error: 'sourceText is required' }));
            return;
          }

          // NOTE: provider settings are stored globally; settings override is ignored for now.
          const record = await store.addRecord(sourceText, body.sourceApp ?? null, body.settings);
          const artifact = store.listArtifacts()[0];
          response.writeHead(201, { 'content-type': 'application/json' });
          response.end(JSON.stringify({ item: artifact, record }));
        } catch {
          if (!response.headersSent) {
            response.writeHead(500, { 'content-type': 'application/json' });
            response.end(JSON.stringify({ error: 'internal server error' }));
          }
        }
      })();
    });
    return;
  }

  if (request.method === 'POST' && request.url.startsWith('/choices/') && request.url.endsWith('/select')) {
    const parts = request.url.split('/');
    const id = parts[2];
    const chunks: Buffer[] = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      void (async () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { index?: number };
          const index = body.index;
          if (typeof index !== 'number' || !Number.isFinite(index)) {
            response.writeHead(400, { 'content-type': 'application/json' });
            response.end(JSON.stringify({ error: 'index is required' }));
            return;
          }

          const record = await store.selectChoice(id, index);
          if (!record) {
            response.writeHead(404, { 'content-type': 'application/json' });
            response.end(JSON.stringify({ error: 'choice not found' }));
            return;
          }

          response.writeHead(201, { 'content-type': 'application/json' });
          response.end(JSON.stringify({ record }));
        } catch {
          if (!response.headersSent) {
            response.writeHead(500, { 'content-type': 'application/json' });
            response.end(JSON.stringify({ error: 'internal server error' }));
          }
        }
      })();
    });
    return;
  }

  if (request.method === 'DELETE' && request.url.startsWith('/choices/')) {
    const id = request.url.replace('/choices/', '');
    void (async () => {
      const deleted = await store.deleteChoice(id);
      response.writeHead(deleted ? 204 : 404).end();
    })();
    return;
  }

  if (request.method === 'POST' && request.url.startsWith('/artifacts/') && request.url.endsWith('/retry')) {
    const id = request.url.split('/')[2];
    void (async () => {
      const success = await store.retry(id);
      response.writeHead(success ? 200 : 404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ success }));
    })();
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/stories/generate') {
    const chunks: Buffer[] = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      void (async () => {
        try {
          const raw = Buffer.concat(chunks).toString('utf8').trim();
          const body = raw ? JSON.parse(raw) as { day?: string } : {};
          const day = body.day ?? requestUrl.searchParams.get('day') ?? new Date().toISOString().slice(0, 10);
          const story = await store.generateStory(day);
          response.writeHead(201, { 'content-type': 'application/json' });
          response.end(JSON.stringify({ item: story }));
        } catch {
          if (!response.headersSent) {
            response.writeHead(500, { 'content-type': 'application/json' });
            response.end(JSON.stringify({ error: 'internal server error' }));
          }
        }
      })();
    });
    return;
  }

  if (request.method === 'PUT' && request.url === '/settings') {
    const chunks: Buffer[] = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      void (async () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Partial<ProviderSettings>;
          const settings = await store.updateSettings({
            baseUrl: body.baseUrl ?? '',
            apiKey: body.apiKey ?? '',
            model: body.model ?? 'gpt-4.1-mini',
          });
          response.writeHead(200, { 'content-type': 'application/json' });
          response.end(JSON.stringify(settings));
        } catch {
          if (!response.headersSent) {
            response.writeHead(500, { 'content-type': 'application/json' });
            response.end(JSON.stringify({ error: 'internal server error' }));
          }
        }
      })();
    });
    return;
  }

  if (request.method === 'DELETE' && request.url.startsWith('/records/')) {
    const id = request.url.replace('/records/', '');
    void (async () => {
      const deleted = await store.deleteRecord(id);
      response.writeHead(deleted ? 204 : 404).end();
    })();
    return;
  }

  if (request.method === 'GET' && request.url.startsWith('/debug/restore?')) {
    const params = new URL(request.url, `http://${host}:${port}`).searchParams;
    const text = params.get('text') ?? '';
    void (async () => {
      try {
        console.log('[debug/restore] testing with text:', JSON.stringify(text));
        const result = await restoreChineseFromRomanized(text, store.getSettings());
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ input: text, ...result }));
      } catch (error) {
        response.writeHead(500, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ error: String(error) }));
      }
    })();
    return;
  }

  response.writeHead(404, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ error: 'not found' }));
});

await store.init();

server.listen(port, host, () => {
  console.log(`TypeLearn service listening on http://${host}:${port}`);
});
