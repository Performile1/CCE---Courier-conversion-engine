# OpenRouter Observability Refactor Plan

## Objective

Move the analysis pipeline from partially observable sequential enrichment to fully auditable field verification without rebuilding parts that already exist.

This plan assumes the current runtime is the OpenRouter path in `App.tsx` and that `LeadCard.tsx` already renders diagnostics from `analysisSteps`, `analysisWarnings`, `analysisTelemetry`, and `analysisCompleteness`.

## What Already Exists

Do not rebuild these as if they were missing:

- `AnalysisStep`, `AnalysisErrorCode`, and step-level status contracts already exist in `types.ts`
- diagnostics UI already exists in `components/LeadCard.tsx`
- `openrouterService.ts` already performs phased enrichment for financials, checkout, payment, tech, retail footprint, contacts, and news
- cron runner already persists `last_status`, `last_result_summary`, and `last_error`

The next work should improve signal quality, step metadata, failure semantics, and service composition.

## Phase 1: Harden Existing Step Observability

### Goal

Turn the current diagnostics model into a real StepVisualizer data source instead of introducing a second observability layer.

### Changes

1. Extend `AnalysisStep` in `types.ts` with execution metadata:
   - `provider?: 'openrouter' | 'tavily' | 'crawl4ai' | 'registry' | 'internal'`
   - `startedAt?: string`
   - `completedAt?: string`
   - `affectedFields?: VerifiedLeadField[]`

2. Populate those fields in `openrouterService.ts` wherever `publishStep` / `upsertAnalysisStep` is used.

3. Refine step summaries so they are machine-generated but user-readable:
   - example: `Partial: revenue verified, profit missing`
   - example: `Failed: crawl blocked by robots.txt`
   - example: `Skipped: policy rejected weak source match`

4. Upgrade `LeadCard.tsx` diagnostics rendering into a proper StepVisualizer presentation:
   - horizontal timeline on desktop
   - compact stacked list on mobile
   - tooltip or expandable metadata for `provider`, `sourceDomains`, `errorCode`, and `fallbackFromStep`

### Files

- `types.ts`
- `services/openrouterService.ts`
- `components/LeadCard.tsx`

### Acceptance Criteria

- every non-trivial pipeline step records provider and affected fields
- every failed or partial step has `summary` plus `errorCode` when applicable
- no additional ad hoc telemetry format is introduced in parallel to `AnalysisStep`

## Phase 2: Normalize Policy Editing Around AnalysisPolicy

### Goal

Stop treating policy as scattered manager state and make `AnalysisPolicy` the primary editable contract.

### Changes

1. Audit where policy currently lives:
   - `App.tsx`
   - `services/analysisPolicy.ts`
   - `NewsSourceManager` and related managers

2. Move editor semantics toward `AnalysisPolicy` rather than raw `SourcePolicyConfig` fragments.

3. Keep backward compatibility by continuing to build policy from existing source config until the UI is fully migrated.

4. Expose these as explicit operator controls:
   - matching strictness
   - trusted domains
   - category hints
   - batch enrichment limit
   - fallback allowances
   - earliest news year

### Files

- `App.tsx`
- `services/analysisPolicy.ts`
- manager components that currently mutate policy-like state

### Acceptance Criteria

- a user can inspect and edit effective policy without reading service code
- deep-dive and batch policy differences are visible and intentional
- no new policy branch is added outside `AnalysisPolicy`

## Phase 3: Extract Orchestrator From Existing Pipeline

### Goal

Refactor `openrouterService.ts` into explicit orchestration steps without rewriting behavior from scratch.

### Important Constraint

Do not start by redesigning the whole service around a hypothetical architecture. Extract the current steps in place and preserve behavior.

### Step Order

1. `resolveIdentity(...)`
   - inputs: company name, org number, policy
   - outputs: resolved entity, aliases, strict-match decision, identity `AnalysisStep`
   - abort downstream enrichment on ambiguity or strict mismatch

2. `fetchGroundingBundle(...)`
   - wraps Tavily / search grounding
   - returns prompt evidence, source coverage, domain hits, grounding step

3. `fetchVerifiedFinancials(...)`
   - wraps current direct registry crawl path
   - returns parsed registry fields plus financial step

