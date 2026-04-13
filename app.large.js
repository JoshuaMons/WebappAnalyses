const STORAGE_KEY = "supportAnalyticsSessionV2";
const chartStore = {};

const MAX_PREVIEW_ROWS = 30000;
const MAX_STORED_ROWS = 30000;
const MAX_UNIQUE_TRACK = 5000;
const MAX_TRACKED_CONVERSATIONS = 400000;
const MAX_HANDOVER_ROWS = 4000;
const LARGE_ROW_THRESHOLD = 250000;
const XLSX_JSON_SIZE_LIMIT_MB = 75;
const MAX_SESSION_ROWS = 3000;
const MAX_SESSION_DATASETS = 5;
const LEGACY_STORAGE_KEYS = ["supportAnalyticsSessionV1"];

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
  cleanupLegacyStorage();
  loadSession();
  bindEvents();
  renderDatasetSelect();
  renderAll();
}

function bindEvents() {
  document.querySelectorAll(".tab-btn").forEach((btn) => btn.addEventListener("click", () => activateTab(btn.dataset.tab)));
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
  try {
    for (const file of files) {
      setStatus(`Analyzing ${file.name}...`);
      const dataset = await analyzeFileToDataset(file);
      state.datasets.push(dataset);
      state.activeDatasetId = dataset.id;
      saveSession();
      renderDatasetSelect();
      renderAll();
    }
    setStatus(`Analyzed ${files.length} file(s).`);
  } catch (error) {
    setStatus(`Upload failed: ${error.message}`);
  }
}

function clearData() {
  const ok = window.confirm("You are about to clear the dataset(s). Are you sure?");
  if (!ok) return;
  state.datasets = [];
  state.activeDatasetId = null;
  state.table.page = 1;
  sessionStorage.removeItem(STORAGE_KEY);
  renderDatasetSelect();
  renderAll();
  setStatus("All datasets cleared for this browser session.");
}

async function analyzeFileToDataset(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  if (ext === "csv") {
    const parsed = await parseAndAnalyzeCsvStream(file);
    return {
      id,
      name: file.name,
      uploadedAt: new Date().toISOString(),
      rows: parsed.rows,
      analysis: parsed.analysis
    };
  }

  const sizeMb = file.size / (1024 * 1024);
  if ((ext === "xlsx" || ext === "xls" || ext === "json") && sizeMb > XLSX_JSON_SIZE_LIMIT_MB) {
    throw new Error(`Large ${ext.toUpperCase()} file detected (${sizeMb.toFixed(1)} MB). Convert to CSV for 2M+ row streaming mode.`);
  }

  const rows = ext === "json" ? await parseJson(file) : await parseExcel(file);
  const normalized = normalizeRows(rows);
  const analysis = analyzeRows(normalized, { source: ext.toUpperCase() });
  return {
    id,
    name: file.name,
    uploadedAt: new Date().toISOString(),
    rows: normalized.slice(0, Math.min(MAX_STORED_ROWS, normalized.length)),
    analysis
  };
}

function parseAndAnalyzeCsvStream(file) {
  return new Promise((resolve, reject) => {
    const engine = createStreamingAnalyzer(file.name);
    let lastProgressTs = 0;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      worker: true,
      chunkSize: 2 * 1024 * 1024,
      chunk(results) {
        const rows = normalizeRows(results.data);
        engine.ingestRows(rows);
        const now = Date.now();
        if (now - lastProgressTs > 400) {
          const pct = Math.min(100, Math.round((results.meta.cursor / file.size) * 100));
          setStatus(`Analyzing ${file.name}: ${pct}% (${engine.rowCount.toLocaleString()} rows)`);
          lastProgressTs = now;
        }
      },
      complete() {
        const final = engine.finalize();
        resolve(final);
      },
      error(err) {
        reject(err);
      }
    });
  });
}

