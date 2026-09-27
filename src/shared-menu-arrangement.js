// Section arrangement shared at build time by ExtraPotions menus.
const ExpMenuArrangement = (() => {
  const css = `
    [data-exp-arrange-section]{position:relative}
    [data-exp-arrange-section]>.fl-tool-header{padding-left:38px!important}
    .exp-section-grip{position:absolute!important;left:4px!important;right:auto!important;top:4px!important;width:28px!important;height:26px!important;min-width:0!important;min-height:0!important;padding:0!important;border:1px solid var(--theme-line);border-radius:6px!important;background:var(--theme-bg);color:var(--theme-muted);touch-action:none;cursor:grab;z-index:1}
    .exp-section-grip[data-dragging=true]{cursor:grabbing}
    .exp-menu-editor{grid-column:1/-1;box-sizing:border-box;width:100%;min-width:0;padding:7px;border:1px solid var(--theme-line);border-radius:7px;background:var(--theme-bg)}
    .exp-menu-editor summary{cursor:pointer;font-weight:700}
    .exp-menu-editor .exp-menu-row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:7px}
    .exp-menu-editor button[role=switch]{flex:0 0 32px;width:32px;height:20px;padding:2px;border-radius:5px;border:1px solid var(--theme-line);background:var(--theme-panel)}
    .exp-menu-editor button[role=switch]::before{content:'';display:block;width:12px;height:12px;border-radius:3px;background:var(--theme-muted)}
    .exp-menu-editor button[aria-checked=true]{background:var(--theme-accent)}
    .exp-menu-editor button[aria-checked=true]::before{margin-left:auto;background:var(--theme-text)}
    .exp-menu-editor .exp-reset{width:100%;margin-top:7px;border-radius:6px}
    [data-exp-arrange-section][hidden]{display:none!important}
  `;
  function mount({ panel, id, onChange = () => {}, resetLaunchers = () => {} }) {
    const document = panel.ownerDocument, view = document.defaultView;
    const entries = [...panel.querySelectorAll('.fl-tool-panel')].map(section => {
      const header = section.querySelector(':scope>.fl-tool-header');
      const body = section.querySelector(':scope>.fl-tool-body');
      if (!header || !body) return null;
      const label = (header.querySelector('.fl-tool-title') || header).textContent.replace(/[▸▾›]/g, '').trim();
      return { section, header, body, label, key: header.dataset.route || header.dataset.section || header.dataset.panel || body.id };
    }).filter(entry => entry?.key);
    if (entries.length < 2) return { update() {}, destroy() {} };
    const parent = entries[0].section.parentElement;
    if (entries.some(entry => entry.section.parentElement !== parent)) return { update() {}, destroy() {} };
    const defaults = entries.map(entry => entry.key);
    const orderKey = `exp:v3:menu-order:${id}`, hiddenKey = `exp:v3:menu-hidden:${id}`;
    const read = key => { try { const value = JSON.parse(view.localStorage.getItem(key) || '[]'); return Array.isArray(value) ? [...new Set(value.filter(x => typeof x === 'string'))] : []; } catch { return []; } };
    const save = (key, value) => { try { view.localStorage.setItem(key, JSON.stringify(value)); } catch {} };
    let order = [...new Set([...read(orderKey), ...defaults])], hidden = read(hiddenKey), drag = null;
    const recovery = entries.find(entry => entry.label.toLowerCase() === 'system') || entries[0];
    const style = document.createElement('style'); style.textContent = css; panel.getRootNode().append(style);
    const abort = new view.AbortController();
    const on = (node, type, handler, options = {}) => node.addEventListener(type, handler, { ...options, signal: abort.signal });
    const editor = document.createElement('details'); editor.className = 'exp-menu-editor';
    const summary = document.createElement('summary'); summary.textContent = 'Edit menu'; editor.append(summary);
    const switches = new Map();
    const ordered = () => [...parent.children].filter(node => node.hasAttribute('data-exp-arrange-section'));
    function apply() {
      const desired = [...entries].sort((a,b) => order.indexOf(a.key)-order.indexOf(b.key));
      desired.forEach((entry,index) => { const current = ordered()[index]; if (current !== entry.section) parent.insertBefore(entry.section,current || null); });
      entries.forEach(entry => {
        const isHidden = entry !== recovery && hidden.includes(entry.key);
        if (entry.section.hidden !== isHidden) entry.section.hidden = isHidden;
        switches.get(entry.key)?.setAttribute('aria-checked', String(!isHidden));
      });
      onChange();
    }
    function update() { if (!recovery.body.contains(editor)) recovery.body.append(editor); }
    for (const entry of entries) {
      entry.section.dataset.expArrangeSection = entry.key;
      const grip = document.createElement('button'); grip.type = 'button'; grip.className = 'exp-section-grip'; grip.textContent = '⠿';
      grip.setAttribute('aria-label', `Rearrange ${entry.label}`); grip.title = 'Drag to reorder, or use Alt + Up/Down'; entry.section.append(grip); entry.grip = grip;
      on(grip, 'click', event => { event.preventDefault(); event.stopPropagation(); });
      on(grip, 'pointerdown', event => {
        if (event.button !== 0 || drag) return;
        event.preventDefault(); event.stopPropagation();
        drag = { entry, pointer: event.pointerId, y: event.clientY, snapshot: [...order], moved: false };
        parent.setPointerCapture?.(event.pointerId); grip.dataset.dragging = 'true';
      });
      on(grip, 'keydown', event => {
        if (!event.altKey || !['ArrowUp','ArrowDown'].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        const visible = ordered().filter(node => !node.hidden).map(node => node.dataset.expArrangeSection);
        const from = visible.indexOf(entry.key), to = from + (event.key === 'ArrowUp' ? -1 : 1);
        if (to < 0 || to >= visible.length) return;
        const target = order.indexOf(visible[to]), source = order.indexOf(entry.key);
        [order[source], order[target]] = [order[target], order[source]];
        save(orderKey,order); apply(); grip.focus();
      });
      if (entry === recovery) continue;
      const row = document.createElement('div'); row.className = 'exp-menu-row';
      const label = document.createElement('span'); label.textContent = entry.label;
      const toggle = document.createElement('button'); toggle.type = 'button'; toggle.setAttribute('role','switch'); toggle.setAttribute('aria-label',`Show ${entry.label}`);
      switches.set(entry.key,toggle);
      on(toggle,'click',() => { hidden = hidden.includes(entry.key) ? hidden.filter(key => key !== entry.key) : [...hidden,entry.key]; save(hiddenKey,hidden); apply(); });
      row.append(label,toggle); editor.append(row);
    }
    on(view,'pointermove',event => {
      if (!drag || event.pointerId !== drag.pointer || Math.abs(event.clientY-drag.y) < 5 && !drag.moved) return;
      event.preventDefault(); drag.moved = true;
      const others = ordered().filter(node => node !== drag.entry.section && !node.hidden);
      const next = others.find(node => { const rect=node.getBoundingClientRect(); return event.clientY < rect.top+rect.height/2; });
      order = order.filter(key => key !== drag.entry.key);
      const index = next ? order.indexOf(next.dataset.expArrangeSection) : others.length ? order.indexOf(others.at(-1).dataset.expArrangeSection)+1 : order.length;
      order.splice(index,0,drag.entry.key); apply();
    }, { passive:false });
    function end(event) {
      if (!drag || event.pointerId !== drag.pointer) return;
      const previous = drag; drag = null; delete previous.entry.grip.dataset.dragging;
      if (event.type !== 'pointerup') { order = previous.snapshot; apply(); } else save(orderKey,order);
      if (parent.hasPointerCapture?.(previous.pointer)) parent.releasePointerCapture(previous.pointer);
      previous.entry.grip.focus();
    }
    on(view,'pointerup',end); on(view,'pointercancel',end); on(parent,'lostpointercapture',end);
    on(view,'storage',event => { if ([orderKey,hiddenKey,null].includes(event.key) && !drag) { order=[...new Set([...read(orderKey),...defaults])]; hidden=read(hiddenKey); apply(); } });
    function resetButton(label, action) { const button=document.createElement('button');button.type='button';button.className='life-btn exp-reset';button.textContent=label;on(button,'click',action);editor.append(button); }
    resetButton('Reset menu arrangement',() => { order=[...defaults];hidden=[];save(orderKey,order);save(hiddenKey,hidden);apply(); });
    resetButton('Reset launcher arrangement',resetLaunchers);
    apply(); update();
    return { update, destroy() { abort.abort();style.remove();editor.remove();entries.forEach(entry => { entry.grip.remove();delete entry.section.dataset.expArrangeSection;entry.section.hidden=false; }); } };
  }
  return Object.freeze({ mount });
})();
