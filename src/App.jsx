import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Dot
} from 'recharts';
import { Download, Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  fetchMetrics, fetchActivities, fetchExpenses, fetchNotes, fetchRemarks,
  upsertMetric, upsertActivity, addExpense, deleteExpense,
  addNote, deleteNote, upsertRemark, exportToCSV
} from './lib/supabase';
import './App.css';

const TODAY = new Date().toISOString().split('T')[0];
const EXPENSE_CATEGORIES = ['Food', 'Transport', 'Shopping', 'Health', 'Entertainment', 'Utilities', 'Other'];

function toDecimalHours(hrs, mins) {
  return parseFloat(hrs || 0) + parseFloat(mins || 0) / 60;
}

function formatHours(decimal) {
  if (!decimal && decimal !== 0) return '—';
  const h = Math.floor(decimal);
  const m = Math.round((decimal - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function isSatisfactory(metric, activity) {
  if (!metric && !activity) return false;
  const m = metric || {};
  const a = activity || {};
  return (
    (a.gym || a.basketball) &&
    a.athletic_work &&
    a.skincare &&
    a.reading &&
    a.room_cleaning &&
    (parseFloat(m.sleep_hours) > 8) &&
    (parseFloat(m.work_hours) > 4) &&
    (parseFloat(m.study_hours) > 1)
  );
}

function weeklyAvg(entries, field) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const cutoff = sevenDaysAgo.toISOString().split('T')[0];
  const recent = entries.filter(e => e.date >= cutoff && e[field] != null);
  if (!recent.length) return null;
  return recent.reduce((s, e) => s + parseFloat(e[field]), 0) / recent.length;
}

// ── Custom dot for line charts ────────────────────────────────────────────────
const CustomDot = ({ cx, cy, fill }) => (
  <circle cx={cx} cy={cy} r={3} fill={fill} stroke="var(--bg)" strokeWidth={1.5} />
);

// ── Calendar component (view only) ────────────────────────────────────────────
function CalendarView({ title, markedDates, color }) {
  const [viewDate, setViewDate] = useState(new Date());
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="cal-widget">
      <div className="cal-header">
        <span className="cal-title">{title}</span>
        <div className="cal-nav">
          <button onClick={() => setViewDate(new Date(year, month - 1, 1))}><ChevronLeft size={14} /></button>
          <span>{viewDate.toLocaleString('default', { month: 'short', year: 'numeric' })}</span>
          <button onClick={() => setViewDate(new Date(year, month + 1, 1))}><ChevronRight size={14} /></button>
        </div>
      </div>
      <div className="cal-grid">
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <div key={i} className="cal-dow">{d}</div>
        ))}
        {cells.map((day, i) => {
          const dateStr = day ? `${monthStr}-${String(day).padStart(2, '0')}` : null;
          const marked = dateStr && markedDates.includes(dateStr);
          return (
            <div
              key={i}
              className={`cal-cell ${day ? 'cal-has-day' : ''} ${marked ? 'cal-marked' : ''}`}
              style={marked ? { background: color, color: '#0d0d0d' } : {}}
            >
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Bar chart ─────────────────────────────────────────────────────────────────
function BarMetricChart({ title, data, color, formatTick, unit }) {
  if (!data || data.length === 0) return (
    <div className="chart-box">
      <div className="chart-box-title">{title}</div>
      <div className="empty-state">No data yet</div>
    </div>
  );
  return (
    <div className="chart-box">
      <div className="chart-box-title">{title}</div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data.slice(-60)} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis dataKey="date" stroke="rgba(255,255,255,0.15)" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} tickFormatter={d => d.slice(5)} interval="preserveStartEnd" />
          <YAxis stroke="rgba(255,255,255,0.15)" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} tickFormatter={formatTick} />
          <Tooltip
            contentStyle={{ background: '#181818', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, fontSize: 12 }}
            labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
            formatter={v => [formatTick ? formatTick(v) : `${v}${unit ? ' ' + unit : ''}`, '']}
          />
          <Bar dataKey="value" fill={color} radius={[3,3,0,0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Line chart with dots ──────────────────────────────────────────────────────
function LineMetricChart({ title, data, color, formatTick, unit }) {
  if (!data || data.length === 0) return (
    <div className="chart-box">
      <div className="chart-box-title">{title}</div>
      <div className="empty-state">No data yet</div>
    </div>
  );
  return (
    <div className="chart-box">
      <div className="chart-box-title">{title}</div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data.slice(-60)} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis dataKey="date" stroke="rgba(255,255,255,0.15)" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} tickFormatter={d => d.slice(5)} interval="preserveStartEnd" />
          <YAxis stroke="rgba(255,255,255,0.15)" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} tickFormatter={formatTick} domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{ background: '#181818', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, fontSize: 12 }}
            labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
            formatter={v => [formatTick ? formatTick(v) : `${v}${unit ? ' ' + unit : ''}`, '']}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={<CustomDot fill={color} />}
            activeDot={{ r: 5, fill: color }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Weekly stat card ──────────────────────────────────────────────────────────
function WeeklyCard({ label, value }) {
  return (
    <div className="card stat-card">
      <div className="card-label">{label}</div>
      <div className="stat-value">{value !== null ? formatHours(value) : '—'}</div>
      <div className="stat-sub">7-day avg</div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [sideTab, setSideTab] = useState('dashboard');
  const [analyticsTab, setAnalyticsTab] = useState('graphs');

  const [metrics, setMetrics] = useState([]);
  const [activities, setActivities] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [todayMetric, setTodayMetric] = useState({
    weight: '', work_h: '', work_m: '', sleep_h: '', sleep_m: '', study_h: '', study_m: ''
  });
  const [todayActivity, setTodayActivity] = useState({
    gym: false, basketball: false, athletic_work: false,
    skincare: false, reading: false, room_cleaning: false
  });
  const [expenseForm, setExpenseForm] = useState({ category: 'Food', amount: '' });
  const [noteText, setNoteText] = useState('');
  const [remarkText, setRemarkText] = useState('');
  const [todayRemark, setTodayRemark] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [m, a, e, n, r] = await Promise.all([
        fetchMetrics(), fetchActivities(), fetchExpenses(), fetchNotes(), fetchRemarks()
      ]);
      setMetrics(m);
      setActivities(a);
      setExpenses(e);
      setNotes(n);

      const tm = m.find(x => x.date === TODAY);
      if (tm) {
        const wh = Math.floor(tm.work_hours || 0), wm = Math.round(((tm.work_hours || 0) - wh) * 60);
        const sh = Math.floor(tm.sleep_hours || 0), sm = Math.round(((tm.sleep_hours || 0) - sh) * 60);
        const sth = Math.floor(tm.study_hours || 0), stm = Math.round(((tm.study_hours || 0) - sth) * 60);
        setTodayMetric({
          weight: tm.weight || '',
          work_h: wh || '', work_m: wm || '',
          sleep_h: sh || '', sleep_m: sm || '',
          study_h: sth || '', study_m: stm || ''
        });
      }
      const ta = a.find(x => x.date === TODAY);
      if (ta) setTodayActivity({
        gym: ta.gym, basketball: ta.basketball, athletic_work: ta.athletic_work,
        skincare: ta.skincare, reading: ta.reading, room_cleaning: ta.room_cleaning || false
      });

      const tr = r.find(x => x.date === TODAY);
      if (tr) setTodayRemark(tr.text);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const saveMetricsAndActivities = async () => {
    setSaving(true);
    try {
      await upsertMetric(TODAY, {
        weight: todayMetric.weight ? parseFloat(todayMetric.weight) : null,
        work_hours: toDecimalHours(todayMetric.work_h, todayMetric.work_m) || null,
        sleep_hours: toDecimalHours(todayMetric.sleep_h, todayMetric.sleep_m) || null,
        study_hours: toDecimalHours(todayMetric.study_h, todayMetric.study_m) || null,
      });
      await upsertActivity(TODAY, todayActivity);
      await loadAll();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const handleAddExpense = async () => {
    if (!expenseForm.amount) return;
    await addExpense(TODAY, expenseForm.category, parseFloat(expenseForm.amount));
    setExpenseForm({ category: 'Food', amount: '' });
    const e = await fetchExpenses();
    setExpenses(e);
  };

  const handleDeleteExpense = async (id) => {
    await deleteExpense(id);
    setExpenses(prev => prev.filter(e => e.id !== id));
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    await addNote(TODAY, noteText.trim());
    setNoteText('');
    const n = await fetchNotes();
    setNotes(n);
  };

  const handleDeleteNote = async (id) => {
    await deleteNote(id);
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  const handleSaveRemark = async () => {
    if (!remarkText.trim()) return;
    await upsertRemark(TODAY, remarkText.trim());
    setTodayRemark(remarkText.trim());
    setRemarkText('');
  };

  // ── Derived ─────────────────────────────────────────────────────────────────
  const latestWeight = metrics.filter(m => m.weight != null).slice(-1)[0];
  const avgWork  = weeklyAvg(metrics, 'work_hours');
  const avgSleep = weeklyAvg(metrics, 'sleep_hours');
  const avgStudy = weeklyAvg(metrics, 'study_hours');

  const pieData = (() => {
    const allDates = new Set([...metrics.map(m => m.date), ...activities.map(a => a.date)]);
    let sat = 0, unsat = 0;
    for (const date of allDates) {
      const m = metrics.find(x => x.date === date);
      const a = activities.find(x => x.date === date);
      if (isSatisfactory(m, a)) sat++; else unsat++;
    }
    return [{ name: 'Satisfactory', value: sat }, { name: 'Unsatisfactory', value: unsat }];
  })();

  const todaySatisfactory = isSatisfactory(
    metrics.find(m => m.date === TODAY),
    activities.find(a => a.date === TODAY)
  );

  const todayExpenses = expenses.filter(e => e.date === TODAY);

  const expenseByDate = expenses.reduce((acc, e) => {
    acc[e.date] = (acc[e.date] || 0) + Number(e.amount);
    return acc;
  }, {});
  const expenseChartData = Object.entries(expenseByDate).sort().map(([date, value]) => ({ date, value }));

  const ACTIVITIES = [
    { key: 'gym',          label: 'Gym' },
    { key: 'basketball',   label: 'Basketball' },
    { key: 'athletic_work',label: 'Athletic Work' },
    { key: 'skincare',     label: 'Skincare' },
    { key: 'reading',      label: 'Reading' },
    { key: 'room_cleaning',label: 'Room Cleaning' },
  ];

  if (loading) return (
    <div className="loading-screen"><div className="loading-dot" /></div>
  );

  return (
    <div className="app">
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-dot" />
          <span>Personal</span>
        </div>
        <nav className="sidebar-nav">
          <button className={`nav-item ${sideTab === 'dashboard' ? 'nav-active' : ''}`} onClick={() => setSideTab('dashboard')}>
            Dashboard
          </button>
          <button className={`nav-item ${sideTab === 'analytics' ? 'nav-active' : ''}`} onClick={() => setSideTab('analytics')}>
            Analytics
          </button>
        </nav>
        <button className="export-btn" onClick={() => exportToCSV(metrics, activities, expenses)}>
          <Download size={14} /> Export CSV
        </button>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <main className="main">

        {/* ══ DASHBOARD ══════════════════════════════════════════════════════ */}
        {sideTab === 'dashboard' && (
          <div className="page">
            <div className="page-header">
              <div>
                <h1 className="page-title">Dashboard</h1>
                <p className="page-sub">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
              </div>
              <div className={`satisfaction-badge ${todaySatisfactory ? 'badge-sat' : 'badge-unsat'}`}>
                {todaySatisfactory ? 'Satisfactory' : 'Unsatisfactory'}
              </div>
            </div>

            <div className="dash-grid">

              {/* Today's Entry */}
              <section className="card entry-card">
                <div className="card-label">Today's Entry</div>
                <div className="entry-metrics">
                  <div className="entry-field">
                    <label>Weight (kg)</label>
                    <input type="number" placeholder="0.0" value={todayMetric.weight}
                      onChange={e => setTodayMetric(p => ({ ...p, weight: e.target.value }))} step="0.1" />
                  </div>
                  <div className="entry-field">
                    <label>Work Hours</label>
                    <div className="time-input">
                      <input type="number" placeholder="hrs" min="0" max="24" value={todayMetric.work_h}
                        onChange={e => setTodayMetric(p => ({ ...p, work_h: e.target.value }))} />
                      <span>:</span>
                      <input type="number" placeholder="min" min="0" max="59" value={todayMetric.work_m}
                        onChange={e => setTodayMetric(p => ({ ...p, work_m: e.target.value }))} />
                    </div>
                  </div>
                  <div className="entry-field">
                    <label>Sleep Hours</label>
                    <div className="time-input">
                      <input type="number" placeholder="hrs" min="0" max="24" value={todayMetric.sleep_h}
                        onChange={e => setTodayMetric(p => ({ ...p, sleep_h: e.target.value }))} />
                      <span>:</span>
                      <input type="number" placeholder="min" min="0" max="59" value={todayMetric.sleep_m}
                        onChange={e => setTodayMetric(p => ({ ...p, sleep_m: e.target.value }))} />
                    </div>
                  </div>
                  <div className="entry-field">
                    <label>Study Hours</label>
                    <div className="time-input">
                      <input type="number" placeholder="hrs" min="0" max="24" value={todayMetric.study_h}
                        onChange={e => setTodayMetric(p => ({ ...p, study_h: e.target.value }))} />
                      <span>:</span>
                      <input type="number" placeholder="min" min="0" max="59" value={todayMetric.study_m}
                        onChange={e => setTodayMetric(p => ({ ...p, study_m: e.target.value }))} />
                    </div>
                  </div>
                </div>

                <div className="activity-checks">
                  {ACTIVITIES.map(({ key, label }) => (
                    <label key={key} className="check-label">
                      <input type="checkbox" checked={todayActivity[key]}
                        onChange={e => setTodayActivity(p => ({ ...p, [key]: e.target.checked }))} />
                      <span className="check-box" />
                      {label}
                    </label>
                  ))}
                </div>

                <button className="save-btn" onClick={saveMetricsAndActivities} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Today'}
                </button>
              </section>

              {/* Expense entry */}
              <section className="card expense-card">
                <div className="card-label">Today's Expenses</div>
                <div className="expense-form">
                  <select value={expenseForm.category} onChange={e => setExpenseForm(p => ({ ...p, category: e.target.value }))}>
                    {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                  <input type="number" placeholder="Amount (₹)" value={expenseForm.amount}
                    onChange={e => setExpenseForm(p => ({ ...p, amount: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleAddExpense()} />
                  <button className="icon-btn" onClick={handleAddExpense}><Plus size={16} /></button>
                </div>
                <div className="expense-list">
                  {todayExpenses.length === 0 && <div className="empty-state">No expenses logged today</div>}
                  {todayExpenses.map(e => (
                    <div key={e.id} className="expense-item">
                      <span className="expense-cat">{e.category}</span>
                      <span className="expense-amt">₹{Number(e.amount).toLocaleString('en-IN')}</span>
                      <button className="del-btn" onClick={() => handleDeleteExpense(e.id)}><Trash2 size={12} /></button>
                    </div>
                  ))}
                  {todayExpenses.length > 0 && (
                    <div className="expense-total">
                      Total — ₹{todayExpenses.reduce((s, e) => s + Number(e.amount), 0).toLocaleString('en-IN')}
                    </div>
                  )}
                </div>
              </section>

              {/* Weight card */}
              <section className="card stat-card">
                <div className="card-label">Current Weight</div>
                <div className="stat-value">{latestWeight ? `${latestWeight.weight}` : '—'}</div>
                <div className="stat-unit-label">kg &nbsp;·&nbsp; {latestWeight ? latestWeight.date : 'No data'}</div>
              </section>

              {/* Weekly avg cards */}
              <WeeklyCard label="Avg Work" value={avgWork} />
              <WeeklyCard label="Avg Sleep" value={avgSleep} />
              <WeeklyCard label="Avg Study" value={avgStudy} />

              {/* Pie chart */}
              <section className="card pie-card">
                <div className="card-label">Day Quality</div>
                {pieData[0].value + pieData[1].value === 0
                  ? <div className="empty-state">No data yet</div>
                  : (
                    <div className="pie-wrap">
                      <PieChart width={150} height={150}>
                        <Pie data={pieData} cx={70} cy={70} innerRadius={44} outerRadius={65} dataKey="value" strokeWidth={0}>
                          <Cell fill="#7c9885" />
                          <Cell fill="#222222" />
                        </Pie>
                      </PieChart>
                      <div className="pie-legend">
                        <div className="pie-leg-item"><span style={{ background: '#7c9885' }} />{pieData[0].value} Satisfactory</div>
                        <div className="pie-leg-item"><span style={{ background: '#333' }} />{pieData[1].value} Unsatisfactory</div>
                        {(pieData[0].value + pieData[1].value) > 0 && (
                          <div className="pie-rate">
                            {Math.round(pieData[0].value / (pieData[0].value + pieData[1].value) * 100)}% rate
                          </div>
                        )}
                      </div>
                    </div>
                  )}
              </section>

              {/* Remark of the day */}
              <section className="card remark-card">
                <div className="card-label">Remark of the Day</div>
                {todayRemark && <p className="remark-display">"{todayRemark}"</p>}
                <div className="remark-form">
                  <input type="text"
                    placeholder={todayRemark ? 'Update remark…' : "Write today's remark…"}
                    value={remarkText}
                    onChange={e => setRemarkText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveRemark()} />
                  <button className="icon-btn" onClick={handleSaveRemark}><Plus size={16} /></button>
                </div>
              </section>

              {/* Notes */}
              <section className="card notes-card">
                <div className="card-label">Notes</div>
                <div className="note-form">
                  <input type="text" placeholder="Add a note…" value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddNote()} />
                  <button className="icon-btn" onClick={handleAddNote}><Plus size={16} /></button>
                </div>
                <div className="notes-list">
                  {notes.length === 0 && <div className="empty-state">No notes yet</div>}
                  {notes.slice(0, 10).map(n => (
                    <div key={n.id} className="note-item">
                      <div className="note-content">
                        <span className="note-text">{n.text}</span>
                        <span className="note-date">{n.date}</span>
                      </div>
                      <button className="del-btn" onClick={() => handleDeleteNote(n.id)}><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
              </section>

            </div>
          </div>
        )}

        {/* ══ ANALYTICS ══════════════════════════════════════════════════════ */}
        {sideTab === 'analytics' && (
          <div className="page">
            <div className="page-header">
              <div>
                <h1 className="page-title">Analytics</h1>
                <p className="page-sub">Your data over time</p>
              </div>
            </div>

            <div className="browser-tabs">
              <button className={`browser-tab ${analyticsTab === 'graphs' ? 'browser-tab-active' : ''}`} onClick={() => setAnalyticsTab('graphs')}>Graphs</button>
              <button className={`browser-tab ${analyticsTab === 'calendars' ? 'browser-tab-active' : ''}`} onClick={() => setAnalyticsTab('calendars')}>Calendars</button>
            </div>

            {analyticsTab === 'graphs' && (
              <div className="charts-grid">
                <LineMetricChart
                  title="Weight (kg)"
                  data={metrics.filter(m => m.weight != null).map(m => ({ date: m.date, value: m.weight }))}
                  color="#8fa8a0"
                  unit="kg"
                />
                <BarMetricChart
                  title="Work Hours"
                  data={metrics.filter(m => m.work_hours != null).map(m => ({ date: m.date, value: m.work_hours }))}
                  color="#7c8fa8"
                  formatTick={formatHours}
                />
                <BarMetricChart
                  title="Sleep Hours"
                  data={metrics.filter(m => m.sleep_hours != null).map(m => ({ date: m.date, value: m.sleep_hours }))}
                  color="#a08fa8"
                  formatTick={formatHours}
                />
                <BarMetricChart
                  title="Study Hours"
                  data={metrics.filter(m => m.study_hours != null).map(m => ({ date: m.date, value: m.study_hours }))}
                  color="#a8a07c"
                  formatTick={formatHours}
                />
                <LineMetricChart
                  title="Daily Expenses (₹)"
                  data={expenseChartData}
                  color="#a08f7c"
                  unit="₹"
                />
              </div>
            )}

            {analyticsTab === 'calendars' && (
              <div className="calendars-grid">
                <CalendarView title="Gym"           markedDates={activities.filter(a => a.gym).map(a => a.date)}           color="#7c9885" />
                <CalendarView title="Basketball"    markedDates={activities.filter(a => a.basketball).map(a => a.date)}    color="#7c8895" />
                <CalendarView title="Athletic Work" markedDates={activities.filter(a => a.athletic_work).map(a => a.date)} color="#957c7c" />
                <CalendarView title="Skincare"      markedDates={activities.filter(a => a.skincare).map(a => a.date)}      color="#957c8f" />
                <CalendarView title="Reading"       markedDates={activities.filter(a => a.reading).map(a => a.date)}       color="#8f957c" />
                <CalendarView title="Room Cleaning" markedDates={activities.filter(a => a.room_cleaning).map(a => a.date)} color="#7c8f95" />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
