const STORAGE_KEY = "supportAnalyticsSessionV2";
const DARK_MODE_KEY = "supportAnalyticsDarkModeV1";
const PERSISTENT_STORAGE_KEY = "supportAnalyticsPersistentV1";
const UPLOADED_DB_CACHE = {
  dbName: "supportAnalyticsUploadedDbV1",
  storeName: "files",
  key: "latest-uploaded-db"
};
const chartStore = {};
const SQL_JS_WASM_BASE = "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/";
const DEFAULT_DB_SOURCES = [
  "/api/live-db"
];
const SQLITE_TABLE_TO_TARGET = {};

function resolveTableTarget(tableName) {
  if (SQLITE_TABLE_TO_TARGET[tableName]) return SQLITE_TABLE_TO_TARGET[tableName];
  const l = tableName.toLowerCase();
  if (/genesys|gensys/.test(l)) return "genesys";
  if (/cgny|cognogy|cognigy/.test(l)) return "cognigy";
  // Generic chatbot/support table name patterns — return a normalized label
  if (/conversation|gesprek|conv\b/.test(l)) return "conversations";
  if (/\bmessage|bericht|utterance|turn\b/.test(l)) return "messages";
  if (/\bsession\b/.test(l)) return "sessions";
  if (/\bticket\b|\bcase\b|\bincident\b/.test(l)) return "tickets";
  if (/contact|klant|customer/.test(l)) return "contacts";
  if (/intent|categor|classif/.test(l)) return "intents";
  if (/handover|escalat|transfer/.test(l)) return "handovers";
  if (/log|event|activit/.test(l)) return "events";
  if (/analytic|report|stat/.test(l)) return "analytics";
  return tableName;
}
let sqlJsPromise = null;

const MAX_PREVIEW_ROWS = 30000;
const MAX_STORED_ROWS = 30000;
const MAX_UNIQUE_TRACK = 5000;
const MAX_TRACKED_CONVERSATIONS = 400000;
const MAX_HANDOVER_ROWS = 4000;
const LARGE_ROW_THRESHOLD = 250000;
const MAX_SESSION_ROWS = 3000;
const MAX_SESSION_DATASETS = 5;
const CSV_CHUNK_SIZE = 2 * 1024 * 1024; // 2 MB per streaming chunk
const PROGRESS_UPDATE_MS = 400;         // min ms between progress status updates
const DEBOUNCE_MS = 200;                // ms debounce for search/filter inputs
const LEGACY_STORAGE_KEYS = ["supportAnalyticsSessionV1"];
const LANGUAGE_KEY = "supportAnalyticsLanguageV1";
const API_KEY_SESSION_KEY = "supportAnalyticsOpenAiKeySessionV1";
const RULES_STORAGE_KEY = "supportAnalyticsRulesV1";
const LAST_ACTIVE_TARGET_KEY = "supportAnalyticsLastActiveTargetV1";
const TARGET_DATASET_FILES = [];

// Centralized field priority — covers common chatbot/support schema naming conventions.
const DB_FIELD_PRIORITY = {
  conversationId: [
    // Vendor/platform-specific names (kept as recognized patterns)
    "CGNY_SESSION_ID", "CONVERSATION_ID", "CGNY_CONVERSATION_ID",
    // Generic (case-insensitive lookup is done separately via regex)
    "conversation_id", "conversationId", "session_id", "sessionId",
    "chat_id", "chatId", "thread_id", "threadId", "dialog_id", "dialogId",
    "ticket_id", "ticketId", "case_id", "caseId", "contact_id", "contactId",
    "interaction_id", "interactionId", "call_id", "callId",
    "SESSION_ID", "CONTACT_ID", "INTERACTION_ID", "TICKET_ID", "CASE_ID",
    "id", "ID", "Id"
  ],
  userMessage: [
    // Vendor/platform-specific names (kept as recognized patterns)
    "CUSTOMER_INPUT_TEXT_anonymized", "INPUTTEXT_anonymized", "UNRECOGNIZED_QUESTION_anonymized",
    // Generic
    "user_message", "userMessage", "customer_message", "customerMessage",
    "customer_input", "customerInput", "user_input", "userInput",
    "message", "text", "content", "input", "query", "question", "utterance",
    "user_text", "userText", "customer_query", "customerQuery",
    "MESSAGE", "TEXT", "CONTENT", "INPUT", "QUERY", "QUESTION", "UTTERANCE",
    "user_utterance", "USER_MESSAGE", "CUSTOMER_INPUT", "BERICHT", "VRAAG"
  ],
  botResponse: [
    "bot_response", "botResponse", "assistant_response", "assistantResponse",
    "agent_response", "agentResponse", "reply", "response", "answer",
    "bot_message", "botMessage", "bot_text", "botText",
    "BOT_RESPONSE", "RESPONSE", "REPLY", "ANSWER", "ANTWOORD"
  ],
  timestamp: [
    // Vendor/platform-specific names (kept as recognized patterns)
    "TIMESTAMP", "STARTEDAT",
    // Generic
    "created_at", "createdAt", "timestamp", "datetime", "time", "date",
    "created", "start_time", "startTime", "end_time", "endTime",
    "event_time", "eventTime", "occurred_at", "occurredAt",
    "CREATED_AT", "DATE", "TIME", "DATETIME", "STARTED_AT", "ENDED_AT",
    "tijdstip", "datum", "TIJDSTIP", "DATUM"
  ],
  status: [
    // Vendor/platform-specific names (kept as recognized patterns)
    "GOALS", "COMPLETEDGOALSLIST",
    // Generic
    "status", "state", "outcome", "result", "resolution", "resolved",
    "completion", "disposition", "STATUS", "STATE", "OUTCOME", "RESOLUTION",
    "RESOLVED", "COMPLETION", "AFHANDELING", "STATUS_CODE"
  ],
  escalationFlag: [
    // Vendor/platform-specific names (kept as recognized patterns)
    "HANDOVER_QUESTION_anonymized", "GOALS", "COMPLETEDGOALSLIST",
    // Generic
    "escalation", "escalated", "escalation_flag", "escalationFlag",
    "handover", "handover_flag", "handoverFlag", "transfer", "transferred",
    "human_handoff", "humanHandoff", "requires_agent", "requiresAgent",
    "ESCALATION", "HANDOVER", "TRANSFER", "ESCALATED", "HUMAN_NEEDED"
  ],
  category: [
    // Vendor/platform-specific names (kept as recognized patterns)
    "MAIN_INTENT", "INTENT", "ENDPOINTNAME", "ISSUE_CATEGORY", "CATEGORY",
    // Generic
    "category", "intent", "topic", "issue", "type", "label", "subject",
    "classification", "class", "tag", "department", "queue",
    "CATEGORY", "INTENT", "TOPIC", "LABEL", "SUBJECT", "QUEUE",
    "DEPARTMENT", "AFDELING", "ONDERWERP", "CATEGORIE"
  ],
  goalsField: [
    "GOALS", "COMPLETEDGOALSLIST",
    "goals", "completed_goals", "completedGoals", "outcomes",
    "GOALS_COMPLETED", "DOELEN"
  ],
  handoverQuestion: [
    "HANDOVER_QUESTION_anonymized",
    "handover_question", "handoverQuestion", "escalation_reason",
    "escalationReason", "transfer_reason", "transferReason",
    "HANDOVER_REASON", "ESCALATION_REASON"
  ],
  issueText: [
    // Vendor/platform-specific names (kept as recognized patterns)
    "HANDOVER_QUESTION_anonymized", "CUSTOMER_INPUT_TEXT_anonymized",
    "INPUTTEXT_anonymized", "UNRECOGNIZED_QUESTION_anonymized",
    // Generic
    "issue_text", "issueText", "issue_description", "issueDescription",
    "problem", "problem_description", "problemDescription",
    "description", "summary", "note", "comment",
    "DESCRIPTION", "SUMMARY", "PROBLEM", "NOTE", "OMSCHRIJVING"
  ]
};

// Default fallbacks for the intent handover tab when auto-detection finds nothing.
const INTENT_HANDOVER_CONFIG = {
  mainIntentColumn: "category",
  contactIdColumn: "contactId",
  sessionIdColumns: ["conversation_id", "session_id"],
  timestampColumn: "timestamp"
};

function buildIntentHandoverConfig(columns) {
  const lower = (s) => String(s).toLowerCase();
  const find = (patterns) => columns.find((c) => patterns.some((p) => p.test(lower(c))));
  const findMany = (patterns) => columns.filter((c) => patterns.some((p) => p.test(lower(c))));
  return {
    mainIntentColumn:
      find([/^main_intent$/, /^main.*intent$/, /^intent$/, /^category$/, /^categorie$/, /^topic$/, /^label$/, /^classification$/, /^endpoint/, /^queue$/]) ||
      INTENT_HANDOVER_CONFIG.mainIntentColumn,
    contactIdColumn:
      find([/^contactid$/, /^contact_id$/, /^contact$/, /^klant_id$/, /^customer_id$/]) ||
      INTENT_HANDOVER_CONFIG.contactIdColumn,
    sessionIdColumns: (() => {
      const found = findMany([/session.*id/, /conversation.*id/, /conv.*id/, /chat.*id/, /thread.*id/, /dialog.*id/]);
      return found.length ? found : INTENT_HANDOVER_CONFIG.sessionIdColumns;
    })(),
    timestampColumn:
      find([/^timestamp$/, /^created_at$/, /^time$/, /^date$/, /^datetime$/, /^started_at$/, /^occurred_at$/]) ||
      INTENT_HANDOVER_CONFIG.timestampColumn
  };
}

const DEFAULT_RULES = {
  handoverKeywords: [
    // Nederlands — verzoek om medewerker/doorverbinden
    "medewerker", "medewerkers", "adviseur", "adviseurs", "operator", "collega",
    "doorverbinden", "doorverbind", "doorgeschakeld", "doorschakelen", "doorschakelt",
    "terugbellen", "terugbel", "teruggebeld", "telefonisch", "telefoonnummer",
    "klantenservice", "helpdesk", "livechat", "live chat",
    "iemand spreken", "iemand te spreken", "met iemand spreken", "met een persoon",
    "echte medewerker", "menselijke medewerker", "menselijk", "echte persoon", "echt iemand",
    "supervisor", "manager", "leidinggevende",
    "handover", "transfer", "mens", "persoon",
    // Engels
    "agent", "human", "specialist", "live agent", "real person"
  ],
  escalationKeywords: [
    // Nederlands
    "escaleer", "escalatie", "escaleren", "geëscaleerd",
    "handover", "doorverbinden", "doorgeschakeld", "doorschakelen",
    "medewerker", "adviseur", "supervisor", "manager", "leidinggevende",
    "klacht", "klachten", "klagen", "doorverbonden",
    // Engels
    "escalat", "transfer", "human", "agent"
  ],
  fallbackKeywords: [
    // Nederlands
    "ik begrijp uw vraag niet", "ik begrijp uw bericht niet", "dat begrijp ik niet",
    "ik snap uw vraag niet", "ik snap dat niet",
    "ik kan u niet helpen", "ik kan u daar niet mee helpen", "ik kan daar niet mee helpen",
    "kunt u dat anders formuleren", "kunt u uw vraag anders stellen",
    "herformuleer", "herformuleren",
    "niet begrepen", "onbekend", "niet herkend",
    "ik heb uw bericht niet begrepen", "ik heb uw vraag niet begrepen",
    "probeer het opnieuw", "probeer het nog eens",
    "ik weet het niet", "dat weet ik niet",
    "dat kan ik niet beantwoorden", "daar kan ik geen antwoord op geven",
    "mijn excuses, ik begrijp", "sorry, ik begrijp",
    // Engels
    "i do not understand", "i don't understand", "cannot help", "rephrase", "didn't catch", "fallback", "not sure"
  ],
  negativeKeywords: [
    // Nederlands
    "boos", "boze", "kwaad",
    "gefrustreerd", "frustrerend", "frustratie",
    "teleurgesteld", "teleurstellend", "teleurstelling",
    "slecht", "verschrikkelijk", "vreselijk", "afschuwelijk",
    "haat", "haten", "heb er genoeg van",
    "werkt niet", "doet het niet", "nog steeds kapot", "nog steeds niet opgelost",
    "klacht", "klagen", "ontevreden",
    "geïrriteerd", "irritant", "onacceptabel", "belachelijk", "scandaleus",
    "schande", "walgelijk",
    // Engels
    "angry", "frustrat", "upset", "bad", "terrible", "hate", "not working", "still broken", "complain", "annoyed"
  ],
  longUnresolvedTurns: 8
};

const ISSUE_STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "you", "your", "are", "can", "not", "have", "has", "how", "what", "why",
  "een", "het", "deze", "die", "dat", "voor", "van", "met", "naar", "over", "mijn", "jouw", "kan", "kun", "niet", "geen", "heb",
  "heeft", "hoe", "wat", "waarom", "graag", "vraag", "vragen", "klant", "customer", "input", "text", "anonymized"
]);

const KNOWN_ISSUE_CATEGORIES = new Set([
  "billing",
  "payment",
  "contract",
  "account",
  "login",
  "outage",
  "technical",
  "order",
  "shipping",
  "return",
  "complaint",
  "subscription",
  "cancellation",
  "refund"
]);

