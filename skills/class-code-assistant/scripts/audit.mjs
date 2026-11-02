import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const skillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const sha = text => createHash('sha256').update(text).digest('hex');
export function cents(value) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(String(value))) throw Error(`Invalid USD amount: ${value}`);
  const [a,b=''] = String(value).split('.');
  const n = Number(a)*100 + Number(b.padEnd(2,'0'));
  if (!Number.isSafeInteger(n)) throw Error('Amount exceeds safe integer range');
  return n;
}
export const usd = n => { if (!Number.isSafeInteger(n)) throw Error('Non-integer cents'); return `${n<0?'-':''}${Math.floor(Math.abs(n)/100)}.${String(Math.abs(n)%100).padStart(2,'0')}`; };
export function csv(text) {
  const rows=[]; let row=[], cell='', quoted=false;
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(c==='"') { if(quoted && text[i+1]==='"'){cell+='"';i++;} else quoted=!quoted; }
    else if(c===',' && !quoted){row.push(cell);cell='';}
    else if(c==='\n' && !quoted){row.push(cell.replace(/\r$/,''));if(row.some(Boolean))rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  if(quoted)throw Error('Unclosed CSV quote');
  if(cell || row.length){row.push(cell.replace(/\r$/,''));rows.push(row);}
  const headers=rows.shift(); if(!headers || new Set(headers).size!==headers.length)throw Error('Invalid CSV header');
  return rows.map(r=>{if(r.length!==headers.length)throw Error('CSV column count mismatch'); return Object.fromEntries(headers.map((h,i)=>[h,r[i]]));});
}
export function parseGuide(text) {
  if(!text.includes('Edition of July 2025'))throw Error('Review required: unexpected guide edition');
  return Object.fromEntries([...text.matchAll(/\*\*(CG-\d+)\. ([A-Z]-\d{3}) ([^*]+)\*\*/g)].map(m=>[m[2],{ref:m[1],description:m[3]}]));
}
export function dayCount(rows,id,kind) {
  return new Set(rows.filter(r=>r.employee_id===id && (!kind || r.work_type===kind)).map(r=>r.date)).size;
}
export const roofCode = days => days>=15?'R-310':'R-320';
export const travelIncluded = (paid,days) => Math.max(0,paid-days*4700);
export function fullCoverage(cert,start,end) { return cert.coverage_from<=start && cert.coverage_to>=end; }
export function parseApplication(text) {
  const totals={};
  for(const m of text.matchAll(/^\|\s*([A-Z]-\d{3})\s*\|\s*\d+\s*\|\s*(\d+\.\d{2})\s*\|/gm)) {
    if(totals[m[1]]!==undefined)throw Error('Repeated application code'); totals[m[1]]=cents(m[2]);
  }
  if(!Object.keys(totals).length)throw Error('No application payroll found');
  return totals;
}
function period(text) {
  const m=text.match(/Audit period ([A-Za-z]+ \d+, \d{4}) to ([A-Za-z]+ \d+, \d{4})/);
  if(!m)throw Error('Audit period missing');
  return m.slice(1).map(s=>new Date(`${s} UTC`).toISOString().slice(0,10));
}
function checkDate(date,start,end) { if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<start||date>end)throw Error(`Record outside audit period: ${date}`); }
const sum = values => values.reduce((a,b)=>a+b,0);

