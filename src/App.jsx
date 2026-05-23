import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { Download, Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  fetchMetrics, fetchActivities, fetchExpenses, fetchNotes, fetchRemarks,
  upsertMetric, upsertActivity, addExpense, deleteExpense,
  addNote, deleteNote, upsertRemark, exportToCSV
} from './lib/supabase';
import './App.css';

const TODAY = new Date().toISOString().split('T')[0];

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
    a.athletic_work && a.skincare && a.reading && a.room_cleaning &&
    parseFloat(m.sleep_hours) > 8 &&
    parseFloat(m.work_hours) > 4 &&
    parseFloat(m.study_hours) > 1
  );
}

function weeklyAvg(entries, field) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 6);
  const co = cutoff.toISOString().split('T')[0];
  const recent = entries.filter(e => e.date >= co && e[field] != null);
  if (!recent.length) return null;
  return recent.reduce((s, e) => s + parseFloat(e[field]), 0) / recent.length;
}

// Custom dot for line charts
const LineDot = ({ cx, cy, fill }) => (
  <circle cx={cx} cy={cy} r={3.5} fill={fill} stroke="#111" strokeWidth={1.5} />
);

// Custom donut center label
const DonutLabel = ({ viewBox, rate }) => {
  const { cx, cy } = viewBox;
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
      <tspan x={cx} dy="-0.2em" fontSize="22" fontWeight="600" fill="#5a9e6f" fontFamily="JetBrains Mono, monospace">
        {rate}%
      </tspan>
      <tspan x={cx} dy="1.4em" fontSize="11" fill="#666" fontFamily="Inter, sans-serif">
        satisfactory
      </tspan>
    </text>
  );
};

// Calendar
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
          <button onClick={() => setViewDate(new Date(year, month - 1, 1))}><ChevronLeft size={13} /></button>
          <span>{viewDate.toLocaleString('default', { month: 'short', year: 'numeric' })}</span>
          <button onClick={() => setViewDate(new Date(year, month + 1, 1))}><ChevronRight size={13} /></button>
        </div>
      </div>
      <div className="cal-grid">
        {['S','M','T','W','T','F','S'].map((d, i) => <div key={i} className="cal-dow">{d}</div>)}
        {cells.map((day, i) => {
          const dateStr = day ? `${monthStr}-${String(day).padStart(2, '0')}` : null;
          const marked = dateStr && markedDates.includes(dateStr);
          return (
            <div key={i}
              className={`cal-cell ${day ? 'cal-has-day' : ''} ${marked ? 'cal-marked' : ''}`}
              style={marked ? { background: color, color: '#111', borderRadius: 6 } : {}}
            >{day}</div>
          );
        })}
      </div>
    </div>
  );
}