const I18N = {
  en: {
    appTitle: "Support Analytics Dashboard",
    appSubtitle: "Conversation performance, handovers, failures, and issue insights",
    languageLabel: "Language",
    quickSwapBtn: "Quick Swap Dataset",
    quickSwapChooseLabel: "Choose dataset...",
    targetFilesTitle: "Target files",
    uploadLabel: "Upload database (.db)",
    analyzeUploadBtn: "Analyze Upload",
    aiToggle: "Enable AI-powered analysis (OpenAI GPT-4o)",
    aiControlTitle: "AI Controls",
    openAiKeyPlaceholder: "OpenAI API Key (optional if AI is off)",
    runAiBtn: "Run AI Enrichment",
    clearApiKeyBtn: "Clear API Key",
    clearDataBtn: "Clear Data",
    activeDatasetLabel: "Active dataset",
    persistLabel: "Stored locally in this browser",
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
    topHandoverCategoriesTitle: "Top handover categories",
    intentHandoversTitle: "MAIN_INTENT Handover Overview",
    intentQueryTitle: "Query",
    intentQuerySelectLabel: "Select",
    intentQueryDistinctLabel: "Distinct",
    intentQueryGroupByLabel: "Group by",
    intentQueryAggLabel: "Agg",
    intentQueryWhereLabel: "Where",
    intentQueryWhereValuePlaceholder: "Value...",
    intentQueryLimitLabel: "Limit",
    intentQueryRunBtn: "Run",
    intentQuerySubtitle: "Filter and aggregate MAIN_INTENT handovers.",
    intentQueryDistinctHint: "Deduplicate selected rows",
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
    handoverIssueColumn: "Issue",
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
    statusQuickSwapNoDataset: "Upload at least one dataset first.",
    statusQuickSwapDone: "Switched to: {name}.",
    statusNeedDbFile: "Select a .db database file.",
    statusNoValidFiles: "No valid database selected.",
    statusAnalyzingFile: "Analyzing {name}...",
    statusReadingFile: "Reading {name}: {pct}%",
    statusOpeningDb: "Opening database {name}…",
    statusAnalyzingRows: "Analyzing {name}: {rows} rows processed…",
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
    aiRunning: "Running GPT-4o enrichment...",
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
    problemDetailTitle: "Conversation Detail",
    compareModeAll: "All datasets",
    tabFrustration: "Frustration & Handovers",
    frustrationTitle: "Frustration & Handover Correlation",
    frustrationSubtitle: "Per category: how many frustration signals (negative, fallback, repeated, long unresolved) and how does that relate to handovers? The correlation score combines both (60% frustration%, 40% handover%). Red = high risk.",
    frustrationMinVolumeLabel: "Min. volume",
    frustrationSignalLabel: "Signal",
    frustrationSortLabel: "Sort by",
    frustrationSignalAll: "All signals",
    frustrationSignalNegative: "Negative sentiment",
    frustrationSignalFallback: "Fallback (bot didn’t understand)",
    frustrationSignalRepeated: "Repeated questions",
    frustrationSignalHandover: "Had a handover",
    frustrationSortCorrelation: "Correlation score (high→low)",
    frustrationSortFrustrationPct: "Frustration %",
    frustrationSortHandoverPct: "Handover %",
    frustrationSortVolume: "Volume",
    frustrationSortHandoverCount: "Number of handovers",
    frustrationBubbleTitle: "Frustration % vs Handover % per category",
    frustrationBubbleSubtitle: "Circle size = volume. Red = high risk, orange = medium, green = low.",
    frustrationRankedTitle: "Categories ranked by risk",
    frustrationNoData: "No categories found with current filters.",
    riskHigh: "High risk",
    riskMedium: "Medium",
    riskLow: "Low",
    colCategory: "Category",
    colVolume: "Volume",
    colNegative: "Negative",
    colFallback: "Fallback",
    colRepeated: "Repeated",
    colLongOpen: "Long open",
    colHandovers: "Handovers",
    colHandoverPct: "Handover %",
    colFrustrationPct: "Frustration %",
    colCorrelationScore: "Correlation score",
    colRisk: "Risk",
    hscAnalysisLabel: "Handover Analysis",
    hscTabOverview: "Overview",
    hscTabConversations: "Conversations",
    hscTabSignals: "Signal Analysis",
    hscTabTimeline: "Timeline",
    hscStatHandovers: "Handovers",
    hscStatShare: "Share",
    hscStatAvgTurns: "Avg. turns",
    hscStatFirstHandover: "First handover",
    hscStatLastHandover: "Last handover",
    hscStatSources: "Data sources",
    hscSignalsTitle: "Handover signals",
    hscSourceTitle: "Source per table",
    hscTopIssuesTitle: "Top issues (frequency)",
    hscTopIssuesEmpty: "No issue data.",
    hscSignalsEmpty: "No signal data.",
    hscEnrichedNote: "Enriched with {n} columns from database ({m} conversations found in stored rows).",
    hscNoConversations: "No conversations.",
    hscMoreRows: "{n} additional rows not shown.",
    hscReasonKeyword: "Handover keyword",
    hscReasonEscalated: "Escalated",
    hscReasonFallbackRepeated: "Fallback + repeated",
    hscReasonUnknown: "Unknown",
    hscCausesTitle: "Handover causes",
    hscLongestTitle: "Top 10 longest conversations",
    hscTimelineTitle: "Handovers per day",
    hscTimelineEmpty: "No timestamp data available.",
    hscClickDetails: "Click for details ›",
    hscCategoryNotFound: "No data found for this category. Try refreshing.",
    hscConvHeader: "ID",
    hscTimeHeader: "Time",
    hscReasonHeader: "Reason",
    hscTurnsHeader: "Turns",
    hscIssueHeader: "Issue",
    hscSourceHeader: "Source",
    hscConvIdHeader: "Conversation ID",
    hscSignalHeader: "Signal",
    hscCountHeader: "Count",
    hscPctHeader: "%",
    hscProblemHeader: "Issue",
    ihKpiTotalLabel: "Handover rows found",
    ihKpiDatasetsLabel: "Datasets searched",
    ihKpiConversationsLabel: "Unique conversations",
    ihAllDatasetsLabel: "All datasets combined ({n})",
    ihAllTablesOption: "All tables",
    ihAllCategoriesOption: "All categories",
    ihSearchLabel: "Search",
    ihSourceLabel: "Source",
    ihCategoryLabel: "Category",
    ihDatasetLabel: "Dataset",
    ihRowsTitle: "Handover rows",
    ihNoDatasets: "No datasets loaded. Upload a database first via the Database Upload tab.",
    ihNoHandoversFound: "No handover rows found",
    ihNoHandoversHint: "Detected signals: text-intent (handover, escalation, transfer…), boolean flags (is_handover=1) and handover reason FKs (handover_reason_id≠null).",
    ihNoHandoversDatasets: "Searched dataset(s):",
    ihNoHandoversChoose: "Choose a different dataset or verify the correct table is loaded.",
    ihSummaryText: "{shown} of {total} handover rows",
    ihPageInfo: "Page {page} of {total}",
    ihNoResults: "No rows found for this search.",
    dbLoadingTitle: "Loading database…",
    dbLoadingWait: "Please wait, this may take a while.",
    dbLoadingHint: "The browser processes large files all at once. The page will respond again once analysis is complete.",
    overlayReadingFile: "Reading file: {name}…",
    overlayReloadingDb: "Reloading previous database: {name}…",
    largeFileWarning: "This file is {mb} MB. Loading in the browser may take 30 seconds to several minutes and temporarily freeze the tab.\n\nContinue?",
    exportCsvBtn: "Export CSV",
    notSavedHint: "Not saved — re-upload each session",
    targetFilesHint: "Only matching tables are analyzed from the uploaded database.",
    hscDateHeader: "Date",
    hscCopyHint: "Click to copy",
    frustrationSignalLongOpen: "Long unresolved",
    ihRowsSuffix: "rows",
    ihColsCount: "{n} columns",
    ihCatColLabel: "category column",
    ihFlagColsLabel: "flag columns",
    ihFkColLabel: "handover FK",
    ihNoSignals: "no handover signals detected",
    darkModeLabel: "Dark mode",
    lightModeLabel: "Light mode",
    exportChartLabel: "Export PNG",
    confirmTitle: "Confirm",
    confirmBtn: "Confirm",
    cancelBtn: "Cancel",
    intentHandoverSearchPlaceholder: "Search by ID, contact, category or source...",
    aiToggle: "Enable AI analysis (Claude)",
    openAiKeyPlaceholder: "Anthropic API Key (optional if AI is off)",
    aiNeedKey: "Enter an Anthropic API key to run AI enrichment.",
    aiRunning: "Running Claude AI enrichment...",
    aiNetworkHelp: "Network error. If deployed on Vercel, set ANTHROPIC_API_KEY and use the same-origin /api/ai-enrich endpoint.",
    aiKeySecurityNote: "API key is stored in browser session only and never sent to our servers."
  },
  nl: {
    appTitle: "Support Analyse Dashboard",
    appSubtitle: "Gespreksperformance, overdrachten, fouten en issue-inzichten",
    languageLabel: "Taal",
    quickSwapBtn: "Snel wisselen dataset",
    quickSwapChooseLabel: "Kies dataset...",
    targetFilesTitle: "Doelbestanden",
    uploadLabel: "Upload database (.db)",
    analyzeUploadBtn: "Upload analyseren",
    aiToggle: "AI-analyse inschakelen (OpenAI GPT-4o)",
    aiControlTitle: "AI Bediening",
    openAiKeyPlaceholder: "OpenAI API sleutel (optioneel als AI uit staat)",
    runAiBtn: "AI verrijking starten",
    clearApiKeyBtn: "API sleutel wissen",
    clearDataBtn: "Data wissen",
    activeDatasetLabel: "Actieve dataset",
    persistLabel: "Lokaal opgeslagen in deze browser",
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
    topHandoverCategoriesTitle: "Top overdrachtscategorieen",
    intentHandoversTitle: "MAIN_INTENT Handover Overzicht",
    intentQueryTitle: "Query",
    intentQuerySelectLabel: "Select",
    intentQueryDistinctLabel: "Distinct",
    intentQueryGroupByLabel: "Group by",
    intentQueryAggLabel: "Agg",
    intentQueryWhereLabel: "Waar",
    intentQueryWhereValuePlaceholder: "Waarde...",
    intentQueryLimitLabel: "Limiet",
    intentQueryRunBtn: "Uitvoeren",
    intentQuerySubtitle: "Filter en groepeer MAIN_INTENT-handovers.",
    intentQueryDistinctHint: "Verwijder dubbele rijen",
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
    handoverIssueColumn: "Onderwerp",
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
    statusQuickSwapNoDataset: "Upload eerst minimaal één dataset.",
    statusQuickSwapDone: "Gewisseld naar: {name}.",
    statusNeedDbFile: "Selecteer een .db databasebestand.",
    statusNoValidFiles: "Geen geldige database geselecteerd.",
    statusAnalyzingFile: "Bezig met analyseren van {name}...",
    statusReadingFile: "{name} lezen: {pct}%",
    statusOpeningDb: "Database {name} openen…",
    statusAnalyzingRows: "{name} analyseren: {rows} rijen verwerkt…",
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
    aiRunning: "GPT-4o verrijking wordt uitgevoerd...",
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
    problemDetailTitle: "Gespreksdetail",
    compareModeAll: "Alle datasets",
    tabFrustration: "Frustratie & Handovers",
    frustrationTitle: "Frustratie & Handover Correlatie",
    frustrationSubtitle: "Per categorie: hoeveel frustratie-signalen (negatief, fallback, herhalingen, lang onopgelost) en hoe verhoudt dat zich tot het aantal handovers? De correlatie score combineert beide (60% frustratie%, 40% handover%). Rood = hoog risico.",
    frustrationMinVolumeLabel: "Min. volume",
    frustrationSignalLabel: "Signaal",
    frustrationSortLabel: "Sorteer op",
    frustrationSignalAll: "Alle signalen",
    frustrationSignalNegative: "Negatief sentiment",
    frustrationSignalFallback: "Fallback (bot begreep niet)",
    frustrationSignalRepeated: "Herhaalde vragen",
    frustrationSignalHandover: "Heeft handover gehad",
    frustrationSortCorrelation: "Correlatie score (hoog→laag)",
    frustrationSortFrustrationPct: "Frustratie %",
    frustrationSortHandoverPct: "Handover %",
    frustrationSortVolume: "Volume",
    frustrationSortHandoverCount: "Aantal handovers",
    frustrationBubbleTitle: "Frustratie % vs Handover % per categorie",
    frustrationBubbleSubtitle: "Grootte van de cirkel = volume. Rood = hoog risico, oranje = gemiddeld, groen = laag.",
    frustrationRankedTitle: "Categorieën gerangschikt op risico",
    frustrationNoData: "Geen categorieën gevonden met de huidige filters.",
    riskHigh: "Hoog risico",
    riskMedium: "Gemiddeld",
    riskLow: "Laag",
    colCategory: "Categorie",
    colVolume: "Volume",
    colNegative: "Negatief",
    colFallback: "Fallback",
    colRepeated: "Herhaald",
    colLongOpen: "Lang open",
    colHandovers: "Handovers",
    colHandoverPct: "Handover %",
    colFrustrationPct: "Frustratie %",
    colCorrelationScore: "Correlatie score",
    colRisk: "Risico",
    hscAnalysisLabel: "Overdrachtsanalyse",
    hscTabOverview: "Overzicht",
    hscTabConversations: "Gesprekken",
    hscTabSignals: "Signaalanalyse",
    hscTabTimeline: "Tijdlijn",
    hscStatHandovers: "Overdrachten",
    hscStatShare: "Aandeel",
    hscStatAvgTurns: "Gem. beurten",
    hscStatFirstHandover: "Eerste overdracht",
    hscStatLastHandover: "Laatste overdracht",
    hscStatSources: "Databronnen",
    hscSignalsTitle: "Overdrachtssignalen",
    hscSourceTitle: "Bron per tabel",
    hscTopIssuesTitle: "Top problemen (frequentie)",
    hscTopIssuesEmpty: "Geen probleemdata.",
    hscSignalsEmpty: "Geen signaaldata.",
    hscEnrichedNote: "Aangevuld met {n} kolommen uit de database ({m} gesprekken gevonden in opgeslagen rijen).",
    hscNoConversations: "Geen gesprekken.",
    hscMoreRows: "{n} extra rijen niet getoond.",
    hscReasonKeyword: "Handover keyword",
    hscReasonEscalated: "Geëscaleerd",
    hscReasonFallbackRepeated: "Fallback + herhaling",
    hscReasonUnknown: "Onbekend",
    hscCausesTitle: "Overdrachtsoorzaken",
    hscLongestTitle: "Top 10 langste gesprekken",
    hscTimelineTitle: "Overdrachten per dag",
    hscTimelineEmpty: "Geen tijdstempeldata beschikbaar.",
    hscClickDetails: "Klik voor details ›",
    hscCategoryNotFound: "Geen data gevonden voor deze categorie. Probeer de pagina te vernieuwen.",
    hscConvHeader: "ID",
    hscTimeHeader: "Tijdstip",
    hscReasonHeader: "Reden",
    hscTurnsHeader: "Beurten",
    hscIssueHeader: "Probleem",
    hscSourceHeader: "Bron",
    hscConvIdHeader: "Gesprek ID",
    hscSignalHeader: "Signaal",
    hscCountHeader: "Aantal",
    hscPctHeader: "%",
    hscProblemHeader: "Probleem",
    ihKpiTotalLabel: "Handover-rijen gevonden",
    ihKpiDatasetsLabel: "Datasets doorzocht",
    ihKpiConversationsLabel: "Unieke gesprekken",
    ihAllDatasetsLabel: "Alle datasets gecombineerd ({n})",
    ihAllTablesOption: "Alle tabellen",
    ihAllCategoriesOption: "Alle categorieën",
    ihSearchLabel: "Zoeken",
    ihSourceLabel: "Bron",
    ihCategoryLabel: "Categorie",
    ihDatasetLabel: "Dataset",
    ihRowsTitle: "Handover-rijen",
    ihNoDatasets: "Geen datasets geladen. Upload eerst een database via het tabblad Database Upload.",
    ihNoHandoversFound: "Geen handover-rijen gevonden",
    ihNoHandoversHint: "Gedetecteerde signalen: tekst-intent (handover, escalatie, transfer…), boolean vlaggen (is_handover=1) en handover-reden FK’s (handover_reason_id≠null).",
    ihNoHandoversDatasets: "Doorzochte dataset(s):",
    ihNoHandoversChoose: "Kies een andere dataset of controleer of de juiste tabel is geladen.",
    ihSummaryText: "{shown} van {total} handover-rijen",
    ihPageInfo: "Pagina {page} van {total}",
    ihNoResults: "Geen rijen gevonden voor deze zoekopdracht.",
    dbLoadingTitle: "Database laden…",
    dbLoadingWait: "Even geduld, dit kan even duren.",
    dbLoadingHint: "De browser verwerkt grote bestanden in één keer. De pagina reageert weer zodra de analyse klaar is.",
    overlayReadingFile: "Bestand lezen: {name}…",
    overlayReloadingDb: "Vorige database herladen: {name}…",
    largeFileWarning: "Dit bestand is {mb} MB groot. Het laden in de browser kan 30 seconden tot meerdere minuten duren en de pagina tijdelijk onresponsief maken.\n\nDoorgaan?",
    exportCsvBtn: "Exporteer CSV",
    notSavedHint: "Niet opgeslagen — upload elke sessie opnieuw",
    targetFilesHint: "Alle tabellen uit de geüploade database worden geanalyseerd.",
    hscDateHeader: "Datum",
    hscCopyHint: "Klik om te kopiëren",
    frustrationSignalLongOpen: "Lang onopgelost",
    ihRowsSuffix: "rijen",
    ihColsCount: "{n} kolommen",
    ihCatColLabel: "categorie-kolom",
    ihFlagColsLabel: "vlag-kolommen",
    ihFkColLabel: "handover-FK",
    ihNoSignals: "geen handover-signalen herkend",
    darkModeLabel: "Donkere modus",
    lightModeLabel: "Lichte modus",
    exportChartLabel: "Exporteer PNG",
    confirmTitle: "Bevestigen",
    confirmBtn: "Bevestigen",
    cancelBtn: "Annuleren",
    intentHandoverSearchPlaceholder: "Zoek op ID, contact, categorie of bron...",
    aiToggle: "AI-analyse inschakelen (Claude)",
    openAiKeyPlaceholder: "Anthropic API-sleutel (optioneel als AI uit staat)",
    aiNeedKey: "Voer een Anthropic API-sleutel in om AI-verrijking te starten.",
    aiRunning: "Claude AI-verrijking wordt uitgevoerd...",
    aiNetworkHelp: "Netwerkfout. Bij Vercel: zet ANTHROPIC_API_KEY en gebruik dezelfde-origin /api/ai-enrich endpoint.",
    aiKeySecurityNote: "API-sleutel wordt alleen in de browsersessie opgeslagen en nooit naar onze servers verzonden."
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
    dbValue: "",
    page: 1,
    pageSize: 100,
    lastChartDatasetId: null
  },
  intentHandoverView: {
    search: "",
    page: 1,
    pageSize: 20
  },
  intentQuery: {
    select: ["contactId", "conversationId", "timestamp", "stepsToHandover", "sourceTable"],
    distinct: false,
    groupBy: [],
    agg: "count",
    whereColumn: "contactId",
    whereOp: "contains",
    whereValue: "",
    limit: 500
  },
  intentHandoverModalItems: [],
  problemModalItems: [],
  comparison: {
    mode: "all",
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

window.addEventListener("unhandledrejection", (event) => {
  handleError(event.reason, "unhandled");
  event.preventDefault();
});

document.addEventListener("DOMContentLoaded", () => {
  init().catch((error) => handleError(error, "init"));
});

async function init() {
  cleanupLegacyStorage();
  loadSession();
  state.language = loadLanguage();
  loadRules();
  applyDarkMode(loadDarkMode());
  bindEvents();
  applyTranslations();
  hydrateApiKeyInput();
  populateRulesEditor();
  renderDatasetSelect();
  if (state.datasets.length) {
    setDashboardLocked(false);
    activateTab("overviewTab");
    setStatus("");
    return;
  }
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
  on("dbUploadAnalyzeBtn", "click", () => handleDbUpload("dbUploadInput"));
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
  on("clearDataBtn", "click", clearData);
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
  on("problemSearchInput", "input", debounce((e) => {
    state.problemView.search = String(e.target.value || "").trim().toLowerCase();
    renderProblems();
  }, DEBOUNCE_MS));
  on("handoverSearchInput", "input", debounce((e) => {
    state.handoverView.search = String(e.target.value || "").trim().toLowerCase();
    state.handoverView.page = 1;
    renderHandovers();
  }, DEBOUNCE_MS));
  on("handoverReasonFilter", "change", (e) => {
    state.handoverView.reason = String(e.target.value || "all");
    state.handoverView.page = 1;
    renderHandovers();
  });
  on("handoverDbColumn", "change", (e) => {
    state.handoverView.dbColumn = String(e.target.value || "conversationId");
    state.handoverView.page = 1;
    updateHandoverValueSuggestions();
    renderHandovers();
  });
  on("handoverDbOp", "change", (e) => {
    state.handoverView.dbOp = String(e.target.value || "contains");
    state.handoverView.page = 1;
    renderHandovers();
  });
  on("handoverDbValue", "input", debounce((e) => {
    state.handoverView.dbValue = String(e.target.value || "");
    state.handoverView.page = 1;
    renderHandovers();
  }, DEBOUNCE_MS));
  on("frustrationMinVolume", "input", debounce(() => renderFrustrationTab(), DEBOUNCE_MS));
  on("frustrationSort", "change", () => renderFrustrationTab());
  on("frustrationSignalFilter", "change", () => renderFrustrationTab());
  on("tableFilterInput", "input", debounce((e) => {
    state.table.filter = String(e.target.value || "").trim().toLowerCase();
    state.table.page = 1;
    renderDataTable();
  }, DEBOUNCE_MS));
  on("tablePageSizeSelect", "change", (e) => {
    state.table.pageSize = Math.max(1, Number(e.target.value || 25));
    state.table.page = 1;
    renderDataTable();
  });
  on("tablePrevBtn", "click", () => {
    state.table.page = Math.max(1, state.table.page - 1);
    renderDataTable();
  });
  on("tableNextBtn", "click", () => {
    state.table.page += 1;
    renderDataTable();
  });
  on("intentHandoverSearchInput", "input", debounce((e) => {
    state.intentHandoverView.search = String(e.target.value || "").trim().toLowerCase();
    state.intentHandoverView.page = 1;
    renderIntentHandovers();
  }, DEBOUNCE_MS));
  on("intentQueryRunBtn", "click", () => renderIntentQueryResults());
  on("intentQueryDistinct", "change", (e) => {
    state.intentQuery.distinct = !!e.target.checked;
  });
  on("intentQueryAgg", "change", (e) => {
    state.intentQuery.agg = String(e.target.value || "count");
  });
  on("intentQueryWhereColumn", "change", (e) => {
    state.intentQuery.whereColumn = String(e.target.value || "");
    updateIntentWhereValueSuggestions();
  });
  on("intentQueryWhereOp", "change", (e) => {
    state.intentQuery.whereOp = String(e.target.value || "contains");
  });
  on("intentQueryWhereValue", "input", (e) => {
    state.intentQuery.whereValue = String(e.target.value || "");
  });
  on("intentQueryLimit", "change", (e) => {
    state.intentQuery.limit = Math.max(1, Number(e.target.value || 500));
  });
  on("intentQueryWhereValue", "focus", () => updateIntentWhereValueSuggestions());
  on("handoverDbValue", "focus", () => updateHandoverValueSuggestions());
  bindMultiSelect("intentSelect", {
    buttonId: "intentSelectBtn",
    panelId: "intentSelectPanel",
    get: () => state.intentQuery.select,
    set: (values) => { state.intentQuery.select = values; }
  });
  bindMultiSelect("intentGroup", {
    buttonId: "intentGroupBtn",
    panelId: "intentGroupPanel",
    get: () => state.intentQuery.groupBy,
    set: (values) => { state.intentQuery.groupBy = values; }
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
  on("hscModalCloseBtn", "click", closeHandoverCategoryModal);
  on("hscModalBackdrop", "click", closeHandoverCategoryModal);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeProblemModal();
      closeIntentHandoverModal();
      closeHandoverCategoryModal();
    }
  });
  on("compareModeSelect", "change", (e) => {
    state.comparison.mode = e.target.value === "pair" ? "pair" : "all";
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

  // Dark mode toggle
  on("darkModeToggle", "click", toggleDarkMode);

  // Confirm modal buttons
  on("confirmModalOkBtn", "click", () => closeConfirmModal(true));
  on("confirmModalCancelBtn", "click", () => closeConfirmModal(false));
  on("confirmModalBackdrop", "click", () => closeConfirmModal(false));

  // CSV export buttons
  on("exportDataTableCsvBtn", "click", exportActiveDataTableCsv);
  on("exportHandoversCsvBtn", "click", exportHandoversCsv);
  on("exportIntentHandoverCsvBtn", "click", exportIntentHandoversCsv);

  // Keyboard shortcuts: Alt+1..9 for tabs, Escape closes confirm modal
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && byId("confirmModal") && !byId("confirmModal").hidden) {
      closeConfirmModal(false);
      return;
    }
    if (!e.altKey || e.shiftKey || e.ctrlKey || e.metaKey) return;
    const TAB_IDS = [
      "overviewTab", "dataExplorerTab", "handoversTab", "intentHandoversTab",
      "problemsTab", "frustrationTab", "aiAnalysisTab", "rulesTab", "comparisonTab"
    ];
    const idx = Number(e.key) - 1;
    if (idx >= 0 && idx < TAB_IDS.length && !byId("dashboardMain")?.hidden) {
      e.preventDefault();
      activateTab(TAB_IDS[idx]);
    }
  });
}

