// LEGACY FILE — not loaded by index.html.
// This is an older, simpler version of the dashboard (CSV/Excel/JSON upload only,
// no SQLite support). Kept for reference. All active development happens in app.large.js.

const STORAGE_KEY = "supportAnalyticsSessionV1";
const chartStore = {};

const state = {
  datasets: [],
  activeDatasetId: null,
  aiEnabled: false,
  table: {
    sortKey: null,
    sortDir: 1,
    filter: "",
    page: 1,
    pageSize: 25
  }
};

const HANDOVER_REGEX = /\b(agent|human|handover|escalat|transfer|specialist)\b/i;
const NEGATIVE_REGEX = /\b(angry|frustrat|upset|bad|terrible|hate|not working|still broken|complain|annoyed)\b/i;
const FALLBACK_REGEX = /\b(i do(?: not|n't) understand|cannot help|rephrase|didn'?t catch|fallback|not sure)\b/i;

document.addEventListener("DOMContentLoaded", init);

function init() {
  loadSession();
  bindEvents();
  renderDatasetSelect();
  renderAll();
}

function bindEvents() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => activateTab(btn.dataset.tab));
  });

  byId("uploadBtn").addEventListener("click", handleUpload);
  byId("clearDataBtn").addEventListener("click", clearData);
  byId("activeDatasetSelect").addEventListener("change", (e) => {
    state.activeDatasetId = e.target.value || null;
    saveSession();
    renderAll();
  });
  byId("aiEnabled").addEventListener("change", (e) => {
    state.aiEnabled = e.target.checked;
    saveSession();
  });
  byId("runAiBtn").addEventListener("click", runAiEnrichment);

  byId("tableFilterInput").addEventListener("input", (e) => {
    state.table.filter = e.target.value.trim().toLowerCase();
    state.table.page = 1;
    renderDataTable();
  });
  byId("tablePageSize").addEventListener("change", (e) => {
    state.table.pageSize = Number(e.target.value) || 25;
    state.table.page = 1;
    renderDataTable();
  });
  byId("tablePrevBtn").addEventListener("click", () => {
    if (state.table.page > 1) {
      state.table.page -= 1;
      renderDataTable();
    }
  });
  byId("tableNextBtn").addEventListener("click", () => {
    state.table.page += 1;
    renderDataTable();
  });
}

function activateTab(tabId) {
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tabId));
  document.querySelectorAll(".tab-content").forEach((t) => t.classList.toggle("active", t.id === tabId));
}

async function handleUpload() {
  const files = byId("datasetInput").files;
  if (!files || !files.length) {
    setStatus("Select at least one dataset file.");
    return;
  }
  setStatus("Parsing and analyzing datasets...");
  try {
    for (const file of files) {
      const rows = await parseFile(file);
      const dataset = buildDataset(file.name, rows);
      state.datasets.push(dataset);
      state.activeDatasetId = dataset.id;
    }
    saveSession();
    renderDatasetSelect();
    renderAll();
    setStatus(`Analyzed ${files.length} file(s).`);
  } catch (error) {
    setStatus(`Upload failed: ${error.message}`);
  }
}

function clearData() {
  const ok = window.confirm("You are about to clear the dataset(s). Are you sure?");
  if (!ok) {
    return;
  }
  state.datasets = [];
  state.activeDatasetId = null;
  state.table.page = 1;
  sessionStorage.removeItem(STORAGE_KEY);
  renderDatasetSelect();
  renderAll();
  setStatus("All datasets cleared for this session.");
}

async function parseFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (ext === "csv") {
    return parseCsv(file);
  }
  if (ext === "xlsx" || ext === "xls") {
    return parseExcel(file);
  }
  if (ext === "json") {
    return parseJson(file);
  }
  throw new Error(`Unsupported file type: ${ext}`);
}

function parseCsv(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => resolve(normalizeRows(result.data)),
      error: (err) => reject(err)
    });
  });
}

async function parseExcel(file) {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data);
  const firstSheet = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: null });
  return normalizeRows(rows);
}

