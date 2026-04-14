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
const LANGUAGE_KEY = "supportAnalyticsLanguageV1";
const API_KEY_SESSION_KEY = "supportAnalyticsOpenAiKeySessionV1";
const RULES_STORAGE_KEY = "supportAnalyticsRulesV1";

const DEFAULT_RULES = {
  handoverKeywords: ["agent", "human", "handover", "transfer", "specialist"],
  escalationKeywords: ["escalat", "handover", "transfer", "human", "agent"],
  fallbackKeywords: ["i do not understand", "i don't understand", "cannot help", "rephrase", "didn't catch", "fallback", "not sure"],
  negativeKeywords: ["angry", "frustrat", "upset", "bad", "terrible", "hate", "not working", "still broken", "complain", "annoyed"],
  longUnresolvedTurns: 8
};

const I18N = {
  en: {
    appTitle: "Support Analytics Dashboard",
    appSubtitle: "Conversation performance, handovers, failures, and issue insights",
    languageLabel: "Language",
    clearDataBtn: "Clear Data",
    uploadLabel: "Upload datasets (CSV, XLSX, JSON)",
    analyzeUploadBtn: "Analyze Upload",
    aiToggle: "Enable AI-powered analysis (OpenAI GPT-5.2)",
    openAiKeyPlaceholder: "OpenAI API Key (optional if AI is off)",
    runAiBtn: "Run AI Enrichment",
    clearApiKeyBtn: "Clear API Key",
    activeDatasetLabel: "Active dataset",
    persistLabel: "Stored in session memory until browser closes",
    tabOverview: "Overview",
    tabExplorer: "Data Explorer",
    tabHandovers: "Handovers",
    tabProblems: "Problem Analysis",
    tabAiAnalysis: "AI Analysis",
    tabRules: "Detection Rules",
    tabComparison: "Dataset Comparison",
    kpiTotalConversations: "Total Conversations",
    kpiResolutionRate: "Resolution Rate",
    kpiHandoverRate: "Handover Rate",
    chartResolutionDistribution: "Resolution Distribution",
    chartVolumeOverTime: "Conversation Volume Over Time",
    keyInsights: "Key Insights",
    detectedColumnTypes: "Detected Column Types",
    dataQualityFindings: "Data Quality Findings",
    fullDataset: "Full Dataset",
    filterRowsPlaceholder: "Filter rows...",
    rowsPerPage: "Rows per page",
    prevBtn: "Prev",
    nextBtn: "Next",
    kpiTotalHandovers: "Total Handovers",
    kpiConversationHandoverPct: "% Conversations with Handover",
    chartHandoversOverTime: "Handovers Over Time",
    chartHandoversByCategory: "Handovers by Issue Category",
    handoverCases: "Handover Cases",
    topProblemCategories: "Top 5 Problem Categories",
    failureSignalDistribution: "Failure Signal Distribution",
    topProblemsExamples: "Top Problems & Example Conversations",
    datasetPerformanceComparison: "Dataset Performance Comparison",
    datasetTrendUploadOrder: "Week-over-Week Style Trend by Upload Order",
    datasetSummaryTable: "Dataset Summary Table",
    statusSelectDataset: "Select at least one dataset file.",
    statusAnalyzingFile: "Analyzing {name}...",
    statusAnalyzedFiles: "Analyzed {count} file(s).",
    statusUploadFailed: "Upload failed: {error}",
    clearConfirm: "You are about to clear the dataset(s). Are you sure?",
    clearDone: "All datasets cleared for this browser session.",
    noDatasetLoaded: "No dataset loaded",
    aiNeedDataset: "Upload and select a dataset first.",
    aiEnableFirst: "Enable AI analysis first.",
    aiNeedKey: "Enter an OpenAI API key to run AI enrichment.",
    aiKeyCleared: "API key removed for this session.",
    aiRunning: "Running GPT-5.2 enrichment...",
    aiDone: "AI enrichment complete.",
    aiFailed: "AI enrichment failed: {error}",
    aiNetworkHelp: "Network error. If deployed on Vercel, set OPENAI_API_KEY and use the same-origin /api/ai-enrich endpoint.",
    aiAnalysisSummaryTitle: "AI Analysis Summary",
    aiInsightsTitle: "AI Insights",
    aiIssueLabelsTitle: "AI Issue Labels",
    aiNotRunYet: "AI analysis has not been run yet for this dataset.",
    aiLastRun: "Last AI run: {time}",
    aiNoIssueLabels: "No AI issue labels available yet.",
    statusProgress: "Analyzing {name}: {pct}% ({rows} rows)",
    largeConvertCsv: "Large {ext} file detected ({mb} MB). Convert to CSV for 2M+ row streaming mode.",
    noDataAvailable: "No data available.",
    noDataInsights: "Upload a dataset to generate insights.",
    resolved: "Resolved",
    unresolved: "Unresolved",
    conversations: "Conversations",
    handovers: "Handovers",
    frequency: "Frequency",
    exampleConversation: "Example conversations",
    conversationIdLabel: "Conversation ID",
    turnsLabel: "Turns",
    userMessageLabel: "User",
    botResponseLabel: "Bot",
    statusLabel: "Status",
    timeLabel: "Time",
    summaryLabel: "Summary",
    noExampleText: "No detailed example available."
    ,
    rulesTitle: "Detection Rules",
    rulesSubtitle: "Tune keywords and thresholds used for handover and failure detection.",
    rulesActiveLogicTitle: "Current Detection Logic",
    rulesKeywordsTitle: "Recognized Keywords",
    rulesEditTitle: "Edit Rules",
    rulesHandoverKeywordsLabel: "Handover keywords (comma-separated)",
    rulesEscalationKeywordsLabel: "Escalation keywords (comma-separated)",
    rulesFallbackKeywordsLabel: "Fallback keywords (comma-separated)",
    rulesNegativeKeywordsLabel: "Negative sentiment keywords (comma-separated)",
    rulesLongUnresolvedTurnsLabel: "Long unresolved threshold (turns)",
    saveRulesBtn: "Save Rules",
    resetRulesBtn: "Reset Defaults",
    rulesSaved: "Detection rules saved.",
    rulesReset: "Detection rules reset to defaults.",
    rulesApplyHint: "Rules are applied to newly uploaded datasets."
  },
  nl: {
    appTitle: "Support Analyse Dashboard",
    appSubtitle: "Gespreksperformance, overdrachten, fouten en issue-inzichten",
    languageLabel: "Taal",
    clearDataBtn: "Data wissen",
    uploadLabel: "Upload datasets (CSV, XLSX, JSON)",
    analyzeUploadBtn: "Upload analyseren",
    aiToggle: "AI-analyse inschakelen (OpenAI GPT-5.2)",
    openAiKeyPlaceholder: "OpenAI API sleutel (optioneel als AI uit staat)",
    runAiBtn: "AI verrijking starten",
    clearApiKeyBtn: "API sleutel wissen",
    activeDatasetLabel: "Actieve dataset",
    persistLabel: "Opgeslagen in sessiegeheugen totdat de browser sluit",
    tabOverview: "Overzicht",
    tabExplorer: "Data Verkenner",
    tabHandovers: "Overdrachten",
    tabProblems: "Probleemanalyse",
    tabAiAnalysis: "AI Analyse",
    tabRules: "Detectieregels",
    tabComparison: "Dataset Vergelijking",
    kpiTotalConversations: "Totaal gesprekken",
    kpiResolutionRate: "Oplossingsratio",
    kpiHandoverRate: "Overdrachtsratio",
    chartResolutionDistribution: "Verdeling opgelost/niet opgelost",
    chartVolumeOverTime: "Gespreksvolume over tijd",
    keyInsights: "Belangrijkste inzichten",
    detectedColumnTypes: "Gedetecteerde kolomtypes",
    dataQualityFindings: "Datakwaliteit bevindingen",
    fullDataset: "Volledige dataset",
    filterRowsPlaceholder: "Rijen filteren...",
    rowsPerPage: "Rijen per pagina",
    prevBtn: "Vorige",
    nextBtn: "Volgende",
    kpiTotalHandovers: "Totaal overdrachten",
    kpiConversationHandoverPct: "% Gesprekken met overdracht",
    chartHandoversOverTime: "Overdrachten over tijd",
    chartHandoversByCategory: "Overdrachten per categorie",
    handoverCases: "Overdrachtsgevallen",
    topProblemCategories: "Top 5 probleemcategorieën",
    failureSignalDistribution: "Verdeling foutsignalen",
    topProblemsExamples: "Top problemen & voorbeeldgesprekken",
    datasetPerformanceComparison: "Dataset performance vergelijking",
    datasetTrendUploadOrder: "Trend per uploadvolgorde",
    datasetSummaryTable: "Dataset samenvattingstabel",
    statusSelectDataset: "Selecteer minimaal één datasetbestand.",
    statusAnalyzingFile: "Bezig met analyseren van {name}...",
    statusAnalyzedFiles: "{count} bestand(en) geanalyseerd.",
    statusUploadFailed: "Upload mislukt: {error}",
    clearConfirm: "Je staat op het punt de dataset(s) te wissen. Weet je het zeker?",
    clearDone: "Alle datasets zijn voor deze sessie gewist.",
    noDatasetLoaded: "Geen dataset geladen",
    aiNeedDataset: "Upload en selecteer eerst een dataset.",
    aiEnableFirst: "Schakel eerst AI-analyse in.",
    aiNeedKey: "Voer een OpenAI API sleutel in om AI verrijking te draaien.",
    aiKeyCleared: "API sleutel verwijderd voor deze sessie.",
    aiRunning: "GPT-5.2 verrijking wordt uitgevoerd...",
    aiDone: "AI verrijking voltooid.",
    aiFailed: "AI verrijking mislukt: {error}",
    aiNetworkHelp: "Netwerkfout. Bij Vercel: zet OPENAI_API_KEY en gebruik dezelfde-origin /api/ai-enrich endpoint.",
    aiAnalysisSummaryTitle: "AI Analyse Samenvatting",
    aiInsightsTitle: "AI Inzichten",
    aiIssueLabelsTitle: "AI Issue Labels",
    aiNotRunYet: "AI analyse is nog niet uitgevoerd voor deze dataset.",
    aiLastRun: "Laatste AI-run: {time}",
    aiNoIssueLabels: "Nog geen AI issue labels beschikbaar.",
    statusProgress: "Analyseren {name}: {pct}% ({rows} rijen)",
    largeConvertCsv: "Groot {ext}-bestand gedetecteerd ({mb} MB). Converteer naar CSV voor 2M+ rij streaming modus.",
    noDataAvailable: "Geen data beschikbaar.",
    noDataInsights: "Upload een dataset om inzichten te genereren.",
    resolved: "Opgelost",
    unresolved: "Niet opgelost",
    conversations: "Gesprekken",
    handovers: "Overdrachten",
    frequency: "Frequentie",
    exampleConversation: "Voorbeeldgesprekken",
    conversationIdLabel: "Gesprek ID",
    turnsLabel: "Beurten",
    userMessageLabel: "Gebruiker",
    botResponseLabel: "Bot",
    statusLabel: "Status",
    timeLabel: "Tijd",
    summaryLabel: "Samenvatting",
    noExampleText: "Geen gedetailleerd voorbeeld beschikbaar."
    ,
    rulesTitle: "Detectieregels",
    rulesSubtitle: "Pas keywords en drempels aan voor handover- en foutdetectie.",
    rulesActiveLogicTitle: "Huidige detectielogica",
    rulesKeywordsTitle: "Herkende keywords",
    rulesEditTitle: "Regels bewerken",
    rulesHandoverKeywordsLabel: "Handover keywords (komma-gescheiden)",
    rulesEscalationKeywordsLabel: "Escalatie keywords (komma-gescheiden)",
    rulesFallbackKeywordsLabel: "Fallback keywords (komma-gescheiden)",
    rulesNegativeKeywordsLabel: "Negatieve sentiment keywords (komma-gescheiden)",
    rulesLongUnresolvedTurnsLabel: "Drempel lang onopgelost (beurten)",
    saveRulesBtn: "Regels opslaan",
    resetRulesBtn: "Standaard herstellen",
    rulesSaved: "Detectieregels opgeslagen.",
    rulesReset: "Detectieregels hersteld naar standaard.",
    rulesApplyHint: "Regels worden toegepast op nieuw geuploade datasets."
  }
};

