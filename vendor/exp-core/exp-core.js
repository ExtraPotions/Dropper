// Native exp-core foundation. Shared UI primitives are owned and maintained here.
const CoreFoundation = (() => {
const LAUNCHER_ORDER_KEY = "exp:v3:launcher-order";
const LAUNCHER_GRID_DELTA_KEY = "exp:v3:launcher-grid-delta";
const PRIDE_RAINBOW = "linear-gradient(90deg,#c84e66,#d07840,#be9f37,#3b8a5f,#3d79a6,#7455a4)";

const PRIDE_RAINBOW_VERTICAL = "linear-gradient(180deg,#c84e66,#d07840,#be9f37,#3b8a5f,#3d79a6,#7455a4)";

const CRIMSON_THEME = Object.freeze({ id:"crimson", name:"Crimson", swatch:"linear-gradient(135deg,#0c0508 0 38%,#941f2f 38% 69%,#2f746e 69% 100%)", canvas:"#0c0508", surface:"#1d090f", primary:"#941f2f", companion:"#5e2144", counterpoint:"#2f746e", interactive:"#b63243", bg:"#0c0508", panel:"#1d090f", line:"#4a1b28", text:"#e5d2d7", muted:"#ae8b94", accent:"#941f2f", accent2:"#b63243", skin:"linear-gradient(135deg,#941f2f 0%,#5e2144 52%,#2f746e 100%)", skinVertical:"linear-gradient(180deg,#941f2f 0%,#5e2144 52%,#2f746e 100%)" });

const UI_THEMES = Object.freeze([
    { id:"ember", name:"Ember", swatch:"linear-gradient(135deg,#120807 0 38%,#c9512c 38% 69%,#b68a32 69% 100%)", canvas:"#120807", surface:"#24100c", primary:"#c9512c", companion:"#8f2d3f", counterpoint:"#b68a32", interactive:"#e16a3b", bg:"#120807", panel:"#24100c", line:"#4e2a22", text:"#f1ddd2", muted:"#b99787", accent:"#c9512c", accent2:"#e16a3b", skin:"linear-gradient(135deg,#c9512c 0%,#8f2d3f 52%,#b68a32 100%)", skinVertical:"linear-gradient(180deg,#c9512c 0%,#8f2d3f 52%,#b68a32 100%)" },
    { id:"midnight", name:"Midnight", swatch:"linear-gradient(135deg,#050a12 0 38%,#3563a3 38% 69%,#348f8b 69% 100%)", canvas:"#050a12", surface:"#0c1726", primary:"#3563a3", companion:"#65558f", counterpoint:"#348f8b", interactive:"#477abd", bg:"#050a12", panel:"#0c1726", line:"#26364b", text:"#d4deeb", muted:"#91a2b7", accent:"#3563a3", accent2:"#477abd", skin:"linear-gradient(135deg,#3563a3 0%,#65558f 52%,#348f8b 100%)", skinVertical:"linear-gradient(180deg,#3563a3 0%,#65558f 52%,#348f8b 100%)" },
    { id:"glacier", name:"Glacier", swatch:"linear-gradient(135deg,#061216 0 38%,#4a9eaa 38% 69%,#92b85b 69% 100%)", canvas:"#061216", surface:"#0d252a", primary:"#4a9eaa", companion:"#5c76a4", counterpoint:"#92b85b", interactive:"#67b7c1", bg:"#061216", panel:"#0d252a", line:"#29464b", text:"#d8ebee", muted:"#8fa9ae", accent:"#4a9eaa", accent2:"#67b7c1", skin:"linear-gradient(135deg,#4a9eaa 0%,#5c76a4 52%,#92b85b 100%)", skinVertical:"linear-gradient(180deg,#4a9eaa 0%,#5c76a4 52%,#92b85b 100%)" },
    { id:"contrast", name:"High contrast", swatch:"linear-gradient(135deg,#000000 0 48%,#ffffff 48% 78%,#ffd400 78% 100%)", canvas:"#000000", surface:"#0a0a0a", primary:"#ffffff", companion:"#bfbfbf", counterpoint:"#ffd400", interactive:"#ffd400", bg:"#000000", panel:"#0a0a0a", line:"#ffffff", text:"#ffffff", muted:"#e0e0e0", accent:"#ffffff", accent2:"#ffd400", skin:"linear-gradient(135deg,#ffffff 0%,#bfbfbf 55%,#ffd400 100%)", skinVertical:"linear-gradient(180deg,#ffffff 0%,#bfbfbf 55%,#ffd400 100%)" },
    { id:"verdant", name:"Verdant", swatch:"linear-gradient(135deg,#06110d 0 38%,#318c61 38% 69%,#2f7f86 69% 100%)", canvas:"#06110d", surface:"#0d2218", primary:"#318c61", companion:"#667c3c", counterpoint:"#2f7f86", interactive:"#49a879", bg:"#06110d", panel:"#0d2218", line:"#28483a", text:"#d7e9df", muted:"#93aa9e", accent:"#318c61", accent2:"#49a879", skin:"linear-gradient(135deg,#318c61 0%,#667c3c 52%,#2f7f86 100%)", skinVertical:"linear-gradient(180deg,#318c61 0%,#667c3c 52%,#2f7f86 100%)" },
    { id:"pride", name:"Pride", swatch:"linear-gradient(135deg,#c84e66 0%,#d07840 16.6%,#be9f37 33.3%,#3b8a5f 50%,#3d79a6 66.6%,#7455a4 100%)", canvas:"#100a12", surface:"#1d1222", primary:"#c34f7d", companion:"#7555a6", counterpoint:"#328c82", interactive:"#dd6793", bg:"#100a12", panel:"#1d1222", line:"#4a2b50", text:"#f0ddea", muted:"#b89db4", accent:"#c34f7d", accent2:"#dd6793", skin:PRIDE_RAINBOW, skinVertical:PRIDE_RAINBOW_VERTICAL },
    { id:"twitch", name:"Twitch", swatch:"linear-gradient(135deg,#18181b 0 48%,#9147ff 48% 78%,#bf94ff 78% 100%)", canvas:"#111114", surface:"#19191e", primary:"#9147ff", companion:"#772ce8", counterpoint:"#bf94ff", interactive:"#bf94ff", bg:"#111114", panel:"#19191e", line:"#34343b", text:"#efeff1", muted:"#adadb8", accent:"#9147ff", accent2:"#bf94ff", skin:"linear-gradient(135deg,#9147ff,#bf94ff)", skinVertical:"linear-gradient(180deg,#9147ff,#bf94ff)", skinMode:"flat" },
    { id:"dropper", name:"Dropper gem", swatch:"linear-gradient(135deg,#0b0713 0 38%,#7a46c8 38% 69%,#2a8c9b 69% 100%)", canvas:"#0b0713", surface:"#171025", primary:"#7a46c8", companion:"#b14589", counterpoint:"#2a8c9b", interactive:"#9864dc", bg:"#0b0713", panel:"#171025", line:"#3c2850", text:"#e8ddf2", muted:"#aa98bb", accent:"#7a46c8", accent2:"#9864dc", skin:"linear-gradient(135deg,#7a46c8 0%,#b14589 52%,#2a8c9b 100%)", skinVertical:"linear-gradient(180deg,#7a46c8 0%,#b14589 52%,#2a8c9b 100%)" }
  ]);
const SHARED_UI_THEMES = Object.freeze(UI_THEMES.slice(0, 6));

function css() {
    return `
      :host { all: initial; }
      * { box-sizing: border-box; }
      .exp-core-theme {
        position: fixed; right: 12px; z-index: 2147483600;
        display: flex; flex-direction: column-reverse; align-items: flex-end;
        width: max-content; max-width: calc(100vw - 24px); gap: 8px;
        --theme-bg:#111114; --theme-panel:#19191e; --theme-raised:#2a2a31; --theme-inset:#0e0e10; --theme-line:#34343b; --theme-text:#efeff1; --theme-muted:#adadb8; --theme-accent:#9147ff; --theme-accent2:#bf94ff; --theme-link:#c6a4ff; --theme-focus:#bf94ff; --theme-onAccent:#111114; --theme-skin:linear-gradient(135deg,#d9b5ff,#9b5af9,#7428e8); --theme-skin-vertical:linear-gradient(180deg,#d9b5ff,#9b5af9,#7428e8); --exp-ui-opacity:1; --exp-menu-width:312px;
        font: 13px/1.42 ui-sans-serif, system-ui, "Segoe UI", sans-serif; color: var(--theme-text);
      }
      .exp-core-theme.open-up { flex-direction: column; }
      [data-exp-part="dock"],
      .update-notice {
        opacity:var(--exp-ui-opacity,1);
        transition:opacity .15s ease;
      }
      .exp-core-theme[data-panel-width="compact"] [data-exp-part="dock"],
      .exp-core-theme[data-panel-width="compact"] > .update-notice[data-placement="menu"] {
        width:min(260px, calc(100vw - 24px));
      }
      .exp-core-theme[data-panel-width="narrow"] [data-exp-part="dock"],
      .exp-core-theme[data-panel-width="narrow"] > .update-notice[data-placement="menu"] {
        width:min(220px, calc(100vw - 24px));
      }
      .exp-core-theme[data-panel-width="full"] [data-exp-part="dock"],
      .exp-core-theme[data-panel-width="full"] > .update-notice[data-placement="menu"] {
        width:min(var(--exp-menu-width,312px), calc(100vw - 24px));
      }
      .progress-age { color:#a7a7b0; }
      .progress-age.warn { color:#f59e0b; }
      .progress-age.bad { color:#ef4444; font-weight:800; }
      /* 3.2.0 progress panel */
      .exp-core-theme{pointer-events:none!important}
      .exp-core-theme :is([data-exp-part="dock"],.update-notice,[data-exp-part="launcher"]){pointer-events:auto!important}
      .exp-core-theme .badge-row{position:fixed!important;min-height:112px!important;height:auto!important;justify-content:flex-end!important;align-items:center!important;pointer-events:none!important}

      .badge-row {display:flex!important;flex-wrap:nowrap!important;align-items:center!important;gap:8px!important;width:100%!important;min-height:112px!important;height:auto!important;position:relative!important}

      [data-exp-part="launcher"] {
        position:relative; width:48px; min-width:48px; height:48px; min-height:48px; align-self:flex-end; padding:0; margin:0;
        display:grid; place-items:center; border:1px solid color-mix(in srgb,var(--theme-accent) 30%,transparent); border-radius:10px;
        background:var(--theme-panel,#18181b); box-shadow:0 6px 22px #0006; cursor:grab; touch-action:none; user-select:none;
        transition:.14s border-color,.14s box-shadow,.14s background,.14s transform;
      }
      .action-separator{grid-column:1/-1;width:100%;border:0;border-top:1px solid var(--theme-line,#34343b);margin:8px 0 0}
      .stream-subsection-label{grid-column:1/-1;min-width:0;margin:1px 0 2px;color:var(--theme-accent2);font-size:8px;font-weight:900;line-height:1.2;letter-spacing:.08em;text-transform:uppercase}
      .stream-subsection-label.with-divider{margin-top:7px;padding-top:8px;border-top:1px solid var(--theme-line,#34343b)}
      .queue-switches{display:grid;grid-template-columns:minmax(58px,.7fr) minmax(0,1.3fr);column-gap:10px;row-gap:0;min-width:0;margin:6px 0;padding:2px 0;border:0;align-items:stretch}
      .queue-switches-label{grid-column:1;grid-row:1/span 3;display:flex;align-items:center;min-width:0;font-size:11px;font-weight:700;line-height:1.2;color:var(--theme-text,#efeff1)}
      .queue-switches>.fl-switch{grid-column:2;display:flex!important;flex-direction:row!important;align-items:center!important;justify-content:space-between!important;gap:10px;min-width:0;padding:5px 0!important;text-align:left!important}
      .queue-switches>.fl-switch>span:first-child{display:block;flex:1 1 auto;width:auto!important;min-width:0!important;min-height:0!important;white-space:normal!important;word-break:normal!important;overflow-wrap:normal!important;line-height:1.25;text-align:left}
      .queue-switches>.fl-switch>.toggleSwitch{flex:0 0 34px;margin-left:auto}
      .appearance-separator{grid-column:1/-1;width:100%;border:0;border-top:1px solid var(--theme-line,#34343b);margin:3px 0 1px}
      .opacity-row{grid-column:1/-1;display:grid;grid-template-columns:auto minmax(72px,1fr) auto;align-items:center;gap:6px;min-width:0;padding:4px 0;border-top:1px solid #26262b}
      .opacity-row[hidden]{display:none!important}
      .opacity-row>span{font-size:11px;line-height:1.25;white-space:nowrap}
      [data-exp-part="opacity-range"]{width:100%;min-width:0;accent-color:var(--theme-accent)}
      [data-exp-part="opacity-value"]{min-width:34px;text-align:right;font-size:10px;font-weight:800;color:var(--theme-muted)}
      .exp-core-theme[data-panel-width="narrow"] .opacity-row{grid-template-columns:1fr auto}
      .exp-core-theme[data-panel-width="narrow"] [data-exp-part="opacity-range"]{grid-column:1/-1}
      [data-exp-part="launcher"]:hover {
        border-color:color-mix(in srgb,var(--theme-accent) 58%,transparent);
        background:color-mix(in srgb,var(--theme-panel,#18181b) 96%,var(--theme-accent) 4%);
        box-shadow:0 8px 24px #0007; transform:scale(1.015);
      }
      [data-exp-part="launcher"][aria-expanded="true"] {
        border-color:color-mix(in srgb,var(--theme-accent) 72%,transparent);
        background:var(--theme-panel,#18181b);
        box-shadow:0 0 0 1px color-mix(in srgb,var(--theme-accent) 22%,transparent),0 8px 26px #0008;
        transform:scale(1.01);
      }
      [data-exp-part="launcher"].is-dragging {
        cursor:grabbing; transform:scale(1.03); box-shadow:0 10px 28px #0009;
      }
      [data-exp-part="launcher"].update-available::after {
        content:"↑"; position:absolute; top:-4px; right:-4px; width:14px; height:14px; display:grid; place-items:center;
        border:2px solid var(--theme-panel,#18181b); border-radius:4px; background:#f59e0b; color:#111114; font-size:8px; font-weight:950;
        box-shadow:0 2px 6px #0007; z-index:4; pointer-events:none;
      }
      [data-exp-part="launcher"] .ring { position:absolute; top:50%; left:50%; width:44px; height:44px; pointer-events:none; transform:translate(-50%,-50%); }
      [data-exp-part="launcher"] .track { fill:none; stroke:color-mix(in srgb,var(--theme-line,#34343b) 72%,transparent); stroke-width:2.5; }
      [data-exp-part="launcher"] .fill { fill:none; stroke:var(--theme-accent,#9147ff); stroke-width:2.5; stroke-linecap:round; transition:.2s stroke; }
      [data-exp-part="launcher"] .icon { position:absolute; top:50%; left:50%; width:40px; height:40px; pointer-events:none; z-index:1; transform:translate(-50%,-50%); }
      [data-exp-part="dock"] {
        position:fixed; right:12px; top:auto; bottom:auto;
        display:none; width:min(var(--exp-menu-width,312px), calc(100vw - 24px)); max-width:calc(100vw - 24px);
        height:max-content; min-height:0; max-height:none; overflow-x:hidden; overflow-y:auto; overscroll-behavior:contain; flex:0 0 auto;
        transition:.15s width;
        padding:9px 9px 4px; background:var(--theme-bg); border:1px solid var(--theme-line); border-radius:14px; box-shadow:0 18px 50px #0008; color-scheme:dark;
      }
      [data-exp-part="dock"].fl-rail-open { display:block; height:max-content; min-height:0; max-height:none; }
      [data-exp-part="dock"]:focus { outline:none; }
      [data-exp-part="dock"] :is(.fl-tool-body,.row,.group,.section,.fl-tool-title) { min-width:0; max-width:100%; overflow-wrap:anywhere; }
      [data-exp-part="dock"] :is(input,select,textarea) { min-width:0; max-width:100%; }
      .menu-head {
        position:relative;
        display:grid; grid-template-columns:minmax(0,1fr) auto;
        align-items:start; gap:8px; width:100%;
      }
      .header-actions { display:flex; align-items:flex-start; gap:5px; position:static; }
      .support-wrap { position:static; }
      .support-button,
      [data-exp-part="close"] {
        width:30px; height:30px; min-width:30px; padding:0;
        border:1px solid #3a3a42; border-radius:8px; background:#151519; color:#b8b8c0;
        cursor:pointer;
      }
      .support-button { display:grid; place-items:center; }
      .support-button svg { width:15px; height:15px; fill:currentColor; }
      .support-button:hover,
      .support-button:focus-visible {
        border-color:var(--theme-accent); color:var(--theme-accent2); background:#211b2b; outline:none;
      }
      .support-popover {
        position:absolute; z-index:14; top:35px; right:0;
        width:min(190px,100%); max-width:100%;
        box-sizing:border-box; padding:8px 9px;
        border:1px solid color-mix(in srgb,var(--theme-accent) 46%,var(--theme-line));
        border-radius:9px; background:var(--theme-panel); color:var(--theme-text);
        box-shadow:0 10px 28px #0009;
      }
      .support-popover[hidden] { display:none; }
      .support-popover strong { display:block; margin-bottom:3px; font-size:10px; }
      .support-popover span { display:block; color:var(--theme-muted); font-size:8px; line-height:1.35; }
      .support-popover a {
        display:flex; align-items:center; justify-content:center; min-height:26px; margin-top:7px; padding:0 9px;
        border:1px solid color-mix(in srgb,var(--theme-accent) 58%,var(--theme-line));
        border-radius:7px; background:color-mix(in srgb,var(--theme-panel) 76%,var(--theme-accent) 24%);
        color:var(--theme-text); text-decoration:none; font-size:9px; font-weight:800;
      }
      .support-popover a:hover,
      .support-popover a:focus-visible {
        border-color:var(--theme-accent2); outline:none;
        background:color-mix(in srgb,var(--theme-panel) 66%,var(--theme-accent) 34%);
      }
      .header-brand {
        display:grid; grid-template-columns:38px minmax(0,1fr);
        align-items:center; gap:8px; min-width:0; width:100%;
      }
      .header-icon {
        box-sizing:border-box; width:38px; height:38px; display:grid; place-items:center;
        border:1px solid color-mix(in srgb,var(--theme-accent) 48%,var(--theme-line));
        border-radius:9px; background:var(--theme-panel);
        box-shadow:inset 0 0 0 1px color-mix(in srgb,#000 22%,transparent);
      }
      .header-icon .menu-icon { width:38px; height:38px; display:block; }
      .header-copy { min-width:0; overflow:hidden; }
      .header-title-row { display:flex; align-items:center; gap:6px; min-width:0; flex-wrap:wrap; }
      [data-exp-part="title"] { margin:0; font-size:15px; font-weight:800; line-height:1.1; }
      [data-exp-part="version"] {
        min-height:18px; padding:1px 6px; border:1px solid #4a3b61; border-radius:5px;
        background:#1b1721; color:#c9a7ff; cursor:pointer; font:800 8px/1 ui-sans-serif,system-ui,sans-serif;
        white-space:nowrap;
      }
      [data-exp-part="version"]:hover,
      [data-exp-part="version"]:focus-visible {
        border-color:#9147ff; background:#251d31; color:#fff; outline:none;
      }
      [data-exp-part="subtitle"] {
        margin-top:2px; font-size:9px; line-height:1.2; color:#adadb8;
        white-space:normal; overflow-wrap:anywhere;
      }
      [data-exp-part="close"] { font:18px/1 Arial,sans-serif; }
      [data-exp-part="close"]:hover,
      [data-exp-part="close"]:focus-visible { border-color:#9147ff; color:#fff; background:#211b2b; outline:none; }
      .header-divider { height:1px; width:100%; margin:5px 0; background:linear-gradient(90deg,transparent,#9147ff88 50%,transparent); }
      .update-notice {
        position:fixed; display:block; width:100%; max-width:calc(100vw - 24px); margin:0; padding:10px;
        box-sizing:border-box;
        border:1px solid color-mix(in srgb,var(--theme-accent) 62%,var(--theme-line)); border-radius:10px;
        background:
          linear-gradient(
            180deg,
            color-mix(in srgb,var(--theme-panel) 88%,var(--theme-accent) 12%),
            var(--theme-bg) 76%
          );
        color:var(--theme-text);
        box-shadow:0 10px 28px #0008; z-index:12;
      }
      .update-notice[hidden] { display:none; }
      .update-head { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; padding-right:22px; }
      .update-heading { min-width:0; }
      .update-kicker { margin-bottom:2px; color:var(--theme-accent2); font-size:8px; font-weight:900; letter-spacing:.08em; text-transform:uppercase; }
      .update-title { font-size:12px; line-height:1.25; font-weight:850; color:var(--theme-text); }
      .update-version {
        flex:none; padding:2px 6px;
        border:1px solid color-mix(in srgb,var(--theme-accent) 62%,var(--theme-line));
        border-radius:5px;
        background:color-mix(in srgb,var(--theme-panel) 82%,var(--theme-accent) 18%);
        color:var(--theme-text);
        font-size:8px; font-weight:800; white-space:nowrap;
      }
      .update-text { margin-top:6px; font-size:9px; line-height:1.45; color:var(--theme-muted); white-space:normal; overflow:visible; }
      .update-list { margin:7px 0 0; padding:0 0 0 15px; max-height:86px; overflow:auto; color:var(--theme-text); font-size:9px; line-height:1.4; scrollbar-width:thin; }
      .update-list li::marker { color:var(--theme-accent); }
      .update-list li + li { margin-top:3px; }
      .update-footer { display:flex; justify-content:flex-end; gap:6px; margin-top:8px; padding-top:7px; border-top:1px solid var(--theme-line); }
      .update-action,
      .update-release,
      .update-dismiss,
      .life-btn {
        border:1px solid var(--theme-line); border-radius:7px;
        background:var(--theme-bg); color:var(--theme-text); cursor:pointer;
      }
      .update-action,
      .update-release { min-height:27px; padding:0 10px; font-size:9px; font-weight:800; }
      .update-action { display:inline-flex; align-items:center; justify-content:center; text-decoration:none; }
      .update-action[hidden],
      .update-release[hidden] { display:none; }
      .update-action {
        border-color:var(--theme-accent);
        background:color-mix(in srgb,var(--theme-panel) 68%,var(--theme-accent) 32%);
        color:var(--theme-text);
      }
      .update-release {
        border-color:color-mix(in srgb,var(--theme-line) 78%,var(--theme-accent) 22%);
        background:var(--theme-panel);
        color:var(--theme-text);
      }
      .update-dismiss {
        position:absolute; top:7px; right:7px; width:23px; height:23px; padding:0;
        border-color:transparent; background:transparent; color:var(--theme-muted); font-size:15px; line-height:1;
      }
      .update-action:hover,
      .update-action:focus-visible,
      .update-release:hover,
      .update-release:focus-visible,
      .update-dismiss:hover,
      .update-dismiss:focus-visible,
      .life-btn:hover {
        border-color:var(--theme-accent);
        color:var(--theme-text);
        outline:none;
      }
      .update-action:hover,
      .update-action:focus-visible {
        background:color-mix(in srgb,var(--theme-panel) 55%,var(--theme-accent) 45%);
      }
      .update-release:hover,
      .update-release:focus-visible {
        background:color-mix(in srgb,var(--theme-panel) 88%,var(--theme-accent) 12%);
      }
            .exp-core-theme[data-theme-skin="gradient"] .update-notice {
        border:1px solid transparent;
        background-image:linear-gradient(var(--theme-panel),var(--theme-panel)),var(--theme-skin);
        background-origin:border-box;
        background-clip:padding-box,border-box;
      }
      .exp-core-theme[data-theme-skin="gradient"] .update-version,
      .exp-core-theme[data-theme-skin="gradient"] .update-action {
        border-color:transparent;
        background-image:linear-gradient(var(--theme-panel),var(--theme-panel)),var(--theme-skin);
        background-origin:border-box;
        background-clip:padding-box,border-box;
      }
      .toast { margin-bottom:7px; padding:6px 8px; border:1px solid #34343b; border-radius:8px; background:#18181b; color:#efeff1; font-size:9px; box-shadow:0 8px 24px #0006; }
      .toast[hidden] { display:none; }
      .fl-tool-panel { position:relative; margin-top:5px; border:1px solid #27272d; background:#19191e; border-radius:9px; overflow:visible; }
      .fl-tool-header { display:flex; justify-content:space-between; align-items:flex-start; height:auto; min-height:0; padding:7px 8px; cursor:pointer; border-radius:8px; }
      .fl-tool-header:hover { background:#9147ff18; }
      .fl-tool-header.last-opened { box-shadow:inset 3px 0 0 #b783ff; }
      .fl-tool-title { min-width:0; flex:1; font-size:12px; font-weight:700; white-space:normal; overflow-wrap:anywhere; }
      .fl-tool-chevron { background:none; border:0; color:#adadb8; cursor:pointer; }
      .fl-tool-body { padding:0 10px 8px; }
      .fl-tool-body:not(.fl-tool-hidden) { display:grid; height:auto; min-height:0; max-height:none; overflow:visible; grid-template-columns:repeat(2,minmax(0,1fr)); align-items:stretch; column-gap:8px; }
      .exp-core-theme[data-panel-width="compact"] .fl-tool-body:not(.fl-tool-hidden),
      .exp-core-theme[data-panel-width="narrow"] .fl-tool-body:not(.fl-tool-hidden) { grid-template-columns:minmax(0,1fr); }
      .exp-core-theme[data-panel-width="compact"] .fl-tool-body:not(.fl-tool-hidden) > *,
      .exp-core-theme[data-panel-width="narrow"] .fl-tool-body:not(.fl-tool-hidden) > * { grid-column:1/-1; }
      .fl-tool-body > :is(.fl-switch,.mini-row,.life-btn) { min-width:0; }
      .fl-tool-body > :is(.diag) { grid-column:1/-1; }
      .fl-tool-hidden { display:none !important; }
      .fl-switch,
      .mini-row { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; height:auto; min-height:0; padding:6px 0; }
      .fl-switch + .fl-switch,
      .mini-row + .mini-row { border-top:1px solid #26262b; }
      .fl-switch-text,
      .mini-row > span {
        min-width:0;
        font-size:11px;
        line-height:1.25;
        white-space:normal;
        word-break:normal;
        overflow-wrap:break-word;
        hyphens:none;
      }
      .toggleSwitch {
        position:relative; box-sizing:border-box; flex:none; width:34px; height:20px;
        border:1px solid color-mix(in srgb,var(--theme-line) 88%,var(--theme-muted) 12%);
        border-radius:6px;
        background:color-mix(in srgb,var(--theme-bg) 84%,var(--theme-panel) 16%);
        box-shadow:inset 0 1px 0 rgba(255,255,255,.018);
        cursor:pointer;
        transition:.15s background,.15s border-color;
      }
      .toggleSwitch::after {
        content:""; position:absolute; top:2px; left:2px; width:14px; height:14px;
        box-sizing:border-box; border:0; border-radius:4px;
        background:color-mix(in srgb,var(--theme-muted) 82%,var(--theme-text) 18%);
        box-shadow:none;
        transition:.15s transform,.15s background;
      }
      .toggleSwitch[aria-checked="true"] {
        border-color:color-mix(in srgb,var(--theme-line) 52%,var(--theme-accent) 48%);
        background:color-mix(in srgb,var(--theme-panel) 72%,var(--theme-accent) 28%);
      }
      .toggleSwitch[aria-checked="true"]::after {
        transform:translateX(14px);
        background:var(--theme-text);
      }
      .life-btn { width:100%; min-height:28px; margin-top:6px; font-size:11px; }
      .life-btn.last-opened { box-shadow:inset 3px 0 0 #b783ff; }
      .select-lite { min-width:0; max-width:72px; background:#111114; color:#efeff1; border:1px solid #34343b; border-radius:6px; padding:4px 6px; font-size:11px; }
      .auth-required {
        grid-column:1/-1;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        margin-top:6px;
        padding:7px 8px;
        border:1px solid color-mix(in srgb,#f59e0b 46%,var(--theme-line));
        border-radius:7px;
        background:color-mix(in srgb,var(--theme-panel) 84%,#f59e0b 16%);
        color:#ffe5a8;
        font-size:10px;
        font-weight:800;
      }
      .auth-required[hidden] { display:none !important; }
      .auth-required .life-btn {
        width:auto;
        min-width:112px;
        margin:0;
        flex:0 0 auto;
      }
      .auth-advanced { margin-top:2px; border:1px solid var(--theme-line); border-radius:7px; background:var(--theme-inset); padding:6px 8px; }
      .auth-advanced > summary { cursor:pointer; list-style:none; color:var(--theme-muted); font-size:11px; font-weight:600; user-select:none; }
      .auth-advanced > summary::-webkit-details-marker { display:none; }
      .auth-advanced[open] > summary { margin-bottom:6px; color:var(--theme-text); }
      .auth-advanced-body { display:flex; flex-direction:column; gap:6px; }
      .auth-hint { color:var(--theme-muted); font-size:10px; line-height:1.35; }
      .auth-input { width:100%; min-height:30px; border:1px solid var(--theme-line); border-radius:6px; background:var(--theme-inset); color:var(--theme-text); padding:6px 8px; font-size:11px; }
      .auth-input:focus { outline:2px solid var(--theme-focus); outline-offset:2px; border-color:var(--theme-focus); }
      .theme-row { grid-column:1/-1; display:flex; align-items:center; justify-content:space-between; gap:10px; min-height:28px; padding:6px 0; font-size:11px; }
      .exp-theme-swatch{box-sizing:border-box!important;flex:0 0 22px!important;width:22px!important;height:22px!important;min-width:22px!important;min-height:22px!important;max-width:22px!important;max-height:22px!important;padding:0!important;border-radius:5px!important}
      .exp-theme-swatches { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
      .exp-theme-swatch { appearance:none; width:18px; height:18px; min-width:18px; padding:0; border:2px solid var(--theme-line); border-radius:4px; box-sizing:border-box; cursor:pointer; }
      .exp-theme-swatch.is-on { border-color:var(--theme-text); box-shadow:0 0 0 2px var(--theme-accent); }
      .fl-tool-panel { border-color:var(--theme-line); background:var(--theme-panel); }
      .fl-tool-body { border-color:var(--theme-line); background:var(--theme-bg); color:var(--theme-text); }
      .select-lite,
      .life-btn { border-color:var(--theme-line); background:var(--theme-raised); color:var(--theme-text); }
      .exp-core-theme a { color:var(--theme-link); }
      .fl-tool-chevron,
      [data-exp-part="subtitle"] { color:var(--theme-muted); }
      .exp-core-theme[data-ui-theme="contrast"] .toggleSwitch { border:2px solid #fff; background:#050505; }
      .exp-core-theme[data-ui-theme="contrast"] .toggleSwitch::after { top:0; left:0; border:1px solid #050505; background:#fff; }
      .exp-core-theme[data-ui-theme="contrast"] .toggleSwitch[aria-checked="true"] { background:#fff; border-color:#fff; }
      .exp-core-theme[data-ui-theme="contrast"] .toggleSwitch[aria-checked="true"]::after { background:#050505; border-color:#fff; transform:translateX(14px); }
      @media (forced-colors: active) {
        .toggleSwitch { forced-color-adjust:none; border:1px solid CanvasText; background:Canvas; }
        .toggleSwitch::after { border-color:CanvasText; background:CanvasText; }
        .toggleSwitch[aria-checked="true"] { border-color:Highlight; background:Highlight; }
        .toggleSwitch[aria-checked="true"]::after { border-color:HighlightText; background:HighlightText; }
      }
            .exp-core-theme[data-theme-skin="gradient"] [data-exp-part="dock"] {
        border:1px solid transparent !important;
        background-origin:border-box !important;
        background-clip:padding-box, border-box !important;
        background-image:linear-gradient(var(--theme-bg),var(--theme-bg)),var(--theme-skin) !important;
      }
      .exp-core-theme[data-theme-skin="gradient"] [data-exp-part="launcher"] {
        border-color:color-mix(in srgb,var(--theme-accent) 30%,transparent) !important;
        background:var(--theme-panel) !important;
        background-image:none !important;
      }
      .exp-core-theme[data-theme-skin="gradient"] [data-exp-part="launcher"]:hover {
        border-color:color-mix(in srgb,var(--theme-accent) 58%,transparent) !important;
        background:color-mix(in srgb,var(--theme-panel) 96%,var(--theme-accent) 4%) !important;
        background-image:none !important;
      }
      .exp-core-theme[data-theme-skin="gradient"] [data-exp-part="launcher"][aria-expanded="true"] {
        border:1px solid transparent !important;
        background-image:linear-gradient(var(--theme-panel),var(--theme-panel)),var(--theme-skin) !important;
        background-origin:border-box !important;
        background-clip:padding-box,border-box !important;
      }
      .exp-core-theme[data-theme-skin="gradient"] [data-exp-part="version"] {
        border:1px solid var(--theme-line);
        background:var(--theme-bg);
        color:var(--theme-text);
        border-radius:6px;
      }
      .exp-core-theme[data-theme-skin="gradient"] [data-exp-part="version"]:hover,
      .exp-core-theme[data-theme-skin="gradient"] [data-exp-part="version"]:focus-visible {
        border-color:transparent;
        background-image:linear-gradient(var(--theme-panel),var(--theme-panel)),var(--theme-skin);
        background-origin:border-box;
        background-clip:padding-box,border-box;
      }
      .exp-core-theme[data-theme-skin="gradient"] .header-divider {
        height:2px;
        border-radius:2px;
        opacity:.9;
        background:var(--theme-skin);
        -webkit-mask-image:linear-gradient(90deg,transparent 0%,#000 16%,#000 84%,transparent 100%);
        mask-image:linear-gradient(90deg,transparent 0%,#000 16%,#000 84%,transparent 100%);
      }
      .exp-core-theme[data-theme-skin="gradient"]:not([data-ui-theme="contrast"]) .toggleSwitch[aria-checked="true"] {
        border-color:color-mix(in srgb,var(--theme-line) 52%,var(--theme-accent) 48%);
        background:color-mix(in srgb,var(--theme-panel) 72%,var(--theme-accent) 28%);
      }
      .exp-core-theme[data-theme-skin="gradient"] .exp-theme-swatch.is-on {
        border-color:var(--theme-text);
        box-shadow:0 0 0 2px var(--theme-accent2);
      }
      .exp-core-theme[data-theme-skin="gradient"] :is(.fl-tool-header,.life-btn).last-opened {
        box-shadow:none;
        position:relative;
      }
      .exp-core-theme[data-theme-skin="gradient"] :is(.fl-tool-header,.life-btn).last-opened::before {
        content:"";
        position:absolute;
        left:0;
        top:4px;
        bottom:4px;
        width:2px;
        border-radius:2px;
        background:var(--theme-skin-vertical);
      }
      .exp-core-theme[data-theme-skin="gradient"] .fl-tool-header:hover,
      .exp-core-theme[data-theme-skin="gradient"] .fl-tool-header:focus-visible,
      .exp-core-theme[data-theme-skin="gradient"] .fl-tool-header[aria-expanded="true"] {
        background:color-mix(in srgb,var(--theme-panel) 88%,var(--theme-accent) 12%);
      }
      .exp-core-theme[data-theme-skin="gradient"] :is(.life-btn,.select-lite,.auth-input):focus-visible {
        outline:2px solid transparent !important;
        border-color:transparent !important;
        background-origin:border-box !important;
        background-clip:padding-box,border-box !important;
        background-image:linear-gradient(var(--theme-bg),var(--theme-bg)),var(--theme-skin) !important;
      }
      .exp-core-theme[data-ui-theme="warm"] [data-exp-part="dock"] {
        border:1px solid color-mix(in srgb,var(--theme-line) 84%,var(--theme-accent) 16%) !important;
        background-image:
          radial-gradient(120% 65% at 50% -18%,color-mix(in srgb,var(--theme-accent) 9%,transparent),transparent 72%),
          linear-gradient(180deg,color-mix(in srgb,var(--theme-panel) 42%,var(--theme-bg) 58%),var(--theme-bg) 44%) !important;
        background-clip:padding-box !important;
        box-shadow:0 18px 50px #0009,inset 0 1px 0 #ffedcf12;
      }
      .exp-core-theme[data-ui-theme="warm"] .header-icon {
        background:linear-gradient(155deg,color-mix(in srgb,var(--theme-accent) 13%,var(--theme-panel)),var(--theme-panel) 70%);
        box-shadow:inset 0 1px 0 #ffedcf20,0 2px 9px #0005;
      }
      .exp-core-theme[data-ui-theme="warm"] [data-exp-part="version"] {
        border-color:color-mix(in srgb,var(--theme-line) 66%,var(--theme-accent) 34%);
        background:color-mix(in srgb,var(--theme-panel) 88%,var(--theme-accent) 12%);
        color:var(--theme-accent2);
      }
      .exp-core-theme[data-ui-theme="warm"] [data-exp-part="close"] {
        border-color:var(--theme-line);background:var(--theme-panel);color:var(--theme-muted);
      }
      .exp-core-theme[data-ui-theme="warm"] .header-divider {
        background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--theme-accent) 55%,transparent) 50%,transparent);
      }
      .exp-core-theme[data-ui-theme="warm"] :is(.fl-tool-header,.life-btn):not(.last-opened) {
        box-shadow:inset 0 1px 0 #ffedcf0a;
      }
      .exp-core-theme[data-ui-theme="contrast"] .toggleSwitch[aria-checked="true"] {
        background:#fff;
        border-color:#fff;
      }
      .exp-core-theme[data-ui-theme="contrast"] .toggleSwitch[aria-checked="true"]::after {
        background:#050505;
        border-color:#fff;
      }
      .campaign-manager-title { min-width:0; font-size:11px; font-weight:800; color:var(--theme-text); }
      .campaign-manager-summary { flex:0 0 auto; font-size:8px; font-weight:700; color:var(--theme-muted); }
      .campaign-manager-note { padding:6px 8px 3px; font-size:8px; line-height:1.35; color:var(--theme-muted); }
      .diag { display:none; box-sizing:border-box;width:100%;min-width:0;height:160px;max-height:160px;overflow:auto;overscroll-behavior:contain;overflow-wrap:anywhere;box-shadow:inset 0 2px 6px #0006; margin-top:6px; padding:7px; border:1px solid #2b2b31; border-radius:7px; background:#101014; font:9px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace; color:#b8b8c0; white-space:pre-wrap; }
      .diag.open { display:block; }
      .has-tooltip { position:relative; }
      .has-tooltip::after { content:attr(data-tip); position:absolute; left:0; top:calc(100% + 4px); width:min(190px, calc(100vw - 48px)); max-width:100%; padding:6px 8px; border:1px solid #3b3b44; border-radius:7px; background:#0e0e10; color:#efeff1; box-shadow:0 6px 18px #0007; box-sizing:border-box; font-size:10px; line-height:1.35; white-space:normal; overflow-wrap:anywhere; opacity:0; pointer-events:none; z-index:999; transform:translateY(-2px); transition:.12s opacity,.12s transform; }
      .has-tooltip:hover::after,
      .has-tooltip:focus-visible::after { opacity:1; transform:translateY(0); }
      .reduce-motion *,
      .reduce-motion *::before,
      .reduce-motion *::after { animation:none !important; transition:none !important; }
      @media (max-width:700px) {
        .badge-row { width:100%; }
      }
    `;
  }

function protectLauncherHost(host) {
    host = host?.getRootNode?.().host || host;
    if (!host || host.nodeType !== 1) return () => {};
    host.dataset.expOwned = '1';
    const shadow = host.shadowRoot;
    const hostCss = `:host{all:initial!important;position:fixed!important;top:0!important;left:0!important;right:auto!important;bottom:auto!important;display:block!important;width:0!important;height:0!important;min-width:0!important;min-height:0!important;max-width:none!important;max-height:none!important;margin:0!important;padding:0!important;border:0!important;overflow:visible!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;z-index:2147483647!important;isolation:isolate!important;transform:none!important;filter:none!important;clip:auto!important;clip-path:none!important;contain:none!important;content-visibility:visible!important;mix-blend-mode:normal!important}`;
    let protectionSheet = null;
    let protectionStyle = null;
    let repairing = false;
    const installHostCss = () => {
      if (!shadow) return;
      try {
        const current = shadow.adoptedStyleSheets;
        if (protectionSheet && current?.includes?.(protectionSheet)) return;
        const view = host.ownerDocument?.defaultView || window;
        const Sheet = view.CSSStyleSheet || (typeof CSSStyleSheet === 'function' ? CSSStyleSheet : null);
        if (typeof Sheet === 'function' && Sheet.prototype?.replaceSync && current && typeof current[Symbol.iterator] === 'function') {
          if (!protectionSheet) {
            protectionSheet = new Sheet();
            protectionSheet.replaceSync(hostCss);
          }
          if (![...current].includes(protectionSheet)) shadow.adoptedStyleSheets = [...current, protectionSheet];
          return;
        }
      } catch {}
      if (!protectionStyle) {
        protectionStyle = document.createElement('style');
        protectionStyle.dataset.expHostProtection = '1';
        protectionStyle.textContent = hostCss;
      }
      if (!protectionStyle.isConnected) {
        try { shadow.prepend(protectionStyle); } catch {}
      }
    };
    const ensure = () => {
      if (repairing) return;
      repairing = true;
      try {
        const root = document.documentElement;
        if (root && host.parentNode !== root) root.append(host);
        if (host.hidden) host.hidden = false;
        host.removeAttribute('hidden');
        host.removeAttribute('inert');
        if (host.getAttribute('aria-hidden') === 'true') host.removeAttribute('aria-hidden');
        installHostCss();
        if (typeof host.showPopover === 'function') {
          if (host.getAttribute('popover') !== 'manual') host.setAttribute('popover', 'manual');
          let open = false;
          try { open = host.matches(':popover-open'); } catch {}
          if (!open) { try { host.showPopover(); } catch {} }
        }
      } catch {}
      repairing = false;
    };
    ensure();
    const hostObserver = new MutationObserver(() => queueMicrotask(ensure));
    hostObserver.observe(host, { attributes: true, attributeFilter: ['hidden', 'inert', 'aria-hidden', 'popover'] });
    const rootObserver = new MutationObserver(() => {
      if (host.parentNode !== document.documentElement) queueMicrotask(ensure);
    });
    rootObserver.observe(document.documentElement, { childList: true });
    const timer = setInterval(ensure, 2000);
    const onToggle = () => queueMicrotask(ensure);
    host.addEventListener('toggle', onToggle);
    return () => {
      hostObserver.disconnect();
      rootObserver.disconnect();
      clearInterval(timer);
      host.removeEventListener('toggle', onToggle);
      if (protectionSheet && shadow?.adoptedStyleSheets) {
        try { shadow.adoptedStyleSheets = [...shadow.adoptedStyleSheets].filter((sheet) => sheet !== protectionSheet); } catch {}
      }
      try { protectionStyle?.remove(); } catch {}
    };
  }

function compareVersions(a, b) {
    const pa = String(a).split(".").map(Number), pb = String(b).split(".").map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) { const diff = (pa[i] || 0) - (pb[i] || 0); if (diff) return diff; }
    return 0;
  }
return Object.freeze({ PRIDE_RAINBOW, PRIDE_RAINBOW_VERTICAL, CRIMSON_THEME, UI_THEMES, SHARED_UI_THEMES, css, protectLauncherHost, compareVersions });
})();

