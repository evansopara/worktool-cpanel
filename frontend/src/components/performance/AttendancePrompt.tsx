'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { Button, Sheet, SheetDescription, SheetEyebrow, SheetTitle } from '@/components/wc';
import { errorText, fmtTime } from '@/lib/tasks';
import { performanceApi, type MyCheck } from '@/lib/performance';
import { mmss, useSecondsLeft } from './parts';

/**
 * The daily attendance check prompt (CheckIn / MCheckIn): a centred card on
 * desktop, a bottom sheet on mobile. It can't be dismissed while the check
 * is open; it closes after "I'm here" or when the 30-minute window ends.
 * Polled once a minute; the push notification brings people back to the app.
 */
export function AttendancePrompt({ firstName }: { firstName: string }) {
  const qc = useQueryClient();
  const [done, setDone] = useState<{ status: string; at: string } | null>(null);

  const q = useQuery({
    queryKey: ['attendance', 'me'],
    queryFn: async () => {
      const check = await performanceApi.myCheck();
      return check ? { check, offset: Date.now() - new Date(check.server_now).getTime() } : null;
    },
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const check = q.data?.check ?? null;
  const offset = q.data?.offset ?? 0;
  const left = useSecondsLeft(check?.answer_by, -offset);
  const open = !!check && ((check.status === 'pending' && left > 0) || !!done);

  const respond = useMutation({
    mutationFn: (c: MyCheck) => performanceApi.respond(c.id),
    onSuccess: (r) => {
      setDone({ status: r.status, at: r.responded_at });
      qc.invalidateQueries({ queryKey: ['performance'] });
    },
    onError: () => qc.invalidateQueries({ queryKey: ['attendance', 'me'] }),
  });

  const close = () => {
    setDone(null);
    qc.invalidateQueries({ queryKey: ['attendance', 'me'] });
  };

  if (!check) return null;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && done && close()} className="lg:max-w-[460px]">
      {done ? (
        <>
          <SheetEyebrow tone="done">
            <CheckCircle2 aria-hidden="true" />
            Attendance check
          </SheetEyebrow>
          <SheetTitle>You’re checked in</SheetTitle>
          <SheetDescription className="text-[14px] text-ink-2">
            Answered at {fmtTime(done.at)} · {done.status === 'late' ? 'late' : 'on time'}
          </SheetDescription>
          <Button className="w-full" size="xl" onClick={close}>
            Done
          </Button>
        </>
      ) : (
        <Body check={check} name={firstName} offset={offset} pending={respond.isPending} error={respond.isError ? errorText(respond.error, 'Couldn’t check you in. Try again.') : null} onAnswer={() => respond.mutate(check)} />
      )}
    </Sheet>
  );
}

function Body({
  check,
  name,
  offset,
  pending,
  error,
  onAnswer,
}: {
  check: MyCheck;
  name: string;
  offset: number;
  pending: boolean;
  error: string | null;
  onAnswer: () => void;
}) {
  const left = useSecondsLeft(check.answer_by, -offset);
  const total = 30 * 60;

  return (
    <>
      <p className="m-0 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.07em] text-review">
        <span className="size-2 rounded-full bg-review-bar" aria-hidden="true" />
        Attendance check
      </p>
      <SheetTitle>Are you there, {name}?</SheetTitle>
      <div className="flex flex-col gap-2 rounded-[22px] bg-surface-2 px-5 py-4">
        <span className={'font-mono text-[56px] leading-none font-bold tracking-[-0.02em] lg:text-[64px]'} role="timer">
          {mmss(left).replace(':', ' : ')}
        </span>
        <span className="text-[13px] text-ink-2">
          left to answer · sent at {fmtTime(check.sent_at)}
        </span>
        <div className="h-1.5 overflow-hidden rounded-full bg-stone">
          <div className="h-full rounded-full bg-review-bar" style={{ width: `${(left / total) * 100}%` }} />
        </div>
      </div>
      <Button variant="accent" size="xl" className="w-full" onClick={onAnswer} disabled={pending}>
        I’m here
      </Button>
      {error && (
        <p role="alert" className="m-0 text-[13px] font-semibold text-missed">
          {error}
        </p>
      )}
      <SheetDescription>
        One check a day at a random time during working hours. Answering confirms you’re active on this signed-in device. If you don’t answer within 30 minutes, the check counts as missed.
      </SheetDescription>
    </>
  );
}
