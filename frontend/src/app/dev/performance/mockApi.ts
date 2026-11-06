import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { BoardRow, CheckStatus } from '@/lib/performance';

// Sample API for /dev/performance: the Performance endpoints answered from
// memory with the sample data from the WC_Performance_Screens artboards.

const ok = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse => ({ data, status: 200, statusText: 'OK', headers: {}, config });

type P = [id: number, name: string, role: string, score: number, onTime: number, first: number, est: number, att: number, move: number | null, tasks: number];
const STAFF: P[] = [
  [11, 'Mirakl', 'staff', 94, 100, 96, 104, 100, 2, 9],
  [12, 'Jamiu Ikhlas', 'staff', 91, 95, 92, 98, 100, null, 11],
  [13, 'Asheoluwa Oke', 'staff', 88, 91, 90, 112, 100, 3, 12],
  [10, 'Victor Adeleye', 'staff', 84, 88, 89, 101, 80, 2, 8],
  [14, 'Emmanuel Evans', 'staff', 81, 86, 85, 118, 100, -1, 14],
  [15, 'Godwin Joel', 'intern', 78, 83, 88, 95, 75, 1, 6],
  [16, 'Yakubu Halilullah Omeiza', 'staff', 75, 80, 84, 121, 100, -3, 10],
  [17, 'Enyojo Wisdom Etu', 'intern', 72, 78, 80, 109, 80, null, 7],
  [18, 'Shittu Mubaraq', 'staff', 69, 75, 79, 126, 80, -2, 9],
  [19, 'Idiong Idongesit', 'staff', 66, 71, 76, 88, 50, 1, 6],
  [20, 'Blank account', 'staff', 61, 67, 70, 131, 80, -1, 5],
  [21, 'Linda Ekeh', 'staff', 90, 100, 100, 100, 100, null, 3],
];

const person = (id: number) => {
  const s = STAFF.find((x) => x[0] === id)!;
  return { id: s[0], name: s[1], role: s[2] };
};

function staffRows(): BoardRow[] {
  return STAFF.map(([id, name, role, score, onTime, first, est, att, move, tasks], i) => {
    const ranked = tasks >= 5;
    return {
      user: { id, name, role },
      score,
      rank: ranked ? i + 1 : null,
      ranked,
      tasks,
      movement: move,
      measures: {
        on_time: { value: onTime, score: onTime, weight: 40, ok: Math.round((tasks * onTime) / 100), total: tasks },
        first_time: { value: first, score: first, weight: 25, sent_back: first < 90 ? 1 : 0, total: tasks },
        estimate: { value: est, score: 100 - Math.abs(est - 100), weight: 15 },
        attendance: { value: att, score: att, weight: 20, late: 0, missed: att < 100 ? 1 : 0, total: 5 },
      },
    };
  });
}

type PM = [id: number, name: string, score: number, team: number, sched: number, dec: number, client: number, est: number, move: number | null];
const PMS: PM[] = [
  [30, 'Adeyemo Titilope', 92, 90, 100, 3.2, 100, 104, 1],
  [31, 'Olamide Bello', 85, 84, 80, 6.5, 90, 112, -1],
  [32, 'Chidi Okafor', 77, 79, 75, 11, 75, 118, null],
];

function pmRows(): BoardRow[] {
  return PMS.map(([id, name, score, team, sched, dec, client, est, move], i) => ({
    user: { id, name, role: 'project_manager' },
    score,
    rank: i + 1,
    ranked: true,
    tasks: 20,
    movement: move,
    measures: {
      team_on_time: { value: team, score: team, weight: 35, ok: 18, total: 20 },
      on_schedule: { value: sched, score: sched, weight: 20, ok: 3, total: 4 },
      decision_speed: { value: dec, score: 80, weight: 20 },
      client_rating: { value: client, score: client, weight: 15 },
      estimate: { value: est, score: 100 - Math.abs(est - 100), weight: 10 },
    },
  }));
}

