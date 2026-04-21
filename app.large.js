const STORAGE_KEY = "supportAnalyticsSessionV2";
const PERSISTENT_STORAGE_KEY = "supportAnalyticsPersistentV1";
const UPLOADED_DB_CACHE = {
  dbName: "supportAnalyticsUploadedDbV1",
  storeName: "files",
  key: "latest-uploaded-db"
};
const chartStore = {};
const SQL_JS_WASM_BASE = "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/";
const DEFAULT_DB_SOURCES = [
  "/api/live-db",
  "/data/essent.db",
  "/data/fontys_cgny.db",
  "/fontys_cgny.db"
];
const SQLITE_TABLE_TO_TARGET = {
  analytics: "essent cgny.csv",
  sessions: "essent data.csv",
  genesys: "essent genesys.csv",
  // Essent SQL-dump -> SQLite import outputs these table names.
  clean_data_cgny: "essent cgny.csv",
  clean_data_sessions: "essent data.csv"
};
let sqlJsPromise = null;

const MAX_PREVIEW_ROWS = 30000;
const MAX_STORED_ROWS = 30000;
const MAX_UNIQUE_TRACK = 5000;
const MAX_TRACKED_CONVERSATIONS = 400000;
const MAX_HANDOVER_ROWS = 4000;
const LARGE_ROW_THRESHOLD = 250000;
const MAX_SESSION_ROWS = 3000;
const MAX_SESSION_DATASETS = 5;
const LEGACY_STORAGE_KEYS = ["supportAnalyticsSessionV1"];
const LANGUAGE_KEY = "supportAnalyticsLanguageV1";
const API_KEY_SESSION_KEY = "supportAnalyticsOpenAiKeySessionV1";
const RULES_STORAGE_KEY = "supportAnalyticsRulesV1";
const LAST_ACTIVE_TARGET_KEY = "supportAnalyticsLastActiveTargetV1";
const TARGET_DATASET_FILES = [
  { key: "essent cgny.csv", label: "Essent CGNY" },
  { key: "essent data.csv", label: "Essent Data" },
  { key: "essent genesys.csv", label: "Essent Genesys" }
];

// Centralized field priority for schema drift between exports.
const DB_FIELD_PRIORITY = {
  conversationId: ["CGNY_SESSION_ID", "CONVERSATION_ID", "CGNY_CONVERSATION_ID"],
  userMessage: ["CUSTOMER_INPUT_TEXT_anonymized", "INPUTTEXT_anonymized", "UNRECOGNIZED_QUESTION_anonymized"],
  timestamp: ["TIMESTAMP", "STARTEDAT"],
  status: ["GOALS", "COMPLETEDGOALSLIST"],
  escalationFlag: ["HANDOVER_QUESTION_anonymized", "GOALS", "COMPLETEDGOALSLIST"],
  category: ["MAIN_INTENT", "INTENT", "ENDPOINTNAME", "MEDIA_TYPE"],
  goalsField: ["GOALS", "COMPLETEDGOALSLIST"]
};

