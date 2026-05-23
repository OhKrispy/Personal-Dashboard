import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// ── Metrics ──────────────────────────────────────────────────────────────────
export async function upsertMetric(date, fields) {
  const { data, error } = await supabase
    .from('metrics')
    .upsert({ date, ...fields, updated_at: new Date().toISOString() }, { onConflict: 'date' })
    .select();
  if (error) throw error;
  return data[0];
}

export async function fetchMetrics() {
  const { data, error } = await supabase
    .from('metrics')
    .select('*')
    .order('date', { ascending: true });
  if (error) throw error;
  return data;
}

// ── Activities ────────────────────────────────────────────────────────────────
export async function upsertActivity(date, fields) {
  const { data, error } = await supabase
    .from('activities')
    .upsert({ date, ...fields, updated_at: new Date().toISOString() }, { onConflict: 'date' })
    .select();
  if (error) throw error;
  return data[0];
}

export async function fetchActivities() {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .order('date', { ascending: true });
  if (error) throw error;
  return data;
}

// ── Expenses ──────────────────────────────────────────────────────────────────
export async function addExpense(date, category, amount) {
  const { data, error } = await supabase
    .from('expenses')
    .insert({ date, category, amount })
    .select();
  if (error) throw error;
  return data[0];
}

export async function deleteExpense(id) {
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchExpenses() {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .order('date', { ascending: true });
  if (error) throw error;
  return data;
}

// ── Notes ─────────────────────────────────────────────────────────────────────
export async function addNote(date, text) {
  const { data, error } = await supabase
    .from('notes')
    .insert({ date, text })
    .select();
  if (error) throw error;
  return data[0];
}

export async function deleteNote(id) {
  const { error } = await supabase.from('notes').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchNotes() {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

// ── Remarks ───────────────────────────────────────────────────────────────────
export async function upsertRemark(date, text) {
  const { data, error } = await supabase
    .from('remarks')
    .upsert({ date, text, updated_at: new Date().toISOString() }, { onConflict: 'date' })
    .select();
  if (error) throw error;
  return data[0];
}

export async function fetchRemarks() {
  const { data, error } = await supabase
    .from('remarks')
    .select('*')
    .order('date', { ascending: false });
  if (error) throw error;
  return data;
}

// ── CSV Export ────────────────────────────────────────────────────────────────
export function exportToCSV(metrics, activities, expenses) {
  const allDates = new Set([
    ...metrics.map(m => m.date),
    ...activities.map(a => a.date),
  ]);

  const headers = [
    'Date', 'Weight (kg)', 'Work Hours', 'Sleep Hours', 'Study Hours',
    'Gym', 'Basketball', 'Athletic Work', 'Skincare', 'Reading', 'Room Cleaning',
    'Total Expenses (INR)', 'Satisfactory'
  ];

  const rows = Array.from(allDates).sort().map(date => {
    const m = metrics.find(x => x.date === date) || {};
    const a = activities.find(x => x.date === date) || {};
    const dayExpenses = expenses.filter(x => x.date === date);
    const totalExpense = dayExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

    const satisfactory = (
      (a.gym || a.basketball) &&
      a.athletic_work &&
      a.skincare &&
      a.reading &&
      a.room_cleaning &&
      (parseFloat(m.sleep_hours) > 8) &&
      (parseFloat(m.work_hours) > 4) &&
      (parseFloat(m.study_hours) > 1)
    ) ? 'Yes' : 'No';

    return [
      date,
      m.weight || '',
      m.work_hours ? m.work_hours.toFixed(2) : '',
      m.sleep_hours ? m.sleep_hours.toFixed(2) : '',
      m.study_hours ? m.study_hours.toFixed(2) : '',
      a.gym ? 'Yes' : 'No',
      a.basketball ? 'Yes' : 'No',
      a.athletic_work ? 'Yes' : 'No',
      a.skincare ? 'Yes' : 'No',
      a.reading ? 'Yes' : 'No',
      a.room_cleaning ? 'Yes' : 'No',
      totalExpense || '',
      satisfactory
    ].join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dashboard-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