/* Local diagnostic capture shared at build time by ExtraPotions products. */
const ExtraPotionsDiagnostics = (() => {
  const LIMIT = 100;
  const supportedProducts = ["dropper","shift","ward","prisma"];
  const protocol = 'exp-core-coordination-v1';
  const entries = [], hooks = [], registrations = new Map();
  const startedAt = new Date().toISOString();
  let omitted = 0, recording = false, active = true;
  const redact = value => String(value)
    .replace(/https?:\/\/[^\s"<>]+/gi, '[url]')
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[email]')
    .replace(/\b(Bearer|OAuth)\s+\S+/gi, '$1 [redacted]')
    .replace(/\b(token|password|secret|authorization|cookie)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]')
    .replace(/\b\d{3}-\d{7}-\d{7}\b/g, '[order-id]')
    .replace(/\b[A-Za-z0-9_-]{40,}\b/g, '[opaque-id]')
    .slice(0, 2000);
  function clean(value, depth = 0, seen = new WeakSet()) {
    if (depth > 8) return '[depth limit]';
    if (typeof value === 'string') return redact(value);
    if (typeof value === 'bigint') return String(value);
    if (typeof value === 'function' || typeof value === 'symbol') return undefined;
    if (!value || typeof value !== 'object') return value;
    if (value instanceof Node || value === window) return undefined;
    if (seen.has(value)) return '[circular]';
    seen.add(value);
    try {
      if (value instanceof Error) return { name: redact(value.name), message: redact(value.message), stack: redact(value.stack || '') };
      if (Array.isArray(value)) return value.slice(0, 100).map(item => clean(item, depth + 1, seen));
      const result = {};
      for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value)).slice(0, 150)) {
        if (/token|cookie|authorization|password|secret|pageText|innerHTML|outerHTML|formValue|matchText|__proto__|constructor|prototype/i.test(key)) continue;
        if (!('value' in descriptor)) continue;
        const item = clean(descriptor.value, depth + 1, seen);
        if (item !== undefined) result[key] = item;
      }
      return result;
    } catch { return '[unavailable]'; } finally { seen.delete(value); }
  }
  function record(level, kind, values) {
    if (recording || !active) return;
    recording = true;
    try {
      entries.push({ at: new Date().toISOString(), level, kind, values: clean(values.slice(0, 10)) });
      if (entries.length > LIMIT) { entries.shift(); omitted += 1; }
    } catch {} finally { recording = false; }
  }
  for (const level of ['debug', 'log', 'info', 'warn', 'error']) {
    try {
      const original = console[level];
      if (typeof original !== 'function') continue;
      const wrapped = function(...args) { record(level, 'console', args); return Reflect.apply(original, this, args); };
      console[level] = wrapped;
      if (console[level] === wrapped) hooks.push({ level, original, wrapped });
    } catch {}
  }
  function resourceErrorDetails(target) {
    const element = target?.tagName || 'unknown';
    const root = target?.getRootNode?.();
    const host = root?.host || null;
    const productId = host?.dataset?.productId || host?.dataset?.expDiagnosticsProduct || null;
    const owned = Boolean(
      productId ||
      host?.dataset?.expOwned === '1' ||
      target?.dataset?.expOwned === '1'
    );
    let assetHost = null;
    try {
      const raw = target?.currentSrc || target?.src || target?.href || '';
      assetHost = raw ? new URL(raw, location.href).hostname : null;
    } catch {}
    return {
      element,
      owner: owned ? (productId || 'extrapotions') : 'page',
      assetHost,
    };
  }
  const onError = event => record('error', event.target === window ? 'runtime-error' : 'resource-error',
    event.target === window
      ? [event.error || event.message, { line: event.lineno, column: event.colno }]
      : [resourceErrorDetails(event.target)]);
  const onRejection = event => record('error', 'unhandled-rejection', [event.reason]);
  addEventListener('error', onError, true);
  addEventListener('unhandledrejection', onRejection);

  function registerProduct(id, version, host) {
    id = String(id).toLowerCase();
    if (!supportedProducts.includes(id)) return null;
    let marker = registrations.get(id);
    if (!marker) {
      marker = document.createElement('meta');
      marker.dataset.expOwned = '1';
      marker.dataset.expDiagnosticsProduct = id;
      marker.dataset.expProductVersion = String(version || 'unknown').slice(0, 40);
      marker.dataset.expCoordinationProtocol = protocol;
      marker.dataset.expDiagnosticsInstance = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
      registrations.set(id, marker);
    }
    if (!marker.isConnected) (document.head || document.documentElement)?.append(marker);
    if (host) host.dataset.expDiagnosticsInstance = marker.dataset.expDiagnosticsInstance;
    return marker;
  }
  addEventListener('DOMContentLoaded', () => { for (const marker of registrations.values()) if (!marker.isConnected) (document.head || document.documentElement)?.append(marker); }, { once: true });
  function compatibility() {
    const markers = [...document.querySelectorAll('meta[data-exp-diagnostics-product]')];
    const hosts = [...document.querySelectorAll('[data-exp-product-launcher="1"][data-product-id]')];
    const conflicts = [];
    const products = supportedProducts.map(id => {
      const records = markers.filter(n => n.dataset.expDiagnosticsProduct === id);
      const launchers = hosts.filter(n => n.dataset.productId === id);
      const versions = [...new Set(records.map(n => redact(n.dataset.expProductVersion || 'unknown')))];
      const protocols = [...new Set(records.map(n => redact(n.dataset.expCoordinationProtocol || 'unknown')))];
      if (records.length > 1 || launchers.length > 1) conflicts.push({ type: 'duplicate-product', products: [id], instances: Math.max(records.length, launchers.length) });
      if (protocols.some(p => p !== protocol && p !== 'unknown')) conflicts.push({ type: 'protocol-mismatch', products: [id], protocols });
      return { id, status: records.length || launchers.length ? 'observed' : 'not-observed', versions, protocols, instances: Math.max(records.length, launchers.length), launchers: launchers.length };
    });
    const boxes = hosts.map(host => {
      // An inaccessible shadow or unknown box is not evidence of a collision.
      const launcher = host.shadowRoot?.querySelector('[data-exp-part="launcher"]');
      if (!launcher || !launcher.getClientRects().length || getComputedStyle(launcher).visibility === 'hidden') return null;
      return { id: host.dataset.productId, box: launcher.getBoundingClientRect() };
    }).filter(x => x && supportedProducts.includes(x.id));
    for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) {
      const x = boxes[a], y = boxes[b];
      if (Math.min(x.box.right, y.box.right) - Math.max(x.box.left, y.box.left) > 2 && Math.min(x.box.bottom, y.box.bottom) - Math.max(x.box.top, y.box.top) > 2)
        conflicts.push({ type: 'launcher-overlap', products: [x.id, y.id] });
    }
    return { scope: 'current-page', installationInventory: 'unavailable', products, conflicts,
      status: conflicts.length ? 'conflicts-detected' : 'no-conflicts-observed',
      limitations: ['Disabled products and products outside their match rules cannot be enumerated.', 'Only reported registrations, protocol mismatches, duplicate instances and observable launcher overlap are checked.'] };
  }
  function createReport(product, details = {}, core = {}) {
    const { host, shadow: suppliedShadow, ...rest } = details;
    const shadow = suppliedShadow || host?.shadowRoot;
    const id = String(product || 'ExtraPotions').toLowerCase();
    const registration = registerProduct(id, details.product?.version || details.version, host);
    const data = clean(rest);
    const count = selector => document.querySelectorAll(selector).length;
    const navigation = performance.getEntriesByType('navigation')[0];
    const resources = performance.getEntriesByType('resource');
    const byType = {};
    for (const entry of resources) {
      const summary = byType[entry.initiatorType || 'other'] ||= { count: 0, durationMs: 0, transferBytes: 0 };
      summary.count++; summary.durationMs += Math.round(entry.duration); summary.transferBytes += entry.transferSize || 0;
    }
    const page = { origin: location.origin, protocol: location.protocol, readyState: document.readyState, contentType: document.contentType, characterSet: document.characterSet, compatibilityMode: document.compatMode, language: document.documentElement?.lang || null, direction: document.documentElement?.dir || 'auto',
      structure: { elements: count('*'), headings: count('h1,h2,h3,h4,h5,h6'), links: count('a[href]'), forms: count('form'), inputs: count('input,select,textarea'), buttons: count('button,[role="button"]'), images: count('img'), videos: count('video'), audio: count('audio'), frames: count('iframe'), scripts: count('script'), stylesheets: document.styleSheets.length },
      layout: { documentWidth: document.documentElement?.scrollWidth || 0, documentHeight: document.documentElement?.scrollHeight || 0, scrollX, scrollY, horizontalOverflow: (document.documentElement?.scrollWidth || 0) > innerWidth },
      preferences: { reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches, darkColorScheme: matchMedia('(prefers-color-scheme: dark)').matches, forcedColors: matchMedia('(forced-colors: active)').matches },
      performance: { navigation: navigation ? { type: navigation.type, durationMs: Math.round(navigation.duration), responseMs: Math.round(navigation.responseEnd), domInteractiveMs: Math.round(navigation.domInteractive), domContentLoadedMs: Math.round(navigation.domContentLoadedEventEnd), loadMs: Math.round(navigation.loadEventEnd), redirectCount: navigation.redirectCount } : null, resources: { count: resources.length, byType }, paint: performance.getEntriesByType('paint').map(e => ({ name: e.name, startMs: Math.round(e.startTime) })) },
      privacy: { pageText: 'excluded', formValues: 'excluded', urlPathsAndQueries: 'excluded', resourceUrls: 'excluded', cookiesAndStorage: 'excluded; sanitized plugin state supplied separately' } };
    const environment = { hostname: location.hostname, topLevelContext: window.top === window.self, visibility: document.visibilityState, online: navigator.onLine, language: navigator.language, userAgent: navigator.userAgent, viewport: { width: innerWidth, height: innerHeight, pixelRatio: devicePixelRatio } };
    const rect = n => { const b = n.getBoundingClientRect(); return { width: b.width, height: b.height, x: b.x, y: b.y, visible: !!n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden' }; };
    const first = selector => shadow?.querySelector(selector) || null;
    const visibleFirst = selector => [...(shadow?.querySelectorAll(selector) || [])].find(n => !n.hidden && n.getClientRects().length) || first(selector);
    const progressCard = first('[data-exp-part="progress-card"]');
    const launcher = first('[data-exp-part="launcher"]');
    const launcherRow = first('[data-exp-part="launcher-row"]');
    const menu = first('[data-exp-part="dock"]');
    const notice = visibleFirst('[data-exp-update-notice],.update-notice,.changelog');
    const uiGeometry = {
      progressCardRect: progressCard ? rect(progressCard) : null,
      launcherRect: launcher ? rect(launcher) : null,
      launcherRowRect: launcherRow ? rect(launcherRow) : null,
      menuRect: menu ? rect(menu) : null,
      noticeRect: notice ? rect(notice) : null,
    };
    const ui = {
      mounted: !!host?.isConnected,
      menuWidthMode: host?.dataset.menuWidth || null,
      uiGeometry,
      progressPanelWidth: progressCard ? Math.round(progressCard.getBoundingClientRect().width) : null,
      launcherRowWidth: launcherRow ? Math.round(launcherRow.getBoundingClientRect().width) : null,
      menuWidth: menu ? Math.round(menu.getBoundingClientRect().width) : null,
      noticeWidth: notice && !notice.hidden ? Math.round(notice.getBoundingClientRect().width) : null,
      surfaces: [...(shadow?.querySelectorAll('[data-exp-part="dock"]') || [])].map(rect),
      categories: [...(shadow?.querySelectorAll('.route,.nav-item,.fl-tool-header') || [])].map(n => ({ name: redact(n.textContent.trim()), expanded: n.getAttribute('aria-expanded') })),
      swatches: [...(shadow?.querySelectorAll('.exp-theme-swatch') || [])].map(n => ({ name: n.getAttribute('aria-label'), selected: n.getAttribute('aria-pressed'), ...rect(n) })),
    };
    let manager = null;
    try { if (typeof GM_info === 'object') manager = { name: GM_info.scriptHandler || null, version: GM_info.version || null, injectInto: GM_info.injectInto || null }; } catch {}
    return { ...data, report: `${product} Diagnostics`, schemaVersion: 3, generatedAt: new Date().toISOString(), page,
      technical: { environment, manager, core: clean(core), ui, capabilities: { mutationObserver: typeof MutationObserver === 'function', constructedStylesheets: typeof CSSStyleSheet === 'function' && 'replaceSync' in CSSStyleSheet.prototype, clipboard: !!navigator.clipboard, trustedTypes: !!globalThis.trustedTypes } },
      console: { startedAt, scope: 'accessible-userscript-realm-and-window-events', limit: LIMIT, omitted, hooks: hooks.map(h => ({ level: h.level, installed: console[h.level] === h.wrapped })), entries: clean(entries), limitations: ['No DevTools history, browser-internal logs, or inaccessible isolated-world console messages.', 'Messages are redacted and bounded; attribution to another script is not inferred.'] },
      plugin: { id, version: data.product?.version || data.version || registration?.dataset.expProductVersion || null, state: data, compatibility: compatibility() },
      environment, ui, core: data.core || clean(core) };
  }
  function dispose() {
    active = false;
    for (const {level, original, wrapped} of hooks) if (console[level] === wrapped) console[level] = original;
    removeEventListener('error', onError, true); removeEventListener('unhandledrejection', onRejection);
    for (const marker of registrations.values()) marker.remove();
  }
  // Core owns the shared diagnostics interaction contract: Show/Hide first, Copy second,
  // transient Diagnostics Copied / Copy Failed feedback, and fresh reports per action.
  function bindControls({ show, copy, output, getReport, notify = () => {}, onShow = () => {}, onCopy = () => {} }) {
    let timer, generation = 0;
    output.hidden = true; output.setAttribute('role', 'region');
    output.setAttribute('aria-label', 'Page, technical, console, and plugin diagnostics'); output.tabIndex = 0;
    show.setAttribute('aria-expanded', 'false');
    const showClick = async () => {
      const opening = output.hidden, ticket = ++generation;
      output.hidden = !opening; output.classList.toggle('open', opening);
      show.textContent = opening ? 'Hide Diagnostics' : 'Show Diagnostics';
      show.setAttribute('aria-expanded', String(opening)); show.classList.toggle('last-opened', opening);
      if (opening) {
        try { const report = await getReport(); if (ticket === generation) output.textContent = JSON.stringify(report, null, 2); }
        catch { if (ticket === generation) output.textContent = 'Diagnostics unavailable.'; notify('Could not generate diagnostics.'); }
      }
      onShow(opening);
    };
    const copyClick = async () => {
      copy.disabled = true; clearTimeout(timer);
      try {
        await navigator.clipboard.writeText(JSON.stringify(await getReport(), null, 2));
        copy.textContent = 'Diagnostics Copied'; onCopy();
      } catch { copy.textContent = 'Copy Failed'; notify('Could not copy diagnostics. Use Show Diagnostics.'); }
      finally { copy.disabled = false; timer = setTimeout(() => { copy.textContent = 'Copy Diagnostics'; }, 1600); }
    };
    show.addEventListener('click', showClick); copy.addEventListener('click', copyClick);
    return () => { ++generation; clearTimeout(timer); show.removeEventListener('click', showClick); copy.removeEventListener('click', copyClick); };
  }
  function createControls(getReport, notify) {
    const wrapper = document.createElement('div'); wrapper.className = 'diagnostics-controls';
    const actions = document.createElement('div'); actions.className = 'action-pair';
    const show = document.createElement('button'), copy = document.createElement('button'), output = document.createElement('pre');
    for (const button of [show, copy]) { button.type = 'button'; button.className = 'life-btn action'; }
    show.textContent = 'Show Diagnostics'; copy.textContent = 'Copy Diagnostics'; output.className = 'diag';
    bindControls({ show, copy, output, getReport, notify });
    actions.append(show, copy); wrapper.append(actions, output); return wrapper;
  }
  return Object.freeze({ createReport, registerProduct, compatibility, bindControls, createControls, dispose });
})();

