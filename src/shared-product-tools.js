// Shared, local-only recovery and compatibility controls.
const ExtraPotionsTools = (() => {
  const clone = value => JSON.parse(JSON.stringify(value));
  function createSettingsRecovery({read,write,validate,limit=5}) {
    function list() { try { const values=read(); return Array.isArray(values)?values.filter(v=>v&&typeof v.id==='string'&&v.settings&&typeof v.settings==='object').slice(0,limit).map(clone):[]; } catch {return [];} }
    function capture(settings,reason='change') {
      const clean=validate(clone(settings)); const entries=list();
      if(entries[0]&&JSON.stringify(entries[0].settings)===JSON.stringify(clean))return entries[0].id;
      const entry={id:globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`,at:Date.now(),reason:String(reason).slice(0,80),settings:clean};
      write([entry,...entries].slice(0,limit));return entry.id;
    }
    function restore(id){const entry=list().find(v=>v.id===id);if(!entry)throw Error('This backup is no longer available.');return validate(clone(entry.settings));}
    return Object.freeze({list,capture,restore});
  }
  function compatibilitySnapshot(){
    const rows=[];const warnings=[];const versions=new Set();
    for(const id of ['dropper','shift','prisma','ward']){
      const markers=[...document.querySelectorAll('[data-exp-diagnostics-product]')].filter(n=>n.dataset.expDiagnosticsProduct===id);
      if(!markers.length)continue;
      const productVersions=[...new Set(markers.map(n=>n.dataset.expProductVersion||'unknown'))];
      const host=document.getElementById(id==='dropper'?'tdh-root':`exp-${id}-root`);
      const core=host?.dataset.coreVersion||null;if(core)versions.add(core);
      rows.push({id,versions:productVersions,core,instances:markers.length});
      if(markers.length>1)warnings.push(`More than one ${id.toUpperCase()} instance is active.`);
    }
    if(versions.size>1)warnings.push('Different core versions are active. Update the products and reload this page.');
    return {products:rows,warnings};
  }
  const button=(label,fn)=>{const b=document.createElement('button');b.type='button';b.className='life-btn action';b.textContent=label;b.addEventListener('click',fn);return b;};
  function card(title){const d=document.createElement('details');d.className='exp-tools-card';d.style.cssText='border:1px solid var(--theme-line,var(--line,#777));border-radius:7px;padding:7px;margin-top:8px';const s=document.createElement('summary');s.textContent=title;d.append(s);return d;}
  function createCompatibilityControls(){const d=card('Product compatibility'),out=document.createElement('div');out.setAttribute('aria-live','polite');function refresh(){out.replaceChildren();const value=compatibilitySnapshot();for(const p of value.products){const line=document.createElement('p');line.textContent=`${p.id.toUpperCase()} ${p.versions.join(', ')} · ${p.core?'core '+p.core:'native product UI'}`;out.append(line);}const status=document.createElement('p');status.textContent=value.warnings.join(' ')||'No mixed core versions or duplicate instances detected on this page.';out.append(status);const note=document.createElement('small');note.textContent='Only products running on this page are visible. This is not an online update check.';out.append(note);}d.addEventListener('toggle',()=>{if(d.open)refresh();});d.append(out,button('Refresh compatibility',refresh));return d;}
  function createRecoveryControls({list,capture,restore,notify=()=>{}}){const d=card('Settings backups'),select=document.createElement('select'),status=document.createElement('p');select.setAttribute('aria-label','Settings backup');status.setAttribute('role','status');function refresh(){select.replaceChildren();for(const e of list()){const o=document.createElement('option');o.value=e.id;o.textContent=`${new Date(e.at).toLocaleString()} · ${e.reason}`;select.append(o);}select.disabled=!select.options.length;rollback.disabled=select.disabled;}const backup=button('Back up settings',()=>{try{capture();refresh();status.textContent='Settings backed up locally.';}catch(e){status.textContent=e.message;}});const rollback=button('Restore selected backup',()=>{try{if(!select.value)return;restore(select.value);refresh();status.textContent='Settings restored. The previous state was also backed up.';notify(status.textContent);}catch(e){status.textContent=e.message;}});d.addEventListener('toggle',()=>{if(d.open)refresh();});d.append(select,backup,rollback,status);refresh();return d;}
  return Object.freeze({createSettingsRecovery,compatibilitySnapshot,createCompatibilityControls,createRecoveryControls});
})();