const state = {
  datasets: [],
  activeDatasetId: null,
  aiEnabled: false,
  language: "en",
  rules: cloneDefaultRules(),
  regexes: buildRuleRegexes(cloneDefaultRules()),
  table: {
    sortKey: null,
    sortDir: 1,
    filter: "",
    page: 1,
    pageSize: 25
  }
};

document.addEventListener("DOMContentLoaded", init);

function init() {
  cleanupLegacyStorage();
  loadSession();
  state.language = loadLanguage();
  loadRules();
  bindEvents();
  applyTranslations();
  hydrateApiKeyInput();
  populateRulesEditor();
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
  byId("clearApiKeyBtn").addEventListener("click", () => {
    clearApiKeyForSession();
    const keyInput = byId("openAiKey");
    if (keyInput) keyInput.value = "";
    setStatus(t("aiKeyCleared"));
  });
  byId("openAiKey").addEventListener("change", (e) => {
    persistApiKeyForSession(e.target.value);
  });
  byId("openAiKey").addEventListener("blur", (e) => {
    persistApiKeyForSession(e.target.value);
  });
  byId("languageSelect").addEventListener("change", (e) => {
    state.language = e.target.value === "nl" ? "nl" : "en";
    persistLanguage(state.language);
    applyTranslations();
    renderDatasetSelect();
    renderAll();
  });
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
  byId("saveRulesBtn").addEventListener("click", saveRulesFromEditor);
  byId("resetRulesBtn").addEventListener("click", resetRulesToDefault);
}

