// app/api/leaderboard/route.ts
import { NextResponse } from 'next/server';
import { redis } from '@/lib/db';

export async function GET() {
  // Highest Snow Power Points (SPP) first
  const raw = await redis.zrevrange('snowball:points', 0, 20, 'WITHSCORES');

  const entries = [];
  for (let i = 0; i < raw.length; i += 2) {
    const username = raw[i];
    const points = Number(raw[i + 1]);
    const streak = Number(await redis.get(`snowball:streak:${username}`)) || 0;

    let badge = '';
    if (streak >= 5) badge = '🔥 Mega Streak';
    else if (streak >= 3) badge = '🔥 Hot Streak';

    entries.push({
      username,
      points,
      streak,
      badge,
    });
  }

  return NextResponse.json({ entries });
}
