import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { execFile } from 'node:child_process';
import { connect } from 'node:net';
import { normalizeArticleUrl, parseArticleHtml, isWeChatImage } from './article-metadata.mjs';
import { requestWeChat as request } from './wechat-request.mjs';

const root = new URL('./', import.meta.url);
let port = Number(process.env.PORT || 8765);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT 必须是 1–65535 之间的端口号');
const initialPort = port;
const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean).map(value => {
  const origin = new URL(value);
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password) throw new Error('ALLOWED_ORIGINS 必须填写网页的 HTTP/HTTPS 地址');
  return origin.origin;
}));
const cache = new Map();
const files = new Map([['/manifest.webmanifest', ['manifest.webmanifest', 'application/manifest+json; charset=utf-8']], ['/sw.js', ['sw.js', 'text/javascript; charset=utf-8']], ['/icons/icon-192.png', ['icons/icon-192.png', 'image/png']], ['/icons/icon-512.png', ['icons/icon-512.png', 'image/png']], ['/icons/apple-touch-icon.png', ['icons/apple-touch-icon.png', 'image/png']], ['/', ['index.html', 'text/html; charset=utf-8']], ['/index.html', ['index.html', 'text/html; charset=utf-8']], ['/README.md', ['README.md', 'text/plain; charset=utf-8']], ['/LICENSE', ['LICENSE', 'text/plain; charset=utf-8']]]);
function cached(key) { const value = cache.get(key); if (value?.expires > Date.now()) return value.data; cache.delete(key); }
function remember(key, data, ttl) { if (cache.size >= 24) cache.delete(cache.keys().next().value); cache.set(key, { data, expires: Date.now() + ttl }); return data; }
const allowedArticle = input => { try { normalizeArticleUrl(input); return true; } catch { return false; } };
function json(res, status, data) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(data)); }
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      res.setHeader('Vary', 'Origin');
      const origin = req.headers.origin;
      if (origin) {
        const sameOrigin = origin === 'http://' + req.headers.host || origin === 'https://' + req.headers.host;
        if (!sameOrigin && !allowedOrigins.has(origin)) return json(res, 403, { error: '此网页地址未获读取服务授权，请检查 ALLOWED_ORIGINS 设置' });
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      }
      if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    }
    if (req.method !== 'GET') return json(res, 405, { error: '仅支持 GET' });
    if (url.pathname === '/api/health') return json(res, 200, { service: 'wechat-moment-detail-maker' });
    if (url.pathname === '/api/article') {
      let articleUrl; try { articleUrl = normalizeArticleUrl(url.searchParams.get('url')); } catch (e) { return json(res, 400, { error: e.message }); }
      let article = cached(articleUrl);
      if (!article) {
        const response = await request(articleUrl, allowedArticle, 8 * 1024 * 1024);
        article = parseArticleHtml(response.bytes.toString('utf8'));
        if (!isWeChatImage(article.cover)) throw new Error('文章封面不是受支持的微信图片地址');
        remember(articleUrl, article, 10 * 60 * 1000);
      }
      return json(res, 200, { success: true, ...article, cover: '/api/image?url=' + encodeURIComponent(article.cover) });
    }
    if (url.pathname === '/api/image') {
      const target = url.searchParams.get('url');
      if (!isWeChatImage(target)) return json(res, 400, { error: '图片地址无效' });
      let image = cached(target);
      if (!image) {
        image = await request(target, isWeChatImage, 5 * 1024 * 1024);
        if (!/^image\/(?:jpeg|png|webp|gif)(?:;|$)/i.test(image.contentType)) throw new Error('微信没有返回有效封面图片');
        remember(target, image, 30 * 60 * 1000);
      }
      res.writeHead(200, { 'Content-Type': image.contentType, 'Cache-Control': 'public, max-age=1800', 'X-Content-Type-Options': 'nosniff' }); return res.end(image.bytes);
    }
    if (url.pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
    const file = files.get(url.pathname); if (!file) return json(res, 404, { error: '页面不存在' });
    res.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': 'no-cache' }); res.end(await readFile(new URL(file[0], root)));
  } catch (error) {
    console.error('[读取失败]', error.message, error.cause?.code || '');
    json(res, 502, { success: false, error: error.message });
  }
});
function openBrowser() {
  if (process.argv.includes('--open') && process.platform === 'win32') execFile('powershell.exe', ['-NoProfile', '-Command', `Start-Process 'http://localhost:${port}'`], { windowsHide: true }, error => { if (error) console.error('请在浏览器打开上面的地址。'); });
}
function isExistingTool(checkPort) {
  // Connect directly: system HTTP proxies must not interfere with the local health check.
  return new Promise(resolve => {
    const socket = connect({ host: '127.0.0.1', port: checkPort });
    let response = '', settled = false;
    const finish = value => { if (settled) return; settled = true; socket.destroy(); resolve(value); };
    socket.setTimeout(1500, () => finish(false));
    socket.on('connect', () => socket.write('GET /api/health HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n'));
    socket.on('data', chunk => {
      response += chunk.toString();
      if (response.length > 16384) return finish(false);
      if (/^HTTP\/1\.[01] 200\b/.test(response) && /"service"\s*:\s*"wechat-moment-detail-maker"/.test(response.split('\r\n\r\n').slice(1).join('\r\n\r\n'))) finish(true);
    });
    socket.on('end', () => finish(false));
    socket.on('close', () => finish(false));
    socket.on('error', () => finish(false));
  });
}
server.on('listening', () => {
  console.log(`朋友圈详情图制作：http://localhost:${port}`);
  openBrowser();
  for (const list of Object.values(networkInterfaces())) for (const item of list || []) if (item.family === 'IPv4' && !item.internal) console.log(`同一 Wi-Fi 的手机访问：http://${item.address}:${port}`);
});
server.on('error', async error => {
  if (error.code === 'EADDRINUSE' && process.env.NODE_ENV !== 'production') {
    if (await isExistingTool(port)) {
      console.log(`工具已经运行，直接打开：http://localhost:${port}`);
      openBrowser();
      return;
    }
    if (port - initialPort < 20 && port < 65535) {
      console.log(`端口 ${port} 被其他程序占用，尝试 ${port + 1}…`);
      port++;
      server.listen(port, '0.0.0.0');
      return;
    }
  }
  console.error('启动失败：', error.message);
  process.exitCode = 1;
});
server.listen(port, '0.0.0.0');
