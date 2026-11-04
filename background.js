// No alarms/notifications permission, so there is no exact timer.
// Instead, re-check on events that wake the worker without any permission:
// tab switches, page loads, window focus, browser start.
import { refreshBadge } from './reminder.js';

const check = () => refreshBadge().catch(() => {});

chrome.runtime.onStartup.addListener(check);
chrome.runtime.onInstalled.addListener(check);
chrome.tabs.onActivated.addListener(check);
chrome.tabs.onUpdated.addListener((_id, info) => {
  if (info.status === 'complete') check();
});
chrome.windows.onFocusChanged.addListener(check);
