import { NextRequest, NextResponse } from 'next/server';
import { getUserToken, getFidByUsername } from '@/lib/db';

export async function POST(req: NextRequest) {
  const { targetUsername, senderName } = await req.json();

  // 1. Validate Input
  if (!targetUsername || !senderName) {
    return NextResponse.json({ error: "Missing target or sender" }, { status: 400 });
  }

  // 2. Resolve Username -> FID
  const cleanUsername = targetUsername.replace('@', '').trim();
  const targetFid = await getFidByUsername(cleanUsername);

  if (!targetFid) {
    return NextResponse.json({ error: `User @${cleanUsername} hasn't added the app yet!` }, { status: 404 });
  }

  // 3. Get Token
  const targetUser = await getUserToken(targetFid);
  
  if (!targetUser || !targetUser.token || !targetUser.url) {
    return NextResponse.json({ error: "User found but no valid token available." }, { status: 404 });
  }

  // 4. Construct Notification
  // FIX: Use your real domain, or fallback to the request origin
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://snowball-fight-tawny.vercel.app";
  
  const notificationBody = {
    notificationId: crypto.randomUUID(),
    title: "❄️ INCOMING!",
    body: `${senderName} threw a snowball at you!`,
    targetUrl: `${appUrl}?referrer=${encodeURIComponent(senderName)}&mode=hit`, 
    tokens: [targetUser.token]
  };

  // 5. Send to Farcaster
  try {
    const result = await fetch(targetUser.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(notificationBody)
    });

    if (!result.ok) {
       // LOG THE REAL ERROR FROM FARCASTER
       const errorBody = await result.text();
       console.error("❌ Farcaster API Error:", result.status, errorBody);
       return NextResponse.json({ error: `Farcaster Refused: ${errorBody}` }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Network Error:", e);
    return NextResponse.json({ error: "Network error" }, { status: 500 });
  }
}