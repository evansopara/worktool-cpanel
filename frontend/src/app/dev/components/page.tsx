'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Clock, FileText, Pencil, Play, Plus, Square, Trash2 } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  DateRange,
  Drawer,
  DrawerClose,
  ExportMenu,
  IconButton,
  Pagination,
  ScheduleBoxes,
  ScheduleInline,
  SearchField,
  SegmentedFilter,
  Sheet,
  SheetActions,
  SheetDescription,
  SheetEyebrow,
  SheetTitle,
  StatusPill,
  Tabs,
  type DateRangeValue,
  type StatusTone,
} from '@/components/wc';

// Step 1 check page (spec §9): every redesign component and variant, plus the
// contrast of each text/background pair. Sample text only, no API data.

const CONTRAST_PAIRS: [string, string, string][] = [
  ['ink-3 on stone', '#6A665F', '#EFEDE7'],
  ['ink-3 on white', '#6A665F', '#FFFFFF'],
  ['ink-3 on surface-2', '#6A665F', '#F7F6F2'],
  ['ink-2 on stone', '#4D4A44', '#EFEDE7'],
  ['ink on yellow', '#121212', '#FFD43B'],
  ['missed', '#C0362C', '#FBE7E4'],
  ['pending', '#8A5A00', '#FCF0CC'],
  ['done', '#1F7A4A', '#E2F2E7'],
  ['review', '#1E4797', '#DCE6F7'],
  ['todo', '#4D4A44', '#ECEAE4'],
  ['missed on white', '#C0362C', '#FFFFFF'],
  ['on-dark on ink', '#BDB9B0', '#121212'],
  ['on-dark-2 on ink', '#A8A49C', '#121212'],
  ['missed-on-dark on dark-1', '#FF9A8F', '#1E1D1B'],
];

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-card-lg bg-surface p-6 sm:p-7">
      <h2 className="m-0 font-display text-2xl font-bold tracking-[-0.02em]">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">{label}</span>
      <div className="flex flex-wrap items-center gap-2.5">{children}</div>
    </div>
  );
}

const SWATCHES: [string, string][] = [
  ['stone', 'bg-stone'],
  ['surface', 'bg-surface'],
  ['surface-2', 'bg-surface-2'],
  ['ink', 'bg-ink'],
  ['ink-2', 'bg-ink-2'],
  ['ink-3', 'bg-ink-3'],
  ['line', 'bg-line'],
  ['yellow', 'bg-yellow'],
  ['dark-1', 'bg-dark-1'],
  ['dark-2', 'bg-dark-2'],
];

const TONES: [StatusTone, string][] = [
  ['missed', 'Deadline missed'],
  ['pending', 'In progress'],
  ['review', 'In review'],
  ['done', 'Completed'],
  ['todo', 'To do'],
];

// Reading the query string makes this page render on the client only, which
// is fine for a dev page.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <ComponentsPage />
    </Suspense>
  );
}