async function parseJson(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  if (Array.isArray(parsed)) {
    return normalizeRows(parsed);
  }
  if (Array.isArray(parsed.data)) {
    return normalizeRows(parsed.data);
  }
  if (Array.isArray(parsed.rows)) {
    return normalizeRows(parsed.rows);
  }
  if (typeof parsed === "object" && parsed !== null) {
    return normalizeRows([parsed]);
  }
  return [];
}

function normalizeRows(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }
  const objectRows = rows.map((row) => {
    if (row && typeof row === "object" && !Array.isArray(row)) {
      return row;
    }
    return { value: row };
  });
  const keys = Array.from(new Set(objectRows.flatMap((r) => Object.keys(r))));
  return objectRows.map((row) => {
    const out = {};
    keys.forEach((k) => {
      out[k] = row[k] ?? null;
    });
    return out;
  });
}

function buildDataset(name, rows) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const analysis = analyzeDataset(rows);
  return {
    id,
    name,
    uploadedAt: new Date().toISOString(),
    rows,
    analysis
  };
}

function analyzeDataset(rows) {
  const columns = rows.length ? Object.keys(rows[0]) : [];
  const columnTypes = detectColumnTypes(rows, columns);
  const quality = detectQualityIssues(rows, columns, columnTypes);
  const fields = detectConversationFields(columns);
  const conversations = buildConversations(rows, fields);
  const convoAnalysis = analyzeConversations(conversations);
  const timeline = buildTimeline(conversations, convoAnalysis.timestampField);

  return {
    rowCount: rows.length,
    columns,
    columnTypes,
    quality,
    fields,
    conversations,
    ...convoAnalysis,
    timeline
  };
}

function detectColumnTypes(rows, columns) {
  return columns.map((col) => {
    const values = rows.map((r) => r[col]).filter((v) => !isEmpty(v));
    const numericCount = values.filter((v) => isFiniteNumber(v)).length;
    const datetimeCount = values.filter((v) => isDatetime(v)).length;
    const uniqueCount = new Set(values.map((v) => String(v).trim().toLowerCase())).size;
    let type = "text";
    if (values.length && numericCount / values.length > 0.8) {
      type = "numeric";
    } else if (values.length && datetimeCount / values.length > 0.8) {
      type = "datetime";
    } else if (values.length && uniqueCount / values.length < 0.2) {
      type = "categorical";
    }
    return { column: col, type, nonNullCount: values.length, uniqueCount };
  });
}

function detectQualityIssues(rows, columns, columnTypes) {
  const typeMap = Object.fromEntries(columnTypes.map((c) => [c.column, c.type]));
  return columns.map((col) => {
    const values = rows.map((r) => r[col]);
    const missing = values.filter((v) => isEmpty(v) || /^(null|na|n\/a|undefined)$/i.test(String(v))).length;
    let inconsistent = 0;
    if (typeMap[col] === "numeric") {
      inconsistent = values.filter((v) => !isEmpty(v) && !isFiniteNumber(v)).length;
    } else if (typeMap[col] === "datetime") {
      inconsistent = values.filter((v) => !isEmpty(v) && !isDatetime(v)).length;
    }
    return {
      column: col,
      missingCount: missing,
      missingPct: toPct(missing, rows.length),
      inconsistentCount: inconsistent
    };
  });
}

function detectConversationFields(columns) {
  const pick = (patterns) => columns.find((c) => patterns.some((p) => p.test(c.toLowerCase())));
  return {
    conversationId: pick([/conversation.*id/, /^conv_id$/, /^ticket/, /thread.*id/, /^id$/]),
    userMessage: pick([/user.*message/, /customer.*message/, /question/, /user_text/, /^message$/]),
    botResponse: pick([/bot.*response/, /assistant.*response/, /agent.*response/, /reply/, /response/]),
    timestamp: pick([/timestamp/, /created.*at/, /time/, /date/]),
    status: pick([/status/, /resolved/, /escalat/, /outcome/]),
    escalationFlag: pick([/escalat/, /handover/, /human/, /agent_required/, /transfer/]),
    category: pick([/category/, /intent/, /topic/, /issue/])
  };
}