// Semantic facts are reviewed against live evidence, never inferred from titles here.
export function classify({slug,documents,review,guide}) {
  const get = name => {if(documents[name]===undefined)throw Error(`${slug}: missing ${name}`);return documents[name];};
  for(const [name,hash] of Object.entries(review.sourceHashes))if(sha(get(name))!==hash)throw Error(`${slug}: ${name} changed; review facts before rerunning`);
  if(Object.keys(documents).some(n=>!review.sourceHashes[n]))throw Error(`${slug}: unreviewed source document`);
  const [start,end]=period(get('business-description.md'));
  const payroll=csv(get('payroll-register.csv')), reported=parseApplication(get('application.md'));
  const ids=new Set(payroll.map(r=>r.employee_id));
  if(ids.size!==payroll.length || ids.size!==Object.keys(review.duties).length)throw Error('Employee review/register mismatch');
  const rows=name=>documents[name]?csv(documents[name]):[];
  const sites=rows('site-signin-log.csv'),times=rows('crew-timesheets.csv'),routes=rows('route-log.csv');
  for(const r of [...sites,...times,...routes])checkDate(r.date,start,end);
  for(const r of times)if(!ids.has(r.employee_id)||!['roofing','siding','gutters'].includes(r.work_type)||!(Number(r.hours)>0))throw Error('Unreviewed or invalid timesheet');
  const allocations=[],questions=[],issues=[...(review.openItems||[])],metrics={};
  const q = text=>questions.push(text);
  for(const name of Object.keys(documents).sort())q(`Confirm the completeness, audit-period applicability and accuracy of ${name}, including all employees/payments or entries recorded in it; this source supports the decisions below.`);
  q('Confirm the owner inclusion/exclusion statements in business-description.md and provide the filed election for each owner stated to be excluded (CG-05).');
  let catering=false;
  if(documents['gross-receipts.csv']) {
    const receipts=rows('gross-receipts.csv');
    if(new Set(receipts.map(r=>r.month)).size!==receipts.length)throw Error('Duplicate receipt month');
    const off=sum(receipts.map(r=>cents(r.offsite_catering_receipts))),total=off+sum(receipts.map(r=>cents(r.dine_in_receipts)));
    if(!total)throw Error('Zero gross receipts');
    catering=off*100>=total*40;
    metrics.catering=`Off-site receipts $${usd(off)} / total $${usd(total)} = ${(off/total*100).toFixed(4)}%; the interview threshold is 40%.`;
    const first=receipts.map(r=>r.month).sort()[0],last=receipts.map(r=>r.month).sort().at(-1);
    issues.push(`PROVISIONAL: gross-receipts.csv covers ${first} through ${last}, not the exact ${start} through ${end} audit dates. Use the supplied sales summary provisionally; obtain period-aligned receipts before sign-off.`);
    q(`Confirm gross-receipts.csv totals and whether its ${first}–${last} reporting window is the approved basis for the 40% catering threshold; provide receipts aligned to ${start}–${end}.`);
  }
  for(const p of payroll) {
    const fact=review.duties[p.employee_id]; if(!fact||!fact.basis)throw Error(`Unreviewed actual duties: ${p.employee_id}`);
    let code,reason=fact.basis, amount=cents(p.wages_paid);
    const days=dayCount(sites,p.employee_id);
    switch(fact.work) {
      case 'office': code='C-110';
        if(days>=5) {
          if(review.fieldBusiness)code=null;
          else {issues.push(`PROVISIONAL: ${p.name} has ${days} sign-in dates, but the records do not establish field duties or a governing field code. Retain C-110 based on field-notes.md pending confirmation; do not invent a field code.`);}
        }
        reason+=`; ${days} distinct site-sign-in dates. Interview 11:00 clerical threshold applies when actual job-site visits are established.`;break;
      case 'roof-siding': {
        const own=times.filter(r=>r.employee_id===p.employee_id);if(!own.length)throw Error(`Missing crew time for ${p.name}`);
        const roof=dayCount(own,p.employee_id,'roofing');code=roofCode(roof);
        reason+=`; ${roof} distinct roofing dates in crew-timesheets.csv; interview 10:57 requires whole payroll at the 15-day threshold, without splitting.`;break;
      }
      case 'residential': code='H-420';break;
      case 'electrical': code='E-510';break;
      case 'delivery': code='T-610';break;
      case 'landscaping': code='L-620';break;
      case 'metal-fabrication': code='M-830';break;
      case 'parking': code='G-950';break;
      case 'home-health': code='N-910';break;
      case 'restaurant': code='F-710';break;
      case 'catering': code=catering?'F-720':'F-710';reason+=`; ${metrics.catering} Interview 10:58 limits F-720 to employers meeting the threshold.`;break;
      default:throw Error(`Unsupported duties ${fact.work}; obtain reviewed classification, do not guess`);
    }
    const ride=new Set(routes.filter(r=>r.ride_along_id===p.employee_id).map(r=>r.date)).size;
    if(ride) {
      code='T-610';reason+=`; route-log.csv records ${ride} ride-along dates; CG-31 describes vehicle helpers.`;
      issues.push(`PROVISIONAL: ${p.name}: propose whole-pay T-610 ($${usd(amount)}) for documented vehicle-helper duties. CG-07 permits division using time records, but route days do not establish hours or exact pay attributable to each duty. This is a proposed treatment, not an established company rule; even infrequent rides require clarification. No assumed day fractions or invented weekly rule are used; obtain time records and auditor approval.`);
      q(`For ${p.name}, confirm ${ride} ride-along dates in route-log.csv, reconcile the application statement, and approve provisional whole-pay T-610 $${usd(amount)} or provide duty hours to divide payroll under CG-07. Confirm weekly-payroll.csv against payroll-register.csv.`);
    }
    if(p.travel_allowance_paid!==undefined) {
      if(!/^\d+$/.test(p.travel_days))throw Error('Invalid travel days');
      const paid=cents(p.travel_allowance_paid),included=travelIncluded(paid,Number(p.travel_days));amount+=included;
      if(paid) {
        reason+=`; travel allowance $${usd(paid)}, ${p.travel_days} travel days, $${usd(paid-included)} excluded and $${usd(included)} included above $47/day (CG-03; interview 11:00).`;
        q(`For ${p.name}, confirm wages $${p.wages_paid}, ${p.travel_days} travel days and allowance $${usd(paid)} in payroll-register.csv; confirm allowance is additional to wages and the proposed exclusion $${usd(paid-included)} / inclusion $${usd(included)}. Supply travel or expense evidence (CG-03).`);
        if(!Number(p.travel_days))issues.push(`OPEN: ${p.name} has allowance $${usd(paid)} but zero travel days. Provisionally include the entire allowance; no supported daily exclusion exists. Obtain the payment purpose and expense receipts.`);
      }
    }
    allocations.push({id:p.employee_id,name:p.name,code,amount,base:cents(p.wages_paid),reason,days});
  }
  if(documents['weekly-payroll.csv']) {
    const weeks=rows('weekly-payroll.csv'), seen=new Set();
    for(const r of weeks){checkDate(r.week_start,start,end);checkDate(r.week_end,start,end);const k=r.week_start+'|'+r.employee_id;if(seen.has(k)||!ids.has(r.employee_id))throw Error('Invalid weekly payroll identity');seen.add(k);if(new Date(r.week_start+'T00:00:00Z').getUTCDay()!==1 || Date.parse(r.week_end)-Date.parse(r.week_start)!==6*86400000)throw Error('Invalid Monday-Sunday payroll week');}
    for(const p of payroll)if(sum(weeks.filter(w=>w.employee_id===p.employee_id).map(w=>cents(w.gross_pay)))!==cents(p.wages_paid))throw Error(`Weekly/register mismatch: ${p.name}`);
    metrics.weekly='weekly-payroll.csv reconciles to payroll-register.csv for every employee; weeks are Monday–Sunday per field notes. No unsupported weekly classification rule is applied.';
  }
  for(const pay of rows('subcontractor-payments.csv')) {
    checkDate(pay.date,start,end);
    const canonical=review.subcontractorAliases?.[pay.subcontractor]||pay.subcontractor;
    const cert=rows('insurance-certificates.csv').find(c=>c.subcontractor===canonical && fullCoverage(c,start,end));
    const code=review.tradeCodes?.[pay.work];if(!code)throw Error(`Unreviewed subcontractor trade: ${pay.work}`);
    const paid=cents(pay.amount_paid),included=cert?0:Math.round(paid*60/100);
    const detail=`${pay.subcontractor}, invoice ${pay.invoice}, ${pay.date}, ${pay.work}, paid $${usd(paid)}: ${cert?'full-period certificate '+cert.certificate_no:'no demonstrated certificate for the WHOLE audit period'}; include $${usd(included)} under ${code} (CG-06, interview 10:56/10:59, 60% per payment rounded half-up to cents).`;
    allocations.push({id:pay.invoice,name:pay.subcontractor,code,amount:included,base:0,reason:detail,subcontractor:true});
    q(`Confirm ${detail} Provide original policy certificates, renewals and entity identity where names differ.`);
    if(!cert)issues.push(`OPEN: ${detail} The addition is provisional pending complete coverage evidence; a later payment date does not override Nadia's whole-period test.`);
  }
  const direct={}; for(const a of allocations)if(a.code && a.code!=='C-110')direct[a.code]=(direct[a.code]||0)+a.amount;
  const ranked=Object.entries(direct).sort((a,b)=>b[1]-a[1]);
  if(allocations.some(a=>!a.code)) {
    if(!ranked.length || (ranked[1]&&ranked[0][1]===ranked[1][1]))throw Error('Governing field code unresolved; no unique largest payroll');
    for(const a of allocations.filter(a=>!a.code)){a.code=ranked[0][0];a.reason+=`; whole payroll moves to ${a.code}, the largest field-payroll class ($${usd(ranked[0][1])}, including assessable subcontractors) before office transfers, per interview 11:00–11:01.`;}
  }
  for(const a of allocations.filter(a=>!a.subcontractor))q(`Confirm ${a.name} (${a.id}) actual duties and allocated payroll $${usd(a.amount)} under ${a.code}: ${a.reason}`);
  for(const issue of issues)q(`Resolve and confirm: ${issue}`);
  const totals={};for(const a of allocations){if(!guide[a.code])throw Error(`Code missing from live guide: ${a.code}`);totals[a.code]=(totals[a.code]||0)+a.amount;}
  for(const code of Object.keys(totals))if(!totals[code])delete totals[code];
  const base=sum(payroll.map(p=>cents(p.wages_paid))),total=sum(Object.values(totals)),addition=total-base;
  const delta=Object.fromEntries([...new Set([...Object.keys(totals),...Object.keys(reported)])].sort().map(c=>[c,(totals[c]||0)-(reported[c]||0)]));
  const accept=Object.values(delta).every(n=>n===0);
  const exposure=(sum(Object.values(delta).map(Math.abs))-Math.abs(total-sum(Object.values(reported))))/2+Math.abs(addition);
  return {slug,title:get('business-description.md').split('\n')[0].replace(/^# /,'').replace(/: business description$/,''),start,end,reported,totals,delta,base,total,addition,allocations,questions,issues,metrics,accept,exposure,review};
}

export async function download(file) {
  const response=await fetch(`https://drive.google.com/uc?export=download&id=${encodeURIComponent(file.id)}`,{signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw Error(`${file.name||file.title}: HTTP ${response.status}`);
  const text=await response.text();
  if(!text.trim() || /^\s*<!doctype html|^\s*<html/i.test(text))throw Error('Drive returned HTML or empty content; use connected Drive refresh, never audit a login page');
  return text;
}
async function readJson(p){return JSON.parse(await fs.readFile(p,'utf8'));}
function section(result,guide,kind) {
  const r=result,lines=[`## ${r.title}`,''];
  if(kind==='questions')return lines.concat(r.questions.map((q,i)=>`${i+1}. ${q}`),'').join('\n');
  lines.push(`**${r.accept?'Accept the reported amounts provisionally':'Do not accept the employer’s reported split'}**. My decision rests on the actual-duty review of business-description.md and field-notes.md, payroll-register.csv and the supporting records listed below. ${r.issues.length?'Open items prevent final sign-off.':'Subject to employer confirmation of the listed evidence.'}`,'',`Audit period ${r.start}–${r.end}. Recorded employee wages $${usd(r.base)}; added assessable remuneration $${usd(r.addition)}; proposed allocated payroll $${usd(r.total)}.`,'','| Code | Reported USD | Proposed USD | Difference USD | Code paragraph |','|---|---:|---:|---:|---|');
  for(const c of Object.keys(r.delta))lines.push(`| ${c} | ${usd(r.reported[c]||0)} | ${usd(r.totals[c]||0)} | ${usd(r.delta[c])} | ${guide[c]?.ref||'unrecognized'} |`);
  lines.push('','The application gives aggregate class totals, not a named employee-to-code mapping. The following records-based allocations identify each employee/payment; do not interpret an inferred original class as an employer-confirmed fact.','', '### Employee and payment decisions','');
  for(const a of r.allocations)lines.push(`- **${a.name} (${a.id})**: $${usd(a.amount)} → ${a.code} (${guide[a.code].ref}). ${a.reason}`);
  lines.push('','### Reconciliation and supporting evidence','');
  for(const value of Object.values(r.metrics))lines.push(`- ${value}`);
  lines.push(`- Payroll conservation: employee wages $${usd(r.base)} + additions $${usd(r.addition)} = CSV total $${usd(r.total)}. No zero-payroll CSV rows.`, '- No rates or premium calculated. Owner exclusions rely on the recorded election statements (CG-05); original forms require confirmation.');
  lines.push('','### Open items','',...(r.issues.length?r.issues.map(x=>`- ${x}`):['- No additional classification uncertainty identified from the supplied records; employer confirmations remain outstanding.']));
  lines.push('','### Sources read during this run','');
  for(const [name,info] of Object.entries(r.sourceInfo||{}))lines.push(`- [${name}](${info.url}) — SHA-256 ${info.sha256}.`);
  return lines.concat('').join('\n');
}
export async function run({manifestPath=path.join(skillDir,'references/sources.json'), employer='all',out='deliverables',packet}) {
  const manifest=await readJson(manifestPath),selected=manifest.employers.filter(e=>employer==='all'||e.slug===employer);
  if(!selected.length)throw Error('Unknown employer; add its sources and reviewed duties to the manifest');
  const interview=await fs.readFile(manifest.interview.path,'utf8');
  if(sha(interview)!==manifest.interview.sha256)throw Error('Interview changed; preserve export and review rule authority');
  const bundle=packet?await readJson(packet):null;
  const fetchedAt=bundle && typeof bundle.fetchedAt==='string'?Date.parse(bundle.fetchedAt):NaN;
  if(bundle && (!Number.isFinite(fetchedAt) || Date.now()-fetchedAt>15*60*1000 || fetchedAt>Date.now()+60000))throw Error('Connected source packet must have a valid fetchedAt timestamp and be freshly fetched (within 15 minutes)');
  const guideText=bundle?bundle.guide.content:await download(manifest.guide),guide=parseGuide(guideText);
  if(sha(guideText)!==manifest.guide.sha256)throw Error('Classification guide changed; review policies and mappings first');
  const results=[];
  for(const e of selected){
    const review=await readJson(path.resolve(path.dirname(manifestPath),e.review));
    const entries=await Promise.all(e.files.map(async f=>[f.name,bundle?bundle.documents.find(d=>d.folder===e.slug&&d.title===f.name)?.content:await download(f)]));
    const documents=Object.fromEntries(entries);
    const r=classify({slug:e.slug,documents,review,guide});
    r.sourceInfo=Object.fromEntries(e.files.map(f=>[f.name,{url:f.url,sha256:sha(documents[f.name])}]));results.push(r);
  }
  // Fetch and validate the complete selection before writing outputs.
  await fs.mkdir(path.join(out,'codes'),{recursive:true});
  for(const r of results) {
    const text='class_code,payroll_allocated,rationale_ref\n'+Object.keys(r.totals).sort().map(c=>`${c},${usd(r.totals[c])},${guide[c].ref}`).join('\n')+'\n';
    await fs.writeFile(path.join(out,'codes',r.slug+'.csv'),text);
  }
  const priority=[...results].sort((a,b)=>b.exposure-a.exposure);
  const interviewLink=path.relative(path.resolve(out),path.resolve(manifest.interview.path)).split(path.sep).join('/');
  const header=['# Premium audit first-pass report','','PROVISIONAL — employer/auditor confirmation required before sign-off. These are classification and payroll proposals, not quotes.','',`Rule authority: [July 2025 guide](${manifest.guide.url}) and [original interview](${interviewLink}) (10:56–11:01). CG identifiers describe class codes; interview clarifications have timestamps, not fabricated CG identifiers.`,'','## Call priority','',...priority.slice(0,2).map((r,i)=>`${i+1}. **${r.title}**: $${usd(r.exposure)} of payroll affected by class movement/additions using the comparison below; ${r.issues.length} open items. ${r.review.callReason}`),'','Priority compares payroll subject to movement plus payroll additions, not premium or an invented risk rate. This is my triage judgment; class severity and evidence uncertainty also matter. For a single-employer run, ranking is limited to that employer.',''];
  await fs.writeFile(path.join(out,'audit-report.md'),header.concat(results.map(r=>section(r,guide,'report'))).join('\n'));
  await fs.writeFile(path.join(out,'audit-questions.md'),['# Employer confirmation questions','','Each source and each employee/payment decision has a confirmation request. Open-item proposals require auditor approval.',...results.map(r=>section(r,guide,'questions'))].join('\n'));
  await fs.writeFile(path.join(out,'source-manifest.json'),JSON.stringify({fetchedAt:bundle?.fetchedAt||new Date().toISOString(),transport:bundle?'connected-google-drive':'live-public-drive-download',guide:{url:manifest.guide.url,sha256:sha(guideText)},interview:manifest.interview,employers:results.map(r=>({slug:r.slug,files:r.sourceInfo}))},null,2)+'\n');
  for(const r of results)console.log(`${r.slug}: ${r.accept?'ACCEPT amounts provisionally':'REJECT reported split'}; allocated $${usd(r.total)}; additions $${usd(r.addition)}; open items ${r.issues.length}`);
  return results;
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const options={}; const names={'--employer':'employer','--out':'out','--manifest':'manifestPath','--source-packet':'packet'};
  try {for(let i=2;i<process.argv.length;i+=2){if(!names[process.argv[i]]||!process.argv[i+1])throw Error('Usage: node --use-env-proxy audit.mjs --employer all|slug --out deliverables [--manifest path] [--source-packet fresh.json]');options[names[process.argv[i]]]=process.argv[i+1];}await run(options);}
  catch(e){console.error('AUDIT STOPPED:',e.message);process.exitCode=1;}
}
