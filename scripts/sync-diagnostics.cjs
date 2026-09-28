'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const normalize=(text)=>text.replace(/\r\n/g,'\n');
const iconUrl='https://raw.githubusercontent.com/ExtraPotions/Dropper/main/assets/dropper-launcher.svg';
const source=normalize(fs.readFileSync(path.join(root,'src/shared-diagnostics.js'),'utf8')).trim();
const core=normalize(fs.readFileSync(path.join(root,'vendor/exp-core/exp-core.js'),'utf8'));
if(!core.includes(source)) throw Error('Dropper shared diagnostics differ from pinned exp-core');
const target=path.join(root,'src/dropper.user.js');
const old=normalize(fs.readFileSync(target,'utf8'));
const body=old.replace(/  \/\/ BEGIN SHARED DIAGNOSTICS[\s\S]*?  \/\/ END SHARED DIAGNOSTICS/,`  // BEGIN SHARED DIAGNOSTICS\n${source}\n  // END SHARED DIAGNOSTICS`)
 .replace(/^\/\/ @icon\s+.+$/m,'// @icon         '+iconUrl);
if(process.argv.includes('--check')){if(old!==body)throw Error('Dropper embedded diagnostics differ from pinned exp-core');}
else fs.writeFileSync(target,body);
console.log('Dropper diagnostics match pinned exp-core.');
