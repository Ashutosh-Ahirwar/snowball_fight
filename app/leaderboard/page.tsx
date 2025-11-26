'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import sdk from '@farcaster/miniapp-sdk';
import Snowfall from 'react-snowfall';
import { Trophy, ArrowLeft, Flame, User } from 'lucide-react';

/**
 * NOTE:
 * This page shows:
 * - Global top 20 players by SPP
 * - Current user's rank + SPP + streak (even if not in top 20)
 */

type LeaderboardEntry = {
  username: string;
  points: number;
  streak?: number;
  badge?: string;
};

type UserRankInfo = {
  username: string;
  rank: number | null;
  points: number;
  streak: number;
};

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [userInfo, setUserInfo] = useState<UserRankInfo | null>(null);
  const [username, setUsername] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Fetch context + leaderboard data
  useEffect(() => {
    const init = async () => {
      const context = await sdk.context;
      const uname = (context.user.username || 'anon').toLowerCase();
      setUsername(uname);

      try {
        const res = await fetch(
          `/api/leaderboard?user=${encodeURIComponent(uname)}`,
        );
        const data = await res.json();
        if (Array.isArray(data.entries)) {
          setEntries(data.entries);
        }
        if (data.user) {
          setUserInfo({
            username: data.user.username,
            rank: data.user.rank,
            points: data.user.points,
            streak: data.user.streak ?? 0,
          });
        }
      } catch (e) {
        console.error('Failed to load leaderboard', e);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-50 pb-6 overflow-hidden">
      <Snowfall color="#e5e7eb" snowflakeCount={100} />

      <div className="relative z-10 max-w-md mx-auto px-4 pt-4 space-y-4">
        {/* Header with back to game */}
        <div className="flex items-center justify-between mb-1">
          <Link
            href="/"
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <p className="text-[11px] text-slate-400">
            Logged in as <span className="font-medium">@{username}</span>
          </p>
        </div>

        {/* Title card */}
        <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-4 flex items-center gap-3 shadow-lg">
          <div className="h-10 w-10 rounded-xl bg-slate-800 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-yellow-300" />
          </div>
          <div>
            <h1 className="text-base font-semibold">Global Iceboard</h1>
            <p className="text-[11px] text-slate-400">
              Top 20 Snow Power hoarders and your overall rank.
            </p>
          </div>
        </div>

        {/* Your rank box */}
        <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-4 shadow space-y-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
            Your position
          </p>
          {userInfo && userInfo.rank !== null ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center">
                  <User className="w-4 h-4 text-slate-100" />
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    #{userInfo.rank} @{userInfo.username}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Keep throwing to climb higher and extend your streak.
                  </p>
                </div>
              </div>
              <div className="text-right text-[11px]">
                <p className="text-slate-400">SPP</p>
                <p className="font-semibold text-slate-100">
                  {userInfo.points}
                </p>
                <p className="flex items-center justify-end gap-1 text-slate-400 mt-0.5">
                  <Flame className="w-3 h-3" />
                  Streak x{userInfo.streak}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-slate-400">
              You&apos;re not ranked yet. Throw some snowballs to enter the board.
            </p>
          )}
        </div>

        {/* Global top 20 list */}
        <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-4 shadow">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
              Top 20 players
            </p>
            {!loading && (
              <p className="text-[11px] text-slate-500">
                Showing up to 20 highest SPP users.
              </p>
            )}
          </div>

          {loading ? (
            <p className="text-[11px] text-slate-400 py-2 text-center">
              Loading leaderboard…
            </p>
          ) : entries.length === 0 ? (
            <p className="text-[11px] text-slate-400 py-2 text-center">
              No entries yet. Be the first to claim the throne.
            </p>
          ) : (
            <div className="space-y-1">
              {entries.map((entry, index) => {
                const isYou =
                  entry.username?.toLowerCase() === username?.toLowerCase();
                const streakValue = entry.streak ?? 0;

                return (
                  <div
                    key={`${entry.username}-${index}`}
                    className={`flex items-center justify-between text-[11px] rounded-xl px-3 py-2 ${
                      isYou
                        ? 'bg-emerald-900/50 border border-emerald-500/50'
                        : 'bg-slate-900/80 border border-slate-700'
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
                    <div className="flex flex-col items-end text-right">
                      <span className="text-[10px] text-slate-300">
                        {entry.points} SPP
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-slate-400">
                        {streakValue > 1 && (
                          <Flame className="w-3 h-3 text-amber-300" />
                        )}
                        Streak x{streakValue}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Explanation block */}
        <div className="text-[10px] text-slate-500 space-y-1">
          <p>Notes:</p>
          <ul className="list-disc ml-4 space-y-0.5">
            <li>SPP = Snow Power Points earned from hits, streaks, and bonuses.</li>
            <li>
              Streak = number of consecutive days of hits without a 24h break.
            </li>
            <li>
              Your overall rank is based on total SPP even if you are not in the top 20 list.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