function BarMetricChart({ title, data, color, formatTick }) {
  if (!data?.length) return (
    <div className="chart-box"><div className="chart-box-title">{title}</div><div className="empty-state">No data yet</div></div>
  );
  return (
    <div className="chart-box">
      <div className="chart-box-title">{title}</div>
      <ResponsiveContainer width="100%" height={190}>
        <BarChart data={data.slice(-60)} margin={{ top:4, right:8, left:-20, bottom:0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis dataKey="date" stroke="rgba(255,255,255,0.15)" tick={{ fontSize:10, fill:'#666', fontFamily:'Inter' }} tickFormatter={d => d.slice(5)} interval="preserveStartEnd" />
          <YAxis stroke="rgba(255,255,255,0.15)" tick={{ fontSize:10, fill:'#666', fontFamily:'Inter' }} tickFormatter={formatTick} />
          <Tooltip contentStyle={{ background:'#1a1a1a', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, fontSize:12, fontFamily:'Inter' }} labelStyle={{ color:'#999' }} formatter={v => [formatTick ? formatTick(v) : v, '']} />
          <Bar dataKey="value" fill={color} radius={[4,4,0,0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function LineMetricChart({ title, data, color, formatTick, unit }) {
  if (!data?.length) return (
    <div className="chart-box"><div className="chart-box-title">{title}</div><div className="empty-state">No data yet</div></div>
  );
  return (
    <div className="chart-box">
      <div className="chart-box-title">{title}</div>
      <ResponsiveContainer width="100%" height={190}>
        <LineChart data={data.slice(-60)} margin={{ top:8, right:12, left:-20, bottom:0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis dataKey="date" stroke="rgba(255,255,255,0.15)" tick={{ fontSize:10, fill:'#666', fontFamily:'Inter' }} tickFormatter={d => d.slice(5)} interval="preserveStartEnd" />
          <YAxis stroke="rgba(255,255,255,0.15)" tick={{ fontSize:10, fill:'#666', fontFamily:'Inter' }} tickFormatter={formatTick} domain={['auto','auto']} />
          <Tooltip contentStyle={{ background:'#1a1a1a', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, fontSize:12, fontFamily:'Inter' }} labelStyle={{ color:'#999' }} formatter={v => [formatTick ? formatTick(v) : `${v}${unit ? ' '+unit : ''}`, '']} />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={<LineDot fill={color} />} activeDot={{ r:5, fill:color }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function App() {
  const [sideTab, setSideTab] = useState('dashboard');
  const [analyticsTab, setAnalyticsTab] = useState('graphs');
  const [metrics, setMetrics] = useState([]);
  const [activities, setActivities] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [todayMetric, setTodayMetric] = useState({ weight:'', work_h:'', work_m:'', sleep_h:'', sleep_m:'', study_h:'', study_m:'' });
  const [todayActivity, setTodayActivity] = useState({ gym:false, basketball:false, athletic_work:false, skincare:false, reading:false, room_cleaning:false });

  // Finance form
  const [finSign, setFinSign] = useState('+');
  const [finCat, setFinCat] = useState('');
  const [finAmt, setFinAmt] = useState('');

  const [noteText, setNoteText] = useState('');
  const [remarkText, setRemarkText] = useState('');
  const [todayRemark, setTodayRemark] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [m, a, e, n, r] = await Promise.all([fetchMetrics(), fetchActivities(), fetchExpenses(), fetchNotes(), fetchRemarks()]);
      setMetrics(m); setActivities(a); setExpenses(e); setNotes(n);

      const tm = m.find(x => x.date === TODAY);
      if (tm) {
        const wh=Math.floor(tm.work_hours||0), wm=Math.round(((tm.work_hours||0)-wh)*60);
        const sh=Math.floor(tm.sleep_hours||0), sm=Math.round(((tm.sleep_hours||0)-sh)*60);
        const sth=Math.floor(tm.study_hours||0), stm=Math.round(((tm.study_hours||0)-sth)*60);
        setTodayMetric({ weight:tm.weight||'', work_h:wh||'', work_m:wm||'', sleep_h:sh||'', sleep_m:sm||'', study_h:sth||'', study_m:stm||'' });
      }
      const ta = a.find(x => x.date === TODAY);
      if (ta) setTodayActivity({ gym:ta.gym, basketball:ta.basketball, athletic_work:ta.athletic_work, skincare:ta.skincare, reading:ta.reading, room_cleaning:ta.room_cleaning||false });
      const tr = r.find(x => x.date === TODAY);
      if (tr) setTodayRemark(tr.text);
    } catch(err) { console.error(err); }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleSave = async () => {
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
    } catch(err) { console.error(err); }
    setSaving(false);
  };

  const handleAddExpense = async () => {
    if (!finAmt || !finCat.trim()) return;
    // Store positive for income (+), negative for expense (-)
    const amount = finSign === '+' ? parseFloat(finAmt) : -parseFloat(finAmt);
    await addExpense(TODAY, finCat.trim(), amount);
    setFinAmt(''); setFinCat('');
    const e = await fetchExpenses(); setExpenses(e);
  };

  const handleDeleteExpense = async (id) => {
    await deleteExpense(id);
    setExpenses(prev => prev.filter(e => e.id !== id));
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    await addNote(TODAY, noteText.trim());
    setNoteText('');
    const n = await fetchNotes(); setNotes(n);
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

  // Derived
  const latestWeight = metrics.filter(m => m.weight != null).slice(-1)[0];
  const avgWork  = weeklyAvg(metrics, 'work_hours');
  const avgSleep = weeklyAvg(metrics, 'sleep_hours');
  const avgStudy = weeklyAvg(metrics, 'study_hours');

  const allDates = new Set([...metrics.map(m => m.date), ...activities.map(a => a.date)]);
  let satCount = 0;
  for (const date of allDates) {
    if (isSatisfactory(metrics.find(x => x.date === date), activities.find(x => x.date === date))) satCount++;
  }
  const totalDays = allDates.size;
  const satRate = totalDays > 0 ? Math.round(satCount / totalDays * 100) : 0;
  const pieData = [{ name:'Satisfactory', value:satCount }, { name:'Other', value:totalDays - satCount }];

  const todaySatisfactory = isSatisfactory(metrics.find(m => m.date === TODAY), activities.find(a => a.date === TODAY));

  const todayExpenses = expenses.filter(e => e.date === TODAY);
  const todayNet = todayExpenses.reduce((s, e) => s + Number(e.amount), 0);

  const expenseByDate = expenses.reduce((acc, e) => { acc[e.date] = (acc[e.date]||0) + Number(e.amount); return acc; }, {});
  const expenseChartData = Object.entries(expenseByDate).sort().map(([date, value]) => ({ date, value }));

  const ACTIVITIES = [
    { key:'gym', label:'Gym' },
    { key:'basketball', label:'Basketball' },
    { key:'athletic_work', label:'Athletic Work' },
    { key:'skincare', label:'Skincare' },
    { key:'reading', label:'Reading' },
    { key:'room_cleaning', label:'Room Cleaning' },
  ];

  if (loading) return <div className="loading-screen"><div className="loading-dot" /></div>;

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand"><span className="brand-dot" />Personal</div>
        <nav className="sidebar-nav">
          <button className={`nav-item ${sideTab==='dashboard'?'nav-active':''}`} onClick={() => setSideTab('dashboard')}>Dashboard</button>
          <button className={`nav-item ${sideTab==='analytics'?'nav-active':''}`} onClick={() => setSideTab('analytics')}>Analytics</button>
        </nav>
        <button className="export-btn" onClick={() => exportToCSV(metrics, activities, expenses)}>
          <Download size={14} /> Export CSV
        </button>
      </aside>

      <main className="main">
        {/* ══ DASHBOARD ══════════════════════════════════════════ */}
        {sideTab === 'dashboard' && (
          <div className="page">
            <div className="page-header">
              <div>
                <h1 className="page-title">Dashboard</h1>
                <p className="page-sub">{new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })}</p>
              </div>
              <div className={`satisfaction-badge ${todaySatisfactory?'badge-sat':'badge-unsat'}`}>
                {todaySatisfactory ? 'Satisfactory' : 'Unsatisfactory'}
              </div>
            </div>

            <div className="dash-grid">

              {/* ── Today's Entry (vertical, col 1) ── */}
              <section className="card entry-card">
                <div className="card-label">Today's Entry</div>
                <div className="entry-fields">
                  <div className="entry-field">
                    <label>Weight (kg)</label>
                    <input type="number" placeholder="0.0" step="0.1" value={todayMetric.weight}
                      onChange={e => setTodayMetric(p => ({...p, weight:e.target.value}))} />
                  </div>
                  <div className="entry-field">
                    <label>Work Hours</label>
                    <div className="time-input">
                      <input type="number" placeholder="hrs" min="0" max="24" value={todayMetric.work_h}
                        onChange={e => setTodayMetric(p => ({...p, work_h:e.target.value}))} />
                      <span>:</span>
                      <input type="number" placeholder="min" min="0" max="59" value={todayMetric.work_m}
                        onChange={e => setTodayMetric(p => ({...p, work_m:e.target.value}))} />
                    </div>
                  </div>
                  <div className="entry-field">
                    <label>Sleep Hours</label>
                    <div className="time-input">
                      <input type="number" placeholder="hrs" min="0" max="24" value={todayMetric.sleep_h}
                        onChange={e => setTodayMetric(p => ({...p, sleep_h:e.target.value}))} />
                      <span>:</span>
                      <input type="number" placeholder="min" min="0" max="59" value={todayMetric.sleep_m}
                        onChange={e => setTodayMetric(p => ({...p, sleep_m:e.target.value}))} />
                    </div>
                  </div>
                  <div className="entry-field">
                    <label>Study Hours</label>
                    <div className="time-input">
                      <input type="number" placeholder="hrs" min="0" max="24" value={todayMetric.study_h}
                        onChange={e => setTodayMetric(p => ({...p, study_h:e.target.value}))} />
                      <span>:</span>
                      <input type="number" placeholder="min" min="0" max="59" value={todayMetric.study_m}
                        onChange={e => setTodayMetric(p => ({...p, study_m:e.target.value}))} />
                    </div>
                  </div>
                </div>

                <div className="entry-divider" />

                <div className="activity-checks">
                  {ACTIVITIES.map(({ key, label }) => (
                    <label key={key} className="check-label">
                      <input type="checkbox" checked={todayActivity[key]}
                        onChange={e => setTodayActivity(p => ({...p, [key]:e.target.checked}))} />
                      <span className="check-box" />
                      {label}
                    </label>
                  ))}
                </div>

                <button className="save-btn" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Today'}
                </button>
              </section>

              {/* ── Metrics card (col 2, row 1) ── */}
              <section className="card metrics-card">
                <div className="card-label">Current Metrics</div>
                <div className="metrics-grid">
                  <div className="metric-item">
                    <div className="metric-item-label">Weight</div>
                    <div className="metric-item-value">{latestWeight ? latestWeight.weight : '—'}</div>
                    <div className="metric-item-sub">{latestWeight ? `kg · ${latestWeight.date}` : 'no data'}</div>
                  </div>
                  <div className="metric-item">
                    <div className="metric-item-label">Avg Work</div>
                    <div className="metric-item-value">{avgWork !== null ? formatHours(avgWork) : '—'}</div>
                    <div className="metric-item-sub">7-day avg</div>
                  </div>
                  <div className="metric-item">
                    <div className="metric-item-label">Avg Sleep</div>
                    <div className="metric-item-value">{avgSleep !== null ? formatHours(avgSleep) : '—'}</div>
                    <div className="metric-item-sub">7-day avg</div>
                  </div>
                  <div className="metric-item">
                    <div className="metric-item-label">Avg Study</div>
                    <div className="metric-item-value">{avgStudy !== null ? formatHours(avgStudy) : '—'}</div>
                    <div className="metric-item-sub">7-day avg</div>
                  </div>
                </div>
              </section>

              {/* ── Pie card (col 3, row 1) ── */}
              <section className="card pie-card">
                <div className="card-label">Day Quality</div>
                {totalDays === 0
                  ? <div className="empty-state">No data yet</div>
                  : (
                    <div className="pie-wrap">
                      <PieChart width={170} height={170}>
                        <Pie data={pieData} cx={82} cy={82} innerRadius={54} outerRadius={78} dataKey="value" strokeWidth={0} startAngle={90} endAngle={-270}>
                          <Cell fill="#5a9e6f" />
                          <Cell fill="#2a2a2a" />
                        </Pie>
                        <text x={83} y={76} textAnchor="middle" dominantBaseline="middle" fontSize="22" fontWeight="600" fill="#5a9e6f" fontFamily="JetBrains Mono, monospace">{satRate}%</text>
                        <text x={83} y={96} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill="#666" fontFamily="Inter, sans-serif">satisfactory</text>
                      </PieChart>
                      <div className="pie-legend">
                        <div className="pie-leg-item"><span className="pie-leg-dot" style={{ background:'#5a9e6f' }} />{satCount} days</div>
                        <div className="pie-leg-item"><span className="pie-leg-dot" style={{ background:'#333' }} />{totalDays - satCount} days</div>
                      </div>
                    </div>
                  )
                }
              </section>

              {/* ── Finance card (col 2, rows 2-3) ── */}
              <section className="card finance-card">
                <div className="card-label">Finance</div>
                <div className="finance-form">
                  <div className="finance-row">
                    <div className="sign-toggle">
                      <button className={`sign-btn ${finSign==='+'?'sign-active-plus':''}`} onClick={() => setFinSign('+')}>+</button>
                      <button className={`sign-btn ${finSign==='-'?'sign-active-minus':''}`} onClick={() => setFinSign('-')}>−</button>
                    </div>
                    <input type="text" placeholder="Category (e.g. Food, Rent…)" value={finCat}
                      onChange={e => setFinCat(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddExpense()} />
                  </div>
                  <div className="finance-row">
                    <input type="number" placeholder="Amount (₹)" value={finAmt}
                      onChange={e => setFinAmt(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddExpense()} />
                    <button className="add-btn" onClick={handleAddExpense}><Plus size={16} /></button>
                  </div>
                </div>

                <div className="finance-list">
                  {todayExpenses.length === 0
                    ? <div className="empty-state">No entries today</div>
                    : todayExpenses.map(e => (
                      <div key={e.id} className="finance-item">
                        <span className="finance-cat">{e.category}</span>
                        <span className="finance-date">{e.date}</span>
                        <span className={Number(e.amount) >= 0 ? 'finance-amt-plus' : 'finance-amt-minus'}>
                          {Number(e.amount) >= 0 ? '+' : ''}₹{Math.abs(Number(e.amount)).toLocaleString('en-IN')}
                        </span>
                        <button className="del-btn" onClick={() => handleDeleteExpense(e.id)}><Trash2 size={12} /></button>
                      </div>
                    ))
                  }
                </div>

                {todayExpenses.length > 0 && (
                  <div className="finance-summary">
                    <span className="finance-summary-label">Today's Net</span>
                    <span className={todayNet >= 0 ? 'finance-net-positive' : 'finance-net-negative'}>
                      {todayNet >= 0 ? '+' : ''}₹{todayNet.toLocaleString('en-IN')}
                    </span>
                  </div>
                )}
              </section>

              {/* ── Notes + Remark card (col 3, rows 2-3) ── */}
              <section className="card notes-card">
                <div className="remark-section">
                  <div className="card-label">Remark of the Day</div>
                  {todayRemark && <p className="remark-display">"{todayRemark}"</p>}
                  <div className="remark-form">
                    <input type="text" placeholder={todayRemark ? 'Update remark…' : "Today's remark…"}
                      value={remarkText} onChange={e => setRemarkText(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSaveRemark()} />
                    <button className="icon-btn" onClick={handleSaveRemark}><Plus size={16} /></button>
                  </div>
                </div>

                <div className="card-label">Notes</div>
                <div className="note-form">
                  <input type="text" placeholder="Add a note…" value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddNote()} />
                  <button className="icon-btn" onClick={handleAddNote}><Plus size={16} /></button>
                </div>
                <div className="notes-list">
                  {notes.length === 0 && <div className="empty-state">No notes yet</div>}
                  {notes.slice(0, 12).map(n => (
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

        {/* ══ ANALYTICS ══════════════════════════════════════════ */}
        {sideTab === 'analytics' && (
          <div className="page">
            <div className="page-header">
              <div>
                <h1 className="page-title">Analytics</h1>
                <p className="page-sub">Your data over time</p>
              </div>
            </div>

            <div className="browser-tabs">
              <button className={`browser-tab ${analyticsTab==='graphs'?'browser-tab-active':''}`} onClick={() => setAnalyticsTab('graphs')}>Graphs</button>
              <button className={`browser-tab ${analyticsTab==='calendars'?'browser-tab-active':''}`} onClick={() => setAnalyticsTab('calendars')}>Calendars</button>
            </div>

            {analyticsTab === 'graphs' && (
              <div className="charts-grid">
                <LineMetricChart title="Weight (kg)"
                  data={metrics.filter(m => m.weight!=null).map(m => ({ date:m.date, value:m.weight }))}
                  color="#7aaf8e" unit="kg" />
                <BarMetricChart title="Work Hours"
                  data={metrics.filter(m => m.work_hours!=null).map(m => ({ date:m.date, value:m.work_hours }))}
                  color="#7a8faf" formatTick={formatHours} />
                <BarMetricChart title="Sleep Hours"
                  data={metrics.filter(m => m.sleep_hours!=null).map(m => ({ date:m.date, value:m.sleep_hours }))}
                  color="#9f7aaf" formatTick={formatHours} />
                <BarMetricChart title="Study Hours"
                  data={metrics.filter(m => m.study_hours!=null).map(m => ({ date:m.date, value:m.study_hours }))}
                  color="#af9f7a" formatTick={formatHours} />
                <LineMetricChart title="Daily Finance Net (₹)"
                  data={expenseChartData}
                  color="#af7a7a" unit="₹" />
              </div>
            )}

            {analyticsTab === 'calendars' && (
              <div className="calendars-grid">
                <CalendarView title="Gym"           markedDates={activities.filter(a=>a.gym).map(a=>a.date)}           color="#7aaf8e" />
                <CalendarView title="Basketball"    markedDates={activities.filter(a=>a.basketball).map(a=>a.date)}    color="#7a8faf" />
                <CalendarView title="Athletic Work" markedDates={activities.filter(a=>a.athletic_work).map(a=>a.date)} color="#af7a7a" />
                <CalendarView title="Skincare"      markedDates={activities.filter(a=>a.skincare).map(a=>a.date)}      color="#af7aaf" />
                <CalendarView title="Reading"       markedDates={activities.filter(a=>a.reading).map(a=>a.date)}       color="#afaf7a" />
                <CalendarView title="Room Cleaning" markedDates={activities.filter(a=>a.room_cleaning).map(a=>a.date)} color="#7aafaf" />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
