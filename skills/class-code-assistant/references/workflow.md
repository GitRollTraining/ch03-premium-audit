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
| CG-41, CG-42; interview 10:58 | F-720 requires at least 40% employer off-site catering receipts; below that use F-710. Compare exact integer amounts. Flag a receipts window different from audit dates; do not invent sales at the period boundaries. |
| Interview 10:58, 11:01 | Confirm every adjustment and deciding record. For incomplete evidence, propose a treatment with rationale and an open item for auditor/employer confirmation. |

No rates, premium, public manuals or inferred legal coverage. Unsupported duties require review and a tested extension.

## New employers and changed records

1. Read the application, description, field notes, register and every supporting file live from the auditor-provided source. Verify the inventory and audit period, not just filenames.
2. Add an employer to `sources.json`: `slug`, folder `url`, `files` with actual `id`, `name`, `url`, and `review` (relative to the manifest directory). Retain original interview and guide authority. Classification must not branch on employer names.
3. Create a reviewed-facts JSON file like the existing `reviews/*.json`: `fieldBusiness` boolean; `duties` keyed by register employee ID, each with `work` and a source-grounded `basis`; `sourceHashes` for every complete source text; `callReason`; and any `openItems`.

Supported work categories: `office`, `roof-siding`, `residential`, `electrical`, `delivery`, `restaurant`, `catering`, `landscaping`, `metal-fabrication`, `parking`, `home-health`. Each requires actual-duty evidence. Do not assign from titles alone. No wages or output totals belong in the review. Supply `tradeCodes` (reviewed trade label → guide code) and `subcontractorAliases` (payment name → certificate name) when relevant, and flag uncertain identities. Unknown work stops rather than guessing.

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

CSV proposals include unresolved treatments to provide complete first-pass allocations. Read them with the report and questions; no final sign-off is implied. Validation occurs before output writes. A failed run leaves prior outputs in place and does not make them current. Every adjustment and source must have a named confirmation question. Call ranking uses payroll movements/additions rather than invented premium rates, with written judgment about evidence risk.