function createStreamingAnalyzer(sourceName) {
  const ctx = {
    sourceName,
    rowCount: 0,
    columns: new Set(),
    previewRows: [],
    storedRows: [],
    columnStats: {},
    fields: null,
    conversationStats: new Map(),
    conversationOverflow: false,
    convOverflowDropped: 0,
    aggregate: {
      totalConversations: 0,
      resolved: 0,
      unresolved: 0,
      escalated: 0,
      handoverCount: 0,
      handoverRows: [],
      handoverByCategory: {},
      failureSignals: { repeatedQuestions: 0, negativeSentiment: 0, fallbackResponses: 0, longUnresolved: 0 },
      problemCounts: {},
      problemExamples: {},
      timelineMap: {}
    }
  };

  return {
    get rowCount() {
      return ctx.rowCount;
    },
    ingestRows(rows) {
      rows.forEach((row) => ingestRow(ctx, row));
    },
    finalize() {
      finalizeTrackedConversations(ctx);
      return {
        rows: ctx.storedRows,
        analysis: finalizeAnalysis(ctx)
      };
    }
  };
}

function ingestRow(ctx, row) {
  ctx.rowCount += 1;
  if (ctx.previewRows.length < MAX_PREVIEW_ROWS) ctx.previewRows.push(row);
  if (ctx.storedRows.length < MAX_STORED_ROWS) ctx.storedRows.push(row);

  Object.keys(row).forEach((col) => {
    ctx.columns.add(col);
    if (!ctx.columnStats[col]) {
      ctx.columnStats[col] = {
        total: 0,
        nonNull: 0,
        missing: 0,
        numeric: 0,
        datetime: 0,
        uniqueSet: new Set(),
        uniqueOverflow: false
      };
    }
    const stat = ctx.columnStats[col];
    stat.total += 1;
    const value = row[col];
    const missing = isEmpty(value) || /^(null|na|n\/a|undefined)$/i.test(String(value));
    if (missing) {
      stat.missing += 1;
      return;
    }
    stat.nonNull += 1;
    if (isFiniteNumber(value)) stat.numeric += 1;
    if (isDatetime(value)) stat.datetime += 1;
    if (!stat.uniqueOverflow) {
      stat.uniqueSet.add(String(value).trim().toLowerCase());
      if (stat.uniqueSet.size > MAX_UNIQUE_TRACK) stat.uniqueOverflow = true;
    }
  });

  if (!ctx.fields && ctx.columns.size) {
    ctx.fields = detectConversationFields(Array.from(ctx.columns));
  }

  const text = Object.values(row).join(" ").toLowerCase();
  const category = deriveIssueCategory(row, ctx.fields, text);
  if (!ctx.fields || !ctx.fields.conversationId) {
    const temp = buildRowAsConversation(row, text, category, ctx.fields);
    applyConversationSummary(ctx.aggregate, temp);
    return;
  }

  const convKey = String(row[ctx.fields.conversationId] ?? `row-${ctx.rowCount}`);
  let conv = ctx.conversationStats.get(convKey);
  if (!conv) {
    if (!ctx.conversationOverflow && ctx.conversationStats.size >= MAX_TRACKED_CONVERSATIONS) {
      ctx.conversationOverflow = true;
    }
    if (ctx.conversationOverflow) {
      ctx.convOverflowDropped += 1;
      const temp = buildRowAsConversation(row, text, category, ctx.fields);
      applyConversationSummary(ctx.aggregate, temp);
      return;
    }
    conv = {
      id: convKey,
      turns: 0,
      resolved: false,
      escalated: false,
      handoverKeyword: false,
      negative: false,
      fallback: false,
      repeated: false,
      category,
      firstTime: inferRowTime(row, ctx.fields),
      lastUserMessage: "",
      sampleText: trimText(text, 210)
    };
    ctx.conversationStats.set(convKey, conv);
  }

  conv.turns += 1;
  conv.resolved = conv.resolved || /\bresolved|closed|solved|completed\b/.test(text);
  conv.escalated = conv.escalated || /\bescalat|handover|transfer|human|agent\b/.test(text);
  conv.handoverKeyword = conv.handoverKeyword || HANDOVER_REGEX.test(text);
  conv.negative = conv.negative || NEGATIVE_REGEX.test(text);
  conv.fallback = conv.fallback || FALLBACK_REGEX.test(text);
  if (ctx.fields.userMessage) {
    const msg = normalizeSentence(row[ctx.fields.userMessage]);
    if (msg) {
      if (conv.lastUserMessage && conv.lastUserMessage === msg) {
        conv.repeated = true;
      }
      conv.lastUserMessage = msg;
    }
  }
}