function activateTab(tabId) {
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tabId));
  document.querySelectorAll(".tab-content").forEach((t) => t.classList.toggle("active", t.id === tabId));
}

async function handleUpload() {
  const files = byId("datasetInput").files;
  if (!files || !files.length) {
    setStatus(t("statusSelectDataset"));
    return;
  }
  try {
    for (const file of files) {
      setStatus(t("statusAnalyzingFile", { name: file.name }));
      const dataset = await analyzeFileToDataset(file);
      state.datasets.push(dataset);
      state.activeDatasetId = dataset.id;
      saveSession();
      renderDatasetSelect();
      renderAll();
    }
    setStatus(t("statusAnalyzedFiles", { count: files.length }));
  } catch (error) {
    setStatus(t("statusUploadFailed", { error: error.message }));
  }
}

function clearData() {
  const ok = window.confirm(t("clearConfirm"));
  if (!ok) return;
  state.datasets = [];
  state.activeDatasetId = null;
  state.table.page = 1;
  sessionStorage.removeItem(STORAGE_KEY);
  renderDatasetSelect();
  renderAll();
  setStatus(t("clearDone"));
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
    throw new Error(t("largeConvertCsv", { ext: ext.toUpperCase(), mb: sizeMb.toFixed(1) }));
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
          setStatus(t("statusProgress", { name: file.name, pct, rows: engine.rowCount.toLocaleString() }));
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
      preview: extractConversationPreview(row, ctx.fields, text)
    };
    ctx.conversationStats.set(convKey, conv);
  }

  conv.turns += 1;
  conv.resolved = conv.resolved || /\bresolved|closed|solved|completed\b/.test(text);
  conv.escalated = conv.escalated || state.regexes.escalationRegex.test(text);
  conv.handoverKeyword = conv.handoverKeyword || state.regexes.handoverRegex.test(text);
  conv.negative = conv.negative || state.regexes.negativeRegex.test(text);
  conv.fallback = conv.fallback || state.regexes.fallbackRegex.test(text);
  if (ctx.fields.userMessage) {
    const msg = normalizeSentence(row[ctx.fields.userMessage]);
    if (msg) {
      if (conv.lastUserMessage && conv.lastUserMessage === msg) {
        conv.repeated = true;
      }
      conv.lastUserMessage = msg;
    }
  }
  enrichConversationPreview(conv.preview, row, ctx.fields, text);
}

