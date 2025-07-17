const tabTimers = {};
const mutedTabs = new Set();

// Initialize timers for all existing tabs
function initializeExistingTabs() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      if (tab.id && tab.url && tab.title && !(tab.id in tabTimers)) {
        tabTimers[tab.id] = { start: Date.now(), url: tab.url, title: tab.title };
      }
    });
    chrome.storage.local.set({ tabTimers });
  });
}

// Setup on install and startup
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get("tabTimers", (data) => {
    Object.assign(tabTimers, data.tabTimers || {});
    initializeExistingTabs();
    // Create periodic alarm
    chrome.alarms.create("thresholdCheck", { periodInMinutes: 1 });
  });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get("tabTimers", (data) => {
    Object.assign(tabTimers, data.tabTimers || {});
    initializeExistingTabs();
    chrome.alarms.create("thresholdCheck", { periodInMinutes: 1 });
  });
});

// Track newly created tabs
chrome.tabs.onCreated.addListener(tab => {
  if (tab.id && tab.url && tab.title) {
    tabTimers[tab.id] = { start: Date.now(), url: tab.url, title: tab.title };
    chrome.storage.local.set({ tabTimers });
  }
});

// Remove closed tabs
chrome.tabs.onRemoved.addListener(tabId => {
  delete tabTimers[tabId];
  mutedTabs.delete(Number(tabId));
  chrome.storage.local.set({ tabTimers });
});

// Check thresholds on alarm
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === "thresholdCheck") {
    chrome.storage.local.get("thresholdMinutes", data => {
      const now = Date.now();
      const thresholdMs = (data.thresholdMinutes || 30) * 60 * 1000;
      for (const [id, entry] of Object.entries(tabTimers)) {
        if (!mutedTabs.has(Number(id)) && now - entry.start >= thresholdMs) {
          chrome.notifications.create(`tab-${id}`, {
            type: "basic",
            iconUrl: "icon48.png",
            title: "Tab Timer Alert",
            message: `${entry.title || 'A tab'} has been open for over ${data.thresholdMinutes || 30} minutes.`
          });
        }
      }
    });
  }
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.type === "GET_TAB_TIMES") {
    const now = Date.now();
    const tabs = Object.entries(tabTimers).map(([id, entry]) => ({
      tabId: id,
      secondsOpen: Math.floor((now - entry.start) / 1000),
      title: entry.title,
      url: entry.url,
      muted: mutedTabs.has(Number(id))
    }));
    sendResponse({ tabs });
  } else if (req.type === "SET_THRESHOLD") {
    chrome.storage.local.set({ thresholdMinutes: req.minutes });
    sendResponse({ status: "ok" });
  } else if (req.type === "TOGGLE_MUTE") {
    const id = Number(req.tabId);
    mutedTabs.has(id) ? mutedTabs.delete(id) : mutedTabs.add(id);
    sendResponse({ status: "ok" });
  } else if (req.type === "EXPORT_TABS") {
    const rows = ["Tab ID,Title,URL,Time Open (seconds)"];
    const now = Date.now();
    for (const [id, entry] of Object.entries(tabTimers)) {
      const duration = Math.floor((now - entry.start) / 1000);
      rows.push(`${id},"${entry.title}","${entry.url}",${duration}`);
    }
    const blob = new Blob([rows.join("\n")], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({ url, filename: "tab_times.csv", saveAs: true });
    sendResponse({ status: "exported" });
  }
  return true;
});