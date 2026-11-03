# Evidence review and reusable workflow

## Authority and rule precedence

Read the live July 2025 guide and the original Nadia Brennan interview. Class-code paragraph references are parsed from the guide, not inferred from ordering. Interview clarifications have timestamps, not invented guide paragraph numbers.

| Authority | Treatment |
|---|---|
| CG-02; interview 10:56–10:58 | Actual duties and records decide rather than titles or application assertions. |
| CG-03; interview 11:00 | Gross remuneration counts, including bonuses; documented expense reimbursements do not. Out-of-town daily allowance excludes at most $47/person/day. Include excess. Zero-day allowances have no supported daily exclusion and are provisionally included pending evidence. Do not invent an overtime premium exclusion. |
| CG-04; interview 11:00–11:01 | Up to four established site days retains clerical. At least five transfers whole pay to the largest field-payroll code, including assessable subcontractors, before office transfers. Ties stop for review. A log with no established field duties or governing field code requires a proposal/open question. |
| CG-05 | Filed owner exclusion means no owner payroll; included owners follow actual duties. Current records say excluded owners are absent from registers. If a new register includes an excluded owner, extend/test explicit exclusion handling; never silently omit or include it. |
| CG-06; interview 10:56, 10:59 | Without demonstrated coverage for the WHOLE audit period, include 60% of each subcontractor payment under the work's code. Round half-up per payment to cents; disclose that convention for confirmation. A payment before policy expiration does not establish full-period coverage. Name aliases require reviewed evidence and confirmation. |
| CG-07; interview 10:57 | At mixed roofing/siding contractors, at least 15 distinct roof dates means whole-pay R-310 (CG-11); fewer means R-320 (CG-12). Do not split. This specific clarification takes precedence over generic time division. |
| CG-31, CG-07 | Drivers and vehicle helpers fit T-610. Route days/weekly pay do not establish hours by duty. Current proposals use whole-pay T-610 for documented helpers, explicitly provisional even for infrequent rides. Request time records and auditor approval; invent neither hours nor a weekly classification rule. |
| CG-41, CG-42; interview 10:58 | F-720 requires at least 40% employer off-site catering receipts; below that use F-710. Missing, empty, incomplete or unusable receipts establish neither result. Leave affected catering payroll unallocated, generate a named unresolved question and block publication until evidence is complete. Compare exact integer amounts. Flag a receipts window different from audit dates; do not invent sales at the period boundaries. |
| Interview 10:58, 11:01 | Confirm every adjustment and deciding record. For incomplete evidence, propose a treatment with rationale and an open item for auditor/employer confirmation. |

No rates, premium, public manuals or inferred legal coverage. Unsupported duties require review and a tested extension.

## New employers and changed records

1. Read the application, description, field notes, register and every supporting file live from the auditor-provided source. Verify the inventory and audit period, not just filenames.
2. Add an employer to `sources.json`: `slug`, folder `url`, `files` with actual `id`, `name`, `url`, and `review` (relative to the manifest directory). Retain original interview and guide authority. Classification must not branch on employer names.
3. Create a reviewed-facts JSON file like the existing `reviews/*.json`: `fieldBusiness` boolean; `duties` keyed by register employee ID, each with `work` and a source-grounded `basis`; `sourceHashes` for every complete source text; `callReason`; and any `openItems`.

Supported work categories: `office`, `roof-siding`, `residential`, `electrical`, `delivery`, `restaurant`, `catering`, `landscaping`, `metal-fabrication`, `parking`, `home-health`. Each requires actual-duty evidence. Do not assign from titles alone. No wages or output totals belong in the review. Supply `tradeCodes` (reviewed trade label → guide code) and `subcontractorAliases` (payment name → certificate name) when relevant, and flag uncertain identities. Unknown work stops rather than guessing.

For receipts, an optional `receiptWindow` contains `startMonth`, `endMonth` (`YYYY-MM`) and a nonempty source-grounded `basis`. This describes the source's documented sales reporting period; it does not approve a mismatch with the audit dates. Every month in that window must have both dining and catering amounts, with no duplicate or unexpected months. Without a reviewed window, require all audit-period months. Zero total receipts cannot establish a percentage. The current bistro review identifies the twelve rows supplied for July 2025–June 2026; the existing audit-period alignment question remains open.

Receipt requirements are employer-level evidence dependencies, not dependent only on employee duty labels. A catering duty, a present or previously reviewed receipts source, a reviewed receipt window, or a catering/F-720 mention in the business description, field notes or application triggers assessment. Optional `cateringOperations: {"thresholdRelevant": true, "basis": "source-grounded reviewed operations evidence"}` explicitly records relevance. An incidental or negative source mention may be resolved by `thresholdRelevant: false` with a reviewed nonempty basis; this cannot override catering duties or a required receipts source/window. Do not infer employee catering duties from a keyword. Unknown required receipts set `receiptEvidenceUnknown` and block publication even when known restaurant payroll remains allocated and `unallocated` is zero; request missing receipts and actual-duty reconciliation rather than changing codes.

Reconcile site-log employee IDs, route drivers/passengers and time-record employee IDs with payroll. Unexplained IDs (or missing required IDs) create source-, row- and date-specific open employer questions. A blank optional route passenger is allowed. Documented nonemployee visitors may be recorded in `visitors` entries containing `source`, `field`, exact `id` and/or `name`, and a nonempty evidence `basis`. Site visitors and route passengers can be documented this way; driver and work-time IDs still require payroll reconciliation. A name or visitor label alone is not an evidence-backed exemption. The source hashes continue to cover every original record.