function buildRowAsConversation(row, text, category, fields) {
  return {
    id: String(row[fields?.conversationId] ?? `row-${Math.random().toString(36).slice(2, 8)}`),
    turns: 1,
    resolved: /\bresolved|closed|solved|completed\b/.test(text),
    escalated: state.regexes.escalationRegex.test(text),
    handoverKeyword: state.regexes.handoverRegex.test(text),
    negative: state.regexes.negativeRegex.test(text),
    fallback: state.regexes.fallbackRegex.test(text),
    repeated: false,
    category,
    firstTime: inferRowTime(row, fields),
    preview: extractConversationPreview(row, fields, text)
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

  const longUnresolved = !conv.resolved && conv.turns > Number(state.rules.longUnresolvedTurns || DEFAULT_RULES.longUnresolvedTurns);
  if (conv.repeated) aggregate.failureSignals.repeatedQuestions += 1;
  if (conv.negative) aggregate.failureSignals.negativeSentiment += 1;
  if (conv.fallback) aggregate.failureSignals.fallbackResponses += 1;
  if (longUnresolved) aggregate.failureSignals.longUnresolved += 1;

  const handoverFound = conv.handoverKeyword || conv.escalated || (conv.fallback && conv.repeated);
  aggregate.problemCounts[conv.category] = (aggregate.problemCounts[conv.category] || 0) + 1;
  if (!aggregate.problemExamples[conv.category]) aggregate.problemExamples[conv.category] = [];
  if (aggregate.problemExamples[conv.category].length < 3) {
    aggregate.problemExamples[conv.category].push({
      conversationId: conv.id,
      turns: conv.turns,
      user: conv.preview?.user || "",
      bot: conv.preview?.bot || "",
      status: conv.preview?.status || (conv.resolved ? "resolved" : "unresolved"),
      time: conv.preview?.timestamp || conv.firstTime,
      summary: conv.preview?.summary || ""
    });
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
  const sheetRows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { header: 1, defval: null });
  return rowsWithHeaderFirstLine(sheetRows);
}

async function parseJson(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  if (Array.isArray(parsed) && parsed.length && Array.isArray(parsed[0])) {
    return rowsWithHeaderFirstLine(parsed);
  }
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.data) && parsed.data.length && Array.isArray(parsed.data[0])) {
    return rowsWithHeaderFirstLine(parsed.data);
  }
  if (Array.isArray(parsed.data)) return parsed.data;
  if (Array.isArray(parsed.rows) && parsed.rows.length && Array.isArray(parsed.rows[0])) {
    return rowsWithHeaderFirstLine(parsed.rows);
  }
  if (Array.isArray(parsed.rows)) return parsed.rows;
  if (typeof parsed === "object" && parsed !== null) return [parsed];
  return [];
}

function normalizeRows(rows) {
  if (!Array.isArray(rows)) return [];
  const objectRows = rows.map((row) => {
    if (row && typeof row === "object" && !Array.isArray(row)) {
      return normalizeObjectRowHeaders(row);
    }
    return { value: row };
  });
  const keys = Array.from(new Set(objectRows.flatMap((r) => Object.keys(r))));
  return objectRows.map((row) => {
    const out = {};
    keys.forEach((k) => { out[k] = row[k] ?? null; });
    return out;
  });
}

