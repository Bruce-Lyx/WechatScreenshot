import { setTimeout as sleep } from 'node:timers/promises';

const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const retryableStatuses = new Set([408, 429, 500, 502, 503, 504]);

function transientNetworkError(error) {
  if (error?.name === 'TimeoutError') return true;
  if (error instanceof TypeError && /fetch failed|terminated/i.test(error.message)) return true;
  return /^(?:ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ENETUNREACH|EHOSTUNREACH|UND_ERR_CONNECT_TIMEOUT|UND_ERR_SOCKET)$/.test(error?.code || '') ||
    (error?.cause && transientNetworkError(error.cause)) || error?.errors?.some(transientNetworkError);
}

// Retry only temporary transport/HTTP failures. Validation pages and invalid URLs are not retried.
export async function requestWeChat(url, isAllowed, limit, { fetchImpl = fetch, wait = sleep, timeoutMs = 12000 } = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const signal = AbortSignal.timeout(timeoutMs);
    let target = url;
    try {
      for (let redirect = 0; redirect < 4; redirect++) {
        if (!isAllowed(target)) throw new Error('上游返回了不受支持的地址');
        const response = await fetchImpl(target, { redirect: 'manual', signal, headers: {
          'User-Agent': userAgent, 'Accept-Language': 'zh-CN,zh;q=0.9', Referer: 'https://mp.weixin.qq.com/'
        } });
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const location = response.headers.get('location');
          await response.body?.cancel();
          if (!location) throw new Error('文章跳转地址无效');
          target = new URL(location, target).href;
          continue;
        }
        if (!response.ok) {
          await response.body?.cancel();
          const error = new Error(`微信读取失败（HTTP ${response.status}），请稍后重试`);
          error.retryable = retryableStatuses.has(response.status);
          throw error;
        }
        const chunks = []; let length = 0;
        for await (const chunk of response.body) {
          length += chunk.length;
          if (length > limit) throw new Error('文章或图片超出读取大小限制');
          chunks.push(chunk);
        }
        return { bytes: Buffer.concat(chunks), contentType: response.headers.get('content-type') || '' };
      }
      throw new Error('文章跳转次数过多');
    } catch (error) {
      const timedOut = signal.aborted && signal.reason?.name === 'TimeoutError';
      const networkFailure = timedOut || transientNetworkError(error);
      if (!networkFailure && !error.retryable) throw error;
      if (attempt < 2) { await wait(300 * (attempt + 1)); continue; }
      if (!networkFailure) throw error;
      throw new Error(timedOut || error.name === 'TimeoutError'
        ? '微信响应超时，自动重试后仍未成功，请稍后重新获取'
        : '在线读取服务暂时无法连接微信，自动重试后仍未成功，请稍后重新获取', { cause: error });
    }
  }
}
