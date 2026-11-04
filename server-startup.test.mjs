import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

function launch(port, proxyTrap = false, extraEnv = {}) {
  const child = spawn(process.execPath, ['--use-env-proxy', 'server.mjs'], {
    cwd: new URL('.', import.meta.url), windowsHide: true,
    env: { ...process.env, NODE_ENV: 'test', PORT: String(port), ...(proxyTrap ? { HTTP_PROXY: 'http://127.0.0.1:9', HTTPS_PROXY: 'http://127.0.0.1:9', NO_PROXY: '' } : {}), ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = ''; child.stdout.on('data', chunk => output += chunk); child.stderr.on('data', chunk => output += chunk);
  const exited = once(child, 'exit');
  return { child, exited, output: () => output, async ready() {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const match = output.match(/朋友圈详情图制作：http:\/\/localhost:(\d+)/);
      if (match) return Number(match[1]);
      if (child.exitCode !== null) throw Error(output);
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    throw Error('启动超时：' + output);
  } };
}
async function stop(instance) { if (instance.child.exitCode === null && instance.child.signalCode === null) instance.child.kill(); await instance.exited; }
async function temporaryServer(handler) {
  const server = http.createServer(handler); server.listen(0, '0.0.0.0'); await once(server, 'listening'); return server;
}
function get(port, path = '/api/health') {
  return new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port, path, agent: false }, response => {
      let data = ''; response.on('data', chunk => data += chunk); response.on('end', () => resolve(data));
    }).on('error', reject);
  });
}
test('重复启动复用已有服务，即使系统代理不可用也不会报端口冲突', { timeout: 15000 }, async () => {
  const reservation = await temporaryServer((_req, res) => res.end('reserved'));
  const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve));
  const first = launch(port); let second;
  try {
    const actualPort = await first.ready(); second = launch(port, true);
    const [code] = await second.exited;
    assert.equal(code, 0, second.output()); assert.match(second.output(), /工具已经运行/);
    assert.match(second.output(), new RegExp('localhost:' + actualPort));
    assert.equal(JSON.parse(await get(actualPort)).service, 'wechat-moment-detail-maker');
    assert.equal(first.child.exitCode, null);
  } finally { if (second) await stop(second); await stop(first); }
});
test('其他程序占用端口时自动换端口，保留原程序', { timeout: 15000 }, async () => {
  const occupied = await temporaryServer((_req, res) => res.end('another application'));
  const port = occupied.address().port; const instance = launch(port);
  try {
    const actualPort = await instance.ready();
    assert.ok(actualPort > port && actualPort <= port + 20); assert.match(instance.output(), /被其他程序占用/);
    assert.equal(JSON.parse(await get(actualPort)).service, 'wechat-moment-detail-maker');
    assert.equal(await get(port), 'another application');
  } finally { await stop(instance); await new Promise(resolve => occupied.close(resolve)); }
});

test('Pages 来源可跨域读取接口，错误响应保留跨域头，未授权来源被拒绝', { timeout: 15000 }, async () => {
  const reservation = await temporaryServer((_req, res) => res.end('reserved'));
  const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve));
  const origin = 'https://example.github.io';
  const instance = launch(port, false, { ALLOWED_ORIGINS: origin });
  try {
    const actualPort = await instance.ready(), base = 'http://127.0.0.1:' + actualPort;
    const health = await fetch(base + '/api/health', { headers: { Origin: origin } });
    assert.equal(health.status, 200); assert.equal(health.headers.get('access-control-allow-origin'), origin);
    assert.equal(health.headers.get('vary'), 'Origin');
    const invalidImage = await fetch(base + '/api/image?url=https://example.org/image.png', { headers: { Origin: origin } });
    assert.equal(invalidImage.status, 400); assert.equal(invalidImage.headers.get('access-control-allow-origin'), origin);
    const blocked = await fetch(base + '/api/health', { headers: { Origin: 'https://other.github.io' } });
    assert.equal(blocked.status, 403); assert.equal(blocked.headers.get('access-control-allow-origin'), null);
    const preflight = await fetch(base + '/api/health', { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'GET' } });
    assert.equal(preflight.status, 204); assert.match(preflight.headers.get('access-control-allow-methods'), /GET/);
    const sameOrigin = await fetch(base + '/api/health', { headers: { Origin: base } }); assert.equal(sameOrigin.status, 200);
  } finally { await stop(instance); }
});
