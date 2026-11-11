'use client';

import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Tabs } from '@/components/wc';
import { performanceApi, periodWord, scoreFormula, type Board } from '@/lib/performance';
import { AttendanceDays, BoardList, BoardTable, card, ErrorNote, Loading, MyPositionCard, Podium } from './parts';
import type { PerfUrl } from './usePerfUrl';

/**
 * Leaderboard (Leaderboard / StaffLeaderboard / MLeaderboard): Staff and
 * Project managers boards, podium, full list. Staff also get their own
 * position card and attendance strip, and their row is highlighted.
 */
export function LeaderboardTab({ url, manager, meId }: { url: PerfUrl; manager: boolean; meId: number }) {
  const q = useQuery({
    queryKey: ['performance', 'leaderboard', url.board, url.range],
    queryFn: () => performanceApi.leaderboard(url.board, url.range),
  });
  const d = q.data;

  return (
    <div className="flex flex-col gap-3.5 lg:gap-5">
      <Tabs<Board>
        label="Board"
        value={url.board}
        onChange={url.setBoard}
        className="w-full lg:w-auto [&>button]:flex-1 lg:[&>button]:flex-none"
        items={[
          { value: 'staff', label: 'Staff' },
          { value: 'pm', label: 'Project managers' },
        ]}
      />

      {q.isLoading ? (
        <Loading />
      ) : !d ? (
        <ErrorNote />
      ) : (
        <>
          <Podium rows={d.rows} />

          {d.me && <MyPositionCard row={d.me} lift={d.me.lift} range={url.range} />}

          {!manager && d.my_attendance && (
            <section aria-label="Your attendance" className={cn(card, 'flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-6 lg:py-4')}>
              <div className="flex shrink-0 flex-col gap-0.5">
                <span className="text-[14.5px] font-bold">
                  Your attendance {periodWord(url.range)}
                  {d.my_attendance.rate !== null && ` · ${d.my_attendance.rate}%`}
                </span>
                <span className="text-[12.5px] text-ink-3">One check a day · answer within 30 minutes</span>
              </div>
              <div className="min-w-0 flex-1 lg:max-w-[420px]">
                <AttendanceDays days={d.my_attendance.days} />
              </div>
            </section>
          )}

          {d.rows.length === 0 ? (
            <ErrorNote text="Nobody on this board yet." />
          ) : (
            <>
              <section aria-label="Full ranking" className={cn(card, 'hidden flex-col gap-3 lg:flex')}>
                <BoardTable rows={d.rows} board={url.board} meId={manager ? undefined : meId} onOpen={manager ? url.openPerson : undefined} />
                <p className="m-0 text-xs text-ink-3">
                  {scoreFormula(url.board)} · Minimum {d.min_tasks} tasks to be ranked; approved leave is excluded.
                </p>
              </section>
              <div className="flex flex-col gap-3 lg:hidden">
                <BoardList rows={d.rows} board={url.board} meId={manager ? undefined : meId} onOpen={manager ? url.openPerson : undefined} />
                <p className="m-0 px-1 text-xs text-ink-3">{scoreFormula(url.board)}</p>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