// Rules used by the dedicated MAIN_INTENT handover tab.
const INTENT_HANDOVER_CONFIG = {
  mainIntentColumn: "MAIN_INTENT",
  contactIdColumn: "CONTACTID",
  sessionIdColumns: ["CGNY_SESSION_ID", "CGNY_CONVERSATION_ID"],
  timestampColumn: "TIMESTAMP"
};

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
    quickSwapBtn: "Quick Swap Dataset",
    quickSwapChooseLabel: "Choose dataset...",
    targetFilesTitle: "Target files",
    targetFilesHint: "Only these 3 files are analyzed in Essent mode.",
    uploadLabel: "Upload database (.db)",
    analyzeUploadBtn: "Analyze Upload",
    aiToggle: "Enable AI-powered analysis (OpenAI GPT-5.2)",
    aiControlTitle: "AI Controls",
    openAiKeyPlaceholder: "OpenAI API Key (optional if AI is off)",
    runAiBtn: "Run AI Enrichment",
    clearApiKeyBtn: "Clear API Key",
    activeDatasetLabel: "Active dataset",
    persistLabel: "Stored in session memory until browser closes",
    tabOverview: "Overview",
    tabDbUpload: "Database Upload",
    tabExplorer: "Data Explorer",
    tabHandovers: "Handovers",
    tabIntentHandovers: "Intent Handovers",
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
    tableColumnName: "Column",
    tableDataType: "Type",
    tableNonNullCount: "Non-null",
    tableUniqueCount: "Unique",
    tableMissingCount: "Missing",
    tableMissingPct: "Missing %",
    tableInconsistentCount: "Inconsistent",
    tableSourceTable: "Source table",
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
    intentHandoversTitle: "MAIN_INTENT Handover Overview",
    intentHandoverSearchPlaceholder: "Search by ContactID or ConversationID...",
    intentHandoverSummary: "{shown} shown of {total} handover rows",
    intentHandoverStepsLabel: "Steps to handover",
    intentHandoverPageInfo: "Page {page} of {total}",
    intentHandoverGoToPageLabel: "Go to page",
    intentHandoverGoToPageBtn: "Go",
    copyCellHint: "Click to copy value",
    copiedValue: "Value copied to clipboard.",
    copyFailed: "Copy failed. Clipboard access is unavailable.",
    intentHandoverInputListsTitle: "Collected input values",
    intentHandoverInputTextListTitle: "All INPUTTEXT_anonymized values",
    intentHandoverCustomerInputListTitle: "All CUSTOMER_INPUT_TEXT_anonymized values",
    intentHandoverNoInputValues: "No values found.",
    intentHandoverModalTitle: "Handover Contact Detail",
    intentHandoverCardContact: "ContactID",
    intentHandoverCardConversations: "Conversation IDs",
    intentHandoverCardRows: "Rows",
    intentHandoverCardTimespan: "Timespan",
    handoverSearchPlaceholder: "Search handovers...",
    handoverReasonFilterLabel: "Reason",
    handoverReasonAll: "All reasons",
    handoverDbColumnLabel: "Column",
    handoverDbOpLabel: "Op",
    handoverDbOpContains: "contains",
    handoverDbOpEq: "=",
    handoverDbOpGt: ">",
    handoverDbOpLt: "<",
    handoverDbValuePlaceholder: "Value...",
    handoverFilterInfo: "{shown} shown of {total} handovers",
    topProblemCategories: "Top 5 Problem Categories",
    failureSignalDistribution: "Failure Signal Distribution",
    topProblemsExamples: "Top Problems & Example Conversations",
    datasetPerformanceComparison: "Dataset Performance Comparison",
    datasetTrendUploadOrder: "Week-over-Week Style Trend by Upload Order",
    datasetSummaryTable: "Dataset Summary Table",
    compareSelectionTitle: "Comparison Selection",
    compareModeLabel: "Mode",
    compareModeAll3: "All 3 datasets",
    compareModePair: "Choose 2 datasets",
    compareLeftLabel: "Dataset A",
    compareRightLabel: "Dataset B",
    dbUploadTitle: "Upload Database (.db)",
    dbUploadHint: "Upload a SQLite database file and load it into the dashboard.",
    dbUploadInputLabel: "Database file",
    dbUploadAnalyzeBtn: "Upload & Analyze",
    landingTitle: "Upload a database to begin",
    landingSubtitle: "The dashboard will generate charts and tables after a SQLite .db is loaded.",
    landingUploadBtn: "Upload & Open Dashboard",
    landingHint: "Tip: for very large files, hosting the .db and using /api/live-db can be faster than browser upload.",
    dbUploadCurrent: "Currently loaded source: {name} ({rows} rows)",
    dbUploadNoDataset: "No uploaded database loaded yet.",
    statusSelectDataset: "Select at least one dataset file.",
    statusQuickSwapNoDataset: "Upload at least one Essent dataset first.",
    statusQuickSwapDone: "Switched to: {name}.",
    statusNeedDbFile: "Select a .db database file.",
    statusNoValidFiles: "No valid database selected.",
    statusAnalyzingFile: "Analyzing {name}...",
    statusLoadedFromDb: "Loaded {count} dataset(s) from database.",
    statusNoDbLoaded: "No database loaded yet. Upload a .db in the Database Upload tab.",
    statusLoadingDefaultDb: "Loading default database...",
    statusDefaultDbMissing: "No default database source found.",
    statusDefaultDbError: "Default database could not be loaded: {error}",
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
    noExampleText: "No detailed example available.",
    categoryLabel: "Category"
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
    rulesApplyHint: "Rules are applied to newly uploaded datasets.",
    problemSearchPlaceholder: "Search problems or examples...",
    problemSortLabel: "Sort",
    problemSortFrequencyDesc: "Frequency high to low",
    problemSortFrequencyAsc: "Frequency low to high",
    problemSortNameAsc: "Name A-Z",
    problemSortNameDesc: "Name Z-A",
    closeBtn: "Close",
    problemDetailTitle: "Conversation Detail"
  },
  nl: {
    appTitle: "Support Analyse Dashboard",
    appSubtitle: "Gespreksperformance, overdrachten, fouten en issue-inzichten",
    languageLabel: "Taal",
    quickSwapBtn: "Snel wisselen dataset",
    quickSwapChooseLabel: "Kies dataset...",
    targetFilesTitle: "Doelbestanden",
    targetFilesHint: "Alleen deze 3 bestanden worden geanalyseerd in Essent-modus.",
    uploadLabel: "Upload database (.db)",
    analyzeUploadBtn: "Upload analyseren",
    aiToggle: "AI-analyse inschakelen (OpenAI GPT-5.2)",
    aiControlTitle: "AI Bediening",
    openAiKeyPlaceholder: "OpenAI API sleutel (optioneel als AI uit staat)",
    runAiBtn: "AI verrijking starten",
    clearApiKeyBtn: "API sleutel wissen",
    activeDatasetLabel: "Actieve dataset",
    persistLabel: "Opgeslagen in sessiegeheugen totdat de browser sluit",
    tabOverview: "Overzicht",
    tabDbUpload: "Database Upload",
    tabExplorer: "Data Verkenner",
    tabHandovers: "Overdrachten",
    tabIntentHandovers: "Intent Overdrachten",
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
    tableColumnName: "Kolom",
    tableDataType: "Type",
    tableNonNullCount: "Niet-leeg",
    tableUniqueCount: "Uniek",
    tableMissingCount: "Ontbrekend",
    tableMissingPct: "Ontbrekend %",
    tableInconsistentCount: "Inconsistent",
    tableSourceTable: "Brontabel",
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
    intentHandoversTitle: "MAIN_INTENT Handover Overzicht",
    intentHandoverSearchPlaceholder: "Zoek op ContactID of ConversationID...",
    intentHandoverSummary: "{shown} zichtbaar van {total} handover-rijen",
    intentHandoverStepsLabel: "Stappen tot handover",
    intentHandoverPageInfo: "Pagina {page} van {total}",
    intentHandoverGoToPageLabel: "Ga naar pagina",
    intentHandoverGoToPageBtn: "Ga",
    copyCellHint: "Klik om waarde te kopieren",
    copiedValue: "Waarde gekopieerd naar klembord.",
    copyFailed: "Kopieren mislukt. Klembordtoegang is niet beschikbaar.",
    intentHandoverInputListsTitle: "Verzamelde invoerwaardes",
    intentHandoverInputTextListTitle: "Alle INPUTTEXT_anonymized waardes",
    intentHandoverCustomerInputListTitle: "Alle CUSTOMER_INPUT_TEXT_anonymized waardes",
    intentHandoverNoInputValues: "Geen waardes gevonden.",
    intentHandoverModalTitle: "Handover Contactdetail",
    intentHandoverCardContact: "ContactID",
    intentHandoverCardConversations: "Conversation IDs",
    intentHandoverCardRows: "Rijen",
    intentHandoverCardTimespan: "Tijdspanne",
    handoverSearchPlaceholder: "Zoek in overdrachten...",
    handoverReasonFilterLabel: "Reden",
    handoverReasonAll: "Alle redenen",
    handoverDbColumnLabel: "Kolom",
    handoverDbOpLabel: "Operator",
    handoverDbOpContains: "bevat",
    handoverDbOpEq: "=",
    handoverDbOpGt: ">",
    handoverDbOpLt: "<",
    handoverDbValuePlaceholder: "Waarde...",
    handoverFilterInfo: "{shown} zichtbaar van {total} overdrachten",
    topProblemCategories: "Top 5 probleemcategorieën",
    failureSignalDistribution: "Verdeling foutsignalen",
    topProblemsExamples: "Top problemen & voorbeeldgesprekken",
    datasetPerformanceComparison: "Dataset performance vergelijking",
    datasetTrendUploadOrder: "Trend per uploadvolgorde",
    datasetSummaryTable: "Dataset samenvattingstabel",
    compareSelectionTitle: "Vergelijkingsselectie",
    compareModeLabel: "Modus",
    compareModeAll3: "Alle 3 datasets",
    compareModePair: "Kies 2 datasets",
    compareLeftLabel: "Dataset A",
    compareRightLabel: "Dataset B",
    dbUploadTitle: "Database uploaden (.db)",
    dbUploadHint: "Upload een SQLite databasebestand en laad het direct in het dashboard.",
    dbUploadInputLabel: "Databasebestand",
    dbUploadAnalyzeBtn: "Uploaden & analyseren",
    landingTitle: "Upload een database om te starten",
    landingSubtitle: "Het dashboard genereert grafieken en tabellen nadat een SQLite .db is geladen.",
    landingUploadBtn: "Uploaden & dashboard openen",
    landingHint: "Tip: voor hele grote bestanden kan het hosten van de .db (via /api/live-db) sneller zijn dan uploaden in de browser.",
    dbUploadCurrent: "Huidige geladen bron: {name} ({rows} rijen)",
    dbUploadNoDataset: "Nog geen geuploade database geladen.",
    statusSelectDataset: "Selecteer minimaal één datasetbestand.",
    statusQuickSwapNoDataset: "Upload eerst minimaal één Essent-dataset.",
    statusQuickSwapDone: "Gewisseld naar: {name}.",
    statusNeedDbFile: "Selecteer een .db databasebestand.",
    statusNoValidFiles: "Geen geldige database geselecteerd.",
    statusAnalyzingFile: "Bezig met analyseren van {name}...",
    statusLoadedFromDb: "{count} dataset(s) geladen vanuit database.",
    statusNoDbLoaded: "Nog geen database geladen. Upload een .db in de tab Database Upload.",
    statusLoadingDefaultDb: "Standaarddatabase wordt geladen...",
    statusDefaultDbMissing: "Geen standaarddatabasebron gevonden.",
    statusDefaultDbError: "Standaarddatabase kon niet geladen worden: {error}",
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
    noExampleText: "Geen gedetailleerd voorbeeld beschikbaar.",
    categoryLabel: "Categorie"
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
    rulesApplyHint: "Regels worden toegepast op nieuw geuploade datasets.",
    problemSearchPlaceholder: "Zoek in problemen of voorbeelden...",
    problemSortLabel: "Sorteren",
    problemSortFrequencyDesc: "Frequentie hoog naar laag",
    problemSortFrequencyAsc: "Frequentie laag naar hoog",
    problemSortNameAsc: "Naam A-Z",
    problemSortNameDesc: "Naam Z-A",
    closeBtn: "Sluiten",
    problemDetailTitle: "Gespreksdetail"
  }
};

const state = {
  datasets: [],
  unifiedDataset: null,
  activeDatasetId: null,
  activeTabId: "overviewTab",
  aiEnabled: false,
  language: "en",
  rules: cloneDefaultRules(),
  regexes: buildRuleRegexes(cloneDefaultRules()),
  problemView: {
    search: "",
    sortBy: "frequency_desc"
  },
  handoverView: {
    search: "",
    reason: "all",
    dbColumn: "conversationId",
    dbOp: "contains",
    dbValue: ""
  },
  intentHandoverView: {
    search: "",
    page: 1,
    pageSize: 20
  },
  intentHandoverModalItems: [],
  problemModalItems: [],
  comparison: {
    mode: "all3",
    left: "",
    right: ""
  },
  table: {
    sortKey: null,
    sortDir: 1,
    filter: "",
    page: 1,
    pageSize: 25
  }
};

document.addEventListener("DOMContentLoaded", () => {
  init().catch((error) => {
    setStatus(t("statusUploadFailed", { error: error.message }));
  });
});

async function init() {
  cleanupLegacyStorage();
  loadSession();
  state.language = loadLanguage();
  loadRules();
  bindEvents();
  applyTranslations();
  hydrateApiKeyInput();
  populateRulesEditor();
  renderDatasetSelect();
  setDashboardLocked(true);
  const cachedDbLoaded = await tryLoadCachedUploadedDatabase();
  if (!cachedDbLoaded) {
    // Do not auto-load a default DB. The dashboard should stay empty until the user uploads a DB.
    setStatus(t("statusNoDbLoaded"));
    return;
  }
  setDashboardLocked(false);
  activateTab("overviewTab");
}

