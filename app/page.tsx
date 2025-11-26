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
  Info,
} from 'lucide-react';

export default function Home() {
  const [mode, setMode] = useState<'IDLE' | 'HIT' | 'PILE_ON'>('IDLE');
  const [aggressor, setAggressor] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [isAdded, setIsAdded] = useState<boolean>(false);
  const [inviteTarget, setInviteTarget] = useState<string>('');
  const [targetUsername, setTargetUsername] = useState<string>('');
  const [isDonating, setIsDonating] = useState<boolean>(false);

  const [showAddPrompt, setShowAddPrompt] = useState<boolean>(false);
  const [isAdding, setIsAdding] = useState<boolean>(false);

  // Snow Power Points for current user
  const [points, setPoints] = useState<number>(0);

  // ---- Rank helpers ----

  const getRank = (pts: number) => {
    if (pts >= 200) return 'Blizzard Overlord';
    if (pts >= 120) return 'Arctic Menace';
    if (pts >= 60) return 'Snowstorm Bringer';
    if (pts >= 25) return 'Frosty Brawler';
    if (pts >= 10) return 'Rookie Thrower';
    return 'Fresh Snowflake';
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

  // ---- Backend helpers ----

  const loadUserPoints = useCallback(async (uname: string) => {
    try {
      const res = await fetch(`/api/leaderboard?user=${encodeURIComponent(uname)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.user && typeof data.user.points === 'number') {
        setPoints(data.user.points);
      }
    } catch (e) {
      console.error('Failed to load user points', e);
    }
  }, []);

  const handleRegister = useCallback(async () => {
    try {
      setIsAdding(true);
      setStatus('Adding Snowball Fight to your miniapps...');

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
      setStatus('Added! You can now get hit back and earn full Snow Power.');
      sdk.haptics.notificationOccurred('success');
    } catch (e) {
      console.error('addMiniApp error', e);
      setStatus('Could not add miniapp here. Try from the Miniapps tab.');
      sdk.haptics.notificationOccurred('error');
    } finally {
      setIsAdding(false);
    }
  }, []);

  // ---- Init from Farcaster context ----

  useEffect(() => {
    const init = async () => {
      const context = await sdk.context;
      const uname = context.user.username || 'Elf';
      setUsername(uname);
      setIsAdded(context.client.added);

      if (!context.client.added) setShowAddPrompt(true);

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
      loadUserPoints(uname);
    };
    init();
  }, [handleRegister, loadUserPoints]);

  // ---- Actions ----

  const throwSnowball = async (targetUsernameLocal: string) => {
    if (!targetUsernameLocal) return;

    setInviteTarget('');
    sdk.haptics.impactOccurred('light');

    const cleanTarget = targetUsernameLocal.replace('@', '').trim();
    setStatus(`Launching snowball at @${cleanTarget}...`);

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

      setPoints(prev => (serverTotal !== null ? serverTotal : prev + awarded));

      let msg = `Direct hit! +${awarded} Snow Power Points.`;
      if (typeof data.streak === 'number' && data.streak > 1) {
        msg += ` Streak x${data.streak}.`;
      }
      if (!isAdded) {
        msg += ' Add Snowball Fight to your miniapps so friends can hit you back.';
      }

      setStatus(msg);
    } else {
      sdk.haptics.notificationOccurred('warning');
      if (res.status === 404) {
        setStatus(`@${cleanTarget} isn’t playing yet.`);
        setInviteTarget(cleanTarget);
      } else {
        setStatus(data.error || 'Snowball missed.');
      }
    }
  };

  const donate = async () => {
    try {
      setIsDonating(true);
      setStatus('Opening Santa’s tip jar...');

      await sdk.actions.sendToken({
        recipientAddress: '0xa6dee9fde9e1203ad02228f00bf10235d9ca3752',
        amount: '5000000000000000',
        token: 'eip155:8453/native',
      });

      sdk.haptics.notificationOccurred('success');
      setStatus('Donation sent! Santa says thanks.');
    } catch (e) {
      console.error(e);
      sdk.haptics.notificationOccurred('error');
      setStatus('Donation cancelled.');
    } finally {
      setIsDonating(false);
    }
  };

  const inviteUser = async () => {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    const shareUrl = `${appUrl}/share?user=${username}&mode=invite`;

    try {
      await sdk.actions.composeCast({
        text: `Hey @${inviteTarget}, come fight me in Snowball Fight ❄️`,
        embeds: [shareUrl],
      });
      setInviteTarget('');
      setStatus('Challenge cast posted.');
    } catch (e) {
      console.error(e);
    }
  };

  // ===== Modes =====

  if (mode === 'HIT') {
    return (
      <div className="relative flex flex-col items-center justify-center h-screen bg-slate-950 text-white p-4 overflow-hidden">
        <Snowfall snowflakeCount={220} />
        <div className="relative z-10 max-w-sm w-full text-center space-y-4">
          <div className="text-7xl">🥶</div>
          <p className="text-lg font-semibold">You got hit!</p>
          <p className="text-xs text-slate-300">
            Someone tagged you with a snowball. Throw one back to earn Snow Power Points.
          </p>
          {!isAdded && (
            <p className="text-[11px] text-amber-200">
              Add Snowball Fight to your miniapps to keep receiving hits and building streaks.
            </p>
          )}
          <button
            onClick={() => setMode('IDLE')}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-sm font-semibold shadow-md active:translate-y-0.5 transition"
          >
            Wipe Face & Retaliate
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'PILE_ON') {
    return (
      <div className="relative flex flex-col h-screen bg-slate-950 text-white overflow-hidden">
        <Snowfall snowflakeCount={200} />
        <div className="relative z-10 flex-grow flex flex-col items-center justify-center p-5">
          <div className="w-full max-w-md space-y-4">
            <div className="text-center space-y-1">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                Pile-on mode
              </p>
              <p className="text-lg font-semibold">
                Freeze <span className="text-amber-300">@{aggressor}</span>
              </p>
              <p className="text-xs text-slate-400">
                Join everyone hitting this cast and earn bonus Snow Power Points.
              </p>
            </div>

            <button
              onClick={() => throwSnowball(aggressor)}
              className="w-full py-3 bg-gradient-to-r from-rose-500 to-amber-400 text-white rounded-xl text-sm font-semibold shadow-xl active:scale-[0.98] flex items-center justify-center gap-2 transition"
            >
              <Snowflake className="w-4 h-4" /> Throw snowball
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===== Main idle screen =====

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-50 pb-8 overflow-hidden">
      <Snowfall color="#e5e7eb" snowflakeCount={100} />

      <div className="relative z-10 px-4 pt-4 max-w-md mx-auto space-y-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-rose-500 text-white px-4 py-3 rounded-2xl flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15">
              <Snowflake className="w-4 h-4" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold">Snowball Fight</p>
              <p className="text-[11px] text-red-50/80">
                @{username}
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
              Saved
            </span>
          )}
        </div>

        {/* Status */}
        {status && (
          <div className="bg-slate-900/80 border border-slate-800 text-xs text-slate-100 text-center py-2 px-4 rounded-xl shadow-sm">
            {status}
          </div>
        )}

        {/* Main card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-md space-y-4">
          {/* Rank row */}
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px]">
              <p className="text-slate-300 font-semibold">Choose your target</p>
              <p className="text-slate-500">
                Throw at a friend to earn Snow Power.
              </p>
            </div>
            <div className="text-right text-[11px] leading-tight">
              <p className="flex items-center justify-end gap-1 text-slate-400">
                <Trophy className="w-3 h-3" /> Rank
              </p>
              <p className="text-slate-100 font-semibold">
                {getRank(points)}
              </p>
              <p className="text-slate-400">
                SPP: <span className="font-semibold">{points}</span>
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <Flame className="w-3 h-3" />
                Next rank: {nextRank.label}
              </span>
              {nextRank.needed > 0 && (
                <span>{nextRank.needed} Snow Power to go</span>
              )}
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-1.5 rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-cyan-300 transition-all"
                style={{ width: `${progressToNextRank * 100}%` }}
              />
            </div>
          </div>

          {/* Target input */}
          <div className="space-y-2">
            <label
              htmlFor="targetUsername"
              className="text-[11px] font-medium text-slate-300"
            >
              Target username
            </label>
            <input
              id="targetUsername"
              type="text"
              value={targetUsername}
              onChange={e => setTargetUsername(e.target.value)}
              placeholder="e.g. dwr"
              autoCapitalize="none"
              className="w-full px-3 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400/60 placeholder:text-slate-500"
            />
            <button
              onClick={() => throwSnowball(targetUsername.trim())}
              disabled={!targetUsername.trim()}
              className="w-full py-3 bg-gradient-to-r from-rose-500 to-amber-400 text-white rounded-xl text-sm font-semibold shadow-md active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-2 transition"
            >
              <Snowflake className="w-4 h-4" />
              Launch snowball
            </button>
          </div>

          {/* Invite section */}
          {inviteTarget && (
            <div className="mt-1 pt-3 border-t border-slate-800">
              <div className="bg-amber-900/30 border border-amber-500/40 rounded-xl p-3 space-y-2">
                <p className="text-[11px] text-amber-100 text-center">
                  @{inviteTarget} hasn&apos;t added Snowball Fight yet. Cast an invite to pull them in.
                </p>
                <button
                  onClick={inviteUser}
                  className="w-full py-2.5 bg-amber-400 hover:bg-amber-300 text-amber-950 rounded-lg text-[11px] font-semibold shadow-sm flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" /> Cast invite
                </button>
              </div>
            </div>
          )}
        </div>

        {/* SPP explanation */}
        <div className="flex items-start gap-2 text-[10px] text-slate-400 bg-slate-900/70 border border-slate-800 rounded-2xl px-3 py-2">
          <Info className="w-3 h-3 mt-0.5" />
          <p>
            <span className="font-semibold">Snow Power Points (SPP)</span> are your score in
            Snowball Fight. You earn SPP from hits, streaks, revenge shots, and first-time hits on new
            players. More SPP = higher rank and better spot on the Global Iceboard.
          </p>
        </div>

        {/* Leaderboard link */}
        <Link
          href="/leaderboard"
          className="flex items-center justify-between bg-slate-900/80 border border-slate-800 rounded-2xl px-4 py-3 text-xs shadow-sm"
        >
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-300" />
            <div>
              <p className="font-semibold text-slate-100">Global Iceboard</p>
              <p className="text-[11px] text-slate-400">
                See the top 20 players and your full rank.
              </p>
            </div>
          </div>
          <span className="text-[11px] text-slate-300">Open</span>
        </Link>

        {/* Donate card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col items-center gap-2">
          <p className="text-[11px] font-semibold text-slate-300">
            Support the arena
          </p>
          <p className="text-[11px] text-slate-500 text-center">
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

      {/* Add miniapp modal */}
      {showAddPrompt && !isAdded && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60">
          <div className="bg-slate-900 text-slate-50 w-full max-w-xs mx-6 rounded-2xl p-4 shadow-2xl border border-slate-700/80">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-xl bg-slate-800 flex items-center justify-center">
                <Bookmark className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-semibold">Add Snowball Fight</h2>
            </div>
            <p className="text-[11px] text-slate-400 mb-4">
              Save this miniapp so you can launch snowballs from the Miniapps tab and receive full
              notifications (and SPP) when people hit you.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleRegister}
                disabled={isAdding}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-red-500 hover:bg-red-400 disabled:opacity-60 text-white shadow-md active:scale-[0.98] transition"
              >
                {isAdding ? 'Adding…' : 'Add to miniapps'}
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
