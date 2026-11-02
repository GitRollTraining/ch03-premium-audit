// Synthetic unit fixtures: these are tests, never coding-session or employer evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {verify} from './verify.mjs';
import {cents,usd,csv,sha,parseGuide,roofCode,dayCount,travelIncluded,fullCoverage,classify,run} from './audit.mjs';
const guide=Object.fromEntries(['C-110','H-420','R-310','R-320','E-510','T-610','F-710','F-720'].map(c=>[c,{ref:'TEST-ONLY'}]));
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
test('catering threshold includes exactly 40 percent',()=>{for(const off of ['39.99','40.00']){const f=fixture({'gross-receipts.csv':`month,dine_in_receipts,offsite_catering_receipts\n2025-07,${off==='40.00'?'60.00':'60.01'},${off}\n`});f.review.duties.X1.work='catering';assert.equal(Object.keys(classify(f).totals)[0],off==='40.00'?'F-720':'F-710');}});
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
async function verificationFixture(t) {
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ch03-regression-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const f=fixture({'payroll-register.csv':'employee_id,name,position,wages_paid\nX1,Office Worker,Office,100.01\nX2,Field Worker,Field,200.00\n'});
 f.review.duties.X2={work:'residential',basis:'Synthetic documented construction duties.'};
 const guideText='Edition of July 2025\n**CG-04. C-110 Clerical office employees.**\n**CG-15. H-420 Residential homebuilding.**\n';
 const interview=path.join(dir,'interview.md');await fs.writeFile(interview,'Synthetic test interview');
 const manifest={guide:{id:'guide',url:'https://example.invalid/guide',sha256:sha(guideText)},interview:{path:interview,sha256:sha('Synthetic test interview')},employers:['synthetic-a','synthetic-b'].map(slug=>({slug,review:'review.json',files:Object.keys(f.documents).map(name=>({id:name,name,url:'https://example.invalid/'+name}))}))};
 const manifestPath=path.join(dir,'sources.json'),packet=path.join(dir,'packet.json'),out=path.join(dir,'out');
 await fs.writeFile(manifestPath,JSON.stringify(manifest));await fs.writeFile(path.join(dir,'review.json'),JSON.stringify(f.review));
 const bundle={fetchedAt:new Date().toISOString(),guide:{content:guideText},documents:manifest.employers.flatMap(e=>Object.entries(f.documents).map(([title,content])=>({folder:e.slug,title,content})))};
 await fs.writeFile(packet,JSON.stringify(bundle));await run({manifestPath,packet,out});
 const loadSource=async file=>file.id==='guide'?guideText:f.documents[file.name];
 return {dir,out,manifestPath,packet,bundle,options:{out,manifestPath,loadSource}};
}
test('verifier accepts correct class allocations and complete employer outputs',async t=>{
 const f=await verificationFixture(t);assert.equal(await verify(f.options),2);
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
