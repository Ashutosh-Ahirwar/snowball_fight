'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import sdk from '@farcaster/miniapp-sdk';
import Snowfall from 'react-snowfall';
import { Trophy, ArrowLeft, User } from 'lucide-react';

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

// Single emoji streak formatter
const streakEmoji = (streak: number) => {
  if (streak >= 2) return '🔥'; // hot streak
  if (streak === 1) return '☃️'; // fresh streak
  return '❄️'; // cold
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
          `/api/leaderboard?user=${encodeURIComponent(uname)}`
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
        {/* Back + user */}
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
          <div className="leading-tight">
            <h1 className="text-base font-semibold">Global Iceboard</h1>
            <p className="text-[11px] text-slate-400">
              Top 20 Snow Power hoarders and your overall rank.
            </p>
          </div>
        </div>

        {/* Your position */}
        <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-4 shadow space-y-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
            Your position
          </p>
          {userInfo && userInfo.rank !== null ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="leading-tight">
                  <p className="text-sm font-semibold">
                    #{userInfo.rank} @{userInfo.username}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Keep throwing to climb higher and extend your streak.
                  </p>
                </div>
              </div>
              <div className="text-right text-[11px] leading-tight">
                <p className="text-slate-400">SPP</p>
                <p className="font-semibold text-slate-100">
                  {userInfo.points}
                </p>
                <p className="mt-0.5 text-slate-400">
                  {streakEmoji(userInfo.streak)} x{userInfo.streak}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-slate-400">
              You&apos;re not ranked yet. Throw some snowballs to enter the board.
            </p>
          )}
        </div>

        {/* Top 20 list */}
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
                const medals = ['🥇', '🥈', '🥉'];

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
                        {medals[index] || `${index + 1}.`}
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
                    <div className="text-right text-[10px] leading-tight">
                      <p className="text-slate-300">
                        {entry.points} SPP
                      </p>
                      <p className="text-slate-400">
                        {streakEmoji(streakValue)} x{streakValue}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Notes / explanation */}
        <div className="text-[10px] text-slate-500 space-y-1">
          <p>Notes:</p>
          <ul className="list-disc ml-4 space-y-0.5">
            <li>
              <strong>Snow Power Points (SPP)</strong> are earned from hits, streaks, revenge shots,
              and first-time hits on new players.
            </li>
            <li>
              <strong>Streak</strong> is how many consecutive days you&apos;ve landed hits without a
              24h break.
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