function buildRowAsConversation(row, text, category, fields) {
  return {
    id: String(row[fields?.conversationId] ?? `row-${Math.random().toString(36).slice(2, 8)}`),
    turns: 1,
    resolved: /\bresolved|closed|solved|completed\b/.test(text),
    escalated: /\bescalat|handover|transfer|human|agent\b/.test(text),
    handoverKeyword: HANDOVER_REGEX.test(text),
    negative: NEGATIVE_REGEX.test(text),
    fallback: FALLBACK_REGEX.test(text),
    repeated: false,
    category,
    firstTime: inferRowTime(row, fields),
    sampleText: trimText(text, 210)
  };
}

function finalizeTrackedConversations(ctx) {
  for (const conv of ctx.conversationStats.values()) {
    applyConversationSummary(ctx.aggregate, conv);
  }
}

function applyConversationSummary(aggregate, conv) {
  aggregate.totalConversations += 1;
  if (conv.resolved) aggregate.resolved += 1;
  else aggregate.unresolved += 1;
  if (conv.escalated) aggregate.escalated += 1;

  const longUnresolved = !conv.resolved && conv.turns > 8;
  if (conv.repeated) aggregate.failureSignals.repeatedQuestions += 1;
  if (conv.negative) aggregate.failureSignals.negativeSentiment += 1;
  if (conv.fallback) aggregate.failureSignals.fallbackResponses += 1;
  if (longUnresolved) aggregate.failureSignals.longUnresolved += 1;

  const handoverFound = conv.handoverKeyword || conv.escalated || (conv.fallback && conv.repeated);
  aggregate.problemCounts[conv.category] = (aggregate.problemCounts[conv.category] || 0) + 1;
  if (!aggregate.problemExamples[conv.category]) aggregate.problemExamples[conv.category] = [];
  if (aggregate.problemExamples[conv.category].length < 3) {
    aggregate.problemExamples[conv.category].push(conv.sampleText);
  }

  const day = safeDay(conv.firstTime);
  aggregate.timelineMap[day] = (aggregate.timelineMap[day] || 0) + 1;

  if (handoverFound) {
    aggregate.handoverCount += 1;
    aggregate.handoverByCategory[conv.category] = (aggregate.handoverByCategory[conv.category] || 0) + 1;
    if (aggregate.handoverRows.length < MAX_HANDOVER_ROWS) {
      aggregate.handoverRows.push({
        conversationId: conv.id,
        handoverTime: conv.firstTime,
        category: conv.category,
        reason: detectHandoverReason(conv.handoverKeyword, conv.escalated, conv.fallback, conv.repeated),
        turns: conv.turns
      });
    }
  }
}

