import { createClient } from '@/lib/supabase';
import Link from 'next/link';

const subjectColorMap: Record<string, string> = {
  Physics: 'bg-blue-600 text-blue-100',
  Biology: 'bg-emerald-600 text-emerald-100',
  Mathematics: 'bg-violet-600 text-violet-100',
  'Computer Science': 'bg-orange-500 text-orange-100',
  Chemistry: 'bg-red-600 text-red-100',
};

const masteryScoreMap: Record<string, number> = {
  Strong: 4,
  Proficient: 3,
  Developing: 2,
  Introduced: 1,
  'In Progress': 0,
};

function formatDate(value: string | null | undefined) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function getMasteryLabel(value: string | null | undefined) {
  const normalized = value?.trim() ?? 'In Progress';
  if (masteryScoreMap[normalized] === undefined) return 'In Progress';
  return normalized;
}

export default async function DashboardPage() {
  const supabase = createClient();
  const { data, error } = await supabase.from('concepts').select('*');

  const rows = Array.isArray(data) ? data : [];
  const totalConcepts = rows.length;
  const uniqueSubjects = new Set(rows.map((row) => String(row.subject ?? '').trim()).filter(Boolean)).size;
  const totalScore = rows.reduce((sum, row) => {
    const mastery = getMasteryLabel(String(row.mastery_level ?? ''));
    return sum + (masteryScoreMap[mastery] ?? 0);
  }, 0);
  const averagePercentage = totalConcepts > 0 ? Math.round((totalScore / (totalConcepts * 4)) * 100) : 0;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="border-b border-slate-800 bg-slate-950/95 px-4 py-4 shadow-sm shadow-black/20 backdrop-blur sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">Study Agent</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <a href="/" className="rounded-full bg-slate-900 px-4 py-2 text-slate-100 transition hover:bg-slate-800">Chat</a>
            <a href="/dashboard" className="rounded-full bg-slate-900 px-4 py-2 text-slate-100 transition hover:bg-slate-800">Dashboard</a>
          </div>
        </div>
      </div>
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 rounded-3xl border border-slate-800 bg-slate-900/80 px-6 py-5 shadow-lg shadow-black/30 backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Dashboard</p>
              <h1 className="mt-2 text-3xl font-semibold text-white">Concept study overview</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Track your concepts, mastery, and next-step progress in one place.</p>
            </div>
          </div>
        </div>

        <section className="mb-6 grid gap-4 xl:grid-cols-3">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm shadow-black/20">
            <p className="text-sm text-slate-400">Total concepts</p>
            <p className="mt-3 text-3xl font-semibold text-white">{totalConcepts}</p>
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm shadow-black/20">
            <p className="text-sm text-slate-400">Unique subjects</p>
            <p className="mt-3 text-3xl font-semibold text-white">{uniqueSubjects}</p>
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm shadow-black/20">
            <p className="text-sm text-slate-400">Average mastery</p>
            <p className="mt-3 text-3xl font-semibold text-white">{averagePercentage}%</p>
          </div>
        </section>

        {error ? (
          <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-200">Unable to load concepts.</div>
        ) : (
          <section className="grid gap-4">
            {rows.map((row, index) => {
              const subject = String(row.subject ?? 'Unknown');
              const concept = String(row.concept ?? 'Untitled');
              const masteryLevel = getMasteryLabel(String(row.mastery_level ?? 'In Progress'));
              const score = masteryScoreMap[masteryLevel] ?? 0;
              const progressPercent = Math.round((score / 4) * 100);
              const badgeClass = subjectColorMap[subject] ?? 'bg-slate-700 text-slate-100';
              const strongAreas = Array.isArray(row.strong_areas) ? (row.strong_areas.filter(Boolean) as string[]) : [];
              const weakAreas = Array.isArray(row.weak_areas) ? (row.weak_areas.filter(Boolean) as string[]) : [];
              const nextSteps = Array.isArray(row.next_steps) ? (row.next_steps.filter(Boolean) as string[]) : [];

              return (
                <details key={`${subject}-${concept}-${index}`} className="group overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80 shadow-sm shadow-black/20">
                  <summary className="cursor-pointer px-6 py-5 transition hover:bg-slate-800/80">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] ${badgeClass}`}>{subject}</span>
                          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">{masteryLevel}</span>
                        </div>
                        <h2 className="text-xl font-semibold text-white">{concept}</h2>
                      </div>
                      <div className="flex min-w-[240px] flex-col gap-3">
                        <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                          <div className="h-full rounded-full bg-sky-500 transition-all duration-300" style={{ width: `${progressPercent}%` }} />
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>{progressPercent}% complete</span>
                          <span>Updated {formatDate(String(row.last_updated ?? row.updated_at ?? ''))}</span>
                        </div>
                      </div>
                    </div>
                  </summary>
                  <div className="border-t border-slate-800/70 px-6 py-5 bg-slate-950/90">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-slate-200">Strong areas</p>
                        <div className="flex flex-wrap gap-2">
                          {strongAreas.length > 0 ? (
                            strongAreas.map((area, itemIndex) => (
                              <span key={`strong-${itemIndex}`} className="rounded-full bg-emerald-600/20 px-3 py-1 text-xs text-emerald-100">{area}</span>
                            ))
                          ) : (
                            <span className="text-slate-500">None listed</span>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-slate-200">Weak areas</p>
                        <div className="flex flex-wrap gap-2">
                          {weakAreas.length > 0 ? (
                            weakAreas.map((area, itemIndex) => (
                              <span key={`weak-${itemIndex}`} className="rounded-full bg-rose-600/20 px-3 py-1 text-xs text-rose-100">{area}</span>
                            ))
                          ) : (
                            <span className="text-slate-500">None listed</span>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-slate-200">Next steps</p>
                        <div className="flex flex-wrap gap-2">
                          {nextSteps.length > 0 ? (
                            nextSteps.map((step, itemIndex) => (
                              <span key={`step-${itemIndex}`} className="rounded-full bg-sky-600/20 px-3 py-1 text-xs text-sky-100">{step}</span>
                            ))
                          ) : (
                            <span className="text-slate-500">No next steps</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </details>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
