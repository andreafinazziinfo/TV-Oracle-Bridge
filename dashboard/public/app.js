// TV-Oracle-Bridge - Dashboard Client Engine
document.addEventListener("DOMContentLoaded", () => {
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
    }
  }

  // Initial load
  loadStatus();

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
        sessionStatusVal.innerText = "Valid Session";
        sessionStatusVal.className = "stat-value text-green";
      } else {
        sessionStatusVal.innerText = "Missing Cookie";
        sessionStatusVal.className = "stat-value text-red";
      }

      // Update Env Table
      envList.innerHTML = "";
      for (const [key, value] of Object.entries(stats.env)) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><strong>${key}</strong></td>
          <td><code>${value}</code></td>
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
      envList.innerHTML = `<tr><td colspan="2" class="text-center text-red">Failed to load environment status: ${err.message}</td></tr>`;
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

  // Set daemon polling loop (every 3 seconds)
  setInterval(() => {
    if (activeTabId === "status-tab") {
      loadDaemonStatus();
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

  async function loadScreenshots() {
    try {
      gallery.innerHTML = '<p class="loading-placeholder">Scanning screenshots...</p>';

      const res = await fetch("/api/screenshots");
      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      const list = result.screenshots;
      if (list.length === 0) {
        gallery.innerHTML = `
          <div class="inspector-empty" style="grid-column: 1 / -1;">
            <i class="lucide-image-off"></i>
            <p>No screenshots captured yet. Run a screenshot macro to save charts.</p>
          </div>
        `;
        return;
      }

      gallery.innerHTML = "";
      list.forEach(scr => {
        const card = document.createElement("div");
        card.className = "gallery-card";
        card.innerHTML = `
          <div class="gallery-thumb-wrapper">
            <img class="gallery-thumb" src="${scr.url}" alt="${scr.filename}" loading="lazy">
            <div class="gallery-overlay">
              <div class="gallery-info">
                <span class="gallery-title">${scr.filename}</span>
                <span class="gallery-date">${new Date(scr.createdAt).toLocaleString()}</span>
              </div>
            </div>
          </div>
        `;

        card.addEventListener("click", () => {
          openLightbox(scr.url, `${scr.filename} (${new Date(scr.createdAt).toLocaleString()})`);
        });

        gallery.appendChild(card);
      });
    } catch (err) {
      gallery.innerHTML = `<p class="loading-placeholder text-red">Error loading screenshots: ${err.message}</p>`;
    }
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
          <span class="list-item-title">${ind.meta.name || ind.indicatorKey}</span>
          <div class="list-item-subtitle">
            <span>${ind.meta.symbol || "N/A"} (${ind.meta.timeframe || "N/A"})</span>
            <span>${ind.periodsCount} bars</span>
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
      indicatorsList.innerHTML = `<p class="loading-placeholder font-small text-red">Error: ${err.message}</p>`;
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
        <h2><i class="lucide-file-code"></i> ${meta.name || key}</h2>
        <p class="panel-subtitle">Key: <code>${key}</code> • File: <code>out/${key}.json</code></p>
      `;

      // Build plots indicator tags (color dots for visual feedback)
      let plotsHtml = '<p class="text-dark">No plots found</p>';
      if (indData.plots && indData.plots.length > 0) {
        plotsHtml = '<div class="plots-tags">';
        indData.plots.forEach((p, idx) => {
          const color = p.color || "#00f2fe";
          plotsHtml += `
            <div class="plot-tag">
              <span class="plot-dot" style="background-color: ${color}"></span>
              <span>${p.name || `plot_${idx}`}</span>
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
              <div class="info-card-label">${inKey}</div>
              <div class="info-card-value">${typeof inVal === 'object' ? JSON.stringify(inVal) : inVal}</div>
            </div>
          `;
        }
        inputsHtml += "</div>";
      }

      // Build OHLCV and plot tables (limit to last 100 rows for smooth DOM rendering)
      let tableHeaders = "<tr><th>Timestamp</th><th>Open</th><th>High</th><th>Low</th><th>Close</th><th>Volume</th>";
      if (indData.plots && indData.plots.length > 0) {
        indData.plots.forEach(p => {
          tableHeaders += `<th>${p.name}</th>`;
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
                <div class="info-card-value text-green">${meta.symbol || "N/A"}</div>
              </div>
              <div class="inspector-info-card">
                <div class="info-card-label">Timeframe</div>
                <div class="info-card-value text-green">${meta.timeframe || "N/A"}</div>
              </div>
              <div class="inspector-info-card">
                <div class="info-card-label">Type</div>
                <div class="info-card-value">${meta.type || "Study/Indicator"}</div>
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
          <p>Failed to load indicator details: ${err.message}</p>
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
      docsResultsList.innerHTML = `<p class="text-red font-small">Error querying docs: ${err.message}</p>`;
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
            <td><strong><code>${arg.name}</code></strong></td>
            <td><code>${arg.type || "any"}</code></td>
            <td>${arg.desc || "No description provided."}</td>
          </tr>
        `;
      });
      argsHtml += "</tbody></table></div>";
    }

    docsDetailView.innerHTML = `
      <div class="inspector-details">
        <h2 class="doc-func-title">${funcName}</h2>
        <p class="doc-func-desc">${detail.description || "No description available."}</p>
        
        <div class="inspector-section">
          <h3>Signature Syntax</h3>
          <pre class="syntax-box">${detail.syntax || `${funcName}()`}</pre>
        </div>

        <div class="inspector-section">
          <h3>Parameters</h3>
          ${argsHtml}
        </div>

        <div class="inspector-section">
          <h3>Pine Script v5/v6 Usage Example</h3>
          <pre class="example-box">${detail.example || `//@version=5\n// No example provided.`}</pre>
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

});