function bindEvents() {
  const on = (id, event, handler) => {
    const el = byId(id);
    if (el) el.addEventListener(event, handler);
  };
  document.querySelectorAll(".tab-btn").forEach((btn) => btn.addEventListener("click", () => activateTab(btn.dataset.tab)));
  on("dbUploadAnalyzeBtn", "click", handleDbUpload);
  on("landingDbUploadAnalyzeBtn", "click", () => handleDbUpload("landingDbUploadInput"));
  on("activeDatasetSelect", "change", (e) => {
    state.activeDatasetId = e.target.value || null;
    persistLastActiveTarget();
    saveSession();
    renderAll();
  });
  on("aiEnabled", "change", (e) => {
    state.aiEnabled = e.target.checked;
    saveSession();
  });
  on("runAiBtn", "click", runAiEnrichment);
  on("clearApiKeyBtn", "click", () => {
    clearApiKeyForSession();
    const keyInput = byId("openAiKey");
    if (keyInput) keyInput.value = "";
    setStatus(t("aiKeyCleared"));
  });
  on("openAiKey", "change", (e) => {
    persistApiKeyForSession(e.target.value);
  });
  on("openAiKey", "blur", (e) => {
    persistApiKeyForSession(e.target.value);
  });
  on("languageSelect", "change", (e) => {
    state.language = e.target.value === "nl" ? "nl" : "en";
    persistLanguage(state.language);
    applyTranslations();
    renderDatasetSelect();
    renderAll();
  });
  on("saveRulesBtn", "click", saveRulesFromEditor);
  on("resetRulesBtn", "click", resetRulesToDefault);
  on("problemSearchInput", "input", (e) => {
    state.problemView.search = String(e.target.value || "").trim().toLowerCase();
    renderProblems();
  });
  on("handoverSearchInput", "input", (e) => {
    state.handoverView.search = String(e.target.value || "").trim().toLowerCase();
    renderHandovers();
  });
  on("handoverReasonFilter", "change", (e) => {
    state.handoverView.reason = String(e.target.value || "all");
    renderHandovers();
  });
  on("handoverDbColumn", "change", (e) => {
    state.handoverView.dbColumn = String(e.target.value || "conversationId");
    renderHandovers();
  });
  on("handoverDbOp", "change", (e) => {
    state.handoverView.dbOp = String(e.target.value || "contains");
    renderHandovers();
  });
  on("handoverDbValue", "input", (e) => {
    state.handoverView.dbValue = String(e.target.value || "");
    renderHandovers();
  });
  on("intentHandoverSearchInput", "input", (e) => {
    state.intentHandoverView.search = String(e.target.value || "").trim().toLowerCase();
    state.intentHandoverView.page = 1;
    renderIntentHandovers();
  });
  on("intentHandoverPrevBtn", "click", () => {
    state.intentHandoverView.page = Math.max(1, Number(state.intentHandoverView.page || 1) - 1);
    renderIntentHandovers();
  });
  on("intentHandoverNextBtn", "click", () => {
    state.intentHandoverView.page = Number(state.intentHandoverView.page || 1) + 1;
    renderIntentHandovers();
  });
  on("intentHandoverGoToPageBtn", "click", () => {
    const input = byId("intentHandoverGoToPageInput");
    const requested = Number.parseInt(String(input?.value || ""), 10);
    if (Number.isFinite(requested) && requested > 0) {
      state.intentHandoverView.page = requested;
      renderIntentHandovers();
    }
  });
  on("intentHandoverGoToPageInput", "keydown", (e) => {
    if (e.key !== "Enter") return;
    const requested = Number.parseInt(String(e.target?.value || ""), 10);
    if (Number.isFinite(requested) && requested > 0) {
      state.intentHandoverView.page = requested;
      renderIntentHandovers();
    }
  });
  on("problemSortSelect", "change", (e) => {
    state.problemView.sortBy = e.target.value || "frequency_desc";
    renderProblems();
  });
  on("problemModalCloseBtn", "click", closeProblemModal);
  on("problemModalBackdrop", "click", closeProblemModal);
  on("intentHandoverModalCloseBtn", "click", closeIntentHandoverModal);
  on("intentHandoverModalBackdrop", "click", closeIntentHandoverModal);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeProblemModal();
      closeIntentHandoverModal();
    }
  });
  on("compareModeSelect", "change", (e) => {
    state.comparison.mode = e.target.value === "pair" ? "pair" : "all3";
    saveSession();
    renderComparisonSelectors();
    renderComparison();
  });
  on("compareLeftSelect", "change", (e) => {
    state.comparison.left = e.target.value || "";
    saveSession();
    renderComparison();
  });
  on("compareRightSelect", "change", (e) => {
    state.comparison.right = e.target.value || "";
    saveSession();
    renderComparison();
  });
}

function setDashboardLocked(locked) {
  const landing = byId("landingPage");
  const tabs = byId("dashboardTabs");
  const main = byId("dashboardMain");
  const isLocked = !!locked;
  if (landing) landing.hidden = !isLocked;
  if (tabs) tabs.hidden = isLocked;
  if (main) main.hidden = isLocked;
}

function activateTab(tabId) {
  state.activeTabId = tabId || "overviewTab";
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tabId));
  document.querySelectorAll(".tab-content").forEach((t) => t.classList.toggle("active", t.id === tabId));
  renderActiveTab(state.activeTabId);
}

function clearData() {
  const ok = window.confirm(t("clearConfirm"));
  if (!ok) return;
  state.datasets = [];
  state.unifiedDataset = null;
  state.activeDatasetId = null;
  state.comparison = { mode: "all3", left: "", right: "" };
  state.table.page = 1;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PERSISTENT_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
  clearUploadedDbCache();
  renderDatasetSelect();
  renderAll();
  setStatus(t("clearDone"));
  setDashboardLocked(true);
}