function buildConversations(rows, fields) {
  if (!rows.length) {
    return [];
  }
  const groups = new Map();
  rows.forEach((row, idx) => {
    const key = fields.conversationId ? String(row[fields.conversationId] ?? `row-${idx}`) : `row-${idx}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(row);
  });

  const conversations = [];
  groups.forEach((records, id) => {
    const sorted = fields.timestamp
      ? [...records].sort((a, b) => toDate(a[fields.timestamp]) - toDate(b[fields.timestamp]))
      : records;
    conversations.push({ id, records: sorted });
  });
  return conversations;
}

function analyzeConversations(conversations) {
  const statusCount = { resolved: 0, unresolved: 0, escalated: 0 };
  const handoverRows = [];
  const handoverByCategory = {};
  const problemCounts = {};
  const problemExamples = {};
  const failureSignals = { repeatedQuestions: 0, negativeSentiment: 0, fallbackResponses: 0, longUnresolved: 0 };
  const timestampField = "handoverTime";

  conversations.forEach((conv) => {
    const records = conv.records;
    const fullText = records.map((r) => Object.values(r).join(" ")).join(" ").toLowerCase();
    const statuses = records.map((r) => Object.values(r).join(" ").toLowerCase());
    const resolved = statuses.some((s) => /\bresolved|closed|solved|completed\b/.test(s));
    const escalated = statuses.some((s) => /\bescalat|handover|transfer|human|agent\b/.test(s));
    if (resolved) {
      statusCount.resolved += 1;
    } else {
      statusCount.unresolved += 1;
    }
    if (escalated) {
      statusCount.escalated += 1;
    }

    const repeatedQuestions = detectRepeatedQuestions(records);
    const negative = NEGATIVE_REGEX.test(fullText);
    const fallback = FALLBACK_REGEX.test(fullText);
    const longUnresolved = !resolved && records.length > 8;

    if (repeatedQuestions) failureSignals.repeatedQuestions += 1;
    if (negative) failureSignals.negativeSentiment += 1;
    if (fallback) failureSignals.fallbackResponses += 1;
    if (longUnresolved) failureSignals.longUnresolved += 1;

    const handoverFound = HANDOVER_REGEX.test(fullText) || escalated || (fallback && repeatedQuestions);
    const issueCategory = categorizeIssue(fullText);
    problemCounts[issueCategory] = (problemCounts[issueCategory] || 0) + 1;
    if (!problemExamples[issueCategory]) {
      problemExamples[issueCategory] = [];
    }
    if (problemExamples[issueCategory].length < 3) {
      problemExamples[issueCategory].push(trimText(fullText, 210));
    }

    if (handoverFound) {
      const handoverTime = inferConversationTime(records);
      handoverRows.push({
        conversationId: conv.id,
        handoverTime,
        category: issueCategory,
        reason: detectHandoverReason(fullText, escalated, fallback, repeatedQuestions),
        turns: records.length
      });
      handoverByCategory[issueCategory] = (handoverByCategory[issueCategory] || 0) + 1;
    }
  });

  const topProblems = Object.entries(problemCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([problem, frequency]) => ({
      problem,
      frequency,
      examples: problemExamples[problem] || []
    }));

  const totalConversations = conversations.length;
  const handoverCount = handoverRows.length;
  const resolutionRate = toPct(statusCount.resolved, totalConversations);
  const handoverRate = toPct(handoverCount, totalConversations);

  return {
    totalConversations,
    statusCount,
    handoverCount,
    handoverRate,
    resolutionRate,
    handoverRows,
    handoverByCategory,
    failureSignals,
    topProblems,
    timestampField
  };
}

function buildTimeline(conversations) {
  const volume = {};
  conversations.forEach((conv) => {
    const time = inferConversationTime(conv.records);
    const day = safeDay(time);
    volume[day] = (volume[day] || 0) + 1;
  });
  return Object.entries(volume).sort((a, b) => a[0].localeCompare(b[0]));
}

function detectRepeatedQuestions(records) {
  const normalized = records
    .map((r) => String(Object.values(r).join(" ")).toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const counts = {};
  normalized.forEach((line) => {
    counts[line] = (counts[line] || 0) + 1;
  });
  return Object.values(counts).some((count) => count >= 2);
}

function detectHandoverReason(text, escalated, fallback, repeated) {
  if (escalated) return "Escalation flag/status";
  if (/human|agent|transfer|handover/.test(text)) return "Handover keyword";
  if (fallback && repeated) return "Conversation interruption/failure loop";
  return "Detected support transfer signal";
}

function categorizeIssue(text) {
  const rules = [
    { key: "billing", pattern: /\b(bill|invoice|payment|charged|refund|price|subscription)\b/ },
    { key: "login", pattern: /\b(login|sign in|password|otp|2fa|authentication|locked out)\b/ },
    { key: "delivery", pattern: /\b(delivery|shipment|shipping|track|courier|package|late)\b/ },
    { key: "technical", pattern: /\b(error|bug|crash|not working|broken|issue|timeout|api)\b/ },
    { key: "account", pattern: /\b(account|profile|email change|delete account|settings)\b/ },
    { key: "order", pattern: /\b(order|cancel|return|exchange|item)\b/ }
  ];
  const hit = rules.find((rule) => rule.pattern.test(text));
  return hit ? hit.key : "other";
}

async function runAiEnrichment() {
  const dataset = getActiveDataset();
  if (!dataset) {
    setStatus("Upload and select a dataset first.");
    return;
  }
  if (!byId("aiEnabled").checked) {
    setStatus("Enable AI analysis first.");
    return;
  }
  const apiKey = byId("openAiKey").value.trim();
  if (!apiKey) {
    setStatus("Enter an OpenAI API key to run AI enrichment.");
    return;
  }

  setStatus("Running GPT-4o enrichment...");
  try {
    const payload = dataset.analysis.topProblems.map((p) => ({
      issue: p.problem,
      frequency: p.frequency,
      examples: p.examples
    }));
    const prompt = [
      "Return strict JSON only.",
      "Create improved issue labels and 3-5 concise business insights.",
      "Input:",
      JSON.stringify(payload)
    ].join("\n");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a support analytics assistant. Output must be valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });
    if (!response.ok) {
      throw new Error(`OpenAI API error ${response.status}`);
    }
    const data = await response.json();
    const text = extractResponseText(data);
    const parsed = parseJsonFromText(text);
    dataset.analysis.aiInsights = Array.isArray(parsed.insights) ? parsed.insights.slice(0, 5) : [];
    dataset.analysis.aiIssueLabels = parsed.issue_labels || {};
    saveSession();
    renderAll();
    setStatus("AI enrichment complete.");
  } catch (error) {
    setStatus(`AI enrichment failed: ${error.message}`);
  }
}

function extractResponseText(data) {
  if (data?.choices?.[0]?.message?.content) return data.choices[0].message.content;
  if (typeof data.output_text === "string") return data.output_text;
  if (Array.isArray(data.output)) {
    return data.output
      .flatMap((item) => item.content || [])
      .map((c) => c.text || "")
      .join("\n");
  }
  return "";
}

function parseJsonFromText(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return {};
    return JSON.parse(match[0]);
  }
}

function renderDatasetSelect() {
  const sel = byId("activeDatasetSelect");
  sel.innerHTML = "";
  if (!state.datasets.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No dataset loaded";
    sel.appendChild(opt);
    return;
  }
  state.datasets.forEach((d) => {
    const opt = document.createElement("option");
    opt.value = d.id;
    opt.textContent = `${d.name} (${d.analysis.rowCount} rows)`;
    sel.appendChild(opt);
  });
  if (!state.activeDatasetId) {
    state.activeDatasetId = state.datasets[state.datasets.length - 1].id;
  }
  sel.value = state.activeDatasetId;
  byId("aiEnabled").checked = !!state.aiEnabled;
}

function renderAll() {
  renderOverview();
  renderColumnTypes();
  renderQuality();
  renderDataTable();
  renderHandovers();
  renderProblems();
  renderComparison();
}

function renderOverview() {
  const dataset = getActiveDataset();
  if (!dataset) {
    byId("kpiConversations").textContent = "0";
    byId("kpiResolutionRate").textContent = "0%";
    byId("kpiHandoverRate").textContent = "0%";
    byId("insightsList").innerHTML = "<li>Upload a dataset to generate insights.</li>";
    destroyChart("resolutionPie");
    destroyChart("volumeLine");
    return;
  }
  const a = dataset.analysis;
  byId("kpiConversations").textContent = String(a.totalConversations);
  byId("kpiResolutionRate").textContent = `${a.resolutionRate}%`;
  byId("kpiHandoverRate").textContent = `${a.handoverRate}%`;

  const resolved = a.statusCount.resolved;
  const unresolved = a.totalConversations - resolved;
  drawChart("resolutionPie", "pie", {
    labels: ["Resolved", "Unresolved"],
    datasets: [{ data: [resolved, unresolved], backgroundColor: ["#33d17a", "#ff5f77"] }]
  });

  const volLabels = a.timeline.map((t) => t[0]);
  const volValues = a.timeline.map((t) => t[1]);
  drawChart("volumeLine", "line", {
    labels: volLabels,
    datasets: [{ label: "Conversations", data: volValues, borderColor: "#5c8cff", fill: false, tension: 0.25 }]
  });

  const insights = generateInsights(dataset);
  byId("insightsList").innerHTML = insights.map((i) => `<li>${escapeHtml(i)}</li>`).join("");
}

function generateInsights(dataset) {
  const a = dataset.analysis;
  const top = a.topProblems[0];
  const highestCategory = Object.entries(a.handoverByCategory).sort((x, y) => y[1] - x[1])[0];
  const base = [
    `Handover rate is ${a.handoverRate}% across ${a.totalConversations} conversations.`,
    top ? `Most common problem category is "${mapIssueLabel(top.problem, a)}" with ${top.frequency} conversations.` : "No problem category signals detected yet.",
    highestCategory ? `Most handovers happen in "${mapIssueLabel(highestCategory[0], a)}".` : "No handovers detected from current signals.",
    `Failure loops: repeated questions (${a.failureSignals.repeatedQuestions}), fallback responses (${a.failureSignals.fallbackResponses}), long unresolved chats (${a.failureSignals.longUnresolved}).`,
    "Improvement opportunity: strengthen AI response quality on top issue categories and auto-escalate sooner on repeated fallback patterns."
  ];
  if (Array.isArray(a.aiInsights) && a.aiInsights.length) {
    return a.aiInsights.slice(0, 5);
  }
  return base.slice(0, 5);
}

function renderColumnTypes() {
  const dataset = getActiveDataset();
  const wrap = byId("columnTypeTableWrap");
  if (!dataset) {
    wrap.innerHTML = "";
    return;
  }
  renderTable(
    wrap,
    dataset.analysis.columnTypes,
    ["column", "type", "nonNullCount", "uniqueCount"]
  );
}

function renderQuality() {
  const dataset = getActiveDataset();
  const wrap = byId("qualityTableWrap");
  if (!dataset) {
    wrap.innerHTML = "";
    return;
  }
  renderTable(
    wrap,
    dataset.analysis.quality,
    ["column", "missingCount", "missingPct", "inconsistentCount"]
  );
}

function renderDataTable() {
  const dataset = getActiveDataset();
  const wrap = byId("dataTableWrap");
  if (!dataset) {
    wrap.innerHTML = "";
    byId("tablePageInfo").textContent = "";
    return;
  }

  const rows = [...dataset.rows];
  const keys = dataset.analysis.columns;

  const filtered = !state.table.filter
    ? rows
    : rows.filter((r) => Object.values(r).join(" ").toLowerCase().includes(state.table.filter));

  if (state.table.sortKey) {
    filtered.sort((a, b) => compareValues(a[state.table.sortKey], b[state.table.sortKey]) * state.table.sortDir);
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / state.table.pageSize));
  if (state.table.page > totalPages) {
    state.table.page = totalPages;
  }
  const start = (state.table.page - 1) * state.table.pageSize;
  const end = start + state.table.pageSize;
  const pageRows = filtered.slice(start, end);

  renderTable(wrap, pageRows, keys, (column) => {
    if (state.table.sortKey === column) {
      state.table.sortDir = state.table.sortDir * -1;
    } else {
      state.table.sortKey = column;
      state.table.sortDir = 1;
    }
    renderDataTable();
  });

  byId("tablePageInfo").textContent = `Page ${state.table.page}/${totalPages} (${filtered.length} matched rows)`;
}

function renderHandovers() {
  const dataset = getActiveDataset();
  if (!dataset) {
    byId("kpiHandovers").textContent = "0";
    byId("kpiHandoverPct").textContent = "0%";
    byId("handoverTableWrap").innerHTML = "";
    destroyChart("handoverTimeline");
    destroyChart("handoverCategoryBar");
    return;
  }

  const a = dataset.analysis;
  byId("kpiHandovers").textContent = String(a.handoverCount);
  byId("kpiHandoverPct").textContent = `${a.handoverRate}%`;

  const timeMap = {};
  a.handoverRows.forEach((r) => {
    const day = safeDay(r.handoverTime);
    timeMap[day] = (timeMap[day] || 0) + 1;
  });
  const timelineEntries = Object.entries(timeMap).sort((x, y) => x[0].localeCompare(y[0]));
  drawChart("handoverTimeline", "line", {
    labels: timelineEntries.map((x) => x[0]),
    datasets: [{ label: "Handovers", data: timelineEntries.map((x) => x[1]), borderColor: "#f4b648", tension: 0.25 }]
  });

  const catEntries = Object.entries(a.handoverByCategory).sort((x, y) => y[1] - x[1]);
  drawChart("handoverCategoryBar", "bar", {
    labels: catEntries.map((x) => mapIssueLabel(x[0], a)),
    datasets: [{ label: "Handovers", data: catEntries.map((x) => x[1]), backgroundColor: "#5c8cff" }]
  });

  renderTable(
    byId("handoverTableWrap"),
    a.handoverRows.map((r) => ({ ...r, category: mapIssueLabel(r.category, a) })),
    ["conversationId", "handoverTime", "category", "reason", "turns"]
  );
}

function renderProblems() {
  const dataset = getActiveDataset();
  if (!dataset) {
    byId("problemExamplesWrap").innerHTML = "";
    destroyChart("problemBar");
    destroyChart("failurePie");
    return;
  }
  const a = dataset.analysis;
  drawChart("problemBar", "bar", {
    labels: a.topProblems.map((p) => mapIssueLabel(p.problem, a)),
    datasets: [{ label: "Frequency", data: a.topProblems.map((p) => p.frequency), backgroundColor: "#3f73f7" }]
  });

  drawChart("failurePie", "pie", {
    labels: ["Repeated Questions", "Negative Sentiment", "Fallback Responses", "Long Unresolved"],
    datasets: [{
      data: [
        a.failureSignals.repeatedQuestions,
        a.failureSignals.negativeSentiment,
        a.failureSignals.fallbackResponses,
        a.failureSignals.longUnresolved
      ],
      backgroundColor: ["#5c8cff", "#ff5f77", "#f4b648", "#8a7aff"]
    }]
  });

  byId("problemExamplesWrap").innerHTML = a.topProblems
    .map((p) => {
      const examples = p.examples.map((ex) => `<li>${escapeHtml(ex)}</li>`).join("");
      return `
        <div class="problem-card">
          <h4>${escapeHtml(mapIssueLabel(p.problem, a))}<span class="pill">${p.frequency}</span></h4>
          <ul>${examples}</ul>
        </div>`;
    })
    .join("");
}

function renderComparison() {
  if (!state.datasets.length) {
    byId("compareTableWrap").innerHTML = "";
    destroyChart("datasetCompareBar");
    destroyChart("datasetTrendLine");
    return;
  }
  const summary = state.datasets.map((d, idx) => ({
    dataset: d.name,
    uploadedAt: safeDay(d.uploadedAt),
    conversations: d.analysis.totalConversations,
    resolutionRate: d.analysis.resolutionRate,
    handoverRate: d.analysis.handoverRate,
    handovers: d.analysis.handoverCount,
    order: idx + 1
  }));

  drawChart("datasetCompareBar", "bar", {
    labels: summary.map((s) => shortName(s.dataset)),
    datasets: [
      { label: "Resolution Rate %", data: summary.map((s) => Number(s.resolutionRate)), backgroundColor: "#33d17a" },
      { label: "Handover Rate %", data: summary.map((s) => Number(s.handoverRate)), backgroundColor: "#ff5f77" }
    ]
  });

  drawChart("datasetTrendLine", "line", {
    labels: summary.map((s) => `Upload ${s.order}`),
    datasets: [{
      label: "Handover Rate Trend %",
      data: summary.map((s) => Number(s.handoverRate)),
      borderColor: "#f4b648",
      tension: 0.3
    }]
  });

  renderTable(byId("compareTableWrap"), summary, [
    "dataset",
    "uploadedAt",
    "conversations",
    "resolutionRate",
    "handoverRate",
    "handovers"
  ]);
}

function drawChart(canvasId, type, data) {
  destroyChart(canvasId);
  const ctx = byId(canvasId);
  if (!ctx) return;
  chartStore[canvasId] = new Chart(ctx, {
    type,
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: "#e8ecff" }
        }
      },
      scales: type === "pie"
        ? {}
        : {
            x: {
              ticks: { color: "#c5d0f3" },
              grid: { color: "rgba(197, 208, 243, 0.12)" }
            },
            y: {
              ticks: { color: "#c5d0f3" },
              grid: { color: "rgba(197, 208, 243, 0.12)" }
            }
          }
    }
  });
}

function destroyChart(id) {
  if (chartStore[id]) {
    chartStore[id].destroy();
    delete chartStore[id];
  }
}

function renderTable(container, rows, columns, onSort) {
  if (!rows || !rows.length) {
    container.innerHTML = "<p class='muted'>No data available.</p>";
    return;
  }
  const header = columns
    .map((col) => `<th data-key="${escapeHtml(col)}">${escapeHtml(col)}</th>`)
    .join("");
  const body = rows
    .map((row) => {
      const tds = columns
        .map((col) => `<td>${escapeHtml(row[col] == null ? "" : String(row[col]))}</td>`)
        .join("");
      return `<tr>${tds}</tr>`;
    })
    .join("");
  container.innerHTML = `<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
  if (typeof onSort === "function") {
    container.querySelectorAll("th").forEach((th) => {
      th.addEventListener("click", () => onSort(th.dataset.key));
    });
  }
}

function loadSession() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    state.datasets = Array.isArray(parsed.datasets) ? parsed.datasets : [];
    state.activeDatasetId = parsed.activeDatasetId || null;
    state.aiEnabled = !!parsed.aiEnabled;
    if (!state.datasets.find((d) => d.id === state.activeDatasetId) && state.datasets.length) {
      state.activeDatasetId = state.datasets[state.datasets.length - 1].id;
    }
  } catch {
    state.datasets = [];
  }
}

