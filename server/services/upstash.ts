import { Redis } from '@upstash/redis';

let redisClient: Redis | null = null;

/**
 * 获取 Upstash Redis 客户端
 */
export function getRedis(): Redis | null {
  if (redisClient) return redisClient;

  const url = process.env.UPSTASH_REDIS_REST_URL || '';
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || '';

  if (!url || !token) {
    console.warn('[Upstash] 未配置 UPSTASH_REDIS_REST_URL 或 UPSTASH_REDIS_REST_TOKEN，将使用环境变量中的 Cookie');
    return null;
  }

  try {
    redisClient = new Redis({ url, token });
    console.log('[Upstash] Redis 客户端初始化成功');
    return redisClient;
  } catch (error) {
    console.error('[Upstash] Redis 客户端初始化失败:', error);
    return null;
  }
}

/**
 * 从 Upstash 获取网易云 Cookie
 * 优先获取完整 cookie，然后获取 music_u
 */
export async function getNeteaseCookie(): Promise<string> {
  const redis = getRedis();
  if (!redis) return '';

  try {
    // 尝试获取完整的 cookie
    const fullCookie = await redis.get<string>('netease:cookie');
    if (fullCookie) {
      console.log('[Upstash] 从 Redis 获取到完整 Cookie (netease:cookie)');
      return fullCookie;
    }

    // 尝试获取 bot:cookie（Bot 默认存储的 MUSIC_U 值）
    const botCookie = await redis.get<string>('bot:cookie');
    if (botCookie) {
      console.log('[Upstash] 从 Redis 获取到 bot:cookie，包装为 MUSIC_U');
      return `MUSIC_U=${botCookie}`;
    }

    // 尝试获取 music_u
    const musicU = await redis.get<string>('netease:music_u');
    if (musicU) {
      console.log('[Upstash] 从 Redis 获取到 netease:music_u');
      return `MUSIC_U=${musicU}`;
    }

    // 尝试获取 cookie:music_u
    const cookieMusicU = await redis.get<string>('cookie:music_u');
    if (cookieMusicU) {
      console.log('[Upstash] 从 Redis 获取到 cookie:music_u');
      return `MUSIC_U=${cookieMusicU}`;
    }

    console.log('[Upstash] Redis 中未找到网易云 Cookie');
    return '';
  } catch (error) {
    console.error('[Upstash] 获取 Cookie 失败:', error);
    return '';
  }
}

/**
 * 测试 Upstash 连接
 */
export async function testUpstashConnection(): Promise<{ connected: boolean; error?: string }> {
  const redis = getRedis();
  if (!redis) {
    return { connected: false, error: '未配置 Upstash' };
  }

  try {
    await redis.set('upstash:test', 'ok', { ex: 60 });
    const result = await redis.get('upstash:test');
    return { connected: result === 'ok' };
  } catch (error: any) {
    return { connected: false, error: error.message };
  }
}
