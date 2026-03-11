import { createServer } from 'node:http';
import type { HealthStatus, ProviderSettings } from '../../shared/src/index';
import { getSupportedProviderModes } from './provider.js';
import { LearningStore } from './store.js';

const port = Number.parseInt(process.env.PORT ?? '43010', 10);
const host = process.env.HOST ?? '127.0.0.1';
const store = new LearningStore();

const server = createServer((request, response) => {
  if (!request.url) {
    response.writeHead(400).end();
    return;
  }

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

  if (request.method === 'GET' && request.url === '/artifacts') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ items: store.list() }));
    return;
  }

  if (request.method === 'GET' && request.url === '/records') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ items: store.listRecords() }));
    return;
  }

  if (request.method === 'GET' && request.url === '/stories') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ items: store.listStories() }));
    return;
  }

  if (request.method === 'GET' && request.url === '/settings') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(store.getSettings()));
    return;
  }

  if (request.method === 'POST' && request.url === '/artifacts') {
    const chunks: Buffer[] = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      void (async () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { sourceText?: string; sourceApp?: string | null };
          const sourceText = body.sourceText?.trim();

          if (!sourceText) {
            response.writeHead(400, { 'content-type': 'application/json' });
            response.end(JSON.stringify({ error: 'sourceText is required' }));
            return;
          }

          const record = await store.addRecord(sourceText, body.sourceApp ?? null);
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

  if (request.method === 'POST' && request.url === '/stories/generate') {
    void (async () => {
      try {
        const story = await store.generateStory();
        response.writeHead(201, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ item: story }));
      } catch {
        if (!response.headersSent) {
          response.writeHead(500, { 'content-type': 'application/json' });
          response.end(JSON.stringify({ error: 'internal server error' }));
        }
      }
    })();
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

  response.writeHead(404, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ error: 'not found' }));
});

await store.init();

server.listen(port, host, () => {
  console.log(`TypeLearn service listening on http://${host}:${port}`);
});
