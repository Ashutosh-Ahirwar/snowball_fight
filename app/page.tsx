'use client';

import { useEffect, useState, useCallback } from 'react';
import sdk from '@farcaster/miniapp-sdk';
import Snowfall from 'react-snowfall';
import { Snowflake, Gift, Bookmark, User, Send } from 'lucide-react';

export default function Home() {
  const [mode, setMode] = useState<'IDLE' | 'HIT' | 'PILE_ON'>('IDLE');
  const [aggressor, setAggressor] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [isAdded, setIsAdded] = useState<boolean>(false);
  const [inviteTarget, setInviteTarget] = useState<string>('');

  const handleRegister = useCallback(async () => {
    try {
      setStatus('🎁 Adding to collection...');
      const result = await sdk.actions.addMiniApp();
      
      if (result.notificationDetails) {
        const context = await sdk.context;
        await fetch('/api/register', {
          method: 'POST',
          body: JSON.stringify({
            fid: context.user.fid,
            username: context.user.username || 'anonymous',
            token: result.notificationDetails.token,
            url: result.notificationDetails.url
          })
        });
        setIsAdded(true);
        setStatus('✅ Added! You are registered in the phonebook.');
      }
    } catch (e) {
      setStatus('');
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const context = await sdk.context;
      setUsername(context.user.username || 'Elf');
      setIsAdded(context.client.added);

      if (!context.client.added) handleRegister();

      // --- HANDLE SHARED CARD CLICKS ---
      if (context.location?.type === 'cast_embed') {
        const embedUrl = new URL(context.location.embed); 
        const referrer = embedUrl.searchParams.get('referrer');
        // If they clicked a card, put them in "Pile On" mode against the referrer
        if (referrer) {
           setMode('PILE_ON');
           setAggressor(referrer);
        }
      }
      else if (context.location?.type === 'notification') {
        setMode('HIT');
        sdk.haptics.impactOccurred('heavy');
      } 
      else if (context.location?.type === 'cast_share') {
        setMode('PILE_ON');
        setAggressor(context.location.cast.author.username || 'Grinch');
      }

      sdk.actions.ready();
    };
    init();
  }, [handleRegister]);

  // ... throwSnowball and donate functions remain exactly the same ...
  const throwSnowball = async (targetUsername: string) => {
    if (!targetUsername) return;
    setInviteTarget('');
    sdk.haptics.impactOccurred('light');
    setStatus(`❄️ Launching snowball at @${targetUsername}...`);
    
    const res = await fetch('/api/throw', {
      method: 'POST',
      body: JSON.stringify({ targetUsername, senderName: username }),
    });
    const data = await res.json();

    if (res.ok) {
      sdk.haptics.notificationOccurred('success');
      setStatus('🎯 Bullseye! Direct hit.');
    } else {
      sdk.haptics.notificationOccurred('warning');
      if (res.status === 404) {
        setStatus(`❌ Missed! @${targetUsername} isn't playing yet.`);
        setInviteTarget(targetUsername);
      } else {
        setStatus(`❌ ${data.error || 'Missed!'}`);
      }
    }
  };

  const donate = async () => {
    try {
      await sdk.actions.sendToken({
        recipientAddress: '0xa6dee9fde9e1203ad02228f00bf10235d9ca3752',
        amount: '5000000000000000', 
        token: 'eip155:8453/native', 
      });
      sdk.haptics.notificationOccurred('success');
    } catch (e) { console.log('Donation cancelled'); }
  };

  // --- UPDATED INVITE LOGIC ---
  const inviteUser = async () => {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    // Generate dynamic share URL
    const shareUrl = `${appUrl}/share?user=${username}&mode=invite`;

    try {
      await sdk.actions.composeCast({
        text: `Hey @${inviteTarget}, come fight me! ❄️`,
        embeds: [shareUrl] // Shares the dynamic card!
      });
      setInviteTarget('');
      setStatus('📨 Challenge sent!');
    } catch (e) {
      console.error(e);
    }
  };

  // ... Render logic remains the same ...
  if (mode === 'HIT') {
    return (
      <div className="relative flex flex-col items-center justify-center h-screen bg-slate-900 text-white p-4 overflow-hidden">
        <Snowfall snowflakeCount={400} />
        <div className="z-10 text-center space-y-6">
          <div className="text-8xl animate-bounce drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">🥶</div>
          <h1 className="text-5xl font-black text-red-500 tracking-tighter drop-shadow-lg">YOU GOT HIT!</h1>
          <button onClick={() => setMode('IDLE')} className="w-full py-4 bg-green-600 text-white rounded-xl font-bold shadow-lg border-b-4 border-green-800 active:border-b-0 active:translate-y-1 transition-all">
            Wipe Face & Retaliate 😤
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'PILE_ON') {
    return (
      <div className="relative p-4 flex flex-col h-screen bg-red-950 text-white overflow-hidden">
        <Snowfall color="#ffcccc" />
        <div className="z-10 flex-grow flex flex-col items-center justify-center space-y-6">
          <h1 className="text-3xl font-bold text-center leading-tight">
            Pile on <span className="text-yellow-400">@{aggressor}</span>!
          </h1>
          <div className="bg-red-900/50 p-3 rounded-lg border border-red-800">
            <p className="text-sm text-red-200">Everyone is throwing snowballs at this cast!</p>
          </div>
          <button onClick={() => throwSnowball(aggressor)} className="w-full py-8 bg-white text-red-600 rounded-3xl text-2xl font-black shadow-lg border-4 border-red-200 active:scale-95 transition">
             THROW SNOWBALL ❄️
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-10">
      <Snowfall color="#cbd5e1" snowflakeCount={100} />
      <div className="bg-red-600 text-white p-4 shadow-lg rounded-b-3xl mb-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/snow.png')]"></div>
        <div className="relative z-10 flex justify-between items-center">
          <h1 className="text-2xl font-black italic tracking-tight flex items-center gap-2">
            <Snowflake className="w-6 h-6" /> Snowball Fight
          </h1>
          {!isAdded && (
            <button onClick={handleRegister} className="flex items-center gap-1 text-xs font-bold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full transition border border-white/30">
              <Bookmark className="w-3 h-3" /> Bookmark App
            </button>
          )}
        </div>
      </div>

      <div className="px-4 max-w-md mx-auto space-y-6 relative z-10">
        {status && (
          <div className="animate-fade-in bg-slate-800 text-white text-center py-2 px-4 rounded-full text-sm font-medium shadow-md border border-slate-700">
            {status}
          </div>
        )}

        <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100">
          <div className="flex items-center gap-2 mb-4 text-red-600">
             <User className="w-5 h-5" />
             <h2 className="font-bold text-lg">Who is the target?</h2>
          </div>
          <input type="text" id="targetUsername" placeholder="Enter username (e.g. dwr)" className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl mb-4 text-lg focus:outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition placeholder:text-slate-400" autoCapitalize="none" />
          <button onClick={() => { const val = (document.getElementById('targetUsername') as HTMLInputElement).value; throwSnowball(val); }} className="w-full py-4 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white rounded-2xl font-bold text-lg shadow-lg shadow-red-500/30 active:scale-95 transition flex items-center justify-center gap-2">
            Launch Snowball ❄️
          </button>

          {inviteTarget && (
            <div className="mt-4 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2">
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                <p className="text-sm text-amber-800 font-medium mb-3 text-center">@{inviteTarget} isn't playing yet. Call them out?</p>
                <button onClick={inviteUser} className="w-full py-3 bg-amber-400 hover:bg-amber-500 text-amber-950 rounded-lg font-bold shadow-sm transition flex items-center justify-center gap-2">
                  <Send className="w-4 h-4" /> Cast Invite
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="pt-8 text-center">
          <button onClick={donate} className="group inline-flex items-center justify-center gap-2 px-6 py-3 bg-yellow-400 text-yellow-900 rounded-full font-bold text-sm hover:bg-yellow-300 transition shadow-lg shadow-yellow-400/20 active:scale-95">
            <Gift className="w-4 h-4 group-hover:animate-bounce" /> Buy Santa a Coffee
          </button>
          <p className="text-slate-400 text-xs mt-4 font-medium">Built for Farcaster Holidays 🎄</p>
        </div>
      </div>
    </div>
  );
}