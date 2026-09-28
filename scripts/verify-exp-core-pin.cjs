'use strict';
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const vendor = path.join(root, 'vendor', 'exp-core');
const pin = fs.readFileSync(path.join(vendor, 'PIN'), 'utf8').trim();

if (!/^v\d+\.\d+\.\d+$/.test(pin)) throw new Error(`Invalid exp-core pin: ${pin || '(empty)'}`);

const mappings = [['exp-core.js','dist/exp-core.js'],['manifest.json','dist/manifest.json']];
async function fetchPinned(remotePath) {
  const url = `https://raw.githubusercontent.com/ExtraPotions/exp-core/${pin}/${remotePath}`;
  const response = await fetch(url, { headers:{'User-Agent':'ExtraPotions-exp-core-pin-check'}, signal:AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Could not fetch ${pin}/${remotePath}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
(async()=>{
  for(const [localName,remotePath] of mappings){
    const local=fs.readFileSync(path.join(vendor,localName));
    const remote=await fetchPinned(remotePath);
    if(!local.equals(remote)) throw new Error(`Vendored exp-core drift: vendor/exp-core/${localName} does not match ${pin}/${remotePath}`);
  }
  const manifest=JSON.parse(fs.readFileSync(path.join(vendor,'manifest.json'),'utf8'));
  if(`v${manifest.coreVersion}`!==pin) throw new Error(`Vendored exp-core manifest reports v${manifest.coreVersion}, expected ${pin}`);
  console.log(`Vendored exp-core matches ${pin} byte-for-byte.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
