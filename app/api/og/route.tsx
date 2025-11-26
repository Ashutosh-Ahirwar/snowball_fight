// app/api/og/route.ts
import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const user = searchParams.get('user') || 'Someone';
  const mode = searchParams.get('mode') || 'invite'; // 'invite' or 'hit'

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: mode === 'hit' ? '#0f172a' : '#b91c1c', // Slate-900 or Red-700
          color: 'white',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
          padding: '40px',
          textAlign: 'center',
        }}
      >
        {mode === 'hit' ? (
          <>
            <div style={{ fontSize: 80, marginBottom: 20 }}>🥶 SPLAT!</div>
            <div style={{ fontSize: 40, fontWeight: 'bold' }}>{user} got iced!</div>
            <div style={{ fontSize: 24, marginTop: 20, opacity: 0.9 }}>
              Tap to throw back & farm Snow Power Points ❄️
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 80, marginBottom: 20 }}>🎄</div>
            <div style={{ fontSize: 50, fontWeight: 'bold' }}>Snowball Fight</div>
            <div style={{ fontSize: 30, marginTop: 20 }}>
              {user} wants to battle for Snow Power Points!
            </div>
          </>
        )}
      </div>
    ),
    {
      width: 1200,
      height: 800,
    },
  );
}
