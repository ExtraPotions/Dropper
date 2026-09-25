'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const source=fs.readFileSync(path.join(__dirname,'../src/shared-diagnostics.js'),'utf8');
async function setup(t){const browser=await chromium.launch({headless:true});t.after(()=>browser.close());const page=await browser.newPage();await page.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><body><h1>PRIVATE_BODY_TEXT</h1><input value="PRIVATE_FIELD_VALUE"></body></html>'}));await page.goto('https://fixture.test/PRIVATE_PATH?token=PRIVATE_QUERY');return page;}
async function install(page,id='ward'){await page.addScriptTag({content:`(()=>{${source}\nwindow.diags ||= {}; window.diags['${id}']=ExtraPotionsDiagnostics; ExtraPotionsDiagnostics.registerProduct('${id}','1.2.3');})();`});}
test('four diagnostic sections preserve state and capture redacted console plus runtime errors without altering logging',async t=>{
 const page=await setup(t);await page.evaluate(()=>{window.originalCalls=[];console.warn=(...args)=>{originalCalls.push(args);return 17;};});await install(page);
 const result=await page.evaluate(()=>{
  const returns=console.warn('Problem https://example.test/private?token=SECRET and member@example.test',{password:'PRIVATE_PASSWORD',okay:3});
  window.dispatchEvent(new ErrorEvent('error',{error:new Error('Runtime failure'),message:'Runtime failure',lineno:4}));
  window.dispatchEvent(new PromiseRejectionEvent('unhandledrejection',{promise:Promise.resolve(),reason:new Error('Rejected operation')}));
  const cycle={okay:true};cycle.self=cycle;Object.defineProperty(cycle,'danger',{enumerable:true,get(){throw Error('Getter should not run');}});
  return {returns,calls:originalCalls.length,report:diags.ward.createReport('WARD',{product:{version:'1.2.3'},engine:{active:true},cycle})};
 });
 assert.equal(result.returns,17);assert.equal(result.calls,1);
 for(const key of ['page','technical','console','plugin'])assert.ok(result.report[key]);
 assert.equal(result.report.plugin.state.engine.active,true);assert.equal(result.report.plugin.version,'1.2.3');
 assert.deepEqual(result.report.console.entries.map(e=>e.kind),['console','runtime-error','unhandled-rejection']);
 for(const secret of ['PRIVATE_BODY_TEXT','PRIVATE_FIELD_VALUE','PRIVATE_PATH','PRIVATE_QUERY','PRIVATE_PASSWORD','member@example.test','token=SECRET'])assert.equal(JSON.stringify(result.report).includes(secret),false,secret);
});
test('console capture is bounded and disposal does not clobber a later console wrapper',async t=>{
 const page=await setup(t);await install(page);
 const result=await page.evaluate(()=>{
  for(let n=0;n<130;n++)console.log('event',n);
  const report=diags.ward.createReport('WARD');const after=()=>42;console.warn=after;diags.ward.dispose();
  return {count:report.console.entries.length,omitted:report.console.omitted,first:report.console.entries[0].values[1],preserved:console.warn===after};
 });assert.deepEqual(result,{count:100,omitted:30,first:30,preserved:true});
});
test('all four products observe peers independent of startup order and report only evidenced conflicts',async t=>{
 const page=await setup(t);for(const id of ['prisma','dropper','ward','shift'])await install(page,id);
 const result=await page.evaluate(()=>{
  const reports=Object.values(diags).map(d=>d.compatibility());
  for(const [id,left] of [['ward',0],['shift',10]]){const host=document.createElement('div');host.dataset.expProductLauncher='1';host.dataset.productId=id;const root=host.attachShadow({mode:'open'});root.innerHTML=`<button class="launcher" style="position:fixed;top:0;left:${left}px;width:48px;height:48px">Menu</button>`;document.body.append(host);}
  const marker=document.querySelector('meta[data-exp-diagnostics-product="ward"]').cloneNode();marker.dataset.expCoordinationProtocol='different-protocol';document.head.append(marker);
  const conflicts=diags.dropper.compatibility().conflicts;marker.remove();document.querySelectorAll('[data-exp-product-launcher]').forEach(n=>n.remove());
  diags.shift.dispose();const after=diags.ward.compatibility();return {reports,conflicts,after};
 });
 for(const report of result.reports){assert.ok(report.products.every(p=>p.status==='observed'));assert.deepEqual(report.conflicts,[]);}
 assert.deepEqual(result.conflicts.map(c=>c.type).sort(),['duplicate-product','launcher-overlap','protocol-mismatch']);
 assert.equal(result.after.products.find(p=>p.id==='shift').status,'not-observed');assert.deepEqual(result.after.conflicts,[]);
});
test('Dropper-standard controls have Show then Copy, fresh reports, feedback and recoverable clipboard failure',async t=>{
 const page=await setup(t);await install(page);
 await page.evaluate(()=>{window.revision=0;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copied=text;}}});document.body.append(diags.ward.createControls(()=>diags.ward.createReport('WARD',{revision:++window.revision})));});
 assert.deepEqual(await page.locator('.diagnostics-controls button').allTextContents(),['Show Diagnostics','Copy Diagnostics']);
 await page.getByRole('button',{name:'Show Diagnostics',exact:true}).click();const displayed=JSON.parse(await page.locator('pre').innerText());
 assert.equal(displayed.revision,1);assert.equal(await page.getByRole('button',{name:'Hide Diagnostics'}).getAttribute('aria-expanded'),'true');
 await page.getByRole('button',{name:'Copy Diagnostics',exact:true}).click();await page.getByRole('button',{name:'Diagnostics Copied'}).waitFor();
 const copied=await page.evaluate(()=>JSON.parse(window.copied));assert.equal(copied.revision,2);assert.ok(copied.console && copied.plugin);
 await page.getByRole('button',{name:'Hide Diagnostics',exact:true}).click();assert.equal(await page.locator('pre').isVisible(),false);
 await page.evaluate(()=>navigator.clipboard.writeText=async()=>{throw Error('denied');});
 await page.getByRole('button',{name:'Diagnostics Copied',exact:true}).click();await page.getByRole('button',{name:'Copy Failed'}).waitFor();
 await page.getByRole('button',{name:'Show Diagnostics',exact:true}).click();assert.equal(await page.locator('pre').isVisible(),true);
});
