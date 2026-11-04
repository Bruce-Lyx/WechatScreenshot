import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { requestWeChat } from './wechat-request.mjs';
import { normalizeArticleUrl, isWeChatImage, parseArticleHtml } from './article-metadata.mjs';

const url = 'https://mp.weixin.qq.com/s/example';
const allowedArticle = input => { try { normalizeArticleUrl(input); return true; } catch { return false; } };
const noWait = async () => {};
const articleHtml = '<meta property="og:title" content="真实文章"><meta property="og:image" content="https://mmbiz.qpic.cn/cover"><a id="js_name">示例公众号</a>';
const offline = () => new TypeError('fetch failed', { cause: Object.assign(new Error('reset'), { code: 'ECONNRESET' }) });

test('文章断线后自动重试，仍解析真实标题、封面和出处', async () => {
  let calls = 0; const signals = [];
  const result = await requestWeChat(url, allowedArticle, 4096, { wait: noWait, fetchImpl: async (_url, options) => {
    signals.push(options.signal);
    if (++calls < 3) throw offline();
    return new Response(articleHtml, { headers: { 'content-type': 'text/html' } });
  } });
  assert.equal(calls, 3); assert.equal(new Set(signals).size, 3);
  assert.deepEqual(parseArticleHtml(result.bytes.toString()), { title: '真实文章', source: '示例公众号', cover: 'https://mmbiz.qpic.cn/cover' });
});

test('封面遇到限流或临时 HTTP 错误后重试并保留图片字节', async () => {
  let calls = 0; const image = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
  const result = await requestWeChat('https://mmbiz.qpic.cn/cover', isWeChatImage, 4096, { wait: noWait, fetchImpl: async () => {
    calls++;
    return calls < 3 ? new Response('', { status: calls === 1 ? 429 : 503 }) : new Response(image, { headers: { 'content-type': 'image/jpeg' } });
  } });
  assert.equal(calls, 3); assert.equal(result.contentType, 'image/jpeg'); assert.deepEqual(result.bytes, image);
});

test('连接持续失败最多请求三次，并提示在线服务故障', async () => {
  let calls = 0;
  await assert.rejects(requestWeChat(url, allowedArticle, 4096, { wait: noWait, fetchImpl: async () => { calls++; throw offline(); } }), /在线读取服务暂时无法连接微信，自动重试后仍未成功/);
  assert.equal(calls, 3);
});

test('正文读取时超时也会重试，不只重试响应头之前的错误', { timeout: 3000 }, async () => {
  const server = http.createServer((_req, res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.write('<html>'); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  let calls = 0;
  try {
    await assert.rejects(requestWeChat('http://127.0.0.1:' + server.address().port, () => true, 4096, {
      wait: noWait, timeoutMs: 80, fetchImpl: (...args) => { calls++; return fetch(...args); }
    }), /微信响应超时，自动重试后仍未成功/);
    assert.equal(calls, 3);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

test('封面响应体中途断开后重新下载完整图片', async () => {
  let calls = 0;
  const result = await requestWeChat('https://mmbiz.qpic.cn/cover', isWeChatImage, 4096, { wait: noWait, fetchImpl: async () => {
    if (++calls === 1) return new Response(new ReadableStream({ start(controller) { controller.error(new TypeError('terminated')); } }));
    return new Response('complete');
  } });
  assert.equal(calls, 2); assert.equal(result.bytes.toString(), 'complete');
});

test('HTTP 404、无效重定向和过大文件立即失败，不进行网络重试', async () => {
  for (const [response, message] of [
    [() => new Response('', { status: 404 }), /HTTP 404/],
    [() => new Response('', { status: 302, headers: { location: 'http://127.0.0.1/private' } }), /不受支持/],
    [() => new Response('too large'), /大小限制/]
  ]) {
    let calls = 0;
    await assert.rejects(requestWeChat(url, allowedArticle, 2, { wait: noWait, fetchImpl: async () => { calls++; return response(); } }), message);
    assert.equal(calls, 1);
  }
});

test('拒绝未授权初始地址，且不重试微信验证页', async () => {
  let calls = 0;
  const options = { wait: noWait, fetchImpl: async () => { calls++; return new Response('<title>Weixin Official Accounts Platform</title>'); } };
  await assert.rejects(requestWeChat('https://example.org/', allowedArticle, 4096, options), /不受支持/);
  assert.equal(calls, 0);
  const result = await requestWeChat(url, allowedArticle, 4096, options);
  assert.throws(() => parseArticleHtml(result.bytes.toString()), /验证页或平台页/); assert.equal(calls, 1);
});
