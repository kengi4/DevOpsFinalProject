import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

describe('CloudPulse HTTP API', () => {
  let server;
  let baseUrl;

  before(async () => {
    const app = createApp({
      version: 'test-1.0.0',
      environment: 'test',
      cloudProvider: 'Google Cloud Compute Engine',
    });

    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const address = server.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('GET /health returns 200 and service metadata', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'cloudpulse');
    assert.equal(body.version, 'test-1.0.0');
  });

  it('GET /ready returns readiness state', async () => {
    const res = await fetch(`${baseUrl}/ready`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ready, true);
    assert.ok(body.checksCount >= 3);
  });

  it('GET /api/info returns runtime telemetry', async () => {
    const res = await fetch(`${baseUrl}/api/info`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.environment, 'test');
    assert.equal(body.cloudProvider, 'Google Cloud Compute Engine');
    assert.ok(body.memory.rssMB > 0);
  });

  it('supports CRUD lifecycle on /api/checks', async () => {
    const createRes = await fetch(`${baseUrl}/api/checks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Verify firewall allows port 80',
        service: 'gcp-vpc',
        severity: 'high',
      }),
    });
    assert.equal(createRes.status, 201);
    const created = await createRes.json();
    assert.equal(created.status, 'pending');
    assert.equal(created.service, 'gcp-vpc');

    const toggleRes = await fetch(`${baseUrl}/api/checks/${created.id}/toggle`, {
      method: 'PATCH',
    });
    assert.equal(toggleRes.status, 200);
    const toggled = await toggleRes.json();
    assert.equal(toggled.status, 'verified');

    const filteredRes = await fetch(`${baseUrl}/api/checks?status=verified`);
    assert.equal(filteredRes.status, 200);
    const filtered = await filteredRes.json();
    assert.ok(filtered.items.some((item) => item.id === created.id));

    const deleteRes = await fetch(`${baseUrl}/api/checks/${created.id}`, {
      method: 'DELETE',
    });
    assert.equal(deleteRes.status, 204);

    const missingToggleRes = await fetch(`${baseUrl}/api/checks/${created.id}/toggle`, {
      method: 'PATCH',
    });
    assert.equal(missingToggleRes.status, 404);
  });

  it('rejects invalid check payload with 400', async () => {
    const res = await fetch(`${baseUrl}/api/checks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'ab', severity: 'invalid' }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error);
  });

  it('GET / serves the web dashboard', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /CloudPulse/);
  });
});