function ComponentsPage() {
  // ?open=drawer|read|early opens that dialog on load, for screenshots.
  const open = useSearchParams().get('open');
  const [tab, setTab] = useState<'all' | 'mine' | 'ext'>('all');
  const [staffTab, setStaffTab] = useState<'active' | 'completed' | 'ext'>('active');
  const [category, setCategory] = useState('all');
  const [homeFilter, setHomeFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [range, setRange] = useState<DateRangeValue>({ from: '', to: '' });
  const [page, setPage] = useState(2);
  const [manyPage, setManyPage] = useState(6);
  const [exported, setExported] = useState('');
  const [drawer, setDrawer] = useState(open === 'drawer');
  const [readSheet, setReadSheet] = useState(open === 'read');
  const [earlySheet, setEarlySheet] = useState(open === 'early');

  return (
    <div className="min-h-screen bg-stone font-ui text-ink">
      <main className="mx-auto flex max-w-content flex-col gap-[22px] px-[18px] pt-7 pb-[72px] sm:px-10">
        <header className="flex flex-col gap-2.5 pt-2 pb-1">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">Redesign · step 1</p>
          <h1 className="m-0 font-display text-[40px] leading-none font-bold tracking-[-0.04em] sm:text-[56px]">Components</h1>
          <p className="m-0 text-base text-ink-2">Every shared component and variant from the handoff spec, section 3.</p>
        </header>

        <Section title="Colours">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {SWATCHES.map(([name, cls]) => (
              <div key={name} className="flex flex-col gap-1.5">
                <span className={`h-14 rounded-2xl ring-1 ring-line ${cls}`} />
                <span className="font-mono text-xs">{name}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Typography">
          <p className="m-0 font-display text-[56px] leading-none font-bold tracking-[-0.04em]">Display 56</p>
          <p className="m-0 font-display text-[30px] font-bold tracking-[-0.02em]">Section title 30</p>
          <p className="m-0 font-display text-[22px] font-bold">Section title 22</p>
          <p className="m-0 text-base">Body 16 — Geist regular for running text.</p>
          <p className="m-0 text-sm text-ink-2">Body 14 — secondary text in ink-2.</p>
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">Label 12 uppercase</p>
          <p className="m-0 font-mono text-[32px] leading-none font-semibold text-ink">03:02:43</p>
        </Section>

        <Section title="Buttons">
          <Row label="Variants (lg, 48px)">
            <Button variant="primary">Primary</Button>
            <Button variant="accent">
              <Plus strokeWidth={2.4} aria-hidden="true" />
              New task
            </Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="danger">Delete</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="primary" disabled>
              Disabled
            </Button>
          </Row>
          <Row label="White (on stone)">
            <div className="flex flex-wrap gap-2.5 rounded-2xl bg-stone p-3">
              <Button variant="white">White</Button>
            </div>
          </Row>
          <Row label="Dark outline (on ink cards)">
            <div className="flex flex-wrap gap-2.5 rounded-2xl bg-ink p-3">
              <Button variant="dark-outline">Decline</Button>
              <Button variant="accent">Approve</Button>
            </div>
          </Row>
          <Row label="Sizes">
            <Button size="sm">
              <Play fill="currentColor" aria-hidden="true" />
              Start
            </Button>
            <Button size="sm" variant="accent">
              Submit
            </Button>
            <Button size="md">Compact 40</Button>
            <Button size="lg">Standard 48</Button>
            <Button size="xl">Mobile primary 52</Button>
          </Row>
          <Row label="Icon buttons">
            <IconButton aria-label="Edit task">
              <Pencil strokeWidth={2} aria-hidden="true" />
            </IconButton>
            <IconButton variant="danger" aria-label="Delete task">
              <Trash2 strokeWidth={2} aria-hidden="true" />
            </IconButton>
            <div className="flex gap-2 rounded-2xl bg-ink p-2">
              <IconButton variant="dark" aria-label="Stop timer">
                <Square fill="currentColor" aria-hidden="true" />
              </IconButton>
            </div>
          </Row>
        </Section>

        <Section title="Status pills, badges, avatars">
          <Row label="StatusPill sm">
            {TONES.map(([tone, label]) => (
              <StatusPill key={tone} tone={tone}>
                {label}
              </StatusPill>
            ))}
          </Row>
          <Row label="StatusPill md">
            {TONES.map(([tone, label]) => (
              <StatusPill key={tone} tone={tone} size="md">
                {label}
              </StatusPill>
            ))}
          </Row>
          <Row label="Badge">
            <Badge count={1} />
            <Badge count={12} />
            <Badge count={140} />
            <span className="text-sm text-ink-3">(0 renders nothing)</span>
          </Row>
          <Row label="Avatar">
            <Avatar name="Victor Adeleye" size="lg" />
            <Avatar name="Asheoluwa Oke" tone="ink" />
            <Avatar name="Mirakl" tone="stone" size="sm" />
          </Row>
        </Section>

        <Section title="Tabs and filters">
          <Row label="Tabs on stone (manager Tasks)">
            <div className="max-w-full rounded-2xl bg-stone p-3">
              <Tabs
                label="Task views"
                value={tab}
                onChange={setTab}
                items={[
                  { value: 'all', label: 'All tasks' },
                  { value: 'mine', label: 'My tasks' },
                  { value: 'ext', label: 'Extension requests', badge: 1 },
                ]}
              />
            </div>
          </Row>
          <Row label="Tabs with counts, on white (staff My tasks)">
            <Tabs
              label="My task views"
              on="white"
              value={staffTab}
              onChange={setStaffTab}
              items={[
                { value: 'active', label: 'Active', count: 12 },
                { value: 'completed', label: 'Completed', count: 40 },
                { value: 'ext', label: 'Extension requests', badge: 1 },
              ]}
            />
          </Row>
          <Row label="SegmentedFilter chips (Projects, on stone)">
            <div className="rounded-2xl bg-stone p-3">
              <SegmentedFilter
                label="Category"
                value={category}
                onChange={setCategory}
                items={[
                  { value: 'all', label: 'All', count: 34 },
                  { value: 'web', label: 'Website', count: 18 },
                  { value: 'ads', label: 'Ads', count: 9 },
                  { value: 'brand', label: 'Branding', count: 7 },
                ]}
              />
            </div>
          </Row>
          <Row label="SegmentedFilter inline (staff Home card)">
            <SegmentedFilter
              label="Task filter"
              variant="inline"
              value={homeFilter}
              onChange={setHomeFilter}
              items={[
                { value: 'all', label: 'All', count: 25 },
                { value: 'active', label: 'Active', count: 12 },
                { value: 'completed', label: 'Completed', count: 13 },
              ]}
            />
          </Row>
        </Section>

        <Section title="Toolbar: search, date range, export">
          <div className="flex flex-wrap items-center gap-2.5 rounded-2xl bg-stone p-3">
            <SearchField value={query} onChange={setQuery} placeholder="Search task or staff" />
            <DateRange value={range} onChange={setRange} />
            <ExportMenu onSelect={(f) => setExported(f)} />
          </div>
          <p className="m-0 font-mono text-xs text-ink-3">
            q=&quot;{query}&quot; from={range.from || '—'} to={range.to || '—'} export={exported || '—'}
          </p>
          <Row label="On white">
            <SearchField on="white" value={query} onChange={setQuery} placeholder="Search your tasks" />
            <DateRange on="white" value={range} onChange={setRange} />
          </Row>
        </Section>

        <Section title="Pagination">
          <Row label="27 tasks">
            <Pagination className="w-full" page={page} total={27} onPageChange={setPage} />
          </Row>
          <Row label="143 tasks (gaps)">
            <Pagination className="w-full" page={manyPage} total={143} onPageChange={setManyPage} />
          </Row>
          <Row label="Mobile, 27 and 143 tasks (on stone)">
            <div className="flex w-full flex-col gap-3 rounded-2xl bg-stone p-3">
              <Pagination variant="mobile" page={page} total={27} onPageChange={setPage} />
              <Pagination variant="mobile" page={manyPage} total={143} onPageChange={setManyPage} />
            </div>
          </Row>
          <Row label="Empty">
            <Pagination className="w-full" page={1} total={0} onPageChange={() => {}} />
          </Row>
        </Section>

        <Section title="Schedule">
          <Row label="ScheduleBoxes light">
            <ScheduleBoxes className="w-full max-w-sm" start="Oct 26, 1:01 PM" deadline="Oct 26, 4:00 PM" />
            <ScheduleBoxes className="w-full max-w-sm" start="Oct 23, 3:00 PM" deadline="Oct 23, 5:00 PM" missed />
          </Row>
          <Row label="ScheduleBoxes dark (running-task card)">
            <div className="flex w-full flex-wrap gap-3 rounded-card bg-ink p-4">
              <ScheduleBoxes tone="dark" className="w-full max-w-sm" start="Oct 26, 1:01 PM" deadline="Oct 26, 4:00 PM" />
              <ScheduleBoxes tone="dark" className="w-full max-w-sm" start="Oct 23, 3:00 PM" deadline="Oct 23, 5:00 PM" missed />
            </div>
          </Row>
          <Row label="ScheduleInline (table rows)">
            <ScheduleInline start="Oct 26, 9:00 AM" deadline="Oct 26, 11:00 AM" />
            <ScheduleInline start="Oct 23, 3:00 PM" deadline="Oct 23, 5:00 PM" missed />
          </Row>
        </Section>

        <Section title="Drawer and sheets">
          <Row label="Open">
            <Button onClick={() => setDrawer(true)}>Task panel (drawer)</Button>
            <Button variant="secondary" onClick={() => setReadSheet(true)}>
              Read before you start
            </Button>
            <Button variant="secondary" onClick={() => setEarlySheet(true)}>
              Start early
            </Button>
          </Row>
          <p className="m-0 text-sm text-ink-3">
            Below 1024px the drawer is full screen, the prompts are bottom sheets and the date range is two boxes.
          </p>
        </Section>

        <Section title="Contrast (4.5:1 minimum)">
          <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
            {CONTRAST_PAIRS.map(([name, fg, bg]) => {
              const ratio = contrast(fg, bg);
              return (
                <li key={name} className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3" style={{ background: bg, color: fg }}>
                  <span className="text-sm font-semibold">{name}</span>
                  <span className="font-mono text-sm font-semibold">
                    {ratio.toFixed(2)} {ratio >= 4.5 ? '✓' : '✗'}
                  </span>
                </li>
              );
            })}
          </ul>
        </Section>
      </main>

      <Drawer open={drawer} onOpenChange={setDrawer} label="Task details and history">
        <div className="flex flex-col gap-4 p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-[13px] text-ink-3">[Project name]</span>
              <h2 className="m-0 font-display text-[28px] leading-tight font-bold tracking-[-0.02em]">[Task title]</h2>
            </div>
            <DrawerClose className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-stone text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink">
              <span aria-hidden="true" className="text-xl leading-none">×</span>
              <span className="sr-only">Close</span>
            </DrawerClose>
          </div>
          <div className="flex gap-2">
            <StatusPill tone="pending">In progress</StatusPill>
          </div>
          <ScheduleBoxes start="Oct 26, 1:01 PM" deadline="Oct 26, 4:00 PM" />
          <p className="m-0 text-sm text-ink-3">The task panel content is built in step 4.</p>
        </div>
      </Drawer>

      <Sheet open={readSheet} onOpenChange={setReadSheet}>
        <SheetEyebrow>
          <FileText aria-hidden="true" />
          Read before you start
        </SheetEyebrow>
        <SheetTitle>[Website task title]</SheetTitle>
        <SheetDescription>From [manager]</SheetDescription>
        <div className="rounded-[18px] bg-surface-2 p-4 text-[15px] leading-[1.6] lg:rounded-[20px] lg:p-[18px]">
          [Full instructions written by the manager — steps to follow, links, files and what “done” looks like.]
        </div>
        <SheetActions confirmLabel="Got it, start timer" onConfirm={() => setReadSheet(false)} />
      </Sheet>

      <Sheet open={earlySheet} onOpenChange={setEarlySheet}>
        <SheetEyebrow tone="done">
          <Clock aria-hidden="true" />
          Starting early · it’s 10:30 AM
        </SheetEyebrow>
        <SheetTitle>This task is scheduled for 1:01 PM — do you want to start early?</SheetTitle>
        <SheetDescription className="text-ink-2">[Website task title] · deadline Oct 26, 4:00 PM</SheetDescription>
        <div className="rounded-[18px] bg-pending-tint p-3.5 text-sm leading-normal text-pending-ink lg:rounded-[20px] lg:p-4 lg:text-[14.5px]">
          <strong>You have [Task scheduled now] scheduled now (due 12:00 PM).</strong> Start this one anyway?
        </div>
        <p className="m-0 text-[13px] leading-normal text-ink-2 lg:text-[13.5px]">
          This will be saved to the task history. Your estimate and deadline stay the same.
        </p>
        <SheetActions confirmLabel="Start early" cancelLabel="Not yet" onConfirm={() => setEarlySheet(false)} />
      </Sheet>
    </div>
  );
}
