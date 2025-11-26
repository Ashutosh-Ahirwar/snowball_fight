// app/api/throw/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  getUserToken,
  getFidByUsername,
  addPoints,
  registerHitAndGetStreak,
  recordAttackPair,
  wasRevengeHit,
  hasHitBefore,
  recordHit,
} from '@/lib/db';

const ADMIN_USERNAME = 'nipples.base.eth';

export async function POST(req: NextRequest) {
  const { targetUsername, senderName } = await req.json();

  if (!targetUsername || !senderName) {
    return NextResponse.json(
      { error: 'Missing target or sender' },
      { status: 400 },
    );
  }

  const cleanTarget = targetUsername.replace('@', '').trim();

  // 1. Resolve Username -> FID
  const targetFid = await getFidByUsername(cleanTarget);
  if (!targetFid) {
    return NextResponse.json(
      { error: `User @${cleanTarget} not registered` },
      { status: 404 },
    );
  }

  // 2. Get token/url for notifications
  const targetUser = await getUserToken(targetFid);
  if (!targetUser?.token || !targetUser?.url) {
    return NextResponse.json(
      { error: `User @${cleanTarget} missing notification token` },
      { status: 404 },
    );
  }

  // 3. Send notification
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const result = await fetch(targetUser.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      notificationId: crypto.randomUUID(),
      title: '❄ INCOMING!',
      body: `${senderName} hit you with a snowball!`,
      targetUrl: `${appUrl}?referrer=${encodeURIComponent(
        senderName,
      )}&mode=hit`,
      tokens: [targetUser.token],
    }),
  });

  if (!result.ok) {
    const errText = await result.text().catch(() => '');
    console.error('Farcaster notification failed:', result.status, errText);
    return NextResponse.json(
      { error: 'Notification failed' },
      { status: 500 },
    );
  }

  // 4. --- Snow Power Points (SPP) Scoring ---
  let pointsAwarded = 1; // base

  // Time-decayed streak: resets if > 24h since last hit
  const streak = await registerHitAndGetStreak(senderName, 24);
  pointsAwarded += streak; // streak bonus (grows as you keep hitting within 24h)

  // Revenge bonus: if this hit is against someone who hit you last
  if (await wasRevengeHit(senderName, cleanTarget)) {
    pointsAwarded += 2; // revenge bonus
  }

  // First time ever hitting this target → explorer bonus
  if (!(await hasHitBefore(senderName, cleanTarget))) {
    await recordHit(senderName, cleanTarget);
    pointsAwarded += 5;
  }

  // Admin penalty: hitting nipples.base.eth = bad karma 😈
  if (cleanTarget.toLowerCase() === ADMIN_USERNAME.toLowerCase()) {
    pointsAwarded -= 10;
  }

  // Make sure pointsAwarded never goes below 0
  if (pointsAwarded < 0) pointsAwarded = 0;

  // Save revenge info: target remembers who attacked them last
  await recordAttackPair(senderName, cleanTarget);

  // Update total points in leaderboard sorted set
  const totalPoints = await addPoints(senderName, pointsAwarded);

  return NextResponse.json({
    success: true,
    pointsAwarded,
    streak,
    totalPoints: Number(totalPoints),
  });
}
