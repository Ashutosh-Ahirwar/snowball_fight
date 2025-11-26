// app/api/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { saveUserToken } from '@/lib/db';

export async function POST(req: NextRequest) {
  const requestJson = await req.json();

  if (requestJson.event === 'miniapp_added') {
    const { token, url } = requestJson.notificationDetails;
    
    // In a real app, you'd extract the real FID from the signature.
    // For this MVP, we use a placeholder or rely on the /register endpoint.
    // We pass "unknown" as the username to satisfy the new 4-argument requirement.
    
    // Example placeholder FID (Replace with real logic if needed)
    const userFid = 0; 

    // FIX: Added "unknown" as the 2nd argument (username)
    await saveUserToken(userFid, "unknown", token, url);
  }

  return NextResponse.json({ success: true });
}