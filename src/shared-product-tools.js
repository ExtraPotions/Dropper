// Shared, local-only compatibility controls.
const ExtraPotionsTools = (() => {
  function placeDonationPanel(panel, trigger){
    trigger.closest('.menu-head,.ward-header,header')?.after(panel);
    panel.style.cssText='position:static!important;width:100%!important;max-width:100%!important;margin:7px 0;box-shadow:none';
  }
  function createBitcoinDonation(){
    const address='bc1qg4xq63mwu63qc5dnqugk3qtxvulv5p3frjayna8ey8tu8ey4wpxsg92hv3';
    const details=document.createElement('details');details.className='exp-bitcoin-donation';details.style.cssText='margin-top:7px;min-width:0';
    const summary=document.createElement('summary');summary.textContent='₿ Bitcoin';summary.style.cssText='cursor:pointer;font-weight:700;padding:6px;border:1px solid var(--theme-line);border-radius:7px';
    const code=document.createElement('code');code.textContent=address;code.setAttribute('aria-label','Bitcoin donation address');code.style.cssText='display:block;overflow-wrap:anywhere;word-break:break-all;user-select:all;margin:7px 0;font-size:11px;line-height:1.4';
    const status=document.createElement('p');status.setAttribute('role','status');status.style.cssText='margin:5px 0 0;font-size:10px';
    const copy=button('Copy Bitcoin address',async()=>{try{await navigator.clipboard.writeText(address);status.textContent='Bitcoin address copied.';}catch{status.textContent='Select and copy the address above.';}});copy.style.cssText='width:100%;min-width:0;white-space:normal;border-radius:7px';
    const wallet=document.createElement('a');wallet.href='bitcoin:'+address;wallet.textContent='Open Bitcoin wallet';
    details.append(summary,code,copy,wallet,status);return details;
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
  return Object.freeze({placeDonationPanel,createBitcoinDonation,compatibilitySnapshot,createCompatibilityControls});
})();
