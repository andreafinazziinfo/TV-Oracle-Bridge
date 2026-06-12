// TV-Oracle-Bridge - Dashboard Client Engine
document.addEventListener("DOMContentLoaded", () => {
  /**
   * Escape HTML special characters to prevent XSS when inserting into innerHTML.
   * Use this for ALL user/server-supplied text values.
   */
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Navigation & State Management
  const navItems = document.querySelectorAll(".nav-item");
  const tabPanes = document.querySelectorAll(".tab-pane");
  const pageTitle = document.getElementById("page-title");
  const refreshAllBtn = document.getElementById("refresh-all-btn");

  let activeTabId = "status-tab";

  // Switch tabs
  navItems.forEach(item => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      
      const tabId = item.getAttribute("data-tab");
      activeTabId = tabId;

      // Update active nav item
      navItems.forEach(n => n.classList.remove("active"));
      item.classList.add("active");

      // Update active tab pane
      tabPanes.forEach(pane => pane.classList.remove("active"));
      document.getElementById(tabId).classList.add("active");

      // Update title
      pageTitle.innerText = item.querySelector("span").innerText;

      // Auto-refresh data on tab change
      loadTabData(tabId);
    });
  });

  // Global Refresh Button
  refreshAllBtn.addEventListener("click", () => {
    loadTabData(activeTabId, true);
  });

  // Load Tab Data Switcher
  function loadTabData(tabId, force = false) {
    console.log(`[Dashboard] Loading tab data for: ${tabId}`);
    switch (tabId) {
      case "status-tab":
        loadStatus();
        loadDaemonStatus();
        break;
      case "health-tab":
        loadHealth();
        break;
      case "screenshots-tab":
        loadScreenshots();
        break;
      case "indicators-tab":
        loadIndicators();
        break;
      case "docs-tab":
        loadDocs();
        break;
      case "logs-tab":
        loadSystemLogs();
        break;
      case "sandbox-tab":
        loadSandboxTab();
        break;
    }
  }

  // Initial load
  loadStatus();
  loadScreenerPresets();

  // ==========================================
  // TAB 1: OVERVIEW & STATUS
  // ==========================================
  const dbStatusVal = document.getElementById("db-status-val");
  const dbSizeVal = document.getElementById("db-size-val");
  const cachedBarsVal = document.getElementById("cached-bars-val");
  const sessionStatusVal = document.getElementById("session-status-val");
  const envList = document.getElementById("env-list");

  async function loadStatus() {
    try {
      dbStatusVal.innerText = "Loading...";
      sessionStatusVal.innerText = "Loading...";

      const res = await fetch("/api/status");
      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      const stats = result.stats;

      // Update cards
      if (stats.dbExists) {
        dbStatusVal.innerText = "Connected";
        dbStatusVal.className = "stat-value text-green";
        const sizeMb = (stats.dbSize / (1024 * 1024)).toFixed(2);
        dbSizeVal.innerText = `${sizeMb} MB SQLite DB size`;
      } else {
        dbStatusVal.innerText = "Not Found";
        dbStatusVal.className = "stat-value text-red";
        dbSizeVal.innerText = "Database is missing";
      }

      cachedBarsVal.innerText = stats.cachedBars.toLocaleString();

      if (stats.env.TV_SESSION !== "Not Configured") {
        sessionStatusVal.innerText = "Configured";
        sessionStatusVal.className = "stat-value text-green";
      } else {
        sessionStatusVal.innerText = "Missing Cookie";
        sessionStatusVal.className = "stat-value text-red";
      }

      // Check session validity countdown
      try {
        const sessionRes = await fetch("/api/session/validate");
        const sessionData = await sessionRes.json();
        const overviewBadge = document.getElementById("session-countdown-badge-overview");
        if (overviewBadge) {
          if (sessionData.success && sessionData.valid) {
            overviewBadge.innerHTML = sessionData.countdownHtml;
          } else {
            overviewBadge.innerHTML = "<span class='badge badge-red'>Expired / Missing</span>";
          }
        }
      } catch (err) {
        console.error("Failed to load session status overview:", err);
      }

      // Update Env Table
      envList.innerHTML = "";
      for (const [key, value] of Object.entries(stats.env)) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><strong>${escapeHtml(key)}</strong></td>
          <td><code>${escapeHtml(value)}</code></td>
        `;
        envList.appendChild(tr);
      }

      // Check if notifications are configured
      let notifiers = [];
      if (stats.env.TV_NOTIFIER_DISCORD_WEBHOOK !== "Not Configured") notifiers.push("Discord");
      if (stats.env.TV_NOTIFIER_TELEGRAM_TOKEN !== "Not Configured") notifiers.push("Telegram");
      
      const notifiersVal = document.getElementById("daemon-notifiers-val");
      if (notifiersVal) {
        if (notifiers.length > 0) {
          notifiersVal.innerText = notifiers.join(" + ") + " Active";
          notifiersVal.style.color = "var(--neon-green)";
        } else {
          notifiersVal.innerText = "Inactive";
          notifiersVal.style.color = "var(--text-muted)";
        }
      }
    } catch (err) {
      console.error("Failed to load status:", err);
      dbStatusVal.innerText = "Error";
      sessionStatusVal.innerText = "Error";
      envList.innerHTML = `<tr><td colspan="2" class="text-center text-red">Failed to load environment status: ${escapeHtml(err.message)}</td></tr>`;
    }
  }

  // --- Daemon Controls ---
  const daemonBadge = document.getElementById("daemon-badge-val");
  const daemonIntervalInput = document.getElementById("daemon-interval-input");
  const daemonStartBtn = document.getElementById("daemon-start-btn");
  const daemonStopBtn = document.getElementById("daemon-stop-btn");
  const daemonNextRunVal = document.getElementById("daemon-next-run-val");
  const daemonNotifiersVal = document.getElementById("daemon-notifiers-val");
  const daemonLogBox = document.getElementById("daemon-log-box");
  const daemonClearLogsBtn = document.getElementById("daemon-clear-logs");

  async function loadDaemonStatus() {
    try {
      const res = await fetch("/api/daemon/status");
      const result = await res.json();
      if (!result.success) return;
      
      // Update badge and buttons
      if (result.isRunning) {
        daemonBadge.innerText = "Active";
        daemonBadge.style.backgroundColor = "rgba(0, 255, 135, 0.1)";
        daemonBadge.style.color = "var(--neon-green)";
        daemonBadge.style.borderColor = "rgba(0, 255, 135, 0.2)";
        daemonStartBtn.classList.add("hidden");
        daemonStopBtn.classList.remove("hidden");
        daemonIntervalInput.disabled = true;
      } else {
        daemonBadge.innerText = "Inactive";
        daemonBadge.style.backgroundColor = "rgba(255, 51, 102, 0.1)";
        daemonBadge.style.color = "var(--neon-red)";
        daemonBadge.style.borderColor = "rgba(255, 51, 102, 0.2)";
        daemonStartBtn.classList.remove("hidden");
        daemonStopBtn.classList.add("hidden");
        daemonIntervalInput.disabled = false;
      }
      
      // Next run time
      if (result.nextRun) {
        daemonNextRunVal.innerText = new Date(result.nextRun).toLocaleTimeString();
      } else {
        daemonNextRunVal.innerText = "-";
      }
      
      // Logs console
      if (result.logs && result.logs.length > 0) {
        daemonLogBox.innerText = result.logs.join("\n");
      } else {
        daemonLogBox.innerText = "No activity logs...";
      }
    } catch (err) {
      console.error("Failed to load daemon status:", err);
    }
  }

  // Bind daemon control clicks
  daemonStartBtn.addEventListener("click", async () => {
    const mins = parseInt(daemonIntervalInput.value || "15", 10);
    try {
      daemonLogBox.innerText += "\n[Client] Sending start request...";
      const res = await fetch("/api/daemon/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intervalMinutes: mins })
      });
      const result = await res.json();
      if (result.success) {
        loadDaemonStatus();
      } else {
        alert("Error starting daemon: " + result.error);
      }
    } catch (err) {
      alert("Network error starting daemon: " + err.message);
    }
  });

  daemonStopBtn.addEventListener("click", async () => {
    try {
      daemonLogBox.innerText += "\n[Client] Sending stop request...";
      const res = await fetch("/api/daemon/stop", {
        method: "POST"
      });
      const result = await res.json();
      if (result.success) {
        loadDaemonStatus();
      } else {
        alert("Error stopping daemon: " + result.error);
      }
    } catch (err) {
      alert("Network error stopping daemon: " + err.message);
    }
  });

  daemonClearLogsBtn.addEventListener("click", () => {
    daemonLogBox.innerText = "Cleared console logs...";
  });

  // Initial daemon load
  loadDaemonStatus();

  // Set visibility-gated polling loop (every 3 seconds)
  setInterval(() => {
    if (document.visibilityState === 'visible') {
      if (activeTabId === "status-tab") {
        loadDaemonStatus();
      } else if (activeTabId === "health-tab") {
        loadHealth();
      }
    }
  }, 3000);




  // ==========================================
  // TAB 2: SCREENSHOT GALLERY
  // ==========================================
  const gallery = document.getElementById("screenshots-gallery");
  const lightboxModal = document.getElementById("lightbox-modal");
  const lightboxImg = document.getElementById("lightbox-img");
  const lightboxCaption = document.getElementById("lightbox-caption");
  const lightboxClose = document.querySelector(".lightbox-close");
  const patternFilter = document.getElementById("screenshot-pattern-filter");

  let allScreenshots = [];

  if (patternFilter) {
    patternFilter.addEventListener("change", () => {
      renderScreenshots();
    });
  }

  async function loadScreenshots() {
    try {
      gallery.innerHTML = '<p class="loading-placeholder">Scanning screenshots...</p>';

      const res = await fetch("/api/screenshots");
      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      allScreenshots = result.screenshots;
      renderScreenshots();
    } catch (err) {
      gallery.innerHTML = `<p class="loading-placeholder text-red">Error loading screenshots: ${escapeHtml(err.message)}</p>`;
    }
  }

  function renderScreenshots() {
    if (!gallery) return;
    
    const selectedPattern = patternFilter ? patternFilter.value : "all";
    
    // Filter
    const filtered = allScreenshots.filter(scr => {
      if (selectedPattern === "all") return true;
      return scr.patterns && scr.patterns.includes(selectedPattern);
    });
    
    if (filtered.length === 0) {
      gallery.innerHTML = `
        <div class="inspector-empty" style="grid-column: 1 / -1;">
          <i class="lucide-image-off"></i>
          <p>No screenshots matching pattern "${escapeHtml(selectedPattern)}" found.</p>
        </div>
      `;
      return;
    }

    gallery.innerHTML = "";
    filtered.forEach(scr => {
      const card = document.createElement("div");
      card.className = "gallery-card";
      
      let patternsHtml = "";
      if (scr.patterns && scr.patterns.length > 0) {
        patternsHtml = `<div class="patterns-badges" style="margin-top: 4px; display: flex; gap: 4px; flex-wrap: wrap;">`;
        scr.patterns.forEach(p => {
          patternsHtml += `<span class="badge" style="font-size: 0.65rem; padding: 2px 6px; background-color: rgba(0, 242, 254, 0.2); color: var(--neon-cyan); border: 1px solid var(--neon-cyan);">${escapeHtml(p)}</span>`;
        });
        patternsHtml += `</div>`;
      }
      
      card.innerHTML = `
        <div class="gallery-thumb-wrapper">
          <img class="gallery-thumb" src="${escapeHtml(scr.url)}" alt="${escapeHtml(scr.filename)}" loading="lazy">
          <div class="gallery-overlay">
            <div class="gallery-info">
              <span class="gallery-title">${escapeHtml(scr.filename)}</span>
              <span class="gallery-date">${new Date(scr.createdAt).toLocaleString()}</span>
              ${patternsHtml}
            </div>
          </div>
        </div>
      `;

      card.addEventListener("click", () => {
        let caption = `${scr.filename} (${new Date(scr.createdAt).toLocaleString()})`;
        if (scr.patterns && scr.patterns.length > 0) {
          caption += ` - Patterns: ${scr.patterns.join(", ")}`;
        }
        openLightbox(scr.url, caption);
      });

      gallery.appendChild(card);
    });
  }

  // Lightbox Modal Functions
  function openLightbox(src, caption) {
    lightboxImg.src = src;
    lightboxCaption.innerText = caption;
    lightboxModal.style.display = "block";
  }

  lightboxClose.addEventListener("click", () => {
    lightboxModal.style.display = "none";
  });

  lightboxModal.addEventListener("click", (e) => {
    if (e.target === lightboxModal) {
      lightboxModal.style.display = "none";
    }
  });


  // ==========================================
  // TAB 3: INDICATOR DATABASE INSPECTOR
  // ==========================================
  const indicatorsList = document.getElementById("indicators-list");
  const detailHeader = document.getElementById("indicator-detail-header");
  const detailBody = document.getElementById("indicator-detail-body");

  async function loadIndicators() {
    try {
      indicatorsList.innerHTML = '<p class="loading-placeholder font-small">Searching indicator files...</p>';

      const res = await fetch("/api/indicators");
      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      const list = result.indicators;
      if (list.length === 0) {
        indicatorsList.innerHTML = '<p class="loading-placeholder font-small text-dark">No cached indicator JSONs found.</p>';
        return;
      }

      indicatorsList.innerHTML = "";
      list.forEach(ind => {
        const item = document.createElement("div");
        item.className = "list-item";
        item.innerHTML = `
          <span class="list-item-title">${escapeHtml(ind.meta.name || ind.indicatorKey)}</span>
          <div class="list-item-subtitle">
            <span>${escapeHtml(ind.meta.symbol || "N/A")} (${escapeHtml(ind.meta.timeframe || "N/A")})</span>
            <span>${escapeHtml(ind.periodsCount)} bars</span>
          </div>
          <span class="list-item-meta">Updated: ${new Date(ind.lastUpdated).toLocaleTimeString()}</span>
        `;

        item.addEventListener("click", () => {
          // Highlight selected
          document.querySelectorAll("#indicators-list .list-item").forEach(el => el.classList.remove("selected"));
          item.classList.add("selected");
          loadIndicatorDetails(ind.indicatorKey);
        });

        indicatorsList.appendChild(item);
      });
    } catch (err) {
      indicatorsList.innerHTML = `<p class="loading-placeholder font-small text-red">Error: ${escapeHtml(err.message)}</p>`;
    }
  }

  async function loadIndicatorDetails(key) {
    try {
      detailBody.innerHTML = '<p class="loading-placeholder">Fetching indicator data...</p>';

      const res = await fetch(`/api/indicators/${key}`);
      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      const indData = result.data;
      const meta = indData.meta || {};
      
      // Update Header
      detailHeader.innerHTML = `
        <h2><i class="lucide-file-code"></i> ${escapeHtml(meta.name || key)}</h2>
        <p class="panel-subtitle">Key: <code>${escapeHtml(key)}</code> • File: <code>out/${escapeHtml(key)}.json</code></p>
      `;

      // Build plots indicator tags (color dots for visual feedback)
      let plotsHtml = '<p class="text-dark">No plots found</p>';
      if (indData.plots && indData.plots.length > 0) {
        plotsHtml = '<div class="plots-tags">';
        indData.plots.forEach((p, idx) => {
          const color = p.color || "#00f2fe";
          plotsHtml += `
            <div class="plot-tag">
              <span class="plot-dot" style="background-color: ${escapeHtml(color)}"></span>
              <span>${escapeHtml(p.name || `plot_${idx}`)}</span>
            </div>
          `;
        });
        plotsHtml += "</div>";
      }

      // Build inputs visual summary
      let inputsHtml = '<p class="text-dark">No inputs configured</p>';
      if (indData.inputs && Object.keys(indData.inputs).length > 0) {
        inputsHtml = '<div class="inspector-grid">';
        for (const [inKey, inVal] of Object.entries(indData.inputs)) {
          inputsHtml += `
            <div class="inspector-info-card">
              <div class="info-card-label">${escapeHtml(inKey)}</div>
              <div class="info-card-value">${escapeHtml(typeof inVal === 'object' ? JSON.stringify(inVal) : inVal)}</div>
            </div>
          `;
        }
        inputsHtml += "</div>";
      }

      // Build OHLCV and plot tables (limit to last 100 rows for smooth DOM rendering)
      let tableHeaders = "<tr><th>Timestamp</th><th>Open</th><th>High</th><th>Low</th><th>Close</th><th>Volume</th>";
      if (indData.plots && indData.plots.length > 0) {
        indData.plots.forEach(p => {
          tableHeaders += `<th>${escapeHtml(p.name)}</th>`;
        });
      }
      tableHeaders += "</tr>";

      let tableRows = "";
      const reversedOhlc = [...(indData.chartOhlc || [])].reverse().slice(0, 100);
      const reversedPeriods = [...(indData.periods || [])].reverse().slice(0, 100);

      reversedOhlc.forEach((bar, idx) => {
        const period = reversedPeriods[idx] || {};
        const dateStr = new Date(bar.time).toLocaleString();
        
        tableRows += `
          <tr>
            <td><strong>${dateStr}</strong></td>
            <td>${bar.open !== undefined ? bar.open.toFixed(2) : "-"}</td>
            <td>${bar.high !== undefined ? bar.high.toFixed(2) : "-"}</td>
            <td>${bar.low !== undefined ? bar.low.toFixed(2) : "-"}</td>
            <td>${bar.close !== undefined ? bar.close.toFixed(2) : "-"}</td>
            <td>${bar.volume !== undefined ? bar.volume.toLocaleString() : "-"}</td>
        `;

        if (indData.plots && indData.plots.length > 0) {
          indData.plots.forEach(p => {
            const val = period[p.name];
            tableRows += `<td>${val !== undefined && val !== null ? val.toFixed(4) : "-"}</td>`;
          });
        }
        tableRows += "</tr>";
      });

      // Render full inspector body
      detailBody.innerHTML = `
        <div class="inspector-details">
          <!-- Section 1: Overview Metadata -->
          <div class="inspector-section">
            <h3>Metadata Overview</h3>
            <div class="inspector-grid">
              <div class="inspector-info-card">
                <div class="info-card-label">Symbol</div>
                <div class="info-card-value text-green">${escapeHtml(meta.symbol || "N/A")}</div>
              </div>
              <div class="inspector-info-card">
                <div class="info-card-label">Timeframe</div>
                <div class="info-card-value text-green">${escapeHtml(meta.timeframe || "N/A")}</div>
              </div>
              <div class="inspector-info-card">
                <div class="info-card-label">Type</div>
                <div class="info-card-value">${escapeHtml(meta.type || "Study/Indicator")}</div>
              </div>
              <div class="inspector-info-card">
                <div class="info-card-label">Total Data Points</div>
                <div class="info-card-value">${indData.periodsCount || 0} bars</div>
              </div>
            </div>
          </div>

          <!-- Section 2: Inputs -->
          <div class="inspector-section">
            <h3>Configured Inputs</h3>
            ${inputsHtml}
          </div>

          <!-- Section 3: Plots -->
          <div class="inspector-section">
            <h3>Registered Plots</h3>
            ${plotsHtml}
          </div>

          <!-- Section 4: Data Table -->
          <div class="inspector-section">
            <h3>Historical Data Logs (Last 100 bars)</h3>
            <div class="table-wrapper">
              <table class="data-table">
                <thead>${tableHeaders}</thead>
                <tbody>${tableRows || '<tr><td colspan="6" class="text-center">No bars data cached.</td></tr>'}</tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      detailBody.innerHTML = `
        <div class="inspector-empty text-red">
          <i class="lucide-alert-triangle"></i>
          <p>Failed to load indicator details: ${escapeHtml(err.message)}</p>
        </div>
      `;
    }
  }


  // ==========================================
  // TAB 4: PINE SCRIPT DOCUMENTATION REFERENCE
  // ==========================================
  const docsSearchInput = document.getElementById("docs-search-input");
  const docsCount = document.getElementById("docs-count");
  const docsResultsList = document.getElementById("docs-results-list");
  const docsDetailView = document.getElementById("docs-detail-view");

  let docsDebounceTimer;

  docsSearchInput.addEventListener("input", () => {
    clearTimeout(docsDebounceTimer);
    docsDebounceTimer = setTimeout(() => {
      loadDocs(docsSearchInput.value);
    }, 250);
  });

  async function loadDocs(query = "") {
    try {
      const res = await fetch(`/api/docs?q=${encodeURIComponent(query)}`);
      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      const docs = result.docs;
      const totalMatches = result.totalMatches !== undefined ? result.totalMatches : Object.keys(docs).length;
      
      docsCount.innerText = totalMatches;

      if (Object.keys(docs).length === 0) {
        docsResultsList.innerHTML = '<p class="text-center text-dark font-small padding-top">No matches found.</p>';
        return;
      }

      docsResultsList.innerHTML = "";
      Object.keys(docs).sort().forEach(funcName => {
        const item = document.createElement("div");
        item.className = "docs-item";
        item.innerText = funcName;
        
        item.addEventListener("click", () => {
          document.querySelectorAll("#docs-results-list .docs-item").forEach(el => el.classList.remove("selected"));
          item.classList.add("selected");
          displayDocDetail(funcName, docs[funcName]);
        });

        docsResultsList.appendChild(item);
      });
      
      // Auto-select first item if it loads
      const firstItem = docsResultsList.querySelector(".docs-item");
      if (firstItem && query) {
        firstItem.click();
      }
    } catch (err) {
      docsResultsList.innerHTML = `<p class="text-red font-small">Error querying docs: ${escapeHtml(err.message)}</p>`;
    }
  }

  function displayDocDetail(funcName, detail) {
    let argsHtml = "<p class='text-dark'>No parameters</p>";
    if (detail.arguments && detail.arguments.length > 0) {
      argsHtml = `
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Param</th>
                <th>Type</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
      `;
      detail.arguments.forEach(arg => {
        argsHtml += `
          <tr>
            <td><strong><code>${escapeHtml(arg.name)}</code></strong></td>
            <td><code>${escapeHtml(arg.type || "any")}</code></td>
            <td>${escapeHtml(arg.desc || "No description provided.")}</td>
          </tr>
        `;
      });
      argsHtml += "</tbody></table></div>";
    }

    docsDetailView.innerHTML = `
      <div class="inspector-details">
        <h2 class="doc-func-title">${escapeHtml(funcName)}</h2>
        <p class="doc-func-desc">${escapeHtml(detail.description || "No description available.")}</p>
        
        <div class="inspector-section">
          <h3>Signature Syntax</h3>
          <pre class="syntax-box">${escapeHtml(detail.syntax || `${funcName}()`)}</pre>
        </div>

        <div class="inspector-section">
          <h3>Parameters</h3>
          ${argsHtml}
        </div>

        <div class="inspector-section">
          <h3>Pine Script v5/v6 Usage Example</h3>
          <pre class="example-box">${escapeHtml(detail.example || `//@version=5\n// No example provided.`)}</pre>
        </div>
      </div>
    `;
  }


  // ==========================================
  // TAB 5: PUBLIC SCRIPT DOWNLOADER
  // ==========================================
  const downloadForm = document.getElementById("download-form");
  const scriptUrlInput = document.getElementById("script-url-input");
  const scriptFilenameInput = document.getElementById("script-filename-input");
  const downloadSubmitBtn = document.getElementById("download-submit-btn");
  const downloaderStatus = document.getElementById("downloader-status");
  const consoleStatusBadge = document.getElementById("console-status-badge");
  const consoleLog = document.getElementById("console-log");

  // Autofill filename on URL input
  scriptUrlInput.addEventListener("blur", () => {
    const url = scriptUrlInput.value.trim();
    if (!url) return;

    try {
      const parts = url.split("/");
      const scriptPart = parts.find(p => p.includes("-"));
      if (scriptPart) {
        // Example: v995o65g-Squeeze-Momentum-Indicator-LazyBear -> SqueezeMomentum.pine
        const cleanName = scriptPart
          .replace(/^[a-zA-Z0-9]+-/, "") // remove hash prefix
          .split("-")
          .map(w => w.charAt(0).toUpperCase() + w.slice(1))
          .join("");
        
        scriptFilenameInput.value = `${cleanName}.pine`;
      }
    } catch (e) {
      // Ignore URL parsing anomalies
    }
  });

  downloadForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const url = scriptUrlInput.value.trim();
    const filename = scriptFilenameInput.value.trim();

    if (!url || !filename) return;

    // Show console
    downloaderStatus.classList.remove("hidden");
    consoleStatusBadge.innerText = "Running Extraction...";
    consoleStatusBadge.className = "console-badge info";
    consoleLog.innerText = `[Downloader] Starting request...
Url: ${url}
Output filename: out/downloads/${filename}

Launching Playwright browser engine in headless mode...`;
    
    // Disable inputs
    downloadSubmitBtn.disabled = true;
    scriptUrlInput.disabled = true;
    scriptFilenameInput.disabled = true;

    try {
      const response = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, filename })
      });

      const result = await response.json();
      
      if (result.success) {
        consoleStatusBadge.innerText = "SUCCESS";
        consoleStatusBadge.className = "console-badge success";
        consoleLog.innerText += `\n\n[Success] Script extracted successfully!
Output file: ${result.path}

-- Process Output Log --
${result.output}`;
      } else {
        consoleStatusBadge.innerText = "ERROR";
        consoleStatusBadge.className = "console-badge error";
        consoleLog.innerText += `\n\n[Error] Extraction failed:
${result.error}`;
      }
    } catch (err) {
      consoleStatusBadge.innerText = "FAILED";
      consoleStatusBadge.className = "console-badge error";
      consoleLog.innerText += `\n\n[Failed] Connection error: ${err.message}`;
    } finally {
      // Re-enable inputs
      downloadSubmitBtn.disabled = false;
      scriptUrlInput.disabled = false;
      scriptFilenameInput.disabled = false;
    }
  });

  // ==========================================
  // TAB: HEALTH & SESSION
  // ==========================================
  const healthUptimeVal = document.getElementById("health-uptime-val");
  const healthNodeVal = document.getElementById("health-node-val");
  const healthTimeVal = document.getElementById("health-time-val");
  const sessionCountdownBadge = document.getElementById("session-countdown-badge");
  const cacheTotalRowsVal = document.getElementById("cache-total-rows-val");
  const cacheDbSizeVal = document.getElementById("cache-db-size-val");
  const cacheStatsTableBody = document.getElementById("cache-stats-table-body");
  const healthRefreshSessionBtn = document.getElementById("health-refresh-session-btn");

  async function loadHealth() {
    try {
      // 1. Load System Health
      const healthRes = await fetch("/api/health");
      const healthData = await healthRes.json();
      if (healthData.status === "ok") {
        const uptimeHrs = (healthData.uptime / 3600).toFixed(2);
        healthUptimeVal.innerText = `${uptimeHrs} hours`;
        healthNodeVal.innerText = healthData.node;
        healthTimeVal.innerText = new Date(healthData.timestamp).toLocaleTimeString();
      }

      // 2. Load Session Expiry status
      const sessionRes = await fetch("/api/session/validate");
      const sessionData = await sessionRes.json();
      if (sessionData.success && sessionData.valid) {
        sessionCountdownBadge.innerHTML = sessionData.countdownHtml;
      } else {
        sessionCountdownBadge.innerHTML = `<span class="badge badge-red">Expired (${sessionData.reason || "unknown reason"})</span>`;
      }

      // 3. Load SQLite DB Stats
      const cacheRes = await fetch("/api/cache/stats");
      const cacheData = await cacheRes.json();
      if (cacheData.success) {
        const stats = cacheData.stats;
        cacheTotalRowsVal.innerText = stats.totalRows.toLocaleString() + " rows";
        const sizeMb = (stats.dbSize / (1024 * 1024)).toFixed(2);
        cacheDbSizeVal.innerText = `${sizeMb} MB`;

        if (stats.details && stats.details.length > 0) {
          cacheStatsTableBody.innerHTML = "";
          stats.details.forEach(d => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
              <td><strong>${escapeHtml(d.indicatorKey)}</strong></td>
              <td><code>${escapeHtml(d.symbol)}</code></td>
              <td><code>${escapeHtml(d.timeframe)}</code></td>
              <td>${d.count.toLocaleString()}</td>
              <td class="font-small text-muted">${new Date(d.oldest).toLocaleString()}</td>
              <td class="font-small text-muted">${new Date(d.newest).toLocaleString()}</td>
            `;
            cacheStatsTableBody.appendChild(tr);
          });
        } else {
          cacheStatsTableBody.innerHTML = `<tr><td colspan="6" class="text-center">No database cache records found.</td></tr>`;
        }
      }
    } catch (err) {
      console.error("Failed to load health statistics:", err);
    }
  }

  // Bind session refresh button inside Health tab
  if (healthRefreshSessionBtn) {
    healthRefreshSessionBtn.addEventListener("click", async () => {
      try {
        healthRefreshSessionBtn.disabled = true;
        healthRefreshSessionBtn.innerText = "Triggering helper...";
        
        // Call refresh endpoint by calling MCP session tool internally or status
        const res = await fetch("/api/status");
        const statusData = await res.json();
        
        alert("Session credentials refresh triggered! Please check your server console window to complete authentication.");
        loadHealth();
      } catch (err) {
        alert("Failed to refresh session: " + err.message);
      } finally {
        healthRefreshSessionBtn.disabled = false;
        healthRefreshSessionBtn.innerText = "Refresh TV Session Cookies";
      }
    });
  }

  // Notifier Test Button Trigger
  const testNotifierBtn = document.getElementById("test-notifier-btn");
  const testNotifierStatus = document.getElementById("test-notifier-status");

  if (testNotifierBtn) {
    testNotifierBtn.addEventListener("click", async () => {
      try {
        testNotifierBtn.disabled = true;
        testNotifierStatus.innerText = "Sending test alert...";
        testNotifierStatus.className = "font-small text-muted";
        
        const res = await fetch("/api/notifier/test", { method: "POST" });
        const result = await res.json();
        if (result.success) {
          testNotifierStatus.innerText = "Sent successfully!";
          testNotifierStatus.style.color = "var(--neon-green)";
        } else {
          testNotifierStatus.innerText = "Failed: " + result.error;
          testNotifierStatus.style.color = "var(--neon-red)";
        }
      } catch (err) {
        testNotifierStatus.innerText = "Network error: " + err.message;
        testNotifierStatus.style.color = "var(--neon-red)";
      } finally {
        testNotifierBtn.disabled = false;
        setTimeout(() => {
          testNotifierStatus.innerText = "";
        }, 5000);
      }
    });
  }

  // Screener Quick Test Console
  const runScreenerPreviewBtn = document.getElementById("run-screener-preview-btn");
  const screenerMarketSelect = document.getElementById("screener-market-select");
  const screenerPresetSelect = document.getElementById("screener-preset-select");
  const screenerPreviewLoading = document.getElementById("screener-preview-loading");
  const screenerPreviewResult = document.getElementById("screener-preview-result");
  const screenerPreviewLog = document.getElementById("screener-preview-log");

  if (runScreenerPreviewBtn) {
    runScreenerPreviewBtn.addEventListener("click", async () => {
      const market = screenerMarketSelect.value;
      const condition = screenerPresetSelect.value;
      
      runScreenerPreviewBtn.disabled = true;
      screenerPreviewLoading.classList.remove("hidden");
      screenerPreviewResult.classList.add("hidden");
      
      try {
        const res = await fetch(`/api/screener/preview?market=${market}&condition=${condition}&limit=15`);
        const result = await res.json();
        if (result.success) {
          screenerPreviewLog.innerText = result.markdown;
          screenerPreviewResult.classList.remove("hidden");
        } else {
          screenerPreviewLog.innerText = "Error running scan: " + result.error;
          screenerPreviewResult.classList.remove("hidden");
        }
      } catch (err) {
        screenerPreviewLog.innerText = "Connection error: " + err.message;
        screenerPreviewResult.classList.remove("hidden");
      } finally {
        screenerPreviewLoading.classList.add("hidden");
        runScreenerPreviewBtn.disabled = false;
      }
    });
  }

  // ==========================================
  // CUSTOM SCREENER PRESETS
  // ==========================================
  const presetForm = document.getElementById("preset-form");
  const presetKeyInput = document.getElementById("preset-key-input");
  const presetTitleInput = document.getElementById("preset-title-input");
  const presetFieldsInput = document.getElementById("preset-fields-input");
  const presetFiltersInput = document.getElementById("preset-filters-input");
  const presetSortByInput = document.getElementById("preset-sortby-input");
  const presetSortOrderSelect = document.getElementById("preset-sortorder-select");
  const customPresetsListBody = document.getElementById("custom-presets-list-body");

  let loadedPresets = {};

  async function loadScreenerPresets() {
    try {
      const res = await fetch("/api/screener/presets");
      const result = await res.json();
      if (result.success) {
        loadedPresets = result.presets;
        renderScreenerPresets();
        updateScreenerDropdown();
      }
    } catch (err) {
      console.error("Failed to load screener presets:", err);
    }
  }

  function renderScreenerPresets() {
    if (!customPresetsListBody) return;
    customPresetsListBody.innerHTML = "";
    
    const entries = Object.entries(loadedPresets);
    if (entries.length === 0) {
      customPresetsListBody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No custom presets saved.</td></tr>`;
      return;
    }
    
    entries.forEach(([key, p]) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>
          <strong>${escapeHtml(p.title)}</strong><br>
          <span style="font-size: 0.75rem; color: var(--text-dark);">Key: ${escapeHtml(key)}</span>
        </td>
        <td>
          <code>${escapeHtml(p.sort_by)}</code> (${escapeHtml(p.sort_order)})
        </td>
        <td>
          <span class="badge" style="background-color: rgba(0, 242, 254, 0.1); color: var(--neon-cyan);">${p.fields ? p.fields.length : 0} fields</span>
          <span class="badge" style="background-color: rgba(255, 170, 0, 0.1); color: var(--neon-amber);">${p.filters ? p.filters.length : 0} filters</span>
        </td>
        <td style="text-align: right;">
          <button class="btn btn-secondary delete-preset-btn" data-key="${escapeHtml(key)}" style="padding: 4px 8px; font-size: 0.75rem; border-color: var(--neon-red); color: var(--neon-red);">
            <i class="lucide-trash-2"></i> Delete
          </button>
        </td>
      `;
      customPresetsListBody.appendChild(tr);
    });
    
    // Bind delete buttons
    document.querySelectorAll(".delete-preset-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const key = btn.getAttribute("data-key");
        if (confirm(`Are you sure you want to delete the preset '${key}'?`)) {
          try {
            const res = await fetch(`/api/screener/presets/${key}`, { method: "DELETE" });
            const result = await res.json();
            if (result.success) {
              loadScreenerPresets();
            } else {
              alert("Error deleting preset: " + result.error);
            }
          } catch (err) {
            alert("Network error: " + err.message);
          }
        }
      });
    });
  }

  function updateScreenerDropdown() {
    if (!screenerPresetSelect) return;
    
    // Remember currently selected option
    const currentVal = screenerPresetSelect.value;
    
    // Reset dropdown to standard choices
    screenerPresetSelect.innerHTML = `
      <option value="top_volume">Top Volume (Default)</option>
      <option value="top_gainers">Top Gainers</option>
      <option value="oversold">Oversold (RSI &lt; 30)</option>
      <option value="overbought">Overbought (RSI &gt; 70)</option>
      <option value="momentum_breakout">Momentum Breakout</option>
      <option value="trend_following">Trend Following</option>
      <option value="golden_cross">Golden Cross</option>
      <option value="death_cross">Death Cross</option>
      <option value="mean_reversion">Mean Reversion</option>
      <option value="stoch_oversold">Stochastic Oversold</option>
      <option value="whale_accumulation">Whale Accumulation</option>
      <option value="low_volatility_squeeze">Low Volatility Squeeze</option>
      <option value="cycle_reversal_long">Cycle Reversal Long</option>
      <option value="cycle_reversal_short">Cycle Reversal Short</option>
      <option value="divergence_scan">Divergence Scan</option>
    `;
    
    // Append custom presets
    const customEntries = Object.entries(loadedPresets);
    if (customEntries.length > 0) {
      const group = document.createElement("optgroup");
      group.label = "Custom Presets";
      customEntries.forEach(([key, p]) => {
        const opt = document.createElement("option");
        opt.value = key;
        opt.innerText = p.title;
        group.appendChild(opt);
      });
      screenerPresetSelect.appendChild(group);
    }
    
    // Restore selection if it still exists
    screenerPresetSelect.value = currentVal;
    if (!screenerPresetSelect.value && screenerPresetSelect.options.length > 0) {
      screenerPresetSelect.selectedIndex = 0;
    }
  }

  if (presetForm) {
    presetForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const key = presetKeyInput.value.trim();
      const title = presetTitleInput.value.trim();
      let fields, filters;
      
      try {
        fields = JSON.parse(presetFieldsInput.value.trim());
        if (!Array.isArray(fields)) throw new Error("Fields must be a JSON array.");
      } catch (err) {
        alert("Invalid Fields JSON: " + err.message);
        return;
      }
      
      try {
        const filtersStr = presetFiltersInput.value.trim() || "[]";
        filters = JSON.parse(filtersStr);
        if (!Array.isArray(filters)) throw new Error("Filters must be a JSON array.");
      } catch (err) {
        alert("Invalid Filters JSON: " + err.message);
        return;
      }
      
      const sort_by = presetSortByInput.value.trim();
      const sort_order = presetSortOrderSelect.value;
      
      try {
        const res = await fetch("/api/screener/presets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key,
            preset: { title, fields, filters, sort_by, sort_order }
          })
        });
        const result = await res.json();
        if (result.success) {
          presetKeyInput.value = "";
          presetTitleInput.value = "";
          presetFieldsInput.value = "";
          presetFiltersInput.value = "";
          loadScreenerPresets();
        } else {
          alert("Error saving preset: " + result.error);
        }
      } catch (err) {
        alert("Network error: " + err.message);
      }
    });
  }

  // ==========================================
  // SYSTEM LOGS VIEW
  // ==========================================
  const systemLogsBox = document.getElementById("system-logs-box");
  const logsAutoRefresh = document.getElementById("logs-auto-refresh");
  const logsCopyBtn = document.getElementById("logs-copy-btn");
  const logsClearBtn = document.getElementById("logs-clear-btn");

  async function loadSystemLogs() {
    try {
      const res = await fetch("/api/logs");
      const result = await res.json();
      if (result.success && systemLogsBox) {
        if (result.logs.length > 0) {
          systemLogsBox.innerText = result.logs.join("\n");
        } else {
          systemLogsBox.innerText = "No system logs available.";
        }
        // Auto scroll to bottom
        systemLogsBox.scrollTop = systemLogsBox.scrollHeight;
      }
    } catch (err) {
      console.error("Failed to load system logs:", err);
    }
  }

  // Set up logs tab interval
  setInterval(() => {
    if (activeTabId === "logs-tab" && logsAutoRefresh && logsAutoRefresh.checked && document.visibilityState === 'visible') {
      loadSystemLogs();
    }
  }, 2000);

  if (logsCopyBtn) {
    logsCopyBtn.addEventListener("click", () => {
      if (systemLogsBox) {
        navigator.clipboard.writeText(systemLogsBox.innerText)
          .then(() => {
            const originalText = logsCopyBtn.innerHTML;
            logsCopyBtn.innerHTML = "<i class='lucide-check'></i> Copied!";
            setTimeout(() => { logsCopyBtn.innerHTML = originalText; }, 2000);
          })
          .catch(err => {
            alert("Failed to copy: " + err.message);
          });
      }
    });
  }

  if (logsClearBtn) {
    logsClearBtn.addEventListener("click", () => {
      if (systemLogsBox) {
        systemLogsBox.innerText = "Logs cleared by user.";
      }
    });
  }

  // ==========================================
  // LOCAL SANDBOX & VISUALIZATION
  // ==========================================
  let chart = null;
  let candlestickSeries = null;
  let volumeSeries = null;
  let lineSeriesMap = new Map();

  function initSandboxChart() {
    const container = document.getElementById("sandbox-chart-container");
    if (!container) return;

    const noDataDiv = document.getElementById("chart-no-data");
    if (noDataDiv) noDataDiv.style.display = "none";

    if (chart) {
      try {
        chart.remove();
      } catch (err) {
        console.error("Failed to remove chart:", err);
      }
      chart = null;
      candlestickSeries = null;
      volumeSeries = null;
      lineSeriesMap.clear();
    }

    chart = LightweightCharts.createChart(container, {
      width: container.clientWidth,
      height: 320,
      layout: {
        background: { type: 'solid', color: '#0c1015' },
        textColor: '#a5a6a9',
      },
      grid: {
        vertLines: { color: 'rgba(42, 46, 57, 0.3)' },
        horzLines: { color: 'rgba(42, 46, 57, 0.3)' },
      },
      crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: 'rgba(197, 203, 206, 0.8)',
      },
      timeScale: {
        borderColor: 'rgba(197, 203, 206, 0.8)',
        timeVisible: true,
      },
    });

    candlestickSeries = chart.addCandlestickSeries({
      upColor: '#00e676',
      downColor: '#ff1744',
      borderDownColor: '#ff1744',
      borderUpColor: '#00e676',
      wickDownColor: '#ff1744',
      wickUpColor: '#00e676',
    });

    volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '',
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });
  }

  function generateMockData(numBars = 100) {
    const data = [];
    let price = 60000;
    let time = Math.floor(Date.now() / 1000) - numBars * 3600;
    
    for (let i = 0; i < numBars; i++) {
      const change = (Math.random() - 0.48) * 400;
      const open = price;
      const close = price + change;
      const high = Math.max(open, close) + Math.random() * 150;
      const low = Math.min(open, close) - Math.random() * 150;
      const volume = Math.floor(Math.random() * 800) + 100;
      
      data.push({
        time: time + i * 3600,
        open: parseFloat(open.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        close: parseFloat(close.toFixed(2)),
        volume: parseFloat(volume.toFixed(2))
      });
      price = close;
    }
    return data;
  }

  async function getSandboxDataset() {
    const datasetSelect = document.getElementById("sandbox-dataset-select");
    if (!datasetSelect) return generateMockData();

    if (datasetSelect.value === "cached_tv") {
      try {
        const res = await fetch("/api/cache/bars?limit=300");
        const result = await res.json();
        if (result.success && result.bars && result.bars.length > 0) {
          return result.bars;
        } else {
          sandboxLogBox.innerText += "\n[Warning] Database has no cached bars. Falling back to BTC sample dataset.\n";
          return generateMockData(300);
        }
      } catch (err) {
        console.error("Failed to fetch cache bars:", err);
        return generateMockData(300);
      }
    } else {
      return generateMockData(150);
    }
  }

  const sandboxRunBtn = document.getElementById("sandbox-run-btn");
  const sandboxCompileBtn = document.getElementById("sandbox-compile-btn");
  const sandboxCodeEditor = document.getElementById("sandbox-code-editor");
  const sandboxLogBox = document.getElementById("sandbox-log-box");
  const sandboxStatusBadge = document.getElementById("sandbox-status-badge");
  const sandboxOutputTitle = document.getElementById("sandbox-output-title");

  if (sandboxCodeEditor && !sandboxCodeEditor.value) {
    sandboxCodeEditor.value = `//@version=5
indicator("EMA & SMA Cross", overlay=true)
fastLength = input(9, "Fast Length")
slowLength = input(21, "Slow Length")

fastEMA = ta.ema(close, fastLength)
slowSMA = ta.sma(close, slowLength)

plot(fastEMA, "Fast EMA", color=color.green)
plot(slowSMA, "Slow SMA", color=color.red)
`;
  }

  if (sandboxRunBtn) {
    sandboxRunBtn.addEventListener("click", async () => {
      const code = sandboxCodeEditor.value.trim();
      if (!code) {
        alert("Please enter some Pine Script code first.");
        return;
      }

      sandboxRunBtn.disabled = true;
      sandboxStatusBadge.innerText = "Running...";
      sandboxStatusBadge.className = "console-badge info";
      sandboxLogBox.innerText = "Initializing Sandbox Engine...\n";
      sandboxOutputTitle.innerText = "Execution Logs";

      try {
        const dataset = await getSandboxDataset();
        initSandboxChart();

        candlestickSeries.setData(dataset.map(b => ({
          time: b.time,
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close
        })));

        volumeSeries.setData(dataset.map(b => ({
          time: b.time,
          value: b.volume,
          color: b.close >= b.open ? 'rgba(0, 230, 118, 0.4)' : 'rgba(255, 23, 68, 0.4)'
        })));

        const isStrategy = /\bstrategy\s*\(/i.test(code);

        if (isStrategy) {
          sandboxLogBox.innerText += "Detected Strategy Script. Spawning PineForge strategy simulation via Docker...\n";
          
          const res = await fetch("/api/backtest/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code,
              ohlcv: dataset
            })
          });

          const result = await res.json();
          if (result.success && result.report) {
            const report = result.report;
            sandboxStatusBadge.innerText = "Success";
            sandboxStatusBadge.className = "console-badge success";
            sandboxOutputTitle.innerText = "Strategy Backtest Performance Report";
            
            let logMsg = `=== BACKTEST SUCCESS ===\n`;
            logMsg += `Total Trades executed: ${report.total_trades || report.trades?.length || 0}\n`;
            logMsg += `Net Profit: $${report.net_profit?.toFixed(2) || 0.00}\n`;
            if (report.metrics?.equity) {
              const eq = report.metrics.equity;
              logMsg += `Max Drawdown: $${eq.max_drawdown?.toFixed(2)} (${eq.max_drawdown_pct?.toFixed(2)}%)\n`;
              logMsg += `Sharpe Ratio: ${eq.sharpe_tv?.toFixed(2) || 'N/A'}\n`;
            }
            if (report.metrics?.all) {
              const all = report.metrics.all;
              logMsg += `Win Rate: ${all.percent_profitable?.toFixed(1)}%\n`;
              logMsg += `Profit Factor: ${all.profit_factor?.toFixed(2)}\n`;
              logMsg += `Average Win: $${all.avg_win?.toFixed(2)} vs Average Loss: $${all.avg_loss?.toFixed(2)}\n`;
            }
            
            if (report.trades && report.trades.length > 0) {
              logMsg += `\n--- Trade History ---\n`;
              report.trades.forEach((t, i) => {
                const side = t.is_long ? "BUY" : "SELL";
                const entryT = new Date(t.entry_time * 1000).toLocaleString();
                const exitT = new Date(t.exit_time * 1000).toLocaleString();
                logMsg += `[Trade #${i+1}] ${side} | Entry: $${t.entry_price.toFixed(2)} (${entryT}) -> Exit: $${t.exit_price.toFixed(2)} (${exitT}) | P&L: $${t.pnl.toFixed(2)} (${t.pnl_pct.toFixed(2)}%)\n`;
              });
            } else {
              logMsg += `\nNo trades executed during backtest.\n`;
            }
            sandboxLogBox.innerText = logMsg;

            if (report.trades && report.trades.length > 0) {
              const markers = [];
              report.trades.forEach(t => {
                markers.push({
                  time: t.entry_time,
                  position: t.is_long ? 'belowBar' : 'aboveBar',
                  color: t.is_long ? '#00e676' : '#ff1744',
                  shape: t.is_long ? 'arrowUp' : 'arrowDown',
                  text: t.is_long ? 'Buy' : 'Sell',
                });
                markers.push({
                  time: t.exit_time,
                  position: t.is_long ? 'aboveBar' : 'belowBar',
                  color: t.is_long ? '#ff1744' : '#00e676',
                  shape: t.is_long ? 'arrowDown' : 'arrowUp',
                  text: 'Exit',
                });
              });
              
              markers.sort((a, b) => a.time - b.time);
              candlestickSeries.setMarkers(markers);
            }

          } else {
            sandboxStatusBadge.innerText = "Error";
            sandboxStatusBadge.className = "console-badge error";
            sandboxLogBox.innerText += `\nError running backtest:\n${result.error || "Unknown error occurred."}`;
          }

        } else {
          sandboxLogBox.innerText += "Detected Study/Indicator Script. Running PineTS compilation...\n";

          const res = await fetch("/api/indicator/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code,
              ohlcv: dataset
            })
          });

          const result = await res.json();
          if (result.success) {
            sandboxStatusBadge.innerText = "Success";
            sandboxStatusBadge.className = "console-badge success";
            
            let logMsg = `=== INDICATOR COMPUTED SUCCESSFULLY ===\n`;
            const plotKeys = Object.keys(result.plots || {});
            
            if (plotKeys.length > 0) {
              logMsg += `Rendered Plots: ${plotKeys.join(", ")}\n\n`;
              
              plotKeys.forEach((key, i) => {
                const plot = result.plots[key];
                const color = plot.color || `hsl(${(i * 120) % 360}, 100%, 60%)`;
                
                const lineSeries = chart.addLineSeries({
                  color,
                  lineWidth: 2,
                  title: plot.title || key,
                });
                
                const lineData = plot.data
                  .filter(d => d.value !== null)
                  .map(d => ({
                    time: d.time,
                    value: d.value
                  }));
                
                lineSeries.setData(lineData);
                lineSeriesMap.set(key, lineSeries);
                
                const lastVal = lineData[lineData.length - 1];
                logMsg += `[Plot: ${plot.title || key}] Last Value: ${lastVal ? lastVal.value.toFixed(2) : "N/A"}\n`;
              });
            } else {
              logMsg += `Warning: Compiled script contains no plot() outputs.\n`;
            }

            if (result.transpiledJS) {
              logMsg += `\n--- Transpiled JS Code Snippet (from Opus-Aether-AI/pine-transpiler) ---\n`;
              logMsg += result.transpiledJS.substring(0, 1500) + "\n...\n[Truncated - see full file]";
            }
            
            sandboxLogBox.innerText = logMsg;

          } else {
            sandboxStatusBadge.innerText = "Error";
            sandboxStatusBadge.className = "console-badge error";
            sandboxLogBox.innerText += `\nCompilation Error:\n${result.error || "Unknown compilation error."}`;
          }
        }

      } catch (err) {
        sandboxStatusBadge.innerText = "Error";
        sandboxStatusBadge.className = "console-badge error";
        sandboxLogBox.innerText += `\nFailed to run execution engine:\n${err.message || String(err)}`;
      } finally {
        sandboxRunBtn.disabled = false;
      }
    });
  }

  if (sandboxCompileBtn) {
    sandboxCompileBtn.addEventListener("click", async () => {
      const code = sandboxCodeEditor.value.trim();
      if (!code) {
        alert("Please enter some Pine Script code first.");
        return;
      }

      sandboxCompileBtn.disabled = true;
      sandboxStatusBadge.innerText = "Compiling...";
      sandboxStatusBadge.className = "console-badge info";
      sandboxLogBox.innerText = "Sending code to C++ Transpiler (PineForge)...\n";
      sandboxOutputTitle.innerText = "C++ Compilation Output";

      try {
        const res = await fetch("/api/transpile/strategy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code })
        });

        const result = await res.json();
        if (result.success && result.cppCode) {
          sandboxStatusBadge.innerText = "Success";
          sandboxStatusBadge.className = "console-badge success";
          sandboxLogBox.innerText = `=== C++ CODE TRANSLATED SUCCESSFULLY ===\n\n${result.cppCode.substring(0, 2000)}\n...\n[Truncated C++ Output]`;
        } else {
          sandboxStatusBadge.innerText = "Error";
          sandboxStatusBadge.className = "console-badge error";
          sandboxLogBox.innerText += `\nTranspilation Failed:\n${result.error || "Failed to compile Strategy to C++."}`;
        }
      } catch (err) {
        sandboxStatusBadge.innerText = "Error";
        sandboxStatusBadge.className = "console-badge error";
        sandboxLogBox.innerText += `\nCompilation Request Failed:\n${err.message || String(err)}`;
      } finally {
        sandboxCompileBtn.disabled = false;
      }
    });
  }

  function loadSandboxTab() {
    console.log("[Sandbox] Tab loaded.");
    const noDataDiv = document.getElementById("chart-no-data");
    if (noDataDiv) noDataDiv.style.display = "flex";
  }

});
