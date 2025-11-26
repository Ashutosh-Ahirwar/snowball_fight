'use client';

import { useEffect, useState, useCallback } from 'react';
import sdk from '@farcaster/miniapp-sdk';
import Snowfall from 'react-snowfall';
import { Snowflake, Gift, Bookmark, User, Send } from 'lucide-react';
import { createWalletClient, custom, parseEther } from 'viem';
import { base } from 'viem/chains';

export default function Home() {
  const [mode, setMode] = useState<'IDLE' | 'HIT' | 'PILE_ON'>('IDLE');
  const [aggressor, setAggressor] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [isAdded, setIsAdded] = useState<boolean>(false);
  const [inviteTarget, setInviteTarget] = useState<string>('');
  const [targetUsername, setTargetUsername] = useState<string>('');

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
            url: result.notificationDetails.url,
          }),
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
        if (referrer) {
          setMode('PILE_ON');
          setAggressor(referrer);
        }
      } else if (context.location?.type === 'notification') {
        setMode('HIT');
        sdk.haptics.impactOccurred('heavy');
      } else if (context.location?.type === 'cast_share') {
        setMode('PILE_ON');
        setAggressor(context.location.cast.author.username || 'Grinch');
      }

      sdk.actions.ready();
    };
    init();
  }, [handleRegister]);

  const throwSnowball = async (targetUsernameLocal: string) => {
    if (!targetUsernameLocal) return;
    setInviteTarget('');
    sdk.haptics.impactOccurred('light');
    setStatus(`❄️ Launching snowball at @${targetUsernameLocal}...`);

    const res = await fetch('/api/throw', {
      method: 'POST',
      body: JSON.stringify({ targetUsername: targetUsernameLocal, senderName: username }),
    });
    const data = await res.json();

    if (res.ok) {
      sdk.haptics.notificationOccurred('success');
      setStatus('🎯 Bullseye! Direct hit.');
    } else {
      sdk.haptics.notificationOccurred('warning');
      if (res.status === 404) {
        setStatus(`❌ Missed! @${targetUsernameLocal} isn't playing yet.`);
        setInviteTarget(targetUsernameLocal);
      } else {
        setStatus(`❌ ${data.error || 'Missed!'}`);
      }
    }
  };

  // --- UPDATED DONATE FUNCTION ---
  const donate = async () => {
    try {
      setStatus('☕ Initiating donation...');
      
      // 1. Get the Farcaster Wallet Provider
      const provider = sdk.wallet.getEthereumProvider();
      
      // 2. Create a Viem Wallet Client
      const walletClient = createWalletClient({
        chain: base,
        transport: custom(provider),
      });

      // 3. Request Access (Connect)
      await walletClient.requestAddresses();
      
      // 4. Send Transaction (0.005 ETH)
      await walletClient.sendTransaction({
        to: '0xa6dee9fde9e1203ad02228f00bf10235d9ca3752',
        value: parseEther('0.005'), 
        chain: base,
      });

      sdk.haptics.notificationOccurred('success');
      setStatus('✅ Donation Sent! Thank you Santa 🎅');
    } catch (e) {
      console.error(e);
      sdk.haptics.notificationOccurred('error');
      setStatus('❌ Donation cancelled');
    }
  };

  const inviteUser = async () => {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    const shareUrl = `${appUrl}/share?user=${username}&mode=invite`;

    try {
      await sdk.actions.composeCast({
        text: `Hey @${inviteTarget}, come fight me! ❄️`,
        embeds: [shareUrl],
      });
      setInviteTarget('');
      setStatus('📨 Challenge sent!');
    } catch (e) {
      console.error(e);
    }
  };

  // === MODES ===

  if (mode === 'HIT') {
    return (
      <div className="relative flex flex-col items-center justify-center h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white p-4 overflow-hidden">
        <Snowfall snowflakeCount={300} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(248,113,113,0.25),_transparent)]" />
        <div className="relative z-10 max-w-sm w-full text-center space-y-6">
          <div className="text-8xl animate-bounce drop-shadow-[0_0_25px_rgba(248,250,252,0.65)]">
            🥶
          </div>
          <h1 className="text-4xl font-black tracking-tight">
            <span className="text-red-400">YOU GOT HIT</span>!
          </h1>
          <p className="text-sm text-slate-200">
            Someone just pelted you with a snowball. Clean up & send one right back.
          </p>
          <button
            onClick={() => setMode('IDLE')}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-white rounded-2xl font-bold shadow-[0_10px_30px_rgba(16,185,129,0.45)] border border-emerald-300/40 active:translate-y-0.5 transition-all"
          >
            Wipe Face & Retaliate 😤
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'PILE_ON') {
    return (
      <div className="relative flex flex-col h-screen bg-gradient-to-b from-rose-950 via-red-950 to-slate-950 text-white overflow-hidden">
        <Snowfall color="#fecaca" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(248,250,252,0.08),_transparent)]" />
        <div className="relative z-10 flex-grow flex flex-col items-center justify-center p-5">
          <div className="w-full max-w-md space-y-6">
            <div className="text-center space-y-2">
              <p className="text-xs uppercase tracking-[0.25em] text-rose-200/80">
                Snowball Alert
              </p>
              <h1 className="text-3xl font-black leading-tight">
                Pile on{' '}
                <span className="text-yellow-300 drop-shadow-[0_0_10px_rgba(252,211,77,0.6)]">
                  @{aggressor}
                </span>
                !
              </h1>
              <p className="text-sm text-rose-100/80">
                This cast is under heavy fire. Add your snowball to the storm.
              </p>
            </div>

            <div className="bg-red-900/50 backdrop-blur-md p-4 rounded-2xl border border-red-500/30 shadow-[0_18px_45px_rgba(220,38,38,0.35)]">
              <p className="text-xs font-semibold text-red-100 mb-2 flex items-center justify-center gap-2">
                <Snowflake className="w-4 h-4" />
                Live pile-on in progress
              </p>
              <p className="text-[13px] text-red-100/90">
                Everyone who taps this card helps freeze @{aggressor} a little more.
              </p>
            </div>

            <button
              onClick={() => throwSnowball(aggressor)}
              className="w-full py-4 bg-gradient-to-r from-slate-50 via-slate-100 to-slate-50 text-red-700 rounded-3xl text-xl font-black shadow-[0_18px_45px_rgba(248,250,252,0.65)] border border-slate-200/70 active:scale-95 transition flex items-center justify-center gap-2"
            >
              THROW SNOWBALL ❄️
            </button>
          </div>
        </div>
      </div>
    );
  }

  // === MAIN SCREEN ===

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50 pb-10 overflow-hidden">
      <Snowfall color="#e5e7eb" snowflakeCount={140} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(248,250,252,0.15),_transparent)]" />

      {/* Top banner */}
      <div className="relative z-10 px-4 pt-4 max-w-md mx-auto">
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-500 text-white px-4 py-3 shadow-xl rounded-3xl mb-6 flex items-center justify-between gap-3 border border-white/10 overflow-hidden">
          <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/snow.png')]" />
          <div className="relative flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/10 backdrop-blur">
              <Snowflake className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight">Snowball Fight</h1>
              <p className="text-xs text-red-50/90">
                Logged in as <span className="font-semibold">@{username}</span>
              </p>
            </div>
          </div>

          {!isAdded && (
            <button
              onClick={handleRegister}
              className="relative flex items-center gap-1 text-[10px] font-bold bg-white/15 hover:bg-white/20 px-3 py-1.5 rounded-full transition border border-white/30 shadow-sm"
            >
              <Bookmark className="w-3 h-3" />
              Bookmark
            </button>
          )}
        </div>

        {status && (
          <div className="mb-4 animate-in fade-in-0 slide-in-from-top-2 bg-slate-900/70 backdrop-blur border border-slate-700/60 text-white text-center py-2.5 px-4 rounded-2xl text-xs font-medium shadow-[0_12px_30px_rgba(15,23,42,0.7)]">
            {status}
          </div>
        )}

        {/* Main card */}
        <div className="bg-slate-900/70 backdrop-blur-xl p-5 rounded-3xl shadow-[0_20px_60px_rgba(15,23,42,0.9)] border border-slate-700/60 space-y-5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-2xl bg-slate-800 flex items-center justify-center">
                <User className="w-4 h-4 text-slate-100" />
              </div>
              <div>
                <h2 className="font-semibold text-sm uppercase tracking-[0.15em] text-slate-300">
                  Choose Your Target
                </h2>
                <p className="text-[11px] text-slate-400">
                  Hit back or start a fresh snowball beef.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label
              htmlFor="targetUsername"
              className="text-[11px] font-medium text-slate-300 uppercase tracking-[0.16em]"
            >
              Target username
            </label>
            <input
              type="text"
              id="targetUsername"
              value={targetUsername}
              onChange={(e) => setTargetUsername(e.target.value)}
              placeholder="e.g. dwr"
              autoCapitalize="none"
              className="w-full px-4 py-3.5 bg-slate-950/60 border border-slate-700 rounded-2xl text-sm focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-400/30 transition placeholder:text-slate-500"
            />
            <button
              onClick={() => throwSnowball(targetUsername.trim())}
              disabled={!targetUsername.trim()}
              className="w-full py-3.5 bg-gradient-to-r from-rose-50 via-red-500 to-amber-400 hover:from-rose-400 hover:via-red-500 hover:to-amber-300 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl font-bold text-sm shadow-[0_18px_45px_rgba(248,113,113,0.55)] active:scale-[0.98] transition flex items-center justify-center gap-2"
            >
              <Snowflake className="w-4 h-4" />
              Launch Snowball
            </button>
          </div>

          {inviteTarget && (
            <div className="mt-3 pt-4 border-t border-slate-700/70 animate-in fade-in-0 slide-in-from-top-2">
              <div className="bg-amber-50/5 border border-amber-500/40 rounded-2xl p-4 flex flex-col gap-3">
                <p className="text-xs text-amber-100 font-medium text-center">
                  @{inviteTarget} isn&apos;t playing yet. Want to drag them into the snow?
                </p>
                <button
                  onClick={inviteUser}
                  className="w-full py-3 bg-amber-400 hover:bg-amber-300 text-amber-950 rounded-xl font-bold text-xs shadow-[0_12px_30px_rgba(251,191,36,0.45)] transition flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" /> Cast an Invite
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer / Donate */}
        <div className="mt-7 text-center space-y-3">
          <button
            onClick={donate}
            className="group inline-flex items-center justify-center gap-2 px-5 py-3 bg-yellow-400 hover:bg-yellow-300 text-yellow-950 rounded-full font-semibold text-xs shadow-[0_14px_35px_rgba(250,204,21,0.6)] active:scale-95 transition border border-yellow-200/70"
          >
            <Gift className="w-4 h-4 group-hover:animate-bounce" />
            Buy Santa a Coffee
          </button>
          <p className="text-slate-500 text-[10px] font-medium tracking-[0.18em] uppercase">
            Built for Farcaster Holidays 🎄
          </p>
        </div>
      </div>
    </div>
  );
}