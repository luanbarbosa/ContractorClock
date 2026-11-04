// Storage: window.localStorage of the extension's own origin (chrome-extension://<id>).
// Needs no manifest permission. Data never leaves the machine.
import { patchState, refreshBadge, todayKey } from './reminder.js';

const KEY = 'tasks';

const $ = (id) => document.getElementById(id);
const form = $('task-form');
const input = $('task-input');
const list = $('task-list');
const empty = $('empty');
const count = $('count');
const report = $('report');
const reportText = $('report-text');
const reportBtn = $('report-btn');
const copyBtn = $('copy-btn');
const clearBtn = $('clear-btn');
const nudge = $('nudge');
const remindTime = $('remind-time');

// Each task: { text, at } (at = ms timestamp). Older plain-string entries are upgraded.
function load() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    if (!Array.isArray(data)) return [];
    return data.map((t) => (typeof t === 'string' ? { text: t, at: null } : t));
  } catch {
    return [];
  }
}

function save(tasks, extra = {}) {
  localStorage.setItem(KEY, JSON.stringify(tasks));
  syncReminder({ hasTasks: tasks.length > 0, ...extra });
}

// Mirror state to IndexedDB so the background worker can update the badge.
async function syncReminder(patch) {
  try {
    const state = await patchState(patch);
    nudge.hidden = !(await refreshBadge(state));
  } catch {}
}

// Short two-tone chime via Web Audio (no audio file, no CSP change).
function chime() {
  try {
    const ctx = new AudioContext();
    [880, 660].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = ctx.currentTime + i * 0.18;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.17);
    });
    setTimeout(() => ctx.close(), 600);
  } catch {}
}

async function initReminder() {
  const state = await patchState({ hasTasks: load().length > 0 });
  remindTime.value = state.time;
  const overdue = await refreshBadge(state);
  nudge.hidden = !overdue;
  // Sound at most once per day, the first time the popup opens while overdue.
  if (overdue && state.beepedOn !== todayKey()) {
    chime();
    patchState({ beepedOn: todayKey() });
  }
}

remindTime.addEventListener('change', () => {
  if (remindTime.value) syncReminder({ time: remindTime.value });
});

const fmtTime = (ms) =>
  ms ? new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '';

function buildReport(tasks) {
  return tasks.map((t) => t.text).join('; ');
}

function render() {
  const tasks = load();
  list.replaceChildren();
  tasks.forEach((task, i) => {
    const li = document.createElement('li');

    const time = document.createElement('span');
    time.className = 'time';
    time.textContent = fmtTime(task.at);

    const text = document.createElement('span');
    text.className = 'text';
    text.textContent = task.text; // textContent: no HTML injection

    const del = document.createElement('button');
    del.className = 'remove';
    del.title = 'Remove';
    del.setAttribute('aria-label', 'Remove task');
    del.textContent = '✕';
    del.addEventListener('click', () => {
      const t = load();
      t.splice(i, 1);
      save(t);
      render();
    });

    li.append(time, text, del);
    list.append(li);
  });

  empty.hidden = tasks.length > 0;
  count.textContent = tasks.length;
  reportBtn.disabled = tasks.length === 0;
  if (!report.hidden) reportText.value = buildReport(tasks);
  list.scrollTop = list.scrollHeight;
}

$('date').textContent = new Date().toLocaleDateString([], {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  // Strip ';' from entries so it stays an unambiguous separator.
  const text = input.value.replace(/;/g, ',').trim();
  if (!text) return;
  const tasks = load();
  tasks.push({ text, at: Date.now() });
  // New work after reporting makes today's report stale: remind again.
  save(tasks, { reportedOn: null });
  input.value = '';
  render();
});

reportBtn.addEventListener('click', () => {
  reportText.value = buildReport(load());
  report.hidden = false;
  reportText.select();
  syncReminder({ reportedOn: todayKey() });
});

$('close-report').addEventListener('click', () => {
  report.hidden = true;
  input.focus();
});

copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(reportText.value);
  } catch {
    reportText.select();
    document.execCommand('copy');
  }
  copyBtn.textContent = 'Copied';
  copyBtn.classList.add('done');
  setTimeout(() => {
    copyBtn.textContent = 'Copy';
    copyBtn.classList.remove('done');
  }, 1500);
});

let clearTimer = null;
clearBtn.addEventListener('click', () => {
  if (!clearTimer) {
    clearBtn.textContent = 'Confirm clear';
    clearBtn.classList.add('armed');
    clearTimer = setTimeout(resetClear, 3000);
    return;
  }
  resetClear();
  save([]);
  report.hidden = true;
  render();
  input.focus();
});

function resetClear() {
  clearTimeout(clearTimer);
  clearTimer = null;
  clearBtn.textContent = 'Clear day';
  clearBtn.classList.remove('armed');
}

render();
initReminder().catch(() => {});