function bindMultiSelect(key, { buttonId, panelId, get, set }) {
  const btn = byId(buttonId);
  const panel = byId(panelId);
  if (!btn || !panel) return;

  const close = () => { panel.hidden = true; };
  btn.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
  });

  document.addEventListener("click", (e) => {
    if (!panel.hidden && !panel.contains(e.target) && e.target !== btn) close();
  });

  panel.addEventListener("change", () => {
    const values = Array.from(panel.querySelectorAll("input[type='checkbox'][data-ms-opt='1']"))
      .filter((i) => i.checked)
      .map((i) => String(i.value));
    set(values);
    updateIntentQuerySummary();
  });
}

function setDatalistOptions(datalistId, values) {
  const el = byId(datalistId);
  if (!el) return;
  const unique = Array.from(new Set((values || []).map((v) => String(v ?? "").trim()).filter(Boolean)));
  el.innerHTML = unique.map((v) => `<option value="${escapeHtml(v)}"></option>`).join("");
}

function collectDistinctValues(rows, column, limit = 200) {
  const col = String(column || "");
  if (!col) return [];
  const out = [];
  const seen = new Set();
  for (let i = 0; i < rows.length; i += 1) {
    const value = rows[i]?.[col];
    const s = String(value ?? "").trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

function updateHandoverValueSuggestions() {
  const dataset = getActiveDataset();
  if (!dataset) return;
  const a = dataset.analysis;
  const rows = (a?.handoverRows || []).map((r) => ({ ...r, category: mapIssueLabel(r.category, a) }));
  const col = String(state.handoverView.dbColumn || "");
  setDatalistOptions("handoverDbValueOptions", collectDistinctValues(rows, col, 200));
}

function updateIntentWhereValueSuggestions() {
  const dataset = getActiveDataset();
  if (!dataset) return;
  const base = collectMainIntentHandoverRows(dataset.rows || []);
  const col = String(state.intentQuery.whereColumn || "");
  setDatalistOptions("intentQueryWhereValueOptions", collectDistinctValues(base, col, 200));
}

function setDashboardLocked(locked) {
  const landing = byId("landingPage");
  const tabs = byId("dashboardTabs");
  const controls = byId("dashboardControls");
  const main = byId("dashboardMain");
  const isLocked = !!locked;
  if (landing) landing.hidden = !isLocked;
  if (tabs) tabs.hidden = isLocked;
  if (controls) controls.hidden = isLocked;
  if (main) main.hidden = isLocked;
}

function activateTab(tabId) {
  state.activeTabId = tabId || "overviewTab";
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tabId));
  document.querySelectorAll(".tab-content").forEach((t) => t.classList.toggle("active", t.id === tabId));
  renderActiveTab(state.activeTabId);
}

async function clearData() {
  const ok = await showConfirm(t("clearConfirm"));
  if (!ok) return;
  state.datasets = [];
  state.unifiedDataset = null;
  state.activeDatasetId = null;
  state.comparison = { mode: "all", left: "", right: "" };
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
  const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB browser practical limit
  if (file.size > MAX_UPLOAD_BYTES) {
    setStatus(t("statusUploadFailed", { error: "File exceeds the 2 GB upload limit" }));
    return;
  }

  // Warn the user before loading very large files — sql.js loads the entire file
  // into the browser's Wasm heap, which can take 30-120+ seconds and freeze the tab.
  const LARGE_FILE_WARN_BYTES = 150 * 1024 * 1024; // 150 MB
  if (file.size > LARGE_FILE_WARN_BYTES) {
    const sizeMb = Math.round(file.size / (1024 * 1024));
    const ok = await showConfirm(t("largeFileWarning", { mb: sizeMb }));
    if (!ok) return;
  }

  setStatus(t("statusAnalyzingFile", { name: file.name }));
  try {
    showDbLoadingOverlay(t("overlayReadingFile", { name: file.name }));
    const bytes = await readFileWithProgress(file);
    const sqliteError = detectInvalidSqliteBuffer(bytes);
    if (sqliteError) {
      hideDbLoadingOverlay();
      setStatus(t("statusUploadFailed", { error: sqliteError }));
      return;
    }
    const datasets = await analyzeDbBufferToDatasets(bytes, file.name);
    if (!datasets.length) {
      hideDbLoadingOverlay();
      setStatus(t("statusNoValidFiles"));
      return;
    }
    const CACHE_LIMIT_BYTES = 200 * 1024 * 1024; // skip IndexedDB cache for files > 200 MB
    if (file.size <= CACHE_LIMIT_BYTES) {
      await persistUploadedDbCache(bytes, file.name);
    }
    state.datasets = datasets;
    rebuildUnifiedDataset();
    persistLastActiveTarget();
    saveSession();
    hideDbLoadingOverlay();
    setDashboardLocked(false);
    activateTab("overviewTab");
    renderDatasetSelect();
    renderAll();
    setStatus(t("statusLoadedFromDb", { count: datasets.length }));
    renderDbUploadTab();
  } catch (error) {
    handleError(error, "upload");
  }
}

function readFileWithProgress(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    let lastPct = -1;
    reader.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const pct = Math.round((e.loaded / e.total) * 100);
      if (pct !== lastPct) {
        lastPct = pct;
        setStatus(t("statusReadingFile", { name: file.name, pct }));
      }
    };
    reader.onload = () => resolve(new Uint8Array(reader.result));
    reader.onerror = () => reject(reader.error || new Error("File read failed"));
    reader.readAsArrayBuffer(file);
  });
}

