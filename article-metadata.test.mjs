import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArticleHtml, normalizeArticleUrl, isWeChatImage } from './article-metadata.mjs';

test('拒绝代理返回的英文平台页和验证页', () => {
  for (const title of ['Weixin Official Accounts Platform', 'WeChat Official Accounts Platform', '微信公众平台']) {
    assert.throws(() => parseArticleHtml(`<meta property="og:title" content="${title}"><meta property="og:image" content="https://res.wx.qq.com/logo.png">`), /验证页或平台页/);
  }
  assert.throws(() => parseArticleHtml('<title>Weixin Official Accounts Platform</title><div>完成验证后即可继续访问</div>'), /验证页或平台页/);
});
test('解析真实微信字段中的 htmlDecode 公众号名称，不误用个人作者', () => {
  const article = parseArticleHtml(`<meta name="author" content="个人作者"><script>var msg_title = '含有 \\' 引号 &amp; 中文的文章'.html(false); var msg_cdn_url = "https://mmbiz.qpic.cn/a/0?wx_fmt=jpeg&amp;x=1"; var nickname = htmlDecode("公众号名称");</script>`);
  assert.equal(article.title, "含有 ' 引号 & 中文的文章");
  assert.equal(article.source, '公众号名称');
  assert.equal(article.cover, 'https://mmbiz.qpic.cn/a/0?wx_fmt=jpeg&x=1');
});
test('兼容文章元数据与 js_name，不将正文第一张图片作为封面', () => {
  assert.deepEqual(parseArticleHtml('<meta content="文章标题" property="og:title"><meta property="og:image" content="https://mmbiz.qpic.cn/cover"><a id="js_name">  示例公众号 </a><img src="https://mmbiz.qpic.cn/body">'), { title: '文章标题', cover: 'https://mmbiz.qpic.cn/cover', source: '示例公众号' });
  assert.throws(() => parseArticleHtml('<meta property="og:title" content="文章标题"><a id="js_name">示例公众号</a><img src="https://mmbiz.qpic.cn/body">'), /完整/);
});
test('仅接受微信文章与微信图片地址', () => {
  assert.equal(normalizeArticleUrl('https://mp.weixin.qq.com/s/example#x'), 'https://mp.weixin.qq.com/s/example');
  assert.equal(normalizeArticleUrl('https://mp.weixin.qq.com/s?__biz=x&amp;mid=y'), 'https://mp.weixin.qq.com/s?__biz=x&mid=y');
  for (const url of ['https://mp.weixin.qq.com.example.org/s/a', 'http://127.0.0.1/s/a', 'https://mp.weixin.qq.com:444/s/a', 'https://mp.weixin.qq.com@127.0.0.1/s/a']) assert.throws(() => normalizeArticleUrl(url));
  assert.equal(isWeChatImage('https://mmbiz.qpic.cn/a/0'), true);
  assert.equal(isWeChatImage('https://mmbiz.qpic.cn.example.org/a'), false);
});
