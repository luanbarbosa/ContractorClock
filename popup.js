// Storage: window.localStorage of the extension's own origin (chrome-extension://<id>).
// Needs no manifest permission. Data never leaves the machine.
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

function save(tasks) {
  localStorage.setItem(KEY, JSON.stringify(tasks));
}

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
  save(tasks);
  input.value = '';
  render();
});

reportBtn.addEventListener('click', () => {
  reportText.value = buildReport(load());
  report.hidden = false;
  reportText.select();
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