function parseAndAnalyzeCsvStream(file) {
  return new Promise((resolve, reject) => {
    const engine = createStreamingAnalyzer(file.name);
    let lastProgressTs = 0;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      worker: true,
      chunkSize: CSV_CHUNK_SIZE,
      chunk(results) {
        const rows = normalizeRows(results.data);
        engine.ingestRows(rows);
        const now = Date.now();
        if (now - lastProgressTs > PROGRESS_UPDATE_MS) {
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
      timelineMap: {},
      negativeByCategory: {},
      fallbackByCategory: {},
      repeatedByCategory: {},
      longUnresolvedByCategory: {},
      convCountByCategory: {}
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

  const prevColCount = ctx.columns.size;
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

  // Only re-detect fields when new columns appear (expensive regex scan).
  if (ctx.columns.size !== prevColCount || !ctx.fields) {
    ctx.fields = detectConversationFields(Array.from(ctx.columns));
  }

  const text = Object.values(row).join(" ").toLowerCase();
  const rowFields = ctx.fields;
  const issueText = deriveIssueText(row, rowFields, text);
  const category = deriveIssueCategory(row, rowFields, text);
  if (!rowFields || !rowFields.conversationId) {
    const temp = buildRowAsConversation(row, text, category, issueText, rowFields);
    applyConversationSummary(ctx.aggregate, temp);
    return;
  }

  const convKey = String(row[rowFields.conversationId] ?? `row-${ctx.rowCount}`);
  let conv = ctx.conversationStats.get(convKey);
  if (!conv) {
    if (!ctx.conversationOverflow && ctx.conversationStats.size >= MAX_TRACKED_CONVERSATIONS) {
      ctx.conversationOverflow = true;
    }
    if (ctx.conversationOverflow) {
      ctx.convOverflowDropped += 1;
      const temp = buildRowAsConversation(row, text, category, issueText, rowFields);
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
      issueText,
      sourceTable: resolveSourceTable(row),
      firstTime: inferRowTime(row, rowFields),
      lastUserMessage: "",
      preview: extractConversationPreview(row, rowFields, text)
    };
    ctx.conversationStats.set(convKey, conv);
  }

  conv.turns += 1;
  conv.category = chooseBetterCategory(conv.category, category);
  conv.issueText = chooseBetterIssueText(conv.issueText, issueText);
  const goalText = extractGoalText(row, rowFields);
  conv.resolved = conv.resolved || detectResolvedSignal(text, goalText);
  conv.escalated = conv.escalated || detectEscalationSignal(text, goalText, row, rowFields);
  conv.handoverKeyword = conv.handoverKeyword || state.regexes.handoverRegex.test(text);
  conv.negative = conv.negative || state.regexes.negativeRegex.test(text);
  conv.fallback = conv.fallback || detectFallbackSignal(text, row, rowFields);
  if (rowFields.userMessage) {
    const msg = normalizeSentence(row[rowFields.userMessage]);
    if (msg) {
      if (conv.lastUserMessage && conv.lastUserMessage === msg) {
        conv.repeated = true;
      }
      conv.lastUserMessage = msg;
    }
  }
  enrichConversationPreview(conv.preview, row, rowFields, text);
}

function buildRowAsConversation(row, text, category, issueText, fields) {
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
    issueText,
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

  const cat = conv.category || "Overig";
  aggregate.convCountByCategory[cat] = (aggregate.convCountByCategory[cat] || 0) + 1;
  if (conv.negative) aggregate.negativeByCategory[cat] = (aggregate.negativeByCategory[cat] || 0) + 1;
  if (conv.fallback) aggregate.fallbackByCategory[cat] = (aggregate.fallbackByCategory[cat] || 0) + 1;
  if (conv.repeated) aggregate.repeatedByCategory[cat] = (aggregate.repeatedByCategory[cat] || 0) + 1;
  if (longUnresolved) aggregate.longUnresolvedByCategory[cat] = (aggregate.longUnresolvedByCategory[cat] || 0) + 1;

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
        issue: conv.issueText || conv.preview?.summary || "",
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

  const allCategories = Object.keys(ctx.aggregate.convCountByCategory);
  const frustrationByCategory = allCategories.map((cat) => {
    const volume = ctx.aggregate.convCountByCategory[cat] || 0;
    const negative = ctx.aggregate.negativeByCategory[cat] || 0;
    const fallback = ctx.aggregate.fallbackByCategory[cat] || 0;
    const repeated = ctx.aggregate.repeatedByCategory[cat] || 0;
    const longUnres = ctx.aggregate.longUnresolvedByCategory[cat] || 0;
    const handovers = ctx.aggregate.handoverByCategory[cat] || 0;
    const frustrationScore = negative + fallback + repeated + longUnres;
    const frustrationPct = volume > 0 ? Math.round((frustrationScore / volume) * 100) : 0;
    const handoverPct = volume > 0 ? Math.round((handovers / volume) * 100) : 0;
    const correlationScore = Math.round((frustrationPct * 0.6) + (handoverPct * 0.4));
    return { cat, volume, negative, fallback, repeated, longUnres, handovers, frustrationScore, frustrationPct, handoverPct, correlationScore };
  }).sort((a, b) => b.correlationScore - a.correlationScore);

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
    frustrationByCategory,
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
  // Cap how many rows we copy into the unified view to avoid re-analyzing
  // massive row sets in the browser (each individual dataset already has its own analysis).
  const MAX_UNIFIED_ROWS = 60000;
  let totalMerged = 0;
  const mergedRows = [];
  for (const dataset of state.datasets) {
    const sourceFromName = String(dataset.name || "").split("::").pop() || "";
    const fallbackSource = sourceFromName || dataset.targetLabel || dataset.targetKey || "dataset";
    for (const row of (dataset.rows || [])) {
      if (totalMerged >= MAX_UNIFIED_ROWS) break;
      mergedRows.push({ ...row, __sourceTable: row.__sourceTable || fallbackSource });
      totalMerged++;
    }
    if (totalMerged >= MAX_UNIFIED_ROWS) break;
  }
  // Re-analyze only the capped merged row set (fast path for large star-schema DBs).
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

function uniqueValues(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

function detectConversationFields(columns) {
  const columnSet = new Set(columns);
  const has = (name) => columnSet.has(name);
  const pick = (patterns) => columns.find((c) => patterns.some((p) => p.test(c.toLowerCase())));
  const pickMany = (patterns) => columns.filter((c) => patterns.some((p) => p.test(c.toLowerCase())));
  const pickExact = (names) => names.find((name) => has(name)) || null;
  const pickExactMany = (names) => names.filter((name) => has(name));

  const categoryCandidates = uniqueValues([
    ...pickExactMany(DB_FIELD_PRIORITY.category),
    ...pickMany([
      /main.*intent/, /\bintent\b/, /endpoint/, /categor/, /topic/,
      /\bissue\b/, /problem/, /reason/, /label/, /subject/, /queue/,
      /department/, /afdeling/, /onderwerp/, /classif/, /\btag\b/
    ])
  ]).filter((c) => !/media.*type|source.*type|mime|content.*type|row.*type|data.*type/i.test(c));

  const issueTextCandidates = uniqueValues([
    ...pickExactMany(DB_FIELD_PRIORITY.issueText),
    ...pickMany([
      /handover.*question/, /customer.*input/, /inputtext/, /unrecognized.*question/,
      /\bquestion\b/, /\bmessage\b/, /omschrijving/, /description/, /summary/,
      /comment/, /\btext\b/, /utterance/, /\bquery\b/, /\bcontent\b/, /\bnote\b/,
      /bericht/, /vraag/, /issue.*desc/, /problem.*desc/
    ])
  ]);

  return {
    conversationId: pickExact(DB_FIELD_PRIORITY.conversationId) || pick([
      /session.*id/, /conversation.*id/, /conv.*id/, /chat.*id/, /dialog.*id/,
      /thread.*id/, /ticket.*id/, /case.*id/, /contact.*id/, /interaction.*id/,
      /call.*id/, /\bsessie\b/, /gesprek.*id/, /^id$/
    ]),
    userMessage: pickExact(DB_FIELD_PRIORITY.userMessage) || pick([
      /user.*message/, /customer.*message/, /customer.*input/, /user.*input/,
      /inputtext/, /user.*text/, /customer.*query/, /\butterance\b/,
      /\bvraag\b/, /\bbericht\b/, /^message$/, /^text$/, /^content$/, /^input$/, /^query$/
    ]),
    botResponse: pickExact(DB_FIELD_PRIORITY.botResponse) || pick([
      /bot.*response/, /bot.*message/, /bot.*text/, /assistant.*response/,
      /agent.*response/, /\breply\b/, /\bresponse\b/, /\banswer\b/, /\bantwoord\b/
    ]),
    timestamp: pickExact(DB_FIELD_PRIORITY.timestamp) || pick([
      /timestamp/, /created.*at/, /occurred.*at/, /event.*time/, /start.*time/,
      /\btime\b/, /\bdate\b/, /\bdatum\b/, /tijdstip/
    ]),
    status: pickExact(DB_FIELD_PRIORITY.status) || pick([
      /\bstatus\b/, /\bstate\b/, /\bresolved\b/, /\boutcome\b/, /\bresolution\b/,
      /disposition/, /completion/, /afhandeling/
    ]),
    escalationFlag: pickExact(DB_FIELD_PRIORITY.escalationFlag) || pick([
      /escalat/, /handover/, /human.*handoff/, /requires.*agent/, /transfer/,
      /doorverbind/, /doorgeschakeld/
    ]),
    category: categoryCandidates[0] || null,
    categoryCandidates,
    goalsField: pickExact(DB_FIELD_PRIORITY.goalsField),
    handoverQuestion: pickExact(DB_FIELD_PRIORITY.handoverQuestion),
    issueText: issueTextCandidates[0] || null,
    issueTextCandidates
  };
}

function deriveIssueCategory(row, fields, text) {
  for (const column of fields?.categoryCandidates || []) {
    const explicit = normalizeCategoryValue(row[column]);
    if (explicit && !isGenericCategory(explicit)) return explicit;
  }
  const issueText = deriveIssueText(row, fields, text);
  const ruleCategory = categorizeIssue(issueText || text);
  if (!isGenericCategory(ruleCategory)) return ruleCategory;
  return inferCategoryFromText(issueText || text);
}

function deriveIssueText(row, fields, text) {
  const candidates = [
    fields?.handoverQuestion ? row[fields.handoverQuestion] : "",
    fields?.issueText ? row[fields.issueText] : "",
    fields?.userMessage ? row[fields.userMessage] : "",
    ...(fields?.issueTextCandidates || []).map((column) => row[column]),
    text
  ];
  for (const value of candidates) {
    const clean = normalizeIssueText(value);
    if (clean) return clean;
  }
  return "";
}

function normalizeCategoryValue(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function isGenericCategory(value) {
  const clean = normalizeCategoryValue(value);
  return !clean
    || ["other", "unknown", "none", "null", "n/a", "na", "text", "voice", "chat", "email", "web", "clean data cgny", "clean data sessions"].includes(clean)
    || /^[-\d\s.]+$/.test(clean);
}

function normalizeIssueText(value) {
  const clean = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean || /^(null|none|n\/a|na|undefined|-)$/i.test(clean)) return "";
  return trimText(clean, 180);
}

function chooseBetterCategory(current, next) {
  if (!next || isGenericCategory(next)) return current || "other";
  if (!current || isGenericCategory(current)) return next;
  if (categoryQuality(next) > categoryQuality(current)) return next;
  return current;
}

function categoryQuality(value) {
  const clean = normalizeCategoryValue(value);
  if (isGenericCategory(clean)) return 0;
  if (KNOWN_ISSUE_CATEGORIES.has(clean)) return 3;
  if (clean.split(/\s+/).length <= 4) return 2;
  return 1;
}

function chooseBetterIssueText(current, next) {
  if (!next) return current || "";
  if (!current) return next;
  const currentGeneric = isGenericIssueText(current);
  const nextGeneric = isGenericIssueText(next);
  if (currentGeneric && !nextGeneric) return next;
  if (next.length > current.length && !nextGeneric) return next;
  return current;
}

function isGenericIssueText(value) {
  const clean = String(value || "").trim().toLowerCase();
  return !clean || clean === "other" || clean === "unknown" || clean.length < 8;
}

function inferCategoryFromText(value) {
  const clean = normalizeCategoryValue(value);
  if (!clean) return "other";
  const tokens = clean
    .split(/\s+/)
    .map((token) => token.replace(/^[^\w]+|[^\w]+$/g, ""))
    .filter((token) => token.length > 2 && !ISSUE_STOPWORDS.has(token) && !/^\d+$/.test(token));
  if (!tokens.length) return "other";
  return tokens.slice(0, 4).join(" ");
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
  return /\bdirectlivechat\b|\boutside_service_hours_no_agents\b|\bhandover\b|\btransfer\b|\bdoorverbinden\b|\bdoorgeschakeld\b|\bmedewerker\b|\bladder\b|\bescalatie\b|\blive_chat\b|\blivechat\b/.test(goalText);
}

function detectFallbackSignal(text, row, fields) {
  if (state.regexes.fallbackRegex.test(text)) return true;
  if (fields?.userMessage && !isEmpty(row[fields.userMessage])) {
    const msg = String(row[fields.userMessage]).toLowerCase();
    if (/\bunrecognized\b|\bonbekend\b|\bniet begrepen\b|\bniet herkend\b|\bfallback\b|\bniet begrepen\b|\bonbekende invoer\b/.test(msg)) return true;
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
  const haystack = normalizeCategoryValue(text);
  const rules = [
    { key: "billing", pattern: /\b(bill|billing|invoice|factuur|facturen|payment|betaling|betaal|charged|incasso|kosten|subscription)\b/ },
    { key: "refund", pattern: /\b(refund|terugbetaling|terugstorten|terugstorting|money back|geld terug)\b/ },
    { key: "contract", pattern: /\b(contract|aanmelding|afmelding|opzeg|opzeggen|verlengen|verlenging|switch|overstap|cancell)\b/ },
    { key: "account", pattern: /\b(account|profiel|profile|gegevens|settings|instellingen)\b/ },
    { key: "login", pattern: /\b(login|inloggen|sign in|sign up|password|wachtwoord|otp|2fa|authentication|locked out|toegang)\b/ },
    { key: "outage", pattern: /\b(storing|outage|down|unavailable|niet beschikbaar|not working|broken|kapot|defect)\b/ },
    { key: "shipping", pattern: /\b(shipping|shipment|verzending|levering|delivery|bezorging|track|pakket|package)\b/ },
    { key: "return", pattern: /\b(return|retour|terugsturen|ruilen|exchange|omruilen)\b/ },
    { key: "order", pattern: /\b(order|bestelling|aankoop|purchase|bought|gekocht|item|product)\b/ },
    { key: "complaint", pattern: /\b(complaint|klacht|klagen|ontevreden|dissatisfied|feedback|escalat)\b/ },
    { key: "technical", pattern: /\b(error|fout|bug|crash|timeout|api|technisch|technical|glitch|issue)\b/ },
    { key: "subscription", pattern: /\b(subscription|abonnement|plan|upgrade|downgrade|tier|premium)\b/ }
  ];
  const hit = rules.find((rule) => rule.pattern.test(haystack));
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
    body: JSON.stringify({ payload, apiKey })
  }).catch(() => null);

  if (proxyResponse && proxyResponse.ok) {
    return proxyResponse.json();
  }

  if (proxyResponse && proxyResponse.status !== 404) {
    const proxyText = await proxyResponse.text().catch(() => "");
    throw new Error(`AI proxy error ${proxyResponse.status}${proxyText ? `: ${proxyText.slice(0, 160)}` : ""}`);
  }

  // Direct fallback: call Anthropic API from the browser
  const directResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      system: "You are a support analytics assistant. Output valid JSON only with keys: insights (array of strings), issue_labels (object).",
      messages: [
        { role: "user", content: `Return strict JSON with keys: insights (array), issue_labels (object). Input: ${JSON.stringify(payload)}` }
      ]
    })
  });
  if (!directResponse.ok) throw new Error(`Claude API error ${directResponse.status}`);
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

  modeSel.value = state.comparison.mode === "pair" ? "pair" : "all";

  leftSel.innerHTML = "";
  rightSel.innerHTML = "";
  state.datasets.forEach((d) => {
    const label = d.targetLabel || d.name || d.id;
    const leftOpt = document.createElement("option");
    leftOpt.value = d.id;
    leftOpt.textContent = label;
    leftSel.appendChild(leftOpt);
    const rightOpt = document.createElement("option");
    rightOpt.value = d.id;
    rightOpt.textContent = label;
    rightSel.appendChild(rightOpt);
  });

  if (!state.datasets.length) return;

  if (!state.comparison.left || !state.datasets.some((d) => d.id === state.comparison.left)) {
    state.comparison.left = state.datasets[0].id;
  }
  if (!state.comparison.right || !state.datasets.some((d) => d.id === state.comparison.right)) {
    state.comparison.right = state.datasets[Math.min(1, state.datasets.length - 1)].id;
  }
  if (state.comparison.left === state.comparison.right && state.datasets.length > 1) {
    state.comparison.right = state.datasets.find((d) => d.id !== state.comparison.left).id;
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
  const datasets = state.datasets;
  if (!datasets.length) return [];
  if (state.comparison.mode === "pair") {
    const left = datasets.find((d) => d.id === state.comparison.left);
    const right = datasets.find((d) => d.id === state.comparison.right);
    return [left, right].filter(Boolean);
  }
  return datasets.length > 1 ? datasets : (state.unifiedDataset ? [state.unifiedDataset] : datasets);
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
    renderDataTable();
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
  if (activeTab === "frustrationTab") {
    renderFrustrationTab();
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

function buildDatasetSearchIndex(dataset) {
  if (!dataset._searchIndex || dataset._searchIndex.length !== (dataset.rows || []).length) {
    dataset._searchIndex = (dataset.rows || []).map((r) => Object.values(r).join(" ").toLowerCase());
  }
  return dataset._searchIndex;
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
  const rows = dataset.rows || [];
  const keys = dataset.analysis.columns || [];
  let filtered;
  if (!state.table.filter) {
    filtered = rows;
  } else {
    const index = buildDatasetSearchIndex(dataset);
    filtered = rows.filter((_, i) => index[i]?.includes(state.table.filter));
  }
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

  let exportBtn = byId("dataTableExportBtn");
  if (!exportBtn) {
    exportBtn = document.createElement("button");
    exportBtn.id = "dataTableExportBtn";
    exportBtn.className = "btn";
    exportBtn.textContent = t("exportCsvBtn");
    pageInfoEl.parentNode.insertBefore(exportBtn, pageInfoEl.nextSibling);
  }
  exportBtn.onclick = () => exportToCsv(filtered, keys, `${dataset.name || "data"}.csv`);
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

  // When the combined (unified) dataset is active, merge handoverRows from ALL individual
  // table analyses — each table analyzed up to 500k rows, so this is far more complete
  // than the combined analysis which only covers 60k merged rows.
  const isUnified = dataset === state.unifiedDataset;
  let effectiveHandoverRows, effectiveHandoverCount, effectiveTotalConversations;
  if (isUnified && state.datasets.length > 0) {
    effectiveHandoverRows = state.datasets.flatMap((d) => d.analysis.handoverRows || []);
    effectiveHandoverCount = state.datasets.reduce((s, d) => s + (d.analysis.handoverCount || 0), 0);
    effectiveTotalConversations = state.datasets.reduce((s, d) => s + (d.analysis.totalConversations || 0), 0);
  } else {
    effectiveHandoverRows = a.handoverRows || [];
    effectiveHandoverCount = a.handoverCount || 0;
    effectiveTotalConversations = a.totalConversations || 0;
  }

  const effectiveHandoverRate = effectiveTotalConversations
    ? toPct(effectiveHandoverCount, effectiveTotalConversations)
    : 0;
  byId("kpiHandovers").textContent = String(effectiveHandoverCount);
  byId("kpiHandoverPct").textContent = `${effectiveHandoverRate}%`;

  // Charts and category summary only update when the dataset changes, not on every filter keystroke.
  const chartKey = dataset.id + (isUnified ? "-merged" : "");
  if (state.handoverView.lastChartDatasetId !== chartKey) {
    state.handoverView.lastChartDatasetId = chartKey;
    const handoverTimeline = {};
    effectiveHandoverRows.forEach((r) => {
      const day = safeDay(r.handoverTime);
      handoverTimeline[day] = (handoverTimeline[day] || 0) + 1;
    });
    const entries = Object.entries(handoverTimeline).sort((a1, b1) => a1[0].localeCompare(b1[0]));
    drawChart("handoverTimeline", "line", {
      labels: entries.map((e) => e[0]),
      datasets: [{ label: t("handovers"), data: entries.map((e) => e[1]), borderColor: "#f4b648", tension: 0.25 }]
    });
    const catMap = {};
    effectiveHandoverRows.forEach((r) => {
      const c = mapIssueLabel(r.category, a);
      catMap[c] = (catMap[c] || 0) + 1;
    });
    const cat = Object.entries(catMap).sort((x, y) => y[1] - x[1]);
    drawChart("handoverCategoryBar", "bar", {
      labels: cat.map((c) => c[0]),
      datasets: [{ label: t("handovers"), data: cat.map((c) => c[1]), backgroundColor: "#5c8cff" }]
    });
    const allRows = effectiveHandoverRows.map((r) => ({ ...r, category: mapIssueLabel(r.category, a) }));
    renderHandoverCategorySummary(allRows, effectiveHandoverCount);
  }
  const rows = effectiveHandoverRows.map((r) => ({ ...r, category: mapIssueLabel(r.category, a) }));
  if (searchInput) {
    searchInput.value = state.handoverView.search || "";
  }
  if (dbColumnSelect) dbColumnSelect.value = state.handoverView.dbColumn || "conversationId";
  if (dbOpSelect) dbOpSelect.value = state.handoverView.dbOp || "contains";
  if (dbValueInput) dbValueInput.value = state.handoverView.dbValue || "";
  updateHandoverValueSuggestions();
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

  const pageSize = state.handoverView.pageSize;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  state.handoverView.page = Math.min(Math.max(1, state.handoverView.page), totalPages);
  const page = state.handoverView.page;
  const pageStart = (page - 1) * pageSize;
  const pageRows = filteredRows.slice(pageStart, pageStart + pageSize);

  const tableWrap = byId("handoverTableWrap");
  renderTable(
    tableWrap,
    pageRows,
    ["conversationId", "handoverTime", "category", "issue", "sourceTable", "reason", "turns"],
    null,
    { issue: t("handoverIssueColumn"), sourceTable: t("tableSourceTable") }
  );

  let pagerEl = byId("handoverPager");
  if (!pagerEl) {
    pagerEl = document.createElement("div");
    pagerEl.id = "handoverPager";
    pagerEl.className = "controls-inline";
    tableWrap.parentNode.insertBefore(pagerEl, tableWrap.nextSibling);
  }
  const prevDisabled = page <= 1 ? "disabled" : "";
  const nextDisabled = page >= totalPages ? "disabled" : "";
  pagerEl.innerHTML = `
    <button class="btn" id="handoverPrevBtn" ${prevDisabled}>${escapeHtml(t("prevBtn"))}</button>
    <span class="muted">${escapeHtml(t("intentHandoverPageInfo", { page, total: totalPages }))}</span>
    <button class="btn" id="handoverNextBtn" ${nextDisabled}>${escapeHtml(t("nextBtn"))}</button>`;
  const prevBtn = byId("handoverPrevBtn");
  const nextBtn = byId("handoverNextBtn");
  if (prevBtn) prevBtn.addEventListener("click", () => { state.handoverView.page--; renderHandovers(); });
  if (nextBtn) nextBtn.addEventListener("click", () => { state.handoverView.page++; renderHandovers(); });

  if (filterInfo) {
    filterInfo.textContent = t("handoverFilterInfo", {
      shown: filteredRows.length.toLocaleString(),
      total: rows.length.toLocaleString()
    });
  }

  let handoverExportBtn = byId("handoverExportBtn");
  if (!handoverExportBtn) {
    handoverExportBtn = document.createElement("button");
    handoverExportBtn.id = "handoverExportBtn";
    handoverExportBtn.className = "btn";
    handoverExportBtn.textContent = t("exportCsvBtn");
    tableWrap.parentNode.insertBefore(handoverExportBtn, tableWrap);
  }
  handoverExportBtn.onclick = () => { const ds = getActiveDataset(); exportToCsv(filteredRows, ["conversationId", "handoverTime", "category", "issue", "sourceTable", "reason", "turns"], `${ds?.name || "handovers"}-handovers.csv`); };
}

function renderHandoverCategorySummary(rows, total) {
  const wrap = byId("handoverCategorySummary");
  if (!wrap) return;
  const groups = new Map();
  (rows || []).forEach((row) => {
    const category = String(row.category || "other");
    const item = groups.get(category) || { category, count: 0, rows: [], examples: [], reasons: {} };
    item.count += 1;
    item.rows.push(row);
    if (item.examples.length < 3 && row.issue) item.examples.push(row.issue);
    const r = row.reason || "unknown";
    item.reasons[r] = (item.reasons[r] || 0) + 1;
    groups.set(category, item);
  });
  const top = Array.from(groups.values()).sort((a, b) => b.count - a.count).slice(0, 6);
  if (!top.length) { wrap.innerHTML = ""; return; }
  state._handoverCategoryGroups = Object.fromEntries(top.map((i) => [i.category, i]));
  state._handoverCategoryTotal = total;

  // Build cards — use data-hsc-key instead of inline onclick to avoid CSP restrictions
  wrap.innerHTML = top.map((item) => {
    const pct = total ? `${toPct(item.count, total)}%` : "0%";
    // Store the category index key directly on the element
    const catKey = encodeURIComponent(item.category);
    const topReason = Object.entries(item.reasons).sort((a, b) => b[1] - a[1])[0];
    const reasonLabel = topReason ? (() => {
      const lbl = { keyword: t("hscReasonKeyword"), escalated: t("hscReasonEscalated"), "fallback+repeated": t("hscReasonFallbackRepeated"), unknown: t("hscReasonUnknown") };
      return lbl[topReason[0]] || topReason[0];
    })() : "";
    const reasonChip = reasonLabel
      ? `<span class="hsc-reason-chip">${escapeHtml(reasonLabel)}</span>`
      : "";
    const examples = item.examples.length
      ? item.examples.map((e) => `<li>${escapeHtml(e)}</li>`).join("")
      : `<li class="muted">${escapeHtml(t("noDataAvailable"))}</li>`;
    return `
      <article class="handover-summary-card handover-summary-card--clickable" role="button" tabindex="0" data-hsc-key="${catKey}">
        <div class="handover-summary-card__top">
          <strong>${escapeHtml(item.category)}</strong>
          <span>${escapeHtml(String(item.count))} (${escapeHtml(pct)})</span>
        </div>
        ${reasonChip}
        <ul>${examples}</ul>
        <div class="hsc-open-hint">${escapeHtml(t("hscClickDetails"))}</div>
      </article>`;
  }).join("");

  // Attach click/keyboard via event delegation — avoids inline-handler CSP issues
  wrap.onclick = (e) => {
    const card = e.target.closest("[data-hsc-key]");
    if (card) openHandoverCategoryModal(card.dataset.hscKey);
  };
  wrap.onkeydown = (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const card = e.target.closest("[data-hsc-key]");
    if (card) { e.preventDefault(); openHandoverCategoryModal(card.dataset.hscKey); }
  };
}

function openHandoverCategoryModal(encodedCategory) {
  const category = decodeURIComponent(encodedCategory);
  const groups = state._handoverCategoryGroups || {};
  const total = state._handoverCategoryTotal || 0;
  const item = groups[category];
  const modal = byId("hscModal");
  const backdrop = byId("hscModalBackdrop");
  if (!modal || !backdrop) return;
  if (!item) {
    byId("hscModalTitle").textContent = decodeURIComponent(encodedCategory);
    byId("hscModalBody").innerHTML = `<p class="muted" style="padding:1.5rem;">${escapeHtml(t("hscCategoryNotFound"))}</p>`;
    backdrop.hidden = false;
    modal.hidden = false;
    return;
  }

  const pct = total ? `${toPct(item.count, total)}%` : "0%";
  const reasonEntries = Object.entries(item.reasons).sort((a, b) => b[1] - a[1]);
  const reasonLabels = { keyword: t("hscReasonKeyword"), escalated: t("hscReasonEscalated"), "fallback+repeated": t("hscReasonFallbackRepeated"), unknown: t("hscReasonUnknown") };

  // Try to enrich with raw dataset rows matched by conversationId
  const activeDataset = getActiveDataset();
  const rawByConvId = {};
  if (activeDataset) {
    (activeDataset.rows || []).forEach((row) => {
      const cid = String(
        row.conversationId || row.conversation_id || row.conversationid ||
        row.CONVERSATIONID || row.session_id || row.sessionId || row.id || ""
      ).trim();
      if (cid && !rawByConvId[cid]) rawByConvId[cid] = row;
    });
  }
  // Collect all columns from raw rows (for the enriched data view)
  const rawCols = new Set();
  Object.values(rawByConvId).forEach((row) => Object.keys(row).forEach((k) => {
    if (k !== "__sourceTable") rawCols.add(k);
  }));
  const rawColList = Array.from(rawCols).slice(0, 20); // cap at 20 cols for display

  // Signal breakdown bars
  const signalBars = reasonEntries.map(([r, n]) => {
    const rpct = Math.round((n / item.count) * 100);
    const label = reasonLabels[r] || r;
    return `<div class="hsc-signal-row">
      <span class="hsc-signal-label">${escapeHtml(label)}</span>
      <div class="hsc-bar-wrap"><div class="hsc-bar" style="width:${rpct}%"></div></div>
      <span class="hsc-signal-val">${n} <span class="muted">(${rpct}%)</span></span>
    </div>`;
  }).join("");

  // Avg turns
  const avgTurns = item.rows.length
    ? (item.rows.reduce((s, r) => s + (Number(r.turns) || 0), 0) / item.rows.length).toFixed(1)
    : "-";
  // Earliest / latest
  const times = item.rows.map((r) => r.handoverTime).filter(Boolean).sort();
  const earliest = times[0] ? String(times[0]).slice(0, 16) : "-";
  const latest = times[times.length - 1] ? String(times[times.length - 1]).slice(0, 16) : "-";

  // Top issues with frequencies
  const issueFreq = {};
  item.rows.forEach((r) => { if (r.issue) issueFreq[r.issue] = (issueFreq[r.issue] || 0) + 1; });
  const topIssues = Object.entries(issueFreq).sort((a, b) => b[1] - a[1]).slice(0, 10);

  // Timeline (handovers per day)
  const dayMap = {};
  item.rows.forEach((r) => {
    if (!r.handoverTime) return;
    const day = String(r.handoverTime).slice(0, 10);
    if (day.length === 10) dayMap[day] = (dayMap[day] || 0) + 1;
  });
  const dayEntries = Object.entries(dayMap).sort((a, b) => a[0].localeCompare(b[0]));

  // Source breakdown
  const srcFreq = {};
  item.rows.forEach((r) => { const s = r.sourceTable || "onbekend"; srcFreq[s] = (srcFreq[s] || 0) + 1; });
  const srcEntries = Object.entries(srcFreq).sort((a, b) => b[1] - a[1]);

  // Conversations table — up to 200 rows, enriched with raw row columns if available
  const displayRows = item.rows.slice(0, 200);
  const rawEnriched = displayRows.some((r) => rawByConvId[String(r.conversationId || "")]);
  const convTableHeaders = rawEnriched && rawColList.length
    ? `<th>${escapeHtml(t("hscConvHeader"))}</th><th>${escapeHtml(t("hscTimeHeader"))}</th><th>${escapeHtml(t("hscReasonHeader"))}</th><th>${escapeHtml(t("hscTurnsHeader"))}</th><th>${escapeHtml(t("hscIssueHeader"))}</th>${rawColList.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}`
    : `<th>${escapeHtml(t("hscConvIdHeader"))}</th><th>${escapeHtml(t("hscTimeHeader"))}</th><th>${escapeHtml(t("hscReasonHeader"))}</th><th>${escapeHtml(t("hscTurnsHeader"))}</th><th>${escapeHtml(t("hscIssueHeader"))}</th><th>${escapeHtml(t("hscSourceHeader"))}</th>`;

  const convTableRows = displayRows.map((r) => {
    const raw = rawByConvId[String(r.conversationId || "")] || null;
    const reasonClass = `hsc-reason-chip--${String(r.reason || "unknown").replace(/\+/g, "-")}`;
    const reasonText = reasonLabels[r.reason] || r.reason || "-";
    const baseRow = `
      <td class="copyable-cell">${escapeHtml(String(r.conversationId || "-"))}</td>
      <td>${escapeHtml(String(r.handoverTime || "-").slice(0, 16))}</td>
      <td><span class="hsc-reason-chip ${escapeHtml(reasonClass)}">${escapeHtml(reasonText)}</span></td>
      <td>${escapeHtml(String(r.turns || "-"))}</td>
      <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(String(r.issue || ""))}">${escapeHtml(String(r.issue || "-"))}</td>`;
    const extraCols = rawEnriched && rawColList.length
      ? rawColList.map((c) => {
        const val = raw ? String(raw[c] ?? "-") : "-";
        return `<td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(val)}">${escapeHtml(val.length > 60 ? val.slice(0, 60) + "…" : val)}</td>`;
      }).join("")
      : `<td>${escapeHtml(String(r.sourceTable || "-"))}</td>`;
    return `<tr>${baseRow}${extraCols}</tr>`;
  }).join("");

  const moreNote = item.rows.length > 200
    ? `<p class="muted" style="margin:0.5rem 0 0;font-size:0.82rem;">${escapeHtml(t("hscMoreRows", { n: item.rows.length - 200 }))}</p>`
    : "";

  byId("hscModalTitle").textContent = category;

  const bodyEl = byId("hscModalBody");
  bodyEl.innerHTML = `
    <div class="hsc-modal-tabs" data-hsc-tabs>
      <button class="hsc-tab-btn active" data-hsc-tab="hscTabOverview">${escapeHtml(t("hscTabOverview"))}</button>
      <button class="hsc-tab-btn" data-hsc-tab="hscTabConversations">${escapeHtml(t("hscTabConversations"))} (${item.rows.length})</button>
      <button class="hsc-tab-btn" data-hsc-tab="hscTabSignals">${escapeHtml(t("hscTabSignals"))}</button>
      <button class="hsc-tab-btn" data-hsc-tab="hscTabTimeline">${escapeHtml(t("hscTabTimeline"))} (${dayEntries.length}d)</button>
    </div>

    <!-- Tab: Overview -->
    <div id="hscTabOverview" class="hsc-tab-panel">
      <div class="hsc-stat-grid">
        <div class="hsc-stat-card"><div class="hsc-stat-label">${escapeHtml(t("hscStatHandovers"))}</div><div class="hsc-stat-val">${item.count}</div></div>
        <div class="hsc-stat-card"><div class="hsc-stat-label">${escapeHtml(t("hscStatShare"))}</div><div class="hsc-stat-val">${pct}</div></div>
        <div class="hsc-stat-card"><div class="hsc-stat-label">${escapeHtml(t("hscStatAvgTurns"))}</div><div class="hsc-stat-val">${avgTurns}</div></div>
        <div class="hsc-stat-card"><div class="hsc-stat-label">${escapeHtml(t("hscStatFirstHandover"))}</div><div class="hsc-stat-val hsc-stat-val--sm">${earliest}</div></div>
        <div class="hsc-stat-card"><div class="hsc-stat-label">${escapeHtml(t("hscStatLastHandover"))}</div><div class="hsc-stat-val hsc-stat-val--sm">${latest}</div></div>
        <div class="hsc-stat-card"><div class="hsc-stat-label">${escapeHtml(t("hscStatSources"))}</div><div class="hsc-stat-val">${srcEntries.length}</div></div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;margin-top:1.25rem;">
        <div>
          <h4 style="margin:0 0 0.6rem;">${escapeHtml(t("hscSignalsTitle"))}</h4>
          <div class="hsc-signals">${signalBars || `<p class="muted">${escapeHtml(t("hscSignalsEmpty"))}</p>`}</div>
        </div>
        <div>
          <h4 style="margin:0 0 0.6rem;">${escapeHtml(t("hscSourceTitle"))}</h4>
          ${srcEntries.map(([src, n]) => {
            const sp = Math.round((n / item.count) * 100);
            return `<div class="hsc-signal-row">
              <span class="hsc-signal-label">${escapeHtml(src)}</span>
              <div class="hsc-bar-wrap"><div class="hsc-bar" style="width:${sp}%;background:#34d399"></div></div>
              <span class="hsc-signal-val">${n}</span>
            </div>`;
          }).join("") || '<p class="muted">–</p>'}
        </div>
      </div>

      <h4 style="margin:1.25rem 0 0.6rem;">${escapeHtml(t("hscTopIssuesTitle"))}</h4>
      ${topIssues.length ? `<div class="table-wrap"><table>
        <thead><tr><th>${escapeHtml(t("hscProblemHeader"))}</th><th>${escapeHtml(t("hscCountHeader"))}</th><th>${escapeHtml(t("hscPctHeader"))}</th></tr></thead>
        <tbody>${topIssues.map(([issue, n]) => `
          <tr>
            <td>${escapeHtml(issue)}</td>
            <td>${n}</td>
            <td>${Math.round((n / item.count) * 100)}%</td>
          </tr>`).join("")}
        </tbody>
      </table></div>` : `<p class="muted">${escapeHtml(t("hscTopIssuesEmpty"))}</p>`}
    </div>

    <!-- Tab: Conversations -->
    <div id="hscTabConversations" class="hsc-tab-panel" hidden>
      ${rawEnriched && rawColList.length ? `<p class="muted" style="margin:0 0 0.5rem;font-size:0.8rem;">${escapeHtml(t("hscEnrichedNote", { n: rawColList.length, m: Object.keys(rawByConvId).length }))}</p>` : ""}
      <div class="table-wrap" style="max-height:500px;">
        <table>
          <thead><tr>${convTableHeaders}</tr></thead>
          <tbody>${convTableRows || `<tr><td colspan="6" class="muted">${escapeHtml(t("hscNoConversations"))}</td></tr>`}</tbody>
        </table>
      </div>
      ${moreNote}
    </div>

    <!-- Tab: Signal Analysis -->
    <div id="hscTabSignals" class="hsc-tab-panel" hidden>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;">
        <div>
          <h4 style="margin:0 0 0.6rem;">${escapeHtml(t("hscCausesTitle"))}</h4>
          <div class="table-wrap"><table>
            <thead><tr><th>${escapeHtml(t("hscSignalHeader"))}</th><th>${escapeHtml(t("hscCountHeader"))}</th><th>${escapeHtml(t("hscPctHeader"))}</th></tr></thead>
            <tbody>${reasonEntries.map(([r, n]) => `
              <tr>
                <td>${escapeHtml(reasonLabels[r] || r)}</td>
                <td>${n}</td>
                <td>${Math.round((n / item.count) * 100)}%</td>
              </tr>`).join("") || '<tr><td colspan="3">-</td></tr>'}
            </tbody>
          </table></div>
        </div>
        <div>
          <h4 style="margin:0 0 0.6rem;">${escapeHtml(t("hscLongestTitle"))}</h4>
          <div class="table-wrap"><table>
            <thead><tr><th>${escapeHtml(t("hscConvHeader"))}</th><th>${escapeHtml(t("hscTurnsHeader"))}</th><th>${escapeHtml(t("hscReasonHeader"))}</th></tr></thead>
            <tbody>${item.rows.slice().sort((a, b) => (b.turns || 0) - (a.turns || 0)).slice(0, 10).map((r) => `
              <tr>
                <td class="copyable-cell">${escapeHtml(String(r.conversationId || "-"))}</td>
                <td>${escapeHtml(String(r.turns || "-"))}</td>
                <td>${escapeHtml(reasonLabels[r.reason] || r.reason || "-")}</td>
              </tr>`).join("")}
            </tbody>
          </table></div>
        </div>
      </div>
    </div>

    <!-- Tab: Timeline -->
    <div id="hscTabTimeline" class="hsc-tab-panel" hidden>
      ${dayEntries.length ? `
        <h4 style="margin:0 0 0.75rem;">${escapeHtml(t("hscTimelineTitle"))}</h4>
        <div class="table-wrap" style="max-height:420px;"><table>
          <thead><tr><th>${escapeHtml(t("hscDateHeader"))}</th><th>${escapeHtml(t("hscCountHeader"))}</th><th>Bar</th></tr></thead>
          <tbody>${(() => {
            const maxN = Math.max(...dayEntries.map((d) => d[1]), 1);
            return dayEntries.map(([day, n]) => `
              <tr>
                <td>${escapeHtml(day)}</td>
                <td>${n}</td>
                <td style="min-width:120px;"><div style="height:12px;border-radius:3px;background:#5c8cff;width:${Math.round((n / maxN) * 100)}%"></div></td>
              </tr>`).join("");
          })()}
          </tbody>
        </table></div>` : `<p class="muted">${escapeHtml(t("hscTimelineEmpty"))}</p>`}
    </div>
  `;

  // Tab switching via event delegation — no inline onclick needed
  bodyEl.querySelector("[data-hsc-tabs]").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-hsc-tab]");
    if (!btn) return;
    const tabId = btn.dataset.hscTab;
    bodyEl.querySelectorAll(".hsc-tab-btn").forEach((b) => b.classList.remove("active"));
    bodyEl.querySelectorAll(".hsc-tab-panel").forEach((p) => { p.hidden = true; });
    btn.classList.add("active");
    const panel = byId(tabId);
    if (panel) panel.hidden = false;
  });

  // Copy-cell handler
  bodyEl.querySelectorAll(".copyable-cell").forEach((el) => {
    el.style.cursor = "pointer";
    el.title = t("hscCopyHint");
    el.addEventListener("click", () => {
      const v = el.textContent.trim();
      navigator.clipboard?.writeText(v).catch(() => {
        try { copyTextToClipboard(v); } catch (_) {}
      });
      el.style.opacity = "0.5";
      setTimeout(() => { el.style.opacity = ""; }, 600);
    });
  });

  backdrop.hidden = false;
  modal.hidden = false;
}

function closeHandoverCategoryModal() {
  const modal = byId("hscModal");
  const backdrop = byId("hscModalBackdrop");
  if (modal) modal.hidden = true;
  if (backdrop) backdrop.hidden = true;
}
// Keep these on window in case any external code references them
window.openHandoverCategoryModal = openHandoverCategoryModal;
window.closeHandoverCategoryModal = closeHandoverCategoryModal;

function renderIntentHandovers() {
  const tableWrap = byId("intentHandoverTableWrap");
  const summaryEl = byId("intentHandoverSummary");
  const prevBtn = byId("intentHandoverPrevBtn");
  const nextBtn = byId("intentHandoverNextBtn");
  const pageInfo = byId("intentHandoverPageInfo");
  const diagnostic = byId("ihDiagnostic");
  const kpiTotal = byId("ihKpiTotal");
  const kpiDatasets = byId("ihKpiDatasets");
  const kpiConversations = byId("ihKpiConversations");
  if (!tableWrap || !summaryEl || !pageInfo) return;

  const datasets = state.datasets || [];
  if (!datasets.length) {
    if (tableWrap) tableWrap.innerHTML = "";
    if (summaryEl) summaryEl.textContent = "";
    if (diagnostic) {
      diagnostic.style.display = "block";
      diagnostic.innerHTML = `<article class="panel" style="background:#fff8f0;border-color:#f4b648;"><p style="margin:0;color:#b45309;">${escapeHtml(t("ihNoDatasets"))}</p></article>`;
    }
    if (kpiTotal) kpiTotal.textContent = "0";
    if (kpiDatasets) kpiDatasets.textContent = "0";
    if (kpiConversations) kpiConversations.textContent = "0";
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    return;
  }

  // Populate dataset selector
  const datasetSel = byId("ihDatasetSelect");
  if (datasetSel && !datasetSel.dataset.hydrated) {
    datasetSel.dataset.hydrated = "1";
    datasetSel.innerHTML = `<option value="__all__">${escapeHtml(t("ihAllDatasetsLabel", { n: datasets.length }))}</option>` +
      datasets.map((d) => `<option value="${escapeHtml(d.id)}">${escapeHtml(d.name || d.targetLabel || d.id)} (${Number(d.analysis?.rowCount || 0).toLocaleString()} ${escapeHtml(t("ihRowsSuffix"))})</option>`).join("");
    datasetSel.addEventListener("change", () => {
      state.intentHandoverView.page = 1;
      delete byId("ihSourceFilter")?.dataset.hydrated;
      delete byId("ihCategoryFilter")?.dataset.hydrated;
      renderIntentHandovers();
    });
  }

  const selectedDatasetId = datasetSel?.value || "__all__";
  const targetDatasets = selectedDatasetId === "__all__"
    ? datasets
    : datasets.filter((d) => d.id === selectedDatasetId);

  // Collect all rows from selected datasets
  const allRows = targetDatasets.flatMap((d) => d.rows || []);
  const allHandoverRows = collectMainIntentHandoverRows(allRows);

  // Populate source + category filters
  const sourceSel = byId("ihSourceFilter");
  if (sourceSel && !sourceSel.dataset.hydrated) {
    sourceSel.dataset.hydrated = "1";
    const sources = Array.from(new Set(allHandoverRows.map((r) => r.sourceTable).filter(Boolean))).sort();
    sourceSel.innerHTML = `<option value="">${escapeHtml(t("ihAllTablesOption"))}</option>` +
      sources.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("");
    sourceSel.addEventListener("change", () => { state.intentHandoverView.page = 1; renderIntentHandovers(); });
  }
  const catSel = byId("ihCategoryFilter");
  if (catSel && !catSel.dataset.hydrated) {
    catSel.dataset.hydrated = "1";
    const cats = Array.from(new Set(allHandoverRows.map((r) => r.category).filter(Boolean))).sort();
    catSel.innerHTML = `<option value="">${escapeHtml(t("ihAllCategoriesOption"))}</option>` +
      cats.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
    catSel.addEventListener("change", () => { state.intentHandoverView.page = 1; renderIntentHandovers(); });
  }

  // Apply filters
  const search = String(byId("intentHandoverSearchInput")?.value || state.intentHandoverView.search || "").trim().toLowerCase();
  const sourceFilter = sourceSel?.value || "";
  const catFilter = catSel?.value || "";

  let filtered = allHandoverRows;
  if (sourceFilter) filtered = filtered.filter((r) => r.sourceTable === sourceFilter);
  if (catFilter) filtered = filtered.filter((r) => r.category === catFilter);
  if (search) {
    filtered = filtered.filter((r) =>
      String(r.contactId || "").toLowerCase().includes(search) ||
      String(r.conversationId || "").toLowerCase().includes(search) ||
      String(r.category || "").toLowerCase().includes(search) ||
      String(r.sourceTable || "").toLowerCase().includes(search)
    );
  }

  // Update KPIs
  const uniqueConvs = new Set(allHandoverRows.map((r) => r.conversationId).filter((v) => v && v !== "-")).size;
  if (kpiTotal) kpiTotal.textContent = allHandoverRows.length.toLocaleString();
  if (kpiDatasets) kpiDatasets.textContent = targetDatasets.length.toLocaleString();
  if (kpiConversations) kpiConversations.textContent = uniqueConvs.toLocaleString();

  // Diagnostic panel
  if (diagnostic) {
    if (allHandoverRows.length === 0) {
      const checked = targetDatasets.map((d) => {
        const cols = d.rows?.length ? Object.keys(d.rows[0]) : (d.analysis?.columns || []);
        const fields = detectConversationFields(cols);
        const flagCols = cols.filter((c) => HANDOVER_FLAG_RE.test(c));
        const fkCols = cols.filter((c) => HANDOVER_FK_RE.test(c));
        const signals = [];
        if (fields.category) signals.push(`${t("ihCatColLabel")}: <code>${escapeHtml(fields.category)}</code>`);
        if (flagCols.length) signals.push(`${t("ihFlagColsLabel")}: ${flagCols.map((c) => `<code>${escapeHtml(c)}</code>`).join(", ")}`);
        if (fkCols.length) signals.push(`${t("ihFkColLabel")}: ${fkCols.map((c) => `<code>${escapeHtml(c)}</code>`).join(", ")}`);
        return `<li><strong>${escapeHtml(d.name || d.targetLabel || d.id)}</strong> — ${escapeHtml(t("ihColsCount", { n: cols.length }))}${signals.length ? " · " + signals.join(" · ") : ` · ${t("ihNoSignals")}`}</li>`;
      }).join("");
      diagnostic.style.display = "block";
      diagnostic.innerHTML = `
        <article class="panel" style="background:#fff8f0;border:1px solid #f4b648;">
          <p style="margin:0 0 0.5rem;color:#92400e;font-weight:600;">${escapeHtml(t("ihNoHandoversFound"))}</p>
          <p class="muted" style="margin:0 0 0.4rem;">${escapeHtml(t("ihNoHandoversHint"))}</p>
          <p class="muted" style="margin:0 0 0.5rem;">${escapeHtml(t("ihNoHandoversDatasets"))}</p>
          <ul class="muted" style="font-size:0.82rem;">${checked}</ul>
          <p class="muted" style="margin:0.4rem 0 0;">${escapeHtml(t("ihNoHandoversChoose"))}</p>
        </article>`;
    } else {
      diagnostic.style.display = "none";
    }
  }

  // Render table
  const pageSize = Number(state.intentHandoverView.pageSize || 50);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(Math.max(1, Number(state.intentHandoverView.page || 1)), totalPages);
  state.intentHandoverView.page = currentPage;
  const startIdx = (currentPage - 1) * pageSize;
  const pageItems = filtered.slice(startIdx, startIdx + pageSize);

  if (!pageItems.length && allHandoverRows.length > 0) {
    tableWrap.innerHTML = `<p class="muted" style="padding:0.5rem;">${escapeHtml(t("ihNoResults"))}</p>`;
  } else if (pageItems.length) {
    const cols = ["conversationId", "contactId", "timestamp", "stepsToHandover", "category", "sourceTable"];
    const header = cols.map((c) => `<th>${escapeHtml(c)}</th>`).join("");
    const body = pageItems.map((r) => `<tr>${cols.map((c) => `<td>${escapeHtml(String(r[c] ?? "-"))}</td>`).join("")}</tr>`).join("");
    tableWrap.innerHTML = `<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
  } else {
    tableWrap.innerHTML = "";
  }

  summaryEl.textContent = t("ihSummaryText", { shown: filtered.length.toLocaleString(), total: allHandoverRows.length.toLocaleString() });
  pageInfo.textContent = t("ihPageInfo", { page: currentPage, total: totalPages });
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
  if (prevBtn) prevBtn.onclick = () => { state.intentHandoverView.page--; renderIntentHandovers(); };
  if (nextBtn) nextBtn.onclick = () => { state.intentHandoverView.page++; renderIntentHandovers(); };
}

function hydrateIntentQueryBuilder(dataset) {
  const whereColEl = byId("intentQueryWhereColumn");
  const distinctEl = byId("intentQueryDistinct");
  const limitEl = byId("intentQueryLimit");
  const selectPanel = byId("intentSelectPanel");
  const groupPanel = byId("intentGroupPanel");
  if (!whereColEl || !selectPanel || !groupPanel) return;

  const sample = collectMainIntentHandoverRows(dataset.rows || []).slice(0, 1)[0] || {};
  const baseCols = Object.keys(sample).filter((k) => k !== "rowData");
  const cols = baseCols.length ? baseCols : ["contactId", "conversationId", "timestamp", "stepsToHandover", "sourceTable"];

  const fillPanel = (panel, selected) => {
    const set = new Set((selected || []).map(String));
    panel.innerHTML = cols.map((c) => {
      const esc = escapeHtml(c);
      const checked = set.has(c) ? "checked" : "";
      return `<div class="ms-row"><input data-ms-opt="1" type="checkbox" id="${escapeHtml(panel.id)}-${esc}" value="${esc}" ${checked} /><label for="${escapeHtml(panel.id)}-${esc}">${esc}</label></div>`;
    }).join("");
  };
  fillPanel(selectPanel, state.intentQuery.select);
  fillPanel(groupPanel, state.intentQuery.groupBy);
  whereColEl.innerHTML = cols.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");

  const q = state.intentQuery;
  if (distinctEl) distinctEl.checked = !!q.distinct;
  if (limitEl) limitEl.value = String(q.limit || 500);
  if (q.whereColumn) whereColEl.value = q.whereColumn;
  updateIntentQuerySummary();
  updateIntentWhereValueSuggestions();
}

function updateIntentQuerySummary() {
  const el = byId("intentQuerySummary");
  const selectBtn = byId("intentSelectBtn");
  const groupBtn = byId("intentGroupBtn");
  if (!el || !selectBtn || !groupBtn) return;
  const q = state.intentQuery;
  const sel = (q.select || []).length ? q.select : [];
  const grp = (q.groupBy || []).length ? q.groupBy : [];
  selectBtn.textContent = sel.length ? sel.join(", ") : t("intentQuerySelectLabel");
  groupBtn.textContent = grp.length ? grp.join(", ") : t("intentQueryGroupByLabel");
  const where = (q.whereValue || "").trim()
    ? `${q.whereColumn || ""} ${q.whereOp || ""} ${String(q.whereValue).trim()}`
    : "-";
  el.textContent = `Select: ${sel.length ? sel.join(", ") : "-"} · Distinct: ${q.distinct ? "on" : "off"} · Group by: ${grp.length ? grp.join(", ") : "-"} · Where: ${where} · Limit: ${q.limit || 500}`;
}

function resolveTopicName(rawId) {
  const id = String(rawId ?? "").trim();
  if (!id || id === "-") return id;
  // Look up human-readable name from any loaded dim_topics-like dataset
  const topicsDs = (state.datasets || []).find((d) => /topic/i.test(d.name || d.id || ""));
  if (topicsDs) {
    const found = (topicsDs.rows || []).find((r) => {
      const idEntry = Object.entries(r).find(([k]) => /^topic_id$|^id$/i.test(k));
      return idEntry && String(idEntry[1]) === id;
    });
    if (found) {
      const nameEntry = Object.entries(found).find(([k]) => /name|label|title|description/i.test(k) && !/id$/i.test(k));
      if (nameEntry) return String(nameEntry[1]);
    }
  }
  return id;
}

function resolveHandoverCategory(row, cfg) {
  const catRaw = String(getRowValueCI(row, cfg.mainIntentColumn) || "-");
  // For star schemas: numeric FK → try to resolve topic name
  if (/^\d+$/.test(catRaw.trim())) return resolveTopicName(catRaw.trim());
  if (catRaw !== "-") return catRaw;
  // Fallback: find any descriptive text column
  for (const [key, val] of Object.entries(row)) {
    if (/reason|topic|category|intent|type/i.test(key) && typeof val === "string" && val.length > 1) return val;
  }
  return "-";
}

function collectMainIntentHandoverRows(rows) {
  const columns = rows.length ? Object.keys(rows[0]) : [];
  const cfg = buildIntentHandoverConfig(columns);
  const conversationStepCounts = new Map();
  const out = [];
  rows.forEach((row, idx) => {
    const conversationId = resolveHandoverConversationId(row, cfg);
    if (conversationId && conversationId !== "-") {
      const nextCount = (conversationStepCounts.get(conversationId) || 0) + 1;
      conversationStepCounts.set(conversationId, nextCount);
    }
    if (!isMainIntentHandover(row, cfg)) return;
    const contactId = resolveHandoverContactId(row, cfg, idx);
    const stepsToHandover =
      conversationId && conversationId !== "-" ? (conversationStepCounts.get(conversationId) || 1) : 1;
    const timestamp = String(getRowValueCI(row, cfg.timestampColumn) || "-");
    const category = resolveHandoverCategory(row, cfg);
    out.push({
      contactId,
      conversationId,
      sourceTable: resolveSourceTable(row),
      stepsToHandover,
      timestamp,
      category,
      rowData: row
    });
  });
  return out.sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
}

function getRowValueCI(row, key) {
  if (!row || !key) return undefined;
  if (Object.prototype.hasOwnProperty.call(row, key)) return row[key];
  const target = String(key).toLowerCase();
  const found = Object.keys(row).find((k) => String(k).toLowerCase() === target);
  return found ? row[found] : undefined;
}

const HANDOVER_TEXT_RE = /\bhandover\b|\bescalat|\btransfer\b|\bdoorverbind|\bmedewerker\b|\blive.?chat\b/;
const HANDOVER_FLAG_RE = /^(is_handover|handover_flag|was_handover|has_handover|is_escalat|was_escalat|is_transfer|was_transfer|transferred|handedover)/i;
const HANDOVER_FK_RE = /handover.*(reason|type|id)|reason.*handover|^handover_id$|^handover_reason_id$/i;

function isMainIntentHandover(row, cfg) {
  const config = cfg || INTENT_HANDOVER_CONFIG;

  // 1. Text intent/category column (original)
  const catVal = String(getRowValueCI(row, config.mainIntentColumn) || "").trim().toLowerCase();
  if (catVal && (catVal === "handover" || HANDOVER_TEXT_RE.test(catVal))) return true;

  // 2. Scan all columns — handles star-schema DBs where handover is a flag/FK, not text
  for (const [key, val] of Object.entries(row)) {
    // 2a. Boolean flag: is_handover=1, transferred=true, etc.
    if (HANDOVER_FLAG_RE.test(key)) {
      const sv = String(val).toLowerCase();
      if (val === 1 || val === true || sv === "1" || sv === "true" || sv === "yes" || sv === "ja") return true;
    }
    // 2b. Handover reason FK non-null: handover_reason_id being set means a handover occurred
    if (HANDOVER_FK_RE.test(key)) {
      if (val != null && val !== "" && val !== 0 && val !== "0" && val !== "-") return true;
    }
    // 2c. Any string column containing handover keywords
    if (typeof val === "string" && val.length > 1 && HANDOVER_TEXT_RE.test(val.toLowerCase())) return true;
  }

  return false;
}

function resolveHandoverContactId(row, cfg, idx) {
  const config = cfg || INTENT_HANDOVER_CONFIG;
  const direct = String(getRowValueCI(row, config.contactIdColumn) || "").trim();
  if (direct) return direct;
  const fallback = config.sessionIdColumns
    .map((col) => String(getRowValueCI(row, col) || "").trim())
    .find(Boolean);
  return fallback || `missing-${idx}`;
}

function resolveHandoverConversationId(row, cfg) {
  const config = cfg || INTENT_HANDOVER_CONFIG;
  const id = config.sessionIdColumns
    .map((col) => String(getRowValueCI(row, col) || "").trim())
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
  const cfg = rows.length ? buildIntentHandoverConfig(Object.keys(rows[0])) : INTENT_HANDOVER_CONFIG;
  return rows.filter((row) => String(getRowValueCI(row, cfg.contactIdColumn) || "").trim().toLowerCase() === contactId);
}

function collectFieldValues(rows, fieldName) {
  const values = [];
  rows.forEach((row) => {
    const value = String(getRowValueCI(row, fieldName) ?? "").trim();
    if (!value) return;
    values.push(value);
  });
  return values;
}

function renderIntentQueryResults() {
  const dataset = getActiveDataset();
  const wrap = byId("intentQueryResultsWrap");
  if (!wrap) return;
  if (!dataset) {
    wrap.innerHTML = `<p class="muted">${escapeHtml(t("noDataAvailable"))}</p>`;
    return;
  }
  const base = collectMainIntentHandoverRows(dataset.rows || []);
  const q = state.intentQuery || {};
  const whereCol = String(q.whereColumn || "");
  const whereOp = String(q.whereOp || "contains");
  const whereValRaw = String(q.whereValue || "");
  const whereVal = whereValRaw.trim().toLowerCase();
  const filtered = !whereCol || !whereVal
    ? base
    : base.filter((r) => {
        const cell = r[whereCol];
        const s = String(cell ?? "").trim();
        const sl = s.toLowerCase();
        if (whereOp === "contains") return sl.includes(whereVal);
        if (whereOp === "eq") return sl === whereVal;
        const ln = Number(cell);
        const rn = Number(whereValRaw);
        if (whereOp === "gt") return Number.isFinite(ln) && Number.isFinite(rn) && ln > rn;
        if (whereOp === "lt") return Number.isFinite(ln) && Number.isFinite(rn) && ln < rn;
        return true;
      });

  const select = Array.isArray(q.select) && q.select.length ? q.select : ["contactId", "conversationId"];
  const groupBy = Array.isArray(q.groupBy) ? q.groupBy.filter(Boolean) : [];
  const distinct = !!q.distinct;
  const limit = Math.max(1, Number(q.limit || 500));

  let outRows = [];
  if (groupBy.length) {
    const map = new Map();
    filtered.forEach((r) => {
      const key = groupBy.map((k) => String(r[k] ?? "")).join("||");
      const agg = map.get(key) || { __count: 0, __rows: [] };
      agg.__count += 1;
      agg.__rows.push(r);
      map.set(key, agg);
    });
    outRows = Array.from(map.entries()).map(([key, agg]) => {
      const first = agg.__rows[0] || {};
      const row = {};
      groupBy.forEach((k) => { row[k] = first[k]; });
      row.count = agg.__count;
      row.distinct_contacts = new Set(agg.__rows.map((x) => String(x.contactId || ""))).size;
      return row;
    });
    outRows.sort((a, b) => Number(b.count) - Number(a.count));
  } else {
    outRows = filtered.map((r) => {
      const row = {};
      select.forEach((k) => { row[k] = r[k]; });
      return row;
    });
    if (distinct) {
      const seen = new Set();
      outRows = outRows.filter((r) => {
        const key = JSON.stringify(r);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
  }

  const limited = outRows.slice(0, limit);
  const cols = limited.length ? Object.keys(limited[0]) : (groupBy.length ? [...groupBy, "count", "distinct_contacts"] : select);
  renderTable(wrap, limited, cols);
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
        <h4>${escapeHtml(mapIssueLabel(p.problem, a))}<span class="pill">${escapeHtml(String(p.frequency))}</span></h4>
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

function renderFrustrationTab() {
  const dataset = getActiveDataset();
  const wrap = byId("frustrationTableWrap");
  if (!wrap) return;
  if (!dataset) {
    wrap.innerHTML = "";
    destroyChart("frustrationBubble");
    return;
  }

  const a = dataset.analysis;
  const allRows = a.frustrationByCategory || [];

  const minVolRaw = byId("frustrationMinVolume")?.value?.trim();
  const minVol = minVolRaw ? Math.max(0, Number(minVolRaw) || 0) : 0;
  const sortBy = byId("frustrationSort")?.value || "correlationScore";
  const signalFilter = byId("frustrationSignalFilter")?.value || "all";

  let rows = allRows.filter((r) => r.volume >= minVol);
  if (signalFilter === "negative") rows = rows.filter((r) => r.negative > 0);
  if (signalFilter === "fallback") rows = rows.filter((r) => r.fallback > 0);
  if (signalFilter === "repeated") rows = rows.filter((r) => r.repeated > 0);
  if (signalFilter === "handover") rows = rows.filter((r) => r.handovers > 0);

  rows = [...rows].sort((a, b) => b[sortBy] - a[sortBy]);

  const top20 = rows.slice(0, 20);

  // Bubble chart: x = frustratie%, y = handover%, grootte = volume
  const maxVol = Math.max(1, ...top20.map((r) => r.volume));
  drawChart("frustrationBubble", "bubble", {
    datasets: [{
      label: "Categorie",
      data: top20.map((r) => ({
        x: r.frustrationPct,
        y: r.handoverPct,
        r: Math.max(4, Math.round((r.volume / maxVol) * 28)),
        cat: r.cat,
        volume: r.volume
      })),
      backgroundColor: top20.map((r) => {
        if (r.correlationScore >= 50) return "rgba(255,80,80,0.65)";
        if (r.correlationScore >= 25) return "rgba(244,182,72,0.65)";
        return "rgba(80,180,120,0.65)";
      }),
      borderColor: top20.map((r) => {
        if (r.correlationScore >= 50) return "#e03030";
        if (r.correlationScore >= 25) return "#d49020";
        return "#30a060";
      }),
      borderWidth: 1.5
    }]
  }, {
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const d = ctx.raw;
            return [`📂 ${d.cat}`, `${t("colVolume")}: ${d.volume}`, `${t("colFrustrationPct")}: ${d.x}%`, `${t("colHandoverPct")}: ${d.y}%`];
          }
        }
      }
    },
    scales: {
      x: { title: { display: true, text: t("colFrustrationPct") } },
      y: { title: { display: true, text: t("colHandoverPct") } }
    }
  });

  const riskLabel = (score) => {
    if (score >= 50) return `<span class="risk-badge risk-high">${escapeHtml(t("riskHigh"))}</span>`;
    if (score >= 25) return `<span class="risk-badge risk-medium">${escapeHtml(t("riskMedium"))}</span>`;
    return `<span class="risk-badge risk-low">${escapeHtml(t("riskLow"))}</span>`;
  };

  if (!rows.length) {
    wrap.innerHTML = `<p class="muted" style="padding:1rem;">${escapeHtml(t("frustrationNoData"))}</p>`;
    return;
  }

  wrap.innerHTML = `
    <table class="data-table frustration-table">
      <thead>
        <tr>
          <th>${escapeHtml(t("colCategory"))}</th>
          <th>${escapeHtml(t("colVolume"))}</th>
          <th title="${escapeHtml(t("frustrationSignalNegative"))}">😤 ${escapeHtml(t("colNegative"))}</th>
          <th title="${escapeHtml(t("frustrationSignalFallback"))}">🤖 ${escapeHtml(t("colFallback"))}</th>
          <th title="${escapeHtml(t("frustrationSignalRepeated"))}">🔁 ${escapeHtml(t("colRepeated"))}</th>
          <th title="${escapeHtml(t("frustrationSignalLongOpen"))}">⏱ ${escapeHtml(t("colLongOpen"))}</th>
          <th>${escapeHtml(t("colHandovers"))}</th>
          <th>${escapeHtml(t("colHandoverPct"))}</th>
          <th>${escapeHtml(t("colFrustrationPct"))}</th>
          <th>${escapeHtml(t("colCorrelationScore"))}</th>
          <th>${escapeHtml(t("colRisk"))}</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((r) => `
          <tr class="${r.correlationScore >= 50 ? "row-high" : r.correlationScore >= 25 ? "row-medium" : ""}">
            <td><strong>${escapeHtml(r.cat)}</strong></td>
            <td>${r.volume}</td>
            <td>${r.negative}</td>
            <td>${r.fallback}</td>
            <td>${r.repeated}</td>
            <td>${r.longUnres}</td>
            <td>${r.handovers}</td>
            <td>${r.handoverPct}%</td>
            <td>${r.frustrationPct}%</td>
            <td><strong>${r.correlationScore}</strong></td>
            <td>${riskLabel(r.correlationScore)}</td>
          </tr>`).join("")}
      </tbody>
    </table>`;
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

function getChartThemeColors() {
  const dark = document.documentElement.dataset.theme === "dark";
  return {
    text: dark ? "#e2e5f0" : "#1a1c2e",
    muted: dark ? "#8892b0" : "#5c6080",
    grid: dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"
  };
}

function drawChart(canvasId, type, data, extraOptions) {
  const existing = chartStore[canvasId];
  if (existing && existing.config.type === type) {
    // Update data in-place and refresh theme colors
    existing.data = data;
    const colors = getChartThemeColors();
    existing.options.plugins.legend.labels.color = colors.text;
    if (existing.options.scales) {
      ["x", "y"].forEach((axis) => {
        if (existing.options.scales[axis]) {
          existing.options.scales[axis].ticks.color = colors.muted;
          existing.options.scales[axis].grid.color = colors.grid;
        }
      });
    }
    existing.update("none");
    return;
  }
  destroyChart(canvasId);
  const ctx = byId(canvasId);
  if (!ctx) return;
  const colors = getChartThemeColors();
  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: colors.text } } },
    scales: type === "pie" ? {} : {
      x: { ticks: { color: colors.muted }, grid: { color: colors.grid } },
      y: { ticks: { color: colors.muted }, grid: { color: colors.grid } }
    }
  };
  const options = extraOptions
    ? deepMerge(baseOptions, extraOptions)
    : baseOptions;
  chartStore[canvasId] = new Chart(ctx, { type, data, options });
}

function deepMerge(target, source) {
  const out = Object.assign({}, target);
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
      out[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      out[key] = source[key];
    }
  }
  return out;
}

function destroyChart(id) {
  if (chartStore[id]) {
    chartStore[id].destroy();
    delete chartStore[id];
  }
}

function exportToCsv(rows, columns, filename) {
  if (!rows || !rows.length) return;
  const escape = (v) => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map(escape).join(",")];
  rows.forEach((row) => lines.push(columns.map((c) => escape(row[c])).join(",")));
  const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "export.csv";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
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
      state.comparison.mode = parsed.comparison.mode === "pair" ? "pair" : "all";
      state.comparison.left = parsed.comparison.left || "";
      state.comparison.right = parsed.comparison.right || "";
    }
    if (!state.datasets.find((d) => d.id === state.activeDatasetId) && state.datasets.length) {
      state.activeDatasetId = state.datasets[state.datasets.length - 1].id;
    }
    rebuildUnifiedDataset();
  } catch (error) {
    state.datasets = [];
    state.unifiedDataset = null;
    console.warn("Session restore failed, starting fresh:", error?.message || error);
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
      if (!datasets.length) {
        lastError = `${source}: database loaded but contained no usable tables`;
        continue;
      }
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
    showDbLoadingOverlay(t("overlayReloadingDb", { name: cached.name || "uploaded.db" }));
    const datasets = await analyzeDbBufferToDatasets(cached.bytes, cached.name || "uploaded.db");
    if (!datasets.length) { hideDbLoadingOverlay(); return false; }
    state.datasets = datasets;
    rebuildUnifiedDataset();
    persistLastActiveTarget();
    saveSession();
    hideDbLoadingOverlay();
    renderDatasetSelect();
    renderAll();
    setStatus(t("statusLoadedFromDb", { count: datasets.length }));
    return true;
  } catch {
    hideDbLoadingOverlay();
    return false;
  }
}

async function analyzeDbBufferToDatasets(bytes, sourceName) {
  setStatus(t("statusOpeningDb", { name: sourceName }));
  await new Promise((resolve) => setTimeout(resolve, 0)); // yield so status renders
  const SQL = await loadSqlJs();
  await new Promise((resolve) => setTimeout(resolve, 0)); // yield before heavy sync op
  const db = new SQL.Database(bytes);
  try {
    const tableRows = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
    const names = tableRows[0]?.values?.map((v) => String(v[0] || "").trim().toLowerCase()) || [];
    const out = [];
    for (const tableName of names) {
      const targetKey = resolveTableTarget(tableName);
      const targetDef = getTargetFileDefinition(targetKey) || { key: targetKey, label: tableName };
      const analyzed = await analyzeSqliteTable(db, tableName, sourceName);
      out.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: `${sourceName}::${tableName}`,
        targetKey: targetDef.key,
        targetLabel: targetDef.label,
        uploadedAt: new Date().toISOString(),
        rows: analyzed.rows,
        analysis: analyzed.analysis
      });
    }
    return out.sort((a, b) => getTargetOrder(a.targetKey) - getTargetOrder(b.targetKey));
  } finally {
    db.close();
  }
}

async function analyzeSqliteTable(db, tableName, sourceName) {
  const engine = createStreamingAnalyzer(`sqlite:${tableName}`);
  const safeTable = tableName.replace(/"/g, "\"\"");

  // Probe total row count so we can apply a LIMIT for very large tables.
  const MAX_TABLE_ROWS = 500000;
  let totalRowCount = 0;
  let isRowLimited = false;
  try {
    const countRes = db.exec(`SELECT COUNT(*) FROM "${safeTable}"`);
    totalRowCount = Number(countRes[0]?.values?.[0]?.[0] || 0);
    isRowLimited = totalRowCount > MAX_TABLE_ROWS;
  } catch (_) { /* ignore — fall through to full scan */ }

  const query = isRowLimited
    ? `SELECT * FROM "${safeTable}" LIMIT ${MAX_TABLE_ROWS}`
    : `SELECT * FROM "${safeTable}"`;
  const stmt = db.prepare(query);
  const BATCH = 2000;
  const YIELD_INTERVAL = 50; // ms — keep UI responsive
  let batch = [];
  let lastYieldTs = Date.now();
  try {
    while (stmt.step()) {
      const row = normalizeObjectRowHeaders(stmt.getAsObject());
      row.__sourceTable = tableName;
      batch.push(row);
      if (batch.length >= BATCH) {
        engine.ingestRows(batch);
        batch = [];
        const now = Date.now();
        if (now - lastYieldTs > YIELD_INTERVAL) {
          const rowLabel = isRowLimited
            ? `${engine.rowCount.toLocaleString()} / ${MAX_TABLE_ROWS.toLocaleString()}`
            : engine.rowCount.toLocaleString();
          setStatus(t("statusAnalyzingRows", { name: sourceName || tableName, rows: rowLabel }));
          await new Promise((resolve) => setTimeout(resolve, 0));
          lastYieldTs = now;
        }
      }
    }
    if (batch.length) engine.ingestRows(batch);
  } finally {
    stmt.free();
  }
  const result = engine.finalize();
  if (isRowLimited) {
    result.analysis.notes = result.analysis.notes || [];
    result.analysis.notes.unshift(
      `Table has ${totalRowCount.toLocaleString()} rows — analysis limited to the first ${MAX_TABLE_ROWS.toLocaleString()} rows for browser performance.`
    );
    result.analysis.totalDbRows = totalRowCount;
  }
  return result;
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

function savePayloadToStorage(_payload) {
  // Opslaan uitgeschakeld — data wordt nooit gecached tussen sessies.
  return false;
  // eslint-disable-next-line no-unreachable
  const serialized = JSON.stringify(_payload);
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
  return {
    ...dataset,
    targetKey: targetDef ? targetDef.key : (dataset.targetKey || ""),
    targetLabel: targetDef ? targetDef.label : (dataset.targetLabel || dataset.name || "Dataset")
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
  // Remove any API key that was previously persisted in localStorage.
  try {
    localStorage.removeItem(API_KEY_SESSION_KEY);
  } catch {
    // Ignore storage availability issues.
  }
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
  // Altijd de ingebouwde Nederlandse defaults laden — nooit vanuit localStorage.
  state.rules = cloneDefaultRules();
  state.regexes = buildRuleRegexes(state.rules);
}

function persistRules() {
  // Opslaan uitgeschakeld — regels worden altijd opnieuw geladen vanuit de defaults.
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
  // Mirror into loading overlay sub-text when it's visible
  const overlay = byId("dbLoadingOverlay");
  if (overlay && !overlay.hidden) {
    const sub = byId("dbLoadingStatus");
    if (sub && message) sub.textContent = message;
  }
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

function handleError(error, context = "") {
  const msg = error?.message || String(error || "Unknown error");
  const prefix = context ? `${context}: ` : "";
  hideDbLoadingOverlay();
  setStatus(t("statusUploadFailed", { error: `${prefix}${msg}` }));
}

function showDbLoadingOverlay(statusText) {
  const overlay = byId("dbLoadingOverlay");
  const sub = byId("dbLoadingStatus");
  if (overlay) overlay.hidden = false;
  if (sub && statusText) sub.textContent = statusText;
}

function hideDbLoadingOverlay() {
  const overlay = byId("dbLoadingOverlay");
  if (overlay) overlay.hidden = true;
}

function debounce(fn, ms) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

// ── Dark mode ────────────────────────────────────────────────
function loadDarkMode() {
  try { return localStorage.getItem(DARK_MODE_KEY) === "1"; } catch { return false; }
}

function persistDarkMode(enabled) {
  try { localStorage.setItem(DARK_MODE_KEY, enabled ? "1" : "0"); } catch { /* ignore */ }
}

function applyDarkMode(enabled) {
  document.documentElement.dataset.theme = enabled ? "dark" : "";
  const btn = byId("darkModeToggle");
  if (btn) btn.textContent = t(enabled ? "lightModeLabel" : "darkModeLabel");
}

function toggleDarkMode() {
  const current = document.documentElement.dataset.theme === "dark";
  const next = !current;
  applyDarkMode(next);
  persistDarkMode(next);
  // Re-render active chart to use updated theme colors
  renderActiveTab(state.activeTabId);
}

// ── Confirm modal (replaces window.confirm) ──────────────────
let _confirmResolve = null;

function showConfirm(message) {
  return new Promise((resolve) => {
    _confirmResolve = resolve;
    const msgEl = byId("confirmModalMessage");
    if (msgEl) msgEl.textContent = message;
    const bd = byId("confirmModalBackdrop");
    const modal = byId("confirmModal");
    if (bd) bd.hidden = false;
    if (modal) {
      modal.hidden = false;
      const okBtn = byId("confirmModalOkBtn");
      if (okBtn) setTimeout(() => okBtn.focus(), 0);
    }
  });
}

function closeConfirmModal(result) {
  byId("confirmModalBackdrop").hidden = true;
  byId("confirmModal").hidden = true;
  if (_confirmResolve) { _confirmResolve(result); _confirmResolve = null; }
}

// ── Chart PNG export ─────────────────────────────────────────
function exportChart(canvasId) {
  const chart = chartStore[canvasId];
  if (!chart) return;
  const url = chart.toBase64Image("image/png", 1);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${canvasId}.png`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => document.body.removeChild(a), 200);
}
window.exportChart = exportChart;

