// app/api/register/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { saveUserToken } from '@/lib/db';

export async function POST(req: NextRequest) {
  const { fid, username, token, url } = await req.json();
  
  if (!fid || !username || !token || !url) {
    return NextResponse.json({ error: 'Missing data' }, { status: 400 });
  }

  await saveUserToken(fid, username, token, url);
  
  return NextResponse.json({ success: true });
}