function saveSession() {
  const payload = {
    datasets: state.datasets,
    activeDatasetId: state.activeDatasetId,
    aiEnabled: state.aiEnabled
  };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function getActiveDataset() {
  return state.datasets.find((d) => d.id === state.activeDatasetId) || null;
}

function setStatus(message) {
  byId("statusMessage").textContent = message;
}

function byId(id) {
  return document.getElementById(id);
}

function toPct(part, total) {
  if (!total) return 0;
  return Number(((part / total) * 100).toFixed(1));
}

function compareValues(a, b) {
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) {
    return na - nb;
  }
  return String(a ?? "").localeCompare(String(b ?? ""));
}

function isEmpty(v) {
  return v == null || String(v).trim() === "";
}

function isFiniteNumber(v) {
  const n = Number(v);
  return Number.isFinite(n);
}

function isDatetime(v) {
  const d = new Date(v);
  return Number.isFinite(d.getTime());
}

function toDate(v) {
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) return new Date(0);
  return d;
}

function inferConversationTime(records) {
  for (const r of records) {
    for (const value of Object.values(r)) {
      if (isDatetime(value)) {
        return new Date(value).toISOString();
      }
    }
  }
  return new Date().toISOString();
}

function safeDay(value) {
  if (!isDatetime(value)) return "unknown-date";
  return new Date(value).toISOString().slice(0, 10);
}

function trimText(text, max) {
  if (!text || text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

function shortName(name) {
  if (name.length <= 16) return name;
  return `${name.slice(0, 13)}...`;
}

function mapIssueLabel(issue, analysis) {
  const labels = analysis.aiIssueLabels || {};
  return labels[issue] || issue;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
