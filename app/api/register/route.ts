import { NextRequest, NextResponse } from 'next/server';
import { saveUserToken } from '@/lib/db';

export async function POST(req: NextRequest) {
  // 1. Extract 'username' from the request body
  const { fid, username, token, url } = await req.json();
  
  // 2. Validate 'username' is present
  if (!fid || !username || !token || !url) {
    return NextResponse.json({ error: 'Missing data' }, { status: 400 });
  }

  // 3. Pass 'username' to the database function
  await saveUserToken(fid, username, token, url);
  
  return NextResponse.json({ success: true });
}