function finalizeAnalysis(ctx) {
  const columns = Array.from(ctx.columns);
  const columnTypes = columns.map((column) => {
    const s = ctx.columnStats[column];
    let type = "text";
    if (s.nonNull && s.numeric / s.nonNull > 0.8) type = "numeric";
    else if (s.nonNull && s.datetime / s.nonNull > 0.8) type = "datetime";
    else if (!s.uniqueOverflow && s.nonNull && (s.uniqueSet.size / s.nonNull) < 0.2) type = "categorical";
    return {
      column,
      type,
      nonNullCount: s.nonNull,
      uniqueCount: s.uniqueOverflow ? `${MAX_UNIQUE_TRACK}+` : s.uniqueSet.size
    };
  });

  const typeMap = Object.fromEntries(columnTypes.map((ct) => [ct.column, ct.type]));
  const quality = columns.map((column) => {
    const s = ctx.columnStats[column];
    let inconsistent = 0;
    if (typeMap[column] === "numeric") inconsistent = s.nonNull - s.numeric;
    if (typeMap[column] === "datetime") inconsistent = s.nonNull - s.datetime;
    return {
      column,
      missingCount: s.missing,
      missingPct: toPct(s.missing, Math.max(1, s.total)),
      inconsistentCount: inconsistent
    };
  });

  const topProblems = Object.entries(ctx.aggregate.problemCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([problem, frequency]) => ({
      problem,
      frequency,
      examples: ctx.aggregate.problemExamples[problem] || []
    }));

  const timeline = Object.entries(ctx.aggregate.timelineMap).sort((a, b) => a[0].localeCompare(b[0]));
  return {
    rowCount: ctx.rowCount,
    columns,
    columnTypes,
    quality,
    fields: ctx.fields || detectConversationFields(columns),
    totalConversations: ctx.aggregate.totalConversations,
    statusCount: {
      resolved: ctx.aggregate.resolved,
      unresolved: ctx.aggregate.unresolved,
      escalated: ctx.aggregate.escalated
    },
    handoverCount: ctx.aggregate.handoverCount,
    handoverRate: toPct(ctx.aggregate.handoverCount, ctx.aggregate.totalConversations),
    resolutionRate: toPct(ctx.aggregate.resolved, ctx.aggregate.totalConversations),
    handoverRows: ctx.aggregate.handoverRows,
    handoverByCategory: ctx.aggregate.handoverByCategory,
    failureSignals: ctx.aggregate.failureSignals,
    topProblems,
    timeline,
    isLargeMode: ctx.rowCount > LARGE_ROW_THRESHOLD,
    previewOnly: ctx.rowCount > ctx.storedRows.length,
    notes: buildAnalysisNotes(ctx)
  };
}

function buildAnalysisNotes(ctx) {
  const notes = [];
  if (ctx.rowCount > LARGE_ROW_THRESHOLD) {
    notes.push(`Large dataset mode enabled (${ctx.rowCount.toLocaleString()} rows).`);
  }
  if (ctx.rowCount > ctx.storedRows.length) {
    notes.push(`Data Explorer shows first ${ctx.storedRows.length.toLocaleString()} rows only.`);
  }
  if (ctx.conversationOverflow) {
    notes.push(`Conversation tracking capped at ${MAX_TRACKED_CONVERSATIONS.toLocaleString()}; overflow rows approximated (${ctx.convOverflowDropped.toLocaleString()}).`);
  }
  return notes;
}

function analyzeRows(rows, info = {}) {
  const engine = createStreamingAnalyzer(info.source || "memory");
  engine.ingestRows(rows);
  const out = engine.finalize();
  return { ...out.analysis };
}

async function parseExcel(file) {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data);
  const firstSheet = workbook.SheetNames[0];
  return XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: null });
}

async function parseJson(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.data)) return parsed.data;
  if (Array.isArray(parsed.rows)) return parsed.rows;
  if (typeof parsed === "object" && parsed !== null) return [parsed];
  return [];
}

