# Gemini Technical Incident Summary

## Scope

This document explains why the legacy direct Gemini / Google AI Studio path could produce:

- apparently rich lead data that was sometimes misleading
- no data at all in some runs

It also explains why the current OpenRouter-based runtime behaves differently.

## Current Runtime Reality

The active web runtime imports OpenRouter, not the legacy Gemini service.

- Active runtime: `App.tsx` imports `generateLeads` and `generateDeepDiveSequential` from `services/openrouterService.ts`
- Legacy path: `services/geminiService.ts` still exists, but is no longer the primary web execution path

This distinction matters because historical Gemini behavior can still shape old expectations and documentation even when the live app now uses a different pipeline.

## High-Severity Findings

### 1. Gemini batch generation was not externally grounded

In the legacy batch path, `generateLeads(...)` calls Gemini with JSON output, but without the Google Search tool and without a second verification pass.

Practical consequence:

- the model could still return plausible structured leads
- but those leads were often synthesis, not evidence-backed extraction
- therefore the system could return data-shaped output that looked complete while containing guessed or weakly inferred values

This is the single strongest explanation for "we got data, but some of it was misleading".

### 2. Gemini deep-dive reused coarse response-level grounding as if it were field-level evidence

The deep-dive path extracted grounding URLs from the Gemini response and then selected one source URL per category such as financial, addresses, decision makers, payment, web software, and news.

That source URL was then attached to many fields via `buildFieldEvidence(...)` even though those fields were not independently extracted from that exact source.

Practical consequence:

- the UI could display evidence metadata that looked precise
- but the evidence was category-level, not field-level
- this created false confidence around address, store, payment, and contact fields

This is the strongest explanation for "the answer looked sourced, but parts of it were still wrong".

### 3. The legacy Gemini deep-dive dropped `activeMarkets` outright

In the legacy deep-dive lead mapping, the lead object set:

- `activeMarkets: []`

even though evidence and raw JSON could contain market information.

Practical consequence:

- market data could exist in the model output
- but the final lead object still lost it
- users would see missing market data and interpret it as retrieval failure

This is a direct code bug, not a model-quality issue.

### 4. The legacy Gemini path trusted model-emitted operational fields too early

Fields such as these were accepted directly from model output with limited or no independent extraction:

- `address`
- `visitingAddress`
- `warehouseAddress`
- `storeCount`
- `paymentProvider`
- `checkoutSolution`
- `decisionMakers`

Practical consequence:

- if Gemini inferred from weak web context, breadcrumbs, or adjacent text, the app still treated that value as usable lead data
- this especially affects logistics and retail footprint fields, where websites often present incomplete or marketing-oriented content

### 5. Batch failure handling silently collapsed to empty output

In the legacy batch path:

- empty model text returns `[]`
- JSON parse failure returns `[]`
- failed repair also returns `[]`

Practical consequence:

- "no data at all" often meant transport/parsing/schema failure rather than a real absence of candidate companies
- because the error path flattened into an empty list, operators had very low observability

This is the strongest explanation for "sometimes we got nothing".

## Medium-Severity Findings

### 6. Gemini retry behavior focused on rate limit, not content validity

The legacy retry layer retried quota/rate-limit failures, but it did not add structured recovery for:

- malformed JSON with semantically broken structure
- partially grounded responses
- empty-but-successful content
- weak evidence density
- field-level contradictions

Practical consequence:

- the system could receive a formally successful model response and still produce poor lead data

### 7. Retrieval, reasoning, and extraction were fused into one model turn

The legacy Gemini design effectively asked one model call to do all of the following at once:

- search the web
- identify the right company
- choose the right sources
- extract structured facts
- normalize them into lead schema

Practical consequence:

- when retrieval quality was mixed, the model compensated by inferring
- when evidence was sparse, the model still attempted to complete the schema
- when multiple sources conflicted, there was no explicit reconciliation layer

