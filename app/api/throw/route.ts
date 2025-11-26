import { NextRequest, NextResponse } from 'next/server';
import { getUserToken, getFidByUsername } from '@/lib/db';

export async function POST(req: NextRequest) {
  const { targetUsername, senderName } = await req.json();

  // 1. Clean the username (remove @ if present)
  const cleanUsername = targetUsername.replace('@', '').trim();

  // 2. Look up the FID from the Username
  const targetFid = await getFidByUsername(cleanUsername);

  if (!targetFid) {
    return NextResponse.json({ error: `User @${cleanUsername} hasn't added the app yet!` }, { status: 404 });
  }

  // 3. Get the notification token using the FID
  const targetUser = await getUserToken(targetFid);
  
  if (!targetUser) {
    return NextResponse.json({ error: "User found but no token available." }, { status: 404 });
  }

  // 4. Send Notification
  const notificationBody = {
    notificationId: crypto.randomUUID(),
    title: "❄️ INCOMING!",
    body: `${senderName} threw a snowball at you!`,
    targetUrl: `https://your-domain.com?hit_by=${encodeURIComponent(senderName)}`,
    tokens: [targetUser.token]
  };

  try {
    const result = await fetch(targetUser.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(notificationBody)
    });

    if (!result.ok) {
       return NextResponse.json({ error: "Failed to send notification" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Network error" }, { status: 500 });
  }
}