// ── CSV exports ──────────────────────────────────────────────
function exportActiveDataTableCsv() {
  const dataset = getActiveDataset();
  if (!dataset) return;
  const rows = dataset.rows || [];
  const keys = dataset.analysis?.columns || (rows.length ? Object.keys(rows[0]) : []);
  exportToCsv(rows, keys, `${String(dataset.name || "dataset").replace(/[^a-z0-9_-]/gi, "_")}.csv`);
}

function exportHandoversCsv() {
  const dataset = getActiveDataset();
  if (!dataset) return;
  const a = dataset.analysis;
  const rows = (a?.handoverRows || []).map((r) => ({ ...r, category: mapIssueLabel(r.category, a) }));
  exportToCsv(rows, ["conversationId", "handoverTime", "category", "issue", "sourceTable", "reason", "turns"], "handovers.csv");
}

function exportIntentHandoversCsv() {
  const targetDatasets = state.activeDatasetId === "unified"
    ? state.datasets
    : [getActiveDataset()].filter(Boolean);
  const rows = targetDatasets.flatMap((d) => collectMainIntentHandoverRows(d.rows || []));
  exportToCsv(rows, ["conversationId", "contactId", "timestamp", "stepsToHandover", "category", "sourceTable"], "intent_handovers.csv");
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
  // Anthropic Claude format
  if (data?.content?.[0]?.text) return data.content[0].text;
  // OpenAI-compatible format (legacy / proxy responses)
  if (data?.choices?.[0]?.message?.content) return data.choices[0].message.content;
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

const DATETIME_FAST_RE = /^\d{4}-\d{2}-\d{2}|^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/;
function isDatetime(v) {
  if (typeof v === "number") return Number.isFinite(v);
  const s = String(v);
  if (!DATETIME_FAST_RE.test(s)) return false;
  const d = new Date(s);
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
