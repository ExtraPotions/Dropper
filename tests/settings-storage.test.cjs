'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {loadDropperSource}=require('./load-source.cjs');
function setup({saved,legacy,failRead=false,failWrite=false}={}) {
  const source=loadDropperSource(),manager=new Map(saved===undefined?[]:[['exp:v3:dropper:settings',saved]]),page=new Map(legacy===undefined?[]:[['settings',JSON.stringify(legacy)]]);
  const c={productResetting:false,SETTINGS_KEY:'settings',DEFAULTS:{muteRestarted:true,findNextStream:false,quietHoursStart:'22:00'},
    localStorage:{getItem:k=>page.get(k)||null,removeItem:k=>page.delete(k),setItem:()=>{throw Error('preferences must not be written to Twitch')}},
    GM_getValue:(k,f)=>{if(failRead)throw Error('blocked');return manager.has(k)?manager.get(k):f;},
    GM_setValue:(k,v)=>{if(failWrite)throw Error('blocked');manager.set(k,JSON.parse(JSON.stringify(v)));}};
  const start=source.indexOf('  function loadSettings('),end=source.indexOf('\n  function saveSettings(',start);
  vm.runInNewContext(source.slice(start,end),c);return {c,manager,page};
}
test('migrates legacy preferences once, removes obsolete credentials and prefers manager values',()=>{
  const s=setup({legacy:{muteRestarted:false,authToken:'private',menuWidth:'full'}});
  const value=s.c.loadSettings();assert.equal(value.muteRestarted,false);assert.equal(value.authToken,undefined);
  assert.equal(s.page.has('settings'),false);assert.equal(s.manager.get('exp:v3:dropper:settings').muteRestarted,false);
  s.page.set('settings','{"muteRestarted":true}');assert.equal(s.c.loadSettings().muteRestarted,false);
});
test('does not lose legacy settings when manager reads or writes fail',()=>{
  for(const options of [{failRead:true},{failWrite:true}]){
    const s=setup({...options,legacy:{muteRestarted:false}});assert.equal(s.c.loadSettings().muteRestarted,false);assert.equal(s.page.has('settings'),true);
  }
});
test('malformed manager records fail closed without reviving legacy preferences',()=>{
  for(const saved of ['bad',[],42,{muteRestarted:'yes',findNextStream:'yes'}]){
    const s=setup({saved,legacy:{findNextStream:true}});assert.equal(s.c.loadSettings().findNextStream,false);
  }
});
test('saves only manager preferences and reset cannot repopulate them',()=>{
  const s=setup();s.c.settings={muteRestarted:false};s.c.persistSettingsSnapshot();assert.equal(s.manager.get('exp:v3:dropper:settings').muteRestarted,false);
  s.c.productResetting=true;s.manager.clear();s.c.persistSettingsSnapshot();assert.equal(s.manager.size,0);assert.equal(s.c.loadSettings().findNextStream,false);
});
