function updateTabTimes() {
  chrome.runtime.sendMessage({ type: "GET_TAB_TIMES" }, response => {
    const container = document.getElementById("tabsContainer");
    container.innerHTML = "";
    response.tabs.forEach(tab => {
      const mins = Math.floor(tab.secondsOpen / 60);
      const secs = tab.secondsOpen % 60;
      const div = document.createElement("div");
      div.className = "tab-entry";
      div.innerHTML = `
        <div class="tab-title">${tab.title || "Untitled Tab"}</div>
        <div class="tab-url">${tab.url || "No URL"}</div>
        <div>Time Open: ${mins}m ${secs}s</div>
        <button class="mute-btn" data-id="${tab.tabId}">${tab.muted ? "Unmute" : "Mute"}</button>
      `;
      container.appendChild(div);
    });
    addMuteListeners();
  });
}

function addMuteListeners() {
  document.querySelectorAll(".mute-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const tabId = btn.getAttribute("data-id");
      chrome.runtime.sendMessage({ type: "TOGGLE_MUTE", tabId }, () => updateTabTimes());
    });
  });
}

updateTabTimes();
setInterval(updateTabTimes, 10000);

document.getElementById("setThreshold").addEventListener("click", () => {
  const mins = parseInt(document.getElementById("threshold").value, 10);
  if (!isNaN(mins)) {
    chrome.runtime.sendMessage({ type: "SET_THRESHOLD", minutes: mins }, () => alert("Threshold updated."));
  }
});

document.getElementById("export").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "EXPORT_TABS" }, () => alert("CSV export started."));
});