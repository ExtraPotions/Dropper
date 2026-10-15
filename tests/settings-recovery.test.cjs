'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');const source=require('./load-source.cjs').loadDropperSource();
function fn(name){const a=source.indexOf('  function '+name+'('),b=source.indexOf('\n  function ',a+4);return source.slice(a,b);}

test('Dropper saves preferences and removes obsolete authentication fields without backup storage',()=>{
 const defaults=vm.runInNewContext('('+source.match(/const DEFAULTS = (\{[\s\S]*?\n  \});/)[1]+')');
 const store=new Map([['settings',JSON.stringify({muteRestarted:false,authToken:'fixture-secret',quietHoursStart:'99:99',protectedChannels:'invalid',excludedChannels:['CHANNEL','channel','bad name']})]]),access=[];
 const manager=new Map();
 const context={productResetting:false,DEFAULTS:defaults,SETTINGS_KEY:'settings',GM_getValue:(key,fallback)=>manager.get(key)??fallback,GM_setValue:(key,value)=>manager.set(key,value),localStorage:{getItem:key=>{access.push(key);return store.get(key)||null;},removeItem:key=>store.delete(key)},settings:{...defaults,muteRestarted:false}};
 vm.runInNewContext(fn('loadSettings')+fn('persistSettingsSnapshot'),context);
 assert.equal(context.loadSettings().muteRestarted,false);assert.equal(context.loadSettings().authToken,undefined);assert.equal(context.loadSettings().quietHoursStart,'22:00');assert.deepEqual(Array.from(context.loadSettings().protectedChannels),[]);assert.deepEqual(Array.from(context.loadSettings().excludedChannels),['channel']);
 context.settings.muteRestarted=true;context.persistSettingsSnapshot();assert.equal(manager.get('exp:v3:dropper:settings').muteRestarted,true);assert.equal(store.has('settings'),false);
 assert.equal(access.some(key=>key.includes('backup')),false);assert.doesNotMatch(source,/settingsRecovery|createRecoveryControls/);
});
