// app/api/leaderboard/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/db';

type LeaderboardRow = {
  username: string;
  points: number;
  streak: number;
  badge?: string;
};

type UserInfo = {
  username: string;
  rank: number | null;
  points: number;
  streak: number;
};

/**
 * Response shape:
 * {
 *   entries: LeaderboardRow[],
 *   user: UserInfo | null
 * }
 *
 * - `entries` is the global top 20 by Snow Power Points (SPP)
 * - `user` is the requested user's global rank + total SPP + streak
 */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userParam = searchParams.get('user');
  const user = userParam ? userParam.toLowerCase() : null;

  // --- Global top 20 by SPP ---
  const raw = await redis.zrevrange('snowball:points', 0, 19, 'WITHSCORES');

  const entries: LeaderboardRow[] = [];
  for (let i = 0; i < raw.length; i += 2) {
    const username = raw[i];
    const points = Number(raw[i + 1]);
    const streak =
      Number(await redis.get(`snowball:streak:${username}`)) || 0;

    let badge = '';
    if (streak >= 5) badge = '🔥 Mega Streak';
    else if (streak >= 3) badge = '🔥 Hot Streak';

    entries.push({
      username,
      points,
      streak,
      badge: badge || undefined,
    });
  }

  // --- User-specific rank + SPP + streak (even if not in top 20) ---
  let userInfo: UserInfo | null = null;

  if (user) {
    const rank = await redis.zrevrank('snowball:points', user);
    const score = await redis.zscore('snowball:points', user);
    const streak = Number(await redis.get(`snowball:streak:${user}`)) || 0;

    userInfo = {
      username: user,
      rank: rank !== null && rank !== undefined ? rank + 1 : null, // 1-based rank
      points: score ? Number(score) : 0,
      streak,
    };
  }

  return NextResponse.json({
    entries,
    user: userInfo,
  });
}
