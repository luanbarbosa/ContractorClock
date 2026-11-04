// Shared between popup and background service worker.
// Uses IndexedDB (same extension origin, readable from the service worker,
// no manifest permission needed) — localStorage is not available in workers.

const DB = 'contractorclock';
const STORE = 'kv';
const STATE_KEY = 'reminder';

export const DEFAULT_STATE = {
  time: '17:00', // reminder time, local "HH:MM"
  reportedOn: null, // local date key of last "Report day" click
  hasTasks: false, // mirrored from the popup's task list
  beepedOn: null, // local date key of last sound played
};

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getState() {
  try {
    const db = await open();
    const value = await new Promise((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).get(STATE_KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return { ...DEFAULT_STATE, ...value };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export async function patchState(patch) {
  const next = { ...(await getState()), ...patch };
  const db = await open();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(next, STATE_KEY);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return next;
}

export function todayKey(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Overdue = tasks logged, not reported today, and past the reminder time.
export function isOverdue(state, now = new Date()) {
  if (!state.hasTasks || state.reportedOn === todayKey(now)) return false;
  const [h, m] = (state.time || DEFAULT_STATE.time).split(':').map(Number);
  return now.getHours() * 60 + now.getMinutes() >= h * 60 + m;
}

export async function refreshBadge(state) {
  state ??= await getState();
  const overdue = isOverdue(state);
  await chrome.action.setBadgeText({ text: overdue ? '!' : '' });
  if (overdue) await chrome.action.setBadgeBackgroundColor({ color: '#c2410c' });
  await chrome.action.setTitle({
    title: overdue ? 'ContractorClock — report your day!' : 'ContractorClock',
  });
  return overdue;
}