/* Canonical ExtraPotions shared lifecycle runtime. */
function createProductLifecycle(shared) {
  const VERSION = shared.version;
  const PROTOCOL = 'exp-core-coordination-v1';
  const CAPABILITIES = new Set(['lifecycle', 'settings', 'diagnostics', 'dom-scheduler', 'navigation', 'launcher', 'ui']);
  const products = new Map();
  const cleanups = new Set();
  const errors = [];
  const metrics = { batches: 0, roots: 0, startedAt: Date.now() };
  let coordinator;
  const navigationSubscribers = new Set();
  let stopNavigationHooks;

  function compareVersions(left, right) {
    const a = String(left).split(/[.-]/).slice(0, 3).map((part) => Number(part) || 0);
    const b = String(right).split(/[.-]/).slice(0, 3).map((part) => Number(part) || 0);
    for (let index = 0; index < 3; index += 1) if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
    return 0;
  }

  function negotiate(peerVersion, peerProtocol = PROTOCOL) {
    if (peerProtocol !== PROTOCOL || !/^\d+\.\d+\.\d+/.test(peerVersion || '')) return { compatible: false, selection: 'isolated', reason: 'PROTOCOL_INCOMPATIBLE' };
    const comparison = compareVersions(VERSION, peerVersion);
    return { compatible: true, selection: comparison < 0 ? 'peer-newer' : comparison > 0 ? 'local-newer' : 'equal', reason: 'COMPATIBLE' };
  }

  const safeError = (error, source = 'core') => {
    const message = String(error && error.message || error || 'Unknown error').replace(/https?:\/\/\S+/g, '[url]').slice(0, 180);
    errors.push({ source, code: error && error.code || 'UNEXPECTED', message, at: Date.now() });
    if (errors.length > 12) errors.shift();
  };

  function ensureCoordinator() {
    if (!document.documentElement) return null;
    coordinator = document.querySelector('[data-exp-core-coordinator="1"]');
    if (!coordinator) {
      coordinator = document.createElement('meta');
      coordinator.dataset.expCoreCoordinator = '1';
      coordinator.dataset.protocol = PROTOCOL;
      coordinator.dataset.protocolVersion = '1';
      document.documentElement.append(coordinator);
    }
    const selected = coordinator.dataset.activeCoreVersion;
    if (!selected || compareVersions(VERSION, selected) > 0) coordinator.dataset.activeCoreVersion = VERSION;
    return coordinator;
  }

  function announce(type, detail = {}) {
    const node = ensureCoordinator();
    if (!node) return;
    const payload = { protocol: PROTOCOL, protocolVersion: 1, coreVersion: VERSION, type, ...detail };
    document.dispatchEvent(new CustomEvent('exp-core:coordination', { detail: payload }));
  }

  function publishProduct(manifest, state) {
    const node = ensureCoordinator();
    if (!node) return;
    const key = `product${manifest.id.replace(/[^a-z0-9]/gi, '')}`;
    node.dataset[key] = JSON.stringify({ id: manifest.id, version: manifest.version, state, capabilities: manifest.capabilities });
    announce('product-state', { productId: manifest.id, productVersion: manifest.version, state });
  }

  function validateManifest(manifest) {
    if (!manifest || !/^[a-z][a-z0-9-]+$/.test(manifest.id || '')) throw Object.assign(new Error('Invalid product ID'), { code: 'MANIFEST_ID' });
    if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.version || '')) throw Object.assign(new Error('Invalid product version'), { code: 'MANIFEST_VERSION' });
    if (!Array.isArray(manifest.capabilities)) throw Object.assign(new Error('Capabilities must be an array'), { code: 'MANIFEST_CAPABILITIES' });
    const missing = manifest.capabilities.filter((item) => !CAPABILITIES.has(item));
    if (missing.length) throw Object.assign(new Error(`Missing Core capability: ${missing.join(', ')}`), { code: 'CAPABILITY_MISSING' });
  }

  function register(manifest, hooks) {
    validateManifest(manifest);
    if (products.has(manifest.id)) return products.get(manifest.id).public;
    const record = { manifest: Object.freeze({ ...manifest }), hooks, state: 'registered', queue: Promise.resolve() };
    const transition = (allowed, next, action) => {
      record.queue = record.queue.catch(() => {}).then(async () => {
        if (!allowed.includes(record.state)) return;
        try {
          await action?.();
          record.state = next;
          publishProduct(record.manifest, next);
        } catch (error) {
          record.state = 'failed';
          safeError(error, manifest.id);
          publishProduct(record.manifest, 'failed');
          throw error;
        }
      });
      return record.queue;
    };
    record.public = Object.freeze({
      manifest: record.manifest,
      get state() { return record.state; },
      initialize: () => transition(['registered', 'failed'], 'initialized', hooks.initialize),
      enable: () => transition(['initialized', 'disabled'], 'enabled', hooks.enable),
      disable: () => transition(['enabled'], 'disabled', hooks.disable),
      cleanup: () => transition(['registered', 'initialized', 'enabled', 'disabled', 'failed'], 'cleaned', hooks.cleanup)
    });
    products.set(manifest.id, record);
    publishProduct(record.manifest, 'registered');
    return record.public;
  }

  function createScheduler(callback, options = {}) {
    let observer;
    let sharedObserverCleanup;
    let frame = 0;
    let active = false;
    const roots = new Set();
    const flush = () => {
      frame = 0;
      if (!active || !roots.size) return;
      const batch = [...roots];
      roots.clear();
      metrics.batches += 1;
      metrics.roots += batch.length;
      try { callback(batch); } catch (error) { safeError(error, options.source || 'scheduler'); }
    };
    const queueRoot = (root) => {
      if (!active || !root || root.closest?.('[data-exp-owned="1"]')) return false;
      const target = root.nodeType === Node.TEXT_NODE ? root.parentElement : root;
      if (!target) return false;
      roots.add(target);
      return true;
    };
    const schedule = (root) => {
      if (!queueRoot(root)) return;
      if (!frame) frame = requestAnimationFrame(flush);
    };
    const startDedicatedObserver = () => {
      observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          const target = mutation.target?.nodeType === Node.TEXT_NODE ? mutation.target.parentElement : mutation.target;
          if (!target) continue;
          if (target.closest?.('[data-exp-owned="1"]')) continue;
          if (mutation.type === 'childList') {
            const changed = [...mutation.addedNodes, ...mutation.removedNodes];
            if (changed.length && changed.every((node) => node.nodeType === 1 && (node.matches?.('[data-exp-owned="1"]') || node.closest?.('[data-exp-owned="1"]')))) continue;
          }
          schedule(target);
        }
      });
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: Boolean(options.attributes),
        characterData: Boolean(options.characterData),
        attributeFilter: options.attributeFilter
      });
    };
    return Object.freeze({
      start() {
        if (active) return;
        active = true;
        if (!options.attributes && typeof shared.observePageBatch === 'function') {
          const productId = options.source || 'scheduler';
          const phase = options.phase || shared.suiteContract?.(productId)?.presentationPhases?.[0] || 'observe';
          sharedObserverCleanup = shared.observePageBatch((batch, batchRoots, details) => {
            for (let index = 0; index < batchRoots.length; index += 1) {
              const types = Array.isArray(details?.[index]?.types) ? details[index].types : [];
              if (!options.characterData && types.length && types.every(type => type === 'characterData')) continue;
              queueRoot(batchRoots[index]);
            }
            if (roots.size) {
              if (frame) { cancelAnimationFrame(frame); frame = 0; }
              flush();
            }
          }, { productId, phase });
        } else if (!options.attributes && typeof shared.observePage === 'function') {
          sharedObserverCleanup = shared.observePage((batch, root) => {
            const types = Array.isArray(batch?.types) ? batch.types : [];
            if (!options.characterData && types.length && types.every(type => type === 'characterData')) return;
            schedule(root);
          }, { productId: options.source || 'scheduler' });
        } else {
          startDedicatedObserver();
        }
        schedule(document.documentElement);
      },
      stop() {
        active = false;
        sharedObserverCleanup?.();
        sharedObserverCleanup = null;
        observer?.disconnect();
        observer = null;
        roots.clear();
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
      },
      schedule,
      flush
    });
  }

  function onNavigation(callback) {
    if (typeof callback !== 'function') throw new TypeError('Navigation callback must be a function');
    if (typeof shared.observeNavigation === 'function') {
      let disposed = false;
      const stop = shared.observeNavigation(event => callback({
        href: event.href,
        kind: event.kind,
        epoch: event.epoch,
      }), { owner: 'lifecycle' });
      const cleanup = () => {
        if (disposed) return;
        disposed = true;
        stop();
        cleanups.delete(cleanup);
      };
      cleanups.add(cleanup);
      return cleanup;
    }
    let previous=location.href;
    const subscriber=({href})=>{if(href!==previous){previous=href;callback({href});}};
    if (!stopNavigationHooks) {
      const originals={},wrappers={};
      const check=()=>{const href=location.href;for(const notify of [...navigationSubscribers])notify({href});};
      for(const name of ['pushState','replaceState']){const original=history[name];originals[name]=original;const wrapped=function(...args){const result=Reflect.apply(original,this,args);check();return result;};wrappers[name]=wrapped;history[name]=wrapped;}
      addEventListener('popstate',check);addEventListener('hashchange',check);globalThis.navigation?.addEventListener('currententrychange',check);
      stopNavigationHooks=()=>{for(const name of Object.keys(wrappers))if(history[name]===wrappers[name])history[name]=originals[name];removeEventListener('popstate',check);removeEventListener('hashchange',check);globalThis.navigation?.removeEventListener('currententrychange',check);stopNavigationHooks=null;};
    }
    navigationSubscribers.add(subscriber);
    let disposed=false;
    const cleanup=()=>{if(disposed)return;disposed=true;navigationSubscribers.delete(subscriber);cleanups.delete(cleanup);if(!navigationSubscribers.size)stopNavigationHooks?.();};
    cleanups.add(cleanup);return cleanup;
  }


  function protectLauncherHost(host) { return shared.reference.protectLauncherHost(host); }

  function registerLauncher(host, options) { const cleanup = shared.registerLauncher(host, options); cleanups.add(cleanup); return cleanup; }

  function pageView() {
    try { if (typeof unsafeWindow !== 'undefined' && unsafeWindow?.document) return unsafeWindow; } catch {}
    return window;
  }

  function isShadowRoot(node) {
    return Boolean(node && node.nodeType === 11 && node.host);
  }

  // Every stylesheet Core injects begins with an empty marker rule. A constructed sheet
  // has no owner node, and a tool such as SHIFT cannot see a JavaScript flag across
  // userscript sandboxes, but it can always read the first rule through the CSSOM.
  const OWNED_SHEET_MARKER = '.exp-owned-sheet-marker{}';
  const ensureMarker = (text) => { const value = String(text || ''); return value.startsWith(OWNED_SHEET_MARKER) ? value : OWNED_SHEET_MARKER + value; };

  function appendShadowStyle(root, css, data) {
    const node = document.createElement('style');
    try { node.textContent = ensureMarker(css); } catch (error) { safeError(error, 'core.style'); }
    node.dataset.expOwned = '1';
    for (const [key, value] of Object.entries(data || {})) node.dataset[key] = String(value);
    root.append(node);
    return node;
  }

  function paintToken() {
    return `expink${Math.random().toString(36).slice(2, 10)}`;
  }

  function withPaintProbe(css, token) {
    css = ensureMarker(css);
    return `${css}\n[data-${token}]{color:rgb(1, 2, 3)!important}`;
  }

  function isConnectedNode(node) {
    try { return Boolean(node && (node.isConnected || node.host?.isConnected)); } catch { return false; }
  }

  function sheetHasRules(sheet) {
    try { return sheet.cssRules.length > 0; } catch { return null; }
  }

  function sawPaint(token, parent) {
    if (!parent || !isConnectedNode(parent)) return false;
    const probe = document.createElement('span');
    probe.setAttribute(`data-${token}`, '');
    parent.append(probe);
    let painted = false;
    try { painted = getComputedStyle(probe).color === 'rgb(1, 2, 3)'; } catch {}
    try { probe.remove(); } catch { probe.parentNode?.removeChild(probe); }
    return painted;
  }

  function writeSheet(sheet, text, view) {
    const source = ensureMarker(text);
    try { sheet.replaceSync(source); return; } catch {}
    view.Function('sheet', 'css', 'sheet.replaceSync(css)')(sheet, source);
  }

  function setAdopted(host, sheets) {
    try { host.adoptedStyleSheets = sheets; return; } catch {}
    const view = pageView();
    const proto = isShadowRoot(host) ? (view.ShadowRoot || ShadowRoot).prototype : (view.Document || Document).prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'adoptedStyleSheets');
    if (!desc?.set) throw new Error('adoptedStyleSheets unavailable');
    desc.set.call(host, sheets);
  }

  function adoptConstructable(host, css, shadow) {
    const view = pageView();
    const Ctor = view.CSSStyleSheet || (typeof CSSStyleSheet === 'function' ? CSSStyleSheet : null);
    if (typeof Ctor !== 'function' || !Ctor.prototype.replaceSync) return null;
    const current = host.adoptedStyleSheets;
    if (!current || typeof current[Symbol.iterator] !== 'function') return null;
    const sheet = new Ctor();
    const token = paintToken();
    writeSheet(sheet, withPaintProbe(css, token), view);
    const before = current.length;
    setAdopted(host, [...current, sheet]);
    const sample = shadow || host.documentElement || host;
    if (host.adoptedStyleSheets.length !== before + 1) {
      try { setAdopted(host, [...host.adoptedStyleSheets].filter((item) => item !== sheet)); } catch {}
      throw new Error('adoptedStyleSheets ignored');
    }
    const painted = isConnectedNode(sample) ? sawPaint(token, sample) : sheetHasRules(sheet) !== false;
    if (!painted) {
      try { setAdopted(host, [...host.adoptedStyleSheets].filter((item) => item !== sheet)); } catch {}
      throw new Error('adoptedStyleSheets did not paint');
    }
    writeSheet(sheet, css, view);
    return {
      sheet,
      write: (text) => writeSheet(sheet, text, view),
      detach() {
        try { setAdopted(host, [...host.adoptedStyleSheets].filter((item) => item !== sheet)); } catch {}
      }
    };
  }

  function injectShadowStyle(root, css, data) {
    const mark = (node) => {
      node.dataset.expOwned = '1';
      for (const [key, value] of Object.entries(data || {})) node.dataset[key] = String(value);
      return node;
    };
    const fail = (error) => safeError(Object.assign(error || new Error('Style injection failed'), { code: 'STYLE_INJECTION' }), 'core.style');
    // Adopted sheets stay inside the shadow and still apply when the page CSP
    // blocks <style>. GM_addElement / GM_addStyle are not used here: managers
    // attach those to the document and leak header/nav/button/* onto the site.
    try {
      const adopted = adoptConstructable(root, css, root);
      if (adopted) {
        const node = document.createElement('style');
        let current = css;
        Object.defineProperty(node, 'textContent', {
          configurable: true,
          enumerable: true,
          get() { return current; },
          set(value) {
            current = String(value || '');
            try { adopted.write(current); } catch (error) { fail(error); }
          }
        });
        node.remove = () => {
          try { adopted.detach(); } catch {}
          if (node.parentNode) node.parentNode.removeChild(node);
        };
        try { root.append(node); } catch {}
        return mark(node);
      }
    } catch (error) { fail(error); }
    return appendShadowStyle(root, css, data);
  }

  function injectStyle(root, cssText, data = {}) {
    const css = String(cssText || '');
    if (isShadowRoot(root)) return injectShadowStyle(root, css, data);
    const isShadow = false;
    const view = pageView();
    const doc = view.document || document;
    const parent = isShadow ? root : (doc.documentElement || doc.head || doc.body);
    const host = isShadow ? root : doc;
    const sample = isShadow ? root : (doc.body || doc.documentElement);
    const mark = (node) => {
      node.dataset.expOwned = '1';
      for (const [key, value] of Object.entries(data || {})) node.dataset[key] = String(value);
      return node;
    };
    const fail = (error) => safeError(Object.assign(error || new Error('Style injection failed'), { code: 'STYLE_INJECTION' }), 'core.style');
    const handle = (write, detach) => {
      const node = document.createElement('style');
      let current = css;
      Object.defineProperty(node, 'textContent', {
        configurable: true,
        enumerable: true,
        get() { return current; },
        set(value) {
          current = String(value || '');
          try { write(current); } catch (error) { fail(error); }
        }
      });
      node.remove = () => {
        try { detach(); } catch {}
        if (node.parentNode) node.parentNode.removeChild(node);
      };
      parent.append(node);
      return mark(node);
    };
    try {
      if (typeof GM_addElement === 'function') {
        const token = paintToken();
        let live = GM_addElement(parent, 'style', { textContent: withPaintProbe(css, token) });
        if (live && sawPaint(token, sample)) {
          try { live.textContent = ensureMarker(css); } catch {}
          return handle(
            (text) => {
              try { live.textContent = ensureMarker(text); } catch {
                const next = GM_addElement(parent, 'style', { textContent: ensureMarker(text) });
                try { live.remove(); } catch {}
                live = next;
              }
            },
            () => { try { live.remove(); } catch {} }
          );
        }
        try { live?.remove(); } catch {}
      }
    } catch (error) { fail(error); }
    try {
      if (!isShadow && typeof GM_addStyle === 'function') {
        const token = paintToken();
        let live = GM_addStyle(withPaintProbe(css, token));
        if (live && sawPaint(token, sample)) {
          try { live.textContent = ensureMarker(css); } catch {}
          return handle(
            (text) => {
              try { live.textContent = ensureMarker(text); } catch { live = GM_addStyle(ensureMarker(text)); }
            },
            () => { try { live.remove(); } catch {} }
          );
        }
        try { live?.remove(); } catch {}
      }
    } catch (error) { fail(error); }
    try {
      const adopted = adoptConstructable(host, css, sample);
      if (adopted) return handle((text) => adopted.write(text), () => adopted.detach());
    } catch (error) { fail(error); }
    const node = document.createElement('style');
    try { node.textContent = ensureMarker(css); } catch (error) { fail(error); }
    parent.append(node);
    return mark(node);
  }

  function diagnosticSnapshot() {
    return {
      core: { version: VERSION, protocol: PROTOCOL, capabilities: [...CAPABILITIES] },
      products: [...products.values()].map(({ manifest, state }) => ({ id: manifest.id, version: manifest.version, state })),
      metrics: { ...metrics, uptimeMs: Date.now() - metrics.startedAt },
      errors: errors.map(({ source, code, message }) => ({ source, code, message }))
    };
  }

  function focusMenuSurface(surface) { if (!(surface instanceof HTMLElement)) return false; if (!surface.hasAttribute('tabindex')) surface.setAttribute('tabindex', '-1'); surface.style.outline='none'; surface.focus({ preventScroll: true }); return true; }

  addEventListener('pagehide', () => { for (const cleanup of cleanups) { try { cleanup(); } catch {} } }, { once: true });
  return Object.freeze({
    VERSION, PROTOCOL, register, createScheduler, onNavigation, registerLauncher, announce, negotiate, safeError,
    diagnosticSnapshot, diagnostics: diagnosticSnapshot, focusMenuSurface, injectStyle,
    registerFloatingNotice: shared.registerFloatingNotice,
    layoutFloatingNotices: shared.layoutFloatingNotices,
    claimNotice: shared.claimNotice,
    consumeVersionChange: shared.consumeVersionChange,
  });
}

