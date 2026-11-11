'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import Header from '@/components/layout/Header';
import { sentimentsApi } from '@/lib/api';
import { ClientSentiment } from '@/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { TrendingUp, Users, ThumbsUp, ThumbsDown, Flag, Calendar } from 'lucide-react';
import { startOfWeek, endOfWeek, subWeeks, format, isWithinInterval } from 'date-fns';

type SentimentValue = ClientSentiment['sentiment'];

const MANAGER_ROLES = ['operations_manager', 'team_lead'];

function getWeekOptions(count = 8) {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const start = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
    const end = endOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
    const label = i === 0 ? 'Current Week' : i === 1 ? 'Last Week' : `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
    return { key: String(i), start, end, label };
  });
}

function StatCard({
  label, value, caption, icon: Icon, tone,
}: {
  label: string; value: number; caption?: string; icon: React.ElementType; tone?: 'green' | 'amber' | 'red';
}) {
  const toneClass = tone === 'green' ? 'text-green-700' : tone === 'amber' ? 'text-amber-700' : tone === 'red' ? 'text-red-700' : 'text-foreground';
  return (
    <div className="border rounded-2xl p-5 flex items-start justify-between">
      <div>
        <p className={`font-semibold ${tone ? toneClass : 'text-muted-foreground'}`}>{label}</p>
        <p className={`text-4xl font-bold mt-2 ${toneClass}`}>{value}</p>
        {caption && <p className={`text-xs mt-1 ${toneClass}`}>{caption}</p>}
      </div>
      <Icon className={`w-6 h-6 shrink-0 ${toneClass}`} />
    </div>
  );
}

function SentimentBadge({ sentiment }: { sentiment: SentimentValue }) {
  const meta = sentiment === 'satisfied'
    ? { label: 'Satisfied', className: 'bg-green-100 text-green-700' }
    : { label: 'Dissatisfied', className: 'bg-amber-100 text-amber-700' };
  return <span className={`text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap ${meta.className}`}>{meta.label}</span>;
}

function ManagementView() {
  const weekOptions = useMemo(() => getWeekOptions(), []);
  const [weekKey, setWeekKey] = useState(weekOptions[0].key);
  const selectedWeek = weekOptions.find((w) => w.key === weekKey) ?? weekOptions[0];

  const { data: sentiments = [], isLoading } = useQuery<ClientSentiment[]>({
    queryKey: ['sentiments'],
    queryFn: () => sentimentsApi.list().then((r) => r.data),
  });

  const filtered = sentiments.filter((s) =>
    isWithinInterval(new Date(s.recorded_at), { start: selectedWeek.start, end: selectedWeek.end })
  );

  const total = filtered.length;
  const satisfied = filtered.filter((s) => s.sentiment === 'satisfied').length;
  const dissatisfied = filtered.filter((s) => s.sentiment === 'dissatisfied').length;
  const flags = filtered.filter((s) => s.is_flagged).length;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-primary" /> Client Sentiment Tracker
          </h1>
          <p className="text-muted-foreground mt-1">Monitor client satisfaction and feedback</p>
        </div>
        <Select value={weekKey} onValueChange={(v) => setWeekKey(v ?? weekOptions[0].key)}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue>{(v: string | null) => weekOptions.find((w) => w.key === v)?.label ?? 'Current Week'}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {weekOptions.map((w) => <SelectItem key={w.key} value={w.key}>{w.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Responses" value={total} icon={Users} />
        <StatCard label="Satisfied" value={satisfied} caption={`${pct(satisfied)}% of total`} icon={ThumbsUp} tone="green" />
        <StatCard label="Dissatisfied" value={dissatisfied} caption={`${pct(dissatisfied)}% of total`} icon={ThumbsDown} tone="amber" />
        <StatCard label="Flags" value={flags} caption={`${pct(flags)}% of total`} icon={Flag} tone="red" />
      </div>

      <div className="border rounded-2xl p-6">
        <h2 className="text-xl font-bold">Client Feedback Details</h2>
        <p className="text-muted-foreground text-sm mt-1">Individual client sentiment submissions for the selected week</p>

        {isLoading ? (
          <div className="space-y-3 mt-4">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-semibold text-foreground">No feedback yet</p>
            <p className="text-sm mt-1">No client sentiment data available for the selected week.</p>
          </div>
        ) : (
          <div className="space-y-3 mt-4">
            {filtered.map((s) => (
              <div key={s.id} className="border rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-medium">{s.client?.first_name} {s.client?.last_name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {s.is_flagged && (
                      <span className="text-xs font-semibold px-3 py-1 rounded-full bg-red-100 text-red-700 flex items-center gap-1">
                        <Flag className="w-3 h-3" /> Flagged
                      </span>
                    )}
                    <SentimentBadge sentiment={s.sentiment} />
                  </div>
                </div>
                {s.feedback && <p className="text-sm mt-2">{s.feedback}</p>}
                <p className="text-xs text-muted-foreground mt-1.5">{formatDate(s.recorded_at, "MMM d, yyyy, h:mm a")}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SubmitView() {
  const qc = useQueryClient();
  const [sentiment, setSentiment] = useState<SentimentValue>('satisfied');
  const [feedback, setFeedback] = useState('');
  const [isFlagged, setIsFlagged] = useState(false);

  const { data: history = [], isLoading } = useQuery<ClientSentiment[]>({
    queryKey: ['sentiments'],
    queryFn: () => sentimentsApi.list().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => sentimentsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sentiments'] });
      toast.success('Feedback submitted');
      setFeedback('');
      setIsFlagged(false);
    },
    onError: () => toast.error('Failed to submit feedback'),
  });

  return (
    <div className="p-6">
      <p className="text-muted-foreground mb-6">
        Let us know how things are going — your feedback helps us serve you better.
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="border rounded-2xl p-6">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold">Client Sentiment</h2>
          </div>
          <p className="text-muted-foreground text-sm mt-1">Tell us how satisfied you are this week.</p>

          <div className="space-y-3 mt-4">
            <div className="space-y-1">
              <Label>How are you feeling about our service?</Label>
              <Select value={sentiment} onValueChange={(v) => setSentiment(v as SentimentValue)}>
                <SelectTrigger className="w-full">
                  <SelectValue>{(v: string | null) => (v === 'dissatisfied' ? '😞 Dissatisfied' : '😊 Satisfied')}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="satisfied">😊 Satisfied</SelectItem>
                  <SelectItem value="dissatisfied">😞 Dissatisfied</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Feedback (Optional)</Label>
              <Textarea rows={4} placeholder="Anything you'd like to share..." value={feedback} onChange={(e) => setFeedback(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" className="rounded" checked={isFlagged} onChange={(e) => setIsFlagged(e.target.checked)} />
              Flag this for follow-up — someone will reach out to me
            </label>
            <Button
              className="w-full"
              disabled={createMutation.isPending}
              onClick={() => createMutation.mutate({ sentiment, feedback: feedback || undefined, is_flagged: isFlagged })}
            >
              {createMutation.isPending ? 'Submitting...' : 'Submit Feedback'}
            </Button>
          </div>
        </div>

        <div className="border rounded-2xl p-6">
          <div className="flex items-center gap-2">
            <Calendar className="w-6 h-6 text-amber-500" />
            <h2 className="text-2xl font-bold">Your Feedback History</h2>
          </div>
          <p className="text-muted-foreground text-sm mt-1">Track your past sentiment submissions.</p>

          <div className="mt-4 space-y-3 max-h-[640px] overflow-y-auto pr-1">
            {isLoading ? (
              [...Array(3)].map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)
            ) : history.length === 0 ? (
              <p className="text-center py-10 text-sm text-muted-foreground">No feedback submitted yet</p>
            ) : history.map((s) => (
              <div key={s.id} className="border rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <SentimentBadge sentiment={s.sentiment} />
                  {s.is_flagged && (
                    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-red-100 text-red-700 flex items-center gap-1">
                      <Flag className="w-3 h-3" /> Flagged
                    </span>
                  )}
                </div>
                {s.feedback && <p className="text-sm mt-2">{s.feedback}</p>}
                <p className="text-xs text-muted-foreground mt-1.5">{formatDate(s.recorded_at, "MMM d, yyyy, h:mm a")}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SentimentPage() {
  const { user } = useAuth();
  const isManager = MANAGER_ROLES.includes(user?.role ?? '');

  return (
    <div>
      <Header title={isManager ? 'Client Sentiment Tracker' : 'Client Sentiment'} />
      {isManager ? <ManagementView /> : <SubmitView />}
    </div>
  );
}