function normalizeObjectRowHeaders(rowObj) {
  const rawKeys = Object.keys(rowObj);
  const normalizedKeys = dedupeHeaders(rawKeys.map((key, idx) => normalizeHeaderName(key, idx)));
  const out = {};
  rawKeys.forEach((rawKey, idx) => {
    out[normalizedKeys[idx]] = rowObj[rawKey];
  });
  return out;
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

function extractConversationPreview(row, fields, text) {
  const user = fields?.userMessage ? trimText(String(row[fields.userMessage] ?? "").trim(), 220) : "";
  const bot = fields?.botResponse ? trimText(String(row[fields.botResponse] ?? "").trim(), 220) : "";
  const status = fields?.status ? trimText(String(row[fields.status] ?? "").trim(), 80) : "";
  const timestamp = fields?.timestamp && row[fields.timestamp] ? String(row[fields.timestamp]) : inferRowTime(row, fields);
  return {
    user,
    bot,
    status,
    timestamp,
    summary: trimText(text, 280)
  };
}

function enrichConversationPreview(preview, row, fields, text) {
  if (!preview) return;
  if (!preview.user && fields?.userMessage && !isEmpty(row[fields.userMessage])) {
    preview.user = trimText(String(row[fields.userMessage]).trim(), 220);
  }
  if (!preview.bot && fields?.botResponse && !isEmpty(row[fields.botResponse])) {
    preview.bot = trimText(String(row[fields.botResponse]).trim(), 220);
  }
  if (!preview.status && fields?.status && !isEmpty(row[fields.status])) {
    preview.status = trimText(String(row[fields.status]).trim(), 80);
  }
  if ((!preview.timestamp || preview.timestamp === "unknown-date") && fields?.timestamp && !isEmpty(row[fields.timestamp])) {
    preview.timestamp = String(row[fields.timestamp]);
  }
  if (!preview.summary) {
    preview.summary = trimText(text, 280);
  }
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
  if (!dataset) return setStatus(t("aiNeedDataset"));
  if (!byId("aiEnabled").checked) return setStatus(t("aiEnableFirst"));
  const apiKey = getEffectiveApiKey();
  if (!apiKey) return setStatus(t("aiNeedKey"));
  persistApiKeyForSession(apiKey);
  setStatus(t("aiRunning"));
  try {
    const payload = dataset.analysis.topProblems.map((p) => ({ issue: p.problem, frequency: p.frequency, examples: p.examples }));
    const data = await requestAiEnrichment(payload, apiKey);
    const text = extractResponseText(data);
    const parsed = parseJsonFromText(text);
    dataset.analysis.aiInsights = Array.isArray(parsed.insights) ? parsed.insights.slice(0, 5) : [];
    dataset.analysis.aiIssueLabels = parsed.issue_labels || {};
    dataset.analysis.aiLastRun = new Date().toISOString();
    dataset.analysis.aiLastError = "";
    saveSession();
    renderAll();
    setStatus(t("aiDone"));
  } catch (error) {
    const friendly = isLikelyNetworkError(error)
      ? `${error.message}. ${t("aiNetworkHelp")}`
      : error.message;
    dataset.analysis.aiLastError = friendly;
    renderAiAnalysis();
    setStatus(t("aiFailed", { error: friendly }));
  }
}

async function requestAiEnrichment(payload, apiKey) {
  const proxyResponse = await fetch("/api/ai-enrich", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload, model: "gpt-5.2", apiKey })
  }).catch(() => null);

  if (proxyResponse && proxyResponse.ok) {
    return proxyResponse.json();
  }

  if (proxyResponse && proxyResponse.status !== 404) {
    const proxyText = await proxyResponse.text().catch(() => "");
    throw new Error(`AI proxy error ${proxyResponse.status}${proxyText ? `: ${proxyText.slice(0, 160)}` : ""}`);
  }

  const directResponse = await fetch("https://api.openai.com/v1/responses", {
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
  if (!directResponse.ok) throw new Error(`OpenAI API error ${directResponse.status}`);
  return directResponse.json();
}

function isLikelyNetworkError(error) {
  if (!error) return false;
  const text = `${error.name || ""} ${error.message || ""}`.toLowerCase();
  return text.includes("networkerror") || text.includes("failed to fetch") || text.includes("network request");
}

function renderDatasetSelect() {
  const sel = byId("activeDatasetSelect");
  sel.innerHTML = "";
  if (!state.datasets.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = t("noDatasetLoaded");
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
  renderAiAnalysis();
  renderRulesTab();
  renderComparison();
}

function renderOverview() {
  const dataset = getActiveDataset();
  if (!dataset) {
    byId("kpiConversations").textContent = "0";
    byId("kpiResolutionRate").textContent = "0%";
    byId("kpiHandoverRate").textContent = "0%";
    byId("insightsList").innerHTML = `<li>${escapeHtml(t("noDataInsights"))}</li>`;
    destroyChart("resolutionPie");
    destroyChart("volumeLine");
    return;
  }
  const a = dataset.analysis;
  byId("kpiConversations").textContent = String(a.totalConversations);
  byId("kpiResolutionRate").textContent = `${a.resolutionRate}%`;
  byId("kpiHandoverRate").textContent = `${a.handoverRate}%`;
  drawChart("resolutionPie", "pie", {
    labels: [t("resolved"), t("unresolved")],
    datasets: [{ data: [a.statusCount.resolved, a.totalConversations - a.statusCount.resolved], backgroundColor: ["#33d17a", "#ff5f77"] }]
  });
  drawChart("volumeLine", "line", {
    labels: a.timeline.map((t) => t[0]),
    datasets: [{ label: t("conversations"), data: a.timeline.map((t) => t[1]), borderColor: "#5c8cff", fill: false, tension: 0.25 }]
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
    datasets: [{ label: t("handovers"), data: entries.map((e) => e[1]), borderColor: "#f4b648", tension: 0.25 }]
  });
  const cat = Object.entries(a.handoverByCategory).sort((x, y) => y[1] - x[1]);
  drawChart("handoverCategoryBar", "bar", {
    labels: cat.map((c) => mapIssueLabel(c[0], a)),
    datasets: [{ label: t("handovers"), data: cat.map((c) => c[1]), backgroundColor: "#5c8cff" }]
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
    datasets: [{ label: t("frequency"), data: a.topProblems.map((p) => p.frequency), backgroundColor: "#3f73f7" }]
  });
  drawChart("failurePie", "pie", {
    labels: ["Repeated Questions", "Negative Sentiment", "Fallback Responses", "Long Unresolved"],
    datasets: [{ data: [a.failureSignals.repeatedQuestions, a.failureSignals.negativeSentiment, a.failureSignals.fallbackResponses, a.failureSignals.longUnresolved], backgroundColor: ["#5c8cff", "#ff5f77", "#f4b648", "#8a7aff"] }]
  });
  byId("problemExamplesWrap").innerHTML = a.topProblems.map((p) => {
    const examples = (p.examples || []).map((ex) => {
      if (typeof ex === "string") {
        return `<div class="problem-example-card"><div class="problem-summary">${escapeHtml(ex)}</div></div>`;
      }
      return `
        <div class="problem-example-card">
          <div class="problem-meta-row">
            <span class="problem-meta-chip">${escapeHtml(t("conversationIdLabel"))}: ${escapeHtml(ex.conversationId || "-")}</span>
            <span class="problem-meta-chip">${escapeHtml(t("turnsLabel"))}: ${escapeHtml(String(ex.turns ?? "-"))}</span>
            <span class="problem-meta-chip">${escapeHtml(t("timeLabel"))}: ${escapeHtml(ex.time ? safeDay(ex.time) : "-")}</span>
          </div>
          <div class="problem-line"><strong>${escapeHtml(t("statusLabel"))}:</strong> ${escapeHtml(ex.status || "-")}</div>
          <div class="problem-line"><strong>${escapeHtml(t("userMessageLabel"))}:</strong> ${escapeHtml(ex.user || "-")}</div>
          <div class="problem-line"><strong>${escapeHtml(t("botResponseLabel"))}:</strong> ${escapeHtml(ex.bot || "-")}</div>
          <div class="problem-summary"><strong>${escapeHtml(t("summaryLabel"))}:</strong> ${escapeHtml(ex.summary || t("noExampleText"))}</div>
        </div>`;
    }).join("");

    return `
      <div class="problem-card">
        <h4>${escapeHtml(mapIssueLabel(p.problem, a))}<span class="pill">${p.frequency}</span></h4>
        <div class="problem-subtitle">${escapeHtml(t("exampleConversation"))}</div>
        <div class="problem-example-grid">${examples || `<div class="problem-example-card">${escapeHtml(t("noExampleText"))}</div>`}</div>
      </div>
    `;
  }).join("");
}

function renderAiAnalysis() {
  const dataset = getActiveDataset();
  const statusEl = byId("aiAnalysisStatus");
  const insightsEl = byId("aiInsightsList");
  const labelsWrap = byId("aiIssueLabelsWrap");
  if (!statusEl || !insightsEl || !labelsWrap) return;

  if (!dataset) {
    statusEl.textContent = t("noDataInsights");
    insightsEl.innerHTML = `<li>${escapeHtml(t("noDataAvailable"))}</li>`;
    labelsWrap.innerHTML = `<p class='muted'>${escapeHtml(t("noDataAvailable"))}</p>`;
    return;
  }

  const analysis = dataset.analysis || {};
  const lastRun = analysis.aiLastRun ? safeDay(analysis.aiLastRun) : "";
  const lastError = analysis.aiLastError || "";
  if (lastError) {
    statusEl.textContent = lastError;
  } else if (lastRun) {
    statusEl.textContent = t("aiLastRun", { time: lastRun });
  } else {
    statusEl.textContent = t("aiNotRunYet");
  }

  const insights = Array.isArray(analysis.aiInsights) ? analysis.aiInsights : [];
  insightsEl.innerHTML = insights.length
    ? insights.map((insight) => `<li>${escapeHtml(insight)}</li>`).join("")
    : `<li>${escapeHtml(t("aiNotRunYet"))}</li>`;

  const labels = analysis.aiIssueLabels || {};
  const labelRows = Object.entries(labels).map(([issue, label]) => ({ issue, label }));
  if (!labelRows.length) {
    labelsWrap.innerHTML = `<p class='muted'>${escapeHtml(t("aiNoIssueLabels"))}</p>`;
    return;
  }
  renderTable(labelsWrap, labelRows, ["issue", "label"]);
}

function renderRulesTab() {
  const logicList = byId("rulesLogicList");
  const keywordsWrap = byId("rulesCurrentKeywordsWrap");
  if (!logicList || !keywordsWrap) return;

  const longTurns = Number(state.rules.longUnresolvedTurns || DEFAULT_RULES.longUnresolvedTurns);
  logicList.innerHTML = [
    `Handover = keyword OR escalation signal OR fallback + repeated user question.`,
    `Repeated question = same consecutive normalized user message within a conversation.`,
    `Long unresolved = unresolved conversation with more than ${longTurns} turns.`,
    t("rulesApplyHint")
  ].map((line) => `<li>${escapeHtml(line)}</li>`).join("");

  const rows = [
    { rule: "handoverKeywords", keywords: state.rules.handoverKeywords.join(", ") },
    { rule: "escalationKeywords", keywords: state.rules.escalationKeywords.join(", ") },
    { rule: "fallbackKeywords", keywords: state.rules.fallbackKeywords.join(", ") },
    { rule: "negativeKeywords", keywords: state.rules.negativeKeywords.join(", ") }
  ];
  renderTable(keywordsWrap, rows, ["rule", "keywords"]);
}

function populateRulesEditor() {
  safeSetValue("rulesHandoverKeywordsInput", state.rules.handoverKeywords.join(", "));
  safeSetValue("rulesEscalationKeywordsInput", state.rules.escalationKeywords.join(", "));
  safeSetValue("rulesFallbackKeywordsInput", state.rules.fallbackKeywords.join(", "));
  safeSetValue("rulesNegativeKeywordsInput", state.rules.negativeKeywords.join(", "));
  safeSetValue("rulesLongUnresolvedTurnsInput", String(state.rules.longUnresolvedTurns));
}

function saveRulesFromEditor() {
  state.rules = {
    handoverKeywords: parseKeywordList(byId("rulesHandoverKeywordsInput")?.value),
    escalationKeywords: parseKeywordList(byId("rulesEscalationKeywordsInput")?.value),
    fallbackKeywords: parseKeywordList(byId("rulesFallbackKeywordsInput")?.value),
    negativeKeywords: parseKeywordList(byId("rulesNegativeKeywordsInput")?.value),
    longUnresolvedTurns: Math.max(1, Number(byId("rulesLongUnresolvedTurnsInput")?.value || DEFAULT_RULES.longUnresolvedTurns))
  };
  state.regexes = buildRuleRegexes(state.rules);
  persistRules();
  renderRulesTab();
  setStatus(t("rulesSaved"));
}

function resetRulesToDefault() {
  state.rules = cloneDefaultRules();
  state.regexes = buildRuleRegexes(state.rules);
  persistRules();
  populateRulesEditor();
  renderRulesTab();
  setStatus(t("rulesReset"));
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
    container.innerHTML = `<p class='muted'>${escapeHtml(t("noDataAvailable"))}</p>`;
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

function cloneDefaultRules() {
  return {
    handoverKeywords: [...DEFAULT_RULES.handoverKeywords],
    escalationKeywords: [...DEFAULT_RULES.escalationKeywords],
    fallbackKeywords: [...DEFAULT_RULES.fallbackKeywords],
    negativeKeywords: [...DEFAULT_RULES.negativeKeywords],
    longUnresolvedTurns: DEFAULT_RULES.longUnresolvedTurns
  };
}

function parseKeywordList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function buildRuleRegexes(rules) {
  return {
    handoverRegex: buildKeywordRegex(rules.handoverKeywords),
    escalationRegex: buildKeywordRegex(rules.escalationKeywords),
    fallbackRegex: buildKeywordRegex(rules.fallbackKeywords),
    negativeRegex: buildKeywordRegex(rules.negativeKeywords)
  };
}

function buildKeywordRegex(keywords) {
  if (!Array.isArray(keywords) || !keywords.length) {
    return /^$/;
  }
  const parts = keywords
    .map((kw) => escapeRegex(kw))
    .filter(Boolean)
    .map((kw) => kw.includes("\\ ") ? kw.replaceAll("\\ ", "\\s+") : kw);
  if (!parts.length) return /^$/;
  return new RegExp(`\\b(${parts.join("|")})\\b`, "i");
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function loadRules() {
  try {
    const raw = localStorage.getItem(RULES_STORAGE_KEY);
    if (!raw) {
      state.rules = cloneDefaultRules();
      state.regexes = buildRuleRegexes(state.rules);
      return;
    }
    const parsed = JSON.parse(raw);
    state.rules = {
      handoverKeywords: Array.isArray(parsed.handoverKeywords) && parsed.handoverKeywords.length
        ? parsed.handoverKeywords
        : [...DEFAULT_RULES.handoverKeywords],
      escalationKeywords: Array.isArray(parsed.escalationKeywords) && parsed.escalationKeywords.length
        ? parsed.escalationKeywords
        : [...DEFAULT_RULES.escalationKeywords],
      fallbackKeywords: Array.isArray(parsed.fallbackKeywords) && parsed.fallbackKeywords.length
        ? parsed.fallbackKeywords
        : [...DEFAULT_RULES.fallbackKeywords],
      negativeKeywords: Array.isArray(parsed.negativeKeywords) && parsed.negativeKeywords.length
        ? parsed.negativeKeywords
        : [...DEFAULT_RULES.negativeKeywords],
      longUnresolvedTurns: Math.max(1, Number(parsed.longUnresolvedTurns || DEFAULT_RULES.longUnresolvedTurns))
    };
    state.regexes = buildRuleRegexes(state.rules);
  } catch {
    state.rules = cloneDefaultRules();
    state.regexes = buildRuleRegexes(state.rules);
  }
}

function persistRules() {
  try {
    localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(state.rules));
  } catch {
    // Ignore storage issues.
  }
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

function safeSetValue(id, value) {
  const el = byId(id);
  if (el) el.value = value;
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

function rowsWithHeaderFirstLine(rows2d) {
  if (!Array.isArray(rows2d) || rows2d.length === 0) return [];
  const rawHeaders = Array.isArray(rows2d[0]) ? rows2d[0] : [];
  const headers = rawHeaders.map((h, i) => normalizeHeaderName(h, i));
  const safeHeaders = dedupeHeaders(headers);
  const records = [];
  for (let r = 1; r < rows2d.length; r += 1) {
    const row = Array.isArray(rows2d[r]) ? rows2d[r] : [];
    const out = {};
    safeHeaders.forEach((header, c) => {
      out[header] = row[c] ?? null;
    });
    records.push(out);
  }
  return records;
}

function normalizeHeaderName(value, index = 0) {
  const text = String(value ?? "").trim();
  return text || `column_${index + 1}`;
}

function dedupeHeaders(headers) {
  const seen = new Map();
  return headers.map((h) => {
    const count = seen.get(h) || 0;
    seen.set(h, count + 1);
    if (count === 0) return h;
    return `${h}_${count + 1}`;
  });
}

function t(key, vars = {}) {
  const lang = state.language === "nl" ? "nl" : "en";
  const template = I18N[lang][key] || I18N.en[key] || key;
  return Object.entries(vars).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)), template);
}

function applyTranslations() {
  const lang = state.language === "nl" ? "nl" : "en";
  document.documentElement.lang = lang;
  const langSelect = byId("languageSelect");
  if (langSelect) langSelect.value = lang;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
  });
}