const DAYS = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30'];
const SENT = ['14:12', '11:05', '15:40', '10:22', '13:48'];
const iso = (date: string, hm: string, plus = 0) => {
  const d = new Date(`${date}T${hm}:00`);
  d.setMinutes(d.getMinutes() + plus);
  return d.toISOString();
};

const WEEK: Record<number, CheckStatus[]> = {
  11: ['answered', 'answered', 'answered', 'answered', 'answered'],
  12: ['answered', 'answered', 'answered', 'answered', 'answered'],
  13: ['answered', 'answered', 'answered', 'answered', 'answered'],
  10: ['answered', 'answered', 'missed', 'answered', 'answered'],
  14: ['answered', 'answered', 'answered', 'answered', 'answered'],
  15: ['pending', 'answered', 'missed', 'answered', 'answered'],
  19: ['pending', 'answered', 'missed', 'answered', 'missed'],
  21: ['skipped', 'skipped', 'answered', 'answered', 'answered'],
};

function personDays(id: number) {
  const list = WEEK[id] ?? WEEK[11];
  return DAYS.map((d, i) => ({
    date: d,
    sent_at: iso(d, SENT[i]),
    status: list[i],
    responded_at: list[i] === 'answered' || list[i] === 'late' ? iso(d, SENT[i], list[i] === 'late' ? 46 : 3) : null,
  }));
}

