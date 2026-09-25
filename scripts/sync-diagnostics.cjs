'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const normalize=(text)=>text.replace(/\r\n/g,'\n');
const iconUrl='https://raw.githubusercontent.com/ExtraPotions/Dropper/main/assets/dropper-launcher.svg';
const source=normalize(fs.readFileSync(path.join(root,'src/shared-diagnostics.js'),'utf8'));
const target=path.join(root,'src/dropper.user.js');
const old=normalize(fs.readFileSync(target,'utf8'));
const body=old.replace(/  \/\/ BEGIN SHARED DIAGNOSTICS[\s\S]*?  \/\/ END SHARED DIAGNOSTICS/,`  // BEGIN SHARED DIAGNOSTICS\n${source}\n  // END SHARED DIAGNOSTICS`)
 .replace(/^\/\/ @icon\s+.+$/m,'// @icon         '+iconUrl);
const targets=[[target,body],[path.resolve(root,'../exp-core/src/diagnostic-report.js'),source]];
for(const [file,content] of targets){
 if(process.argv.includes('--check')){if(normalize(fs.readFileSync(file,'utf8'))!==content)throw Error('Diagnostics out of sync: '+file);}
 else fs.writeFileSync(file,content);
}
console.log('Dropper diagnostics source matches its embedded copy and Core.');
