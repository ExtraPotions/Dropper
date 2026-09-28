'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const normalize=text=>text.replace(/\r\n/g,'\n');
const core=normalize(fs.readFileSync(path.join(root,'vendor/exp-core/exp-core.js'),'utf8'));
const marker='// Shared, local-only compatibility controls.';
const nextMarker='// Section arrangement shared at build time by ExtraPotions menus.';
const start=core.indexOf(marker),end=core.indexOf(nextMarker,start);
if(start<0||end<0)throw Error('Pinned exp-core product-tools boundaries missing');
const canonical=core.slice(start,end).trim();
const target=path.join(root,'src/shared-product-tools.js');
const sourcePath=path.join(root,'src/dropper.user.js');
const source=normalize(fs.readFileSync(sourcePath,'utf8'));
const blockStart=source.indexOf('  // BEGIN SHARED PRODUCT TOOLS'),blockEnd=source.indexOf('  // END SHARED PRODUCT TOOLS',blockStart);
if(blockStart<0||blockEnd<0)throw Error('Shared product-tools boundaries missing');
const embedded=source.slice(blockStart+'  // BEGIN SHARED PRODUCT TOOLS\n'.length,blockEnd).trim();
if(process.argv.includes('--check')){
  if(normalize(fs.readFileSync(target,'utf8')).trim()!==canonical||embedded!==canonical)throw Error('Dropper product tools differ from pinned exp-core');
}else{
  fs.writeFileSync(target,canonical+'\n');
  const next=source.slice(0,blockStart)+'  // BEGIN SHARED PRODUCT TOOLS\n'+canonical+'\n'+source.slice(blockEnd);
  fs.writeFileSync(sourcePath,next);
}
console.log('Dropper product tools match pinned exp-core');
