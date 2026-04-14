# Release Notes - 2026-04-14

## Scope

Deze release bundelt de updates aan het Support Analytics Dashboard met focus op:
- database-laden en persistentie
- handover-analyse en modal-detail
- tab- en navigatie-aanpassingen
- stabiliteit voor deploys met grote `.db` bestanden

## Belangrijkste verbeteringen

### 1) Database loading en deploy-gedrag
- Grote database (`fontys_cgny.db`) correct via Git LFS verwerkt.
- Betere foutdiagnostiek toegevoegd als een deploy alleen een LFS pointer ziet in plaats van echte SQLite bytes.
- Fallback-gedrag voor databronnen verbeterd.
- Duidelijke statusmeldingen toegevoegd bij load errors.

### 2) Persistentie na refresh
- Session/local opslagflow verbeterd.
- Extra persistentielaag toegevoegd met IndexedDB cache van geuploade `.db` bestanden.
- Resultaat: na refresh hoeft gebruiker de database niet opnieuw te selecteren.
- `Clear Data` wist nu ook de geuploade DB-cache.

### 3) Database Upload tab
- Nieuwe tab toegevoegd om lokaal een `.db` te kiezen en direct te analyseren.
- Upload + analyse gekoppeld aan bestaande analysemotor.

### 4) Intent Handovers UX
- Paginering toegevoegd (20 items per pagina).
- `Prev`/`Next` navigatie toegevoegd.
- `Go to page` toegevoegd (knop + Enter).
- Step-filter iteratie uitgevoerd en daarna vervangen door go-to-page flow.

### 5) Handover Contact Detail modal
- Waardecellen klikbaar gemaakt om direct naar clipboard te kopieren.
- Hover feedback en statusmelding bij kopieren toegevoegd.
- Onderaan modal twee extra lijsten:
  - alle `INPUTTEXT_anonymized` waarden
  - alle `CUSTOMER_INPUT_TEXT_anonymized` waarden
- Deze lijsten zijn nu strikt gefilterd op geselecteerde `CONTACTID`.

### 6) Consistente data over alle tabellen
- Dashboard omgezet naar een unified data-aanpak zodat tabbladen dezelfde gecombineerde databron gebruiken.
- `sourceTable` zichtbaar gemaakt in handover-context zodat herkomst per rij duidelijk is.

## Navigatie en layout

- Tabnavigatie vereenvoudigd in de topbar.
- Focus op actieve analyse-tabs en directe toegang tot uploadflow.

## Technische impact

- Hoofdlogica aangepast in `app.large.js`.
- UI updates in `index.html` en `style.css`.
- Geen auth-flow toegevoegd; huidige open-dashboard model blijft intact.

## Bekende aandachtspunten

- Grote `.db` bestanden op hosted platforms vragen nog steeds correcte file-hosting/fallback setup.
- Voor online brongebruik moet de databron-URL direct binaire SQLite content leveren (geen HTML/blob pagina).

## Samenvatting

Deze release maakt het dashboard stabieler in dagelijks gebruik: betere load-fouten, echte refresh-persistentie, sterkere handover-detailweergave, en duidelijkere database-herkomst in analyses.