export function performanceMock(viewerId: number): AxiosAdapter {
  return async (config) => {
    await new Promise((r) => setTimeout(r, 120));
    const url = (config.url ?? '').replace(/^\/api/, '');
    const p = (config.params ?? {}) as Record<string, string>;
    const range = { from: p.from ?? '2026-10-26', to: p.to ?? '2026-11-01' };
    // The live check went out 12 minutes ago, so the countdowns run.
    const now = new Date();
    const sent = new Date(now.getTime() - 12 * 60_000);
    const answeredIds = [11, 12, 14, 10, 13, 17];
    const today = {
      date: '2026-10-26',
      working_day: true,
      sent_at: sent.toISOString(),
      answer_by: new Date(sent.getTime() + 30 * 60_000).toISOString(),
      expected: 10,
      answered: 6,
      waiting: 4,
      missed: 0,
      skipped: 1,
      rows: [
        ...answeredIds.map((id, i) => ({ id, user: person(id), status: 'answered', responded_at: new Date(sent.getTime() + [1, 2, 3, 3, 7, 9][i] * 60_000).toISOString() })),
        ...[15, 19, 16, 18].map((id) => ({ id, user: person(id), status: 'pending', responded_at: null })),
        { id: 21, user: person(21), status: 'skipped', responded_at: null },
      ],
    };
    if (url === '/badges') return ok(config, { inbox: 2, people: 3, clients: 2, });
    if (url === '/notifications/unread-count') return ok(config, { count: 2 });
    if (url === '/performance/overview') {
      const rows = staffRows();
      return ok(config, { ...range, on_time: { pct: 84, ok: 74, total: 88 }, today, missed_checks: 3, top: rows.filter((r) => r.rank && r.rank <= 3), people: rows });
    }
    if (url === '/performance/leaderboard') {
      const board = p.board === 'pm' ? 'pm' : 'staff';
      const rows = board === 'pm' ? pmRows() : staffRows();
      const me = rows.find((r) => r.user.id === viewerId);
      return ok(config, {
        ...range,
        board,
        weights: {},
        min_tasks: 5,
        rows,
        me: me ? { ...me, lift: 'attendance' } : null,
        my_attendance: viewerId === 10 ? { days: personDays(10), rate: 80 } : null,
      });
    }
    if (url === '/performance/attendance/today') return ok(config, today);
    if (url === '/performance/attendance') {
      return ok(config, {
        ...range,
        days: DAYS.map((d, i) => ({ date: d, sent_at: iso(d, SENT[i]) })),
        people: Object.keys(WEEK).map((k) => {
          const list = WEEK[Number(k)];
          const counted = list.filter((x) => x === 'answered' || x === 'late' || x === 'missed');
          return {
            user: person(Number(k)),
            cells: Object.fromEntries(DAYS.map((d, i) => [d, { status: list[i], responded_at: list[i] === 'answered' || list[i] === 'late' ? iso(d, SENT[i], list[i] === 'late' ? 46 : 2 + ((Number(k) + i) % 9)) : null }])),
            rate: counted.length ? Math.round((counted.filter((x) => x === 'answered').length / counted.length) * 100) : null,
          };
        }),
      });
    }
    let m: RegExpMatchArray | null;
    if ((m = url.match(/^\/performance\/people\/(\d+)$/))) {
      const id = Number(m[1]);
      const row = staffRows().find((r) => r.user.id === id) ?? staffRows()[3];
      return ok(config, {
        ...range,
        user: row.user,
        board: 'staff',
        row: { ...row, lift: 'attendance' },
        history: [9, 8, 7, 6, 6, row.rank ?? 4].map((rank, i) => ({ from: `2026-${i < 2 ? '09' : '10'}-${String(i < 2 ? 21 + i * 7 : -7 + i * 7).padStart(2, '0')}`, to: '', rank, score: 70 + i * 3 })),
        attendance: { days: personDays(id), rate: row.measures.attendance.value },
        missed_deadlines: [
          {
            id: 7,
            title: 'Work on Contourfajasafrica email',
            project: 'Contour Fajaas Africa',
            deadline: iso('2026-10-23', '17:00'),
            cause: 'waited_on_extension',
            extension: { status: 'pending', requested_deadline: iso('2026-10-26', '11:00') },
          },
        ],
      });
    }
    if (url === '/attendance/me') {
      return ok(config, {
        check:
          viewerId === 10
            ? { id: 5, status: 'pending', sent_at: today.sent_at, answer_by: today.answer_by, responded_at: null, server_now: now.toISOString() }
            : null,
      });
    }
    if ((m = url.match(/^\/attendance\/checks\/(\d+)\/respond$/))) {
      return ok(config, { status: 'answered', responded_at: new Date().toISOString() });
    }
    if (url === '/departments') return ok(config, ['Design', 'Development', 'Media Buying']);
    if (url === '/kpi-report/productivity') {
      const employees = STAFF.map(([id, name, role]) => ({ id, first_name: name.split(' ')[0], last_name: name.split(' ').slice(1).join(' '), role }));
      if (!p.employee_id) return ok(config, { employees, from: range.from, to: range.to });
      const hours = [3.1, 7.4, 4.9, 4.1, 0, 0, 7.6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3.5, 4.5, 1.1, 0, 0, 2.3, 0];
      const chart = hours.map((h, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, hours: h }));
      const e = employees.find((x) => String(x.id) === String(p.employee_id)) ?? employees[0];
      return ok(config, {
        employees,
        from: '2026-09-01',
        to: '2026-09-30',
        chart,
        daily_details: chart
          .slice()
          .reverse()
          .map((c) => ({ date: c.date, total_span_seconds: c.hours * 3600, tasks: c.hours ? ['Homepage hero section'] : [], status: c.hours >= 4 ? 'good' : c.hours >= 2 ? 'fair' : 'poor' })),
        task_breakdown: [
          { title: 'Homepage hero section', status: 'completed', estimated_minutes: 60, actual_minutes: 78, percentage: 130 },
          { title: 'SMTP setup and test emails', status: 'completed', estimated_minutes: 120, actual_minutes: 110, percentage: 92 },
          { title: 'Product page layout', status: 'review', estimated_minutes: 45, actual_minutes: 46, percentage: 102 },
        ],
        overview: { total_working_days: 30, active_days: 9, average_daily_hours: 4.3, productivity_score: 104, unique_task_count: 3 },
        staff_summary: {
          id: e.id,
          name: `${e.first_name} ${e.last_name}`.trim(),
          role: e.role,
          department: 'Design',
          total_hours: 38.5,
          active_days: 9,
          tasks_completed: 7,
          tasks_in_progress: 1,
          productivity_score: 104,
        },
      });
    }
    return ok(config, {});
  };
}
