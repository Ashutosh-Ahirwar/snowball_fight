'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import sdk from '@farcaster/miniapp-sdk';
import Snowfall from 'react-snowfall';
import {
  Snowflake,
  Gift,
  Bookmark,
  User,
  Send,
  Trophy,
  Flame,
} from 'lucide-react';

/**
 * NOTE:
 * This page is the MAIN game screen:
 * - choose target
 * - throw snowballs
 * - see your rank + SPP summary
 * The full leaderboard is now on /leaderboard
 */

export default function Home() {
  const [mode, setMode] = useState<'IDLE' | 'HIT' | 'PILE_ON'>('IDLE');
  const [aggressor, setAggressor] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [isAdded, setIsAdded] = useState<boolean>(false);
  const [inviteTarget, setInviteTarget] = useState<string>('');
  const [targetUsername, setTargetUsername] = useState<string>('');
  const [isDonating, setIsDonating] = useState<boolean>(false);

  // Add miniapp popup
  const [showAddPrompt, setShowAddPrompt] = useState<boolean>(false);
  const [isAdding, setIsAdding] = useState<boolean>(false);

  // Snow Power Points (SPP) for the CURRENT user
  const [points, setPoints] = useState<number>(0);

  // --- Rank helpers ---

  const getRank = (pts: number) => {
    if (pts >= 200) return '👑 Blizzard Overlord';
    if (pts >= 120) return '🧊 Arctic Menace';
    if (pts >= 60) return '🌪 Snowstorm Bringer';
    if (pts >= 25) return '🌬 Frosty Brawler';
    if (pts >= 10) return '🤺 Rookie Thrower';
    return '❄️ Fresh Snowflake';
  };

  const getNextRankGoal = (pts: number) => {
    if (pts >= 200) return { label: 'Max Rank', needed: 0, target: 200 };
    if (pts >= 120) return { label: 'Blizzard Overlord', needed: 200 - pts, target: 200 };
    if (pts >= 60) return { label: 'Arctic Menace', needed: 120 - pts, target: 120 };
    if (pts >= 25) return { label: 'Snowstorm Bringer', needed: 60 - pts, target: 60 };
    if (pts >= 10) return { label: 'Frosty Brawler', needed: 25 - pts, target: 25 };
    return { label: 'Rookie Thrower', needed: 10 - pts, target: 10 };
  };

  const nextRank = getNextRankGoal(points);
  const progressToNextRank =
    nextRank.target === 0 ? 1 : Math.min(1, points / nextRank.target);

  // --- Helper: fetch user’s current points from leaderboard API ---

  const loadUserPoints = useCallback(
    async (uname: string) => {
      try {
        const res = await fetch(
          `/api/leaderboard?user=${encodeURIComponent(uname)}`,
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data.user && typeof data.user.points === 'number') {
          setPoints(data.user.points);
        }
      } catch (e) {
        console.error('Failed to load user points', e);
      }
    },
    [],
  );

  // --- Add miniapp & register notification token ---

  const handleRegister = useCallback(async () => {
    try {
      setIsAdding(true);
      setStatus('🎁 Adding to your miniapps...');

      const result = await sdk.actions.addMiniApp();

      if (result && 'notificationDetails' in result && result.notificationDetails) {
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
      }

      setIsAdded(true);
      setShowAddPrompt(false);
      setStatus('✅ Added! You can now get hit back & earn full SPP.');
      sdk.haptics.notificationOccurred('success');
    } catch (e) {
      console.error('addMiniApp error', e);
      setStatus('❌ Could not add miniapp here. Try opening from the Miniapps tab.');
      sdk.haptics.notificationOccurred('error');
    } finally {
      setIsAdding(false);
    }
  }, []);

  // --- Initial miniapp context + mode setup ---

  useEffect(() => {
    const init = async () => {
      const context = await sdk.context;
      const uname = context.user.username || 'Elf';
      setUsername(uname);
      setIsAdded(context.client.added);

      if (!context.client.added) {
        setShowAddPrompt(true);
      }

      // Mode detection:
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

      // Load the user's current SPP from backend
      loadUserPoints(uname);
    };
    init();
  }, [handleRegister, loadUserPoints]);

  // --- Throw snowball: main action ---

  const throwSnowball = async (targetUsernameLocal: string) => {
    if (!targetUsernameLocal) return;

    setInviteTarget('');
    sdk.haptics.impactOccurred('light');

    const cleanTarget = targetUsernameLocal.replace('@', '').trim();
    setStatus(`❄️ Launching snowball at @${cleanTarget}...`);

    const res = await fetch('/api/throw', {
      method: 'POST',
      body: JSON.stringify({ targetUsername: cleanTarget, senderName: username }),
    });

    let data: any = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }

    if (res.ok) {
      sdk.haptics.notificationOccurred('success');

      const awarded =
        typeof data.pointsAwarded === 'number' ? data.pointsAwarded : 1;
      const serverTotal =
        typeof data.totalPoints === 'number' ? data.totalPoints : null;

      // Prefer total from backend (authoritative), fall back to local add
      setPoints(prev => (serverTotal !== null ? serverTotal : prev + awarded));

      let msg = `🎯 Direct hit! +${awarded} SPP`;
      if (typeof data.streak === 'number' && data.streak > 1) {
        msg += ` • 🔥 Streak x${data.streak}`;
      }
      if (!isAdded) {
        msg +=
          ' ⚠️ Add Snowball Fight to your Miniapps so friends can hit you back & you can climb the board.';
      }

      setStatus(msg);
    } else {
      sdk.haptics.notificationOccurred('warning');
      if (res.status === 404) {
        setStatus(`❌ Missed! @${cleanTarget} isn’t playing yet.`);
        setInviteTarget(cleanTarget);
      } else {
        setStatus(`❌ ${data.error || 'Missed!'}`);
      }
    }
  };

  // --- Donation button ---

  const donate = async () => {
    try {
      setIsDonating(true);
      setStatus('☕ Opening Santa’s tip jar...');

      await sdk.actions.sendToken({
        recipientAddress: '0xa6dee9fde9e1203ad02228f00bf10235d9ca3752',
        amount: '5000000000000000', // 0.005 ETH in wei
        token: 'eip155:8453/native', // Base mainnet native token
      });

      sdk.haptics.notificationOccurred('success');
      setStatus('✅ Donation sent! Santa says thanks 🎅');
    } catch (e) {
      console.error(e);
      sdk.haptics.notificationOccurred('error');
      setStatus('❌ Donation cancelled');
    } finally {
      setIsDonating(false);
    }
  };

  // --- Invite cast for non-registered targets ---

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

  // === HIT SCREEN ===

  if (mode === 'HIT') {
    return (
      <div className="relative flex flex-col items-center justify-center h-screen bg-slate-950 text-white p-4 overflow-hidden">
        <Snowfall snowflakeCount={240} />
        <div className="relative z-10 max-w-sm w-full text-center space-y-5">
          <div className="text-7xl">🥶</div>
          <h1 className="text-3xl font-bold">You got hit!</h1>
          <p className="text-xs text-slate-300">
            Someone just pelted you with a snowball. Clean up & send one back to earn SPP.
          </p>
          {!isAdded && (
            <p className="text-[11px] text-amber-200/90">
              ⚠️ Add Snowball Fight to your Miniapps to keep receiving hits & build streaks.
            </p>
          )}
          <button
            onClick={() => setMode('IDLE')}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-semibold shadow-lg active:translate-y-0.5 transition"
          >
            Wipe Face & Retaliate 😤
          </button>
        </div>
      </div>
    );
  }

  // === PILE-ON SCREEN ===

  if (mode === 'PILE_ON') {
    return (
      <div className="relative flex flex-col h-screen bg-slate-950 text-white overflow-hidden">
        <Snowfall snowflakeCount={200} />
        <div className="relative z-10 flex-grow flex flex-col items-center justify-center p-5">
          <div className="w-full max-w-md space-y-5">
            <div className="text-center space-y-1">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                Pile-on Mode
              </p>
              <h1 className="text-2xl font-bold">
                Freeze{' '}
                <span className="text-amber-300">@{aggressor}</span>
              </h1>
              <p className="text-xs text-slate-300">
                Join the raid on this cast and earn bonus SPP for pile-on hits.
              </p>
            </div>

            {!isAdded && (
              <div className="bg-amber-900/40 border border-amber-400/60 text-amber-100 text-[11px] rounded-xl px-3 py-2 text-center">
                ⚠️ Add Snowball Fight to your Miniapps to get hit back & build your streak.
              </div>
            )}

            <button
              onClick={() => throwSnowball(aggressor)}
              className="w-full py-3 bg-gradient-to-r from-rose-500 to-amber-400 text-white rounded-xl text-base font-semibold shadow-xl active:scale-[0.98] transition flex items-center justify-center gap-2"
            >
              <Snowflake className="w-4 h-4" /> Throw Snowball
            </button>
          </div>
        </div>
      </div>
    );
  }

  // === MAIN IDLE SCREEN ===

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-50 pb-8 overflow-hidden">
      <Snowfall color="#e5e7eb" snowflakeCount={120} />

      <div className="relative z-10 px-4 pt-4 max-w-md mx-auto space-y-4">
        {/* HEADER: miniapp name + add status */}
        <div className="bg-gradient-to-r from-red-600 to-rose-500 text-white px-4 py-3 rounded-2xl flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
              <Snowflake className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Snowball Fight</h1>
              <p className="text-[11px] text-red-50/90">
                Logged in as <span className="font-medium">@{username}</span>
              </p>
            </div>
          </div>
          {!isAdded ? (
            <button
              onClick={() => setShowAddPrompt(true)}
              disabled={isAdding}
              className="flex items-center gap-1 text-[10px] font-semibold bg-white/15 hover:bg-white/25 disabled:opacity-50 px-3 py-1.5 rounded-full border border-white/30"
            >
              <Bookmark className="w-3 h-3" />
              {isAdding ? 'Adding…' : 'Add'}
            </button>
          ) : (
            <span className="text-[10px] font-semibold px-3 py-1.5 rounded-full bg-white/15 border border-white/30">
              ✅ Saved
            </span>
          )}
        </div>

        {/* STATUS BUBBLE */}
        {status && (
          <div className="bg-slate-900/80 border border-slate-700 text-white text-xs text-center py-2 px-4 rounded-xl shadow">
            {status}
          </div>
        )}

        {/* MAIN CARD: rank + target input */}
        <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-4 shadow-lg space-y-4">
          {/* Rank header */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                Choose your target
              </p>
              <p className="text-[11px] text-slate-400">
                Hit back, start beefs, and farm Snow Power Points.
              </p>
            </div>
            <div className="text-right text-[11px]">
              <p className="flex items-center justify-end gap-1 text-slate-400">
                <Trophy className="w-3 h-3" /> Rank
              </p>
              <p className="font-semibold text-slate-100">
                {getRank(points)}
              </p>
              <p className="text-slate-400">
                SPP:{' '}
                <span className="font-semibold text-slate-100">
                  {points}
                </span>
              </p>
            </div>
          </div>

          {/* Progress bar to next rank */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <Flame className="w-3 h-3" />
                Next: {nextRank.label}
              </span>
              {nextRank.needed > 0 && (
                <span className="font-semibold text-slate-200">
                  {nextRank.needed} SPP to go
                </span>
              )}
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-1.5 rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-cyan-300 transition-all"
                style={{ width: `${progressToNextRank * 100}%` }}
              />
            </div>
          </div>

          {/* Target input + launch button */}
          <div className="space-y-2">
            <label
              htmlFor="targetUsername"
              className="text-[11px] font-medium text-slate-300"
            >
              Target username
            </label>
            <input
              type="text"
              id="targetUsername"
              value={targetUsername}
              onChange={e => setTargetUsername(e.target.value)}
              placeholder="e.g. dwr"
              autoCapitalize="none"
              className="w-full px-3 py-3 bg-slate-950 border border-slate-700 rounded-xl text-sm focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400/50 placeholder:text-slate-500"
            />
            <button
              onClick={() => throwSnowball(targetUsername.trim())}
              disabled={!targetUsername.trim()}
              className="w-full py-3 bg-gradient-to-r from-rose-500 to-amber-400 text-white rounded-xl text-sm font-semibold shadow-xl active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-2 transition"
            >
              <Snowflake className="w-4 h-4" /> Launch Snowball
            </button>
          </div>

          {/* Invite flow when target hasn't added app */}
          {inviteTarget && (
            <div className="mt-2 pt-3 border-t border-slate-700/70">
              <div className="bg-amber-900/40 border border-amber-500/50 rounded-xl p-3 space-y-2">
                <p className="text-[11px] text-amber-100 text-center">
                  @{inviteTarget} isn&apos;t playing yet. Cast an invite to drag them into the snow.
                </p>
                <button
                  onClick={inviteUser}
                  className="w-full py-2.5 bg-amber-400 hover:bg-amber-300 text-amber-950 rounded-lg text-[11px] font-semibold shadow-md flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" /> Cast an Invite
                </button>
              </div>
            </div>
          )}
        </div>

        {/* LINK TO LEADERBOARD PAGE */}
        <Link
          href="/leaderboard"
          className="flex items-center justify-between bg-slate-900/80 border border-slate-700 rounded-2xl px-4 py-3 text-xs shadow"
        >
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-300" />
            <div>
              <p className="font-semibold text-slate-100">
                Global Iceboard
              </p>
              <p className="text-[11px] text-slate-400">
                View top 20 players and your full rank.
              </p>
            </div>
          </div>
          <span className="text-[11px] text-slate-300">Open</span>
        </Link>

        {/* DONATE CARD */}
        <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-4 shadow flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-300 uppercase tracking-[0.16em]">
            <Gift className="w-4 h-4" />
            Support the arena
          </div>
          <p className="text-[11px] text-slate-400 text-center">
            Help keep the snow machines running. A tiny tip, big Christmas spirit.
          </p>
          <button
            onClick={donate}
            disabled={isDonating}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-yellow-950 rounded-full text-[11px] font-semibold shadow-md active:scale-[0.97] transition"
          >
            <Gift className="w-4 h-4" />
            {isDonating ? 'Processing...' : 'Buy Santa a Coffee'}
          </button>
        </div>
      </div>

      {/* ADD MINIAPP MODAL */}
      {showAddPrompt && !isAdded && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60">
          <div className="bg-slate-900 text-slate-50 w-full max-w-xs mx-6 rounded-2xl p-4 shadow-2xl border border-slate-700/80">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-xl bg-slate-800 flex items-center justify-center">
                <Bookmark className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-semibold">Save Snowball Fight?</h2>
            </div>
            <p className="text-[11px] text-slate-400 mb-4">
              Add this miniapp to your collection so you can launch snowballs from the Miniapps tab
              and receive full notifications + SPP.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleRegister}
                disabled={isAdding}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-red-500 hover:bg-red-400 disabled:opacity-60 text-white shadow-md active:scale-[0.98] transition"
              >
                {isAdding ? 'Adding…' : 'Add to Miniapps'}
              </button>
              <button
                onClick={() => setShowAddPrompt(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600 active:scale-[0.98] transition"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
