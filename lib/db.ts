import Redis from 'ioredis';

// Singleton connection to prevent "Too many connections" errors
const globalForRedis = global as unknown as { redis: Redis };
export const redis = globalForRedis.redis || new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;

export interface UserData {
  token: string;
  url: string;
}

// --- FUNCTIONS ---

// 1. Save User (Export is required here!)
export async function saveUserToken(fid: number, username: string, token: string, url: string) {
  try {
    const key = `user:${fid}`;
    const usernameKey = `username:${username.toLowerCase()}`;

    // Save token
    await redis.hset(key, { token, url });
    // Save phonebook mapping
    await redis.set(usernameKey, fid);

    console.log(`✅ Saved @${username} (FID ${fid})`);
  } catch (error) {
    console.error(`❌ DB Error:`, error);
  }
}

// 2. Get FID by Username
export async function getFidByUsername(username: string): Promise<number | null> {
  if (!username) return null;
  const fid = await redis.get(`username:${username.toLowerCase()}`);
  return fid ? Number(fid) : null;
}

// 3. Get User Token
export async function getUserToken(fid: number): Promise<UserData | null> {
  const key = `user:${fid}`;
  const userData = await redis.hgetall(key);
  if (!userData || Object.keys(userData).length === 0) return null;
  return userData as unknown as UserData;
}