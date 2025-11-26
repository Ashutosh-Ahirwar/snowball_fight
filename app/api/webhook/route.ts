// app/api/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { saveUserToken } from '@/lib/db';

export async function POST(req: NextRequest) {
  const requestJson = await req.json();

  if (requestJson.event === 'miniapp_added') {
    const details = requestJson.notificationDetails;

    if (details?.token && details?.url) {
      // In a real app, you'd extract the real FID from the signature.
      // For this MVP, we use a placeholder or rely on the /register endpoint.
      const userFid = 0;

      await saveUserToken(userFid, 'unknown', details.token, details.url);
    }
  }

  return NextResponse.json({ success: true });
}
