// Modified implementation for WechatMomentScreenshot, AGPL-3.0.
export function decodeMeta(value) {
  return String(value || '').replace(/\\u([0-9a-f]{4})/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/\\x([0-9a-f]{2})/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/\\([\\/'"])/g, '$1').replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n) => {
      const code = n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    }).replace(/&quot;/gi, '"').replace(/&apos;/gi, "'").replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').trim();
}

export function isGenericTitle(value) {
  return /^(?:weixin official accounts platform|wechat official accounts platform|微信公众平台|微信|weixin|wechat|just a moment\.?|access denied|error|验证|安全验证)$/i.test(decodeMeta(value));
}

export function normalizeArticleUrl(input) {
  let url;
  try { url = new URL(decodeMeta(input)); } catch { throw new Error('请粘贴完整的公众号文章链接'); }
  if (url.protocol !== 'https:' || url.hostname !== 'mp.weixin.qq.com' || url.port || url.username || url.password || !/^\/s(?:\/|$)/.test(url.pathname)) {
    throw new Error('仅支持 https://mp.weixin.qq.com/s 开头的公众号文章链接');
  }
  url.hash = '';
  return url.href;
}

function scriptString(html, key) {
  const patterns = [
    new RegExp('(?:\\b(?:var|let|const)\\s+|\\bwindow\\.)' + key + '\\s*=\\s*(?:htmlDecode\\s*\\(\\s*)?("(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\')', 'i'),
    new RegExp('["\']' + key + '["\']\\s*:\\s*("(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\')', 'i')
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return decodeMeta(match[1].slice(1, -1));
  }
  return '';
}

export function parseArticleHtml(html) {
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1]).join('\n');
  const meta = new Map();
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attrs = new Map();
    for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs.set(match[1].toLowerCase(), decodeMeta(match[2] ?? match[3]));
    meta.set((attrs.get('property') || attrs.get('name') || '').toLowerCase(), attrs.get('content') || '');
  }
  const title = scriptString(scripts, 'msg_title') || meta.get('og:title') || decodeMeta(html.match(/<h[12]\b[^>]*id=["']activity-name["'][^>]*>([\s\S]*?)<\/h[12]>/i)?.[1].replace(/<[^>]+>/g, ''));
  // js_name is the account name. author/og:article:author can identify an individual author instead.
  const source = decodeMeta(html.match(/<[^>]+\bid=["']js_name["'][^>]*>([\s\S]*?)<\//i)?.[1].replace(/<[^>]+>/g, '')) || scriptString(scripts, 'nickname') || scriptString(scripts, 'account_name');
  const cover = scriptString(scripts, 'msg_cdn_url') || meta.get('og:image') || '';
  if (!title || isGenericTitle(title) || /(?:环境异常|访问过于频繁|完成验证后即可继续访问|verify your identity)/i.test(title)) {
    throw new Error('微信返回了验证页或平台页，没有返回文章；请稍后重试');
  }
  if (!cover || !source) throw new Error('微信没有返回完整的文章封面和公众号名称，请稍后重试');
  return { title, cover, source };
}

export function isWeChatImage(input) {
  try {
    const u = new URL(input);
    return u.protocol === 'https:' && !u.port && !u.username && !u.password && /^(?:mmbiz\.qpic\.cn|mmbiz\.qlogo\.cn|res\.wx\.qq\.com)$/.test(u.hostname);
  } catch { return false; }
}
