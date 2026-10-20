'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const script=path.join(__dirname,'..','scripts','verify-exp-core-pin.cjs');
const vendor=path.join(__dirname,'..','vendor','exp-core');
function run({status=200,drift=false,ci=''}={}) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pin-'));
  try {
    const stub=path.join(dir,'stub.cjs');
    fs.writeFileSync(stub,`const fs=require('node:fs'),path=require('node:path');
      globalThis.fetch=async(url,options)=>{
        console.log('FETCH');
        if(!options.signal)throw Error('Missing bounded request signal');
        if(${status}!==200)return {ok:false,status:${status}};
        const bytes=${drift}?Buffer.from('drift'):fs.readFileSync(path.join(${JSON.stringify(vendor)},url.endsWith('manifest.json')?'manifest.json':'exp-core.js'));
        return {ok:true,status:200,arrayBuffer:async()=>bytes};
      };`);
    return spawnSync(process.execPath,['--require',stub,script],{encoding:'utf8',timeout:5000,env:{...process.env,CI:ci,EXP_CORE_PIN_WAIT_SECONDS:'1800',EXP_CORE_PIN_POLL_SECONDS:'30'}});
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
}
test('published assets match both vendored files',()=>{const r=run();assert.equal(r.status,0,r.stderr);assert.equal(r.stdout.split('FETCH').length-1,2);assert.match(r.stdout,/byte-for-byte/u);});
for(const ci of ['', 'true'])test('missing tag fails once without waiting, CI='+Boolean(ci),()=>{const r=run({status:404,ci});assert.equal(r.error,undefined);assert.equal(r.status,1,r.stderr);assert.match(r.stderr,/HTTP 404/u);assert.equal(r.stdout.split('FETCH').length-1,1);});
test('server errors fail without retrying',()=>{const r=run({status:503});assert.equal(r.status,1);assert.match(r.stderr,/HTTP 503/u);assert.equal(r.stdout.split('FETCH').length-1,1);});
test('different remote bytes fail the diagnostic',()=>{const r=run({drift:true});assert.equal(r.status,1);assert.match(r.stderr,/Vendored exp-core drift/u);});
