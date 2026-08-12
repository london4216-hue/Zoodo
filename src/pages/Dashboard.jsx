import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import Layout from '@/components/Layout';
import { DAYS, getMondayISO, formatWeekRange } from '@/lib/lessonConfig';
import { Check, ChevronRight, TrendingUp } from 'lucide-react';

export default function Dashboard() {
  const [kid, setKid] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const kids = await base44.entities.Kid.list();
        if (kids[0]) setKid(kids[0]);
        const all = await base44.entities.Lesson.filter({ kid_id: kids[0]?.id });
        setLessons(all || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Group lessons by week_start
  const weeks = useMemo(() => {
    const map = {};
    lessons.forEach((l) => {
      if (!map[l.week_start]) map[l.week_start] = [];
      map[l.week_start].push(l);
    });
    return Object.keys(map)
      .sort((a, b) => (a < b ? 1 : -1))
      .map((ws) => {
        const dayLessons = map[ws];
        const completed = dayLessons.filter((l) => l.completed).length;
        return {
          weekStart: ws,
          lessons: dayLessons,
          completed,
          total: 5,
          percent: Math.round((completed / 5) * 100),
        };
      });
  }, [lessons]);

  const totalCompleted = lessons.filter((l) => l.completed).length;
  const totalLessons = lessons.length;
  const overallPercent = totalLessons ? Math.round((totalCompleted / totalLessons) * 100) : 0;
  const thisWeek = getMondayISO();

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-[#FAD7D7] border-t-[#D96969] rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <header className="mb-5">
        <h1 className="text-3xl font-bold" style={{ color: '#D96969' }}>
          Learning Dashboard
        </h1>
        <p className="mt-1 text-black/50 font-medium">
          {kid?.name ? `${kid.name}'s progress over the weeks` : 'Progress over the weeks'}
        </p>
      </header>

      {/* Overall progress card */}
      <div className="rounded-[28px] bg-gradient-to-br from-[#4969E1] to-[#7B4FE0] p-5 text-white mb-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-5 w-5" />
          <span className="font-semibold">Overall completion</span>
        </div>
        <div className="flex items-end gap-2">
          <span className="text-4xl font-bold">{overallPercent}%</span>
          <span className="text-sm font-medium opacity-80 mb-1">
            {totalCompleted} of {totalLessons} lessons
          </span>
        </div>
        <div className="mt-3 h-2.5 w-full rounded-full bg-white/25 overflow-hidden">
          <div
            className="h-full rounded-full bg-white transition-all duration-500"
            style={{ width: `${overallPercent}%` }}
          />
        </div>
      </div>

      {/* Weeks list */}
      <h2 className="text-sm font-bold uppercase tracking-wide text-black/40 mb-3 px-1">
        Weeks
      </h2>

      {weeks.length === 0 ? (
        <p className="text-center text-black/40 font-medium py-10">
          No lessons yet. Start with this week's plan.
        </p>
      ) : (
        <div className="space-y-3">
          {weeks.map((w) => {
            const isCurrent = w.weekStart === thisWeek;
            return (
              <Link
                key={w.weekStart}
                to="/"
                className="block rounded-2xl bg-white p-4 shadow-sm hover:shadow-md active:scale-[0.99] transition"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-black/80">
                        {formatWeekRange(w.weekStart)}
                      </span>
                      {isCurrent && (
                        <span className="rounded-full bg-[#E0F5FF] px-2 py-0.5 text-xs font-bold text-[#2B6FE0]">
                          This week
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      {DAYS.map((d) => {
                        const l = w.lessons.find((x) => x.day === d.key);
                        return (
                          <span
                            key={d.key}
                            title={d.label}
                            className={`flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold ${
                              l?.completed
                                ? 'bg-green-100 text-green-600'
                                : 'bg-black/5 text-black/30'
                            }`}
                          >
                            {d.label[0]}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-2xl font-bold" style={{ color: '#D96969' }}>
                      {w.completed}<span className="text-base text-black/30">/5</span>
                    </div>
                    <div className="flex items-center gap-0.5 text-xs font-semibold text-black/40">
                      {w.percent}% <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </Layout>
  );
}