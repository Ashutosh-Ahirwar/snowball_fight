// lib/db.ts
import Redis from 'ioredis';

// ---- Redis singleton (works in dev + serverless) ----
declare global {
  // eslint-disable-next-line no-var
  var _snowballRedis: Redis | undefined;
}

const redisInstance =
  global._snowballRedis ||
  new Redis(process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL || '');

if (process.env.NODE_ENV !== 'production') {
  global._snowballRedis = redisInstance;
}

export const redis = redisInstance;

// ---- Types ----

export type StoredUser = {
  fid: number;
  username: string;
  token: string;
  url: string;
};

// Key helpers
const userKey = (fid: number) => `snowball:user:${fid}`;
const usernameKey = (username: string) =>
  `snowball:username:${username.toLowerCase()}`;
const streakKey = (username: string) =>
  `snowball:streak:${username.toLowerCase()}`;
const revengeKey = (username: string) =>
  `snowball:revenge:${username.toLowerCase()}`;
const firstHitsKey = (username: string) =>
  `snowball:first_hits:${username.toLowerCase()}`;
const lastAttackKey = (username: string) =>
  `snowball:last_attack:${username.toLowerCase()}`;

// =========================
//   USER STORAGE
// =========================

/**
 * Save user's notification token + URL + username + fid.
 * Also stores username -> fid mapping for lookup by handle.
 */
export async function saveUserToken(
  fid: number,
  username: string,
  token: string,
  url: string,
): Promise<void> {
  const uname = username.toLowerCase();

  await redis.hset(userKey(fid), {
    fid: String(fid),
    username: uname,
    token,
    url,
  });

  // username -> fid mapping
  await redis.set(usernameKey(uname), String(fid));
}

/**
 * Resolve username (@handle) to fid.
 */
export async function getFidByUsername(
  username: string,
): Promise<number | null> {
  const uname = username.toLowerCase();
  const fidStr = await redis.get(usernameKey(uname));
  if (!fidStr) return null;
  const fidNum = Number(fidStr);
  return Number.isNaN(fidNum) ? null : fidNum;
}

/**
 * Get stored user notification details by fid.
 */
export async function getUserToken(
  fid: number,
): Promise<StoredUser | null> {
  const data = await redis.hgetall(userKey(fid));
  if (!data || !data.token || !data.url) return null;

  return {
    fid,
    username: data.username || '',
    token: data.token,
    url: data.url,
  };
}

// =========================
//   POINTS / STREAKS / REVENGE
// =========================

/**
 * Add Snow Power Points (SPP) to a user.
 * Uses a sorted set `snowball:points` for leaderboard.
 * Returns updated total points.
 */
export async function addPoints(
  username: string,
  points: number,
): Promise<number> {
  const uname = username.toLowerCase();
  const newScore = await redis.zincrby(
    'snowball:points',
    points,
    uname,
  );
  return Number(newScore);
}

/**
 * Increment streak counter for a user.
 * Returns the new streak value.
 *
 * Note: This does NOT consider time; use `registerHitAndGetStreak`
 * for time-decay behavior.
 */
export async function incrementStreak(
  username: string,
): Promise<number> {
  const uname = username.toLowerCase();
  const streak = await redis.incr(streakKey(uname));
  return Number(streak);
}

/**
 * Reset streak for a user.
 */
export async function resetStreak(username: string): Promise<void> {
  const uname = username.toLowerCase();
  await redis.set(streakKey(uname), '0');
}

/**
 * Time-based streak helper.
 * If the last hit is older than `decayHours`, streak resets to 0 before incrementing.
 *
 * Returns the new streak value after applying decay + increment.
 */
export async function registerHitAndGetStreak(
  username: string,
  decayHours = 24,
): Promise<number> {
  const uname = username.toLowerCase();
  const now = Date.now();
  const decayMs = decayHours * 60 * 60 * 1000;

  const lastStr = await redis.get(lastAttackKey(uname));
  if (lastStr) {
    const last = Number(lastStr);
    if (!Number.isNaN(last) && now - last > decayMs) {
      // Too old -> reset streak before counting this hit
      await resetStreak(uname);
    }
  }

  const streak = await incrementStreak(uname);
  await redis.set(lastAttackKey(uname), String(now));
  return streak;
}

/**
 * Record that `attacker` most recently hit `target`.
 * This is used to compute revenge hits.
 */
export async function recordAttackPair(
  attacker: string,
  target: string,
): Promise<void> {
  const a = attacker.toLowerCase();
  const t = target.toLowerCase();

  // "When t hits back a, we consider it revenge"
  await redis.set(revengeKey(t), a);
}

/**
 * Was the hit from `attacker` onto `target` a revenge hit?
 * We stored that "attacker was last hit by X"; if X == target => revenge.
 */
export async function wasRevengeHit(
  attacker: string,
  target: string,
): Promise<boolean> {
  const a = attacker.toLowerCase();
  const t = target.toLowerCase();

  const lastAttacker = await redis.get(revengeKey(a));
  return lastAttacker === t;
}

/**
 * Record that attacker has hit `target` at least once.
 * Used to grant "first hit" bonus.
 */
export async function recordHit(
  attacker: string,
  target: string,
): Promise<void> {
  const a = attacker.toLowerCase();
  const t = target.toLowerCase();
  await redis.sadd(firstHitsKey(a), t);
}

/**
 * Has attacker ever hit this target before?
 */
export async function hasHitBefore(
  attacker: string,
  target: string,
): Promise<boolean> {
  const a = attacker.toLowerCase();
  const t = target.toLowerCase();
  const res = await redis.sismember(firstHitsKey(a), t);
  return Number(res) === 1;
}