function loadLanguage() {
  try {
    const v = localStorage.getItem(LANGUAGE_KEY);
    return v === "nl" ? "nl" : "en";
  } catch {
    return "en";
  }
}

function persistLanguage(lang) {
  try {
    localStorage.setItem(LANGUAGE_KEY, lang);
  } catch {
    // ignore storage issues
  }
}

function hydrateApiKeyInput() {
  const keyInput = byId("openAiKey");
  if (!keyInput) return;
  const saved = loadApiKeyFromSession();
  if (saved) keyInput.value = saved;
}

function getEffectiveApiKey() {
  const keyInput = byId("openAiKey");
  const fromInput = keyInput ? keyInput.value.trim() : "";
  if (fromInput) return fromInput;
  return loadApiKeyFromSession();
}

function loadApiKeyFromSession() {
  try {
    return sessionStorage.getItem(API_KEY_SESSION_KEY) || "";
  } catch {
    return "";
  }
}

function persistApiKeyForSession(value) {
  const clean = String(value || "").trim();
  try {
    if (!clean) {
      sessionStorage.removeItem(API_KEY_SESSION_KEY);
      return;
    }
    sessionStorage.setItem(API_KEY_SESSION_KEY, clean);
  } catch {
    // Ignore storage issues.
  }
}

function clearApiKeyForSession() {
  try {
    sessionStorage.removeItem(API_KEY_SESSION_KEY);
  } catch {
    // Ignore storage issues.
  }
}