async function handleDbUpload(inputId = "dbUploadInput") {
  const input = byId(inputId);
  const file = input?.files?.[0];
  if (!file) {
    setStatus(t("statusNeedDbFile"));
    return;
  }
  if (!String(file.name || "").toLowerCase().endsWith(".db")) {
    setStatus(t("statusNeedDbFile"));
    return;
  }

  setStatus(t("statusAnalyzingFile", { name: file.name }));
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const sqliteError = detectInvalidSqliteBuffer(bytes);
    if (sqliteError) {
      setStatus(t("statusUploadFailed", { error: sqliteError }));
      return;
    }
    const datasets = await analyzeDbBufferToDatasets(bytes, file.name);
    if (!datasets.length) {
      setStatus(t("statusNoValidFiles"));
      return;
    }
    await persistUploadedDbCache(bytes, file.name);
    state.datasets = datasets;
    rebuildUnifiedDataset();
    persistLastActiveTarget();
    saveSession();
    setDashboardLocked(false);
    activateTab("overviewTab");
    renderDatasetSelect();
    renderAll();
    setStatus(t("statusLoadedFromDb", { count: datasets.length }));
    renderDbUploadTab();
  } catch (error) {
    setStatus(t("statusUploadFailed", { error: error?.message || "Unknown error" }));
  }
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
      sourceTable: resolveSourceTable(row),
      firstTime: inferRowTime(row, ctx.fields),
      lastUserMessage: "",
      preview: extractConversationPreview(row, ctx.fields, text)
    };
    ctx.conversationStats.set(convKey, conv);
  }

  conv.turns += 1;
  const goalText = extractGoalText(row, ctx.fields);
  conv.resolved = conv.resolved || detectResolvedSignal(text, goalText);
  conv.escalated = conv.escalated || detectEscalationSignal(text, goalText, row, ctx.fields);
  conv.handoverKeyword = conv.handoverKeyword || state.regexes.handoverRegex.test(text);
  conv.negative = conv.negative || state.regexes.negativeRegex.test(text);
  conv.fallback = conv.fallback || detectFallbackSignal(text, row, ctx.fields);
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
  const goalText = extractGoalText(row, fields);
  return {
    id: String(row[fields?.conversationId] ?? `row-${Math.random().toString(36).slice(2, 8)}`),
    turns: 1,
    resolved: detectResolvedSignal(text, goalText),
    escalated: detectEscalationSignal(text, goalText, row, fields),
    handoverKeyword: state.regexes.handoverRegex.test(text),
    negative: state.regexes.negativeRegex.test(text),
    fallback: detectFallbackSignal(text, row, fields),
    repeated: false,
    category,
    sourceTable: resolveSourceTable(row),
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
        sourceTable: conv.sourceTable || conv.preview?.sourceTable || "-",
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

function rebuildUnifiedDataset() {
  if (!Array.isArray(state.datasets) || !state.datasets.length) {
    state.unifiedDataset = null;
    state.activeDatasetId = null;
    return;
  }
  const mergedRows = state.datasets.flatMap((dataset) => {
    const sourceFromName = String(dataset.name || "").split("::").pop() || "";
    const fallbackSource = sourceFromName || dataset.targetLabel || dataset.targetKey || "dataset";
    return (dataset.rows || []).map((row) => ({
      ...row,
      __sourceTable: row.__sourceTable || fallbackSource
    }));
  });
  const analysis = analyzeRows(mergedRows, { source: "all_tables" });
  state.unifiedDataset = {
    id: "all-tables",
    name: "All tables",
    targetKey: "all_tables",
    targetLabel: "All tables",
    uploadedAt: new Date().toISOString(),
    rows: mergedRows,
    analysis
  };
  state.activeDatasetId = state.unifiedDataset.id;
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
  // Auto-map known columns first, then fallback to regex patterns.
  const columnSet = new Set(columns);
  const has = (name) => columnSet.has(name);
  const pick = (patterns) => columns.find((c) => patterns.some((p) => p.test(c.toLowerCase())));
  const pickExact = (names) => names.find((name) => has(name)) || null;
  return {
    conversationId: pickExact(DB_FIELD_PRIORITY.conversationId) || pick([/session.*id/, /conversation.*id/, /^conv_id$/, /^ticket/, /thread.*id$/, /^id$/]),
    userMessage: pickExact(DB_FIELD_PRIORITY.userMessage) || pick([/user.*message/, /customer.*message/, /customer.*input/, /inputtext/, /question/, /user_text/, /^message$/]),
    botResponse: pick([/bot.*response/, /assistant.*response/, /agent.*response/, /reply/, /response/]),
    timestamp: pickExact(DB_FIELD_PRIORITY.timestamp) || pick([/timestamp/, /created.*at/, /time/, /date/]),
    status: pickExact(DB_FIELD_PRIORITY.status) || pick([/status/, /resolved/, /escalat/, /outcome/]),
    escalationFlag: pickExact(DB_FIELD_PRIORITY.escalationFlag) || pick([/escalat/, /handover/, /human/, /agent_required/, /transfer/]),
    category: pickExact(DB_FIELD_PRIORITY.category) || pick([/category/, /intent/, /topic/, /issue/]),
    goalsField: pickExact(DB_FIELD_PRIORITY.goalsField)
  };
}

function deriveIssueCategory(row, fields, text) {
  if (fields?.category && row[fields.category]) return String(row[fields.category]).toLowerCase();
  return categorizeIssue(text);
}

function extractGoalText(row, fields) {
  if (!fields?.goalsField || isEmpty(row[fields.goalsField])) return "";
  return String(row[fields.goalsField]).toLowerCase();
}

function detectResolvedSignal(text, goalText) {
  if (/\bresolved|closed|solved|completed\b/.test(text)) return true;
  if (!goalText) return false;
  return /\bfaq_helpful\b|\bcustomer_verified\b|\bconnectie_backend_succes\b/.test(goalText);
}

function detectEscalationSignal(text, goalText, row, fields) {
  if (state.regexes.escalationRegex.test(text)) return true;
  if (fields?.escalationFlag && !isEmpty(row[fields.escalationFlag])) {
    const flagValue = String(row[fields.escalationFlag]).toLowerCase().trim();
    if (flagValue && flagValue !== "none" && flagValue !== "null") return true;
  }
  if (!goalText) return false;
  return /\bdirectlivechat\b|\boutside_service_hours_no_agents\b|\bhandover\b|\btransfer\b/.test(goalText);
}

function detectFallbackSignal(text, row, fields) {
  if (state.regexes.fallbackRegex.test(text)) return true;
  if (fields?.userMessage && !isEmpty(row[fields.userMessage])) {
    const msg = String(row[fields.userMessage]).toLowerCase();
    if (/\bunrecognized\b|\bonbekend\b|\bniet begrepen\b/.test(msg)) return true;
  }
  return false;
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
  let status = fields?.status ? trimText(String(row[fields.status] ?? "").trim(), 80) : "";
  if (!status && fields?.goalsField && !isEmpty(row[fields.goalsField])) {
    status = trimText(String(row[fields.goalsField] ?? "").trim(), 80);
  }
  const timestamp = fields?.timestamp && row[fields.timestamp] ? String(row[fields.timestamp]) : inferRowTime(row, fields);
  return {
    user,
    bot,
    status,
    timestamp,
    sourceTable: resolveSourceTable(row),
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
  const aiToggle = byId("aiEnabled");
  if (aiToggle && !aiToggle.checked) return setStatus(t("aiEnableFirst"));
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
  const preferredTarget = loadLastActiveTarget();
  const preferredDataset = preferredTarget ? state.datasets.find((d) => d.targetKey === preferredTarget) : null;
  const fallbackDataset = state.datasets[0] || null;
  const activeDataset = preferredDataset || fallbackDataset;
  if (activeDataset) {
    state.activeDatasetId = activeDataset.id;
    persistLastActiveTarget();
  } else {
    state.activeDatasetId = null;
  }
  if (!sel) {
    renderComparisonSelectors();
    return;
  }
  sel.innerHTML = "";
  if (!state.datasets.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = t("noDatasetLoaded");
    sel.appendChild(opt);
    const aiToggle = byId("aiEnabled");
    if (aiToggle) aiToggle.checked = !!state.aiEnabled;
    renderComparisonSelectors();
    return;
  }
  state.datasets.forEach((d) => {
    const opt = document.createElement("option");
    opt.value = d.id;
    const label = d.targetLabel || d.name;
    opt.textContent = `${label} (${d.analysis.rowCount.toLocaleString()} rows)`;
    sel.appendChild(opt);
  });
  sel.value = state.activeDatasetId;
  const aiToggle = byId("aiEnabled");
  if (aiToggle) aiToggle.checked = !!state.aiEnabled;
  renderComparisonSelectors();
}

function renderComparisonSelectors() {
  const modeSel = byId("compareModeSelect");
  const leftSel = byId("compareLeftSelect");
  const rightSel = byId("compareRightSelect");
  if (!modeSel || !leftSel || !rightSel) return;

  modeSel.value = state.comparison.mode === "pair" ? "pair" : "all3";
  const loadedTargets = TARGET_DATASET_FILES
    .map((target) => ({
      ...target,
      dataset: state.datasets.find((d) => d.targetKey === target.key)
    }))
    .filter((x) => x.dataset);

  leftSel.innerHTML = "";
  rightSel.innerHTML = "";
  loadedTargets.forEach((item) => {
    const leftOpt = document.createElement("option");
    leftOpt.value = item.dataset.id;
    leftOpt.textContent = item.label;
    leftSel.appendChild(leftOpt);
    const rightOpt = document.createElement("option");
    rightOpt.value = item.dataset.id;
    rightOpt.textContent = item.label;
    rightSel.appendChild(rightOpt);
  });

  if (!loadedTargets.length) {
    return;
  }

  if (!state.comparison.left || !loadedTargets.some((x) => x.dataset.id === state.comparison.left)) {
    state.comparison.left = loadedTargets[0].dataset.id;
  }
  if (!state.comparison.right || !loadedTargets.some((x) => x.dataset.id === state.comparison.right)) {
    state.comparison.right = loadedTargets[Math.min(1, loadedTargets.length - 1)].dataset.id;
  }
  if (state.comparison.left === state.comparison.right && loadedTargets.length > 1) {
    state.comparison.right = loadedTargets.find((x) => x.dataset.id !== state.comparison.left).dataset.id;
  }

  leftSel.value = state.comparison.left;
  rightSel.value = state.comparison.right;
  const pairMode = state.comparison.mode === "pair";
  leftSel.disabled = !pairMode;
  rightSel.disabled = !pairMode;
}

function getTargetFileDefinition(fileName) {
  const key = normalizeTargetFileKey(fileName);
  return TARGET_DATASET_FILES.find((item) => item.key === key) || null;
}

function normalizeTargetFileKey(fileName) {
  return String(fileName || "").trim().toLowerCase();
}

function getTargetOrder(targetKey) {
  const idx = TARGET_DATASET_FILES.findIndex((item) => item.key === targetKey);
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
}

function getComparisonDatasets() {
  const unified = getActiveDataset();
  return unified ? [unified] : [];
}

function renderAll() {
  renderComparisonSelectors();
  renderActiveTab(state.activeTabId);
}

function renderActiveTab(tabId) {
  const activeTab = tabId || state.activeTabId || "overviewTab";
  if (activeTab === "overviewTab") {
    renderOverview();
    return;
  }
  if (activeTab === "dbUploadTab") {
    renderDbUploadTab();
    return;
  }
  if (activeTab === "dataExplorerTab") {
    renderColumnTypes();
    renderQuality();
    return;
  }
  if (activeTab === "handoversTab") {
    renderHandovers();
    return;
  }
  if (activeTab === "intentHandoversTab") {
    renderIntentHandovers();
    return;
  }
  if (activeTab === "problemsTab") {
    renderProblems();
    return;
  }
  if (activeTab === "aiAnalysisTab") {
    renderAiAnalysis();
    return;
  }
  if (activeTab === "rulesTab") {
    renderRulesTab();
    return;
  }
  if (activeTab === "comparisonTab") {
    renderComparison();
    return;
  }
  renderOverview();
}

function renderDbUploadTab() {
  const info = byId("dbUploadCurrentInfo");
  if (!info) return;
  const active = getActiveDataset();
  if (!active) {
    info.textContent = t("dbUploadNoDataset");
    return;
  }
  info.textContent = t("dbUploadCurrent", {
    name: active.name || active.targetLabel || t("noDatasetLoaded"),
    rows: Number(active.analysis?.rowCount || 0).toLocaleString()
  });
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
  const rows = (dataset.analysis.columnTypes || []).map((item) => ({
    columnName: item.column || "",
    dataType: item.type || "",
    nonNullCount: Number(item.nonNullCount || 0).toLocaleString(),
    uniqueCount: String(item.uniqueCount ?? "0")
  }));
  renderTable(
    byId("columnTypeTableWrap"),
    rows,
    ["columnName", "dataType", "nonNullCount", "uniqueCount"],
    null,
    {
      columnName: t("tableColumnName"),
      dataType: t("tableDataType"),
      nonNullCount: t("tableNonNullCount"),
      uniqueCount: t("tableUniqueCount")
    }
  );
}

function renderQuality() {
  const dataset = getActiveDataset();
  byId("qualityTableWrap").innerHTML = "";
  if (!dataset) return;
  const rows = (dataset.analysis.quality || []).map((item) => ({
    columnName: item.column || "",
    missingCount: Number(item.missingCount || 0).toLocaleString(),
    missingPct: `${Number(item.missingPct || 0).toFixed(2)}%`,
    inconsistentCount: Number(item.inconsistentCount || 0).toLocaleString()
  }));
  renderTable(
    byId("qualityTableWrap"),
    rows,
    ["columnName", "missingCount", "missingPct", "inconsistentCount"],
    null,
    {
      columnName: t("tableColumnName"),
      missingCount: t("tableMissingCount"),
      missingPct: t("tableMissingPct"),
      inconsistentCount: t("tableInconsistentCount")
    }
  );
}

function renderDataTable() {
  const dataset = getActiveDataset();
  const wrap = byId("dataTableWrap");
  const pageInfoEl = byId("tablePageInfo");
  if (!wrap || !pageInfoEl) return;
  if (!dataset) {
    wrap.innerHTML = "";
    pageInfoEl.textContent = "";
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
  pageInfoEl.textContent = `Page ${state.table.page}/${totalPages} (${filtered.length.toLocaleString()} matched rows)${suffix}`;
}

function renderHandovers() {
  const dataset = getActiveDataset();
  const searchInput = byId("handoverSearchInput");
  const reasonSelect = byId("handoverReasonFilter");
  const dbColumnSelect = byId("handoverDbColumn");
  const dbOpSelect = byId("handoverDbOp");
  const dbValueInput = byId("handoverDbValue");
  const filterInfo = byId("handoverFilterInfo");
  if (!dataset) {
    byId("kpiHandovers").textContent = "0";
    byId("kpiHandoverPct").textContent = "0%";
    byId("handoverTableWrap").innerHTML = "";
    if (filterInfo) filterInfo.textContent = t("handoverFilterInfo", { shown: 0, total: 0 });
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
  const rows = (a.handoverRows || []).map((r) => ({ ...r, category: mapIssueLabel(r.category, a) }));
  if (searchInput) {
    searchInput.value = state.handoverView.search || "";
  }
  if (dbColumnSelect) dbColumnSelect.value = state.handoverView.dbColumn || "conversationId";
  if (dbOpSelect) dbOpSelect.value = state.handoverView.dbOp || "contains";
  if (dbValueInput) dbValueInput.value = state.handoverView.dbValue || "";
  if (reasonSelect) {
    const reasons = Array.from(new Set(rows.map((r) => String(r.reason || "").trim()).filter(Boolean))).sort((x, y) => x.localeCompare(y));
    reasonSelect.innerHTML = "";
    const allOpt = document.createElement("option");
    allOpt.value = "all";
    allOpt.textContent = t("handoverReasonAll");
    reasonSelect.appendChild(allOpt);
    reasons.forEach((reason) => {
      const opt = document.createElement("option");
      opt.value = reason;
      opt.textContent = reason;
      reasonSelect.appendChild(opt);
    });
    if ((state.handoverView.reason || "all") !== "all" && !reasons.includes(state.handoverView.reason)) {
      state.handoverView.reason = "all";
    }
    reasonSelect.value = state.handoverView.reason || "all";
  }

  const search = String(state.handoverView.search || "").trim().toLowerCase();
  const selectedReason = String(state.handoverView.reason || "all");
  const dbColumn = String(state.handoverView.dbColumn || "conversationId");
  const dbOp = String(state.handoverView.dbOp || "contains");
  const dbValueRaw = String(state.handoverView.dbValue || "");
  const dbValue = dbValueRaw.trim().toLowerCase();
  const filteredRows = rows.filter((row) => {
    const reasonMatch = selectedReason === "all" || String(row.reason || "") === selectedReason;
    if (!reasonMatch) return false;
    const searchMatch = !search || Object.values(row).join(" ").toLowerCase().includes(search);
    if (!searchMatch) return false;

    if (!dbValue) return true;
    const cell = row[dbColumn];
    const cellStr = String(cell ?? "").trim();
    const cellLower = cellStr.toLowerCase();

    if (dbOp === "contains") return cellLower.includes(dbValue);
    if (dbOp === "eq") return cellLower === dbValue;

    const leftNum = Number(cell);
    const rightNum = Number(dbValueRaw);
    if (dbOp === "gt") return Number.isFinite(leftNum) && Number.isFinite(rightNum) && leftNum > rightNum;
    if (dbOp === "lt") return Number.isFinite(leftNum) && Number.isFinite(rightNum) && leftNum < rightNum;
    return true;
  });

  renderTable(
    byId("handoverTableWrap"),
    filteredRows,
    ["conversationId", "handoverTime", "category", "sourceTable", "reason", "turns"],
    null,
    {
      sourceTable: t("tableSourceTable")
    }
  );
  if (filterInfo) {
    filterInfo.textContent = t("handoverFilterInfo", {
      shown: filteredRows.length.toLocaleString(),
      total: rows.length.toLocaleString()
    });
  }
}

function renderIntentHandovers() {
  const dataset = getActiveDataset();
  const wrap = byId("intentHandoverCardsWrap");
  const summaryEl = byId("intentHandoverSummary");
  const searchInput = byId("intentHandoverSearchInput");
  const goToPageInput = byId("intentHandoverGoToPageInput");
  const prevBtn = byId("intentHandoverPrevBtn");
  const nextBtn = byId("intentHandoverNextBtn");
  const pageInfo = byId("intentHandoverPageInfo");
  if (!wrap || !summaryEl || !pageInfo) return;
  if (!dataset) {
    wrap.innerHTML = `<p class="muted">${escapeHtml(t("noDataAvailable"))}</p>`;
    summaryEl.textContent = t("intentHandoverSummary", { shown: 0, total: 0 });
    pageInfo.textContent = t("intentHandoverPageInfo", { page: 1, total: 1 });
    if (goToPageInput) goToPageInput.value = "1";
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    return;
  }

  // Build a row-level list for every MAIN_INTENT handover record.
  const handoverRows = collectMainIntentHandoverRows(dataset.rows || []);
  const search = String(state.intentHandoverView.search || "").trim().toLowerCase();
  if (searchInput) searchInput.value = state.intentHandoverView.search || "";

  const filtered = !search
    ? handoverRows
    : handoverRows.filter((item) => {
        if (item.contactId.toLowerCase().includes(search)) return true;
        return item.conversationId.toLowerCase().includes(search);
      });

  const pageSize = Number(state.intentHandoverView.pageSize || 20);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(Math.max(1, Number(state.intentHandoverView.page || 1)), totalPages);
  state.intentHandoverView.page = currentPage;
  const startIdx = (currentPage - 1) * pageSize;
  const pageItems = filtered.slice(startIdx, startIdx + pageSize);

  state.intentHandoverModalItems = pageItems;
  wrap.innerHTML = pageItems.map((item, idx) => `
    <article class="problem-example-card intent-handover-card" data-intent-handover-id="${idx}">
      <div class="problem-meta-row">
        <span class="problem-meta-chip">${escapeHtml(t("intentHandoverCardContact"))}: ${escapeHtml(item.contactId || "-")}</span>
        <span class="problem-meta-chip">${escapeHtml(t("intentHandoverStepsLabel"))}: ${escapeHtml(String(item.stepsToHandover || 0))}</span>
      </div>
    </article>
  `).join("");

  summaryEl.textContent = t("intentHandoverSummary", {
    shown: filtered.length.toLocaleString(),
    total: handoverRows.length.toLocaleString()
  });
  pageInfo.textContent = t("intentHandoverPageInfo", {
    page: currentPage,
    total: totalPages
  });
  if (goToPageInput) goToPageInput.value = String(currentPage);
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;

  wrap.querySelectorAll(".intent-handover-card").forEach((card) => {
    card.addEventListener("click", () => {
      openIntentHandoverModal(Number(card.getAttribute("data-intent-handover-id")));
    });
  });
}

function collectMainIntentHandoverRows(rows) {
  const conversationStepCounts = new Map();
  const out = [];
  rows.forEach((row, idx) => {
    const conversationId = resolveHandoverConversationId(row);
    if (conversationId && conversationId !== "-") {
      const nextCount = (conversationStepCounts.get(conversationId) || 0) + 1;
      conversationStepCounts.set(conversationId, nextCount);
    }
    if (!isMainIntentHandover(row)) return;
    const contactId = resolveHandoverContactId(row, idx);
    const stepsToHandover =
      conversationId && conversationId !== "-" ? (conversationStepCounts.get(conversationId) || 1) : 1;
    const timestamp = String(row[INTENT_HANDOVER_CONFIG.timestampColumn] || "-");
    out.push({
      contactId,
      conversationId,
      sourceTable: resolveSourceTable(row),
      stepsToHandover,
      timestamp,
      rowData: row
    });
  });
  return out.sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
}

function isMainIntentHandover(row) {
  // Strict match: only rows where MAIN_INTENT equals "handover".
  const value = String(row[INTENT_HANDOVER_CONFIG.mainIntentColumn] || "").trim().toLowerCase();
  return value === "handover";
}

function resolveHandoverContactId(row, idx) {
  // Prefer CONTACTID, fallback to session/conversation IDs to avoid dropping records.
  const direct = String(row[INTENT_HANDOVER_CONFIG.contactIdColumn] || "").trim();
  if (direct) return direct;
  const fallback = INTENT_HANDOVER_CONFIG.sessionIdColumns
    .map((col) => String(row[col] || "").trim())
    .find(Boolean);
  return fallback || `missing-${idx}`;
}

function resolveHandoverConversationId(row) {
  // Conversation identity follows configured fallback order.
  const id = INTENT_HANDOVER_CONFIG.sessionIdColumns
    .map((col) => String(row[col] || "").trim())
    .find(Boolean);
  return id || "-";
}

function openIntentHandoverModal(itemId) {
  const detail = state.intentHandoverModalItems[itemId];
  if (!detail) return;
  const modal = byId("intentHandoverDetailModal");
  const backdrop = byId("intentHandoverModalBackdrop");
  const body = byId("intentHandoverModalBody");
  if (!modal || !backdrop || !body) return;

  const header = `
    <div class="problem-meta-row">
      <span class="problem-meta-chip">${escapeHtml(t("intentHandoverCardContact"))}: ${escapeHtml(detail.contactId)}</span>
      <span class="problem-meta-chip">${escapeHtml(t("conversationIdLabel"))}: ${escapeHtml(detail.conversationId || "-")}</span>
      <span class="problem-meta-chip">${escapeHtml(t("tableSourceTable"))}: ${escapeHtml(detail.sourceTable || "-")}</span>
      <span class="problem-meta-chip">${escapeHtml(t("intentHandoverStepsLabel"))}: ${escapeHtml(String(detail.stepsToHandover || 0))}</span>
      <span class="problem-meta-chip">${escapeHtml(t("timeLabel"))}: ${escapeHtml(String(detail.timestamp || "-"))}</span>
    </div>
  `;
  const dataEntries = Object.entries(detail.rowData || {});
  const tableRows = dataEntries.map(([key, value]) => `
    <tr>
      <td>${escapeHtml(String(key))}</td>
      <td class="copyable-cell" data-copy-value="${encodeURIComponent(value == null ? "-" : String(value))}" title="${escapeHtml(t("copyCellHint"))}">
        ${escapeHtml(value == null ? "-" : String(value))}
      </td>
    </tr>
  `).join("");
  const relatedRows = collectRelatedRowsForIntentDetail(detail);
  const inputTextValues = collectFieldValues(relatedRows, "INPUTTEXT_anonymized");
  const customerInputValues = collectFieldValues(relatedRows, "CUSTOMER_INPUT_TEXT_anonymized");
  const inputTextItems = inputTextValues.length
    ? inputTextValues.map((value) => `<li>${escapeHtml(value)}</li>`).join("")
    : `<li>${escapeHtml(t("intentHandoverNoInputValues"))}</li>`;
  const customerInputItems = customerInputValues.length
    ? customerInputValues.map((value) => `<li>${escapeHtml(value)}</li>`).join("")
    : `<li>${escapeHtml(t("intentHandoverNoInputValues"))}</li>`;
  body.innerHTML = `
    ${header}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>${escapeHtml("Field")}</th>
            <th>${escapeHtml("Value")}</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
    <div class="panel" style="margin-top:0.8rem;">
      <h4>${escapeHtml(t("intentHandoverInputListsTitle"))}</h4>
      <div class="chart-grid">
        <div>
          <h5>${escapeHtml(t("intentHandoverInputTextListTitle"))}</h5>
          <ul>${inputTextItems}</ul>
        </div>
        <div>
          <h5>${escapeHtml(t("intentHandoverCustomerInputListTitle"))}</h5>
          <ul>${customerInputItems}</ul>
        </div>
      </div>
    </div>
  `;
  body.querySelectorAll("[data-copy-value]").forEach((cell) => {
    cell.addEventListener("click", async () => {
      const encoded = cell.getAttribute("data-copy-value") || "";
      const text = decodeURIComponent(encoded);
      const copied = await copyTextToClipboard(text);
      setStatus(copied ? t("copiedValue") : t("copyFailed"));
    });
  });
  modal.hidden = false;
  backdrop.hidden = false;
}

function collectRelatedRowsForIntentDetail(detail) {
  const dataset = getActiveDataset();
  const rows = Array.isArray(dataset?.rows) ? dataset.rows : [];
  const contactId = String(detail?.contactId || "").trim().toLowerCase();
  if (!contactId) return [];
  return rows.filter((row) => String(row?.[INTENT_HANDOVER_CONFIG.contactIdColumn] || "").trim().toLowerCase() === contactId);
}

function collectFieldValues(rows, fieldName) {
  const values = [];
  rows.forEach((row) => {
    const value = String(row?.[fieldName] ?? "").trim();
    if (!value) return;
    values.push(value);
  });
  return values;
}

function closeIntentHandoverModal() {
  const modal = byId("intentHandoverDetailModal");
  const backdrop = byId("intentHandoverModalBackdrop");
  if (modal) modal.hidden = true;
  if (backdrop) backdrop.hidden = true;
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
  let problems = [...(a.topProblems || [])];
  const search = state.problemView.search;
  if (search) {
    problems = problems.filter((p) => {
      const label = mapIssueLabel(p.problem, a).toLowerCase();
      if (label.includes(search)) return true;
      return (p.examples || []).some((ex) => {
        if (typeof ex === "string") return ex.toLowerCase().includes(search);
        return Object.values(ex || {}).join(" ").toLowerCase().includes(search);
      });
    });
  }

  problems.sort((x, y) => {
    const sx = mapIssueLabel(x.problem, a).toLowerCase();
    const sy = mapIssueLabel(y.problem, a).toLowerCase();
    switch (state.problemView.sortBy) {
      case "frequency_asc":
        return x.frequency - y.frequency;
      case "name_asc":
        return sx.localeCompare(sy);
      case "name_desc":
        return sy.localeCompare(sx);
      case "frequency_desc":
      default:
        return y.frequency - x.frequency;
    }
  });

  state.problemModalItems = [];
  byId("problemExamplesWrap").innerHTML = problems.map((p) => {
    const examples = (p.examples || []).map((ex) => {
      const detail = typeof ex === "string"
        ? {
            category: mapIssueLabel(p.problem, a),
            frequency: p.frequency,
            conversationId: "-",
            turns: "-",
            status: "-",
            time: "-",
            user: "",
            bot: "",
            summary: ex
          }
        : {
            category: mapIssueLabel(p.problem, a),
            frequency: p.frequency,
            conversationId: ex.conversationId || "-",
            turns: String(ex.turns ?? "-"),
            status: ex.status || "-",
            time: ex.time ? safeDay(ex.time) : "-",
            user: ex.user || "",
            bot: ex.bot || "",
            summary: ex.summary || t("noExampleText")
          };
      const exampleId = state.problemModalItems.push(detail) - 1;
      return `
        <div class="problem-example-card" data-example-id="${exampleId}">
          <div class="problem-meta-row">
            <span class="problem-meta-chip">${escapeHtml(t("conversationIdLabel"))}: ${escapeHtml(detail.conversationId)}</span>
            <span class="problem-meta-chip">${escapeHtml(t("turnsLabel"))}: ${escapeHtml(detail.turns)}</span>
            <span class="problem-meta-chip">${escapeHtml(t("timeLabel"))}: ${escapeHtml(detail.time)}</span>
          </div>
          <div class="problem-line"><strong>${escapeHtml(t("statusLabel"))}:</strong> ${escapeHtml(detail.status)}</div>
          <div class="problem-line"><strong>${escapeHtml(t("userMessageLabel"))}:</strong> ${escapeHtml(detail.user || "-")}</div>
          <div class="problem-line"><strong>${escapeHtml(t("botResponseLabel"))}:</strong> ${escapeHtml(detail.bot || "-")}</div>
          <div class="problem-summary"><strong>${escapeHtml(t("summaryLabel"))}:</strong> ${escapeHtml(detail.summary)}</div>
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

  byId("problemExamplesWrap").querySelectorAll(".problem-example-card[data-example-id]").forEach((card) => {
    card.addEventListener("click", () => openProblemModal(Number(card.getAttribute("data-example-id"))));
  });
}

function openProblemModal(exampleId) {
  const detail = state.problemModalItems[exampleId];
  if (!detail) return;
  const modal = byId("problemDetailModal");
  const backdrop = byId("problemModalBackdrop");
  const body = byId("problemDetailBody");
  if (!modal || !backdrop || !body) return;

  body.innerHTML = `
    <div class="problem-meta-row">
      <span class="problem-meta-chip">${escapeHtml(t("conversationIdLabel"))}: ${escapeHtml(detail.conversationId)}</span>
      <span class="problem-meta-chip">${escapeHtml(t("turnsLabel"))}: ${escapeHtml(detail.turns)}</span>
      <span class="problem-meta-chip">${escapeHtml(t("timeLabel"))}: ${escapeHtml(detail.time)}</span>
      <span class="problem-meta-chip">${escapeHtml(t("statusLabel"))}: ${escapeHtml(detail.status)}</span>
      <span class="problem-meta-chip">${escapeHtml(t("categoryLabel"))}: ${escapeHtml(detail.category)}</span>
      <span class="problem-meta-chip">${escapeHtml(t("frequency"))}: ${escapeHtml(String(detail.frequency))}</span>
    </div>
    <div class="problem-line"><strong>${escapeHtml(t("userMessageLabel"))}:</strong></div>
    <div class="problem-summary">${escapeHtml(detail.user || "-")}</div>
    <div class="problem-line" style="margin-top:0.6rem;"><strong>${escapeHtml(t("botResponseLabel"))}:</strong></div>
    <div class="problem-summary">${escapeHtml(detail.bot || "-")}</div>
    <div class="problem-line" style="margin-top:0.6rem;"><strong>${escapeHtml(t("summaryLabel"))}:</strong></div>
    <div class="problem-summary">${escapeHtml(detail.summary || t("noExampleText"))}</div>
  `;

  backdrop.hidden = false;
  modal.hidden = false;
}

function closeProblemModal() {
  const modal = byId("problemDetailModal");
  const backdrop = byId("problemModalBackdrop");
  if (modal) modal.hidden = true;
  if (backdrop) backdrop.hidden = true;
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
  const datasetsToCompare = getComparisonDatasets();
  if (!datasetsToCompare.length) {
    byId("compareTableWrap").innerHTML = "";
    destroyChart("datasetCompareBar");
    destroyChart("datasetTrendLine");
    return;
  }
  const summary = datasetsToCompare.map((d, idx) => ({
    dataset: d.targetLabel || d.name,
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

function renderTable(container, rows, columns, onSort, headerLabels) {
  if (!rows || !rows.length) {
    container.innerHTML = `<p class='muted'>${escapeHtml(t("noDataAvailable"))}</p>`;
    return;
  }
  const header = columns.map((col) => `<th data-key="${escapeHtml(col)}">${escapeHtml((headerLabels && headerLabels[col]) ? headerLabels[col] : col)}</th>`).join("");
  const body = rows.map((row) => `<tr>${columns.map((col) => `<td>${escapeHtml(row[col] == null ? "" : String(row[col]))}</td>`).join("")}</tr>`).join("");
  container.innerHTML = `<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
  if (typeof onSort === "function") {
    container.querySelectorAll("th").forEach((th) => th.addEventListener("click", () => onSort(th.dataset.key)));
  }
}

function loadSession() {
  try {
    const raw = loadPersistedPayload();
    if (!raw) return;
    const parsed = JSON.parse(raw);
    state.datasets = Array.isArray(parsed.datasets) ? parsed.datasets.map((d) => hydrateTargetDataset(d)).filter(Boolean) : [];
    state.activeDatasetId = parsed.activeDatasetId || null;
    state.aiEnabled = !!parsed.aiEnabled;
    if (parsed.comparison && typeof parsed.comparison === "object") {
      state.comparison.mode = parsed.comparison.mode === "pair" ? "pair" : "all3";
      state.comparison.left = parsed.comparison.left || "";
      state.comparison.right = parsed.comparison.right || "";
    }
    if (!state.datasets.find((d) => d.id === state.activeDatasetId) && state.datasets.length) {
      state.activeDatasetId = state.datasets[state.datasets.length - 1].id;
    }
    rebuildUnifiedDataset();
  } catch {
    state.datasets = [];
    state.unifiedDataset = null;
  }
}

function saveSession() {
  const recentDatasets = state.datasets.slice(-MAX_SESSION_DATASETS);
  const payloads = [
    {
      datasets: recentDatasets.map((d) => compactDatasetForSession(d, 300, true)),
      activeDatasetId: state.activeDatasetId,
      aiEnabled: state.aiEnabled,
      comparison: state.comparison
    },
    {
      datasets: recentDatasets.map((d) => compactDatasetForSession(d, 50, true)),
      activeDatasetId: state.activeDatasetId,
      aiEnabled: state.aiEnabled,
      comparison: state.comparison
    },
    {
      datasets: recentDatasets.map((d) => compactDatasetForSession(d, 0, false)),
      activeDatasetId: state.activeDatasetId,
      aiEnabled: state.aiEnabled,
      comparison: state.comparison
    },
    {
      datasets: recentDatasets.map((d) => compactDatasetForSessionTiny(d)),
      activeDatasetId: state.activeDatasetId,
      aiEnabled: state.aiEnabled,
      comparison: state.comparison
    }
  ];

  for (const payload of payloads) {
    if (savePayloadToStorage(payload)) {
      return;
    }
  }

  // Keep previous session payload if writing a new one fails.
}

async function ensureDefaultDatabaseLoaded() {
  if (state.datasets.length) return;
  const cachedDbLoaded = await tryLoadCachedUploadedDatabase();
  if (cachedDbLoaded) return;
  setStatus(t("statusLoadingDefaultDb"));
  let lastError = "";
  for (const source of DEFAULT_DB_SOURCES) {
    try {
      const response = await fetch(source, { cache: "no-store" });
      if (!response.ok) {
        let details = "";
        try {
          details = String(await response.text()).trim().slice(0, 200);
        } catch {
          // ignore
        }
        lastError = `${source}: HTTP ${response.status}${details ? ` - ${details}` : ""}`;
        continue;
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      const sqliteError = detectInvalidSqliteBuffer(bytes);
      if (sqliteError) {
        lastError = `${source}: ${sqliteError}`;
        continue;
      }
      const datasets = await analyzeDbBufferToDatasets(bytes, source);
      if (!datasets.length) continue;
      state.datasets = datasets;
      rebuildUnifiedDataset();
      persistLastActiveTarget();
      saveSession();
      renderDatasetSelect();
      renderAll();
      setStatus(t("statusLoadedFromDb", { count: datasets.length }));
      return;
    } catch (error) {
      lastError = `${source}: ${error?.message || "Unknown load error"}`;
    }
  }
  if (lastError) {
    setStatus(t("statusDefaultDbError", { error: lastError }));
    return;
  }
  setStatus(t("statusDefaultDbMissing"));
}

async function tryLoadCachedUploadedDatabase() {
  try {
    const cached = await loadUploadedDbCache();
    if (!cached || !(cached.bytes instanceof Uint8Array) || !cached.bytes.length) return false;
    const sqliteError = detectInvalidSqliteBuffer(cached.bytes);
    if (sqliteError) return false;
    const datasets = await analyzeDbBufferToDatasets(cached.bytes, cached.name || "uploaded.db");
    if (!datasets.length) return false;
    state.datasets = datasets;
    rebuildUnifiedDataset();
    persistLastActiveTarget();
    saveSession();
    renderDatasetSelect();
    renderAll();
    setStatus(t("statusLoadedFromDb", { count: datasets.length }));
    return true;
  } catch {
    return false;
  }
}

async function analyzeDbBufferToDatasets(bytes, sourceName) {
  const SQL = await loadSqlJs();
  const db = new SQL.Database(bytes);
  try {
    const tableRows = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
    const names = tableRows[0]?.values?.map((v) => String(v[0] || "").trim().toLowerCase()) || [];
    const out = [];
    names.forEach((tableName) => {
      const targetKey = SQLITE_TABLE_TO_TARGET[tableName];
      if (!targetKey) return;
      const targetDef = getTargetFileDefinition(targetKey);
      if (!targetDef) return;
      const analyzed = analyzeSqliteTable(db, tableName);
      out.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: `${sourceName}::${tableName}`,
        targetKey: targetDef.key,
        targetLabel: targetDef.label,
        uploadedAt: new Date().toISOString(),
        rows: analyzed.rows,
        analysis: analyzed.analysis
      });
    });
    return out.sort((a, b) => getTargetOrder(a.targetKey) - getTargetOrder(b.targetKey));
  } finally {
    db.close();
  }
}

function analyzeSqliteTable(db, tableName) {
  const engine = createStreamingAnalyzer(`sqlite:${tableName}`);
  const safeTable = tableName.replace(/"/g, "\"\"");
  const stmt = db.prepare(`SELECT * FROM "${safeTable}"`);
  try {
    while (stmt.step()) {
      const row = normalizeObjectRowHeaders(stmt.getAsObject());
      row.__sourceTable = tableName;
      engine.ingestRows([row]);
    }
  } finally {
    stmt.free();
  }
  return engine.finalize();
}

async function loadSqlJs() {
  if (typeof initSqlJs !== "function") {
    throw new Error("sql.js script not loaded");
  }
  if (!sqlJsPromise) {
    sqlJsPromise = initSqlJs({
      locateFile: (file) => `${SQL_JS_WASM_BASE}${file}`
    });
  }
  return await sqlJsPromise;
}

function loadPersistedPayload() {
  try {
    const inSession = sessionStorage.getItem(STORAGE_KEY);
    if (inSession) return inSession;
  } catch {
    // Ignore and try local storage.
  }
  try {
    const inLocal = localStorage.getItem(PERSISTENT_STORAGE_KEY);
    if (inLocal) {
      try {
        sessionStorage.setItem(STORAGE_KEY, inLocal);
      } catch {
        // Session restore is best-effort only.
      }
      return inLocal;
    }
  } catch {
    // Ignore storage errors.
  }
  return "";
}

function savePayloadToStorage(payload) {
  const serialized = JSON.stringify(payload);
  let localOk = false;
  let sessionOk = false;
  try {
    localStorage.setItem(PERSISTENT_STORAGE_KEY, serialized);
    localOk = true;
  } catch {
    // Local storage may exceed quota; try smaller tier.
  }
  try {
    sessionStorage.setItem(STORAGE_KEY, serialized);
    sessionOk = true;
  } catch {
    // Session storage may exceed quota; try smaller tier.
  }
  return localOk || sessionOk;
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
    targetKey: dataset.targetKey || "",
    targetLabel: dataset.targetLabel || "",
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

function compactDatasetForSessionTiny(dataset) {
  const analysis = dataset.analysis || {};
  return {
    id: dataset.id,
    name: dataset.name,
    targetKey: dataset.targetKey || "",
    targetLabel: dataset.targetLabel || "",
    uploadedAt: dataset.uploadedAt,
    rows: [],
    analysis: {
      rowCount: analysis.rowCount || 0,
      columns: Array.isArray(analysis.columns) ? analysis.columns.slice(0, 60) : [],
      columnTypes: [],
      quality: [],
      fields: analysis.fields || {},
      totalConversations: analysis.totalConversations || 0,
      statusCount: analysis.statusCount || { resolved: 0, unresolved: 0, escalated: 0 },
      handoverCount: analysis.handoverCount || 0,
      handoverRate: analysis.handoverRate || 0,
      resolutionRate: analysis.resolutionRate || 0,
      handoverRows: [],
      handoverByCategory: analysis.handoverByCategory || {},
      failureSignals: analysis.failureSignals || { repeatedQuestions: 0, negativeSentiment: 0, fallbackResponses: 0, longUnresolved: 0 },
      topProblems: [],
      timeline: [],
      isLargeMode: !!analysis.isLargeMode,
      previewOnly: true,
      notes: ["Session restored in lightweight mode due storage quota."]
    }
  };
}

function hydrateTargetDataset(dataset) {
  if (!dataset || typeof dataset !== "object") return null;
  const byKey = getTargetFileDefinition(dataset.targetKey || "");
  const byName = getTargetFileDefinition(dataset.name || "");
  const targetDef = byKey || byName;
  if (!targetDef) return null;
  return {
    ...dataset,
    targetKey: targetDef.key,
    targetLabel: targetDef.label
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
  if (state.unifiedDataset) return state.unifiedDataset;
  return state.datasets.find((d) => d.id === state.activeDatasetId) || state.datasets[0] || null;
}

function resolveSourceTable(row) {
  return String(row?.__sourceTable || row?.SOURCE_TABLE || row?.source_table || "-");
}

function setStatus(message) {
  const statusEl = byId("statusMessage");
  if (!statusEl) return;
  statusEl.textContent = message || "";
  statusEl.hidden = !message;
}

function openUploadedDbCache() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const request = indexedDB.open(UPLOADED_DB_CACHE.dbName, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(UPLOADED_DB_CACHE.storeName)) {
        db.createObjectStore(UPLOADED_DB_CACHE.storeName);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB open failed"));
  });
}

async function persistUploadedDbCache(bytes, fileName) {
  try {
    const db = await openUploadedDbCache();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(UPLOADED_DB_CACHE.storeName, "readwrite");
      const store = tx.objectStore(UPLOADED_DB_CACHE.storeName);
      const payload = {
        name: String(fileName || "uploaded.db"),
        bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
      };
      store.put(payload, UPLOADED_DB_CACHE.key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("IndexedDB write failed"));
      tx.onabort = () => reject(tx.error || new Error("IndexedDB write aborted"));
    });
    db.close();
  } catch {
    // Cache persistence is best effort only.
  }
}

async function loadUploadedDbCache() {
  const db = await openUploadedDbCache();
  try {
    const data = await new Promise((resolve, reject) => {
      const tx = db.transaction(UPLOADED_DB_CACHE.storeName, "readonly");
      const store = tx.objectStore(UPLOADED_DB_CACHE.storeName);
      const req = store.get(UPLOADED_DB_CACHE.key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error || new Error("IndexedDB read failed"));
    });
    if (!data || !data.bytes) return null;
    return {
      name: String(data.name || "uploaded.db"),
      bytes: new Uint8Array(data.bytes)
    };
  } finally {
    db.close();
  }
}

function clearUploadedDbCache() {
  if (!window.indexedDB) return;
  const request = indexedDB.open(UPLOADED_DB_CACHE.dbName, 1);
  request.onsuccess = () => {
    const db = request.result;
    const tx = db.transaction(UPLOADED_DB_CACHE.storeName, "readwrite");
    tx.objectStore(UPLOADED_DB_CACHE.storeName).delete(UPLOADED_DB_CACHE.key);
    tx.oncomplete = () => db.close();
    tx.onerror = () => db.close();
    tx.onabort = () => db.close();
  };
}

async function copyTextToClipboard(text) {
  const value = String(text ?? "");
  if (!value) return false;
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Fall back to execCommand copy.
    }
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.setAttribute("readonly", "true");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return !!ok;
  } catch {
    return false;
  }
}

function detectInvalidSqliteBuffer(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 16) {
    return "Received empty or invalid database payload";
  }
  const decoder = new TextDecoder("utf-8");
  const headerText = decoder.decode(bytes.subarray(0, Math.min(bytes.length, 120))).trim();
  if (headerText.startsWith("version https://git-lfs.github.com/spec/v1")) {
    return "Git LFS pointer received instead of the real .db file (use /api/live-db with SUPPORT_ANALYTICS_DB_URL in deploy)";
  }
  const sqliteSignature = "SQLite format 3\u0000";
  const rawHeader = decoder.decode(bytes.subarray(0, 16));
  if (rawHeader !== sqliteSignature) {
    return "File is not a valid SQLite database";
  }
  return "";
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

function persistLastActiveTarget() {
  const active = getActiveDataset();
  if (!active || !active.targetKey) return;
  try {
    localStorage.setItem(LAST_ACTIVE_TARGET_KEY, active.targetKey);
  } catch {
    // ignore storage issues
  }
}

function loadLastActiveTarget() {
  try {
    const value = localStorage.getItem(LAST_ACTIVE_TARGET_KEY) || "";
    return value || "";
  } catch {
    return "";
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
    const fromLocal = localStorage.getItem(API_KEY_SESSION_KEY) || "";
    if (fromLocal) return fromLocal;
    const fromSession = sessionStorage.getItem(API_KEY_SESSION_KEY) || "";
    if (fromSession) {
      localStorage.setItem(API_KEY_SESSION_KEY, fromSession);
      return fromSession;
    }
    return "";
  } catch {
    return "";
  }
}

function persistApiKeyForSession(value) {
  const clean = String(value || "").trim();
  try {
    if (!clean) {
      localStorage.removeItem(API_KEY_SESSION_KEY);
      sessionStorage.removeItem(API_KEY_SESSION_KEY);
      return;
    }
    localStorage.setItem(API_KEY_SESSION_KEY, clean);
    sessionStorage.setItem(API_KEY_SESSION_KEY, clean);
  } catch {
    // Ignore storage issues.
  }
}

function clearApiKeyForSession() {
  try {
    localStorage.removeItem(API_KEY_SESSION_KEY);
    sessionStorage.removeItem(API_KEY_SESSION_KEY);
  } catch {
    // Ignore storage issues.
  }
}