function normalizeRows(rows) {
  if (!Array.isArray(rows)) return [];
  const objectRows = rows.map((row) => (row && typeof row === "object" && !Array.isArray(row) ? row : { value: row }));
  const keys = Array.from(new Set(objectRows.flatMap((r) => Object.keys(r))));
  return objectRows.map((row) => {
    const out = {};
    keys.forEach((k) => { out[k] = row[k] ?? null; });
    return out;
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

function deriveIssueCategory(row, fields, text) {
  if (fields?.category && row[fields.category]) return String(row[fields.category]).toLowerCase();
  return categorizeIssue(text);
}

function inferRowTime(row, fields) {
  if (fields?.timestamp && isDatetime(row[fields.timestamp])) return new Date(row[fields.timestamp]).toISOString();
  for (const value of Object.values(row)) {
    if (isDatetime(value)) return new Date(value).toISOString();
  }
  return new Date().toISOString();
}

function detectHandoverReason(handoverKeyword, escalated, fallback, repeated) {
  if (escalated) return "Escalation flag/status";
  if (handoverKeyword) return "Handover keyword";
  if (fallback && repeated) return "Conversation interruption/failure loop";
  return "Detected support transfer signal";
}

function normalizeSentence(value) {
  if (isEmpty(value)) return "";
  return String(value).toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
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
  if (!dataset) return setStatus("Upload and select a dataset first.");
  if (!byId("aiEnabled").checked) return setStatus("Enable AI analysis first.");
  const apiKey = byId("openAiKey").value.trim();
  if (!apiKey) return setStatus("Enter an OpenAI API key to run AI enrichment.");
  setStatus("Running GPT-5.2 enrichment...");
  try {
    const payload = dataset.analysis.topProblems.map((p) => ({ issue: p.problem, frequency: p.frequency, examples: p.examples }));
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-5.2",
        input: [
          { role: "system", content: "You are a support analytics assistant. Output valid JSON only." },
          { role: "user", content: `Return strict JSON with keys: insights (array), issue_labels (object). Input: ${JSON.stringify(payload)}` }
        ]
      })
    });
    if (!response.ok) throw new Error(`OpenAI API error ${response.status}`);
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
    opt.textContent = `${d.name} (${d.analysis.rowCount.toLocaleString()} rows)`;
    sel.appendChild(opt);
  });
  if (!state.activeDatasetId) state.activeDatasetId = state.datasets[state.datasets.length - 1].id;
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
  drawChart("resolutionPie", "pie", {
    labels: ["Resolved", "Unresolved"],
    datasets: [{ data: [a.statusCount.resolved, a.totalConversations - a.statusCount.resolved], backgroundColor: ["#33d17a", "#ff5f77"] }]
  });
  drawChart("volumeLine", "line", {
    labels: a.timeline.map((t) => t[0]),
    datasets: [{ label: "Conversations", data: a.timeline.map((t) => t[1]), borderColor: "#5c8cff", fill: false, tension: 0.25 }]
  });
  const insights = generateInsights(dataset);
  byId("insightsList").innerHTML = insights.map((i) => `<li>${escapeHtml(i)}</li>`).join("");
}

function generateInsights(dataset) {
  const a = dataset.analysis;
  const top = a.topProblems[0];
  const highestCategory = Object.entries(a.handoverByCategory).sort((x, y) => y[1] - x[1])[0];
  const base = [
    `Handover rate is ${a.handoverRate}% across ${a.totalConversations.toLocaleString()} conversations.`,
    top ? `Most common problem category is "${mapIssueLabel(top.problem, a)}" with ${top.frequency.toLocaleString()} conversations.` : "No problem category signals detected yet.",
    highestCategory ? `Most handovers happen in "${mapIssueLabel(highestCategory[0], a)}".` : "No handovers detected from current signals.",
    `Failure loops: repeated questions (${a.failureSignals.repeatedQuestions}), fallback responses (${a.failureSignals.fallbackResponses}), long unresolved chats (${a.failureSignals.longUnresolved}).`,
    ...(a.notes || [])
  ];
  if (Array.isArray(a.aiInsights) && a.aiInsights.length) return a.aiInsights.slice(0, 5);
  return base.slice(0, 5);
}

function renderColumnTypes() {
  const dataset = getActiveDataset();
  byId("columnTypeTableWrap").innerHTML = "";
  if (!dataset) return;
  renderTable(byId("columnTypeTableWrap"), dataset.analysis.columnTypes, ["column", "type", "nonNullCount", "uniqueCount"]);
}

function renderQuality() {
  const dataset = getActiveDataset();
  byId("qualityTableWrap").innerHTML = "";
  if (!dataset) return;
  renderTable(byId("qualityTableWrap"), dataset.analysis.quality, ["column", "missingCount", "missingPct", "inconsistentCount"]);
}