4. `enrichCommercialSignals(...)`
   - wraps checkout crawl
   - payment detection
   - tech profile detection
   - retail footprint detection
   - returns normalized enrichment bundle plus multiple steps

5. `fetchVerifiedContacts(...)`
   - targeted decision-maker search
   - returns contacts plus contacts step

6. `fetchVerifiedNews(...)`
   - verified news retrieval and policy filtering
   - returns items, summary, step

7. `extractModelDraft(...)`
   - OpenRouter maps grounded prompt evidence into schema draft
   - output is explicitly treated as draft, not final lead data

8. `materializeLeadFromEvidence(...)`
   - merges draft + verified evidence
   - unsupported fields remain empty/null
   - creates `verifiedFieldEvidence`, `analysisWarnings`, `analysisCompleteness`, `sourceCoverage`

### Contract Rule

If a field cannot be tied to evidence, it must remain empty or null. No qualified guesses for critical retail and address fields.

### Files

- `services/openrouterService.ts`
- possibly new helper modules under `services/` if extraction becomes too large

### Acceptance Criteria

- the current monolith becomes a thin orchestrator with named step helpers
- each helper returns data plus step metadata
- field materialization is isolated from retrieval and model drafting

## Phase 4: Replace Silent Collapse With Structured Failure Semantics

### Goal

Make parse and enrichment failures observable in both UI and backend job execution without polluting the main lead contract.

### Changes

1. Add a lightweight lead processing state contract in `types.ts`:
   - `processingStatus?: 'ready' | 'partial' | 'failed'`
   - `processingErrorCode?: AnalysisErrorCode | 'parse_failed' | 'schema_invalid'`
   - `processingErrorMessage?: string`

2. In batch generation, when one candidate fails to parse or materialize:
   - keep the lead only if identity is known
   - mark it `processingStatus: 'failed'`
   - surface the failure in diagnostics
   - do not silently drop it unless identity itself is unusable

3. In cron execution:
   - preserve current `last_error`
   - evaluate whether structured JSON should go into the same field or a new field after requirements are clear
   - do not add `last_error_log` until the payload format is specified

4. In UI:
   - failed leads should render as degraded but visible, not disappear
   - StepVisualizer should show parse/schema failure as explicit terminal status

### Files

- `types.ts`
- `services/openrouterService.ts`
- `api/cron-runner.ts`
- lead rendering components that assume all leads are healthy

### Acceptance Criteria

- “no results” is reserved for true absence, not parse collapse
- cron errors retain operator-readable detail
- a failed lead is inspectable if identity was resolved

## Recommended Execution Order

### Immediate

1. Phase 1
2. Phase 4 type contract

### Next

3. Phase 3 extraction of orchestrator helpers

### After that

4. Phase 2 policy-editor normalization

Reason:

- observability must improve before major refactor
- failure semantics must be defined before batch behavior changes
- orchestrator extraction is safer once step metadata and failure contracts are stable
- policy UI should follow the stabilized backend contract, not lead it

## Explicit Non-Goals

These should not be part of the first pass:

- replacing the whole OpenRouter prompt strategy in one rewrite
- introducing a second diagnostics model beside `AnalysisStep`
- adding new database columns before error payload format is defined
- reintroducing inferred default values for unsupported fields

## Suggested Ticket Breakdown

### Ticket 1

Enhance `AnalysisStep` with provider and affected field metadata.

### Ticket 2

Replace current diagnostics list rendering in `LeadCard.tsx` with StepVisualizer UI built on existing step data.

### Ticket 3

Add explicit processing failure contract to `LeadData` and propagate parse/materialization failures.

### Ticket 4

Extract `resolveIdentity` and `fetchGroundingBundle` from `openrouterService.ts`.

### Ticket 5

Extract commercial enrichment helpers: checkout, payment, tech, retail footprint.

### Ticket 6

Extract `materializeLeadFromEvidence` and make unsupported fields remain empty by contract.

### Ticket 7

Normalize policy editing UI around `AnalysisPolicy` and expose deep-dive vs batch differences.

## Bottom Line

The right next step is not “start over with a new architecture.”

The right next step is:

- strengthen the existing step contract
- expose it clearly in the UI
- define structured failure semantics
- then extract the existing pipeline into named orchestrator units

That sequence lowers risk, improves trust fast, and avoids rebuilding capabilities that are already present in the codebase.