// Shared, local-only compatibility controls.
const ExtraPotionsTools = (() => {
  const PRODUCT_ROOT_IDS = {"dropper":"tdh-root","shift":"exp-shift-root","ward":"exp-ward-root","prisma":"exp-prisma-root"};
  function placeDonationPanel(panel, trigger){
    trigger.closest('.menu-head,header')?.after(panel);
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
    for(const [id,rootId] of Object.entries(PRODUCT_ROOT_IDS)){
      const markers=[...document.querySelectorAll('[data-exp-diagnostics-product]')].filter(n=>n.dataset.expDiagnosticsProduct===id);
      if(!markers.length)continue;
      const productVersions=[...new Set(markers.map(n=>n.dataset.expProductVersion||'unknown'))];
      const host=document.getElementById(rootId);
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

// Shared ExtraPotions menu categories, submenu behavior, reordering, and visibility.
const ExpMenuArrangement = (() => {
  const CATEGORY_ORDER = Object.freeze(['main', 'appearance', 'advanced', 'system']);
  const CATEGORY_META = Object.freeze({
    main: Object.freeze({ id: 'main', label: 'Main', order: 0 }),
    appearance: Object.freeze({ id: 'appearance', label: 'Appearance', order: 1 }),
    advanced: Object.freeze({ id: 'advanced', label: 'Advanced', order: 2 }),
    system: Object.freeze({ id: 'system', label: 'System', order: 3 }),
  });
  const PRODUCT_SECTIONS = {"dropper":{"main":["drops","streams"],"appearance":["appearance"],"advanced":["advanced"],"system":["system"]},"shift":{"appearance":["appearance","readability"],"advanced":["effects","effects-integrations","profiles","profiles-sites"],"system":["system"]},"ward":{"main":["protection","amazon","tools"],"appearance":["appearance"],"advanced":["advanced","patterns","advanced-amazon"],"system":["system"]},"prisma":{"main":["page","highlights"],"appearance":["style","highlight-style","look","appearance"],"advanced":["tools","language","sites"],"system":["system"]}};
  const GENERIC_SECTIONS = Object.freeze({
    appearance: Object.freeze(['appearance', 'readability', 'style', 'highlight-style', 'look', 'theme', 'themes']),
    advanced: Object.freeze(['advanced', 'effects', 'integrations', 'profiles', 'sites', 'language', 'patterns', 'routing', 'playback']),
    system: Object.freeze(['system', 'settings', 'diagnostics', 'maintenance', 'recovery']),
  });
  const slug = value => String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const categoryList = Object.freeze(CATEGORY_ORDER.map(id => CATEGORY_META[id]));

  function categoryFor(productId, section = {}, index = 0) {
    const product = slug(productId);
    const key = slug(section.key || section.id || section.route);
    const label = slug(section.label || section.name || section.title);
    const tokens = new Set([key, label].filter(Boolean));
    const profile = PRODUCT_SECTIONS[product] || {};
    for (const category of CATEGORY_ORDER) {
      const aliases = profile[category] || [];
      if (aliases.some(alias => tokens.has(slug(alias)))) return category;
    }
    for (const category of ['system', 'appearance', 'advanced']) {
      if (GENERIC_SECTIONS[category].some(alias => tokens.has(slug(alias)))) return category;
    }
    if (index === 0) return 'main';
    return 'main';
  }

  function describe(productId, sections = []) {
    const groups = new Map(CATEGORY_ORDER.map(id => [id, {
      ...CATEGORY_META[id],
      sections: [],
    }]));
    sections.forEach((section, index) => {
      const category = categoryFor(productId, section, index);
      groups.get(category).sections.push(section);
    });
    return CATEGORY_ORDER.map(id => groups.get(id)).filter(group => group.sections.length);
  }

  function createDisclosure({ document, label, category = 'advanced', key = '', contents = [], className = 'exp-system-card' } = {}) {
    if (!document?.createElement) throw new Error('Menu disclosure requires a document');
    const details = document.createElement('details');
    details.className = className;
    details.dataset.expMenuSubmenu = '1';
    details.dataset.expMenuCategory = CATEGORY_META[category] ? category : 'advanced';
    if (key) details.dataset.expMenuKey = slug(key);
    details.open = false;
    // Core created this submenu in its canonical collapsed state. Mark it initialized
    // immediately so a later arrangement refresh cannot re-collapse a user-opened
    // disclosure during the same interaction.
    details.dataset.expMenuInitialized = '1';
    const summary = document.createElement('summary');
    summary.textContent = String(label || CATEGORY_META[category]?.label || 'Advanced');
    details.append(summary, ...contents);
    return details;
  }

  function collapseSubmenus(root) {
    if (!root?.querySelectorAll) return;
    for (const details of root.querySelectorAll('details[data-exp-menu-submenu]')) {
      if (details.dataset.expMenuInitialized === '1') continue;
      details.open = false;
      details.dataset.expMenuInitialized = '1';
    }
  }

  const css = `
    [data-exp-menu-submenu]{box-sizing:border-box;min-width:0;max-width:100%;overflow-wrap:anywhere}
    [data-exp-menu-submenu]>summary{cursor:pointer}
  `;

  // Tags each menu section with its category and keeps sections in category
  // order (Main, Appearance, Advanced, System). Sections keep their own order
  // inside a category; there is nothing for the user to arrange or hide.
  function mount({ panel, id, onChange = () => {} }) {
    const document = panel.ownerDocument, view = document.defaultView;
    collapseSubmenus(panel);
    const entries = [...panel.querySelectorAll(':scope .fl-tool-panel')].filter(section => section.parentElement === panel || section.parentElement?.closest('.fl-tool-panel') === null).map(section => {
      const header = section.querySelector(':scope>.fl-tool-header');
      const body = section.querySelector(':scope>.fl-tool-body');
      if (!header || !body) return null;
      const label = (header.querySelector('.fl-tool-title') || header).textContent.replace(/[▸▾›]/g, '').trim();
      const key = header.dataset.route || header.dataset.section || header.dataset.panel || body.id;
      return { section, header, body, label, key };
    }).filter(entry => entry?.key);
    const none = { update() { collapseSubmenus(panel); }, describe: () => [], destroy() {} };
    if (entries.length < 2) return none;
    const parent = entries[0].section.parentElement;
    if (entries.some(entry => entry.section.parentElement !== parent)) return none;
    entries.forEach((entry, index) => {
      entry.category = categoryFor(id, entry, index);
      entry.section.dataset.expMenuCategory = entry.category;
    });
    const style = document.createElement('style'); style.textContent = css;
    const styleRoot = panel.getRootNode();
    (styleRoot instanceof view.ShadowRoot ? styleRoot : (document.head || document.documentElement)).append(style);
    const rank = entry => CATEGORY_ORDER.indexOf(entry.category);
    const desired = [...entries].sort((a, b) => rank(a) - rank(b));
    function apply() {
      const present = entries.filter(entry => entry.section.parentElement === parent);
      const wanted = desired.filter(entry => present.includes(entry));
      const current = [...parent.children].filter(node => wanted.some(entry => entry.section === node));
      const after = current.length ? current.at(-1).nextSibling : null;
      for (const entry of wanted) parent.insertBefore(entry.section, after);
      onChange();
    }
    apply();
    return {
      update() { collapseSubmenus(panel); },
      describe: () => describe(id, entries.map(({ key, label, category }) => ({ key, label, category }))),
      destroy() {
        style.remove();
        entries.forEach(entry => { delete entry.section.dataset.expMenuCategory; });
      }
    };
  }

  return Object.freeze({
    categories: categoryList,
    categoryFor,
    describe,
    createDisclosure,
    collapseSubmenus,
    mount,
  });
})();

// Product-neutral shared runtime. Product engines own their settings, content, and actions.
// exp-core owns shared UI, launcher, diagnostics, update, and coordination behavior.
const ExtraPotionsCore = (() => {
  'use strict';
  const version = '3.4.7';
  const sourceVersion = version; // Backward-compatible alias for Core's own foundation version.
  const SUPPORT_URL = 'https://ko-fi.com/expdare';
  const protocol = 'exp-core-coordination-v1';
  const gridProtocol = 'exp-launcher-grid-v3';
  const GRID_ORDER = 'exp:v3:launcher-order';
  const GRID_DELTA = 'exp:v3:launcher-grid-delta';
  // Product importance, launcher placement, and theme ownership are separate
  // coordination policies backed by the same canonical suite manifest.
  const freezeSuiteContract = values => Object.freeze(Object.fromEntries(
    Object.entries(values || {}).map(([id, value]) => [id, Object.freeze({
      role: String(value?.role || 'product'),
      repository: String(value?.repository || ''),
      rootId: String(value?.rootId || ''),
      priority: Number(value?.priority || 0),
      launcherPriority: Number(value?.launcherPriority || 0),
      themePriority: Number(value?.themePriority || 0),
      capabilities: Object.freeze([...(value?.capabilities || [])]),
      presentationPhases: Object.freeze([...(value?.presentationPhases || [])]),
      menuSections: Object.freeze(Object.fromEntries(
        Object.entries(value?.menuSections || {}).map(([category, sections]) => [category, Object.freeze([...(sections || [])])])
      )),
      state: value?.state ? Object.freeze({
        type: String(value.state.type || ''),
        fields: Object.freeze({ ...(value.state.fields || {}) }),
      }) : null,
    })])
  ));
  const SUITE_PRODUCTS = freezeSuiteContract({"dropper":{"role":"flagship","priority":4,"launcherPriority":110,"themePriority":4,"capabilities":["twitch.drops","twitch.campaigns","twitch.progress","twitch.claims","twitch.stream-management"],"presentationPhases":[],"state":{"type":"dropper.state-changed","fields":{"activeReward":"boolean","progressPercent":"percent-nullable","routingState":"token"}},"menuSections":{"main":["drops","streams"],"appearance":["appearance"],"advanced":["advanced"],"system":["system"]},"repository":"Dropper","rootId":"tdh-root"},"shift":{"role":"product","priority":3,"launcherPriority":100,"themePriority":3,"capabilities":["appearance.theme","appearance.readability","appearance.site-profile"],"presentationPhases":["theme"],"state":{"type":"shift.state-changed","fields":{"active":"boolean","theme":"token","safeMode":"boolean","excluded":"boolean"}},"menuSections":{"appearance":["appearance","readability"],"advanced":["effects","effects-integrations","profiles","profiles-sites"],"system":["system"]},"repository":"SHIFT","rootId":"exp-shift-root"},"ward":{"role":"product","priority":2,"launcherPriority":60,"themePriority":1,"capabilities":["retail.classification","retail.cleanup","retail.coupons"],"presentationPhases":["classify","visibility"],"state":{"type":"ward.state-changed","fields":{"active":"boolean","pageType":"token","interventions":"count","hide":"count","dim":"count","collapse":"count","annotate":"count"}},"menuSections":{"main":["protection","amazon","tools"],"appearance":["appearance"],"advanced":["advanced","patterns","advanced-amazon"],"system":["system"]},"repository":"WARD","rootId":"exp-ward-root"},"prisma":{"role":"product","priority":1,"launcherPriority":40,"themePriority":2,"capabilities":["text.identity-detection","text.identity-highlighting","identity.catalog"],"presentationPhases":["annotate"],"state":{"type":"prisma.state-changed","fields":{"status":"token","total":"count","temporarilyHidden":"boolean"}},"menuSections":{"main":["page","highlights"],"appearance":["style","highlight-style","look","appearance"],"advanced":["tools","language","sites"],"system":["system"]},"repository":"PRISMA","rootId":"exp-prisma-root"}});
  const SUITE_PRIORITY = Object.freeze(Object.fromEntries(
    Object.entries(SUITE_PRODUCTS).map(([id, value]) => [id, value.priority])
  ));
  const LAUNCHER_PRIORITY = Object.freeze(Object.fromEntries(
    Object.entries(SUITE_PRODUCTS).map(([id, value]) => [id, value.launcherPriority])
  ));
  const THEME_PRIORITY = Object.freeze(Object.fromEntries(
    Object.entries(SUITE_PRODUCTS).map(([id, value]) => [id, value.themePriority])
  ));
  const SUITE_EVENT = 'exp-core:suite';
  // Suite events/state cross userscript realms through shared DOM metadata.
  // They are advisory coordination signals, never an authorization boundary.
  const SUITE_TRUST = 'shared-dom-advisory';
  const PAGE_BATCH_EVENT = 'exp-core:page-batch';
  const NAVIGATION_EVENT = 'exp-core:navigation';
  const NAVIGATION_CONTROL_EVENT = 'exp-core:navigation-control';
  const PAGE_PHASE_EVENT = 'exp-core:page-phase';
  const PAGE_PHASE_END_EVENT = 'exp-core:page-phase-end';
  const PRESENTATION_STATE_EVENT = 'exp-core:presentation-state';
  const PRESENTATION_PHASES = Object.freeze({
    observe: 10,
    classify: 20,
    visibility: 30,
    theme: 40,
    annotate: 50,
    ui: 60,
  });
  const PRESENTATION_CHANNELS = Object.freeze(['classification', 'visibility', 'surface', 'annotation']);
  const suiteStateFingerprints = new Map();
  const registrations = new WeakMap();
  const floatingNoticeRegistrations = new WeakMap();
  const controllers = new WeakMap();
  const baseTokenNames = ['bg', 'panel', 'line', 'text', 'muted', 'accent', 'accent2'];
  const tokenNames = [...baseTokenNames, 'raised', 'inset', 'link', 'focus', 'onAccent'];
  const hex = value => /^#[0-9a-f]{6}$/i.test(value || '') ? value : '#000000';
  const rgb = value => [1, 3, 5].map(index => parseInt(hex(value).slice(index, index + 2), 16));
  const blend = (from, to, amount) => '#' + rgb(from).map((part, index) => Math.round(part + (rgb(to)[index] - part) * amount).toString(16).padStart(2, '0')).join('');
  const luminance = value => {
    const parts = rgb(value).map(part => { const channel = part / 255; return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4; });
    return .2126 * parts[0] + .7152 * parts[1] + .0722 * parts[2];
  };
  const contrast = (one, two) => { const [light, dark] = [luminance(one), luminance(two)].sort((a, b) => b - a); return (light + .05) / (dark + .05); };
  function readable(candidate, background, fallback) {
    if (contrast(candidate, background) >= 4.5) return candidate;
    for (let amount = .15; amount <= 1; amount += .05) {
      const lighter = blend(candidate, '#ffffff', amount);
      if (contrast(lighter, background) >= 4.5) return lighter;
      const darker = blend(candidate, '#000000', amount);
      if (contrast(darker, background) >= 4.5) return darker;
    }
    return fallback;
  }
  function semanticTheme(theme = {}) {
    const panel = hex(theme.panel);
    const background = hex(theme.bg);
    const onAccent = [hex(theme.text), background, '#ffffff', '#000000'].sort((a, b) => contrast(b, theme.accent) - contrast(a, theme.accent))[0];
    return {
      ...theme,
      raised: hex(theme.raised) !== '#000000' || theme.raised === '#000000' ? theme.raised : blend(panel, theme.text, .08),
      inset: hex(theme.inset) !== '#000000' || theme.inset === '#000000' ? theme.inset : blend(background, '#000000', .18),
      link: theme.link && contrast(theme.link, panel) >= 4.5 ? theme.link : readable(theme.accent2, panel, theme.text),
      focus: theme.focus && contrast(theme.focus, panel) >= 3 ? theme.focus : readable(theme.accent2, panel, theme.text),
      onAccent: theme.onAccent && contrast(theme.onAccent, theme.accent) >= 4.5 ? theme.onAccent : onAccent,
    };
  }
  // Callers own foreground, accessibility fallbacks, and removing these inline properties.
  // Settings use the persisted JSON schema. Parse in the caller's userscript realm
  // instead of returning a native structuredClone page-realm Xray wrapper.
  function cloneSettings(value) { return JSON.parse(JSON.stringify(value)); }
  function applyTextGradient(element, backgroundImage) {
    const properties = {'background-color':'transparent','background-image':backgroundImage,'background-clip':'text','-webkit-background-clip':'text','background-size':'auto','background-position':'0% 0%','background-repeat':'repeat'};
    for (const [property,value] of Object.entries(properties)) element.style.setProperty(property,value,'important');
  }
  function replaceMenuContent(container, content) {
    const summary = node => node.querySelector(':scope > summary')?.textContent.trim();
    const expanded = new Set([...container.querySelectorAll('details[open]')].map(summary));
    container.replaceChildren(content);
    for (const node of container.querySelectorAll('details')) if (expanded.has(summary(node))) node.open = true;
  }
  function createDisclosure(label, ...contents) {
    return ExpMenuArrangement.createDisclosure({
      document,
      label,
      category: 'advanced',
      contents,
      className: 'exp-system-card',
    });
  }
  function createSystemGrid(...contents) {
    const grid = document.createElement('div'); grid.dataset.expSystemTools = '1';
    grid.append(...contents); return grid;
  }
  function menuWidthForMode(mode = 'compact', fullWidth = 312) {
    if (mode === 'narrow') return 220;
    if (mode === 'compact') return 260;
    const full = Number(fullWidth);
    return Number.isFinite(full) ? Math.max(280, Math.min(full, 340)) : 312;
  }
  const canonicalCss = CoreFoundation.css();
  const compositionCss = `
    [data-exp-part="dock"]{box-sizing:border-box;overflow-x:hidden;overscroll-behavior:contain}
    [data-exp-part="dock"] :is(.row,.group,.section,.fl-tool-body,.route-body,.fl-tool-title){min-width:0;max-width:100%;overflow-wrap:anywhere!important}
    [data-exp-part="dock"] :is(input,select,textarea){min-width:0;max-width:100%}
    .update-notice,.changelog{max-height:calc(100vh - 24px)!important;overflow-x:hidden!important;overflow-y:auto!important;overscroll-behavior:contain;overflow-wrap:anywhere}

    [data-exp-system-tools]{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:6px!important;align-items:stretch;grid-column:1/-1!important;min-width:0}
    [data-exp-system-tools]>details{box-sizing:border-box;min-width:0;margin:0!important;padding:7px!important;border:1px solid var(--theme-line);border-radius:7px;grid-column:auto!important;overflow-wrap:anywhere}
    [data-exp-system-tools]>details[open]{grid-column:1/-1!important}
    [data-exp-system-tools]>details>summary{cursor:pointer;font-weight:600}
    .exp-system-card>summary{cursor:pointer}
    .exp-system-card>summary+*{margin-top:6px}
    [data-exp-part="dock"] .row:has(>select[aria-label="Menu width"]){display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,104px)!important;align-items:center;gap:8px!important}
    [data-exp-part="dock"] .row>select[aria-label="Menu width"]{box-sizing:border-box;width:100%!important;max-width:104px!important;min-width:0!important;margin:0!important}
    :host{color-scheme:dark}
    [data-exp-part="launcher"]{box-sizing:border-box!important;width:48px!important;min-width:48px!important;max-width:48px!important;height:48px!important;min-height:48px!important;max-height:48px!important}
    [data-exp-part="launcher"] .launcher-icon{width:40px!important;height:40px!important}
    .header-icon{width:38px!important;height:38px!important}
    .header-icon .menu-icon{width:38px!important;height:38px!important}
    :host([data-exp-theme-deprioritized="1"]) .theme-row:has(.exp-theme-swatches),:host([data-exp-theme-deprioritized="1"]) #mb-theme-dots{display:none!important}
    :host([data-exp-theme-deprioritized="1"]) #mb-cluster{--mb-bg:var(--theme-bg)!important;--mb-surface:var(--theme-panel)!important;--mb-chip:var(--theme-raised)!important;--mb-ink:var(--theme-text)!important;--mb-muted:var(--theme-muted)!important;--mb-line:var(--theme-line)!important;--mb-brand:var(--theme-accent)!important;--mb-brand-ink:var(--theme-onAccent)!important;--mb-hover:var(--theme-raised)!important;--mb-track:var(--theme-line)!important}
    [hidden]{display:none!important}
    .exp-core-theme{position:static;display:contents;color:var(--theme-text);font:13px/1.42 ui-sans-serif,system-ui,"Segoe UI",sans-serif}
    [data-exp-part="dock"],[data-exp-part="launcher"]{position:fixed}
    [data-exp-part="dock"]{color:var(--theme-text);scrollbar-width:thin}
    [data-exp-part="dock"] [data-exp-part="title"]{color:var(--theme-text)}
    .exp-core-theme a{color:var(--theme-link)}
    button,input,select,textarea{font-family:inherit}
    button{color:inherit}
    button:disabled{opacity:.5;cursor:not-allowed}
    button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:2px solid var(--theme-focus);outline-offset:2px}
    button.fl-tool-header{width:100%;border:0;background:transparent;color:var(--theme-text);text-align:left;font:inherit}
    .fl-tool-header .fl-tool-chevron{font:11px/1.42 system-ui}
    .fl-tool-body[hidden]{display:none!important}
    .fl-tool-body>.group,.fl-tool-body>.section,.fl-tool-body>.flat-group{grid-column:1/-1;min-width:0}
    .fl-tool-body :is(.group,.section,.flat-group){display:grid!important;grid-template-columns:minmax(0,1fr)!important}
    .fl-tool-body :is(.group,.section,.flat-group)>*{grid-column:1/-1!important;min-width:0}
    .group,.section,.flat-group{margin:0;padding:0;border:0;background:transparent}
    .group>h3,.section>h3,.section>h2{margin:8px 0 3px;font-size:10px;font-weight:800;color:var(--theme-muted)}
    .group:first-child>h3,.section:first-child>h3{margin-top:6px}
    .group>.row,.section>.row,.flat-group>.row{min-width:0}
    .row>.copy,.row>.row-copy,.row>.setting-label,.row>div:first-child{min-width:0;flex:1}
    .label,.copy>strong,.row-copy>strong,.setting-label{font-size:11px;font-weight:500;line-height:1.25}
    .copy>.help,.row-copy>small,.help,.empty,.note,.meta{font-size:9px;line-height:1.4;color:var(--theme-muted)}
    .copy>.help,.row-copy>small{display:block;margin-top:3px}
    .toggleSwitch{padding:0;min-width:34px;max-width:34px;min-height:20px;max-height:20px}
    .toggleSwitch>span{display:none}
    .row>.life-btn,.mini-row>.life-btn{width:auto;min-width:50px;margin:0;padding:3px 7px}
    .row>select,.mini-row>select{max-width:55%}
    .button-grid,.actions,.profile-actions,.menu-footer,.diagnostics-controls>div,.rules-transfer{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;min-width:0}
    .button-grid>*{min-width:0}
    .life-btn.warn{border-color:#cb6868!important;background:#402020!important;color:#ffd7d7!important}
    input:not([type=file]),textarea{box-sizing:border-box;max-width:100%;min-width:0;border:1px solid var(--theme-line);border-radius:6px;background:var(--theme-inset);color:var(--theme-text);padding:5px 6px;font-size:11px}
    input[type=search],textarea{width:100%}
    .identity{display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid var(--theme-line)}
    .identity>.copy{flex:1;min-width:0}
    .identity-actions{display:flex;gap:6px;align-items:center}
    .identity-actions>.life-btn{width:auto;margin:0;padding:3px 6px}
    .theme-row{flex-wrap:wrap}
    .exp-theme-swatches{min-width:0}
    .appearance-group,.auth-advanced,.rule-card,.stat-card{grid-column:1/-1;min-width:0;border:1px solid var(--theme-line);border-radius:7px;margin-top:6px;padding:6px;background:var(--theme-inset)}
    summary{cursor:pointer;font-size:11px}
    .feature-pair,.category-grid{display:block}
    .status-value,output{font-size:10px;color:var(--theme-muted)}
    .live,.sr-only,.status{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
    .toast{position:fixed;z-index:2147483647;right:12px;max-width:calc(100vw - 24px)}
    .update-notice{position:fixed;z-index:2147483647}
    .diag{margin:6px 0 0}
    .diag[hidden]{display:none!important}
    .diag:not([hidden]){display:block}
    .utility-grid,.stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
    .workspace-actions{grid-column:1/-1}
    .setting-arrow,.step-btn{width:25px;min-height:25px;border:1px solid var(--theme-line);border-radius:6px;background:var(--theme-raised);color:var(--theme-text)}
    .step-value{flex:1;text-align:center;font-size:10px}
    .stepper{display:flex;align-items:center;gap:5px}
  `;
  const TOGGLE = ':is(.toggleSwitch,.switch,[role="switch"])';
  const TOGGLE_BG = 'var(--theme-bg,var(--bg,#111114))';
  const TOGGLE_PANEL = 'var(--theme-panel,var(--panel,var(--surface,#18181d)))';
  const TOGGLE_LINE = 'var(--theme-line,var(--line,var(--border,#41434d)))';
  const TOGGLE_MUTED = 'var(--theme-muted,var(--muted,#9aa0a6))';
  const TOGGLE_TEXT = 'var(--theme-text,var(--text,#f4f4f6))';
  const TOGGLE_ACCENT = 'var(--theme-accent,var(--accent,var(--teal,#8b5cf6)))';
  const MATTE_TOGGLE_CHROME_CSS = `${TOGGLE}{position:relative!important;box-sizing:border-box!important;flex:none!important;width:34px!important;height:20px!important;min-width:34px!important;min-height:20px!important;padding:0!important;border:1px solid color-mix(in srgb,${TOGGLE_LINE} 88%,${TOGGLE_MUTED} 12%)!important;border-radius:6px!important;background:color-mix(in srgb,${TOGGLE_BG} 84%,${TOGGLE_PANEL} 16%)!important;background-image:none!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.018)!important;cursor:pointer!important}${TOGGLE}:not(:has(> span))::after{content:""!important;position:absolute!important;top:2px!important;left:2px!important;width:14px!important;height:14px!important;box-sizing:border-box!important;border:0!important;border-radius:4px!important;background:color-mix(in srgb,${TOGGLE_MUTED} 82%,${TOGGLE_TEXT} 18%)!important;box-shadow:none!important}${TOGGLE}>span{display:block!important;position:absolute!important;top:2px!important;left:2px!important;width:14px!important;height:14px!important;box-sizing:border-box!important;border:0!important;border-radius:4px!important;background:color-mix(in srgb,${TOGGLE_MUTED} 82%,${TOGGLE_TEXT} 18%)!important;box-shadow:none!important}${TOGGLE}[aria-checked="true"]{border-color:color-mix(in srgb,${TOGGLE_LINE} 52%,${TOGGLE_ACCENT} 48%)!important;background:color-mix(in srgb,${TOGGLE_PANEL} 72%,${TOGGLE_ACCENT} 28%)!important;background-image:none!important}${TOGGLE}[aria-checked="true"]:not(:has(> span))::after{transform:translateX(14px)!important;background:${TOGGLE_TEXT}!important}${TOGGLE}[aria-checked="true"]>span{transform:translateX(14px)!important;background:${TOGGLE_TEXT}!important}:host([data-ui-theme="pride"]) ${TOGGLE}[aria-checked="true"],.exp-core-theme[data-ui-theme="pride"] ${TOGGLE}[aria-checked="true"],:host([data-theme-skin="gradient"]) ${TOGGLE}[aria-checked="true"],.exp-core-theme[data-theme-skin="gradient"]:not([data-ui-theme="contrast"]) ${TOGGLE}[aria-checked="true"]{background-image:none!important;border-color:color-mix(in srgb,${TOGGLE_LINE} 52%,${TOGGLE_ACCENT} 48%)!important;background:color-mix(in srgb,${TOGGLE_PANEL} 72%,${TOGGLE_ACCENT} 28%)!important}:host([data-ui-theme="contrast"]) ${TOGGLE},:host([data-ui-theme="obsidian"]) ${TOGGLE},.exp-core-theme[data-ui-theme="contrast"] ${TOGGLE},.exp-core-theme[data-ui-theme="obsidian"] ${TOGGLE}{border:2px solid #fff!important;background:#050505!important;background-image:none!important}:host([data-ui-theme="contrast"]) ${TOGGLE}:not(:has(> span))::after,:host([data-ui-theme="obsidian"]) ${TOGGLE}:not(:has(> span))::after,.exp-core-theme[data-ui-theme="contrast"] ${TOGGLE}:not(:has(> span))::after,.exp-core-theme[data-ui-theme="obsidian"] ${TOGGLE}:not(:has(> span))::after{top:0!important;left:0!important;border:1px solid #050505!important;background:#fff!important}:host([data-ui-theme="contrast"]) ${TOGGLE}>span,:host([data-ui-theme="obsidian"]) ${TOGGLE}>span,.exp-core-theme[data-ui-theme="contrast"] ${TOGGLE}>span,.exp-core-theme[data-ui-theme="obsidian"] ${TOGGLE}>span{top:0!important;left:0!important;border:1px solid #050505!important;background:#fff!important}:host([data-ui-theme="contrast"]) ${TOGGLE}[aria-checked="true"],:host([data-ui-theme="obsidian"]) ${TOGGLE}[aria-checked="true"],.exp-core-theme[data-ui-theme="contrast"] ${TOGGLE}[aria-checked="true"],.exp-core-theme[data-ui-theme="obsidian"] ${TOGGLE}[aria-checked="true"]{background:#fff!important;border-color:#fff!important;background-image:none!important}:host([data-ui-theme="contrast"]) ${TOGGLE}[aria-checked="true"]:not(:has(> span))::after,:host([data-ui-theme="obsidian"]) ${TOGGLE}[aria-checked="true"]:not(:has(> span))::after,.exp-core-theme[data-ui-theme="contrast"] ${TOGGLE}[aria-checked="true"]:not(:has(> span))::after,.exp-core-theme[data-ui-theme="obsidian"] ${TOGGLE}[aria-checked="true"]:not(:has(> span))::after{background:#050505!important;border-color:#fff!important;transform:translateX(14px)!important}:host([data-ui-theme="contrast"]) ${TOGGLE}[aria-checked="true"]>span,:host([data-ui-theme="obsidian"]) ${TOGGLE}[aria-checked="true"]>span,.exp-core-theme[data-ui-theme="contrast"] ${TOGGLE}[aria-checked="true"]>span,.exp-core-theme[data-ui-theme="obsidian"] ${TOGGLE}[aria-checked="true"]>span{background:#050505!important;border-color:#fff!important;transform:translateX(14px)!important}@media (forced-colors: active){${TOGGLE}{forced-color-adjust:none;border:1px solid CanvasText!important;background:Canvas!important;background-image:none!important}${TOGGLE}:not(:has(> span))::after{border-color:CanvasText!important;background:CanvasText!important}${TOGGLE}>span{border-color:CanvasText!important;background:CanvasText!important}${TOGGLE}[aria-checked="true"]{border-color:Highlight!important;background:Highlight!important;background-image:none!important}${TOGGLE}[aria-checked="true"]:not(:has(> span))::after{border-color:HighlightText!important;background:HighlightText!important}${TOGGLE}[aria-checked="true"]>span{border-color:HighlightText!important;background:HighlightText!important}}`;
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const emit = (type, productId) => document.dispatchEvent(new CustomEvent('exp-core:coordination', { detail: { protocol, type, productId } }));

  function normalizeSuiteCapabilities(values = []) {
    if (!Array.isArray(values)) return [];
    return [...new Set(values.map(value => String(value || '').trim().toLowerCase()).filter(value => /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/.test(value)))];
  }

  function suiteContract(productId) {
    const id = String(productId || '').toLowerCase();
    const known = SUITE_PRODUCTS[id];
    if (!known) return null;
    return Object.freeze({
      id,
      role: known.role || 'product',
      repository: known.repository || '',
      rootId: known.rootId || '',
      priority: Number(known.priority || SUITE_PRIORITY[id] || 0),
      launcherPriority: Number(known.launcherPriority || LAUNCHER_PRIORITY[id] || 0),
      themePriority: Number(known.themePriority || THEME_PRIORITY[id] || 0),
      capabilities: Object.freeze(normalizeSuiteCapabilities(known.capabilities)),
      presentationPhases: Object.freeze(normalizePresentationPhases(known.presentationPhases || [])),
      menuSections: Object.freeze(Object.fromEntries(
        Object.entries(known.menuSections || {}).map(([category, sections]) => [category, Object.freeze([...sections])])
      )),
      state: known.state ? Object.freeze({
        type: known.state.type,
        fields: Object.freeze({ ...known.state.fields }),
      }) : null,
    });
  }

  function suiteProductNode(productId) {
    const id = String(productId || '').toLowerCase();
    if (!/^[a-z][a-z0-9-]+$/.test(id)) return null;
    return [...document.querySelectorAll('[data-exp-suite-product]')]
      .find(node => node.dataset.expSuiteProduct === id) || null;
  }

  function registerSuiteProduct(options = {}) {
    const id = String(options.id || options.productId || '').toLowerCase();
    const productVersion = String(options.version || options.productVersion || 'unknown');
    if (!/^[a-z][a-z0-9-]+$/.test(id)) throw new Error('Invalid suite product ID');
    const contract = suiteContract(id);
    const capabilities = normalizeSuiteCapabilities(contract ? contract.capabilities : options.capabilities);
    const priority = Number(contract?.priority ?? options.priority ?? 0);
    const role = String(contract?.role ?? options.role ?? 'product');
    let node = suiteProductNode(id);
    const previous = node ? JSON.stringify({
      version: node.dataset.expSuiteVersion || '',
      coreVersion: node.dataset.expSuiteCoreVersion || '',
      role: node.dataset.expSuiteRole || '',
      priority: node.dataset.expSuitePriority || '',
      capabilities: node.dataset.expSuiteCapabilities || '[]',
    }) : null;
    if (!node) {
      node = document.createElement('meta');
      node.dataset.expSuiteProduct = id;
      (document.documentElement || document.head || document.body)?.append(node);
    }
    node.dataset.expSuiteVersion = productVersion;
    node.dataset.expSuiteCoreVersion = version;
    node.dataset.expSuiteRole = role;
    node.dataset.expSuitePriority = String(Number.isFinite(priority) ? priority : 0);
    node.dataset.expSuiteCapabilities = JSON.stringify(capabilities);
    const current = JSON.stringify({
      version: node.dataset.expSuiteVersion,
      coreVersion: node.dataset.expSuiteCoreVersion,
      role: node.dataset.expSuiteRole,
      priority: node.dataset.expSuitePriority,
      capabilities: node.dataset.expSuiteCapabilities,
    });
    if (previous !== current) emitSuiteEvent(id, 'product.registered', { capabilities, role, version: productVersion });
    return Object.freeze({
      id,
      update(next = {}) { return registerSuiteProduct({ id, version: productVersion, role, priority, capabilities, ...next }); },
      dispose() {
        const current = suiteProductNode(id);
        if (current === node) current.remove();
        emitSuiteEvent(id, 'product.unregistered', {});
      },
    });
  }

  function suiteSnapshot() {
    const products = [...document.querySelectorAll('[data-exp-suite-product]')].map(node => {
      let capabilities = [];
      try { capabilities = normalizeSuiteCapabilities(JSON.parse(node.dataset.expSuiteCapabilities || '[]')); } catch {}
      return Object.freeze({
        id: node.dataset.expSuiteProduct,
        version: node.dataset.expSuiteVersion || 'unknown',
        coreVersion: node.dataset.expSuiteCoreVersion || 'unknown',
        role: node.dataset.expSuiteRole || 'product',
        priority: Number(node.dataset.expSuitePriority || 0),
        capabilities: Object.freeze(capabilities),
      });
    }).filter(product => product.id)
      .sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));
    return Object.freeze({
      protocol: 'exp-suite-interoperability-v1',
      coreVersion: version,
      trust: SUITE_TRUST,
      products: Object.freeze(products),
    });
  }

  function capabilityProviders(capability) {
    const name = String(capability || '').trim().toLowerCase();
    return Object.freeze(suiteSnapshot().products.filter(product => product.capabilities.includes(name)));
  }

  function hasProductCapability(capability) {
    return capabilityProviders(capability).length > 0;
  }

  function pageContext() {
    return Object.freeze({
      href: location.href,
      origin: location.origin,
      hostname: location.hostname,
      pathname: location.pathname,
      topLevel: window.top === window.self,
    });
  }

  function navigationObserverMarker() {
    return document.querySelector('meta[data-exp-navigation-observer]');
  }

  function ensureSharedNavigationObserver(owner = 'core') {
    let marker = navigationObserverMarker();
    if (marker) return Object.freeze({ leader: false, owner: marker.dataset.expNavigationObserver || 'unknown' });
    marker = document.createElement('meta');
    marker.dataset.expOwned = '1';
    marker.dataset.expNavigationObserver = String(owner || 'core').toLowerCase();
    marker.dataset.expNavigationProtocol = 'exp-navigation-observer-v1';
    marker.dataset.expNavigationEpoch = '0';
    marker.dataset.expNavigationSubscribers = '0';
    (document.head || document.documentElement || document.body)?.append(marker);

    let previous = location.href;
    let epoch = 0;
    let pendingHistoryKind = '';
    let disposed = false;
    const publish = kind => {
      if (disposed) return false;
      const href = location.href;
      if (href === previous) return false;
      previous = href;
      epoch += 1;
      marker.dataset.expNavigationEpoch = String(epoch);
      const payload = JSON.stringify({
        protocol: 'exp-navigation-observer-v1',
        owner: marker.dataset.expNavigationObserver,
        epoch,
        kind: String(kind || 'navigation'),
        href,
        at: Date.now(),
      });
      document.dispatchEvent(new CustomEvent(NAVIGATION_EVENT, { detail: payload }));
      return true;
    };
    const originals = {};
    const wrappers = {};
    for (const name of ['pushState', 'replaceState']) {
      const original = history[name];
      originals[name] = original;
      const wrapped = function (...args) {
        const priorKind = pendingHistoryKind;
        pendingHistoryKind = name;
        try {
          const result = Reflect.apply(original, this, args);
          publish(name);
          return result;
        } finally {
          pendingHistoryKind = priorKind;
        }
      };
      wrappers[name] = wrapped;
      history[name] = wrapped;
    }
    const onPopState = () => publish('popstate');
    const onHashChange = () => publish('hashchange');
    const onCurrentEntryChange = () => publish(pendingHistoryKind || 'currententrychange');
    addEventListener('popstate', onPopState);
    addEventListener('hashchange', onHashChange);
    globalThis.navigation?.addEventListener('currententrychange', onCurrentEntryChange);
    const teardown = () => {
      if (disposed || Number(marker.dataset.expNavigationSubscribers || 0) > 0) return false;
      disposed = true;
      for (const name of Object.keys(wrappers)) if (history[name] === wrappers[name]) history[name] = originals[name];
      removeEventListener('popstate', onPopState);
      removeEventListener('hashchange', onHashChange);
      globalThis.navigation?.removeEventListener('currententrychange', onCurrentEntryChange);
      document.removeEventListener(NAVIGATION_CONTROL_EVENT, onControl);
      if (marker.isConnected) marker.remove();
      return true;
    };
    const onControl = event => {
      let payload;
      try { payload = typeof event.detail === 'string' ? JSON.parse(event.detail) : event.detail; } catch { return; }
      if (!payload || payload.protocol !== 'exp-navigation-observer-v1' || payload.type !== 'release-if-idle') return;
      teardown();
    };
    document.addEventListener(NAVIGATION_CONTROL_EVENT, onControl);
    return Object.freeze({ leader: true, owner: marker.dataset.expNavigationObserver });
  }

  function observeNavigation(callback, options = {}) {
    if (typeof callback !== 'function') throw new TypeError('Navigation callback must be a function');
    ensureSharedNavigationObserver(options.productId || options.owner || 'core');
    let marker = navigationObserverMarker();
    if (marker) marker.dataset.expNavigationSubscribers = String(Number(marker.dataset.expNavigationSubscribers || 0) + 1);
    const listener = event => {
      let payload;
      try { payload = typeof event.detail === 'string' ? JSON.parse(event.detail) : event.detail; } catch { return; }
      if (!payload || payload.protocol !== 'exp-navigation-observer-v1') return;
      callback(Object.freeze({ ...payload }));
    };
    document.addEventListener(NAVIGATION_EVENT, listener);
    let disposed = false;
    return () => {
      if (disposed) return;
      disposed = true;
      document.removeEventListener(NAVIGATION_EVENT, listener);
      marker = navigationObserverMarker();
      if (!marker) return;
      const next = Math.max(0, Number(marker.dataset.expNavigationSubscribers || 0) - 1);
      marker.dataset.expNavigationSubscribers = String(next);
      if (!next) document.dispatchEvent(new CustomEvent(NAVIGATION_CONTROL_EVENT, {
        detail: JSON.stringify({ protocol: 'exp-navigation-observer-v1', type: 'release-if-idle' }),
      }));
    };
  }

  function navigationObserverState() {
    const marker = navigationObserverMarker();
    return Object.freeze({
      active: Boolean(marker),
      owner: marker?.dataset.expNavigationObserver || null,
      protocol: marker?.dataset.expNavigationProtocol || null,
      epoch: Number(marker?.dataset.expNavigationEpoch || 0),
      subscribers: Number(marker?.dataset.expNavigationSubscribers || 0),
    });
  }

  function emitSuiteEvent(productId, type, detail = {}) {
    const source = String(productId || 'core').toLowerCase();
    const eventType = String(type || '').trim().toLowerCase();
    if (!/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/.test(eventType)) throw new Error('Invalid suite event type');
    let safeDetail = {};
    try { safeDetail = JSON.parse(JSON.stringify(detail || {})); } catch {}
    const payload = JSON.stringify({
      protocol: 'exp-suite-interoperability-v1',
      coreVersion: version,
      trust: SUITE_TRUST,
      source,
      type: eventType,
      detail: safeDetail,
      at: Date.now(),
    });
    document.dispatchEvent(new CustomEvent(SUITE_EVENT, { detail: payload }));
  }

  function stableSuiteValue(value) {
    if (Array.isArray(value)) return value.map(stableSuiteValue);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableSuiteValue(value[key])]));
  }

  function normalizeSuiteStateForContract(productId, type, state = {}) {
    const source = String(productId || '').toLowerCase();
    const eventType = String(type || '').trim().toLowerCase();
    const contract = suiteContract(source);
    const schema = contract?.state;
    const input = state && typeof state === 'object' && !Array.isArray(state) ? state : {};
    if (!schema || schema.type !== eventType) return stableSuiteValue(input);
    const keys = Object.keys(input);
    const expected = Object.keys(schema.fields);
    const unknown = keys.filter(key => !Object.hasOwn(schema.fields, key));
    if (unknown.length) throw new Error(`Unknown suite state field: ${unknown[0]}`);
    const missing = expected.filter(key => !Object.hasOwn(input, key));
    if (missing.length) throw new Error(`Missing suite state field: ${missing[0]}`);
    const output = {};
    for (const [key, kind] of Object.entries(schema.fields)) {
      const value = input[key];
      if (kind === 'boolean') {
        if (typeof value !== 'boolean') throw new Error(`Invalid boolean suite state field: ${key}`);
        output[key] = value;
      } else if (kind === 'token') {
        const token = String(value ?? '').trim().toLowerCase();
        if (!/^[a-z0-9][a-z0-9._:-]{0,79}$/.test(token)) throw new Error(`Invalid token suite state field: ${key}`);
        output[key] = token;
      } else if (kind === 'count') {
        const count = Number(value);
        if (!Number.isSafeInteger(count) || count < 0) throw new Error(`Invalid count suite state field: ${key}`);
        output[key] = count;
      } else if (kind === 'percent-nullable') {
        if (value === null) output[key] = null;
        else {
          const percent = Number(value);
          if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw new Error(`Invalid percent suite state field: ${key}`);
          output[key] = percent;
        }
      } else {
        throw new Error(`Unsupported suite state schema kind: ${kind}`);
      }
    }
    return stableSuiteValue(output);
  }

  function suiteStateNode(productId, type) {
    const source = String(productId || '').toLowerCase();
    const eventType = String(type || '').trim().toLowerCase();
    return [...document.querySelectorAll('meta[data-exp-suite-state-product][data-exp-suite-state-type]')]
      .find(node => node.dataset.expSuiteStateProduct === source && node.dataset.expSuiteStateType === eventType) || null;
  }

  function readSuiteStateNode(node) {
    if (!(node instanceof Element)) return null;
    let state = {};
    try { state = JSON.parse(node.dataset.expSuiteStatePayload || '{}'); } catch {}
    return Object.freeze({
      productId: node.dataset.expSuiteStateProduct || '',
      type: node.dataset.expSuiteStateType || '',
      coreVersion: node.dataset.expSuiteStateCoreVersion || 'unknown',
      trust: node.dataset.expSuiteStateTrust || SUITE_TRUST,
      at: Number(node.dataset.expSuiteStateAt || 0),
      state: Object.freeze(stableSuiteValue(state && typeof state === 'object' ? state : {})),
    });
  }

  function suiteStateSnapshot(productId = '') {
    const source = String(productId || '').toLowerCase();
    return Object.freeze(
      [...document.querySelectorAll('meta[data-exp-suite-state-product][data-exp-suite-state-type]')]
        .filter(node => !source || node.dataset.expSuiteStateProduct === source)
        .map(readSuiteStateNode)
        .filter(Boolean)
        .sort((left, right) => left.productId.localeCompare(right.productId) || left.type.localeCompare(right.type))
    );
  }

  function latestSuiteState(productId, type = '') {
    const source = String(productId || '').toLowerCase();
    const eventType = String(type || '').trim().toLowerCase();
    const states = suiteStateSnapshot(source).filter(entry => !eventType || entry.type === eventType);
    return states.sort((left, right) => right.at - left.at)[0] || null;
  }

  function publishSuiteState(productId, type, state = {}) {
    const source = String(productId || '').toLowerCase();
    const eventType = String(type || '').trim().toLowerCase();
    if (!/^[a-z][a-z0-9-]+$/.test(source)) throw new Error('Invalid suite state product ID');
    if (!/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/.test(eventType)) throw new Error('Invalid suite state event type');
    let safeState = {};
    try {
      safeState = normalizeSuiteStateForContract(source, eventType, JSON.parse(JSON.stringify(state || {})));
    } catch (error) {
      throw error;
    }
    const serialized = JSON.stringify(safeState);
    if (serialized.length > 4096) throw new Error('Suite state payload exceeds 4096 bytes');
    const key = `${source}:${eventType}`;
    let node = suiteStateNode(source, eventType);
    const sharedFingerprint = node?.dataset.expSuiteStatePayload || '';
    if (sharedFingerprint === serialized || suiteStateFingerprints.get(key) === serialized) return false;
    suiteStateFingerprints.set(key, serialized);
    if (!node) {
      node = document.createElement('meta');
      node.dataset.expOwned = '1';
      node.dataset.expSuiteStateProduct = source;
      node.dataset.expSuiteStateType = eventType;
      (document.head || document.documentElement || document.body)?.append(node);
    }
    node.dataset.expSuiteStatePayload = serialized;
    node.dataset.expSuiteStateCoreVersion = version;
    node.dataset.expSuiteStateTrust = SUITE_TRUST;
    node.dataset.expSuiteStateAt = String(Date.now());
    emitSuiteEvent(source, eventType, safeState);
    return true;
  }

  function onSuiteEvent(callback, options = {}) {
    if (typeof callback !== 'function') throw new TypeError('Suite event callback must be a function');
    const expectedType = options.type ? String(options.type).toLowerCase() : null;
    const listener = event => {
      let payload;
      try { payload = typeof event.detail === 'string' ? JSON.parse(event.detail) : event.detail; } catch { return; }
      if (!payload || payload.protocol !== 'exp-suite-interoperability-v1') return;
      if (expectedType && payload.type !== expectedType) return;
      callback(payload);
    };
    document.addEventListener(SUITE_EVENT, listener);
    return () => document.removeEventListener(SUITE_EVENT, listener);
  }

  function subscribeSuiteState(productId, callback, options = {}) {
    if (typeof callback !== 'function') throw new TypeError('Suite state callback must be a function');
    const source = String(productId || '').toLowerCase();
    if (!/^[a-z][a-z0-9-]+$/.test(source)) throw new Error('Invalid suite state product ID');
    const contractType = suiteContract(source)?.state?.type || '';
    const eventType = String(options.type || contractType).trim().toLowerCase();
    if (eventType && !/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/.test(eventType)) throw new Error('Invalid suite state event type');
    let disposed = false;
    const deliver = entry => {
      if (disposed || !entry) return;
      callback(Object.freeze({ ...entry, state: Object.freeze(stableSuiteValue(entry.state || {})) }));
    };
    if (options.immediate !== false) deliver(latestSuiteState(source, eventType));
    const stop = onSuiteEvent(event => {
      if (event.source !== source) return;
      if (eventType && event.type !== eventType) return;
      deliver(latestSuiteState(source, eventType));
    }, eventType ? { type: eventType } : {});
    return () => {
      if (disposed) return;
      disposed = true;
      stop();
    };
  }

  function normalizePresentationPhases(values = []) {
    const list = Array.isArray(values) ? values : [values];
    return [...new Set(list.map(value => String(value || '').trim().toLowerCase()).filter(value => PRESENTATION_PHASES[value]))]
      .sort((left, right) => PRESENTATION_PHASES[left] - PRESENTATION_PHASES[right]);
  }

  function presentationProviderNode(productId) {
    const id = String(productId || '').toLowerCase();
    if (!/^[a-z][a-z0-9-]+$/.test(id)) return null;
    return [...document.querySelectorAll('[data-exp-presentation-provider]')]
      .find(node => node.dataset.expPresentationProvider === id) || null;
  }

  function registerPresentationProvider(options = {}) {
    const id = String(options.id || options.productId || '').toLowerCase();
    if (!/^[a-z][a-z0-9-]+$/.test(id)) throw new Error('Invalid presentation product ID');
    const contract = suiteContract(id);
    if (contract && !contract.presentationPhases.length) throw new Error('Presentation provider is not declared for this suite product');
    const phases = normalizePresentationPhases(contract ? contract.presentationPhases : options.phases || options.phase);
    if (!phases.length) throw new Error('Presentation provider requires at least one valid phase');
    let node = presentationProviderNode(id);
    const previous = node ? JSON.stringify({
      phases: node.dataset.expPresentationPhases || '[]',
      priority: node.dataset.expPresentationPriority || '',
    }) : null;
    if (!node) {
      node = document.createElement('meta');
      node.dataset.expPresentationProvider = id;
      (document.documentElement || document.head || document.body)?.append(node);
    }
    node.dataset.expPresentationPhases = JSON.stringify(phases);
    node.dataset.expPresentationPriority = String(Number(contract?.priority ?? options.priority ?? 0) || 0);
    const current = JSON.stringify({
      phases: node.dataset.expPresentationPhases,
      priority: node.dataset.expPresentationPriority,
    });
    if (previous !== current) emitSuiteEvent(id, 'presentation.provider-registered', { phases });
    return Object.freeze({
      id,
      phases: Object.freeze([...phases]),
      dispose() {
        const current = presentationProviderNode(id);
        if (current === node) current.remove();
        emitSuiteEvent(id, 'presentation.provider-unregistered', {});
      },
    });
  }

  function presentationProviders() {
    return Object.freeze([...document.querySelectorAll('[data-exp-presentation-provider]')].map(node => {
      let phases = [];
      try { phases = normalizePresentationPhases(JSON.parse(node.dataset.expPresentationPhases || '[]')); } catch {}
      return Object.freeze({
        id: node.dataset.expPresentationProvider,
        phases: Object.freeze(phases),
        priority: Number(node.dataset.expPresentationPriority || 0),
      });
    }).filter(provider => provider.id)
      .sort((left, right) => {
        const leftPhase = Math.min(...left.phases.map(phase => PRESENTATION_PHASES[phase]));
        const rightPhase = Math.min(...right.phases.map(phase => PRESENTATION_PHASES[phase]));
        return leftPhase - rightPhase || right.priority - left.priority || left.id.localeCompare(right.id);
      }));
  }

  function suiteHealth() {
    const suite = suiteSnapshot();
    const providers = presentationProviders();
    const providerMap = new Map(providers.map(provider => [provider.id, provider]));
    const conflicts = [];
    const sameList = (left = [], right = []) => left.length === right.length && left.every((value, index) => value === right[index]);
    const products = suite.products.map(product => {
      const contract = suiteContract(product.id);
      if (!contract) {
        conflicts.push({ type: 'unknown-suite-product', products: [product.id] });
        return Object.freeze({ id: product.id, status: 'unknown-product' });
      }
      const expectedCapabilities = [...contract.capabilities].sort();
      const actualCapabilities = [...product.capabilities].sort();
      const provider = providerMap.get(product.id) || null;
      const expectedPhases = [...contract.presentationPhases];
      const actualPhases = provider ? [...provider.phases] : [];
      if (product.role !== contract.role) conflicts.push({ type: 'suite-role-mismatch', products: [product.id], expected: contract.role, actual: product.role });
      if (product.priority !== contract.priority) conflicts.push({ type: 'suite-priority-mismatch', products: [product.id], expected: contract.priority, actual: product.priority });
      if (!sameList(actualCapabilities, expectedCapabilities)) conflicts.push({ type: 'suite-capability-mismatch', products: [product.id], expected: expectedCapabilities, actual: actualCapabilities });
      if (expectedPhases.length && !provider) conflicts.push({ type: 'missing-presentation-provider', products: [product.id], expected: expectedPhases });
      if (!expectedPhases.length && provider) conflicts.push({ type: 'unexpected-presentation-provider', products: [product.id], actual: actualPhases });
      if (provider && !sameList(actualPhases, expectedPhases)) conflicts.push({ type: 'presentation-phase-mismatch', products: [product.id], expected: expectedPhases, actual: actualPhases });
      const latestState = latestSuiteState(product.id);
      return Object.freeze({
        id: product.id,
        status: conflicts.some(conflict => conflict.products?.includes(product.id)) ? 'conflict' : 'healthy',
        coreVersion: product.coreVersion,
        capabilities: Object.freeze(actualCapabilities),
        presentationPhases: Object.freeze(actualPhases),
        stateType: latestState?.type || null,
        stateAt: latestState?.at || 0,
        stateAgeMs: latestState?.at ? Math.max(0, Date.now() - latestState.at) : null,
        state: latestState?.state || null,
      });
    });
    const coreVersions = [...new Set(
      [...document.querySelectorAll('meta[data-exp-diagnostics-product]')]
        .map(node => node.dataset.expCoreVersion)
        .filter(Boolean)
    )].sort();
    if (coreVersions.length > 1) conflicts.push({ type: 'mixed-core-versions', coreVersions });
    const observerCount = document.querySelectorAll('meta[data-exp-page-observer]').length;
    if (observerCount > 1) conflicts.push({ type: 'duplicate-page-observer', instances: observerCount });
    return Object.freeze({
      status: conflicts.length ? 'conflicts-detected' : 'healthy',
      coreVersions: Object.freeze(coreVersions),
      observerCount,
      products: Object.freeze(products),
      conflicts: Object.freeze(conflicts.map(conflict => Object.freeze({ ...conflict }))),
    });
  }

  function readPresentationState(target) {
    if (!(target instanceof Element)) return Object.freeze({});
    try {
      const value = JSON.parse(target.getAttribute('data-exp-presentation-state') || '{}');
      if (!value || typeof value !== 'object' || Array.isArray(value)) return Object.freeze({});
      return Object.freeze(Object.fromEntries(Object.entries(value).map(([productId, state]) => [
        productId,
        Object.freeze({ ...(state && typeof state === 'object' && !Array.isArray(state) ? state : {}) }),
      ])));
    } catch {
      return Object.freeze({});
    }
  }

  function setPresentationState(target, productId, patch = {}) {
    if (!(target instanceof Element)) throw new TypeError('Presentation target must be an Element');
    const id = String(productId || '').toLowerCase();
    if (!/^[a-z][a-z0-9-]+$/.test(id)) throw new Error('Invalid presentation product ID');
    const previous = target.getAttribute('data-exp-presentation-state') || '';
    const current = JSON.parse(JSON.stringify(readPresentationState(target)));
    const next = { ...(current[id] || {}) };
    for (const [channel, raw] of Object.entries(patch || {})) {
      if (!PRESENTATION_CHANNELS.includes(channel)) continue;
      if (raw === null || raw === undefined || raw === '') delete next[channel];
      else {
        const value = String(raw).trim().toLowerCase();
        if (!/^[a-z0-9][a-z0-9._:-]{0,79}$/.test(value)) throw new Error('Invalid presentation state value');
        next[channel] = value;
      }
    }
    if (Object.keys(next).length) current[id] = next;
    else delete current[id];
    const serialized = Object.keys(current).length ? JSON.stringify(current) : '';
    if (serialized === previous) return readPresentationState(target);
    if (serialized) target.setAttribute('data-exp-presentation-state', serialized);
    else target.removeAttribute('data-exp-presentation-state');
    const phase = pageObserverMarker()?.dataset.expPageObserverPhase || null;
    const detail = JSON.stringify({
      protocol: 'exp-presentation-state-v1',
      source: id,
      channels: Object.keys(next),
      phase,
      at: Date.now(),
    });
    target.dispatchEvent(new CustomEvent(PRESENTATION_STATE_EVENT, {
      bubbles: true,
      composed: true,
      detail,
    }));
    emitSuiteEvent(id, 'presentation.state-changed', { channels: Object.keys(next), phase });
    return readPresentationState(target);
  }

  function clearPresentationState(target, productId) {
    return setPresentationState(target, productId, Object.fromEntries(PRESENTATION_CHANNELS.map(channel => [channel, null])));
  }

  function presentationStateChain(target) {
    const chain = [];
    let node = target instanceof Element ? target : target?.parentElement;
    while (node instanceof Element) {
      const state = readPresentationState(node);
      if (Object.keys(state).length) chain.push(Object.freeze({ node, state }));
      node = node.parentElement;
    }
    return Object.freeze(chain);
  }

  function isPresentationSuppressed(target) {
    for (const entry of presentationStateChain(target)) {
      for (const state of Object.values(entry.state)) {
        if (state?.visibility === 'hide' || state?.visibility === 'collapse') return true;
      }
    }
    return false;
  }

  function pageObserverMarker() {
    return document.querySelector('meta[data-exp-page-observer]');
  }

  function ensureSharedPageObserver(owner = 'core', options = {}) {
    let marker = pageObserverMarker();
    if (marker) return Object.freeze({ leader: false, owner: marker.dataset.expPageObserver || 'unknown' });
    marker = document.createElement('meta');
    marker.dataset.expPageObserver = String(owner || 'core').toLowerCase();
    marker.dataset.expPageObserverProtocol = 'exp-page-observer-v1';
    marker.dataset.expPageObserverEpoch = '0';
    (document.documentElement || document.head || document.body)?.append(marker);

    const delay = Math.max(16, Math.min(500, Number(options.delayMs || 60) || 60));
    let timer = 0;
    let epoch = 0;
    const pending = new Map();
    const queue = (target, record) => {
      if (!(target instanceof Element)) return;
      if (target.closest?.('[data-exp-owned="1"]')) return;
      const state = pending.get(target) || { types: new Set(), added: 0, removed: 0 };
      state.types.add(record.type);
      state.added += record.addedNodes?.length || 0;
      state.removed += record.removedNodes?.length || 0;
      pending.set(target, state);
    };
    const flush = () => {
      timer = 0;
      const entries = [...pending.entries()].filter(([target]) => target.isConnected);
      pending.clear();
      if (!entries.length) return;
      epoch += 1;
      marker.dataset.expPageObserverEpoch = String(epoch);
      const payloads = entries.map(([target, state], index) => [target, JSON.stringify({
        protocol: 'exp-page-observer-v1',
        owner: marker.dataset.expPageObserver,
        epoch,
        rootIndex: index,
        rootCount: entries.length,
        types: [...state.types].sort(),
        added: state.added,
        removed: state.removed,
        href: location.href,
        at: Date.now(),
      })]);
      payloads.forEach(([target, payload]) => {
        target.dispatchEvent(new CustomEvent(PAGE_BATCH_EVENT, { bubbles: true, composed: true, detail: payload }));
      });
      for (const phase of Object.keys(PRESENTATION_PHASES).sort((left, right) => PRESENTATION_PHASES[left] - PRESENTATION_PHASES[right])) {
        marker.dataset.expPageObserverPhase = phase;
        for (const [target, payload] of payloads) {
          target.dispatchEvent(new CustomEvent(`${PAGE_PHASE_EVENT}:${phase}`, { bubbles: true, composed: true, detail: payload }));
        }
        document.dispatchEvent(new CustomEvent(`${PAGE_PHASE_END_EVENT}:${phase}`, {
          detail: JSON.stringify({
            protocol: 'exp-page-observer-v1',
            owner: marker.dataset.expPageObserver,
            epoch,
            phase,
            rootCount: entries.length,
            href: location.href,
            at: Date.now(),
          }),
        }));
        delete marker.dataset.expPageObserverPhase;
      }
    };
    const observer = new MutationObserver(records => {
      for (const record of records) {
        const target = record.target?.nodeType === Node.TEXT_NODE ? record.target.parentElement : record.target;
        queue(target, record);
      }
      if (!timer && pending.size) timer = setTimeout(flush, delay);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    return Object.freeze({ leader: true, owner: marker.dataset.expPageObserver });
  }

  function observePage(callback, options = {}) {
    if (typeof callback !== 'function') throw new TypeError('Page observer callback must be a function');
    ensureSharedPageObserver(options.productId || options.owner || 'core', options);
    const listener = event => {
      let payload;
      try { payload = typeof event.detail === 'string' ? JSON.parse(event.detail) : event.detail; } catch { return; }
      if (!payload || payload.protocol !== 'exp-page-observer-v1') return;
      callback(payload, event.target instanceof Element ? event.target : document.documentElement);
    };
    document.addEventListener(PAGE_BATCH_EVENT, listener);
    return () => document.removeEventListener(PAGE_BATCH_EVENT, listener);
  }

  function observePageBatch(callback, options = {}) {
    if (typeof callback !== 'function') throw new TypeError('Page batch callback must be a function');
    const productId = String(options.productId || options.owner || 'core').toLowerCase();
    const contract = suiteContract(productId);
    const requested = options.phase || contract?.presentationPhases?.[0] || 'observe';
    const phase = normalizePresentationPhases([requested])[0] || 'observe';
    ensureSharedPageObserver(productId, options);
    const roots = new Map();
    const rootEvent = `${PAGE_PHASE_EVENT}:${phase}`;
    const endEvent = `${PAGE_PHASE_END_EVENT}:${phase}`;
    const onRoot = event => {
      let payload;
      try { payload = typeof event.detail === 'string' ? JSON.parse(event.detail) : event.detail; } catch { return; }
      if (!payload || payload.protocol !== 'exp-page-observer-v1') return;
      const root = event.target instanceof Element ? event.target : null;
      if (root) roots.set(root, payload);
    };
    const onEnd = event => {
      let payload;
      try { payload = typeof event.detail === 'string' ? JSON.parse(event.detail) : event.detail; } catch { return; }
      if (!payload || payload.protocol !== 'exp-page-observer-v1' || payload.phase !== phase) return;
      const entries = [...roots.entries()];
      roots.clear();
      callback(
        Object.freeze({ ...payload }),
        Object.freeze(entries.map(([root]) => root)),
        Object.freeze(entries.map(([, detail]) => Object.freeze({ ...detail }))),
      );
    };
    document.addEventListener(rootEvent, onRoot);
    document.addEventListener(endEvent, onEnd);
    return () => {
      document.removeEventListener(rootEvent, onRoot);
      document.removeEventListener(endEvent, onEnd);
      roots.clear();
    };
  }

  function observePresentationState(callback, options = {}) {
    if (typeof callback !== 'function') throw new TypeError('Presentation state callback must be a function');
    const source = options.source ? String(options.source).toLowerCase() : '';
    const channel = options.channel ? String(options.channel).toLowerCase() : '';
    const listener = event => {
      let payload;
      try { payload = typeof event.detail === 'string' ? JSON.parse(event.detail) : event.detail; } catch { return; }
      if (!payload || payload.protocol !== 'exp-presentation-state-v1') return;
      if (source && payload.source !== source) return;
      if (channel && !payload.channels?.includes(channel)) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target) callback(Object.freeze({ ...payload }), target);
    };
    document.addEventListener(PRESENTATION_STATE_EVENT, listener);
    return () => document.removeEventListener(PRESENTATION_STATE_EVENT, listener);
  }

  function pageObserverState() {
    const marker = pageObserverMarker();
    return Object.freeze({
      active: Boolean(marker),
      owner: marker?.dataset.expPageObserver || null,
      protocol: marker?.dataset.expPageObserverProtocol || null,
      epoch: Number(marker?.dataset.expPageObserverEpoch || 0),
      phase: marker?.dataset.expPageObserverPhase || null,
    });
  }

  function registerDiagnosticsProduct(productId, productVersion, host) {
    const result = ExtraPotionsDiagnostics.registerProduct(productId, productVersion, host);
    if (result) result.dataset.expCoreVersion = version;
    const contract = suiteContract(productId);
    registerSuiteProduct({ productId, productVersion });
    if (contract?.presentationPhases?.length) registerPresentationProvider({ productId });
    return result;
  }
  function menuThemeOwner() {
    return [...document.querySelectorAll('[data-exp-product-launcher="1"][data-product-id]')]
      .filter(node => node.isConnected && THEME_PRIORITY[node.dataset.productId])
      .sort((a,b) => THEME_PRIORITY[b.dataset.productId] - THEME_PRIORITY[a.dataset.productId])[0] || null;
  }
  function menuPalette(host) {
    try {
      const value = JSON.parse(host.dataset.expMenuPalette || 'null');
      if (!value || !baseTokenNames.every(key => /^#[0-9a-f]{3,8}$/i.test(value[key]))) return null;
      if (value.skin && (/url\(|var\(|;|\/\*/i.test(value.skin) || value.skin.length > 300)) return null;
      return semanticTheme(value);
    } catch { return null; }
  }
  function publishMenuPalette(host, theme) {
    if (!host || !theme) return;
    const palette = Object.fromEntries([...tokenNames,'id','skin','skinVertical','skinMode'].map(key => [key, theme[key]]));
    const serialized = JSON.stringify(palette);
    if (host.dataset.expMenuPalette === serialized) return;
    host.dataset.expMenuPalette = serialized;
    emit('menu-theme', host.dataset.productId);
  }
  // Every stylesheet Core injects is marked as owned by ExtraPotions so theming tools
  // such as SHIFT leave it alone. A <style> node carries data-exp-owned; a constructed
  // sheet has no node, so it starts with an empty marker rule that any script on the
  // page can read through the CSSOM.
  const OWNED_SHEET_MARKER = '.exp-owned-sheet-marker{}';
  function isOwnedSheet(sheet) {
    try { return sheet?.ownerNode?.dataset?.expOwned === '1' || sheet?.cssRules?.[0]?.selectorText === '.exp-owned-sheet-marker'; } catch { return false; }
  }
  function injectStyle(shadow, css, data = {}) {
    const node = document.createElement('style');
    Object.assign(node.dataset, data);
    node.dataset.expOwned = '1';
    node.textContent = css;
    shadow.append(node);
    // Constructed sheets survive pages that block style elements. Keep the style
    // node as a fallback and as the editable public handle used by product code.
    let sheet;
    try { sheet = new CSSStyleSheet(); sheet.replaceSync(OWNED_SHEET_MARKER + css); shadow.adoptedStyleSheets = [...shadow.adoptedStyleSheets, sheet]; } catch {}
    const observe = new MutationObserver(() => { if (sheet) { try { sheet.replaceSync(OWNED_SHEET_MARKER + node.textContent); } catch {} } });
    observe.observe(node, { childList: true, characterData: true, subtree: true });
    node.dispose = () => { observe.disconnect(); if (sheet) shadow.adoptedStyleSheets = [...shadow.adoptedStyleSheets].filter(s => s !== sheet); node.remove(); };
    return node;
  }
  function resolveShadowRoot(target) {
    if (target instanceof ShadowRoot) return target;
    if (target instanceof Element) {
      if (target.shadowRoot instanceof ShadowRoot) return target.shadowRoot;
      const root = target.getRootNode?.();
      if (root instanceof ShadowRoot) return root;
    }
    return null;
  }
  function applyMatteToggleChrome(target) {
    const shadow = resolveShadowRoot(target);
    if (!shadow) return false;
    if (shadow.querySelector('style[data-exp-matte-toggle-chrome]')) return true;
    injectStyle(shadow, MATTE_TOGGLE_CHROME_CSS, { expMatteToggleChrome: '1' });
    return true;
  }
  function applyTwoColumnSettingsGrid(container) {
    if (!(container instanceof HTMLElement)) return false;
    const root = resolveShadowRoot(container);
    if (root && !root.querySelector('style[data-exp-settings-grid]')) {
      injectStyle(root, '[data-exp-settings-grid="two-column"]{display:grid!important;grid-template-columns:minmax(0,1fr)!important;align-items:stretch!important;column-gap:0!important}[data-exp-settings-grid="two-column"]>*{grid-column:1/-1!important;min-width:0!important}[data-exp-settings-grid="two-column"]>[data-exp-grid-cell="compact"]{grid-column:1/-1!important}', { expSettingsGrid: '1' });
    }
    container.dataset.expSettingsGrid = 'two-column';
    if (root) applyMatteToggleChrome(root);
    return true;
  }
  function applyContentDrivenMenuLayout(shadow) {
    if (!(shadow instanceof ShadowRoot)) return false;
    shadow.host.dataset.expContentDrivenMenu = '1';
    if (!shadow.querySelector('style[data-exp-content-driven-menu]')) {
      injectStyle(shadow, '.fl-tool-body .action.warn{border-color:#cb6868!important;background:#402020!important;color:#ffd7d7!important}.fl-tool-body .action.warn:hover{background:#582828!important;color:#fff!important}:host([data-exp-content-driven-menu="1"]) :is(.panel,#mb-dock,[data-exp-part="dock"]){height:auto!important;min-height:0!important}:host([data-exp-content-driven-menu="1"]) :is(.fl-tool-body,.panel-body,.route-body){height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important}:host([data-exp-content-driven-menu="1"]) :is(.fl-tool-header,.panel-head,.route,.nav-item,.group>summary){height:auto!important;min-height:0!important;white-space:normal!important}:host([data-exp-content-driven-menu="1"]) :is(.fl-tool-title,.label,.setting-label,.setting-value,.copy strong,.copy .label){overflow:visible!important;text-overflow:clip!important;white-space:normal!important;word-break:normal!important;overflow-wrap:anywhere!important}:host([data-exp-content-driven-menu="1"]) :is(.row,.mini-row,.setting-row){height:auto!important;min-height:0!important;align-items:center!important}:host([data-exp-content-driven-menu="1"]) :is(.group,.section,.panel-body:not(.hidden)){grid-template-columns:minmax(0,1fr)!important}:host([data-exp-content-driven-menu="1"]) :is(.group,.section,.panel-body:not(.hidden))>*{grid-column:1/-1!important}.fl-tool-body .row:has(>select){display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr)!important;min-width:0!important}.fl-tool-body .row>select{width:100%!important;min-width:0!important;max-width:100%!important}', { expContentDrivenMenu: '1' });
    }
    applyMatteToggleChrome(shadow);
    return true;
  }
  function layoutGrid() {
    const order = read(GRID_ORDER, []);
    const sorted = [...document.querySelectorAll('[data-exp-product-launcher="1"]')].sort((a,b) => {
      const ai = Array.isArray(order) ? order.indexOf(a.dataset.productId) : -1;
      const bi = Array.isArray(order) ? order.indexOf(b.dataset.productId) : -1;
      if (ai !== bi) return ai < 0 ? 1 : bi < 0 ? -1 : ai - bi;
      const ap = Number(a.dataset.launcherPriority || 0);
      const bp = Number(b.dataset.launcherPriority || 0);
      return bp - ap || a.dataset.productId.localeCompare(b.dataset.productId);
    });
    const assign = (node, slot, span = 1) => {
      const row = Math.floor(slot / 3), column = slot % 3;
      Object.assign(node.dataset, { launcherSlot:String(slot), launcherRow:String(row), launcherColumn:String(column), launcherSpan:String(span) });
      node.style.setProperty('--exp-launcher-x', column * 56 + 'px');
      node.style.setProperty('--exp-launcher-y', row * 56 + 'px');
      node.style.setProperty('--exp-launcher-offset', row * 56 + 'px');
    };
    // Dropper's progress card spans the space to the left of the launchers, so while any launcher
    // reserves rows, every launcher stacks in the right-hand column where nothing can cover it.
    const stacked = sorted.some(node => Number(node.dataset.launcherReservedRows) > 0);
    sorted.forEach((node, index) => assign(node, stacked ? index * 3 : index));
    const ids = sorted.map(node => node.dataset.productId);
    const known = new Set(Object.keys(SUITE_PRODUCTS));
    const completeSuite = ids.filter(id => known.has(id)).length === known.size;
    // Do not turn userscript injection timing into a saved preference. A fresh
    // install stays priority-sorted until either the complete suite is present
    // or the user explicitly reorders the visible launchers.
    if ((Array.isArray(order) && order.length) || completeSuite) write(GRID_ORDER, ids);
  }
  // The single source of launcher coordinates for every product: the saved group position
  // (GRID_DELTA) plus the launcher's grid cell. Products position their launcher from this.
  function launcherPlacement(host) {
    const style = getComputedStyle(host);
    const offset = parseFloat(style.getPropertyValue('--exp-launcher-offset')) || 0;
    const x = parseFloat(style.getPropertyValue('--exp-launcher-x')) || 0;
    const delta = Math.max(8-(innerHeight-60), Math.min(4, Number(read(GRID_DELTA,0)) || 0));
    const origin = innerHeight-60+delta, anchor = origin <= (innerHeight-48)/2 ? 'top':'bottom';
    document.documentElement.dataset.expLauncherAnchor = anchor;
    const top = Math.max(8, Math.min(innerHeight-56, anchor === 'top' ? origin+offset : origin-offset));
    return { top, right: 12+x, anchor, delta };
  }
  // Restores the default launcher order and group position for every product.
  // Shared geometry for menus and notices: the launcher that owns them, the left edge of the launcher grid,
  // and any visible surface a product marks with data-exp-reserved (Dropper's progress card).
  function surfaceGeometry(host) {
    const launcherOf = node => node?.shadowRoot?.querySelector('[data-exp-part="launcher"],.launcher');
    const own = launcherOf(host)?.getBoundingClientRect();
    if (!own || !own.width) return null;
    const hosts = [...document.querySelectorAll('[data-exp-product-launcher="1"]')];
    const launchers = hosts.map(node => launcherOf(node)?.getBoundingClientRect()).filter(box => box?.width && box?.height);
    // A reserved surface never reaches into the launcher column: a product that marks a whole row holding
    // its launcher gets the same geometry as one that marks only the card beside it.
    const columnLeft = Math.min(...launchers.map(box => box.left));
    const reservedBoxes = hosts.flatMap(node => [...(node.shadowRoot?.querySelectorAll('[data-exp-reserved]') || [])])
      .map(node => node.getBoundingClientRect()).filter(box => box.width && box.height)
      .map(box => ({ top:box.top, bottom:box.bottom, left:box.left, right:box.left < columnLeft ? Math.min(box.right, columnLeft - 8) : box.right }))
      .filter(box => box.right > box.left);
    const reserved = reservedBoxes.length ? reservedBoxes.reduce((all, box) => ({ top:Math.min(all.top, box.top), bottom:Math.max(all.bottom, box.bottom), left:Math.min(all.left, box.left), right:Math.max(all.right, box.right) })) : null;
    const gridLeft = Math.min(own.left, ...launchers.map(box => box.left), ...reservedBoxes.map(box => box.left));
    const anchorTop = document.documentElement.dataset.expLauncherAnchor === 'top';
    return { own, launchers, reserved, gridLeft, anchorTop };
  }
  // The single menu placement for every product, in order of preference:
  // 1. Directly above a reserved surface such as Dropper's progress card (below it when the launchers are
  //    anchored at the top), sharing its right edge, so the menu covers neither it nor any launcher.
  // 2. Beside the launcher grid, lined up with the launcher that opened it.
  // 3. Above or below the grid when the window is too narrow for either.
  function placeMenu(host, panel, preferredWidth = 312) {
    const geometry = surfaceGeometry(host);
    if (!geometry) return null;
    const { own, reserved, gridLeft, anchorTop } = geometry;
    // A product stylesheet may still size its menu; decide using the width the menu actually renders at.
    panel.style.width = Math.max(0, Math.min(preferredWidth, innerWidth - 24)) + 'px';
    const width = panel.offsetWidth || preferredWidth;
    Object.assign(panel.style, { left:'auto', bottom:'auto' });
    const finish = (side, right, top, h) => {
      top = Math.round(Math.max(8, Math.min(innerHeight - h - 8, top)));
      Object.assign(panel.style, { right:Math.round(right)+'px', top:top+'px' });
      host.dataset.menuSide = side;
      return { top, right:Math.round(right), width, side };
    };
    if (reserved) {
      const room = anchorTop ? innerHeight - reserved.bottom - 16 : reserved.top - 16;
      if (room >= 200 && reserved.right - 8 >= width) {
        panel.style.maxHeight = room + 'px';
        const h = panel.offsetHeight;
        host.dataset.openDirection = anchorTop ? 'down' : 'up';
        return finish('reserved', innerWidth - reserved.right, anchorTop ? reserved.bottom + 8 : reserved.top - 8 - h, h);
      }
    }
    if (gridLeft - 16 >= width) {
      panel.style.maxHeight = Math.max(0, innerHeight - 16) + 'px';
      const h = panel.offsetHeight;
      host.dataset.openDirection = 'down';
      return finish('beside', innerWidth - gridLeft + 8, anchorTop ? own.top : own.bottom - h, h);
    }
    // Stacked menus clear the launcher and any reserved surface in its row.
    const band = [...geometry.launchers, ...(reserved ? [reserved] : [])].filter(box => box.bottom > own.top - 1 && box.top < own.bottom + 1)
      .reduce((all, box) => ({ top:Math.min(all.top, box.top), bottom:Math.max(all.bottom, box.bottom) }), { top:own.top, bottom:own.bottom });
    const below = innerHeight - band.bottom - 16, above = band.top - 16;
    const up = anchorTop ? below < 160 && above > below : !(above < 160 && below > above);
    panel.style.maxHeight = Math.max(0, up ? above : below) + 'px';
    const h = panel.offsetHeight;
    host.dataset.openDirection = up ? 'up' : 'down';
    return finish('stacked', 12, up ? band.top - h - 8 : band.bottom + 8, h);
  }
  // The single placement for update and changelog notices. With a menu open, the notice stacks beyond it
  // (above it, or below it when the launchers are anchored at the top) and shares its right edge. With no
  // menu open it takes the menu's place: above a reserved surface, or beside the launcher grid.
  function placeNotice(host, notice, panel = null) {
    const geometry = surfaceGeometry(host);
    if (!geometry) return null;
    const { own, reserved, gridLeft, anchorTop } = geometry;
    const width = notice.offsetWidth || 260;
    const height = notice.offsetHeight || notice.scrollHeight || 72;
    const menu = panel && !panel.hidden && panel.getClientRects().length ? panel.getBoundingClientRect() : null;
    let right, top;
    if (menu?.width && menu?.height) {
      right = menu.right;
      const beyond = anchorTop ? menu.bottom + 8 : menu.top - height - 8;
      const fits = anchorTop ? beyond + height <= innerHeight - 8 : beyond >= 8;
      top = fits ? beyond : (anchorTop ? menu.top - height - 8 : menu.bottom + 8);
    } else if (reserved && reserved.right - 8 >= width) {
      right = reserved.right;
      top = anchorTop ? reserved.bottom + 8 : reserved.top - height - 8;
    } else if (gridLeft - 16 >= width) {
      right = gridLeft - 8;
      top = anchorTop ? own.top : own.bottom - height;
    } else {
      right = own.right;
      top = anchorTop ? own.bottom + 8 : own.top - height - 8;
    }
    const left = Math.round(Math.max(8, Math.min(innerWidth - width - 8, right - width)));
    top = Math.round(Math.max(8, Math.min(innerHeight - height - 8, top)));
    notice.style.setProperty('left', left + 'px', 'important');
    notice.style.setProperty('right', 'auto', 'important');
    notice.style.setProperty('top', top + 'px', 'important');
    notice.style.setProperty('bottom', 'auto', 'important');
    return { left, top };
  }
  // Every launcher host is its own top-layer popover, and the top layer stacks in the order popovers were
  // shown (product load order), not by z-index. Whenever a menu opens, re-show its host so the open menu
  // sits above every other launcher. Any product that announces exp-core:menu-open gets this for free.
  function raiseOpenMenuHost() {
    const id = document.documentElement.getAttribute('data-exp-open-menu');
    const host = [...document.querySelectorAll('[data-exp-product-launcher="1"]')].find(node => node.dataset.productId === id);
    if (!host || typeof host.hidePopover !== 'function') return;
    try { if (host.matches(':popover-open')) host.hidePopover(); host.showPopover(); } catch {}
  }
  function resetLauncherGrid(productId) { write(GRID_ORDER,[]); write(GRID_DELTA,0); layoutGrid(); emit('launcher-grid-moved', productId); }
  // Shared launcher drag for every product: drag moves the launcher group along the right edge;
  // Shift+drag and Alt+Arrow keys reorder. Listens on window in the capture phase so host pages
  // that stop pointer events (Twitch's player) cannot stall a drag. Returns a cleanup function.
  function bindLauncherDrag(launcher, id, { layout = () => {} } = {}) {
    const removers = [];
    const on = (node,type,fn,opts) => { node.addEventListener(type,fn,opts); removers.push(() => node.removeEventListener(type,fn,opts)); };
    let startX=0,startY=0,startDelta=0,pointer=null,dragged=false,mode='',axis='',order=[];
    launcher.title = launcher.title || 'Drag to move the launchers. Shift+drag or Alt+Arrow keys reorder.';
    on(launcher,'pointerdown',e=>{if(e.button!==0)return;pointer=e.pointerId;startX=e.clientX;startY=e.clientY;startDelta=Number(read(GRID_DELTA,0))||0;mode=e.shiftKey?'order':'group';order=interactionGridOrder();if(!order.includes(id))order.push(id);dragged=false;axis='';e.preventDefault();try{launcher.setPointerCapture(e.pointerId);}catch{}});
    // Listen on window in the capture phase so host pages that stop pointer events (Twitch's player) cannot stall a drag.
    on(launcher,'dragstart',e=>e.preventDefault());
    on(window,'pointermove',e=>{if(e.pointerId!==pointer)return;const dx=e.clientX-startX,dy=e.clientY-startY;if(!axis&&Math.max(Math.abs(dx),Math.abs(dy))>4)axis=mode;if(!axis)return;dragged=true;e.preventDefault();launcher.classList.add('is-dragging');if(axis==='group')write(GRID_DELTA,Math.round(Math.max(8-(innerHeight-60),Math.min(4,startDelta+dy))));else{const from=order.indexOf(id),offset=Math.abs(dx)>Math.abs(dy)?Math.round(-dx/56):Math.round(dy/56)*3,to=Math.max(0,Math.min(order.length-1,from+offset)),next=[...order];next.splice(from,1);next.splice(to,0,id);write(GRID_ORDER,next);}layoutGrid();emit('launcher-grid-moved',id);layout();},{passive:false,capture:true});
    const end=e=>{if(e.pointerId===pointer){pointer=null;launcher.classList.remove('is-dragging');try{launcher.releasePointerCapture(e.pointerId);}catch{}}};
    on(window,'pointerup',end,true);on(window,'pointercancel',end,true);on(launcher,'lostpointercapture',end);
    on(launcher,'click',e=>{if(dragged){e.preventDefault();e.stopImmediatePropagation();dragged=false;}},true);
    on(launcher,'keydown',e=>{if(!e.altKey||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();let next=interactionGridOrder();if(!next.includes(id))next.push(id);const from=next.indexOf(id),offset={ArrowLeft:1,ArrowRight:-1,ArrowUp:-3,ArrowDown:3}[e.key],to=Math.max(0,Math.min(next.length-1,from+offset));next=[...next];next.splice(from,1);next.splice(to,0,id);write(GRID_ORDER,next);layoutGrid();emit('launcher-grid-moved',id);layout();launcher.focus();});
    return () => { while (removers.length) removers.pop()(); };
  }
  function interactionGridOrder() {
    let order = read(GRID_ORDER, []);
    if (!Array.isArray(order)) order = [];
    const visible = [...document.querySelectorAll('[data-exp-product-launcher="1"]')]
      .sort((a,b) => Number(a.dataset.launcherSlot || 0) - Number(b.dataset.launcherSlot || 0))
      .map(node => node.dataset.productId);
    if (!order.length) return visible;
    const seen = new Set(order);
    return [...order, ...visible.filter(id => !seen.has(id))];
  }
  function storageRead(key, fallback = null) {
    try { if (typeof GM_getValue === 'function') return GM_getValue(key, fallback); } catch {}
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  }
  function storageWrite(key, value) {
    try { if (typeof GM_setValue === 'function') { GM_setValue(key, value); return; } } catch {}
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }
  function claimNotice(productId, changeId) {
    const key = `exp:v3:${String(productId || 'product')}:notice:${String(changeId || 'change')}`;
    if (storageRead(key, false) === true) return false;
    storageWrite(key, true);
    return true;
  }
  function consumeVersionChange(productId, currentVersion, legacyKey = '') {
    const key = `exp:v3:${String(productId || 'product')}:installed-version`;
    let previous = String(storageRead(key, '') || '');
    if (!previous && legacyKey) { try { previous = String(localStorage.getItem(legacyKey) || ''); } catch {} }
    storageWrite(key, String(currentVersion || ''));
    return previous && previous !== currentVersion && claimNotice(productId, `updated:${currentVersion}`) ? previous : '';
  }
  function visibleFloatingNotices() {
    return [...document.querySelectorAll('[data-exp-product-launcher="1"][data-product-id]')]
      .flatMap(host => [...(host.shadowRoot?.querySelectorAll('[data-exp-floating-notice="1"]') || [])].map(notice => ({ host, notice })))
      .filter(({ notice }) => !notice.hidden && notice.getClientRects().length)
      .sort((a,b) => Number(a.host.dataset.launcherSlot || 0) - Number(b.host.dataset.launcherSlot || 0) || a.host.dataset.productId.localeCompare(b.host.dataset.productId));
  }
  function layoutFloatingNotices() {
    const launchers = [...document.querySelectorAll('[data-exp-product-launcher="1"][data-product-id]')]
      .map(host => host.shadowRoot?.querySelector('[data-exp-part="launcher"]'))
      .filter(Boolean).map(node => node.getBoundingClientRect()).filter(box => box.width && box.height);
    const notices = visibleFloatingNotices();
    if (!launchers.length || !notices.length) return;
    const anchor = document.documentElement.dataset.expLauncherAnchor === 'top' ? 'top' : 'bottom';
    const gridTop = Math.min(...launchers.map(box => box.top));
    const gridBottom = Math.max(...launchers.map(box => box.bottom));
    const gridRight = Math.max(...launchers.map(box => box.right));
    let cursor = anchor === 'top' ? gridBottom + 8 : gridTop - 8;
    for (const { notice } of notices) {
      const width = Math.min(notice.offsetWidth || notice.scrollWidth || 260, Math.max(0, innerWidth - 24));
      const height = notice.offsetHeight || notice.scrollHeight || 72;
      const top = anchor === 'top' ? cursor : cursor - height;
      notice.style.setProperty('width', `${width}px`, 'important');
      notice.style.setProperty('left', `${Math.max(8, Math.min(innerWidth - width - 8, gridRight - width))}px`, 'important');
      notice.style.setProperty('right', 'auto', 'important');
      notice.style.setProperty('top', `${Math.max(8, Math.min(innerHeight - height - 8, top))}px`, 'important');
      notice.style.setProperty('bottom', 'auto', 'important');
      cursor = anchor === 'top' ? top + height + 8 : top - 8;
    }
  }
  function registerFloatingNotice(host, notice) {
    if (!(host instanceof Element) || !(notice instanceof Element)) return () => {};
    if (floatingNoticeRegistrations.has(notice)) return floatingNoticeRegistrations.get(notice);
    notice.dataset.expFloatingNotice = '1';
    const refresh = () => requestAnimationFrame(layoutFloatingNotices);
    const mutation = new MutationObserver(refresh); mutation.observe(notice, { attributes:true, attributeFilter:['hidden','class'] });
    const resize = new ResizeObserver(refresh); resize.observe(notice);
    addEventListener('resize', refresh, { passive:true }); document.addEventListener('exp-core:coordination', refresh);
    const dispose = () => { mutation.disconnect(); resize.disconnect(); removeEventListener('resize', refresh); document.removeEventListener('exp-core:coordination', refresh); floatingNoticeRegistrations.delete(notice); };
    floatingNoticeRegistrations.set(notice, dispose); refresh(); return dispose;
  }
  function registerLauncher(host, options = {}) {
    if (registrations.has(host)) return registrations.get(host);
    const id = options.productId || options.id || host.dataset.productId;
    const contract = suiteContract(id);
    const launcherPriority = contract ? contract.launcherPriority : options.priority ?? 0;
    Object.assign(host.dataset, { expProductLauncher:'1', productId:id, launcherPriority:String(launcherPriority) });
    applyMatteToggleChrome(host);
    // The launcher is non-modal: site-wide dialog backdrop styles must never
    // paint over the page when the reference opens its manual popover.
    const backdropStyle = host.shadowRoot ? injectStyle(host.shadowRoot,
      ':host::backdrop{all:initial!important;display:none!important;background:transparent!important;pointer-events:none!important}',
      { expLauncherBackdrop: '1' }) : null;
    const stopProtect = CoreFoundation.protectLauncherHost(host);
    let frame = 0;
    const refresh = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; layoutGrid(); controllers.get(host)?.layout(); }); };
    document.addEventListener('exp-core:coordination', refresh);
    addEventListener('resize', refresh);
    layoutGrid(); emit('launcher-added', id);
    const dispose = () => { stopProtect(); backdropStyle?.dispose(); cancelAnimationFrame(frame); document.removeEventListener('exp-core:coordination', refresh); removeEventListener('resize', refresh); delete host.dataset.expProductLauncher; registrations.delete(host); layoutGrid(); emit('launcher-removed', id); };
    registrations.set(host, dispose);
    return dispose;
  }
  function themes(productTheme) {
    const common = CoreFoundation.SHARED_UI_THEMES;
    return Object.freeze([...common, CoreFoundation.CRIMSON_THEME, ...(productTheme ? [productTheme] : [CoreFoundation.UI_THEMES.at(-1)])].map(t => { const theme = semanticTheme(t); return Object.freeze({ ...theme, vars: Object.fromEntries(tokenNames.map(k => [k, theme[k]])) }); }));
  }
  function createThemeSwatches({ container, themes: choices, value, onChange = () => {} }) {
    const root = resolveShadowRoot(container);
    if (root && !root.querySelector('style[data-exp-theme-swatches]')) {
      injectStyle(root, '.exp-theme-swatches{display:flex;align-items:center;gap:6px;min-height:28px;flex-wrap:wrap}.exp-theme-swatch{appearance:none;box-sizing:border-box!important;flex:0 0 22px!important;width:22px!important;height:22px!important;min-width:22px!important;min-height:22px!important;max-width:22px!important;max-height:22px!important;padding:0!important;border:2px solid var(--theme-line,var(--line,#41434d));border-radius:5px!important;cursor:pointer}.exp-theme-swatch:hover,.exp-theme-swatch:focus-visible{outline:2px solid var(--theme-accent,var(--accent,#8b5cf6));outline-offset:2px}.exp-theme-swatch.is-on{border-color:var(--theme-text,var(--text,#fff));box-shadow:0 0 0 2px var(--theme-accent,var(--accent,#8b5cf6))}', { expThemeSwatches: '1' });
      applyMatteToggleChrome(root);
    }
    container.classList.add('exp-theme-swatches'); container.setAttribute('role', 'radiogroup'); container.setAttribute('aria-label', 'Menu Theme');
    const buttons = choices.map(theme => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'exp-theme-swatch';
      for (const property of ['width','height','min-width','min-height','max-width','max-height']) button.style.setProperty(property, '22px', 'important');
      button.style.setProperty('border-radius', '5px', 'important');
      button.style.setProperty('padding', '0', 'important');
      button.style.setProperty('box-sizing', 'border-box', 'important');
      button.style.setProperty('flex', '0 0 22px', 'important');
      button.setAttribute('role', 'radio'); button.setAttribute('aria-label', theme.name); button.title = theme.name;
      button.dataset.theme = button.dataset.swatch = theme.id; button.style.background = theme.swatch;
      button.addEventListener('click', () => { paint(theme.id); onChange(theme.id); }); container.append(button); return button;
    });
    function paint(next) { value = next; buttons.forEach((b,i) => { const on = choices[i].id === value; b.classList.toggle('is-on', on); b.setAttribute('aria-checked', String(on)); b.setAttribute('aria-pressed', String(on)); b.tabIndex = on || !choices.some(t => t.id === value) && i === 0 ? 0 : -1; }); }
    const keyboard = event => { const current = buttons.indexOf(event.target); if (current < 0 || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)) return; event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (['ArrowRight','ArrowDown'].includes(event.key) ? 1 : -1) + buttons.length) % buttons.length; buttons[next].click(); buttons[next].focus(); };
    container.addEventListener('keydown', keyboard); paint(value);
    return { setValue: paint, destroy() { container.removeEventListener('keydown', keyboard); buttons.forEach(b => b.remove()); } };
  }
  function focusMenuSurface(panel) { if (!(panel instanceof HTMLElement)) return false; panel.tabIndex = -1; panel.style.outline = 'none'; panel.focus({ preventScroll: true }); return true; }
  const FLOATING_NOTICE_CSS = '.exp-floating-update{position:fixed;z-index:2147483647;box-sizing:border-box;width:min(312px,calc(100vw - 24px));max-width:calc(100vw - 24px);margin:0;padding:10px 32px 10px 10px;border:1px solid var(--exp-notice-border,#6f42b4);border-radius:10px;background:linear-gradient(180deg,var(--exp-notice-top,#251a35),var(--exp-notice-bottom,#18181d) 70%);color:var(--exp-notice-text,#f4f4f6);box-shadow:0 10px 28px #0008;font:500 9px/1.45 system-ui,sans-serif}.exp-floating-update[hidden]{display:none!important}.exp-floating-update-dismiss{position:absolute;top:7px;right:7px;width:23px;height:23px;padding:0;border:1px solid transparent;border-radius:7px;background:transparent;color:inherit;cursor:pointer;font:15px/1 Arial,sans-serif}.exp-floating-update-dismiss:hover,.exp-floating-update-dismiss:focus-visible{border-color:var(--exp-notice-border,#6f42b4);outline:none}';
  function ensureFloatingNoticeStyle(shadow) {
    if (!shadow.querySelector('style[data-exp-floating-notice]')) {
      injectStyle(shadow, FLOATING_NOTICE_CSS, { expFloatingNotice: '1' });
    }
  }
  function syncNoticeTheme(notice, themeSource) {
    const theme = getComputedStyle(themeSource);
    const first = (names, fallback) => names.map(name => theme.getPropertyValue(name).trim()).find(Boolean) || fallback;
    notice.style.setProperty('--exp-notice-border', first(['--exp-notice-border','--theme-accent','--accent','--accent2','--teal','--mb-brand'], theme.borderTopColor || '#6f42b4'));
    notice.style.setProperty('--exp-notice-top', first(['--exp-notice-top','--theme-panel','--surface','--panel','--raised','--mb-surface','--bg','--mb-bg'], theme.backgroundColor || '#251a35'));
    notice.style.setProperty('--exp-notice-bottom', first(['--exp-notice-bottom','--theme-bg','--bg','--mb-bg','--surface','--mb-surface'], theme.backgroundColor || '#18181d'));
    notice.style.setProperty('--exp-notice-text', first(['--exp-notice-text','--theme-text','--text','--mb-ink'], theme.color || '#f4f4f6'));
  }
  function createFloatingNotice(options = {}) {
    const { shadow, panel, notice, versionButton = null } = options;
    const host = options.host || shadow?.host;
    if (!(shadow instanceof ShadowRoot) || !(panel instanceof Element) || !(notice instanceof Element)) return Object.freeze({ show() {}, hide() {}, toggle() {}, layout() {}, setMenuOpen() {}, destroy() {} });
    const durationMs = Math.max(0, Number(options.durationMs ?? 30000));
    const manageVersion = options.manageVersion !== false;
    let timer = 0, menuOpen = false, destroyed = false;
    ensureFloatingNoticeStyle(shadow);
    applyMatteToggleChrome(shadow);
    notice.classList.add('update-notice','exp-floating-update'); notice.setAttribute('role','status');
    let dismiss = notice.querySelector(':scope > .exp-floating-update-dismiss');
    if (!dismiss) { dismiss=document.createElement('button'); dismiss.type='button'; dismiss.className='exp-floating-update-dismiss'; dismiss.setAttribute('aria-label','Dismiss changelog'); dismiss.textContent='×'; notice.prepend(dismiss); }
    shadow.append(notice); const unregisterNotice = registerFloatingNotice(host, notice);
    const themeSource = options.themeSource instanceof Element ? options.themeSource : panel;
    const syncTheme = () => syncNoticeTheme(notice, themeSource);
    const clearTimer=()=>{clearTimeout(timer);timer=0;};
    function layout(){if(destroyed||notice.hidden)return;syncTheme();layoutFloatingNotices();}
    function hide(){clearTimer();notice.hidden=true;versionButton?.setAttribute('aria-expanded','false');layoutFloatingNotices();}
    function show(){notice.hidden=false;versionButton?.setAttribute('aria-expanded','true');clearTimer();if(durationMs)timer=setTimeout(hide,durationMs);requestAnimationFrame(layoutFloatingNotices);}
    function toggle(){if(notice.hidden)show();else hide();}
    function versionClick(){if(manageVersion)toggle();else if(!notice.hidden)show();}
    function setMenuOpen(value){menuOpen=Boolean(value);if(!menuOpen)hide();else requestAnimationFrame(layout);}
    const coordination=()=>requestAnimationFrame(layout);
    dismiss.addEventListener('click',hide);versionButton?.addEventListener('click',versionClick);addEventListener('resize',layout,{passive:true});document.addEventListener('exp-core:coordination',coordination);
    return Object.freeze({show,hide,toggle,layout,setMenuOpen,destroy(){destroyed=true;clearTimer();unregisterNotice();dismiss.removeEventListener('click',hide);versionButton?.removeEventListener('click',versionClick);removeEventListener('resize',layout);document.removeEventListener('exp-core:coordination',coordination);}});
  }
  // Core-owned update and changelog cards use the canonical menu-width notice
  // geometry. The legacy floating-notice coordinator remains exported
  // for compatibility, but it no longer owns these product notices.
  function createMenuNotice(options = {}) {
    const { shadow, panel, notice, versionButton = null } = options;
    const host = options.host || shadow?.host;
    if (!(shadow instanceof ShadowRoot) || !(panel instanceof Element) || !(notice instanceof Element)) {
      return Object.freeze({ show() {}, hide() {}, toggle() {}, layout() {}, setMenuOpen() {}, destroy() {} });
    }
    const durationMs = Math.max(0, Number(options.durationMs ?? 30000));
    const manageVersion = options.manageVersion !== false;
    let timer = 0, menuOpen = false, destroyed = false, frame = 0;

    ensureFloatingNoticeStyle(shadow);
    applyMatteToggleChrome(shadow);
    notice.classList.add('update-notice', 'exp-floating-update');
    notice.dataset.placement = 'menu';
    delete notice.dataset.expFloatingNotice;
    notice.setAttribute('role', 'status');

    let dismiss = notice.querySelector(':scope > .exp-floating-update-dismiss,.update-dismiss');
    if (!dismiss) {
      dismiss = document.createElement('button');
      dismiss.type = 'button';
      dismiss.className = 'exp-floating-update-dismiss';
      dismiss.setAttribute('aria-label', 'Dismiss changelog');
      dismiss.textContent = '×';
      notice.prepend(dismiss);
    }

    const themeSource = options.themeSource instanceof Element ? options.themeSource : panel;
    const syncTheme = () => syncNoticeTheme(notice, themeSource);
    function widthForMode() {
      return menuWidthForMode(host?.dataset.menuWidth || 'compact');
    }
    function clearTimer() { clearTimeout(timer); timer = 0; }
    function queueLayout() {
      if (destroyed || frame) return;
      frame = requestAnimationFrame(() => { frame = 0; layout(); });
    }
    function layout() {
      if (destroyed || notice.hidden) return;
      syncTheme();
      const width = Math.min(widthForMode(), Math.max(0, innerWidth - 24));
      notice.style.setProperty('width', width + 'px', 'important');

      placeNotice(host || shadow.host, notice, menuOpen ? panel : null);
    }
    function hide() {
      clearTimer();
      notice.hidden = true;
      versionButton?.setAttribute('aria-expanded', 'false');
    }
    function show() {
      notice.hidden = false;
      versionButton?.setAttribute('aria-expanded', 'true');
      clearTimer();
      if (durationMs) timer = setTimeout(hide, durationMs);
      queueLayout();
    }
    function toggle() { if (notice.hidden) show(); else hide(); }
    function versionClick() { if (manageVersion) toggle(); else if (!notice.hidden) show(); }
    function setMenuOpen(value) { menuOpen = Boolean(value); queueLayout(); }

    const resize = new ResizeObserver(queueLayout);
    resize.observe(panel);
    resize.observe(notice);
    const mutation = new MutationObserver(queueLayout);
    mutation.observe(notice, { attributes:true, attributeFilter:['hidden'], childList:true, subtree:true });
    const coordination = () => queueLayout();
    dismiss.addEventListener('click', hide);
    versionButton?.addEventListener('click', versionClick);
    addEventListener('resize', queueLayout, { passive:true });
    document.addEventListener('exp-core:coordination', coordination);

    return Object.freeze({
      show, hide, toggle, layout, setMenuOpen,
      destroy() {
        destroyed = true;
        cancelAnimationFrame(frame);
        clearTimer();
        resize.disconnect();
        mutation.disconnect();
        dismiss.removeEventListener('click', hide);
        versionButton?.removeEventListener('click', versionClick);
        removeEventListener('resize', queueLayout);
        document.removeEventListener('exp-core:coordination', coordination);
      },
    });
  }

  function applyTheme(host, value, choices) {
    const controller = controllers.get(host); if (!controller) return;
    controller.setTheme(value, choices);
  }
  function normalizeControls(panel) {
    panel.querySelectorAll('button[role="switch"],button.toggle').forEach(button => {
      button.classList.add('toggleSwitch'); button.setAttribute('role', 'switch');
      if (!button.hasAttribute('aria-checked')) button.setAttribute('aria-checked', 'false');
      const row = button.closest('.row,.mini-row,.fl-switch,.setting-row');
      if (row) { row.classList.add('fl-switch'); const label = row.querySelector('.label,.copy>strong,.row-copy>strong,.setting-label,span'); if (label) label.classList.add('fl-switch-text'); if (!button.hasAttribute('aria-label') && !button.hasAttribute('aria-labelledby')) button.setAttribute('aria-label', label?.textContent || row.textContent.trim()); }
    });
    panel.querySelectorAll('.row,.mini-row,.setting-row').forEach(row => { if (!row.classList.contains('fl-switch')) row.classList.add('mini-row'); });
    panel.querySelectorAll('select').forEach(node => node.classList.add('select-lite'));
    panel.querySelectorAll('button.action,button.secondary,button.primary,button.compact,.diagnostics-controls button,.button-grid button,.menu-footer button').forEach(node => { if (!node.dataset.expPart) node.classList.add('life-btn'); });
    panel.querySelectorAll('.route-body').forEach(body => body.classList.toggle('fl-tool-hidden', body.hidden));
    const active = panel.querySelector('.fl-tool-header[aria-expanded="true"]');
    panel.querySelectorAll('.fl-tool-header').forEach(header => { if (active) header.classList.toggle('last-opened', header === active); const chevron = header.querySelector('.fl-tool-chevron'); if (chevron) { const text = header.getAttribute('aria-expanded') === 'true' ? '▾' : '▸'; if (chevron.textContent !== text) chevron.textContent = text; } });
  }
  function normalizeHeader(panel) {
    const head = panel.querySelector('.menu-head,header,.head'); if (!head) return;
    head.classList.add('menu-head');
    const brand = head.querySelector('.header-brand,.identity,.brand'); if (!brand) return;
    brand.classList.add('header-brand');
    let icon = brand.firstElementChild;
    if (icon?.tagName === 'IMG' || icon?.tagName.toLowerCase() === 'svg') { const frame = document.createElement('div'); frame.className = 'header-icon'; icon.before(frame); frame.append(icon); icon.classList.add('menu-icon'); icon = frame; }
    if (icon) { icon.classList.add('header-icon'); icon.querySelector('img,svg')?.classList.add('menu-icon'); }
    const copy = brand.children[1]; if (copy) copy.classList.add('header-copy');
    const row = copy?.firstElementChild; row?.classList.add('header-title-row');
    const title = row?.querySelector('h1,h2,h3,strong,.menu-title'); if (title) title.dataset.expPart = 'title';
    const ver = head.querySelector('.version,.header-version,[id$="header-version"]'); if (ver) ver.dataset.expPart = 'version';
    const subtitle = copy?.querySelector('small,.subtitle,.menu-subtitle,[id$="subtitle"]'); if (subtitle) subtitle.dataset.expPart = 'subtitle';
    const close = head.querySelector('.close,.menu-close,[id$="rail-close"]'); if (close) close.dataset.expPart = 'close';
    panel.querySelector('.divider')?.classList.add('header-divider');
    for (const section of panel.querySelectorAll('nav>.tool-panel,nav>section')) {
      section.classList.add('fl-tool-panel'); const control = section.querySelector(':scope>button'); const body = section.querySelector(':scope>div'); if (!control || !body) continue;
      control.classList.add('fl-tool-header'); body.classList.add('fl-tool-body');
      if (!control.querySelector('.fl-tool-title')) { let title = control.querySelector('span:not(.chevron)'); if (!title) { title = document.createElement('span'); title.textContent = control.textContent; control.replaceChildren(title); } title.classList.add('fl-tool-title'); }
      let chevron = control.querySelector('.chevron,.fl-tool-chevron'); if (!chevron) { chevron = document.createElement('span'); chevron.textContent = '▸'; control.append(chevron); } chevron.classList.add('fl-tool-chevron');
    }
  }
  function makeLauncher(launcher, launcherSrc) {
    if (launcher.dataset.expCoreLauncher) return;
    const image = launcher.querySelector('img,.launcher-gem svg,.icon,svg:not(.launcher-ring):not(.ring)');
    if (!image) throw new Error('Core launcher requires the product launcher artwork');
    const mark = image.cloneNode(true); mark.removeAttribute('style'); mark.removeAttribute('id'); mark.setAttribute('class','icon launcher-icon');
    if (launcherSrc && mark.tagName === 'IMG') mark.src = launcherSrc;
    launcher.replaceChildren(mark); launcher.dataset.expCoreLauncher = '1'; launcher.dataset.expPart = 'launcher';
    launcher.removeAttribute('data-help');
  }
  function create(options) {
    const { id, host, shadow, launcher, panel, getSettings = () => ({}), setOpen, shortcutKey = '', productTheme, launcherSrc } = options;
    if (controllers.has(host)) return controllers.get(host);
    // All styling comes from the reference and the composition adapter. Remove
    // product copies and their constructed sheets before mounting the canonical UI.
    shadow.querySelectorAll('style').forEach(node => node.dispose ? node.dispose() : node.remove());
    try { shadow.adoptedStyleSheets = []; } catch {}
    const styles = injectStyle(shadow, canonicalCss + compositionCss, { expCoreStyle:version });
    const themeRoot = document.createElement('div'); themeRoot.className = 'exp-core-theme';
    [...shadow.childNodes].filter(node => node !== styles).forEach(node => themeRoot.append(node)); shadow.append(themeRoot);
    panel.dataset.expPart = 'dock'; panel.classList.add('exp-menu-surface'); makeLauncher(launcher,launcherSrc); normalizeHeader(panel); normalizeControls(panel);
    let defaultSupport = null;
    const header = panel.querySelector('.menu-head');
    if (header && !header.querySelector('.support-wrap') && options.supportUrl !== '') {
      defaultSupport = createSupportControl({url:options.supportUrl || SUPPORT_URL,label:'Support '+id.toUpperCase()});
      let actions = header.querySelector('.header-actions');
      if (!actions) { actions=document.createElement('div');actions.className='header-actions';const close=header.querySelector('[data-exp-part="close"]');if(close)actions.append(close);header.append(actions); }
      actions.prepend(defaultSupport.element);
    }
    applyContentDrivenMenuLayout(shadow);
    applyMatteToggleChrome(shadow);
    const versionButton=panel.querySelector('.version,[data-exp-part="version"]');
    const menuNotices=[...themeRoot.querySelectorAll('.update-notice,.changelog')].map(notice=>createMenuNotice({host,shadow,panel,notice,versionButton:notice.classList.contains('changelog')?versionButton:null,manageVersion:false,durationMs:30000}));
    if (launcherSrc) panel.querySelectorAll('.header-icon img').forEach(image => image.src = launcherSrc);
    host.dataset.coreVersion = version; host.dataset.coreSource = 'exp-core';
    let choices = themes(productTheme), selected = choices.at(-1), open = false, destroyed = false, timer = 0, deadline = 0, frame = 0;
    const removers = [];
    const on = (node,type,fn,opts) => { node.addEventListener(type,fn,opts); removers.push(() => node.removeEventListener(type,fn,opts)); };
    let localTheme = null;
    function paintTheme(theme) {
      selected = theme;
      for (const key of tokenNames) { themeRoot.style.setProperty('--theme-' + key, selected[key]); host.style.setProperty('--' + key, selected[key]); }
      themeRoot.style.setProperty('--theme-skin', selected.skin || selected.swatch || selected.accent);
      themeRoot.style.setProperty('--theme-skin-vertical', selected.skinVertical || selected.skin || selected.swatch || selected.accent);
      Object.assign(themeRoot.dataset, { uiTheme:selected.id, themeSkin:selected.skinMode === 'flat' ? 'flat' : 'gradient' });
      host.dataset.uiTheme = selected.id;
    }
    function syncThemeOwner() {
      const owner = menuThemeOwner();
      const deprioritized = Boolean(owner && owner !== host);
      host.dataset.expThemeDeprioritized = deprioritized ? '1' : '0';
      host.dataset.expThemeOwner = owner?.dataset.productId || id;
      paintTheme(deprioritized && menuPalette(owner) || localTheme);
    }
    function setTheme(value, supplied) {
      if (supplied) choices = supplied.map(t => semanticTheme({ ...t, ...t.vars, skin:t.skin || t.swatch, skinVertical:t.skinVertical || t.skin || t.swatch }));
      const alias = ({warm:'ember',discord:'glacier',pine:'verdant',obsidian:'contrast'})[value] || value;
      localTheme = choices.find(t => t.id === alias) || choices.at(-1);
      publishMenuPalette(host, localTheme);
      syncThemeOwner();
    }
    function clearTimer() { clearTimeout(timer); timer = 0; deadline = 0; }
    function scheduleDismiss() { clearTimer(); if (!open || getSettings().menuAutoClose === false) return; deadline = Date.now()+15000; timer = setTimeout(() => { if (open && Date.now() >= deadline) setOpen(false,false); },15020); }
    function layout() {
      if (destroyed || !launcher.isConnected) return;
      const state = getSettings(); const width = 'compact';
      host.dataset.menuWidth = width; themeRoot.dataset.panelWidth = width;
      themeRoot.classList.toggle('reduce-motion', state.reduceMotion === true || state.reduceMotion === 'on' || state.reducedMotion === 'reduce' || (state.reduceMotion === 'system' || state.reducedMotion === 'system') && matchMedia('(prefers-reduced-motion:reduce)').matches);
      const opacityValue = Number(state.opacityPercent);
      const opacity = state.customOpacity ? (Number.isFinite(opacityValue) ? Math.max(40, Math.min(100, Math.round(opacityValue / 5) * 5)) : 85)/100 : 1;
      themeRoot.style.setProperty('--exp-ui-opacity',String(opacity));
      const { top, right } = launcherPlacement(host);
      Object.assign(launcher.style,{top:top+'px',right:right+'px',bottom:'auto',left:'auto',zIndex:open?'2147483647':'2147483600'});
      panel.dataset.expMenuWidth = width;
      Object.assign(panel.style,{overflowY:'auto',overflowX:'hidden',overscrollBehavior:'contain',zIndex:open?'2147483647':'2147483599'});
      if (!open) return;
      placeMenu(host, panel, menuWidthForMode(width));
      menuNotices.forEach(notice=>notice.layout());
    }
    const arrangement = ExpMenuArrangement.mount({ panel, id, onChange: queueLayout, resetLaunchers() { resetLauncherGrid(id); queueLayout(); } });
    function queueLayout() { if (!frame && !destroyed) frame = requestAnimationFrame(() => { frame = 0; normalizeControls(panel); arrangement.update(); layout(); }); }
    removers.push(bindLauncherDrag(launcher, id, { layout }));
    for(const type of ['pointerdown','click','wheel','keydown','input','change'])on(panel,type,scheduleDismiss,{passive:type==='wheel'});
    on(window,'keydown',e=>{if(shortcutKey&&e.altKey&&e.shiftKey&&e.key.toLowerCase()===shortcutKey.toLowerCase()&&!e.repeat){e.preventDefault();setOpen(!open,true);} });
    on(window,'resize',queueLayout);on(document,'exp-core:coordination',queueLayout);
    on(document,'exp-core:coordination',syncThemeOwner);
    on(document,'exp-core:menu-open',()=>{if(open && document.documentElement.getAttribute('data-exp-open-menu')!==id)setOpen(false,false);});
    const resize = new ResizeObserver(queueLayout); resize.observe(panel);
    const mutation = new MutationObserver(records=>{if(records.some(r=>r.type==='childList'||r.attributeName==='hidden'))queueLayout();}); mutation.observe(panel,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
    const controller = {
      layout, setTheme,
      state(value) {open=Boolean(value);if(open){document.documentElement.setAttribute('data-exp-open-menu',id);document.dispatchEvent(new Event('exp-core:menu-open'));}panel.classList.toggle('fl-rail-open',open);menuNotices.forEach(notice=>notice.setMenuOpen(open));if(open)scheduleDismiss();else clearTimer();queueLayout();},
      update(){normalizeControls(panel);queueLayout();},
      get dismissAt(){return deadline;},
      destroy(){destroyed=true;arrangement.destroy();defaultSupport?.destroy();clearTimer();cancelAnimationFrame(frame);resize.disconnect();mutation.disconnect();menuNotices.forEach(notice=>notice.destroy());removers.forEach(f=>f());styles.dispose();controllers.delete(host);}
    };
    controllers.set(host,controller);setTheme(id);
    queueLayout();return controller;
  }
  function createReleaseUpdateChecker(options = {}) {
    const productId = String(options.productId || '').toLowerCase();
    const repository = String(options.repository || '');
    const resolveCurrentVersion = typeof options.currentVersion === 'function'
      ? () => String(options.currentVersion() || '')
      : () => String(options.currentVersion || '');
    const enabled = typeof options.enabled === 'function' ? options.enabled : () => true;
    const onError = typeof options.onError === 'function' ? options.onError : () => {};
    if (!productId || !repository) throw new Error('Incomplete update checker configuration');
    function getCurrentVersion() {
      const currentVersion = resolveCurrentVersion();
      if (!currentVersion) throw new Error('Update checker current version unavailable');
      return currentVersion;
    }

    const ENDPOINT = String(options.endpoint || ('https://api.github.com/repos/' + repository + '/releases/latest'));
    const CACHE_KEY = 'exp:v3:' + productId + ':update-cache';
    const CHECK_INTERVAL = 15 * 60 * 1000;
    const CHECK_LEASE = 30 * 1000;
    let memory = {};

    function readState() {
      try {
        if (typeof GM_getValue === 'function') {
          const value = GM_getValue(CACHE_KEY, null);
          if (value && typeof value === 'object' && !Array.isArray(value)) return { ...value };
        }
      } catch {}
      try {
        const value = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
        if (value && typeof value === 'object' && !Array.isArray(value)) return { ...value };
      } catch {}
      return { ...memory };
    }
    function writeState(value) {
      memory = { ...(value || {}) };
      try { if (typeof GM_setValue === 'function') GM_setValue(CACHE_KEY, memory); } catch {}
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(memory)); } catch {}
    }
    function releaseDetails(body) {
      const details = [];
      let section = false;
      for (const line of String(body || '').split(/\r?\n/)) {
        if (/^##\s+/.test(line)) { if (section) break; section = true; continue; }
        if (!section) continue;
        const match = line.match(/^\s*[-*]\s+(.+)/);
        if (!match) continue;
        const detail = match[1].replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[`*_]/g, '').trim();
        if (detail) details.push(detail.slice(0, 220));
        if (details.length === 4) break;
      }
      return details;
    }
    function normalize(state) {
      const next = { ...(state || {}) };
      if (!Object.hasOwn(next, 'lastCheckAt') && next.checkedAt) next.lastCheckAt = Number(next.checkedAt) || 0;
      if (!Object.hasOwn(next, 'lastRemoteVersion') && next.latest) next.lastRemoteVersion = String(next.latest || '');
      if (!Array.isArray(next.details)) next.details = [];
      return next;
    }
    function snapshot(state, stateName) {
      const currentVersion = getCurrentVersion();
      const next = normalize(state);
      const latest = String(next.lastRemoteVersion || '');
      return {
        checkedAt: Number(next.lastCheckAt || 0),
        latest: latest || null,
        state: stateName || next.state || 'idle',
        current: currentVersion,
        available: Boolean(latest && CoreFoundation.compareVersions(latest, currentVersion) > 0),
        details: next.details.slice(0, 4),
        checkedForVersion: next.checkedForVersion || null,
        lastRemoteVersion: latest || null,
        lastHttpStatus: Number(next.lastHttpStatus || 0),
        lastError: String(next.lastError || ''),
      };
    }
    function request() {
      return new Promise((resolve, reject) => {
        if (typeof GM_xmlhttpRequest !== 'function') return reject(Object.assign(new Error('Update request capability unavailable'), { code:'UPDATE_CAPABILITY' }));
        GM_xmlhttpRequest({
          method:'GET',
          url:ENDPOINT,
          timeout:10000,
          headers:{ Accept:'application/vnd.github+json', 'Cache-Control':'no-cache', Pragma:'no-cache' },
          onload(response) {
            if (response.status >= 200 && response.status < 300) return resolve(response);
            reject(Object.assign(new Error('Update metadata request failed'), { code:'UPDATE_HTTP_' + response.status, status:response.status }));
          },
          onerror:() => reject(Object.assign(new Error('Update metadata request failed'), { code:'UPDATE_NETWORK' })),
          ontimeout:() => reject(Object.assign(new Error('Update metadata request timed out'), { code:'UPDATE_TIMEOUT' })),
        });
      });
    }
    async function check(force = false) {
      const currentVersion = getCurrentVersion();
      let state = normalize(readState());
      if (!enabled() && !force) return snapshot(state, 'disabled');

      const now = Date.now();
      const checkedForCurrentVersion = state.checkedForVersion === currentVersion;
      if (!checkedForCurrentVersion) {
        state.checkedForVersion = currentVersion;
        state.lastCheckAt = 0;
        state.checkLeaseUntil = 0;
        state.lastRemoteVersion = '';
        state.lastHttpStatus = 0;
        state.lastError = '';
        state.details = [];
        state.availableVersion = '';
        state.availableAt = 0;
      }
      writeState(state);

      if (!force && Number(state.checkLeaseUntil || 0) > now) return snapshot(state, 'checking');
      if (!force && checkedForCurrentVersion && now - Number(state.lastCheckAt || 0) < CHECK_INTERVAL) return snapshot(state, 'cached');

      state.checkedForVersion = currentVersion;
      state.lastCheckAt = now;
      state.checkLeaseUntil = now + CHECK_LEASE;
      state.lastError = '';
      state.state = 'checking';
      writeState(state);

      try {
        const response = await request();
        const payload = JSON.parse(String(response.responseText || '{}'));
        const latest = String(payload.tag_name || '').replace(/^v/, '');
        if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(latest)) throw Object.assign(new Error('Invalid update metadata'), { code:'UPDATE_METADATA' });

        state = normalize(readState());
        state.checkedForVersion = currentVersion;
        state.lastCheckAt = Date.now();
        state.checkLeaseUntil = 0;
        state.lastRemoteVersion = latest;
        state.lastHttpStatus = Number(response.status || 0);
        state.lastError = '';
        state.details = releaseDetails(payload.body);
        state.state = 'checked';
        if (CoreFoundation.compareVersions(latest, currentVersion) > 0) {
          state.availableVersion = latest;
          state.availableAt = Date.now();
        } else {
          state.availableVersion = '';
          state.availableAt = 0;
        }
        writeState(state);
        return snapshot(state, 'checked');
      } catch (error) {
        state = normalize(readState());
        state.checkedForVersion = currentVersion;
        state.lastCheckAt = Date.now();
        state.checkLeaseUntil = 0;
        state.lastError = String(error?.message || 'Update check failed');
        state.state = 'failed';
        writeState(state);
        try { onError(error); } catch {}
        return snapshot(state, 'failed');
      }
    }
    function status() { return snapshot(readState()); }
    return Object.freeze({
      get CURRENT_VERSION() { return getCurrentVersion(); },
      ENDPOINT,
      CHECK_INTERVAL,
      check,
      status,
      compare: CoreFoundation.compareVersions,
    });
  }

  function createSupportControl({ url, label = 'Support' } = {}) {
    if (!url) return null;
    const wrapper = document.createElement('div');
    wrapper.className = 'support-wrap';
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'exp-support-button';
    button.className = 'support-button';
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', 'exp-support-popover');
    button.title = label;
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.2-4.35-9.55-8.45C.42 9.02 2.3 5 6.25 5c2.15 0 3.56 1.21 4.33 2.3C11.36 6.21 12.77 5 14.92 5c3.95 0 5.83 4.02 3.8 7.55C16.36 16.65 12 21 12 21Z"/></svg>';
    const popover = document.createElement('div');
    popover.id = 'exp-support-popover';
    popover.className = 'support-popover';
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-label', label);
    popover.hidden = true;
    const strong = document.createElement('strong');
    strong.textContent = label;
    const copy = document.createElement('span');
    copy.textContent = 'Donations are optional. All features stay free.';
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.textContent = 'Open Ko-fi';
    popover.append(strong, copy, anchor, ExtraPotionsTools.createBitcoinDonation());
    wrapper.append(button, popover);
    const toggle = event => {
      event?.stopPropagation?.();
      ExtraPotionsTools.placeDonationPanel(popover,button);
      popover.hidden = !popover.hidden;
      button.setAttribute('aria-expanded', String(!popover.hidden));
    };
    const outside = event => {
      if (popover.hidden || event.composedPath().includes(wrapper) || event.composedPath().includes(popover)) return;
      popover.hidden = true;
      button.setAttribute('aria-expanded', 'false');
    };
    button.addEventListener('click', toggle);
    document.addEventListener('pointerdown', outside, true);
    return Object.freeze({
      element: wrapper,
      button,
      popover,
      hide() { popover.hidden = true; button.setAttribute('aria-expanded', 'false'); },
      destroy() { button.removeEventListener('click', toggle); document.removeEventListener('pointerdown', outside, true); popover.remove(); wrapper.remove(); },
    });
  }

  function createProductNotice(options = {}) {
    const { host, shadow, panel, versionButton = null } = options;
    if (!(host instanceof Element) || !(shadow instanceof ShadowRoot) || !(panel instanceof Element)) {
      throw new Error('Product notice requires a mounted Core product');
    }
    const notice = document.createElement('div');
    notice.className = 'update-notice';
    notice.dataset.expUpdateNotice = '1';
    notice.hidden = true;
    notice.innerHTML = '<button type="button" class="update-dismiss" aria-label="Dismiss Update Notice">×</button><div class="update-head"><div class="update-heading"><div class="update-kicker">What\'s New</div><div class="update-title"></div></div><div class="update-version"></div></div><div class="update-text"></div><ul class="update-list"></ul><div class="update-footer"><a class="update-release" target="_blank" rel="noopener noreferrer">GitHub Release</a><a class="update-action" target="_blank" rel="noopener noreferrer">Install Update</a></div>';
    (shadow.querySelector('.exp-core-theme') || shadow).append(notice);
    const controller = createMenuNotice({
      host,
      shadow,
      panel,
      notice,
      versionButton: null,
      manageVersion: false,
      durationMs: options.durationMs ?? 30000,
    });
    function show(state = {}) {
      notice.querySelector('.update-kicker').textContent = state.kicker || "What's New";
      notice.querySelector('.update-title').textContent = state.title || '';
      notice.querySelector('.update-version').textContent = state.version ? 'v' + state.version : '';
      notice.querySelector('.update-text').textContent = state.text || '';
      const list = notice.querySelector('.update-list');
      list.replaceChildren();
      const details = Array.isArray(state.details) ? state.details.slice(0, 4) : [];
      for (const detail of details) {
        const item = document.createElement('li');
        item.textContent = detail;
        list.append(item);
      }
      list.hidden = !details.length;
      const release = notice.querySelector('.update-release');
      const releaseUrl = state.releaseUrl || options.releaseUrl || '';
      release.hidden = !releaseUrl;
      if (releaseUrl) release.href = releaseUrl;
      const action = notice.querySelector('.update-action');
      const actionUrl = state.actionUrl || options.installUrl || '';
      action.hidden = !actionUrl || state.showAction === false;
      if (actionUrl) action.href = actionUrl;
      action.textContent = state.actionText || 'Install Update';
      notice.dataset.noticeKind = state.kind || 'current';
      controller.setMenuOpen(!panel.hidden);
      controller.show();
    }
    const versionClick = () => {
      if (typeof options.onVersion === 'function') options.onVersion();
      else controller.toggle();
    };
    versionButton?.addEventListener('click', versionClick);
    return Object.freeze({
      element: notice,
      show,
      hide: controller.hide,
      toggle: controller.toggle,
      layout: controller.layout,
      setMenuOpen: controller.setMenuOpen,
      destroy() {
        versionButton?.removeEventListener('click', versionClick);
        controller.destroy();
        notice.remove();
      },
    });
  }

  function productCompatibilityReport() {
    const base = ExtraPotionsDiagnostics.compatibility();
    const interoperability = suiteHealth();
    const conflicts = [
      ...(Array.isArray(base.conflicts) ? base.conflicts : []),
      ...interoperability.conflicts,
    ];
    return Object.freeze({
      ...base,
      conflicts: Object.freeze(conflicts.map(conflict => Object.freeze({ ...conflict }))),
      status: conflicts.length ? 'conflicts-detected' : 'no-conflicts-observed',
      interoperability,
    });
  }

  function createSuiteCompatibilityControls() {
    const details = document.createElement('details');
    details.className = 'exp-tools-card';
    details.style.cssText = 'border:1px solid var(--theme-line,var(--line,#777));border-radius:7px;padding:7px;margin-top:8px';
    const summary = document.createElement('summary');
    summary.textContent = 'Product compatibility';
    const output = document.createElement('div');
    output.setAttribute('aria-live', 'polite');
    const refreshButton = document.createElement('button');
    refreshButton.type = 'button';
    refreshButton.className = 'life-btn action';
    refreshButton.textContent = 'Refresh compatibility';

    const refresh = () => {
      output.replaceChildren();
      const report = productCompatibilityReport();
      const suite = suiteSnapshot();
      const healthById = new Map(report.interoperability.products.map(product => [product.id, product]));
      if (!suite.products.length) {
        const empty = document.createElement('p');
        empty.textContent = 'No ExtraPotions products are registered on this page yet.';
        output.append(empty);
      }
      for (const product of suite.products) {
        const health = healthById.get(product.id);
        const line = document.createElement('p');
        const stateAge = health?.stateAgeMs == null ? '' : ` · state ${Math.max(0, Math.round(health.stateAgeMs / 1000))}s ago`;
        line.textContent = `${product.id.toUpperCase()} ${product.version} · Core ${product.coreVersion} · ${health?.status === 'healthy' ? 'Healthy' : 'Check compatibility'}${stateAge}`;
        output.append(line);
      }

      const observers = document.createElement('p');
      const page = pageObserverState();
      const navigation = navigationObserverState();
      observers.textContent = `Shared observers · DOM: ${page.active ? page.owner || 'active' : 'idle'} · Navigation: ${navigation.active ? navigation.owner || 'active' : 'idle'}`;
      output.append(observers);

      const status = document.createElement('p');
      status.textContent = report.conflicts.length
        ? report.conflicts.map(conflict => conflict.type).join(', ')
        : 'No interoperability conflicts detected on this page.';
      output.append(status);

      const note = document.createElement('small');
      note.textContent = 'Only products running on this page are shown. Shared suite state is advisory coordination data, not an authorization signal.';
      output.append(note);
    };

    details.addEventListener('toggle', () => { if (details.open) refresh(); });
    refreshButton.addEventListener('click', refresh);
    details.append(summary, output, refreshButton);
    return details;
  }

  function createDiagnosticsReport(product, details = {}) {
    const report = ExtraPotionsDiagnostics.createReport(product, details, { version, source: 'exp-core', sourceVersion });
    return {
      ...report,
      interoperability: {
        suite: suiteSnapshot(),
        presentation: {
          phases: { ...PRESENTATION_PHASES },
          providers: presentationProviders(),
        },
        pageObserver: pageObserverState(),
        navigationObserver: navigationObserverState(),
        states: suiteStateSnapshot(),
        health: suiteHealth(),
      },
    };
  }
  function downloadDiagnostics(report) {
    const name=`${String(report.report||'Diagnostics').toLowerCase().replace(/[^a-z0-9]+/g,'-')}-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
    const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return; } catch {}
    const area=document.createElement('textarea');area.value=text;area.style.cssText='position:fixed;left:-9999px';document.documentElement.append(area);area.select();const success=document.execCommand('copy');area.remove();if(!success)throw new Error('Clipboard unavailable');
  }
  function createDiagnosticsControls(getReport, notify = () => {}) { return ExtraPotionsDiagnostics.createControls(getReport, notify); }
  function createProduct({id,name,version:productVersion,subtitle='',artwork,theme,sections=[],getSettings,onSettings=()=>{},priority,supportUrl=SUPPORT_URL}) {
    const host=document.createElement('div');host.id='exp-'+id+'-root';host.dataset.expOwned='1';const shadow=host.attachShadow({mode:'open'});const panel=document.createElement('aside');panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label',name+' settings');
    const header=document.createElement('header');header.className='menu-head';const brand=document.createElement('div');brand.className='header-brand';const image=document.createElement('img');image.src=artwork;image.alt='';const copy=document.createElement('div');const titleRow=document.createElement('div');const title=document.createElement('strong');title.textContent=name;const v=document.createElement('button');v.type='button';v.className='version';v.textContent='v'+productVersion;titleRow.append(title,v);const sub=document.createElement('small');sub.textContent=subtitle;copy.append(titleRow,sub);brand.append(image,copy);const close=document.createElement('button');close.className='close';close.textContent='×';close.setAttribute('aria-label','Close '+name);const actions=document.createElement('div');actions.className='header-actions';const support=createSupportControl({url:supportUrl,label:'Support '+name});if(support)actions.append(support.element);actions.append(close);header.append(brand,actions);const divider=document.createElement('div');divider.className='header-divider';const nav=document.createElement('nav');
    let isOpen=false, activeId='';let chrome;
    const sectionMap=new Map();
    function renderSection(section,body){const content=section.render({core:api,onSettings});replaceMenuContent(body,content);chrome?.update();}
    function renderActive(){if(!activeId)return false;const entry=sectionMap.get(activeId);if(!entry||entry.body.hidden)return false;renderSection(entry.section,entry.body);return true;}
    function setOpen(value,focus=true){isOpen=Boolean(value);panel.hidden=!isOpen;launcher.setAttribute('aria-expanded',String(isOpen));if(isOpen){activeId='';nav.querySelectorAll('.route-body').forEach(n=>n.hidden=true);nav.querySelectorAll('button[data-section]').forEach(n=>n.setAttribute('aria-expanded','false'));}chrome.state(isOpen);if(focus)(isOpen?focusMenuSurface(panel):launcher.focus());}
    for(const section of sections){const group=document.createElement('section');group.className='tool-panel';const button=document.createElement('button');button.type='button';button.textContent=section.label;button.dataset.section=section.id;const body=document.createElement('div');body.className='route-body';body.hidden=true;sectionMap.set(section.id,{section,body,button});button.addEventListener('click',()=>{const opening=body.hidden;nav.querySelectorAll('.route-body').forEach(n=>n.hidden=true);nav.querySelectorAll('button[data-section]').forEach(n=>{n.classList.toggle('last-opened',n===button);n.setAttribute('aria-expanded',String(opening&&n===button));});body.hidden=!opening;activeId=opening?section.id:'';if(opening)renderSection(section,body);chrome.update();});group.append(button,body);nav.append(group);}
    const launcher=document.createElement('button');launcher.className='launcher';launcher.type='button';launcher.setAttribute('aria-label','Open '+name);const mark=image.cloneNode(true);launcher.append(mark);launcher.addEventListener('click',()=>setOpen(!isOpen));close.addEventListener('click',()=>setOpen(false));panel.append(header,divider,nav);shadow.append(panel,launcher);document.documentElement.append(host);chrome=create({id,host,shadow,panel,launcher,getSettings,setOpen,productTheme:theme,supportUrl});const unregister=registerLauncher(host,{productId:id,priority});
    const key=e=>{if(e.key==='Escape'&&isOpen)setOpen(false);};document.addEventListener('keydown',key);
    return {host,shadow,panel,launcher,versionButton:v,open:()=>setOpen(true),close:()=>setOpen(false),toggle:()=>setOpen(!isOpen),refresh:()=>chrome.update(),renderActive,get isOpen(){return isOpen;},destroy(){document.removeEventListener('keydown',key);support?.destroy();chrome.destroy();unregister();host.remove();}};
  }
  let gridFrame=0;
  const scheduleGrid=()=>{if(!gridFrame)gridFrame=requestAnimationFrame(()=>{gridFrame=0;layoutGrid();});};
  const gridObserver=new MutationObserver(scheduleGrid);
  const startGrid=()=>{if(!document.documentElement)return;gridObserver.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['data-exp-product-launcher','data-product-id','data-launcher-priority','data-launcher-reserved-rows']});scheduleGrid();};
  if(document.documentElement)startGrid();else addEventListener('DOMContentLoaded',startGrid,{once:true});
  document.addEventListener('exp-core:coordination',scheduleGrid);
  document.addEventListener('exp-core:menu-open', raiseOpenMenuHost);
  addEventListener('resize',scheduleGrid,{passive:true});
  // Core-owned product bootstrap for downstream consumers.
  function createProductServices(options = {}) {
    const productId = String(options.productId || '').toLowerCase();
    const repository = String(options.repository || '');
    const currentVersion = options.currentVersion;
    if (!productId || !repository || (typeof currentVersion !== 'function' && !String(currentVersion || ''))) {
      throw new Error('Incomplete product services configuration');
    }
    const lifecycle = createProductLifecycle(api);
    const diagnostics = Object.freeze({
      createDiagnosticsReport,
      downloadDiagnostics,
      createDiagnosticsControls,
    });
    const updates = createReleaseUpdateChecker({
      productId,
      repository,
      currentVersion,
      endpoint: options.endpoint,
      enabled: options.enabled,
      onError: options.onError,
    });
    return Object.freeze({ lifecycle, diagnostics, updates });
  }

  const api = Object.freeze({...ExtraPotionsTools,version,sourceVersion,protocol,gridProtocol,reference:CoreFoundation,css:canonicalCss,themes,create,createProduct,createSupportControl,createProductNotice,createLifecycle:()=>createProductLifecycle(api),createProductServices,registerLauncher,bindLauncherDrag,launcherPlacement,placeMenu,placeNotice,resetLauncherGrid,layout:layoutGrid,replaceMenuContent,createDisclosure,createSystemGrid,isOwnedSheet,menuWidthForMode,cloneSettings,applyTextGradient,injectStyle,applyTheme,applyMatteToggleChrome,applyTwoColumnSettingsGrid,applyContentDrivenMenuLayout,createThemeSwatches,publishMenuPalette,createFloatingNotice,createMenuNotice,createReleaseUpdateChecker,registerFloatingNotice,layoutFloatingNotices,claimNotice,consumeVersionChange,focusMenuSurface,registerDiagnosticsProduct,registerSuiteProduct,suiteContract,suiteSnapshot,hasProductCapability,capabilityProviders,emitSuiteEvent,publishSuiteState,suiteStateSnapshot,latestSuiteState,subscribeSuiteState,onSuiteEvent,pageContext,observeNavigation,navigationObserverState,suiteTrust:SUITE_TRUST,registerPresentationProvider,presentationProviders,suiteHealth,readPresentationState,setPresentationState,clearPresentationState,presentationStateChain,isPresentationSuppressed,presentationPhases:PRESENTATION_PHASES,presentationChannels:PRESENTATION_CHANNELS,observePresentationState,observePage,observePageBatch,pageObserverState,suiteProducts:SUITE_PRODUCTS,suitePriority:SUITE_PRIORITY,productCompatibility:productCompatibilityReport,createCompatibilityControls:createSuiteCompatibilityControls,bindDiagnosticsControls:ExtraPotionsDiagnostics.bindControls,createDiagnosticsReport,downloadDiagnostics,createDiagnosticsControls,mountMenuArrangement:ExpMenuArrangement.mount,menuCategories:ExpMenuArrangement.categories,categorizeMenuSections:ExpMenuArrangement.describe,createMenuCategoryDisclosure:(label,category,...contents)=>ExpMenuArrangement.createDisclosure({document,label,category,contents}),collapseMenuSubmenus:ExpMenuArrangement.collapseSubmenus,compareVersions:CoreFoundation.compareVersions});
  return api;
})();
