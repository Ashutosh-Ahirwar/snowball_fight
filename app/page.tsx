'use client';

import { useEffect, useState, useCallback } from 'react';
import sdk from '@farcaster/miniapp-sdk';
import Snowfall from 'react-snowfall';
import { Snowflake, Gift, Bookmark, User, Send, Trophy, Flame } from 'lucide-react';

type LeaderboardEntry = {
  username: string;
  points: number;
  streak?: number;
  badge?: string;
};

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

  // Game points + leaderboard
  const [points, setPoints] = useState<number>(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState<boolean>(false);

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

  const fetchLeaderboard = useCallback(async () => {
    try {
      setIsLoadingLeaderboard(true);
      const res = await fetch('/api/leaderboard');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.entries)) {
        setLeaderboard(data.entries);
      }
    } catch (e) {
      console.error('Failed to load leaderboard', e);
    } finally {
      setIsLoadingLeaderboard(false);
    }
  }, []);

  const handleRegister = useCallback(async () => {
    try {
      setIsAdding(true);
      setStatus('🎁 Adding to your miniapps...');

      const result = await sdk.actions.addMiniApp();
      console.log('addMiniApp result', result);

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
      setStatus('✅ Added to your miniapps! You can now get hit back & earn full SPP.');
      sdk.haptics.notificationOccurred('success');
    } catch (e) {
      console.error('addMiniApp error', e);
      setStatus('❌ Could not add miniapp here. Try opening from the Miniapps tab.');
      sdk.haptics.notificationOccurred('error');
    } finally {
      setIsAdding(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const context = await sdk.context;
      setUsername(context.user.username || 'Elf');
      setIsAdded(context.client.added);

      if (!context.client.added) {
        setShowAddPrompt(true);
      }

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
      fetchLeaderboard();
    };
    init();
  }, [handleRegister, fetchLeaderboard]);

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

      setPoints((prev) => (serverTotal !== null ? serverTotal : prev + awarded));

      let msg = `🎯 Direct hit! +${awarded} SPP`;
      if (typeof data.streak === 'number' && data.streak > 1) {
        msg += ` • 🔥 Streak x${data.streak}`;
      }
      if (!isAdded) {
        msg +=
          ' ⚠️ Add Snowball Fight to your Miniapps so friends can hit you back & you can flex on the leaderboard.';
      }
      setStatus(msg);

      fetchLeaderboard();
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
            Someone just pelted you with a snowball. Clean up & send one right back to earn SPP.
          </p>
          {!isAdded && (
            <p className="text-[11px] text-amber-200/90 mt-1">
              ⚠️ Add Snowball Fight to your Miniapps to keep receiving hits & climb the global
              leaderboard.
            </p>
          )}
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
                This cast is under heavy fire. Join the raid, earn bonus SPP for pile-on hits.
              </p>
            </div>

            {!isAdded && (
              <div className="bg-amber-900/40 border border-amber-400/60 text-amber-100 text-[11px] rounded-2xl px-3 py-2 text-center">
                ⚠️ Add Snowball Fight to your Miniapps to get hit back & farm leaderboard points.
              </div>
            )}

            <div className="bg-red-900/50 backdrop-blur-md p-4 rounded-2xl border border-red-500/30 shadow-[0_18px_45px_rgba(220,38,38,0.35)]">
              <p className="text-xs font-semibold text-red-100 mb-2 flex items-center justify-center gap-2">
                <Snowflake className="w-4 h-4" /> Live pile-on in progress
              </p>
              <p className="text-[13px] text-red-100/90">
                Everyone who taps this card helps freeze @{aggressor} a little more and earns extra
                SPP.
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

      <div className="relative z-10 px-4 pt-4 max-w-md mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-500 text-white px-4 py-3 shadow-xl rounded-3xl mb-3 flex items-center justify-between gap-3 border border-white/10 overflow-hidden">
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
              onClick={() => setShowAddPrompt(true)}
              disabled={isAdding}
              className="relative flex items-center gap-1 text-[10px] font-bold bg-white/15 hover:bg:white/20 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded-full transition border border-white/30 shadow-sm"
            >
              <Bookmark className="w-3 h-3" />
              {isAdding ? 'Adding…' : 'Bookmark'}
            </button>
          )}
          {isAdded && (
            <div className="text-[10px] font-semibold px-3 py-1.5 rounded-full bg-white/10 border border-white/20">
              ✅ Saved
            </div>
          )}
        </div>

        {/* WARNING: add miniapp to get hit */}
        {!isAdded && (
          <div className="mb-3 bg-amber-900/50 border border-amber-400/70 text-amber-100 text-[11px] rounded-2xl px-3 py-2 shadow-[0_10px_30px_rgba(15,23,42,0.7)] text-center">
            ⚠️ Add Snowball Fight to your Miniapps to receive hits, unlock streaks, and appear on
            the global SPP leaderboard.
          </div>
        )}

        {/* Status bubble */}
        {status && (
          <div className="mb-4 animate-in fade-in-0 slide-in-from-top-2 bg-slate-900/70 backdrop-blur border border-slate-700/60 text-white text-center py-2.5 px-4 rounded-2xl text-xs font-medium shadow-[0_12px_30px_rgba(15,23,42,0.7)]">
            {status}
          </div>
        )}

        {/* Target + player card */}
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
                  Hit back, start beefs, and farm Snow Power Points.
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400 flex items-center justify-end gap-1">
                <Trophy className="w-3 h-3" /> Rank
              </p>
              <p className="text-[11px] font-semibold text-slate-100">
                {getRank(points)}
              </p>
              <p className="text-[10px] text-slate-400">
                SPP:{' '}
                <span className="font-semibold text-slate-100">
                  {points}
                </span>
              </p>
            </div>
          </div>

          {/* Progress to next rank */}
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
              <Snowflake className="w-4 h-4" /> Launch Snowball
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

        {/* Leaderboard */}
        <div className="mt-5 bg-slate-900/70 backdrop-blur-xl rounded-3xl border border-slate-700/60 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.9)]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-2xl bg-slate-800 flex items-center justify-center">
                <Trophy className="w-4 h-4 text-yellow-300" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-100">Global Iceboard</h3>
                <p className="text-[11px] text-slate-400">
                  Top Snow Power hoarders on Farcaster right now.
                </p>
              </div>
            </div>
            <button
              onClick={fetchLeaderboard}
              className="text-[10px] px-2 py-1 rounded-full border border-slate-600 bg-slate-800/70 hover:bg-slate-700/80 transition"
            >
              Refresh
            </button>
          </div>

          {isLoadingLeaderboard ? (
            <p className="text-[11px] text-slate-400 text-center py-2">
              Loading leaderboard…
            </p>
          ) : leaderboard.length === 0 ? (
            <p className="text-[11px] text-slate-400 text-center py-2">
              No snowball legends yet. Start throwing to claim the top spot.
            </p>
          ) : (
            <div className="space-y-1">
              {leaderboard.slice(0, 5).map((entry, index) => {
                const isYou =
                  entry.username?.toLowerCase() === username?.toLowerCase();
                return (
                  <div
                    key={`${entry.username}-${index}`}
                    className={`flex items-center justify-between text-[11px] rounded-xl px-3 py-2 ${
                      isYou
                        ? 'bg-emerald-900/50 border border-emerald-500/50'
                        : 'bg-slate-900/60 border border-slate-700/60'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-5 text-[11px] font-semibold text-slate-300">
                        {index + 1}.
                      </div>
                      <p className="font-semibold text-slate-100">
                        @{entry.username || 'anon'}
                        {isYou && (
                          <span className="ml-1 text-[10px] text-emerald-300">
                            (you)
                          </span>
                        )}
                        {entry.badge && (
                          <span className="ml-1 text-[10px] text-amber-300">
                            {entry.badge}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {entry.streak && entry.streak > 1 && (
                        <span className="flex items-center gap-1 text-[10px] text-amber-300">
                          <Flame className="w-3 h-3" />
                          x{entry.streak}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-300">
                        {entry.points} SPP
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="mt-2 text-[10px] text-slate-500 text-center">
            Hit more friends to climb the board. Add the miniapp so they can hit you back.
          </p>
        </div>

        {/* Donate section */}
        <div className="mt-5 space-y-3">
          <div className="bg-slate-900/60 backdrop-blur-xl rounded-3xl border border-slate-700/60 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.9)] flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-[0.16em]">
              <Gift className="w-4 h-4" />
              Support the Snowball Arena
            </div>
            <p className="text-[11px] text-slate-400 text-center">
              Help keep the snow machines running. A tiny tip, big Christmas spirit.
            </p>
            <button
              onClick={donate}
              disabled={isDonating}
              className="group inline-flex items-center justify-center gap-2 px-5 py-3 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed text-yellow-950 rounded-full font-semibold text-xs shadow-[0_14px_35px_rgba(250,204,21,0.6)] active:scale-95 transition border border-yellow-200/70"
            >
              <Gift className="w-4 h-4 group-hover:animate-bounce" />
              {isDonating ? 'Processing...' : 'Buy Santa a Coffee'}
            </button>
          </div>

          <p className="text-slate-500 text-[10px] font-medium tracking-[0.18em] uppercase text-center">
            Built for Farcaster Holidays 🎄
          </p>
        </div>
      </div>

      {/* Add miniapp popup */}
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
              Add this miniapp to your collection so you can launch snowballs in one tap from your
              Miniapps tab, earn SPP, and get hit back with full notifications.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleRegister}
                disabled={isAdding}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-red-500 hover:bg-red-400 disabled:opacity-60 disabled:cursor-not-allowed text-white shadow-md active:scale-[0.98] transition"
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