function renderDataTable() {
  const dataset = getActiveDataset();
  const wrap = byId("dataTableWrap");
  if (!dataset) {
    wrap.innerHTML = "";
    byId("tablePageInfo").textContent = "";
    return;
  }
  const rows = [...(dataset.rows || [])];
  const keys = dataset.analysis.columns || [];
  const filtered = !state.table.filter ? rows : rows.filter((r) => Object.values(r).join(" ").toLowerCase().includes(state.table.filter));
  if (state.table.sortKey) filtered.sort((a, b) => compareValues(a[state.table.sortKey], b[state.table.sortKey]) * state.table.sortDir);
  const totalPages = Math.max(1, Math.ceil(filtered.length / state.table.pageSize));
  if (state.table.page > totalPages) state.table.page = totalPages;
  const start = (state.table.page - 1) * state.table.pageSize;
  const pageRows = filtered.slice(start, start + state.table.pageSize);
  renderTable(wrap, pageRows, keys, (column) => {
    if (state.table.sortKey === column) state.table.sortDir *= -1;
    else {
      state.table.sortKey = column;
      state.table.sortDir = 1;
    }
    renderDataTable();
  });
  const suffix = dataset.analysis.previewOnly ? ` (preview ${rows.length.toLocaleString()}/${dataset.analysis.rowCount.toLocaleString()} rows)` : "";
  byId("tablePageInfo").textContent = `Page ${state.table.page}/${totalPages} (${filtered.length.toLocaleString()} matched rows)${suffix}`;
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
  const handoverTimeline = {};
  a.handoverRows.forEach((r) => {
    const day = safeDay(r.handoverTime);
    handoverTimeline[day] = (handoverTimeline[day] || 0) + 1;
  });
  const entries = Object.entries(handoverTimeline).sort((a1, b1) => a1[0].localeCompare(b1[0]));
  drawChart("handoverTimeline", "line", {
    labels: entries.map((e) => e[0]),
    datasets: [{ label: "Handovers", data: entries.map((e) => e[1]), borderColor: "#f4b648", tension: 0.25 }]
  });
  const cat = Object.entries(a.handoverByCategory).sort((x, y) => y[1] - x[1]);
  drawChart("handoverCategoryBar", "bar", {
    labels: cat.map((c) => mapIssueLabel(c[0], a)),
    datasets: [{ label: "Handovers", data: cat.map((c) => c[1]), backgroundColor: "#5c8cff" }]
  });
  renderTable(byId("handoverTableWrap"), a.handoverRows.map((r) => ({ ...r, category: mapIssueLabel(r.category, a) })), ["conversationId", "handoverTime", "category", "reason", "turns"]);
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
    datasets: [{ data: [a.failureSignals.repeatedQuestions, a.failureSignals.negativeSentiment, a.failureSignals.fallbackResponses, a.failureSignals.longUnresolved], backgroundColor: ["#5c8cff", "#ff5f77", "#f4b648", "#8a7aff"] }]
  });
  byId("problemExamplesWrap").innerHTML = a.topProblems.map((p) => `<div class="problem-card"><h4>${escapeHtml(mapIssueLabel(p.problem, a))}<span class="pill">${p.frequency}</span></h4><ul>${p.examples.map((ex) => `<li>${escapeHtml(ex)}</li>`).join("")}</ul></div>`).join("");
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
    rows: d.analysis.rowCount,
    conversations: d.analysis.totalConversations,
    resolutionRate: d.analysis.resolutionRate,
    handoverRate: d.analysis.handoverRate,
    handovers: d.analysis.handoverCount,
    mode: d.analysis.isLargeMode ? "large" : "standard",
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
    datasets: [{ label: "Handover Rate Trend %", data: summary.map((s) => Number(s.handoverRate)), borderColor: "#f4b648", tension: 0.3 }]
  });
  renderTable(byId("compareTableWrap"), summary, ["dataset", "uploadedAt", "rows", "conversations", "resolutionRate", "handoverRate", "handovers", "mode"]);
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
      plugins: { legend: { labels: { color: "#e8ecff" } } },
      scales: type === "pie" ? {} : {
        x: { ticks: { color: "#c5d0f3" }, grid: { color: "rgba(197, 208, 243, 0.12)" } },
        y: { ticks: { color: "#c5d0f3" }, grid: { color: "rgba(197, 208, 243, 0.12)" } }
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
  const header = columns.map((col) => `<th data-key="${escapeHtml(col)}">${escapeHtml(col)}</th>`).join("");
  const body = rows.map((row) => `<tr>${columns.map((col) => `<td>${escapeHtml(row[col] == null ? "" : String(row[col]))}</td>`).join("")}</tr>`).join("");
  container.innerHTML = `<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
  if (typeof onSort === "function") {
    container.querySelectorAll("th").forEach((th) => th.addEventListener("click", () => onSort(th.dataset.key)));
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
  const recentDatasets = state.datasets.slice(-MAX_SESSION_DATASETS);
  const payloads = [
    {
      datasets: recentDatasets.map((d) => compactDatasetForSession(d, 300, true)),
      activeDatasetId: state.activeDatasetId,
      aiEnabled: state.aiEnabled
    },
    {
      datasets: recentDatasets.map((d) => compactDatasetForSession(d, 50, true)),
      activeDatasetId: state.activeDatasetId,
      aiEnabled: state.aiEnabled
    },
    {
      datasets: recentDatasets.map((d) => compactDatasetForSession(d, 0, false)),
      activeDatasetId: state.activeDatasetId,
      aiEnabled: state.aiEnabled
    },
    {
      datasets: [],
      activeDatasetId: null,
      aiEnabled: state.aiEnabled
    }
  ];

  for (const payload of payloads) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      return;
    } catch {
      // Try a smaller payload tier.
    }
  }

  // Hard fail-safe: never break analysis flow due to browser quota.
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore if storage is unavailable.
  }
}

function compactDatasetForSession(dataset, rowLimit, includeRows) {
  const rows = includeRows && Array.isArray(dataset.rows) ? dataset.rows.slice(0, rowLimit) : [];
  const analysis = dataset.analysis || {};
  const notes = Array.isArray(analysis.notes) ? analysis.notes.slice(0, 4) : [];
  if (rowLimit === 0 || !includeRows) {
    notes.push("Session quota reached; preview rows not persisted.");
  } else if (Array.isArray(dataset.rows) && dataset.rows.length > rowLimit) {
    notes.push(`Session restore keeps first ${rowLimit.toLocaleString()} preview rows.`);
  }

  return {
    id: dataset.id,
    name: dataset.name,
    uploadedAt: dataset.uploadedAt,
    rows,
    analysis: {
      rowCount: analysis.rowCount || 0,
      columns: Array.isArray(analysis.columns) ? analysis.columns : [],
      columnTypes: Array.isArray(analysis.columnTypes) ? analysis.columnTypes : [],
      quality: Array.isArray(analysis.quality) ? analysis.quality : [],
      fields: analysis.fields || {},
      totalConversations: analysis.totalConversations || 0,
      statusCount: analysis.statusCount || { resolved: 0, unresolved: 0, escalated: 0 },
      handoverCount: analysis.handoverCount || 0,
      handoverRate: analysis.handoverRate || 0,
      resolutionRate: analysis.resolutionRate || 0,
      handoverRows: Array.isArray(analysis.handoverRows) ? analysis.handoverRows.slice(0, 120) : [],
      handoverByCategory: analysis.handoverByCategory || {},
      failureSignals: analysis.failureSignals || { repeatedQuestions: 0, negativeSentiment: 0, fallbackResponses: 0, longUnresolved: 0 },
      topProblems: Array.isArray(analysis.topProblems)
        ? analysis.topProblems.slice(0, 5).map((p) => ({
            problem: p.problem,
            frequency: p.frequency,
            examples: Array.isArray(p.examples) ? p.examples.slice(0, 1) : []
          }))
        : [],
      timeline: Array.isArray(analysis.timeline) ? analysis.timeline.slice(-180) : [],
      isLargeMode: !!analysis.isLargeMode,
      previewOnly: !!analysis.previewOnly,
      notes
    }
  };
}

function cleanupLegacyStorage() {
  LEGACY_STORAGE_KEYS.forEach((key) => {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // Ignore storage availability issues.
    }
  });
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

function extractResponseText(data) {
  if (typeof data.output_text === "string") return data.output_text;
  if (Array.isArray(data.output)) return data.output.flatMap((item) => item.content || []).map((c) => c.text || "").join("\n");
  return "";
}

function parseJsonFromText(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return {};
  try { return JSON.parse(trimmed); } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return {};
    return JSON.parse(match[0]);
  }
}

function toPct(part, total) {
  if (!total) return 0;
  return Number(((part / total) * 100).toFixed(1));
}

function compareValues(a, b) {
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
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