A route passenger is empty only when both its ID and passenger name are absent/blank. A named passenger without an ID requires reconciliation unless a source-grounded visitor review matches. Timesheet hours must be finite and positive; reject Infinity, overflow to infinity, NaN, zero and negative values. Financial rationale verification consumes complete monetary tokens and rejects extra decimals, exponent notation and malformed grouping instead of accepting a valid numeric prefix. Integer amounts such as the documented $47 daily cap and normal sentence punctuation remain supported.

4. Calculate SHA-256 from complete UTF-8 source text, preserving text exactly; the interview hash covers its original bytes. A changed hash means reread the record and review facts/open items before accepting the new hash. A changed guide means review the policy logic and paragraph mappings too. Updating hashes alone is not evidence review.
5. Test, then run the new employer to an isolated output folder using `--employer <slug>` and optionally `--manifest <path>`. One-employer reports cover only that selection; do not overwrite all-six reports accidentally.

## Input schemas

Markdown `business-description.md` contains `Audit period Month D, YYYY to Month D, YYYY`. `application.md` has class/employee-count/payroll table rows. Unsupported layouts require explicit normalization and tests with original-source provenance; never alter original sources merely to satisfy a parser.

CSV columns consumed (extra columns permitted):

- `payroll-register.csv`: `employee_id,name,position,wages_paid`; optional `travel_days,travel_allowance_paid` with allowances additional to wages, subject to confirmation.
- `site-signin-log.csv`: `date,employee_id`; anonymous visitors are not assigned to employees.
- `crew-timesheets.csv`: `date,employee_id,work_type,hours`; supported types `roofing,siding,gutters`; positive hours and in-period dates.
- `route-log.csv`: `date,driver_id,ride_along_id`; recorded helpers trigger the explicit provisional treatment.
- `weekly-payroll.csv`: `week_start,week_end,employee_id,gross_pay`; unique employee/week, Monday–Sunday; amounts reconcile to register.
- `gross-receipts.csv`: `month,dine_in_receipts,offsite_catering_receipts`; unique months.
- `subcontractor-payments.csv`: `date,subcontractor,work,invoice,amount_paid`.
- `insurance-certificates.csv`: `subcontractor,certificate_no,coverage_from,coverage_to`.

## Connected source transport

Default execution downloads every source live. If direct download fails, use connected Google Drive to fetch the guide and each selected file during this run, then write `.work/current-sources.json` with this structure:

```json
{"fetchedAt":"actual UTC retrieval timestamp","guide":{"content":"complete live guide text"},"documents":[{"folder":"manifest employer slug","title":"exact source filename","content":"complete live source text"}]}
```

Those strings describe a schema, not source evidence. Use only complete actual connector returns. Immediately invoke the normal command with `--source-packet .work/current-sources.json`. Packets older than 15 minutes are rejected and source hashes still apply. A timestamp alone does not prove freshness: refetch every file for each invocation; never relabel cached content. `.work/` is ignored. This transport and source manifests are not coding-session capture records.

## Output limits

Evidence-backed provisional CSV proposals must be read with the report and questions; no final sign-off is implied. Unknown catering thresholds are different: `classify` returns the amount as `unallocated`, leaves its code unset and supplies named employer questions. `run` throws an `Unresolved payroll` error with those questions (also available in `error.questions`) before writing any outputs. The CLI prints the questions; no F-710/F-720 choice is published. Existing outputs are preserved and remain from their previous successful run.

The verifier checks the generated report format within each employer section: reported/proposed/difference code-table amounts, employee and subcontractor allocations, money in adjustment rationales, summary and reconciliation totals, financial-evidence totals and call-priority exposure. Missing or duplicated expected sections/decisions fail. This verifies numeric consistency with the records and calculated result, not an independent policy interpretation. Intentional changes to the generated report format require updating and testing the parser. Every adjustment and source must still have a named confirmation question. Call ranking uses payroll movements/additions rather than invented premium rates, with written judgment about evidence risk.

## Independent regression expectations and specific questions

`scripts/expected-audits.mjs` records manually reviewed decisions for the six original employers, with explicit employee wages/codes, allowance additions, subcontractor payments/coverage decisions, class totals, acceptance and exposure. Its calculation uses separate BigInt arithmetic, not production payroll helpers or classifier output. `scripts/fixtures/six-employer-sources.json` preserves freshly retrieved source texts and hashes solely for offline tests. Live verification always refetches sources and requires their hashes to match the reviewed baseline before comparing individual decisions and totals. A changed source, policy or authorized provisional treatment requires rereading evidence and deliberately reviewing baseline entries and tests; do not copy new classifier outputs into expectations. New employers retain ordinary integrity checks until a separate independent baseline is reviewed.

The baseline is case-specific and includes unresolved proposals, especially whole-pay T-610 for both courier dispatchers. It does not authorize a policy or settle open questions. The verifier still uses the classifier for report-format consistency and for employers outside this baseline. No general division algorithm or register-owner exclusion handling is introduced here.

For attendance disputes, name the employee and ID, source file and actual dates; long logs may use the count, first/last dates and request for complete duty-time evidence. For payment disputes, identify invoice/date/paid amount, assessed addition, certificate entity/coverage dates and missing renewal or identity evidence. For allowances without payment dates, explicitly request dates, purpose and receipts. Keep CG/interview references and linked source/hash references alongside employer question sections. Do not frame a requested confirmation as an answer or change provisional allocations while improving question wording.
