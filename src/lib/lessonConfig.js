// Shared configuration for the weekly lesson plan days.
// Colors and subjects match the home-page design reference.

export const DAYS = [
  {
    key: 'monday',
    label: 'Monday',
    subject: 'Numbers',
    bg: '#EBE4DE',
    titleColor: '#D96969',
    titleStroke: '#F4B6B6',
    graphic: 'numbers',
  },
  {
    key: 'tuesday',
    label: 'Tuesday',
    subject: 'Letters',
    bg: '#E0F5FF',
    titleColor: '#7B4FE0',
    titleStroke: '#C9B6F4',
    graphic: 'letters',
  },
  {
    key: 'wednesday',
    label: 'Wednesday',
    subject: 'Stretch time',
    bg: '#E0F5D5',
    titleColor: '#E0A800',
    titleStroke: '#3a3a3a',
    graphic: 'stretch',
  },
  {
    key: 'thursday',
    label: 'Thursday',
    subject: 'Music',
    bg: '#FEF5B0',
    titleColor: '#2B6FE0',
    titleStroke: '#ffffff',
    graphic: 'music',
  },
  {
    key: 'friday',
    label: 'Friday',
    subject: 'Exercises',
    bg: '#FAD7D7',
    titleColor: '#2B6FE0',
    titleStroke: '#ffffff',
    graphic: 'exercise',
  },
];

export const DAY_MAP = DAYS.reduce((acc, d) => {
  acc[d.key] = d;
  return acc;
}, {});

// Returns the ISO date (yyyy-mm-dd) of the Monday for the week containing the given date.
export function getMondayISO(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday ... 6 = Saturday
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export function addWeeksISO(mondayISO, weeks) {
  const d = new Date(mondayISO + 'T00:00:00');
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

export function formatWeekRange(mondayISO) {
  const start = new Date(mondayISO + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 4);
  const opt = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString(undefined, opt)} – ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}