This is a classic architecture pattern that produces outputs that are impressively filled in but not reliably auditable.

### 8. The legacy Gemini path lacked per-step observability

Compared to the current OpenRouter pipeline, the legacy Gemini path had limited diagnostics for:

- which external sources were actually used
- which fields were independently verified
- where the pipeline fell back to model inference
- why a run returned empty output

Practical consequence:

- debugging became guesswork
- operators saw end results, but not the internal confidence gradient across fields

## Why Gemini / AI Studio Could Return Data That Looked Good But Was Misleading

The short answer is:

Gemini was good at producing coherent structured JSON from broad grounded context, but the application treated coherence as evidence.

More specifically:

1. Google Search grounding improved answer fluency and topical relevance.
2. The model then filled a broad lead schema in one pass.
3. The app attached category-level source URLs to multiple downstream fields.
4. The UI rendered those fields as if they were meaningfully verified.

That combination is exactly how a system can feel data-rich while still drifting into inaccuracies.

## Why Gemini / AI Studio Could Return No Data At All

The short answer is:

the legacy batch path converted several different failure modes into the same empty-array result.

Main technical causes:

1. Empty text response from the model.
2. JSON parse failure.
3. JSON repair failure.
4. No fallback enrichment step after parse failure.
5. No structured error object preserved for operators.

So a user-visible "no results" event did not necessarily mean Gemini found nothing. It often meant the app could not successfully convert the response into trusted lead objects.

## Why the Current OpenRouter Path Performs Better Structurally

The OpenRouter path is not better simply because it uses another model vendor. It is better because the pipeline design changed.

The current path separates concerns into phases:

- source grounding
- direct financial registry crawl
- checkout crawl
- payment detection
- structured tech profiling
- retail footprint extraction
- targeted decision-maker search
- verified news search

It also records:

- `analysisSteps`
- `analysisWarnings`
- `analysisTelemetry`
- `sourceCoverage`
- `verifiedFieldEvidence`

And, critically, unsupported fields are increasingly left empty instead of silently guessed.

That architecture change is more important than the model switch itself.

## Direct Comparison: Legacy Gemini vs Current Verified Pipeline

### Legacy Gemini pattern

- one-shot structured generation
- optional broad grounding
- category-level evidence reuse
- weak field-level verification
- silent empty-array failure modes

### Current verified pattern

- multi-phase enrichment
- direct crawl and targeted extraction
- field-level evidence objects
- explicit warnings for missing verified data
- diagnostics preserved in the lead object

## Technical Summary for Gemini Team

The main issue was not that Gemini could not return data. The issue was that the application architecture let model-generated structure outrun evidence discipline.

In our legacy direct Gemini / AI Studio integration:

- batch generation was effectively ungrounded structured synthesis
- deep-dive grounding was too coarse and reused at category level rather than field level
- some fields were lost during mapping
- parse and repair failures degraded to empty arrays with low observability
- the UI could overstate verification because evidence labels were attached too broadly

If we were to reintroduce Gemini into the critical path, the minimum technical requirements would be:

1. Separate retrieval from extraction.
2. Require field-level provenance, not category-level provenance.
3. Fail loudly on parse/schema collapse instead of returning empty success-like arrays.
4. Keep unsupported fields empty.
5. Add per-step diagnostics and source coverage tracking.
6. Treat model JSON as a draft until independent verification has run.

## Recommended Internal Conclusion

The historical "Gemini gave us data" outcome was real, but much of that success came from the model being willing to complete the schema. That is useful for prototyping and exploration, but unsafe for operational lead intelligence unless surrounded by a stricter verification layer.

The historical "Gemini gave us nothing" outcome was also real, but it was amplified by the app's silent parse-to-empty behavior.

So the root cause is not a single vendor/model failure. It is the interaction between:

- one-shot grounded generation
- weak field-level provenance
- permissive schema acceptance
- silent failure flattening

That is why the same system could alternate between:

- data-rich but misleading
- empty and opaque
