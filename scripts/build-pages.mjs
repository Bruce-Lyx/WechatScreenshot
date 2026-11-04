import { readFile, writeFile, mkdir, copyFile, cp } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const out = new URL('dist/', root);
let apiBaseUrl = (process.env.ARTICLE_API_URL || '').trim();
if (apiBaseUrl) {
  const url = new URL(apiBaseUrl);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('ARTICLE_API_URL 请填写完整 HTTPS 服务域名，不包含 /api 路径');
  apiBaseUrl = url.origin;
}
await mkdir(out, { recursive: true });
let html = await readFile(new URL('index.html', root), 'utf8');
const marker = 'const deploymentConfig={"apiBaseUrl":""};';
if (!html.includes(marker)) throw new Error('页面部署配置标记缺失');
html = html.replace(marker, 'const deploymentConfig=' + JSON.stringify({ apiBaseUrl }) + ';');
await writeFile(new URL('index.html', out), html);
for (const file of ['manifest.webmanifest', 'sw.js', 'LICENSE']) await copyFile(new URL(file, root), new URL(file, out));
await cp(new URL('icons/', root), new URL('icons/', out), { recursive: true });
await writeFile(new URL('.nojekyll', out), '');
console.log('GitHub Pages 网页已生成到 dist/。');
console.log(apiBaseUrl ? '已写入在线读取服务地址：' + apiBaseUrl : '尚未设置 ARTICLE_API_URL；网页仍可手动制图，也可在网页设置中填写服务地址。');
