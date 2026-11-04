import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, access } from 'node:fs/promises';
const run = promisify(execFile);
test('Pages 构建写入读取服务地址，保留相对安装路径且不修改原文件', async () => {
  await run(process.execPath, ['scripts/build-pages.mjs'], { cwd: new URL('.', import.meta.url), env: { ...process.env, ARTICLE_API_URL: 'https://example.onrender.com/' }, windowsHide: true });
  const html = await readFile(new URL('./dist/index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('const deploymentConfig={"apiBaseUrl":"https://example.onrender.com"};'));
  assert.ok(html.includes('href="./manifest.webmanifest"'));
  assert.ok(html.includes("register('./sw.js')"));
  assert.ok((await readFile(new URL('./index.html', import.meta.url), 'utf8')).includes('const deploymentConfig={"apiBaseUrl":""};'));
  await access(new URL('./dist/icons/icon-512.png', import.meta.url));
  await access(new URL('./dist/LICENSE', import.meta.url));
});
