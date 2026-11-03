// Synthetic unit fixtures: these are tests, never coding-session or employer evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {verify} from './verify.mjs';
import {cents,usd,csv,sha,parseGuide,roofCode,dayCount,travelIncluded,fullCoverage,classify,run} from './audit.mjs';
import {expectedAudits,calculateExpected,checkIndependentAudit} from './expected-audits.mjs';
const guide=Object.fromEntries(['C-110','H-420','R-310','R-320','E-510','T-610','F-710','F-720'].map(c=>[c,{ref:'TEST-ONLY'}]));

// Frozen real evidence is used ONLY for offline regression, never as live input.
const sixSources=JSON.parse(await fs.readFile(new URL('./fixtures/six-employer-sources.json',import.meta.url),'utf8'));
async function actualEmployer(slug) {
 const source=sixSources.employers.find(e=>e.slug===slug);
 const review=JSON.parse(await fs.readFile(new URL(`../references/reviews/${slug}.json`,import.meta.url),'utf8'));
 const result=classify({slug,documents:source.documents,review,guide:parseGuide(sixSources.guide)});
 return {slug,documents:source.documents,guideText:sixSources.guide,result};
}
for(const slug of Object.keys(expectedAudits))test(`independent real audit baseline: ${slug}`,async()=>{
 const actual=await actualEmployer(slug);
 const expected=await checkIndependentAudit(actual);
 assert.equal(expected.total,calculateExpected(slug).total);
 assert.ok(expected.basis.includes('CG-')||expected.basis.includes('Interview'));
});
test('independent baseline rejects wrong classes even when total payroll is conserved',async()=>{
 const actual=await actualEmployer('bay-crest-exteriors');
 actual.result.totals['R-310']-=100;actual.result.totals['R-320']+=100;
 await assert.rejects(checkIndependentAudit(actual),/independent class expectation/);
});
test('independent baseline rejects wrong employee decisions even with unchanged class totals',async()=>{
 const actual=await actualEmployer('severn-homebuilders');
 actual.result.allocations.find(a=>a.id==='SH-E06').code='H-420';
 await assert.rejects(checkIndependentAudit(actual),/independent employee\/payment expectation/);
});
test('independent baseline rejects changed evidence rather than silently refreshing expectations',async()=>{
 const actual=await actualEmployer('patuxent-electric');
 actual.documents={...actual.documents,'field-notes.md':actual.documents['field-notes.md']+' changed'};
 await assert.rejects(checkIndependentAudit(actual),/independent baseline evidence changed/);
});
test('six-employer deciding evidence has independently specified boundary counts and receipts',()=>{
 const docs=slug=>sixSources.employers.find(e=>e.slug===slug).documents;
 const count=(text,field,id,kind)=>new Set(csv(text).filter(r=>r[field]===id&&(!kind||r.work_type===kind)).map(r=>r.date)).size;
 const bay=docs('bay-crest-exteriors');
 assert.deepEqual(Array.from({length:8},(_,i)=>count(bay['crew-timesheets.csv'],'employee_id',`BC-E0${i+1}`,'roofing')),[188,176,201,164,152,97,15,9]);
 assert.equal(count(bay['site-signin-log.csv'],'employee_id','BC-E09'),9);
 assert.equal(count(docs('severn-homebuilders')['site-signin-log.csv'],'employee_id','SH-E06'),4);
 assert.equal(count(docs('severn-homebuilders')['site-signin-log.csv'],'employee_id','SH-E07'),11);
 assert.equal(count(docs('harbor-point-legal')['site-signin-log.csv'],'employee_id','HP-E03'),6);
 assert.equal(count(docs('annapolis-courier')['route-log.csv'],'ride_along_id','AC-E04'),60);
 assert.equal(count(docs('annapolis-courier')['route-log.csv'],'ride_along_id','AC-E05'),2);
 const receipts=csv(docs('larkspur-lane-bistro')['gross-receipts.csv']);
 const decimal=s=>BigInt(s.replace('.',''));
 const off=receipts.reduce((n,r)=>n+decimal(r.offsite_catering_receipts),0n);
 const total=receipts.reduce((n,r)=>n+decimal(r.offsite_catering_receipts)+decimal(r.dine_in_receipts),0n);
 assert.equal(off,36241085n);assert.equal(total,164702605n);assert.ok(off*100n<total*40n);
});
test('real audit questions identify dated attendance, payments, missing evidence and provisional decisions',async()=>{
 const severn=(await actualEmployer('severn-homebuilders')).result.questions.join('\n');
 assert.match(severn,/Marissa Gale \(SH-E06\).*site-signin-log.csv dates 2025-/);
 assert.match(severn,/Dana Whitcomb \(SH-E07\).*site-signin-log.csv dates/);
 assert.match(severn,/Kent Island Roofing, invoice SV-KEN-01, 2025-09-12.*paid \$14300.00/);
 assert.match(severn,/certificate MD-WC-517736, 2025-04-01 through 2026-01-31/);
 assert.match(severn,/No certificate is listed for Tidewater Drywall/);
 assert.match(severn,/Martin Severn/);
 const patuxent=(await actualEmployer('patuxent-electric')).result.questions.join('\n');
 assert.match(patuxent,/Kyle Brandt \(PE-E06\).*allowance \$390.00.*zero travel days.*full inclusion remains provisional/);
 const courier=(await actualEmployer('annapolis-courier')).result.questions.join('\n');
 assert.match(courier,/Paul Haskins \(AC-E05\), confirm 2 ride-along dates in route-log.csv: 2025-/);
 assert.match(courier,/Lena Ortiz \(AC-E04\), confirm 60 ride-along dates/);
 assert.match(courier,/neither route days, weekly gross nor an application time estimate establishes duty hours/);
 const harbor=(await actualEmployer('harbor-point-legal')).result.questions.join('\n');
 assert.match(harbor,/Tomas Reyes \(HP-E03\).*court, closings/);
 const bistro=(await actualEmployer('larkspur-lane-bistro')).result.questions.join('\n');
 assert.match(bistro,/2025-07.*2026-06.*2025-07-07.*2026-07-05/);
});
function fixture(extra={}) {
 const documents={'business-description.md':'# Synthetic: business description\nAudit period July 7, 2025 to July 5, 2026.','application.md':'| C-110 | 1 | 100.01 |','field-notes.md':'Synthetic documented office duties.','payroll-register.csv':'employee_id,name,position,wages_paid\nX1,Synthetic Worker,Arbitrary Title,100.01\n',...extra};
 const review={fieldBusiness:false,duties:{X1:{work:'office',basis:'Synthetic documented duties, not title.'}},sourceHashes:Object.fromEntries(Object.entries(documents).map(([n,t])=>[n,sha(t)]))};
 return {slug:'an-unseen-employer',documents,review,guide};
}
test('USD uses integer cents and rejects excessive precision / negative input',()=>{assert.equal(cents('100.01'),10001);assert.equal(usd(-10001),'-100.01');assert.throws(()=>cents('1.001'));assert.throws(()=>cents('-1'));});
test('CSV handles quoted comma and escaped quotes',()=>{assert.equal(csv('a,b\r\n"Owner, chief","say ""hi"""\r\n')[0].b,'say "hi"');assert.throws(()=>csv('a,b\n"x'));});
test('guide code reference comes from supplied paragraph, not positional order',()=>{assert.equal(parseGuide('Edition of July 2025\n**CG-91. C-110 Office.**')['C-110'].ref,'CG-91');assert.throws(()=>parseGuide('Other edition'));});
test('roof threshold is inclusive at 15; same-day duplicates count once',()=>{assert.equal(roofCode(14),'R-320');assert.equal(roofCode(15),'R-310');assert.equal(dayCount([{employee_id:'x',date:'2025-01-01',work_type:'roofing'},{employee_id:'x',date:'2025-01-01',work_type:'roofing'}],'x','roofing'),1);});
test('daily allowance cap includes excess and all zero-day payments',()=>{assert.equal(travelIncluded(260000,40),72000);assert.equal(travelIncluded(103400,22),0);assert.equal(travelIncluded(39000,0),39000);});
test('insurance must cover the entire period, not just payment date',()=>{assert.equal(fullCoverage({coverage_from:'2025-06-01',coverage_to:'2026-01-31'},'2025-07-07','2026-07-05'),false);assert.equal(fullCoverage({coverage_from:'2025-07-07',coverage_to:'2026-07-05'},'2025-07-07','2026-07-05'),true);});
test('unseen employer and arbitrary job title use reviewed actual duties',()=>{const f=fixture();assert.equal(classify(f).totals['C-110'],10001);assert.equal(classify(f).accept,true);});
test('changed source stops instead of reusing stale semantic review',()=>{const f=fixture();f.documents['field-notes.md']+=' changed';assert.throws(()=>classify(f),/changed/);});
test('missing source and unknown duties stop instead of guessing',()=>{const f=fixture();delete f.documents['application.md'];assert.throws(()=>classify(f),/missing/);const g=fixture();g.review.duties.X1.work='unknown';assert.throws(()=>classify(g),/Unsupported/);});
test('clerical site boundary: four retain office, five transfer full pay',()=>{for(const n of [4,5]){const f=fixture({'payroll-register.csv':'employee_id,name,position,wages_paid\nX1,Office,Title,100.01\nX2,Field,Title,200.00\n','site-signin-log.csv':'date,employee_id\n'+Array.from({length:n},(_,i)=>`2025-07-${String(i+7).padStart(2,'0')},X1`).join('\n')});f.review.fieldBusiness=true;f.review.duties.X2={work:'residential',basis:'Synthetic field duties'};const r=classify(f);assert.equal(r.totals['H-420'],n===4?20000:30001);assert.equal(r.total,30001);}});
test('no governing field code: retain clerical provisionally, never manufacture one',()=>{const f=fixture({'site-signin-log.csv':'date,employee_id\n2025-07-07,X1\n2025-07-08,X1\n2025-07-09,X1\n2025-07-10,X1\n2025-07-11,X1\n'});const r=classify(f);assert.equal(r.totals['C-110'],10001);assert.ok(r.issues.some(s=>s.includes('governing field code')));});
test('catering threshold includes exactly 40 percent',()=>{for(const off of ['39.99','40.00']){const f=fixture({'gross-receipts.csv':`month,dine_in_receipts,offsite_catering_receipts\n2025-07,${off==='40.00'?'60.00':'60.01'},${off}\n`});f.review.duties.X1.work='catering';f.review.receiptWindow={startMonth:'2025-07',endMonth:'2025-07',basis:'Synthetic documented one-month sales summary, subject to period confirmation.'};assert.equal(Object.keys(classify(f).totals)[0],off==='40.00'?'F-720':'F-710');}});
test('subcontractor 60 percent rounds per payment and asks confirmation even if insured',()=>{const f=fixture({'subcontractor-payments.csv':'date,subcontractor,work,invoice,amount_paid\n2025-07-08,Synthetic Sub,framing,INV-1,0.01\n2025-07-09,Insured Sub,framing,INV-2,100.00\n','insurance-certificates.csv':'subcontractor,certificate_no,coverage_from,coverage_to\nInsured Sub,CERT,2025-01-01,2027-01-01\n'});f.review.tradeCodes={framing:'H-420'};const r=classify(f);assert.equal(r.addition,1);assert.ok(r.questions.some(q=>q.includes('INV-2')));assert.equal(r.allocations.find(a=>a.id==='INV-2').amount,0);});
test('ride-along allocation is an explicit whole-pay proposal without invented hours',()=>{const f=fixture({'route-log.csv':'date,route_id,driver_id,ride_along_id,stops\n2025-07-07,R,X2,X1,20\n'});const r=classify(f);assert.equal(r.totals['T-610'],10001);assert.ok(r.issues.some(x=>x.includes('No assumed day fractions')));});
test('unknown code in refreshed guide prevents output',()=>{const f=fixture();f.guide={};assert.throws(()=>classify(f),/Code missing/);});
test('other proprietary guide occupations work for unseen employers',()=>{for(const [work,code] of [['landscaping','L-620'],['metal-fabrication','M-830'],['parking','G-950'],['home-health','N-910']]){const f=fixture();f.review.duties.X1.work=work;f.guide={...guide,[code]:{ref:'TEST'}};assert.equal(classify(f).totals[code],10001);}});
test('Skill metadata and supporting resources are complete',async()=>{
 const skill=new URL('../SKILL.md',import.meta.url),text=await fs.readFile(skill,'utf8');
 const front=text.match(/^---\r?\n([\s\S]+?)\r?\n---/);assert.ok(front,'YAML frontmatter required');
 const fields=Object.fromEntries(front[1].split(/\r?\n/).map(line=>{const i=line.indexOf(':');return [line.slice(0,i),line.slice(i+1).trim()];}));
 assert.match(fields.name,/^[a-z0-9]+(?:-[a-z0-9]+)*$/);assert.ok(fields.name.length<=64);assert.ok(fields.description.length>0&&fields.description.length<=1024);assert.ok(!/[<>]/.test(fields.description));
 assert.ok(Object.keys(fields).every(k=>['name','description','license','allowed-tools','metadata'].includes(k)));assert.ok(!/^\s*\[TODO:/m.test(text));
 for(const file of ['references/sources.json','references/workflow.md','scripts/audit.mjs','scripts/verify.mjs'])await fs.access(new URL('../'+file,import.meta.url));
});

// Exercise the real generator/verifier with explicitly synthetic, isolated records.
async function verificationFixture(t,extra={}) {
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ch03-regression-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const f=fixture({'payroll-register.csv':'employee_id,name,position,wages_paid\nX1,Office Worker,Office,100.01\nX2,Field Worker,Field,200.00\n',...extra.documents});
 Object.assign(f.review,extra.review);
 f.review.duties.X2={work:'residential',basis:'Synthetic documented construction duties.'};
 const guideText='Edition of July 2025\n**CG-04. C-110 Clerical office employees.**\n**CG-15. H-420 Residential homebuilding.**\n';
 const interview=path.join(dir,'interview.md');await fs.writeFile(interview,'Synthetic test interview');
 const manifest={guide:{id:'guide',url:'https://example.invalid/guide',sha256:sha(guideText)},interview:{path:interview,sha256:sha('Synthetic test interview')},employers:['synthetic-a','synthetic-b'].map(slug=>({slug,review:slug+'.review.json',files:Object.keys(f.documents).map(name=>({id:slug+'/'+name,name,url:'https://example.invalid/'+slug+'/'+name}))}))};
 const manifestPath=path.join(dir,'sources.json'),packet=path.join(dir,'packet.json'),out=path.join(dir,'out');
 await fs.writeFile(manifestPath,JSON.stringify(manifest));
 const sourceDocs=manifest.employers.flatMap(e=>Object.entries(f.documents).map(([title,content])=>({folder:e.slug,title,content:title==='business-description.md'?content.replace('Synthetic:',e.slug+':'):content})));
 for(const e of manifest.employers)await fs.writeFile(path.join(dir,e.review),JSON.stringify({...f.review,sourceHashes:Object.fromEntries(sourceDocs.filter(d=>d.folder===e.slug).map(d=>[d.title,sha(d.content)]))}));
 const bundle={fetchedAt:new Date().toISOString(),guide:{content:guideText},documents:sourceDocs};
 await fs.writeFile(packet,JSON.stringify(bundle));await run({manifestPath,packet,out});
 const loadSource=async file=>file.id==='guide'?guideText:sourceDocs.find(d=>d.folder+'/'+d.title===file.id).content;
 return {dir,out,manifestPath,packet,bundle,options:{out,manifestPath,loadSource}};
}
test('verifier accepts correct class allocations and complete employer outputs',async t=>{
 const f=await verificationFixture(t);assert.equal(await verify(f.options),2);
});

test('verifier rejects altered question evidence and missing employer-scoped source references',async t=>{
 const f=await verificationFixture(t),file=path.join(f.out,'audit-questions.md'),original=await fs.readFile(file,'utf8');
 for(const [from,to] of [['allocated payroll $100.01','allocated payroll $1.00'],['[application.md](https://example.invalid/synthetic-a/application.md)','[application.md](https://example.invalid/wrong-source)']]) {
  assert.ok(original.includes(from));await fs.writeFile(file,original.replace(from,to));
  await assert.rejects(verify(f.options),/Question/);
 }
});
test('verifier rejects payroll moved to a wrong class while preserving total',async t=>{
 const f=await verificationFixture(t);
 await fs.writeFile(path.join(f.out,'codes/synthetic-a.csv'),'class_code,payroll_allocated,rationale_ref\nC-110,300.01,CG-04\n');
 await assert.rejects(verify(f.options),/Payroll allocation failed/);
});
test('verifier rejects missing or unexpectedly empty employer selections',async t=>{
 const f=await verificationFixture(t),file=path.join(f.out,'source-manifest.json');
 const original=JSON.parse(await fs.readFile(file,'utf8'));
 for(const employers of [original.employers.slice(0,1),[],[original.employers[0],original.employers[0]]]){
  await fs.writeFile(file,JSON.stringify({...original,employers}));
  await assert.rejects(verify(f.options),/expected employer selection/);
 }
 await fs.writeFile(file,JSON.stringify(original));
 await assert.rejects(verify({...f.options,employer:'unknown'}),/selection is empty/);
 const manifest=JSON.parse(await fs.readFile(f.manifestPath,'utf8'));manifest.employers=[];
 await fs.writeFile(f.manifestPath,JSON.stringify(manifest));
 await assert.rejects(verify(f.options),/selection is empty/);
});
test('verifier rejects a missing expected employer CSV',async t=>{
 const f=await verificationFixture(t);await fs.unlink(path.join(f.out,'codes/synthetic-b.csv'));
 await assert.rejects(verify(f.options),{code:'ENOENT'});
});
test('verifier supports an explicit single-employer selection',async t=>{
 const f=await verificationFixture(t),out=path.join(f.dir,'single');
 await run({manifestPath:f.manifestPath,packet:f.packet,out,employer:'synthetic-a'});
 assert.equal(await verify({...f.options,out,employer:'synthetic-a'}),1);
 await assert.rejects(verify({...f.options,out}),/expected employer selection/);
});
test('invalid, missing, stale and future packet timestamps stop before output writes',async t=>{
 const f=await verificationFixture(t),out=path.join(f.dir,'must-not-exist');
 for(const fetchedAt of ['not-a-date','',null,123,undefined,new Date(Date.now()-16*60000).toISOString(),new Date(Date.now()+120000).toISOString()]){
  await fs.writeFile(f.packet,JSON.stringify({...f.bundle,fetchedAt}));
  await assert.rejects(run({manifestPath:f.manifestPath,packet:f.packet,out}),/valid fetchedAt timestamp/);
  await assert.rejects(fs.access(out),{code:'ENOENT'});
 }
});

function cateringFixture(receipts) {
 const f=fixture(receipts===undefined?{}:{'gross-receipts.csv':receipts});
 f.review.duties.X1.work='catering';
 f.review.receiptWindow={startMonth:'2025-07',endMonth:'2025-09',basis:'Synthetic explicitly documented sales reporting window.'};
 return f;
}
const receiptHeader='month,dine_in_receipts,offsite_catering_receipts\n';
const completeReceipts=receiptHeader+'2025-07,60.00,40.00\n2025-08,60.00,40.00\n2025-09,60.00,40.00\n';
function assertUnknownReceipts(f) {
 const r=classify(f);
 assert.equal(r.unallocated,10001);
 assert.equal(r.totals['F-710'],undefined);assert.equal(r.totals['F-720'],undefined);
 assert.ok(r.issues.some(s=>/UNKNOWN.*gross-receipts.csv/.test(s)));
 assert.ok(r.questions.some(s=>s.includes('Synthetic Worker')&&s.includes('gross-receipts.csv')));
 assert.ok(!r.allocations[0].reason.includes('undefined'));
}
test('missing catering receipts leave payroll unresolved rather than assuming below threshold',()=>assertUnknownReceipts(cateringFixture()));
test('blank and header-only catering receipts leave payroll unresolved',()=>{for(const text of ['',receiptHeader])assertUnknownReceipts(cateringFixture(text));});
test('missing receipt months and missing amounts are unknown evidence',()=>{
 for(const text of [completeReceipts.replace('2025-08,60.00,40.00\n',''),completeReceipts.replace('2025-08,60.00,40.00','2025-08,60.00,')])assertUnknownReceipts(cateringFixture(text));
});
test('listed receipt files that disappear or become incomplete stay unknown without using stale figures',()=>{
 for(const content of [undefined,'',completeReceipts.replace('2025-08,60.00,40.00\n','')]){
  const f=cateringFixture(completeReceipts);if(content===undefined)delete f.documents['gross-receipts.csv'];else f.documents['gross-receipts.csv']=content;
  assertUnknownReceipts(f);
 }
});
test('complete changed receipt evidence still requires a fresh semantic review',()=>{
 const f=cateringFixture(completeReceipts);f.documents['gross-receipts.csv']=completeReceipts.replace('60.00','61.00');
 assert.throws(()=>classify(f),/gross-receipts.csv changed/);
});
test('duplicate months, invalid amounts and zero-denominator receipts are unknown evidence',()=>{
 for(const text of [completeReceipts+'2025-09,60.00,40.00\n',completeReceipts.replace('60.00','not-money'),completeReceipts.replaceAll('60.00','0.00').replaceAll('40.00','0.00')])assertUnknownReceipts(cateringFixture(text));
});
test('complete reviewed receipt window supports threshold while retaining period-alignment question',()=>{
 const r=classify(cateringFixture(completeReceipts));assert.equal(r.totals['F-720'],10001);assert.equal(r.unallocated,0);assert.ok(r.questions.some(q=>q.includes('reporting window')));
});
test('receipts without a reviewed reporting window must cover audit-period months',()=>{
 const f=cateringFixture(completeReceipts);delete f.review.receiptWindow;assertUnknownReceipts(f);
});
test('unresolved catering payroll blocks publishing and exposes the employer question',async t=>{
 const f=await verificationFixture(t),manifest=JSON.parse(await fs.readFile(f.manifestPath,'utf8'));
 for(const e of manifest.employers){const p=path.join(f.dir,e.review),review=JSON.parse(await fs.readFile(p,'utf8'));review.duties.X1.work='catering';await fs.writeFile(p,JSON.stringify(review));}
 const before=await fs.readFile(path.join(f.out,'audit-report.md'),'utf8');
 await assert.rejects(run({manifestPath:f.manifestPath,packet:f.packet,out:f.out}),error=>/Unresolved payroll/.test(error.message)&&error.questions.some(q=>q.includes('Office Worker')&&q.includes('gross-receipts.csv')));
 assert.equal(await fs.readFile(path.join(f.out,'audit-report.md'),'utf8'),before);
});
test('unmatched IDs in site, route-driver, route-passenger and time records produce named open questions',()=>{
 for(const [name,content,field] of [
  ['site-signin-log.csv','date,employee_id,name\n2025-07-07,UNKNOWN,Unidentified person\n','employee_id'],
  ['route-log.csv','date,driver_id,ride_along_id\n2025-07-07,UNKNOWN,\n','driver_id'],
  ['route-log.csv','date,driver_id,ride_along_id\n2025-07-07,X1,UNKNOWN\n','ride_along_id'],
  ['crew-timesheets.csv','date,employee_id,work_type,hours\n2025-07-07,UNKNOWN,roofing,8\n','employee_id']
 ]){const r=classify(fixture({[name]:content}));assert.ok(r.issues.some(s=>s.includes(name)&&s.includes('UNKNOWN')&&s.includes(field)));assert.ok(r.questions.some(s=>s.includes(name)&&s.includes('UNKNOWN')));}
});
test('documented visitors are allowed but visitor labels without evidence do not bypass ID reconciliation',()=>{
 const f=fixture({'site-signin-log.csv':'date,employee_id,name\n2025-07-07,,County inspector\n'});
 assert.ok(classify(f).issues.some(s=>s.includes('site-signin-log.csv')));
 f.review.visitors=[{source:'site-signin-log.csv',field:'employee_id',id:'',name:'County inspector',basis:'The synthetic log explicitly identifies this nonemployee visitor as county inspector.'}];
 assert.equal(classify(f).issues.length,0);
 delete f.review.visitors[0].basis;assert.ok(classify(f).issues.some(s=>s.includes('site-signin-log.csv')));
});
test('known log employees and an empty optional passenger do not create unmatched-ID issues',()=>{
 const r=classify(fixture({'site-signin-log.csv':'date,employee_id,name\n2025-07-07,X1,Synthetic Worker\n','route-log.csv':'date,driver_id,ride_along_id\n2025-07-07,X1,\n'}));assert.equal(r.issues.length,0);
});
test('verifier rejects corrupted report summary and code-table amounts',async t=>{
 const f=await verificationFixture(t),p=path.join(f.out,'audit-report.md'),original=await fs.readFile(p,'utf8');
 for(const [from,to] of [['Recorded employee wages $300.01','Recorded employee wages $1.00'],['| C-110 | 100.01 | 100.01 | 0.00 |','| C-110 | 100.01 | 99.01 | -1.00 |']]){
  assert.ok(original.includes(from));await fs.writeFile(p,original.replace(from,to));await assert.rejects(verify(f.options),/Report/);
 }
});
test('verifier rejects corrupted per-employee report amounts and reconciliation totals',async t=>{
 const f=await verificationFixture(t),p=path.join(f.out,'audit-report.md'),original=await fs.readFile(p,'utf8');
 for(const [from,to] of [['**Office Worker (X1)**: $100.01','**Office Worker (X1)**: $1.00'],['CSV total $300.01','CSV total $999.00']]){
  assert.ok(original.includes(from));await fs.writeFile(p,original.replace(from,to));await assert.rejects(verify(f.options),/Report/);
 }
});
test('verifier rejects incorrect allowance exclusion amounts in adjustment rationales',async t=>{
 const f=await verificationFixture(t,{documents:{'payroll-register.csv':'employee_id,name,position,wages_paid,travel_days,travel_allowance_paid\nX1,Office Worker,Office,100.01,1,57.00\nX2,Field Worker,Field,200.00,0,0.00\n'}});
 await verify(f.options);
 const p=path.join(f.out,'audit-report.md'),text=await fs.readFile(p,'utf8');
 assert.ok(text.includes('$47.00 excluded'));await fs.writeFile(p,text.replace('$47.00 excluded','$0.00 excluded'));
 await assert.rejects(verify(f.options),/Report amounts.*adjustment rationale/);
});
test('verifier rejects incorrect underlying subcontractor payment amounts',async t=>{
 const f=await verificationFixture(t,{documents:{'subcontractor-payments.csv':'date,subcontractor,work,invoice,amount_paid\n2025-07-08,Synthetic Sub,framing,INV-SUB,100.00\n','insurance-certificates.csv':'subcontractor,certificate_no,coverage_from,coverage_to\n'},review:{tradeCodes:{framing:'H-420'}}});
 await verify(f.options);
 const p=path.join(f.out,'audit-report.md'),text=await fs.readFile(p,'utf8');
 assert.ok(text.includes('paid $100.00:'));await fs.writeFile(p,text.replace('paid $100.00:','paid $1.00:'));
 await assert.rejects(verify(f.options),/Report amounts.*adjustment rationale/);
});
test('verifier rejects incorrect call-priority amounts',async t=>{
 const f=await verificationFixture(t),p=path.join(f.out,'audit-report.md'),text=await fs.readFile(p,'utf8');
 assert.ok(text.includes('$0.00 of payroll'));await fs.writeFile(p,text.replace('$0.00 of payroll','$1.00 of payroll'));
 await assert.rejects(verify(f.options),/Report call-priority/);
});
test('verifier rejects incorrect amounts repeated in open audit items',async t=>{
 const f=await verificationFixture(t,{documents:{'payroll-register.csv':'employee_id,name,position,wages_paid,travel_days,travel_allowance_paid\nX1,Office Worker,Office,100.01,0,10.00\nX2,Field Worker,Field,200.00,0,0.00\n'}});
 const p=path.join(f.out,'audit-report.md'),text=await fs.readFile(p,'utf8');
 assert.ok(text.includes('OPEN: Office Worker has allowance $10.00'));await fs.writeFile(p,text.replace('OPEN: Office Worker has allowance $10.00','OPEN: Office Worker has allowance $1.00'));
 await assert.rejects(verify(f.options),/Report amounts.*financial evidence/);
});

test('defect regression: a named passenger without an ID requires reconciliation',()=>{
 const f=fixture({'route-log.csv':'date,driver_id,ride_along_id,ride_along_name\n2025-07-07,X1,,Unidentified Helper\n'});
 const result=classify(f);
 assert.ok(result.issues.some(q=>q.includes('Unidentified Helper')&&q.includes('[missing ID]')&&q.includes('2025-07-07')));
 assert.ok(result.questions.some(q=>q.includes('Unidentified Helper')&&q.includes('route-log.csv row 2')));
 // A reviewed visitor remains an allowed exception; an actually empty passenger remains optional.
 f.review.visitors=[{source:'route-log.csv',field:'ride_along_id',id:'',name:'Unidentified Helper',basis:'Synthetic log and reviewed visitor record document this nonemployee passenger.'}];
 assert.ok(!classify(f).issues.some(q=>q.includes('[missing ID]')));
});

test('defect regression: financial rationale amounts cannot match only a numeric prefix',async t=>{
 const f=await verificationFixture(t,{documents:{'payroll-register.csv':'employee_id,name,position,wages_paid,travel_days,travel_allowance_paid\nX1,Office Worker,Office,100.01,1,57.00\nX2,Field Worker,Field,200.00,0,0.00\n'}});
 const file=path.join(f.out,'audit-report.md'),original=await fs.readFile(file,'utf8');
 for(const invalid of ['$47.009 excluded','$47.00e2 excluded','$47.00,1 excluded','$47.0 excluded']) {
  assert.ok(original.includes('$47.00 excluded'));
  await fs.writeFile(file,original.replace('$47.00 excluded',invalid));
  await assert.rejects(verify(f.options),/Report.*(monetary|amount)/);
 }
 await fs.writeFile(file,original);assert.equal(await verify(f.options),2);
});

test('defect regression: catering operations require receipts despite restaurant-only duty labels',()=>{
 for(const name of ['business-description.md','field-notes.md','application.md']) {
  const f=fixture();f.documents[name]+='\nThe employer also prepares and serves off-site catering at customer venues.\n';
  f.review.sourceHashes[name]=sha(f.documents[name]);f.review.duties.X1.work='restaurant';
  const result=classify(f);
  assert.ok(result.issues.some(q=>q.includes('UNKNOWN')&&q.includes('gross-receipts.csv')),name);
  // Do not invent a catering employee assignment or reclassify established restaurant duties.
  assert.equal(result.totals['F-710'],10001);assert.equal(result.unallocated,0);
  assert.ok(result.receiptEvidenceUnknown);
 }
});

test('defect regression: unknown required receipts block publication without catering employees',async t=>{
 const f=await verificationFixture(t);
 const file=path.join(f.out,'audit-report.md'),before=await fs.readFile(file,'utf8');
 // verificationFixture's successful setup must be given complete evidence; change reviewed
 // operations only after that setup to exercise preservation of existing outputs.
 const manifest=JSON.parse(await fs.readFile(f.manifestPath,'utf8'));
 for(const e of manifest.employers){
  const file=path.join(f.dir,e.review),review=JSON.parse(await fs.readFile(file,'utf8'));
  review.cateringOperations={thresholdRelevant:true,basis:'Synthetic documented customer-venue food service in reviewed operations records.'};
  await fs.writeFile(file,JSON.stringify(review));
 }
 await assert.rejects(run({manifestPath:f.manifestPath,packet:f.packet,out:f.out}),error=>/Unresolved/.test(error.message)&&error.questions.some(q=>q.includes('gross-receipts.csv')));
 assert.equal(await fs.readFile(file,'utf8'),before);
});

test('operations-required receipts block missing, empty and incomplete inputs without changing restaurant duties',()=>{
 for(const receipts of [undefined,'',receiptHeader,completeReceipts.replace('2025-08,60.00,40.00\n','')]) {
  const f=fixture(receipts===undefined?{}:{'gross-receipts.csv':receipts});
  f.review.duties.X1.work='restaurant';
  f.review.cateringOperations={thresholdRelevant:true,basis:'Synthetic reviewed business description establishes off-site food service.'};
  f.review.receiptWindow={startMonth:'2025-07',endMonth:'2025-09',basis:'Synthetic documented quarterly sales period.'};
  const r=classify(f);assert.equal(r.receiptEvidenceUnknown,true);assert.equal(r.totals['F-710'],10001);
  assert.ok(r.questions.some(q=>q.includes('Synthetic Worker (X1)')&&q.includes('gross-receipts.csv')));
 }
 const f=fixture({'gross-receipts.csv':completeReceipts});f.review.duties.X1.work='restaurant';
 f.review.cateringOperations={thresholdRelevant:true,basis:'Synthetic documented off-site catering operations.'};
 f.review.receiptWindow={startMonth:'2025-07',endMonth:'2025-09',basis:'Synthetic documented quarterly sales period.'};
 const r=classify(f);assert.equal(r.receiptEvidenceUnknown,false);assert.equal(r.totals['F-710'],10001);
});

test('incidental catering mentions need a reviewed negative fact; duties and required sources cannot bypass receipts',()=>{
 const f=fixture({'field-notes.md':'Synthetic reviewed employer does not perform catering or serve food.'});
 f.review.cateringOperations={thresholdRelevant:false,basis:'The synthetic field notes explicitly exclude catering; office-only operations confirmed.'};
 assert.equal(classify(f).receiptEvidenceUnknown,false);
 delete f.review.cateringOperations.basis;
 assert.throws(()=>classify(f),/Catering operations review/);
 f.review.cateringOperations.basis='Synthetic source-grounded negative operations assertion.';
 f.review.duties.X1.work='catering';assert.equal(classify(f).receiptEvidenceUnknown,true);
 f.review.duties.X1.work='office';f.review.sourceHashes['gross-receipts.csv']=sha('previous reviewed receipts');
 assert.equal(classify(f).receiptEvidenceUnknown,true);
});

test('finite positive fractional timesheet hours remain accepted',()=>{
 const f=fixture({'crew-timesheets.csv':'date,employee_id,work_type,hours\n2025-07-07,X1,roofing,0.25\n'});
 assert.equal(classify(f).total,10001);
});

for(const hours of ['Infinity','-Infinity','NaN','1e309'])test(`defect regression: non-finite timesheet hours ${hours} are rejected`,()=>{
 const f=fixture({'crew-timesheets.csv':`date,employee_id,work_type,hours\n2025-07-07,X1,roofing,${hours}\n`});
 assert.throws(()=>classify(f),/Invalid timesheet work or hours/);
});
