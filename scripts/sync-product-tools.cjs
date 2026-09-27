'use strict';
// Copy the canonical standalone tools without changing Dropper's native UI runtime.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');const arg=process.argv.find(a=>a.startsWith('--source='));
const canonical=path.resolve(arg?arg.slice(9):path.join(root,'../exp-core/src/product-tools.js'));
const tools=fs.readFileSync(canonical,'utf8').replace(/\r\n/g,'\n').trim();const sourcePath=path.join(root,'src/dropper.user.js');
const source=fs.readFileSync(sourcePath,'utf8').replace(/\r\n/g,'\n');const start=source.indexOf('  // BEGIN SHARED PRODUCT TOOLS'),end=source.indexOf('  // END SHARED PRODUCT TOOLS',start);
if(start<0||end<0)throw Error('Shared tool boundaries missing');
const next=source.slice(0,start)+'  // BEGIN SHARED PRODUCT TOOLS\n'+tools+'\n'+source.slice(end);
const target=path.join(root,'src/shared-product-tools.js');
if(process.argv.includes('--check')){if(next!==source||fs.readFileSync(target,'utf8').replace(/\r\n/g,'\n').trim()!==tools)throw Error('Shared product tools differ from canonical core');}
else{fs.writeFileSync(sourcePath,next);fs.writeFileSync(target,tools+'\n');}
console.log('Dropper standalone product tools match canonical core');
