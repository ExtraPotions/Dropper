// ==UserScript==
// @name         Dropper for Twitch
// @namespace    twitch-drops-helper
// @version      4.0.2
// @description  A browser-only Twitch companion for the streams you choose to watch: track credited reward progress, manage campaigns, and collect earned rewards.
// @icon         https://raw.githubusercontent.com/ExtraPotions/Dropper/main/assets/dropper-launcher.svg
// @homepageURL  https://github.com/ExtraPotions/Dropper
// @supportURL   https://github.com/ExtraPotions/Dropper/issues
// @updateURL    https://github.com/ExtraPotions/Dropper/releases/latest/download/dropper.user.js
// @downloadURL  https://github.com/ExtraPotions/Dropper/releases/latest/download/dropper.user.js
// @tag          Twitch
// @tag          Drops
// @tag          Rewards
// @author       expDARE
// @license      PolyForm-Noncommercial-1.0.0
// @match        https://www.twitch.tv/*
// @match        https://player.twitch.tv/*
// @match        https://embed.twitch.tv/*
// @run-at       document-start
// @noframes
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @connect      gql.twitch.tv
// @connect      api.github.com
// ==/UserScript==


// Dropper Manager Metadata
// Description: Track Twitch-credited progress, collect free earned rewards, and manage campaigns while respecting your playback and stream choices.
// Tags: Twitch, Drops, Rewards


(function twitchDropsHelper() {
  "use strict";

  // Dropper owns one top-level Twitch page; player and embed frames would duplicate its work.
  if (window.top !== window.self) return;

  // BEGIN EXP CORE
// Native exp-core foundation. Shared UI primitives are owned and maintained here.
const CoreFoundation = (() => {
const THEME_MODES = Object.freeze(['light', 'dark', 'system']);
const normalizeThemeMode = value => THEME_MODES.includes(value) ? value : 'system';
const systemThemeMode = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
const SLATE_BLUE = Object.freeze({
  light: Object.freeze({bg:'#f4f6fa',panel:'#ffffff',raised:'#e6ecf5',inset:'#edf1f7',line:'#718096',text:'#182230',muted:'#4c5d73',accent:'#2459b8',accent2:'#2459b8',link:'#2459b8',focus:'#2459b8',onAccent:'#ffffff'}),
  dark: Object.freeze({bg:'#111720',panel:'#1b2430',raised:'#283547',inset:'#0c121a',line:'#8293ab',text:'#edf2f8',muted:'#afbed1',accent:'#8cb7ff',accent2:'#8cb7ff',link:'#8cb7ff',focus:'#8cb7ff',onAccent:'#111720'}),
});
// Menus use charcoal neutrals with each product's own colour; store recolouring keeps Slate Blue.
const CHARCOAL = Object.freeze({
  light: Object.freeze({bg:'#dcdad7',panel:'#ebe9e6',raised:'#d2cfcb',inset:'#d8d5d1',line:'#86807a',text:'#1c1a19',muted:'#57524d',onAccent:'#ffffff'}),
  dark: Object.freeze({bg:'#141416',panel:'#1d1d20',raised:'#29292d',inset:'#0f0f11',line:'#6c6c74',text:'#ececee',muted:'#a8a8ae',onAccent:'#141416'}),
});
// Each product's badge colour, tuned to 4.5:1 on the panel in that mode.
const PRODUCT_ACCENTS = Object.freeze({
  dropper: Object.freeze({light:'#862ff1',dark:'#a869f5'}),
  ward: Object.freeze({light:'#0d7246',dark:'#1fbf7a'}),
  thread: Object.freeze({light:'#bd3300',dark:'#ff4500'}),
});
function productPalette(product, mode) {
  const accent = PRODUCT_ACCENTS[product]?.[mode];
  return accent ? {...CHARCOAL[mode],accent,accent2:accent,link:accent,focus:accent} : SLATE_BLUE[mode];
}
function resolveTheme(value, product = '') {
  const id=normalizeThemeMode(value),mode=id==='system'?systemThemeMode():id,p=productPalette(product,mode);
  return {...p,id,mode,name:id[0].toUpperCase()+id.slice(1),swatch:p.accent,canvas:p.bg,surface:p.panel,primary:p.accent,companion:p.accent,counterpoint:p.accent,interactive:p.accent,skin:p.accent,skinVertical:p.accent,skinMode:'flat'};
}
const UI_THEMES = Object.freeze(THEME_MODES.map(id=>Object.freeze(resolveTheme(id))));
const SHARED_UI_THEMES = UI_THEMES;

// A support control carries these styles into native and custom Shadow DOM shells.
function supportControlCss() {
    return `
      .support-wrap { position:static; }
      .support-button {
        width:30px; height:30px; min-width:30px; padding:0;
        border:1px solid var(--theme-line); border-radius:8px; background:var(--theme-panel); color:var(--theme-muted);
        cursor:pointer;
      }
      .support-button { box-sizing:border-box; display:grid; place-items:center; }
      .support-button svg { width:15px; height:15px; fill:currentColor; }
      .support-button:hover,
      .support-button:focus-visible {
        border-color:var(--theme-accent); color:var(--theme-accent2); background:var(--theme-raised); outline:none;
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
      .support-popover strong { display:block; margin-bottom:3px; font-size:var(--exp-font-size-small,11px); }
      .support-popover span { display:block; color:var(--theme-muted); font-size:var(--exp-font-size-small,11px); line-height:1.35; }
      .support-popover a {
        display:flex; align-items:center; justify-content:center; min-height:26px; margin-top:7px; padding:0 9px;
        border:1px solid color-mix(in srgb,var(--theme-accent) 58%,var(--theme-line));
        border-radius:7px; background:color-mix(in srgb,var(--theme-panel) 76%,var(--theme-accent) 24%);
        color:var(--theme-text); text-decoration:none; font-size:var(--exp-font-size-small,11px); font-weight:800;
      }
      .support-popover a:hover,
      .support-popover a:focus-visible {
        border-color:var(--theme-accent2); outline:none;
        background:color-mix(in srgb,var(--theme-panel) 66%,var(--theme-accent) 34%);
      }
    `;
}

function css() {
    return `
      :host { all: initial; --exp-font-size-small:11px; --exp-font-size-body:13px; }
      * { box-sizing: border-box; }
      small { font-size:var(--exp-font-size-small,11px); }
      .exp-core-theme {
        position: fixed; right: 12px; z-index: 2147483600;
        display: flex; flex-direction: column-reverse; align-items: flex-end;
        width: max-content; max-width: calc(100vw - 24px); gap: 8px;
        --exp-ui-opacity:1; --exp-menu-width:260px;
        font: 13px/1.42 ui-sans-serif, system-ui, "Segoe UI", sans-serif; color: var(--theme-text);
      }
      .exp-core-theme.open-up { flex-direction: column; }
      [data-exp-part="dock"],
      .update-notice {
        opacity:var(--exp-ui-opacity,1);
        transition:opacity .15s ease;
      }
      .exp-core-theme [data-exp-part="dock"],
      .exp-core-theme > .update-notice[data-placement="menu"] {
        width:min(var(--exp-menu-width,260px), calc(100vw - 24px));
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
      .stream-subsection-label{grid-column:1/-1;min-width:0;margin:1px 0 2px;color:var(--theme-accent2);font-size:var(--exp-font-size-small,11px);font-weight:900;line-height:1.2;letter-spacing:.08em;text-transform:uppercase}
      .stream-subsection-label.with-divider{margin-top:7px;padding-top:8px;border-top:1px solid var(--theme-line,#34343b)}
      .queue-switches{display:grid;grid-template-columns:minmax(58px,.7fr) minmax(0,1.3fr);column-gap:10px;row-gap:0;min-width:0;margin:6px 0;padding:2px 0;border:0;align-items:stretch}
      .queue-switches-label{grid-column:1;grid-row:1/span 3;display:flex;align-items:center;min-width:0;font-size:var(--exp-font-size-body,13px);font-weight:700;line-height:1.2;color:var(--theme-text,#efeff1)}
      .queue-switches>.fl-switch{grid-column:2;display:flex!important;flex-direction:row!important;align-items:center!important;justify-content:space-between!important;gap:10px;min-width:0;padding:5px 0!important;text-align:left!important}
      .queue-switches>.fl-switch>span:first-child{display:block;flex:1 1 auto;width:auto!important;min-width:0!important;min-height:0!important;white-space:normal!important;word-break:normal!important;overflow-wrap:normal!important;line-height:1.25;text-align:left}
      .queue-switches>.fl-switch>.toggleSwitch{flex:0 0 34px;margin-left:auto}
      .appearance-separator{grid-column:1/-1;width:100%;border:0;border-top:1px solid var(--theme-line,#34343b);margin:3px 0 1px}

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
        border:2px solid var(--theme-panel,#18181b); border-radius:4px; background:#f59e0b; color:#111114; font-size:var(--exp-font-size-small,11px); font-weight:950;
        box-shadow:0 2px 6px #0007; z-index:4; pointer-events:none;
      }
      [data-exp-part="launcher"] .ring { position:absolute; top:50%; left:50%; width:44px; height:44px; pointer-events:none; transform:translate(-50%,-50%); }
      [data-exp-part="launcher"] .track { fill:none; stroke:color-mix(in srgb,var(--theme-line,#34343b) 72%,transparent); stroke-width:2.5; }
      [data-exp-part="launcher"] .fill { fill:none; stroke:var(--theme-accent,#9147ff); stroke-width:2.5; stroke-linecap:round; transition:.2s stroke; }
      [data-exp-part="launcher"] .icon { position:absolute; top:50%; left:50%; width:40px; height:40px; pointer-events:none; z-index:1; transform:translate(-50%,-50%); }
      [data-exp-part="dock"] {
        position:fixed; right:12px; top:auto; bottom:auto;
        display:none; width:min(var(--exp-menu-width,260px), calc(100vw - 24px)); max-width:calc(100vw - 24px);
        height:max-content; min-height:0; max-height:none; overflow-x:hidden; overflow-y:auto; overscroll-behavior:contain; flex:0 0 auto;
        transition:.15s width;
        padding:9px 9px 4px; background:var(--theme-bg); border:1px solid var(--theme-line); border-radius:14px; box-shadow:0 18px 50px #0008;
      }
      [data-exp-part="dock"].fl-rail-open { display:block; height:max-content; min-height:0; max-height:none; }
      [data-exp-part="dock"]:focus { outline:none; }
      [data-exp-part="dock"] :is(.fl-tool-body,.row,.group,.section,.fl-tool-title) { min-width:0; max-width:100%; overflow-wrap:anywhere; }
      [data-exp-part="dock"] :is(input,select,textarea) { min-width:0; max-width:100%; }
      [data-exp-part="dock"] :is(option,optgroup) { background:var(--theme-panel) !important; color:var(--theme-text) !important; }
      .menu-head {
        position:relative;
        display:grid; grid-template-columns:minmax(0,1fr) auto;
        align-items:start; gap:8px; width:100%;
      }
      .header-actions { display:flex; align-items:flex-start; gap:5px; position:static; }
      [data-exp-part="close"] {
        width:30px; height:30px; min-width:30px; padding:0;
        border:1px solid #3a3a42; border-radius:8px; background:#151519; color:#b8b8c0;
        cursor:pointer;
      }
      ${supportControlCss()}
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
        background:#1b1721; color:#c9a7ff; cursor:pointer; font:800 var(--exp-font-size-small,11px)/1 ui-sans-serif,system-ui,sans-serif;
        white-space:nowrap;
      }
      [data-exp-part="version"]:hover,
      [data-exp-part="version"]:focus-visible {
        border-color:#9147ff; background:#251d31; color:#fff; outline:none;
      }
      [data-exp-part="subtitle"] {
        margin-top:2px; font-size:var(--exp-font-size-small,11px); line-height:1.2; color:#adadb8;
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
      .update-kicker { margin-bottom:2px; color:var(--theme-accent2); font-size:var(--exp-font-size-small,11px); font-weight:900; letter-spacing:.08em; text-transform:uppercase; }
      .update-title { font-size:var(--exp-font-size-body,13px); line-height:1.25; font-weight:850; color:var(--theme-text); }
      .update-version {
        flex:none; padding:2px 6px;
        border:1px solid color-mix(in srgb,var(--theme-accent) 62%,var(--theme-line));
        border-radius:5px;
        background:color-mix(in srgb,var(--theme-panel) 82%,var(--theme-accent) 18%);
        color:var(--theme-text);
        font-size:var(--exp-font-size-small,11px); font-weight:800; white-space:nowrap;
      }
      .update-text { margin-top:6px; font-size:var(--exp-font-size-small,11px); line-height:1.45; color:var(--theme-muted); white-space:normal; overflow:visible; }
      .update-list { margin:7px 0 0; padding:0 0 0 15px; color:var(--theme-text); font-size:var(--exp-font-size-small,11px); line-height:1.4; scrollbar-width:thin; }
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
      .update-release { min-height:27px; padding:0 10px; font-size:var(--exp-font-size-small,11px); font-weight:800; }
      .update-action,
      .update-release { display:inline-flex; align-items:center; justify-content:center; text-decoration:none; }
      /* The release control is a link in the shared notice; it reads as a button, not as link text. */
      .exp-core-theme a.update-release { color:var(--theme-text); text-decoration:none; }
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
        border-color:transparent; background:transparent; color:var(--theme-muted); font-family:Arial,sans-serif; font-size:15px; line-height:1;
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
      .toast { margin-bottom:7px; padding:6px 8px; border:1px solid #34343b; border-radius:8px; background:#18181b; color:#efeff1; font-size:var(--exp-font-size-small,11px); box-shadow:0 8px 24px #0006; }
      .toast[hidden] { display:none; }
      .fl-tool-panel { position:relative; margin-top:5px; border:1px solid #27272d; background:#19191e; border-radius:9px; overflow:visible; }
      .fl-tool-header { display:flex; justify-content:space-between; align-items:flex-start; height:auto; min-height:0; padding:7px 8px; cursor:pointer; border-radius:8px; }
      .fl-tool-header:hover { background:#9147ff18; }
      .fl-tool-header.last-opened { box-shadow:inset 3px 0 0 #b783ff; }
      .fl-tool-title { min-width:0; flex:1; font-size:var(--exp-font-size-body,13px); font-weight:700; white-space:normal; overflow-wrap:anywhere; }
      .fl-tool-chevron { background:none; border:0; color:#adadb8; cursor:pointer; }
      .fl-tool-body { padding:0 10px 8px; }
      .fl-tool-body:not(.fl-tool-hidden) { display:grid; height:auto; min-height:0; max-height:none; overflow:visible; grid-template-columns:repeat(2,minmax(0,1fr)); align-items:stretch; column-gap:8px; }
      .exp-core-theme .fl-tool-body:not(.fl-tool-hidden) { grid-template-columns:minmax(0,1fr); }
      .exp-core-theme .fl-tool-body:not(.fl-tool-hidden) > * { grid-column:1/-1; }
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
        font-size:var(--exp-font-size-body,13px);
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
      .life-btn { width:100%; min-height:28px; margin-top:6px; font-size:var(--exp-font-size-body,13px); }
      .life-btn.last-opened { box-shadow:inset 3px 0 0 #b783ff; }
      .select-lite { min-width:0; max-width:72px; background:#111114; color:#efeff1; border:1px solid #34343b; border-radius:6px; padding:4px 6px; font-size:var(--exp-font-size-body,13px); }
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
        font-size:var(--exp-font-size-small,11px);
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
      .auth-advanced > summary { cursor:pointer; list-style:none; color:var(--theme-muted); font-size:var(--exp-font-size-body,13px); font-weight:600; user-select:none; }
      .auth-advanced > summary::-webkit-details-marker { display:none; }
      .auth-advanced[open] > summary { margin-bottom:6px; color:var(--theme-text); }
      .auth-advanced-body { display:flex; flex-direction:column; gap:6px; }
      .auth-hint { color:var(--theme-muted); font-size:var(--exp-font-size-small,11px); line-height:1.35; }
      .auth-input { width:100%; min-height:30px; border:1px solid var(--theme-line); border-radius:6px; background:var(--theme-inset); color:var(--theme-text); padding:6px 8px; font-size:var(--exp-font-size-body,13px); }
      .auth-input:focus { outline:2px solid var(--theme-focus); outline-offset:2px; border-color:var(--theme-focus); }
      .theme-row { grid-column:1/-1; display:flex; align-items:center; justify-content:space-between; gap:10px; min-height:28px; padding:6px 0; font-size:var(--exp-font-size-body,13px); }
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
      .exp-core-theme[data-ui-theme="warm"] [data-exp-part="dock"]:not([data-exp-menu-layout="lean"]) {
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
      .campaign-manager-title { min-width:0; font-size:var(--exp-font-size-body,13px); font-weight:800; color:var(--theme-text); }
      .campaign-manager-summary { flex:0 0 auto; font-size:var(--exp-font-size-small,11px); font-weight:700; color:var(--theme-muted); }
      .campaign-manager-note { padding:6px 8px 3px; font-size:var(--exp-font-size-small,11px); line-height:1.35; color:var(--theme-muted); }
      .diag { display:none; box-sizing:border-box;width:100%;min-width:0;height:160px;max-height:160px;overflow:auto;overscroll-behavior:contain;overflow-wrap:anywhere;box-shadow:inset 0 2px 6px #0006; margin-top:6px; padding:7px; border:1px solid #2b2b31; border-radius:7px; background:#101014; font:var(--exp-font-size-small,11px)/1.45 ui-monospace,SFMono-Regular,Consolas,monospace; color:#b8b8c0; white-space:pre-wrap; }
      .diag.open { display:block; }
      .has-tooltip { position:relative; }
      .has-tooltip::after { content:attr(data-tip); position:absolute; left:0; top:calc(100% + 4px); width:min(190px, calc(100vw - 48px)); max-width:100%; padding:6px 8px; border:1px solid #3b3b44; border-radius:7px; background:#0e0e10; color:#efeff1; box-shadow:0 6px 18px #0007; box-sizing:border-box; font-size:var(--exp-font-size-small,11px); line-height:1.35; white-space:normal; overflow-wrap:anywhere; opacity:0; pointer-events:none; z-index:999; transform:translateY(-2px); transition:.12s opacity,.12s transform; }
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
    // Semantic version order: a leading "v" and build metadata are ignored, and a pre-release sorts below its release.
    const parse = (value) => {
      const [core, pre] = String(value || '').trim().replace(/^v/i, '').split('+')[0].split(/-(.*)/s);
      return { core: core.split('.').slice(0, 3).map((part) => parseInt(part, 10) || 0), pre: pre ? pre.split('.') : [] };
    };
    const pa = parse(a), pb = parse(b);
    for (let i = 0; i < 3; i += 1) {
      const na = pa.core[i] || 0, nb = pb.core[i] || 0;
      if (na !== nb) return na > nb ? 1 : -1;
    }
    if (!pa.pre.length || !pb.pre.length) return pa.pre.length === pb.pre.length ? 0 : pa.pre.length ? -1 : 1;
    for (let i = 0; i < Math.max(pa.pre.length, pb.pre.length); i += 1) {
      const x = pa.pre[i], y = pb.pre[i];
      if (x === undefined || y === undefined) return x === undefined ? -1 : 1;
      if (x === y) continue;
      const nx = /^\d+$/.test(x), ny = /^\d+$/.test(y);
      if (nx && ny) return Number(x) > Number(y) ? 1 : -1;
      if (nx !== ny) return nx ? -1 : 1;
      return x > y ? 1 : -1;
    }
    return 0;
  }
return Object.freeze({ THEME_MODES, SLATE_BLUE, CHARCOAL, PRODUCT_ACCENTS, normalizeThemeMode, resolveTheme, UI_THEMES, SHARED_UI_THEMES, css, supportControlCss, protectLauncherHost, compareVersions });
})();

/* Local diagnostic capture shared at build time by ExtraPotions products. */
const ExtraPotionsDiagnostics = (() => {
  const LIMIT = 100;
  const supportedProducts = ["thread","dropper","ward"];
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
  const RESOURCE_INITIATOR_TYPES = new Set(['audio','beacon','css','embed','fetch','font','iframe','img','link','navigation','object','ping','script','track','video','xmlhttprequest','other']);
  const resourceInitiatorType = value => {
    const type = String(value || '').trim().toLowerCase();
    return RESOURCE_INITIATOR_TYPES.has(type) ? type : 'other';
  };
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
        const safeKey = redact(key);
        if (item !== undefined && safeKey) result[safeKey] = item;
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
  // Diagnostics: the hardest-to-read text on screen and what covers the page, so a washed-out site can be
  // diagnosed from a copied report. Records colors and element names only, never page text.
  function readabilityScan({limit=25,budget=6000}={}){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const context=canvas.getContext('2d',{willReadFrequently:true});
    const rgba=color=>{context.clearRect(0,0,1,1);context.fillStyle='#000';context.fillStyle=color;context.fillRect(0,0,1,1);return [...context.getImageData(0,0,1,1).data].map(n=>n/255);};
    const channel=v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4,luminance=c=>.2126*channel(c[0])+.7152*channel(c[1])+.0722*channel(c[2]);
    const up=node=>node.parentElement||node.getRootNode?.().host||null;
    const css=color=>'rgb('+color.slice(0,3).map(v=>Math.round(v*255)).join(', ')+')';
    const name=node=>({tag:node.tagName.toLowerCase(),id:node.id?String(node.id).slice(0,40):'',cls:String(node.className?.baseVal??node.className??'').slice(0,80),host:node.getRootNode?.().host?.tagName.toLowerCase()||''});
    const backdrop=node=>{const layers=[];for(let n=node;n;n=up(n)){const c=rgba(getComputedStyle(n).backgroundColor);if(c[3]>0)layers.push(c);if(c[3]>=.99)break;}return layers.reduceRight((base,c)=>base.map((v,i)=>c[i]*c[3]+v*(1-c[3])),[1,1,1]);};
    const nodes=[];const walk=root=>{for(const node of root.querySelectorAll('*')){if(nodes.length>=budget)return;if(node.closest('[data-exp-owned="1"]')||node.id?.startsWith('exp-'))continue;nodes.push(node);if(node.shadowRoot)walk(node.shadowRoot);}};
    walk(document);
    const rows=[];
    for(const node of nodes){
      const text=[...node.childNodes].reduce((sum,child)=>sum+(child.nodeType===3?child.textContent.trim().length:0),0);
      if(!text)continue;
      const box=node.getBoundingClientRect();
      if(!box.width||!box.height||box.bottom<0||box.top>innerHeight*2)continue;
      const style=getComputedStyle(node),fg=rgba(style.color),bg=backdrop(node),mixed=fg.slice(0,3).map((v,i)=>v*fg[3]+bg[i]*(1-fg[3]));
      const a=luminance(mixed),b=luminance(bg);
      rows.push({ratio:Math.round((Math.max(a,b)+.05)/(Math.min(a,b)+.05)*100)/100,...name(node),textLength:text,color:style.color,background:css(bg),opacity:style.opacity,
        ...(style.filter!=='none'?{filter:style.filter}:{})});
    }
    rows.sort((x,y)=>x.ratio-y.ratio);
    const layer=node=>{const style=getComputedStyle(node);return {...name(node),background:style.backgroundColor,opacity:style.opacity,position:style.position,...(style.filter!=='none'?{filter:style.filter}:{}),...(style.backdropFilter&&style.backdropFilter!=='none'?{backdropFilter:style.backdropFilter}:{}),...(style.mixBlendMode!=='normal'?{blend:style.mixBlendMode}:{})};};
    const points=[[.5,.4],[.1,.4],[.5,.85]].map(([x,y])=>{
      const px=Math.round(innerWidth*x),py=Math.round(innerHeight*y);
      const stack=document.elementsFromPoint(px,py).filter(node=>!node.closest('[data-exp-owned="1"]')).slice(0,6).map(layer);
      let root=document,deepest=null;for(let i=0;i<20;i++){const hit=root.elementFromPoint(px,py);if(!hit||hit===deepest)break;deepest=hit;if(!hit.shadowRoot)break;root=hit.shadowRoot;}
      const chain=[];for(let n=deepest;n&&chain.length<10;n=up(n))chain.push(layer(n));
      return {x:px,y:py,stack,chain};
    });
    // Click-through layers (pointer-events:none) never show up at a point, so list large painted layers too.
    const overlays=[];
    for(const node of nodes){
      if(overlays.length>=8)break;
      const style=getComputedStyle(node);if(style.position!=='fixed'&&style.position!=='absolute'&&style.position!=='sticky')continue;
      const box=node.getBoundingClientRect(),area=Math.max(0,Math.min(box.right,innerWidth)-Math.max(box.left,0))*Math.max(0,Math.min(box.bottom,innerHeight)-Math.max(box.top,0));
      if(area<innerWidth*innerHeight*.5)continue;
      const painted=rgba(style.backgroundColor)[3]>0||style.filter!=='none'||(style.backdropFilter&&style.backdropFilter!=='none')||style.mixBlendMode!=='normal';
      if(painted)overlays.push({...layer(node),coverage:Math.round(area/(innerWidth*innerHeight)*100)/100,pointerEvents:style.pointerEvents,zIndex:style.zIndex});
    }
    return {scanned:nodes.length,truncated:nodes.length>=budget,viewport:{width:innerWidth,height:innerHeight},colorScheme:getComputedStyle(document.documentElement).colorScheme,worst:rows.slice(0,limit),overlays,points};
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
      const summary = byType[resourceInitiatorType(entry.initiatorType)] ||= { count: 0, durationMs: 0, transferBytes: 0 };
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
      menuSizing: 'viewport-clamped',
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
      technical: { manager, core: clean(core), capabilities: { mutationObserver: typeof MutationObserver === 'function', constructedStylesheets: typeof CSSStyleSheet === 'function' && 'replaceSync' in CSSStyleSheet.prototype, clipboard: !!navigator.clipboard, trustedTypes: !!globalThis.trustedTypes } },
      console: { startedAt, scope: 'accessible-userscript-realm-and-window-events', limit: LIMIT, omitted, hooks: hooks.map(h => ({ level: h.level, installed: console[h.level] === h.wrapped })), entries: clean(entries), limitations: ['No DevTools history, browser-internal logs, or inaccessible isolated-world console messages.', 'Messages are redacted and bounded; attribution to another script is not inferred.'] },
      // Product state is reported once, at the top level of the report.
      plugin: { id, version: data.product?.version || data.version || registration?.dataset.expProductVersion || null, stateLocation: 'top-level', compatibility: compatibility() },
      environment, ui, core: data.core || clean(core),
      readability: data.readability || (() => { try { return readabilityScan(); } catch (error) { return { error: String(error?.message || error) }; } })() };
  }
  function dispose() {
    active = false;
    for (const {level, original, wrapped} of hooks) if (console[level] === wrapped) console[level] = original;
    removeEventListener('error', onError, true); removeEventListener('unhandledrejection', onRejection);
    for (const marker of registrations.values()) marker.remove();
  }
  // Core owns the shared diagnostics interaction contract: Show/Hide first, Copy second,
  // transient Diagnostics Copied / Copy Failed feedback, and fresh reports per action.
  // The report behind each set of controls, so Report a Problem can attach a fresh one.
  const reportSources = new WeakMap();
  function reportSource(container) {
    if (!container) return null;
    if (reportSources.has(container)) return reportSources.get(container);
    for (const node of container.querySelectorAll?.('*') || []) if (reportSources.has(node)) return reportSources.get(node);
    return null;
  }
  function bindControls({ show, copy, output, getReport, notify = () => {}, onShow = () => {}, onCopy = () => {} }) {
    let timer, generation = 0;
    reportSources.set(output, getReport); reportSources.set(copy, getReport);
    output.hidden = true; output.setAttribute('role', 'region');
    output.setAttribute('aria-label', 'Page, technical, console, and plugin diagnostics'); output.tabIndex = 0;
    show.setAttribute('aria-expanded', 'false');
    // Short visible labels beside a Diagnostics row label; the full action stays in the accessible name.
    const name = (node, text, label) => { node.textContent = text; node.setAttribute('aria-label', label); };
    name(show, 'Show', 'Show Diagnostics'); name(copy, 'Copy', 'Copy Diagnostics');
    const showClick = async () => {
      const opening = output.hidden, ticket = ++generation;
      output.hidden = !opening; output.classList.toggle('open', opening);
      if (opening) name(show, 'Hide', 'Hide Diagnostics'); else name(show, 'Show', 'Show Diagnostics');
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
        name(copy, 'Copied', 'Diagnostics copied'); onCopy();
      } catch { name(copy, 'Failed', 'Copy failed'); notify('Could not copy diagnostics. Use Show.'); }
      finally { copy.disabled = false; timer = setTimeout(() => { name(copy, 'Copy', 'Copy Diagnostics'); }, 1600); }
    };
    show.addEventListener('click', showClick); copy.addEventListener('click', copyClick);
    return () => { ++generation; clearTimeout(timer); show.removeEventListener('click', showClick); copy.removeEventListener('click', copyClick); };
  }
  function createControls(getReport, notify) {
    const wrapper = document.createElement('div'); wrapper.className = 'diagnostics-controls';
    const actions = document.createElement('div'); actions.className = 'action-pair';
    const show = document.createElement('button'), copy = document.createElement('button'), output = document.createElement('pre');
    for (const button of [show, copy]) { button.type = 'button'; button.className = 'life-btn action'; }
    output.className = 'diag';
    bindControls({ show, copy, output, getReport, notify });
    actions.append(show, copy); wrapper.append(actions, output); return wrapper;
  }
  return Object.freeze({ createReport, readabilityScan, registerProduct, compatibility, bindControls, createControls, reportSource, dispose });
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
  let suiteControlCleanup;

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
    const record = { manifest: Object.freeze({ ...manifest }), hooks, state: 'registered', queue: Promise.resolve(), desiredEnabled: false };
    const transition = (allowed, next, action) => {
      record.queue = record.queue.catch(() => {}).then(async () => {
        if (!allowed.includes(record.state)) return;
        try {
          if(next==='enabled'&&shared.suiteSitePaused?.()){record.state='disabled';publishProduct(record.manifest,'disabled');return;}
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
    const enable = () => {
      record.desiredEnabled = true;
      if (shared.suiteSitePaused?.()) return transition(['initialized'], 'disabled');
      return transition(['initialized', 'disabled'], 'enabled', hooks.enable);
    };
    const disable = () => { record.desiredEnabled = false; return transition(['enabled'], 'disabled', hooks.disable); };
    record.public = Object.freeze({
      manifest: record.manifest,
      get state() { return record.state; },
      initialize: () => transition(['registered', 'failed'], 'initialized', hooks.initialize),
      enable,
      disable,
      cleanup: () => transition(['registered', 'initialized', 'enabled', 'disabled', 'failed'], 'cleaned', hooks.cleanup)
    });
    products.set(manifest.id, record);
    if (!suiteControlCleanup && typeof shared.onSuiteEvent === 'function') {
      suiteControlCleanup = shared.onSuiteEvent((event) => {
        if (event.type !== 'suite.site-control' || event.detail?.hostname !== String(location.hostname || 'local-document').toLowerCase()) return;
        for (const item of products.values()) {
          item.queue=item.queue.catch(()=>{}).then(async()=>{const paused=shared.suiteSitePaused?.();try{if(paused&&item.state==='enabled'){await item.hooks.disable?.();item.state='disabled';publishProduct(item.manifest,'disabled');}else if(!paused&&item.desiredEnabled&&item.state==='disabled'){await item.hooks.enable?.();item.state='enabled';publishProduct(item.manifest,'enabled');}}catch(error){item.state='failed';safeError(error,item.manifest.id);publishProduct(item.manifest,'failed');}});
        }
      }, { type: 'suite.site-control' });
      cleanups.add(() => { suiteControlCleanup?.(); suiteControlCleanup = null; });
    }
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
  // has no owner node, and a theming tool cannot see a JavaScript flag across
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

  // Shadow roots share one constructed sheet per stylesheet text. Paint is probed once per
  // page: every probe forces a style recalculation of the whole page, which on a site with
  // thousands of components (Reddit) cost seconds. Later roots only check that their adopted
  // list took the sheet. A root that edits its style gets its own copy first.
  const sharedShadowSheets = new Map();
  // null until the first connected root answers; false sends every later root to the fallback.
  let shadowAdoptionPaints = null;

  function withoutOne(list, sheet, replacement) {
    const next = [...list];
    const index = next.lastIndexOf(sheet);
    if (index >= 0) { if (replacement) next[index] = replacement; else next.splice(index, 1); }
    return next;
  }

  function adoptionPaints(root, Ctor, view) {
    const token = paintToken();
    const probe = new Ctor();
    writeSheet(probe, withPaintProbe('', token), view);
    setAdopted(root, [...root.adoptedStyleSheets, probe]);
    try { return sawPaint(token, root); } finally { try { setAdopted(root, withoutOne(root.adoptedStyleSheets, probe)); } catch {} }
  }

  function adoptShared(root, css) {
    const view = pageView();
    const Ctor = view.CSSStyleSheet || (typeof CSSStyleSheet === 'function' ? CSSStyleSheet : null);
    if (typeof Ctor !== 'function' || !Ctor.prototype.replaceSync) return null;
    const current = root.adoptedStyleSheets;
    if (!current || typeof current[Symbol.iterator] !== 'function') return null;
    if (shadowAdoptionPaints === false) throw new Error('adoptedStyleSheets did not paint');
    let entry = sharedShadowSheets.get(css);
    if (!entry) {
      const created = new Ctor();
      writeSheet(created, css, view);
      entry = { sheet: created, users: 0 };
    }
    let sheet = entry.sheet;
    const before = current.length;
    setAdopted(root, [...current, sheet]);
    if (root.adoptedStyleSheets.length !== before + 1) {
      try { setAdopted(root, withoutOne(root.adoptedStyleSheets, sheet)); } catch {}
      throw new Error('adoptedStyleSheets ignored');
    }
    if (shadowAdoptionPaints === null && isConnectedNode(root)) {
      let painted = false;
      try { painted = adoptionPaints(root, Ctor, view); } catch {}
      shadowAdoptionPaints = painted;
      if (!painted) {
        try { setAdopted(root, withoutOne(root.adoptedStyleSheets, sheet)); } catch {}
        throw new Error('adoptedStyleSheets did not paint');
      }
    }
    entry.users += 1;
    sharedShadowSheets.set(css, entry);
    let shared = true;
    const release = () => {
      if (!shared) return;
      shared = false;
      entry.users -= 1;
      if (entry.users <= 0 && sharedShadowSheets.get(css) === entry) sharedShadowSheets.delete(css);
    };
    return {
      write(text) {
        if (!shared) { writeSheet(sheet, text, view); return; }
        const own = new Ctor();
        writeSheet(own, text, view);
        const list = [...root.adoptedStyleSheets];
        // A component that reassigned its list dropped the shared copy; the edit still lands.
        setAdopted(root, list.includes(sheet) ? withoutOne(list, sheet, own) : [...list, own]);
        release();
        sheet = own;
      },
      detach() {
        try { setAdopted(root, withoutOne(root.adoptedStyleSheets, sheet)); } catch {}
        release();
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
      const adopted = adoptShared(root, css);
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

  // A cached document keeps its JS/DOM and resumes these same registrations on return.
  addEventListener('pagehide', event => { if(event.persisted)return;for (const cleanup of [...cleanups]) { try { cleanup(); } catch {} } });
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
  const PRODUCT_ROOT_IDS = {"thread":"exp-thread-root","dropper":"tdh-root","ward":"exp-ward-root"};
  function placeDonationPanel(panel, trigger){
    trigger.closest('.menu-head,header')?.after(panel);
    panel.style.cssText='position:static!important;width:100%!important;max-width:100%!important;margin:7px 0;box-shadow:none';
  }
  function createBitcoinDonation(){
    const address='bc1qg4xq63mwu63qc5dnqugk3qtxvulv5p3frjayna8ey8tu8ey4wpxsg92hv3';
    const details=document.createElement('details');details.className='exp-bitcoin-donation';details.style.cssText='margin-top:7px;min-width:0';
    const summary=document.createElement('summary');summary.textContent='₿ Bitcoin';summary.style.cssText='cursor:pointer;font-weight:700;padding:6px;border:1px solid var(--theme-line);border-radius:7px';
    const code=document.createElement('code');code.textContent=address;code.setAttribute('aria-label','Bitcoin Donation Address');code.style.cssText='display:block;overflow-wrap:anywhere;word-break:break-all;user-select:all;margin:7px 0;font-size:var(--exp-font-size-body,13px);line-height:1.4';
    const status=document.createElement('p');status.setAttribute('role','status');status.style.cssText='margin:5px 0 0;font-size:var(--exp-font-size-small,11px)';
    const copy=button('Copy Bitcoin Address',async()=>{try{await navigator.clipboard.writeText(address);status.textContent='Bitcoin address copied.';}catch{status.textContent='Select and copy the address above.';}});copy.style.cssText='width:100%;min-width:0;white-space:normal;border-radius:7px';
    const wallet=document.createElement('a');wallet.href='bitcoin:'+address;wallet.textContent='Open Bitcoin Wallet';
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
  function createCompatibilityControls(){const d=card('Product Compatibility'),out=document.createElement('div');out.setAttribute('aria-live','polite');function refresh(){out.replaceChildren();const value=compatibilitySnapshot();for(const p of value.products){const line=document.createElement('p');line.textContent=`${p.id.toUpperCase()} ${p.versions.join(', ')} · ${p.core?'core '+p.core:'native product UI'}`;out.append(line);}const status=document.createElement('p');status.textContent=value.warnings.join(' ')||'No mixed core versions or duplicate instances detected on this page.';out.append(status);const note=document.createElement('small');note.textContent='Only products running on this page are visible. This is not an online update check.';out.append(note);}d.addEventListener('toggle',()=>{if(d.open)refresh();});d.append(out,button('Refresh Compatibility',refresh));return d;}
  function createSuiteSiteControls(){
    const d=card('Site Control'),out=document.createElement('div');out.setAttribute('aria-live','polite');
    const toggle=document.createElement('button');toggle.type='button';toggle.className='switch';toggle.setAttribute('role','switch');toggle.setAttribute('aria-label','Pause all ExtraPotions products on this site');toggle.append(document.createElement('span'));
    const row=document.createElement('div');row.className='row';const copy=document.createElement('div');copy.className='copy';const label=document.createElement('strong');label.textContent='Pause All on This Site';const help=document.createElement('small');help.className='help';help.textContent='Stops page changes from every active ExtraPotions product while keeping launchers and System recovery menus available.';copy.append(label,help);row.append(copy,toggle);
    function refresh(){const core=ExtraPotionsCore;const paused=Boolean(core.suiteSitePaused());toggle.setAttribute('aria-checked',String(paused));out.replaceChildren();const status=document.createElement('p');status.textContent=core.suiteSitePausePersisted?.()===false?(paused?'Paused for this page. Storage is unavailable.':'Active for this page. Storage is unavailable.'):(paused?'ExtraPotions page features are paused on this site.':'ExtraPotions page features are active on this site.');out.append(status);for(const product of core.suiteSnapshot().products){const line=document.createElement('p'),state=core.latestSuiteState(product.id)?.state;line.textContent=`${product.id.toUpperCase()} · ${paused?'Site Paused':state?.status|| (state?.active===false?'Inactive':'Active')}`;out.append(line);}}
    toggle.addEventListener('click',()=>{const core=ExtraPotionsCore;core.setSuiteSitePaused(!core.suiteSitePaused());refresh();});
    const duration=document.createElement('select');duration.setAttribute('aria-label','Temporary Suite Pause Duration');for(const [value,label] of [['15','15 minutes'],['60','1 hour'],['240','4 hours']]){const option=document.createElement('option');option.value=value;option.textContent=label;duration.append(option);}const temporary=button('Pause Temporarily',()=>{ExtraPotionsCore.setSuiteSitePaused(true,location.hostname,Number(duration.value));refresh();});
    d.addEventListener('toggle',()=>{if(d.open)refresh();});d.append(row,duration,temporary,out);refresh();return d;
  }
  const productRepositories = Object.freeze({dropper:'Dropper',ward:'WARD',thread:'THREAD'});
  // GitHub prefills an issue from the link; longer links fail, so a large report goes by clipboard.
  const ISSUE_URL_LIMIT=8000;
  const plain=(value,limit=200)=>String(value||'').replace(/https?:\/\/\S+/gi,'[link]').replace(/\S+@\S+/g,'[address]').replace(/\s+/g,' ').trim().slice(0,limit);
  function browserName(agent=''){
    const version=pattern=>(agent.match(pattern)||[])[1];
    const name=version(/Edg\/(\d+)/)?'Edge '+version(/Edg\/(\d+)/):version(/OPR\/(\d+)/)?'Opera '+version(/OPR\/(\d+)/):version(/Firefox\/(\d+)/)?'Firefox '+version(/Firefox\/(\d+)/):version(/Chrome\/(\d+)/)?'Chrome '+version(/Chrome\/(\d+)/):version(/Version\/(\d+)[^ ]* Safari/)?'Safari '+version(/Version\/(\d+)[^ ]* Safari/):'Unknown browser';
    const os=/Windows/.test(agent)?'Windows':/Android/.test(agent)?'Android':/iPhone|iPad/.test(agent)?'iOS':/Mac OS X/.test(agent)?'macOS':/CrOS/.test(agent)?'ChromeOS':/Linux/.test(agent)?'Linux':'Unknown OS';
    return name+' · '+os;
  }
  // The minimum a maintainer needs to triage, small enough to always fit in the issue link.
  // Only settings that differ from the product's defaults are listed.
  function issueSummary(report={},{settings,activity=[]}={}){
    const lines=[],add=(label,value)=>{if(value)lines.push(`- ${label}: ${value}`);};
    const self=report.plugin?.id;
    add('Product',[productRepositories[self]||self,report.plugin?.version].filter(Boolean).join(' ')+(report.technical?.core?.version?' · Core '+report.technical.core.version:''));
    add('Other products on page',(report.plugin?.compatibility?.products||[]).filter(p=>p.id!==self&&p.status==='observed').map(p=>(productRepositories[p.id]||p.id)+' '+(p.versions||[]).join('/')).join(', '));
    const manager=report.technical?.manager;add('Userscript manager',manager?.name?plain(manager.name+' '+(manager.version||''),60):'');
    const env=report.environment||{};add('Browser',env.userAgent?browserName(env.userAgent):'');add('Site',plain(env.hostname,100));
    if(env.viewport)add('Viewport',`${env.viewport.width}×${env.viewport.height} @${env.viewport.pixelRatio}x`);
    if(settings?.current&&settings?.defaults){
      const changed=Object.keys(settings.current).filter(key=>JSON.stringify(settings.current[key])!==JSON.stringify(settings.defaults[key])).slice(0,25);
      add('Settings changed from defaults',changed.map(key=>`${key}: ${plain(JSON.stringify(settings.current[key]),60)}`).join(', ')||'none');
    }
    const errors=[...(report.core?.errors||[]).map(e=>[e.source,e.code,e.message].filter(Boolean).join(' ')),...(report.console?.entries||[]).filter(e=>/error|warn/.test(e.level)).map(e=>e.message||e.text||'')].filter(Boolean).slice(-5);
    if(errors.length)lines.push('- Recent errors:',...errors.map(e=>'  - '+plain(e,200)));
    const recent=activity.map(entry=>plain(entry,120)).filter(Boolean).slice(-5);
    if(recent.length)lines.push('- Recent activity:',...recent.map(e=>'  - '+e));
    return lines.join('\n');
  }
  function productIssueUrl(id, version, {health,diagnostics,copied=false,summary=''}={}) {
    if (!Object.hasOwn(productRepositories,id)) throw new Error('Unknown product');
    const product=productRepositories[id];
    const safeVersion=/^\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/.test(String(version))?String(version):'unknown';
    // Status is the product's own plain-language health text with links and addresses removed.
    // Diagnostics are the product's own redacted report, attached only when the person reports.
    const status=health&&plain(health.label)?`\nStatus: ${plain(health.label)}${plain(health.reason)?' - '+plain(health.reason):''}\n`:'';
    const template=`Product: ${product} v${safeVersion}\n${status}\nWhat happened?\n\nSteps to reproduce\n1. \n\nExpected behavior\n\nActual behavior\n\n`+(summary?`Summary (review and remove anything private before submitting)\n${summary}\n\n`:'Browser and userscript manager\n\n');
    const link=body=>'https://github.com/ExtraPotions/'+product+'/issues/new?title='+encodeURIComponent('['+product+' '+safeVersion+'] Issue')+'&body='+encodeURIComponent(body);
    if(diagnostics&&typeof diagnostics==='object'){
      const review='Full diagnostics\n';
      for(const text of [JSON.stringify(diagnostics,null,2),JSON.stringify(diagnostics)]){const url=link(template+review+'```json\n'+text+'\n```\n');if(url.length<=ISSUE_URL_LIMIT)return url;}
      const url=link(template+review+(copied?'The full diagnostics were copied to your clipboard when you selected Report a Problem. Paste them here if asked.\n':'Select Copy diagnostics and paste the full diagnostics here if asked.\n'));
      if(url.length<=ISSUE_URL_LIMIT||summary.length<=1500)return url;
      return productIssueUrl(id,version,{health,diagnostics,copied,summary:summary.slice(0,1500)});
    }
    return link(template+'Diagnostics (optional)\nSelect Copy diagnostics, paste them here, and remove anything private.\n');
  }
  const productTimelines=new Map(),resettingProducts=new Set();
  const productDataResetting=id=>resettingProducts.has(id);
  function clearProductData(id, {legacyKeys=[]} = {}) {
    if (!Object.hasOwn(productRepositories,id)) throw new Error('Unknown product');
    resettingProducts.add(id);
    try {
    const owns=key=>key.startsWith(`exp:v3:${id}:`)||legacyKeys.some(base=>key===base||key.startsWith(base+':account:'));
    const known=new Set([`exp:v3:${id}:settings`,`exp:v3:${id}:update-cache`,`exp:v3:${id}:installed-version`,`exp:v3:${id}:last-version-v2`,...legacyKeys]);
    for(const storageName of ['localStorage','sessionStorage']) {
      let storage;try{storage=globalThis[storageName];}catch{throw new Error('Could not access product storage.');}if(!storage)continue;
      for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key&&owns(key))known.add(key);}
      for(const key of known) { try{storage.removeItem(key);}catch{throw new Error('Could not clear '+id+' data. Check browser storage permissions.');} }
    }
    try{if(typeof GM_listValues==='function')for(const key of GM_listValues())if(owns(key))known.add(key);}catch{throw new Error('Could not list product storage.');}
    for(const key of known){if(typeof GM_deleteValue==='function')GM_deleteValue(key);else if(typeof GM_setValue==='function')GM_setValue(key,undefined);}
    productTimelines.delete(id);
    return [...known];
    } catch(error){resettingProducts.delete(id);throw error;}
  }
  // Groups consecutive entries that share a key, keeping the newest time and a count.
  function groupTimelineEntries(entries,key=entry=>entry.reason){
    const groups=[];for(const entry of entries||[]){const k=key(entry),last=groups.at(-1);
      if(last&&last.key===k){last.count++;last.at=Math.max(last.at,Number(entry.at)||0);}else groups.push({...entry,key:k,count:1,at:Number(entry.at)||0});}
    return groups;
  }
  function createProductTimeline(id,getHealth,notify=()=>{},{layout='classic',showActivity=true}={}) {
    if(!Object.hasOwn(productRepositories,id))throw new Error('Unknown product');
    const rows=document.createElement('div');rows.dataset.expProductTimeline='1';
    let disposed=false;
    function render(){rows.replaceChildren();for(const entry of (productTimelines.get(id)||[]).slice().reverse()){
      const line=document.createElement('p');line.textContent=new Date(entry.at).toLocaleTimeString()+' · '+entry.state+' · '+entry.reason;
      line.style.cssText='margin:6px 0;overflow-wrap:anywhere';rows.append(line);
    }}
    async function observedHealth(){const value=await getHealth();if(!disposed&&showActivity){
      const history=productTimelines.get(id)||[];
      const state=String(value?.state||'waiting').slice(0,30),reason=String(value?.reason||'Status unavailable.').replace(/https?:\/\/\S+/gi,'[page]').slice(0,500),last=history.at(-1);
      if(!last||last.state!==state||last.reason!==reason){history.push({at:Date.now(),state,reason});if(history.length>30)history.shift();productTimelines.set(id,history);}
      render();
    }return value;}
    const health=ExtraPotionsCore.createHealthControls(observedHealth,notify);
    if(layout==='grouped'){
      if(!showActivity){
        const status=ExtraPotionsCore.createDisclosure('Status',health.element);status.open=true;
        status.addEventListener('toggle',()=>{if(status.open)health.refresh();});
        return {element:status,dispose(){disposed=true;health.dispose();},refresh:health.refresh};
      }
      // Status stays open so its recovery action is visible; history is one tap away.
      const activity=document.createElement('div');activity.dataset.expProductActivity='1';
      const log=ExtraPotionsCore.createDisclosure('Recent Activity',activity,rows);log.dataset.expSystemActivity='1';
      const status=ExtraPotionsCore.createDisclosure('Status',health.element,log);status.open=true;
      status.addEventListener('toggle',()=>{if(status.open)health.refresh();});
      log.addEventListener('toggle',()=>{if(log.open)health.refresh();});
      return {element:status,activity,log,dispose(){disposed=true;health.dispose();},refresh:health.refresh};
    }
    const timeline=ExtraPotionsCore.createDisclosure(id==='dropper'?'Dropper Status':'Product Timeline',health.element,rows);
    timeline.addEventListener('toggle',()=>{if(timeline.open)health.refresh();});
    return {element:timeline,dispose(){disposed=true;health.dispose();},refresh:health.refresh};
  }
  const RESET_ARM_MS=4000;
  function groupedProductSystem({id,version,timeline,diagnostics,preferences,onReset,notify,issueSettings}) {
    const product=productRepositories[id];
    const system=document.createElement('div');system.dataset.expProductSystem=id;system.dataset.expSystemLayout='grouped';
    system.style.cssText='display:grid;grid-template-columns:minmax(0,1fr);gap:8px;min-width:0;max-width:100%;overflow-wrap:anywhere';
    const wide=node=>{node.style.cssText+=';width:100%;min-width:0;white-space:normal;border-radius:7px';return node;};
    const note=text=>{const p=document.createElement('p');p.textContent=text;p.style.cssText='margin:6px 0;font-size:var(--exp-font-size-small,11px);line-height:1.4';return p;};
    // Support: Copy is the everyday action; Show stays available for review.
    const pair=diagnostics.querySelector?.('.action-pair'),buttons=pair?[...pair.querySelectorAll(':scope > button')]:[];
    const copy=buttons.find(b=>/^Copy/.test(b.textContent)),show=buttons.find(b=>/^(Show|Hide)/.test(b.textContent));
    if(copy&&show){pair.insertBefore(show,copy);if(!pair.querySelector(':scope > [data-exp-diagnostics-label]')){const label=document.createElement('span');label.dataset.expDiagnosticsLabel='1';label.textContent='Diagnostics';pair.prepend(label);}pair.style.cssText='display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:6px';ExpMenuHelp.setMenuHelp(copy,'Copy a fresh diagnostic snapshot for troubleshooting. Review it for private data before sharing.');}
    const output=diagnostics.querySelector?.('pre');if(output)output.style.cssText+=';max-height:240px;overflow:auto';
    const health=()=>({label:timeline.querySelector?.('[data-exp-health-state]')?.textContent||'',reason:timeline.querySelector?.('[data-exp-health-reason]')?.textContent||''});
    // Each report takes a fresh diagnostics report, copies it, and attaches it to the issue when it fits.
    const report=wide(button('Report a Problem',async()=>{
      if(report.disabled)return;report.disabled=true;
      let data=null,copied=false;
      try{const source=typeof ExtraPotionsDiagnostics==='object'?ExtraPotionsDiagnostics.reportSource?.(diagnostics):null;if(source)data=await source();}catch{}
      if(data){try{await navigator.clipboard.writeText(JSON.stringify(data,null,2));copied=true;}catch{}}
      let summary='';
      if(data){try{let settings=null;try{settings=issueSettings?.()||null;}catch{}
        const reason=health().reason.trim(),activity=[...(timeline.querySelectorAll?.('p')||[])].map(p=>p.textContent.trim()).filter(text=>text&&text!==reason).slice(-5);
        summary=issueSummary(data,{settings,activity});}catch{}}
      try{const link=document.createElement('a');link.href=productIssueUrl(id,version,{health:health(),diagnostics:data,copied,summary});link.target='_blank';link.rel='noopener noreferrer';link.click();}
      finally{report.disabled=false;}
    }));
    report.dataset.expSystemReport='1';
    ExpMenuHelp.setMenuHelp(report,'Attaches fresh diagnostics to a GitHub issue. GitHub issues are public; remove private data before submitting.');
    const support=document.createElement('section');support.setAttribute('aria-label','Diagnostics and Support');support.append(diagnostics,report);
    // Reset: one tap arms, a second tap within a few seconds confirms. No browser dialogs.
    const resetStatus=note('');resetStatus.setAttribute('role','status');resetStatus.setAttribute('aria-live','polite');
    let armedUntil=0,armTimer=0;
    const reset=wide(button('Reset All Settings',async()=>{
      if(reset.disabled)return;
      if(Date.now()>=armedUntil){
        armedUntil=Date.now()+RESET_ARM_MS;reset.textContent='Tap Again to Reset';reset.dataset.expResetArmed='1';
        resetStatus.textContent=`Tap again within ${RESET_ARM_MS/1000} seconds to permanently reset ${product}.`;
        clearTimeout(armTimer);armTimer=setTimeout(disarm,RESET_ARM_MS);return;
      }
      disarm();reset.disabled=true;
      try{await onReset();notify(product+' reset complete.');}catch{notify('Reset did not complete. Check storage permissions and try again.');}finally{reset.disabled=false;}
    }));
    reset.dataset.expDestructive='1';
    function disarm(){clearTimeout(armTimer);armedUntil=0;reset.textContent='Reset All Settings';delete reset.dataset.expResetArmed;resetStatus.textContent='';}
    reset.style.cssText+=';font-weight:600';
    ExpMenuHelp.setMenuHelp(reset,`Clears ${product} settings and stored data on this browser. This cannot be undone. Tap twice within 4 seconds to confirm.`);
    const resetCard=document.createElement('section');resetCard.setAttribute('aria-label','Reset Settings');resetCard.style.cssText='margin-block-start:12px;padding-block-start:8px';resetCard.append(reset,resetStatus);
    reset.addEventListener('blur',disarm);
    for(const [key,node] of [['status',timeline],['support',support],['preferences',preferences],['reset',resetCard]]){
      if(!node)continue;node.dataset.expSystemItem=key;node.style.minWidth='0';node.style.maxWidth='100%';
      const summary=node.tagName==='DETAILS'?node.querySelector(':scope > summary'):null;if(summary)summary.style.cssText+=';min-height:28px;padding:4px 0;box-sizing:border-box;cursor:pointer';system.append(node);
    }
    return system;
  }
  function createProductSystem({id,version,timeline,diagnostics,preferences,onReset,notify=()=>{},layout='grouped',issueSettings}) {
    if(!Object.hasOwn(productRepositories,id))throw new Error('Unknown product');
    if(layout==='grouped')return groupedProductSystem({id,version,timeline,diagnostics,preferences,onReset,notify,issueSettings});
    const system=document.createElement('div');system.dataset.expProductSystem=id;
    system.style.cssText='display:grid;grid-template-columns:minmax(0,1fr);gap:8px;min-width:0;max-width:100%;overflow-wrap:anywhere';
    const issue=button('Create GitHub Issue',()=>{const link=document.createElement('a');link.href=productIssueUrl(id,version);link.target='_blank';link.rel='noopener noreferrer';link.click();});
    issue.style.cssText='width:100%;min-width:0;white-space:normal;border-radius:7px';
    const reset=button('Reset All Settings',async()=>{
      if(!confirm(`Reset all ${productRepositories[id]} settings and stored product data?`))return;
      if(!confirm(`Confirm permanent reset of ${productRepositories[id]} data. This cannot be undone.`))return;
      reset.disabled=true;
      try{await onReset();notify(productRepositories[id]+' reset complete.');}catch{notify('Reset did not complete. Check storage permissions and try again.');}finally{reset.disabled=false;}
    });
    reset.style.cssText='width:100%;min-width:0;white-space:normal;border:1px solid #ff2438;border-radius:7px;background:#e11428;color:#fff;font-weight:700';
    for(const [key,node] of [['timeline',timeline],['diagnostics',diagnostics],['issue',issue],['preferences',preferences],['reset',reset]]){node.dataset.expSystemItem=key;node.style.minWidth='0';node.style.maxWidth='100%';const summary=node.tagName==='DETAILS'?node.querySelector(':scope > summary'):null;if(summary)summary.style.cssText+=';min-height:28px;padding:4px 0;box-sizing:border-box;cursor:pointer';system.append(node);}
    return system;
  }
  return Object.freeze({issueSummary,productIssueUrl,productDataResetting,clearProductData,groupTimelineEntries,createProductTimeline,createProductSystem,placeDonationPanel,createBitcoinDonation,compatibilitySnapshot,createCompatibilityControls,createSuiteSiteControls});
})();

/* Product sections as a filing cabinet: each section header is a drawer front. The product's own header
   click opens its section and closes the others, so each product keeps its section code and lazy rendering.
   Core reopens the last drawer when the menu opens and keeps one inner drawer (details) open per level. */
const ExpMenuTabs = (() => {
  const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
  const write = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
  // Drawer fronts use the short names the menus have always shown.
  const shortLabels = Object.freeze({ appearance: 'Look', protection: 'Protect' });
  const isOpen = entry => !entry.body.hidden && !entry.body.classList.contains('fl-tool-hidden');

  function mount({ panel, id, entries }) {
    const document = panel.ownerDocument, view = document.defaultView;
    const storageKey = 'exp:suite:menu-tab:' + id;
    let disposed = false, queued = false, wasVisible = false, reopened = false;
    const visible = () => !panel.hidden && panel.getClientRects().length > 0;
    // The sections sit in one scrolling column; the open drawer's front stays pinned at its top.
    const content = document.createElement('div');
    content.className = 'exp-menu-content';
    const renamed = [];
    for (const entry of entries) {
      const title = entry.header.querySelector('.fl-tool-title'), short = shortLabels[entry.label.toLowerCase()];
      if (title && short) { renamed.push([title, title.textContent]); title.textContent = short; }
    }
    function place() {
      if (content.parentNode) return;
      const parent = entries[0].section.parentElement; if (!parent) return;
      parent.insertBefore(content, entries[0].section);
      content.append(...entries.map(entry => entry.section));
    }
    function open(index) { if (entries[index] && !isOpen(entries[index])) entries[index].header.click(); }
    function sync() {
      if (disposed) return;
      place();
      const now = visible();
      // Products close their sections as the menu opens, so the remembered drawer is restored then.
      if (now && (!wasVisible || reopened) && !entries.some(isOpen)) {
        const remembered = entries.findIndex(entry => entry.key === read(storageKey));
        open(remembered >= 0 ? remembered : 0);
      }
      wasVisible = now; reopened = false;
    }
    const remember = event => {
      const entry = entries.find(item => item.header.contains(event.target));
      // Capture runs before the header's own handler: a click on a closed front is the drawer being opened.
      if (entry && !isOpen(entry)) write(storageKey, entry.key);
    };
    // One inner drawer open per level: a level is the nearest enclosing drawer, so wrapped groups count too.
    const level = node => node.parentElement?.closest('details,.fl-tool-body,.route-body');
    // Attribute records arrive in order, unlike toggle events, so walking them newest first lets the last drawer opened win.
    const exclusive = new view.MutationObserver(records => {
      const done = new Set();
      for (const record of records.reverse()) {
        const details = record.target;
        if (details.tagName !== 'DETAILS' || record.oldValue !== null || !details.open || done.has(details)) continue;
        const home = level(details); if (!home) continue;
        done.add(details);
        for (const other of home.querySelectorAll('details[open]')) if (other !== details && level(other) === home) { other.open = false; done.add(other); }
      }
    });
    panel.addEventListener('click', remember, true);
    exclusive.observe(panel, { subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['open'] });
    // A close and reopen in one task leaves the panel visible throughout; the old hidden or class value still shows it.
    const observer = new view.MutationObserver(records => { if (records.some(record => record.attributeName === 'hidden' ? record.oldValue !== null : record.attributeName === 'class' && record.oldValue !== panel.getAttribute('class'))) reopened = true; if (!queued && !disposed) { queued = true; queueMicrotask(() => { queued = false; sync(); }); } });
    observer.observe(panel, { attributes: true, attributeOldValue: true, attributeFilter: ['hidden', 'class', 'style'] });
    const resize = new view.ResizeObserver(sync); resize.observe(panel);
    sync();
    return {
      update: sync,
      select(key) { const index = entries.findIndex(entry => entry.key === key); if (index >= 0) { write(storageKey, key); open(index); } },
      destroy() {
        disposed = true; observer.disconnect(); resize.disconnect();
        panel.removeEventListener('click', remember, true); exclusive.disconnect();
        for (const entry of entries) content.before(entry.section);
        content.remove();
        for (const [title, text] of renamed) title.textContent = text;
      },
    };
  }
  return Object.freeze({ mount });
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
  const PRODUCT_SECTIONS = {"thread":{"main":["feed","read"],"appearance":["look"],"advanced":["filters","people"],"system":["system"]},"dropper":{"main":["drops","streams","campaigns","settings"],"appearance":["appearance"],"advanced":["advanced"],"system":["system"]},"ward":{"main":["protection","amazon","tools"],"appearance":["appearance"],"advanced":["advanced","patterns","advanced-amazon"],"system":["system"]}};
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

  let tabSerial = 0;
  const tabCss = `
    [data-exp-submenu-tabs]{min-width:0;grid-column:1/-1}
    .exp-submenu-home,.exp-submenu-detail{min-width:0;max-width:100%}
    .exp-submenu-home[hidden],.exp-submenu-detail[hidden]{display:none!important}
    .exp-submenu-nav{display:grid;min-width:0}
    .exp-submenu-home>.exp-submenu-tabpanel+.exp-submenu-nav{margin-top:8px;border-top:1px solid var(--theme-line)}
    .exp-submenu-row{display:grid;grid-template-columns:minmax(0,1fr) 14px;align-items:center;gap:10px;width:100%;min-width:0;min-height:40px;margin:0!important;padding:8px 2px!important;text-align:left;font:600 var(--exp-font-size-body,13px)/1.4 "Segoe UI",system-ui,sans-serif!important;color:var(--theme-text);background:transparent!important;border:0!important;border-top:1px solid var(--theme-line)!important;border-radius:0!important;box-shadow:none!important;cursor:pointer;overflow-wrap:anywhere}
    .exp-submenu-nav>.exp-submenu-row:first-child{border-top:0!important}
    .exp-submenu-row:hover>span{color:var(--theme-accent)}
    .exp-submenu-row>svg,.exp-submenu-back>svg{width:14px;height:14px;color:var(--theme-muted);flex:none}
    .exp-submenu-back{display:flex;align-items:center;gap:6px;min-height:36px;margin:0!important;padding:4px 4px 4px 0!important;font:600 var(--exp-font-size-body,13px)/1.4 "Segoe UI",system-ui,sans-serif!important;color:var(--theme-muted);background:transparent!important;border:0!important;box-shadow:none!important;cursor:pointer}
    .exp-submenu-back:hover{color:var(--theme-text)}
    .exp-submenu-title{margin:2px 0 8px;font:700 14px/1.35 "Segoe UI",system-ui,sans-serif;color:var(--theme-text);overflow-wrap:anywhere}
    .exp-submenu-row:focus-visible,.exp-submenu-back:focus-visible{outline:2px solid var(--theme-accent2,var(--theme-accent));outline-offset:2px}
    .exp-submenu-tabpanel{min-width:0;max-width:100%}
    .exp-submenu-tabpanel[hidden]{display:none!important}
    .exp-submenu-tabpanel>[data-exp-tab-item]{margin-top:0!important}
    .exp-submenu-tabpanel>details[data-exp-tab-item]{border:0!important;padding:0!important;background:transparent!important}
    .exp-submenu-tabpanel>details[data-exp-tab-item]>summary{display:none!important}
    @media(pointer:coarse){.exp-submenu-row,.exp-submenu-back{min-height:44px}}
  `;
  const chevron = (document, back) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');svg.setAttribute('aria-hidden', 'true');svg.setAttribute('focusable', 'false');
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    line.setAttribute('d', back ? 'M10 3 5 8l5 5' : 'm6 3 5 5-5 5');line.setAttribute('fill', 'none');line.setAttribute('stroke', 'currentColor');line.setAttribute('stroke-width', '1.8');line.setAttribute('stroke-linecap', 'round');line.setAttribute('stroke-linejoin', 'round');
    svg.append(line);return svg;
  };
  const shortLabels = Object.freeze({
    'highlight-style':'Style', 'menu-preferences':'Menu', 'settings-transfer':'Transfer',
    'effects-and-integrations':'Effects', 'profiles-and-sites':'Profiles', 'page-tools':'Page',
    'retailer-modules':'Retailers', 'protection-review':'Review', 'page-activity':'Activity',
  });
  function tabLabel(node) {
    // Existing primary sections stay together in Overview. Only submenu
    // disclosures become tabs; status chips and inline explanations stay local.
    if(node.tagName!=='DETAILS'||node.matches('.eligibility-chip,[data-shift-appearance-explanation]'))return null;
    const title = node.querySelector(':scope>summary,:scope>h3,:scope>h2');
    const label = (title?.querySelector('.campaign-manager-title')||title)?.textContent.trim();
    if (!label) return null;
    return shortLabels[slug(label)] || label;
  }
  function mountTabs({panel,id,onChange=()=>{}}) {
    // The approved menu keeps original disclosures inline, with no secondary navigation.
    if(panel.matches('[data-exp-menu-layout="lean"]'))return {update(){},destroy(){}};
    const document=panel.ownerDocument,view=document.defaultView;
    const style=document.createElement('style');style.textContent=tabCss;
    const styleRoot=panel.getRootNode();
    (styleRoot instanceof view.ShadowRoot?styleRoot:(document.head||document.documentElement)).append(style);
    const mounted=new Map(),selection=new Map();let disposed=false,queued=false;
    function groupsFor(container) {
      const groups=new Map(),home=[];
      const add=(label,node)=>{if(!groups.has(label))groups.set(label,[]);groups.get(label).push(node);};
      const stream=id==='dropper'&&container.id==='tdh-streams-body';
      const drops=id==='dropper'&&container.id==='tdh-drops-body';
      const retailer=id==='ward'&&container.id==='exp-ward-view-tools';
      for(const node of [...container.children]) {
        if(node.matches('style,script,[data-exp-submenu-tabs],.badge-only-progress-slot'))continue;
        // Everyday controls stay on the home view; each submenu disclosure becomes
        // a row that opens its own detail view.
        if(drops&&node.id==='tdh-open-campaigns'){home.push(node);continue;}
        let label=tabLabel(node);
        // System status stays open on the home view so recovery actions remain in sight.
        if(!label||(id!=='dropper'&&node.matches('[data-exp-system-item="status"]'))){home.push(node);continue;}
        if(stream){
          const key=slug(node.querySelector(':scope>summary')?.textContent);
          label=key==='playback-options'?'Playback':key==='notifications'?'Alerts':node.id==='tdh-routing-history-panel'||['routing-and-backup','interruption-rules','why-did-it-switch'].includes(key)?'Routing':label;
        } else if(drops){
          label=node.id==='tdh-open-campaigns'?'Campaigns':node.id==='tdh-claim-history-panel'?'History':label;
        } else if(retailer){
          label=label.startsWith('Advanced ')?'Patterns':['Page','Transfer'].includes(label)?'Tools':label;
        }
        add(label,node);
      }
      const order=stream?['Stream Health','Playback','Routing','Alerts']:drops?['Campaigns','History']:retailer?['Seller Clarity','Coverage','Retailers','Patterns','Tools']:['Page'];
      const rows=[...new Set([...order,...groups.keys()])].filter(label=>groups.has(label)).map(label=>({label,nodes:groups.get(label)}));
      return {home,rows};
    }
    function mountContainer(container,key) {
      const {home,rows}=groupsFor(container);if(!rows.length||rows.length+(home.length?1:0)<2)return false;
      const original=[...container.childNodes];
      const root=document.createElement('div');root.dataset.expSubmenuTabs='1';
      const homeView=document.createElement('div');homeView.className='exp-submenu-home';
      const nav=document.createElement('div');nav.className='exp-submenu-nav';
      const detail=document.createElement('div');detail.className='exp-submenu-detail';
      const backButton=document.createElement('button');backButton.type='button';backButton.className='exp-submenu-back';backButton.append(chevron(document,true),'Back');
      const title=document.createElement('div');title.className='exp-submenu-title';title.setAttribute('role','heading');title.setAttribute('aria-level','3');
      detail.append(backButton,title);
      const panel=label=>{const body=document.createElement('div');body.id='exp-submenu-panel-'+(++tabSerial);body.className='exp-submenu-tabpanel';body.setAttribute('role','region');body.setAttribute('aria-label',label+' settings');return body;};
      const homePanel=panel('Overview'),navRows=[],panels=[],detailsState=new Map();
      for(const node of home){if(tabLabel(node)){node.dataset.expTabItem='1';detailsState.set(node,node.open);}homePanel.append(node);}
      // Back owns the home panel so a product can reveal any control by clicking
      // the element whose aria-controls names the panel that holds it.
      backButton.setAttribute('aria-controls',homePanel.id);
      homeView.append(...(home.length?[homePanel,nav]:[nav]));
      for(const {label,nodes} of rows){
        const body=panel(label),button=document.createElement('button'),text=document.createElement('span');
        button.type='button';button.className='exp-submenu-row';button.setAttribute('aria-controls',body.id);button.setAttribute('aria-expanded','false');
        text.textContent=label;button.append(text,chevron(document,false));
        for(const node of nodes){node.dataset.expTabItem='1';detailsState.set(node,node.open);body.append(node);}
        body.hidden=true;navRows.push(button);panels.push(body);nav.append(button);detail.append(body);
      }
      root.append(homeView,detail);
      let active=-1;
      function show(index,focus=null){
        active=index;selection.set(key,index<0?null:rows[index].label);
        homeView.hidden=index>=0;detail.hidden=index<0;
        panels.forEach((body,i)=>{body.hidden=i!==index;navRows[i].setAttribute('aria-expanded',String(i===index));});
        title.textContent=index<0?'':rows[index].label;
        syncOpen();
        focus?.focus();onChange();
      }
      function syncOpen(){const visible=container.getClientRects().length>0&&!container.closest('[hidden],.fl-tool-hidden')&&view.getComputedStyle(container).visibility!=='hidden';[homePanel,...panels].forEach(body=>{const shown=body===homePanel?!homeView.hidden:!body.hidden;for(const node of body.children)if(detailsState.has(node)){const open=visible&&shown;if(node.open!==open)node.open=open;}});}
      function goBack(){const from=navRows[active];show(-1,from);}
      function click(event){
        const button=event.target.closest('button');
        if(button===backButton){if(active>=0)goBack();return;}
        const index=navRows.indexOf(button);if(index>=0)show(index,backButton);
      }
      function keydown(event){
        if(event.key!=='Escape'||active<0||event.defaultPrevented||event.target.closest?.('select'))return;
        // Leave the detail view instead of letting the menu's own Escape close it.
        event.preventDefault();event.stopPropagation();goBack();
      }
      root.addEventListener('click',click);root.addEventListener('keydown',keydown);
      const progressSlot=container.querySelector(':scope>.badge-only-progress-slot');
      container.replaceChildren(...(progressSlot?[progressSlot,root]:[root]));
      show(rows.findIndex(row=>row.label===selection.get(key)));
      mounted.set(container,{root,syncOpen,destroy(restore){root.removeEventListener('click',click);root.removeEventListener('keydown',keydown);for(const node of detailsState.keys())delete node.dataset.expTabItem;if(restore){for(const [node,open]of detailsState)node.open=open;container.replaceChildren(...original);}}});
      return true;
    }
    function update(){
      if(disposed)return;
      for(const [container,controller]of mounted)if(!panel.contains(container)||controller.root.parentElement!==container){controller.destroy(false);mounted.delete(container);}
      for(const container of panel.querySelectorAll('.fl-tool-body,.route-body,[data-exp-product-system]')){
        // System's grouped contents own their tabs rather than its outer wrapper.
        if(container.querySelector(':scope>[data-exp-product-system]')||mounted.has(container))continue;
        const key=container.id||container.dataset.expProductSystem||container.closest('section')?.querySelector('.fl-tool-title')?.textContent||'submenu';
        mountContainer(container,key);
      }
      for(const controller of mounted.values())controller.syncOpen();
    }
    const observer=new view.MutationObserver(()=>{if(!queued&&!disposed){queued=true;queueMicrotask(()=>{queued=false;update();});}});
    update();observer.observe(panel,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','class','aria-expanded']});
    return {update,destroy(){disposed=true;observer.disconnect();for(const [container,controller]of mounted)controller.destroy(controller.root.parentElement===container);mounted.clear();selection.clear();style.remove();}};
  }

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
    // Compact menus retain the product's native inline disclosures and lazy toggle handlers.
    const tabs={update(){},destroy(){}};
    const none = { update() { collapseSubmenus(panel);tabs.update(); }, select() {}, describe: () => [], destroy() {tabs.destroy();} };
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
    // Keep feature sections together, followed by the shared Look/System utilities.
    const nativeUtilities=panel.matches('[data-exp-menu-layout="lean"]');
    const rank = entry => nativeUtilities ? entry.category==='system'?3:/^(look|appearance)$/i.test(entry.label)?2:0 : CATEGORY_ORDER.indexOf(entry.category);
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
    const sectionTabs = ExpMenuTabs.mount({ panel, id, entries: desired });
    return {
      update() { collapseSubmenus(panel); tabs.update(); sectionTabs.update(); },
      select: key => sectionTabs.select(key),
      describe: () => describe(id, entries.map(({ key, label, category }) => ({ key, label, category }))),
      destroy() {
        sectionTabs.destroy();
        tabs.destroy();
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
    mountTabs,
  });
})();

/* Plain health facts and safe, product-owned actions. */
const ExpHealthSummary = (() => {
  const labels = Object.freeze({working:'Working',waiting:'Waiting',paused:'Paused',attention:'Needs Attention'});
  function normalizeHealth(value) {
    const valid = value && Object.hasOwn(labels, value.state);
    const state = valid ? value.state : 'waiting';
    const checkedAt = Number(value?.checkedAt);
    return {state,label:labels[state],reason:valid && typeof value.reason === 'string' ? value.reason.slice(0,500) : 'Status information is not available yet.',
      checkedAt:Number.isFinite(checkedAt) && checkedAt > 0 ? checkedAt : null,
      action:valid && typeof value.action?.label === 'string' && typeof value.action.run === 'function' ? {label:value.action.label.slice(0,80),run:value.action.run} : null};
  }
  function createHealthControls(getHealth, notify = () => {}) {
    const element=document.createElement('section');element.className='exp-health';element.dataset.expHealth='1';
    element.style.cssText='margin:0 0 10px;padding:8px;border:1px solid var(--theme-line);border-radius:7px;background:var(--theme-inset);min-width:0;overflow-wrap:anywhere';
    const state=document.createElement('strong'),reason=document.createElement('p'),checked=document.createElement('small'),action=document.createElement('button');
    state.dataset.expHealthState='1';reason.dataset.expHealthReason='1';reason.style.cssText='margin:5px 0;line-height:1.4';checked.style.cssText='display:block;margin-bottom:4px';
    action.type='button';action.className='life-btn action';action.hidden=true;
    element.append(state,reason,action);
    let generation=0,disposed=false,pending=false,current=null;
    function render(value) {current=normalizeHealth(value);state.textContent=current.label;reason.textContent=current.reason;reason.hidden=current.state==='working';element.dataset.state=current.state;action.textContent=current.action?.label||'';action.hidden=!current.action;action.disabled=pending;}
    async function refresh() {
      if(disposed)return;const ticket=++generation;
      try {const value=await getHealth();if(!disposed&&ticket===generation)render(value);}
      catch {if(!disposed&&ticket===generation)render(null);}
    }
    const click=async()=>{
      if(disposed||pending||!current?.action)return;
      const run=current.action.run;pending=true;action.disabled=true;
      try {await run();}catch {if(!disposed)notify('The recovery action did not complete. Open diagnostics for details.');}
      finally {pending=false;if(!disposed){action.disabled=false;await refresh();}}
    };
    element.refreshHealth=refresh;state.setAttribute('role','status');
    action.addEventListener('click',click);render(null);refresh();
    return {element,refresh,dispose(){disposed=true;++generation;action.removeEventListener('click',click);}};
  }
  return Object.freeze({normalizeHealth,createHealthControls});
})();

/* Feature/context isolation and bounded single-flight recovery. */
const ExpRecoveryControl = (() => {
  function createRecoveryGuard({limit=3,windowMs=120000,now=Date.now}={}) {
    const contexts=new Map();let disposed=false;
    const record=(feature,context)=>{let features=contexts.get(context);if(!features){features=new Map();contexts.set(context,features);}let value=features.get(feature);if(!value){value={times:[],suspended:false,retryPending:false,lastFailureAt:null};features.set(feature,value);}return value;};
    const view=value=>({suspended:value.suspended,consecutiveFailures:value.times.length,retryPending:value.retryPending,lastFailureAt:value.lastFailureAt});
    function failed(feature,context){const value=record(feature,context),time=now();value.times=value.times.filter(at=>time-at<=windowMs);value.times.push(time);value.times=value.times.slice(-limit);value.lastFailureAt=time;if(value.times.length>=limit)value.suspended=true;return view(value);}
    function succeeded(feature,context){const value=record(feature,context);value.times=[];value.suspended=false;return view(value);}
    async function retry(feature,context,run){
      if(disposed||typeof run!=='function')return false;const value=record(feature,context);if(value.retryPending)return false;value.retryPending=true;
      const isCurrent=()=>!disposed&&contexts.get(context)?.get(feature)===value;
      try {const result=await run();if(!isCurrent()||result===false)return false;succeeded(feature,context);return true;}
      catch(error){if(isCurrent())failed(feature,context);throw error;}
      finally {value.retryPending=false;}
    }
    return Object.freeze({failed,succeeded,snapshot:(feature,context)=>view(record(feature,context)),retry,clearContext:context=>contexts.delete(context),dispose(){disposed=true;contexts.clear();}});
  }
  return Object.freeze({createRecoveryGuard});
})();

// Approved dense web menu. Product engines, palettes and original control nodes stay owned by products.
const ExpMenuLayout = (() => {
  const S=':host :is(#tdh-tools-dock,[data-exp-menu-layout="lean"])[data-exp-menu-layout="lean"]';
  const C=S+' .exp-menu-content';
  const css=`
    ${S}{box-sizing:border-box!important;padding:0!important;border:1px solid color-mix(in srgb,var(--theme-text) 18%,transparent)!important;border-radius:12px!important;background:var(--theme-bg)!important;background-image:none!important;box-shadow:0 16px 40px #0004!important;color:var(--theme-text)!important;font:400 13px/1.4 "Segoe UI",system-ui,sans-serif!important;text-align:start!important;letter-spacing:0!important;transition:none!important;overflow:hidden!important;max-height:calc(100dvh - 16px)!important;height:auto!important;flex-direction:column!important}
    ${S}.fl-rail-open:not([hidden]){display:flex!important}
    ${S} *{box-sizing:border-box}
    ${S} .menu-head{display:flex!important;align-items:center!important;gap:4px!important;width:100%!important;min-height:48px!important;margin:0!important;padding:2px 4px 2px 10px!important;border:0!important;border-bottom:1px solid color-mix(in srgb,var(--theme-text) 8%,transparent)!important;background:color-mix(in srgb,var(--theme-panel) 60%,var(--theme-bg))!important;flex:none!important}
    ${S} .header-brand{display:flex!important;align-items:center!important;gap:7px!important;flex:1!important;min-width:0!important}
    ${S} .header-icon{flex:0 0 24px!important;width:24px!important;height:26px!important;border:0!important;background:transparent!important;overflow:hidden!important}
    ${S} .header-icon .menu-icon{width:24px!important;height:26px!important;object-fit:contain!important}
    ${S} .header-copy{min-width:0!important;overflow:visible!important}
    ${S} .header-title-row{display:flex!important;align-items:center!important;gap:0!important;flex-wrap:wrap!important}
    ${S} :is(.header-title-row h2,[data-exp-part=title],#tdh-rail-title){margin:0!important;font-size:14px!important;font-weight:600!important;line-height:1.2!important}
    ${S} :is([data-exp-part=subtitle],#tdh-rail-subtitle,.header-divider,.exp-menu-tagline){display:none!important}
    ${S} .header-actions{display:flex!important;align-items:center!important;gap:0!important;flex:none!important}
    ${S} :is(.support-button,[data-exp-part=close],[data-exp-part=version],#tdh-header-version,#tdh-rail-close){display:grid!important;place-items:center!important;flex:none!important;width:36px!important;height:36px!important;min-width:36px!important;min-height:36px!important;margin:0 1px!important;padding:0!important;border:0!important;border-radius:6px!important;background:transparent!important;color:var(--theme-muted)!important;box-shadow:none!important}
    ${S} :is(.support-button,[data-exp-part=close],[data-exp-part=version],#tdh-header-version,#tdh-rail-close):hover{background:color-mix(in srgb,var(--theme-text) 9%,transparent)!important;color:var(--theme-text)!important}
    @media(pointer:coarse){${S} :is(.support-button,[data-exp-part=close],[data-exp-part=version],#tdh-header-version,#tdh-rail-close){width:44px!important;height:44px!important;min-width:44px!important;min-height:44px!important}}
    ${S} :is([data-exp-part=version],#tdh-header-version){position:relative!important;display:block!important;font-size:13px!important;line-height:1.4!important}
    ${S} .exp-changelog-icon{display:block;position:absolute;inset:0;margin:auto;width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.7}
    ${S} [data-exp-part=status]{font-size:12px!important;margin-top:2px!important}
    ${S}>nav{padding:0!important;margin:0!important}
    ${S} .exp-section-icon{display:block!important;width:15px!important;height:15px!important;flex:none!important;transform:none!important;background:none!important;color:var(--theme-accent)!important}
    ${S} .exp-section-icon svg{display:block;width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.7}
    ${C}{display:flex!important;flex-direction:column!important;gap:6px!important;padding:8px!important;min-width:0!important;min-height:0!important;max-height:calc(100dvh - 72px)!important;overflow:auto!important;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:color-mix(in srgb,var(--theme-text) 25%,transparent) transparent;background:var(--theme-bg)!important}
    /* Filing cabinet: each section is a drawer; its header is the drawer front with a finger pull on the right. */
    ${C} .fl-tool-panel{flex:none!important;margin:0!important;padding:0!important;border:1px solid color-mix(in srgb,var(--theme-line) 40%,transparent)!important;border-radius:8px!important;background:var(--theme-panel)!important;box-shadow:none!important;overflow:clip!important;min-width:0!important}
    ${C} .fl-tool-panel>.fl-tool-header{position:relative!important;display:flex!important;align-items:center!important;gap:8px!important;width:100%!important;min-height:38px!important;margin:0!important;padding:8px 46px 8px 10px!important;border:0!important;border-radius:0!important;background:var(--theme-panel)!important;color:var(--theme-text)!important;font:600 13px/1.3 "Segoe UI",system-ui,sans-serif!important;text-align:start!important;box-shadow:none!important;cursor:pointer}
    ${C} .fl-tool-panel>.fl-tool-header::after{content:'';position:absolute;right:9px;top:50%;width:28px;height:14px;transform:translateY(-50%);border-radius:7px 7px 4px 4px;background:var(--theme-inset);box-shadow:inset 0 2px 3px #0004}
    ${C} .fl-tool-panel>.fl-tool-header :is(.fl-tool-chevron,.chevron){display:none!important}
    /* Where the header is not itself a button (Dropper), its chevron button stays the keyboard control, stretched invisibly across the front. */
    ${C} .fl-tool-panel>.fl-tool-header:not(button)>button.fl-tool-chevron{display:block!important;position:absolute!important;inset:0!important;z-index:1!important;width:auto!important;height:auto!important;min-height:0!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;color:transparent!important;font-size:0!important;box-shadow:none!important;cursor:pointer}
    ${C} .fl-tool-panel>.fl-tool-header:not(button)>button.fl-tool-chevron:focus-visible{outline:2px solid var(--theme-focus,var(--theme-accent))!important;outline-offset:-2px!important}
    ${C} .fl-tool-panel>.fl-tool-header .fl-tool-title{flex:1;min-width:0;font:inherit!important;color:inherit!important}
    ${C} .fl-tool-panel>.fl-tool-header[aria-expanded=true]{position:sticky!important;top:-8px;z-index:2;color:var(--theme-accent)!important;border-bottom:1px solid color-mix(in srgb,var(--theme-line) 30%,transparent)!important;box-shadow:0 2px 4px -2px #0004!important}
    ${C} .fl-tool-panel>.fl-tool-header[aria-expanded=true]::after{background:color-mix(in srgb,var(--theme-accent) 22%,var(--theme-inset))}
    ${C} :is(.route-body,.fl-tool-body){margin:0!important;padding:7px!important;border:0!important;border-radius:0!important;min-width:0!important;background:var(--theme-inset)!important;box-shadow:inset 0 4px 6px -3px #0003!important}
    ${C} :is(.route-body,.fl-tool-body):is([hidden],.fl-tool-hidden){display:none!important}
    ${C} :is(.exp-settings-group,.section,.group){min-width:0!important;border:0!important;border-radius:7px!important;margin:0 0 6px!important;padding:0!important;background:var(--theme-panel)!important;box-shadow:none!important;overflow:hidden}
    ${C} :is(.route-body,.fl-tool-body)>:last-child{margin-bottom:0!important}
    /* An inner group is a smaller drawer inside the open one. */
    ${C} details{min-width:0!important;margin:0 0 6px!important;padding:0!important;border:1px solid color-mix(in srgb,var(--theme-line) 40%,transparent)!important;border-radius:7px!important;background:var(--theme-panel)!important;box-shadow:none!important;overflow:clip}
    ${C} details[open]>:not(summary){margin-inline:7px}
    ${C} details[open]>:not(summary):first-of-type{margin-top:7px}
    ${C} details[open]{padding-bottom:7px!important;background:color-mix(in srgb,var(--theme-inset) 60%,var(--theme-panel))!important}
    ${C} :is(.row,.mini-row,.fl-switch,.setting-row){display:flex!important;align-items:center!important;min-width:0!important;min-height:26px!important;gap:4px!important;padding:2px 8px!important;margin:0!important;border:0!important;border-bottom:1px solid color-mix(in srgb,var(--theme-text) 8%,transparent)!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;font-size:13px!important;line-height:1.4!important}
    ${C} :is(.row,.mini-row,.fl-switch,.setting-row):last-child{border-bottom:0!important}
    ${C} :is(.copy,.row-copy,.fl-switch-text,.setting-row>span,.mini-row>span){flex:1;min-width:0!important}
    ${C} :is(.label,.setting-label,.fl-switch-text,.copy>strong,.row-copy>strong,.mini-row>span,.row>span){font-size:13px!important;line-height:1.4!important;font-weight:400!important;white-space:normal!important;overflow-wrap:break-word!important}
    ${C} :is(.copy>.help,.row-copy>small,.row-help,.setting-help){display:none!important}
    ${C} :is(.row,.mini-row,.setting-row):has(>.exp-native-popup),${C} :is(.row,.mini-row,.setting-row):has(>input:not([type=range])){display:grid!important;grid-template-columns:minmax(0,1fr) fit-content(58%)!important;gap:4px!important}
    ${C} :is(button,input,select,textarea){font-family:inherit!important;font-size:13px!important;line-height:1.4!important;max-width:100%!important;min-width:0!important;color:var(--theme-text)!important;box-shadow:none!important}
    ${C} button:not([role=switch]),${C} :is(input:not([type=range]),textarea){min-height:26px!important;height:auto!important;margin:0!important;padding:2px 8px!important;border:1px solid color-mix(in srgb,var(--theme-text) 23%,transparent)!important;border-radius:6px!important;background:color-mix(in srgb,var(--theme-text) 7%,var(--theme-panel))!important;font-weight:400!important;white-space:normal!important;text-align:center!important}
    ${C} :is(input:not([type=range]),textarea){width:100%!important;text-align:start!important}
    ${C} button[role=switch]{position:relative!important;flex:0 0 34px!important;width:34px!important;min-width:34px!important;max-width:34px!important;height:24px!important;min-height:24px!important;max-height:24px!important;padding:0!important;border:0!important;border-radius:4px!important;background:transparent!important;box-shadow:none!important}
    ${C} button[role=switch]::before{content:'';position:absolute;inset:4px 1px;border:0!important;border-radius:4px!important;background:color-mix(in srgb,var(--theme-text) 18%,var(--theme-panel))!important}
    ${C} button[role=switch]::after{content:'';position:absolute!important;top:6px!important;left:3px!important;width:12px!important;height:12px!important;border:0!important;border-radius:2px!important;background:var(--theme-text)!important;transform:none!important}
    ${C} button[role=switch][aria-checked=true]::before{background:var(--theme-accent2)!important}
    ${C} button[role=switch][aria-checked=true]::after{left:19px!important;background:var(--theme-bg)!important}
    ${C} button[role=switch]>span{display:none!important}
    ${C} .mini-row:has(#tdh-switch-policy){grid-template-columns:minmax(0,1fr) fit-content(70%)!important}
    ${C} .exp-native-popup{position:relative!important;display:block!important;min-width:0!important;width:100%!important;max-width:100%!important;border-radius:6px!important;flex:none!important}
    ${C} .exp-native-popup>select{position:absolute!important;inset:0!important;opacity:0!important;width:100%!important;height:100%!important;min-height:0!important;max-width:100%!important;min-width:0!important;margin:0!important;padding:0!important;z-index:1;cursor:pointer}
    ${C} .exp-select-face{position:relative;display:block;align-content:center;min-height:26px;width:auto;padding:2px 22px 2px 4px;font-size:13px!important;line-height:1.4!important;white-space:normal!important;overflow-wrap:anywhere!important;color:var(--theme-text)!important;pointer-events:none}
    ${C} .exp-select-face::after{content:'';position:absolute;right:6px;top:calc(50% - 5px);width:6px;height:6px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(45deg)}
    ${C} .exp-native-popup:focus-within{outline:2px solid var(--theme-focus,var(--theme-accent2));outline-offset:1px}
    ${C} .exp-native-popup:has(select:disabled){opacity:.45}
    ${C} option{background:var(--theme-panel)!important;color:var(--theme-text)!important}
    ${C} details>summary{position:relative!important;display:flex!important;align-items:center!important;gap:4px!important;min-height:32px!important;padding:6px 40px 6px 9px!important;margin:0!important;font-size:12.5px!important;line-height:1.4!important;font-weight:600!important;list-style:none!important;background:var(--theme-panel)!important;color:var(--theme-text)!important;cursor:pointer}
    ${C} details>summary::-webkit-details-marker{display:none}
    ${C} details>summary::before{display:none!important}
    ${C} details>summary::after{content:'';position:absolute;right:8px;top:50%;width:22px;height:11px;transform:translateY(-50%);border-radius:6px 6px 3px 3px;background:var(--theme-inset);box-shadow:inset 0 2px 3px #0004}
    ${C} details[open]>summary{color:var(--theme-accent)!important;border-bottom:1px solid color-mix(in srgb,var(--theme-line) 30%,transparent)!important}
    ${C} details[open]>summary::after{background:color-mix(in srgb,var(--theme-accent) 22%,var(--theme-inset))}
    ${C} details>summary:has(>.campaign-manager-title),${C} details>summary:has(>#tdh-eligibility-summary){display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;column-gap:4px!important;row-gap:0!important;align-items:center!important}
    ${C} details>summary>:is(.campaign-manager-title,#tdh-eligibility-summary){grid-column:1!important;grid-row:1!important}
    ${C} details>summary>:is(.campaign-manager-summary,.eligibility-checklist-count,.unclaimed-badge){grid-column:1!important;justify-self:start!important;text-align:left!important}
    ${C} details>summary:is(:has(>.campaign-manager-title),:has(>#tdh-eligibility-summary))::after{grid-column:2!important;grid-row:1/span 3!important;align-self:center!important;margin-left:0!important}
    ${C} details .exp-settings-group{margin:0!important;background:transparent!important}
    ${C} :is(.actions,.button-grid,.action-pair,.settings-transfer,.rc-menu-actions,.profile-actions){display:flex!important;gap:4px!important;flex-wrap:wrap!important;padding:4px 8px!important;margin:0!important}
    ${C} :is(.actions,.button-grid,.action-pair)>*{flex:1;min-width:0}
    ${C} :is(h2,h3){font-size:13px!important;line-height:1.4!important;margin:0!important;padding:8px 8px 2px!important;color:var(--theme-text)!important}
    ${C} :is(p,.empty,.note){font-size:13px!important;line-height:1.5!important;white-space:normal!important;overflow-wrap:anywhere!important;margin:6px 0!important;padding-inline:8px!important;color:var(--theme-text)!important}
    ${C} :is(form,.identity,.exp-health){padding:8px!important;gap:4px!important}
    ${C} form label:has(>.exp-native-popup){display:grid!important;grid-template-columns:minmax(0,1fr) fit-content(58%)!important;gap:4px!important;align-items:center!important}
    ${C} :is(.row,.mini-row,.setting-row):has(>input[type=number]){grid-template-columns:minmax(0,1fr) 64px!important}
    ${C} :is(.row,.mini-row,.setting-row):has(>input:not([type=number],[type=range],[type=time],[type=color],[hidden])){grid-template-columns:minmax(0,1fr)!important}
    ${C} .action-stack{flex-direction:column!important;align-items:stretch!important}
    ${C} .action-stack>*{width:100%!important}
    ${C} .exp-native-popup:has(select[data-exp-full-width]){width:100%!important}
    ${C} .queue-switches{display:block!important}
    ${C} [data-exp-system-item=support] .action-pair{display:grid!important;grid-template-columns:minmax(0,1fr) auto auto!important;align-items:center!important;gap:4px!important;padding:4px 0 4px 8px!important}
    ${C} [data-exp-system-item=support] .action-pair>button{flex:none!important;padding:2px 10px!important;overflow-wrap:normal!important;word-break:normal!important}
    ${C} [data-exp-system-report]{display:block!important;width:100%!important;text-align:center!important;justify-content:center!important}
    ${C} [data-exp-system-item=preferences]{margin-top:8px!important}
    ${C} [data-exp-system-item=reset]{margin-top:12px!important;padding-top:0!important}
    ${C} [data-exp-system-item=reset]>button{display:block!important;width:100%!important;min-height:32px!important;padding:4px 8px!important;background:transparent!important;color:color-mix(in srgb,#d0222d 60%,var(--theme-text))!important;border:1px solid color-mix(in srgb,#d0222d 50%,transparent)!important}
    ${C} [data-exp-system-item=reset]>button[data-exp-reset-armed]{background:#b4232a!important;color:#fff!important;border-color:#971b21!important}
    ${C} [data-exp-diagnostics-label]{flex:none!important;font-size:13px!important;line-height:1.4!important;color:var(--theme-text)!important}
    ${C} [data-exp-system-item=reset]>p:empty{display:none!important}
    ${C} .setting-row:has(>input[aria-label="Content width (px)"]),${C} .setting-row:has(select[aria-label=Names]){grid-template-columns:minmax(0,1fr) 56px!important}
    ${S} :is(button,input,select,textarea,summary):focus-visible{outline:2px solid var(--theme-focus,var(--theme-accent2))!important;outline-offset:2px!important}
    ${S} ::selection{background:var(--theme-accent)!important;color:var(--theme-text)!important}
    .exp-floating-update,.update-notice[data-placement="menu"]{max-height:calc(100dvh - 16px)!important;overflow:auto;overscroll-behavior:contain;background:var(--exp-notice-top,var(--theme-bg))!important;background-image:none!important;border-color:var(--exp-notice-border,var(--theme-muted))!important;border-radius:7px!important;box-shadow:0 4px 10px #0003!important;font-size:12px!important}
    .update-notice :is(.update-text,.update-list){overflow-wrap:anywhere;line-height:1.5}
    ${C} .row:has([data-exp-adapter-health=healthy]){display:none!important}
    ${S} [hidden]{display:none!important}
    @media(forced-colors:active){${S} :is(button,input,select,textarea,summary){forced-color-adjust:auto!important;border-color:ButtonText!important}${C} button[role=switch]::before{background:ButtonFace!important;border:1px solid ButtonText!important}${C} button[role=switch][aria-checked=true]::before{background:Highlight!important}${C} button[role=switch]::after{background:ButtonText!important}${C} [data-exp-system-item=reset]>button{background:ButtonFace!important;color:ButtonText!important}}
  `;
  const paths={gift:'M3 7h14v4H3Zm2 4v7h10v-7M10 7v11M10 7C4 7 4 1 7 2c3 0 3 5 3 5Zm0 0c6 0 6-6 3-5-3 0-3 5-3 5Z',sliders:'M3 5h14M3 10h14M3 15h14M7 3v4m6 1v4m-8 1v4',system:'M10 4.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Zm0 3.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm0-6v2.5m0 11V18M2 10h2.5m11 0H18M4.34 4.34l1.77 1.77m7.78 7.78 1.77 1.77m0-11.32-1.77 1.77m-7.78 7.78-1.77 1.77',brush:'m4 15 9-11 3 3-9 10H3v-3',shield:'M10 2 3 5v5c0 4 7 8 7 8s7-4 7-8V5Z',bag:'M4 6h12v12H4ZM7 6V4a3 3 0 0 1 6 0v2',sparkle:'m10 2 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z',feed:'M3 3h14v14H3ZM6 6h8M6 10h8m-8 4h5',read:'M3 3h6l1 2 1-2h6v14h-6l-1 1-1-1H3Zm7 2v13',filter:'M3 4h14l-5 6v7l-4-2v-5Z',screen:'M2 4h16v10H2Zm5 13h6m-3-3v3',globe:'M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM2 10h16M10 2c3 3 3 13 0 16M10 2c-3 3-3 13 0 16',people:'M7 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5 8v-3a5 5 0 0 1 10 0v3m1-9a3 3 0 0 0 0-6m1 9a4 4 0 0 1 4 4v2'};
  const iconFor={campaigns:'gift',drops:'gift',settings:'sliders',advanced:'sliders',look:'brush',appearance:'brush',system:'system',protect:'shield',protection:'shield',amazon:'bag',walmart:'bag',ebay:'bag',etsy:'bag',target:'bag','best buy':'bag',retailer:'bag',highlights:'sparkle',feed:'feed',read:'read',filters:'filter',people:'people',streams:'screen','current site':'globe',site:'globe'};
  function mount({panel}){
    const doc=panel.ownerDocument,view=doc.defaultView,wrapped=new Map(),groups=new Set(),icons=new Set(),moves=[];
    const updateFace=select=>{const face=wrapped.get(select)?.face;if(face){const original=select.selectedOptions[0]?.textContent||'',text=({automatic:'Auto','follow system':'System','inherit global':'Global','original text':'Original','announce on focus':'On Focus','follow campaign order':'Campaign Order','keep an earning stream':'Keep Earning','manual stream protected':'Manual Hold'})[original.toLowerCase()]||original;if(face.textContent!==text)face.textContent=text;}};
    function decorate(){
      const version=panel.querySelector('[data-exp-part=version],#tdh-header-version'),actions=panel.querySelector('.header-actions');
      if(version&&!/changelog/i.test(version.getAttribute('aria-label')||'')){const name=panel.querySelector('[data-exp-part=title],#tdh-rail-title')?.textContent.trim()||'';version.setAttribute('aria-label',('View '+name+' '+version.textContent.trim()+' Changelog').trim());}
      if(version&&actions&&!actions.contains(version)){moves.push([version,version.parentNode,version.nextSibling]);actions.prepend(version);}
      if(version&&actions&&actions.firstElementChild!==version)actions.prepend(version);
      if(version)for(const node of [...version.childNodes])if(node.nodeType===3&&node.textContent.trim()){const label=doc.createElement('span');label.hidden=true;label.dataset.expVersionLabel='1';node.before(label);label.append(node);}
      if(version&&!version.querySelector('.exp-changelog-icon')){const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg'),p=doc.createElementNS('http://www.w3.org/2000/svg','path');svg.classList.add('exp-changelog-icon');svg.setAttribute('viewBox','0 0 20 20');svg.setAttribute('aria-hidden','true');p.setAttribute('d','M4 3h12v14H4ZM7 7h6m-6 3h6m-6 3h4');svg.append(p);version.prepend(svg);}
      // Drawer fronts carry the section's icon in the product accent.
      for(const header of panel.querySelectorAll('.exp-menu-content>.fl-tool-panel>.fl-tool-header')){
        if(header.querySelector('[data-exp-layout-icon]'))continue;const name=iconFor[(header.querySelector('.fl-tool-title')||header).textContent.trim().toLowerCase()]||'system';
        let span=header.querySelector('.exp-section-icon');if(!span){span=doc.createElement('span');icons.add(span);}const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg'),p=doc.createElementNS('http://www.w3.org/2000/svg','path');span.className='exp-section-icon';span.setAttribute('aria-hidden','true');span.dataset.expLayoutIcon='1';svg.setAttribute('viewBox','0 0 20 20');p.setAttribute('d',paths[name]);p.setAttribute('stroke-linecap','round');p.setAttribute('stroke-linejoin','round');svg.append(p);span.replaceChildren(svg);if(!header.contains(span))header.prepend(span);
      }
      const content=panel.querySelector('.exp-menu-content');if(!content)return;
      for(const select of content.querySelectorAll('select')){
        if(!wrapped.has(select)){const focused=select.getRootNode().activeElement===select,wrap=doc.createElement('span'),face=doc.createElement('span');wrap.className='exp-native-popup';face.className='exp-select-face';face.setAttribute('aria-hidden','true');select.before(wrap);wrap.append(select,face);wrapped.set(select,{wrap,face});if(focused)select.focus({preventScroll:true});}updateFace(select);
      }
      for(const [select]of wrapped)if(!panel.contains(select))wrapped.delete(select);
      const rowSelector='.row,.mini-row,.fl-switch,.setting-row';
      const parents=new Set([...content.querySelectorAll(rowSelector)].map(n=>n.parentElement));
      for(const parent of parents){if(parent.classList.contains('exp-settings-group'))continue;let group=null;for(const child of [...parent.children]){if(child.matches(rowSelector)){const focused=panel.getRootNode().activeElement;if(!group){group=doc.createElement('div');group.className='exp-settings-group';child.before(group);groups.add(group);}group.append(child);if(focused&&child.contains(focused))focused.focus({preventScroll:true});}else group=null;}}
      for(const group of groups)if(!panel.contains(group))groups.delete(group);
    }
    const changed=e=>{if(e.target.tagName==='SELECT')updateFace(e.target);};panel.addEventListener('change',changed);panel.addEventListener('input',changed);
    decorate();const observer=new view.MutationObserver(decorate);observer.observe(panel,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['disabled','selected']});
    return()=>{observer.disconnect();icons.forEach(icon=>icon.remove());panel.removeEventListener('change',changed);panel.removeEventListener('input',changed);for(const [select,{wrap}]of wrapped){if(wrap.contains(select))wrap.replaceWith(select);}for(const group of groups)group.replaceWith(...group.childNodes);for(const [node,parent,next]of moves)if(parent.isConnected)parent.insertBefore(node,next?.parentNode===parent?next:null);};
  }
  return Object.freeze({css,mount});
})();

// Layout and surfaces from the approved Lean menu, with the shared Slate Blue palette.
const ExpLeanMenu = (() => {
  // The shell is shared by existing products and new createProduct/createMenuController consumers.
  const template=Object.freeze({id:'extrapotions-menu',version:1,layout:'sidebar',systemLayout:'grouped',supportNavigation:'system',resetNavigation:'system',donations:'header-heart'});
  const sectionIcons = Object.freeze({campaigns:'gift',settings:'sliders',drops:'gift',streams:'screen',appearance:'brush',advanced:'sliders',system:'system',highlights:'sparkle',protection:'shield',amazon:'bag'});
  const css = ExpMenuLayout.css;
  // Healthy operation needs no narration; abnormal state remains visible in the open menu.
  const statusSources=new Map(),statusPanels=new Map();
  function setMenuStatus(id,getHealth){
    if(typeof getHealth!=='function')throw new TypeError('Menu status needs a health function');
    statusSources.set(String(id).toLowerCase(),getHealth);
    for(const refresh of statusPanels.get(String(id).toLowerCase())||[])refresh();
  }
  function mount({shadow,panel}) {
    const document=panel.ownerDocument,host=shadow.host;
    const id=host?.dataset.productId||host?.id.replace(/^(exp-)|(\-root)$/g,'').replace(/^tdh$/,'dropper');
    const saved=new Map();panel.dataset.expMenuLayout='lean';panel.dataset.expMenuTemplate=template.id+'-v'+template.version;
    const properties=['--exp-menu-hover','background-image'];
    for(const property of properties)saved.set(property,[panel.style.getPropertyValue(property),panel.style.getPropertyPriority(property)]);
    function applyPalette(){
      for(const[key,[value,priority]]of saved){if(value)panel.style.setProperty(key,value,priority);else panel.style.removeProperty(key);}
      panel.style.setProperty('background-image','none','important');
      panel.style.setProperty('--exp-menu-hover','color-mix(in srgb,var(--theme-accent) 12%,var(--theme-panel))');

    }
    applyPalette();
    const style=document.createElement('style');style.dataset.expLeanMenu='1';style.textContent=css;shadow.append(style);const disposeLayout=ExpMenuLayout.mount({panel});
    const status=document.createElement('div');status.dataset.expPart='status';status.setAttribute('role','status');
    const dot=document.createElement('span');dot.className='exp-status-dot';const statusText=document.createElement('span');statusText.className='exp-status-text';status.append(dot,statusText);
    let statusTicket=0,statusTimer=0;
    async function refreshStatus(){
      const source=statusSources.get(id);
      if(!source){delete panel.dataset.expMenuStatus;status.remove();return;}
      const copy=panel.querySelector('.header-copy');
      if(!copy){delete panel.dataset.expMenuStatus;status.remove();return;}
      if(!copy.contains(status))copy.append(status);
      if(panel.dataset.expMenuStatus!=='1')panel.dataset.expMenuStatus='1';const ticket=++statusTicket;
      let value=null;try{value=await source();}catch{}
      if(ticket!==statusTicket)return;
      const health=ExpHealthSummary.normalizeHealth(value);
      status.hidden=health.state==='working'||(id==='dropper'&&health.state==='waiting');
      status.setAttribute('aria-description',health.reason);
      // Unchanged values are not written again, so observers and screen readers are not woken every poll.
      if(dot.dataset.state!==health.state)dot.dataset.state=health.state;
      if(statusText.textContent!==health.label)statusText.textContent=health.label;
    }
    if(!statusPanels.has(id))statusPanels.set(id,new Set());statusPanels.get(id).add(refreshStatus);
    // Polls only while the menu is on screen. Products show it by the hidden attribute, a class (Dropper's
    // dock, WARD's shell) or an ancestor; the resize observer sees the panel gain or lose its box.
    const shown=()=>!panel.hidden&&panel.getClientRects().length>0;
    let statusShown=shown();
    // A product that hides and shows the panel in one task leaves no hidden state to observe;
    // the hidden attribute's old value still says the menu was reopened.
    function followVisibility(reopened=false){
      const now=shown();if(now===statusShown&&!(now&&reopened))return;statusShown=now;
      clearInterval(statusTimer);statusTimer=0;
      if(now){refreshStatus();statusTimer=setInterval(refreshStatus,10000);}
    }
    const visibility=new MutationObserver(records=>followVisibility(records.some(record=>record.attributeName==='hidden'&&record.oldValue!==null)));
    visibility.observe(panel,{attributes:true,attributeOldValue:true,attributeFilter:['hidden','class','style']});
    const visibilityResize=new ResizeObserver(()=>followVisibility());visibilityResize.observe(panel);
    refreshStatus();if(statusShown)statusTimer=setInterval(refreshStatus,10000);
    const icons=new Set();
    function decorate(){
      for(const header of panel.querySelectorAll('.fl-tool-header')){
        if(header.querySelector('.exp-section-icon'))continue;
        const title=header.querySelector('.fl-tool-title');if(!title)continue;
        const name=sectionIcons[title.textContent.trim().toLowerCase()];if(!name)continue;
        const icon=document.createElement('span');icon.className='exp-section-icon';icon.setAttribute('aria-hidden','true');
        icon.dataset.icon=name;header.prepend(icon);icons.add(icon);
      }
    }
    decorate();const observer=new MutationObserver(decorate);observer.observe(panel,{childList:true,subtree:true});
    return ()=>{disposeLayout();visibility.disconnect();visibilityResize.disconnect();clearInterval(statusTimer);statusPanels.get(id)?.delete(refreshStatus);status.remove();delete panel.dataset.expMenuStatus;observer.disconnect();icons.forEach(icon=>icon.remove());style.remove();for(const[key,[value,priority]]of saved){if(value)panel.style.setProperty(key,value,priority);else panel.style.removeProperty(key);}delete panel.dataset.expMenuLayout;delete panel.dataset.expMenuTemplate;};
  }
  return Object.freeze({mount,setMenuStatus,template});
})();

// Descriptions belong to settings and consequential actions, not ordinary navigation.
const ExpMenuHelp = (() => {
  let serial=0;
  function setMenuHelp(node,text){
    if(!node||!String(text||'').trim())return node;
    node.dataset.expHelp=String(text).trim();
    node.setAttribute('aria-description',node.dataset.expHelp);
    // Native labels must not become competing help buttons on touch.
    if(!node.closest('label')&&!node.matches('button,input,select,a[href],summary')){node.tabIndex=0;node.setAttribute('role','button');}
    return node;
  }
  function mount({shadow,panel}){
    const doc=panel.ownerDocument,view=doc.defaultView;
    const tip=doc.createElement('div');tip.id='exp-menu-help-'+(++serial);tip.className='exp-menu-help';tip.role='tooltip';tip.hidden=true;
    const style=doc.createElement('style');style.dataset.expMenuHelp='1';
    style.textContent='.exp-menu-help{position:fixed;z-index:2147483647;box-sizing:border-box;max-width:260px;padding:8px 10px;border:1px solid var(--theme-line,#938f99);border-radius:7px;background:var(--theme-panel,#211f26);color:var(--theme-text,#e6e0e9);font:400 12px/1.5 "Segoe UI",system-ui,sans-serif;overflow:auto;overflow-wrap:anywhere;pointer-events:none}.exp-menu-help[hidden]{display:none!important}.exp-menu-help[data-scrollable=true]{pointer-events:auto}.has-tooltip::after{display:none!important}';
    shadow.append(style,tip);
    let target=null,timer=0,frame=0,pointer={x:-1,y:-1};
    const inside=()=>{if(tip.hidden)return false;const r=tip.getBoundingClientRect();return pointer.x>=r.left&&pointer.x<=r.right&&pointer.y>=r.top&&pointer.y<=r.bottom;};
    function hide(){clearTimeout(timer);if(target?.getAttribute('aria-describedby')===tip.id)target.removeAttribute('aria-describedby');target=null;tip.hidden=true;}
    function show(node){
      if(!node?.isConnected)return hide();
      const text=node.dataset.expHelp||node.dataset.tip;if(!text)return;
      const owner=node.closest('[data-exp-part="dock"],[data-exp-part="progress-card"]')||panel;
      const b=owner.getBoundingClientRect(),left=Math.max(8,b.left+6),right=Math.min(view.innerWidth-8,b.right-6),top=Math.max(8,b.top+6),bottom=Math.min(view.innerHeight-8,b.bottom-6);
      if(right<=left||bottom<=top)return hide();
      clearTimeout(timer);if(target&&target!==node)target.removeAttribute('aria-describedby');target=node;target.setAttribute('aria-describedby',tip.id);
      const colors=view.getComputedStyle(owner);for(const key of ['panel','line','text'])tip.style.setProperty('--theme-'+key,colors.getPropertyValue('--theme-'+key));
      // Fixed auto width depends on the previous left offset after resize. Measure
      // intrinsic width first, bounded by the owner, so the final position cannot grow it.
      tip.textContent=text;tip.style.width='max-content';tip.style.maxWidth=(right-left)+'px';tip.style.maxHeight=(bottom-top)+'px';tip.hidden=false;
      const r=node.getBoundingClientRect(),t=tip.getBoundingClientRect();
      tip.style.left=Math.max(left,Math.min(r.left,right-t.width))+'px';
      tip.style.top=Math.max(top,Math.min(r.bottom+t.height+6<=bottom?r.bottom+6:r.top-t.height-6,bottom-t.height))+'px';
      tip.dataset.scrollable=String(tip.scrollHeight>tip.clientHeight);
    }
    const help=node=>node?.closest?.('[data-exp-help],[data-tip]');
    const defer=()=>{clearTimeout(timer);timer=setTimeout(()=>{if(shadow.activeElement!==target&&!inside())hide();},150);};
    const over=e=>{pointer={x:e.clientX,y:e.clientY};const node=help(e.target);if(node&&e.pointerType!=='touch'&&(!inside()||node===target))show(node);};
    const move=e=>{pointer={x:e.clientX,y:e.clientY};if(target&&!inside()&&!target.contains(e.target))defer();};
    const out=e=>{if(help(e.target))defer();};
    const focus=e=>{const node=help(e.target);if(node)show(node);else hide();};
    const click=e=>{const node=help(e.target);if(node){show(node);if(node.matches('[role=button]:not(button)'))e.preventDefault();}else if(!tip.contains(e.target))hide();};
    const key=e=>{if(e.key==='Escape'&&!tip.hidden){hide();e.preventDefault();e.stopImmediatePropagation();return;}const node=help(e.target);if(node?.matches('[role=button]:not(button)')&&['Enter',' '].includes(e.key)){e.preventDefault();show(node);}};
    const layout=e=>{if(target&&!(e?.target instanceof view.Node&&tip.contains(e.target)))show(target);};
    // Menu positioning settles on the next frame after a submenu changes its height.
    const resize=new ResizeObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>layout());});resize.observe(panel);
    for(const [name,fn,capture] of [['pointerover',over],['pointermove',move],['pointerout',out],['focusin',focus],['click',click],['keydown',key,true],['scroll',layout,true]])shadow.addEventListener(name,fn,capture);
    view.addEventListener('resize',layout);view.addEventListener('scroll',layout,true);
    return ()=>{hide();resize.disconnect();cancelAnimationFrame(frame);for(const [name,fn,capture] of [['pointerover',over],['pointermove',move],['pointerout',out],['focusin',focus],['click',click],['keydown',key,true],['scroll',layout,true]])shadow.removeEventListener(name,fn,capture);view.removeEventListener('resize',layout);view.removeEventListener('scroll',layout,true);tip.remove();style.remove();};
  }
  return Object.freeze({setMenuHelp,mount});
})();

// Shared type and alignment for product menus, including custom shells.
const ExpMenuTypography = (() => {
  const css = `
    [data-exp-menu-typography]{font:400 var(--exp-font-size-body,14px)/1.45 "Segoe UI",system-ui,sans-serif!important;text-align:start;letter-spacing:normal}
    [data-exp-menu-typography] :is(button,input,select,textarea){font-family:inherit!important;letter-spacing:normal}
    [data-exp-menu-typography] :is(.row,.mini-row,.fl-switch,.setting-row){gap:12px!important;padding-block:8px!important;align-items:center!important;font-size:var(--exp-font-size-body,14px);line-height:1.4}
    [data-exp-menu-typography] :is(.label,.setting-label,.fl-switch-text,.copy>strong,.row-copy>strong,.mini-row>span){font-size:var(--exp-font-size-body,14px)!important;font-weight:500!important;line-height:1.4!important;letter-spacing:normal;min-width:0}
    [data-exp-menu-typography] :is(.copy>.help,.row-copy>small,.help,.row-help,.note,.empty,.meta){font-size:var(--exp-font-size-small,12px)!important;font-weight:400!important;line-height:1.5!important}
    [data-exp-menu-typography] :is(.copy>.help,.row-copy>small,.row-help){display:block;margin-top:4px}
    [data-exp-menu-typography] :is(.row,.mini-row,.setting-row):has(>select){display:grid!important;grid-template-columns:minmax(0,1fr) minmax(104px,.95fr)!important;column-gap:12px!important}
    [data-exp-menu-typography] :is(.row,.mini-row,.setting-row)>select{width:100%!important;max-width:100%!important;min-width:0!important;justify-self:end}
    [data-exp-menu-typography] select{box-sizing:border-box;min-height:32px!important;padding:5px 8px!important;font-size:var(--exp-font-size-body,14px)!important;line-height:1.4!important;font-weight:400}
    [data-exp-menu-typography] :is(input:not([type=range]):not([type=color]),textarea){font-size:var(--exp-font-size-body,14px)!important;line-height:1.45;min-height:32px}
    [data-exp-menu-typography] .fl-tool-header{align-items:center!important;padding:9px 10px!important;gap:10px}
    [data-exp-menu-typography] .fl-tool-title{font-size:var(--exp-font-size-body,14px)!important;font-weight:600!important;line-height:1.4!important}
    [data-exp-menu-typography] .fl-tool-chevron{flex:none;display:grid;place-items:center;align-self:center;padding:0;width:14px;line-height:1.4}
    [data-exp-menu-typography] .fl-tool-body{padding-inline:10px!important;padding-bottom:10px!important}
    [data-exp-menu-typography] :is(.group>h3,.section>h3,.section>h2,.stream-subsection-label){margin:12px 0 4px!important;font-size:var(--exp-font-size-small,12px)!important;font-weight:600!important;line-height:1.5!important;letter-spacing:normal!important;text-transform:none!important}
    [data-exp-menu-typography] :is(.group,.section):first-child>h3{margin-top:6px!important}
    [data-exp-menu-typography] :is(.fl-tool-body,.route-body) :is(.life-btn,.action,.secondary,.primary,.compact){min-height:32px!important;padding:6px 8px!important;font-size:var(--exp-font-size-body,14px)!important;font-weight:500!important;line-height:1.4!important;text-align:center}
    [data-exp-menu-typography] :is(.button-grid,.actions,.profile-actions,.menu-footer,.diagnostics-controls>div,.rules-transfer){gap:8px!important;align-items:stretch}
    [data-exp-menu-typography] :is(.button-grid,.actions,.profile-actions,.diagnostics-controls)>:is(button,a),[data-exp-menu-typography] .diagnostics-controls>div>button{margin-top:0!important}
    [data-exp-menu-typography] :is(.appearance-group,.exp-system-card,[data-exp-menu-submenu])>summary{display:flex;align-items:center;gap:8px;padding-block:7px;list-style:none;font-size:var(--exp-font-size-body,14px)!important;font-weight:500!important;line-height:1.4!important}
    [data-exp-menu-typography] :is(.appearance-group,.exp-system-card,[data-exp-menu-submenu])>summary::-webkit-details-marker{display:none}
    [data-exp-menu-typography] :is(.appearance-group,.exp-system-card,[data-exp-menu-submenu])>summary::before{content:"▸";flex:0 0 10px;text-align:center}
    [data-exp-menu-typography] :is(.appearance-group,.exp-system-card,[data-exp-menu-submenu])[open]>summary::before{content:"▾"}
    [data-exp-menu-typography] :is(.header-title-row h2,[data-exp-part="title"],#tdh-rail-title){font-size:calc(var(--exp-font-size-body,14px) + 2px)!important;font-weight:700!important;line-height:1.25!important}
    [data-exp-menu-typography] :is([data-exp-part="subtitle"],#tdh-rail-subtitle){font-size:var(--exp-font-size-small,12px)!important;line-height:1.4!important}
    [data-exp-menu-typography] :is([data-exp-part="version"],#tdh-header-version){font-weight:600!important;line-height:1.2!important;font-variant-numeric:tabular-nums}
    [data-exp-menu-typography] :is(output,.status-value,.step-value,.status-check-value){font-variant-numeric:tabular-nums}
  `;
  function mount({shadow,panel}) {
    panel.dataset.expMenuTypography='1';
    const style=document.createElement('style');style.dataset.expMenuTypography='1';style.textContent=css;shadow.append(style);
    const disposeLean=ExpLeanMenu.mount({shadow,panel});
    const disposeHelp=ExpMenuHelp.mount({shadow,panel});
    return ()=>{disposeHelp();disposeLean();style.remove();delete panel.dataset.expMenuTypography;};
  }
  return Object.freeze({mount});
})();

/* Same-origin preferences for product-owned menu surfaces only. */
const ExpMenuPreferences = (() => {
  const key='exp:suite:menu-size',eventName='exp-core:menu-size';
  const sizes=Object.freeze({standard:{body:14,small:12,width:324,cardWidth:272,padding:8,row:7,control:32},compact:{body:14,small:12,width:304,cardWidth:252,padding:7,row:6,control:30},mini:{body:14,small:12,width:280,cardWidth:232,padding:6,row:4,control:28}});
  let memory='compact';
  const valid=value=>Object.hasOwn(sizes,value)?value:'compact';
  function menuSizePreference(){try {const stored=localStorage.getItem(key);memory=valid(stored);}catch {}return memory;}
  function setMenuSizePreference(size){memory=valid(size);try{localStorage.setItem(key,memory);}catch{}document.dispatchEvent(new CustomEvent(eventName,{detail:memory}));return memory;}
  function bindMenuSize({host,shadow,panel,onLayout=()=>{}}){
    const disposeTypography=ExpMenuTypography.mount({shadow,panel});
    function apply(size){
      memory=valid(size);const value=sizes[memory];host.dataset.expMenuSize=memory;
      for(const token of ['padding','row','control'])host.style.setProperty('--exp-menu-'+token,value[token]+'px');
      host.style.setProperty('--exp-font-size-body',value.body+'px');host.style.setProperty('--exp-font-size-small',value.small+'px');host.style.setProperty('--exp-menu-width',value.width+'px');
      for(const select of shadow.querySelectorAll('[data-exp-menu-size-select]')){select.value=memory;select.dispatchEvent(new Event('input',{bubbles:true}));}
      onLayout();
    }
    const changed=event=>apply(event.detail),storage=event=>{if(event.key===key||event.key===null)apply(menuSizePreference());};
    document.addEventListener(eventName,changed);addEventListener('storage',storage);apply(menuSizePreference());
    return ()=>{document.removeEventListener(eventName,changed);removeEventListener('storage',storage);disposeTypography();};
  }
  function createMenuSizeControls(){
    const row=document.createElement('label');row.className='row exp-menu-size';const copy=document.createElement('span');copy.className='copy';
    const title=document.createElement('strong');title.textContent='Menu Size';copy.append(title);
    const select=document.createElement('select');select.setAttribute('aria-label','Menu Size');select.dataset.expMenuSizeSelect='1';
    
    for(const [value,label] of [['standard','Standard'],['compact','Compact'],['mini','Mini']]){const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option);}
    select.value=menuSizePreference();select.addEventListener('change',()=>setMenuSizePreference(select.value));row.append(copy,select);return row;
  }
  return Object.freeze({menuSizePreference,setMenuSizePreference,bindMenuSize,createMenuSizeControls,menuSizeTokens:()=>sizes[menuSizePreference()]});
})();

// Slate Blue site paint shares the menu palette and device-mode resolver.
const ExpSiteColors = (() => {
  const {THEME_MODES,normalizeThemeMode,resolveTheme}=CoreFoundation;
  const sitePalettes=Object.freeze(THEME_MODES.map(id=>Object.freeze({id,name:id[0].toUpperCase()+id.slice(1)})));
  const sitePalette = id => resolveTheme(id);
  function watchSystem(callback){const query=matchMedia('(prefers-color-scheme: dark)');query.addEventListener('change',callback);return ()=>query.removeEventListener('change',callback);}
  function createSiteColors({product,css,inject}){
    const attribute='data-exp-site-colors',scope=`html[${attribute}="${product}"]`,id='exp-site-colors-'+product;
    let current='system',active=false,stopWatching=null,style=null;
    function render(){
      if(!active)return;
      const palette=resolveTheme(current),text=css(palette,scope);
      if(!style?.isConnected){
        style?.remove();
        style=document.getElementById(id)||(inject?inject(text,{expSiteColors:product}):document.createElement('style'));
        style.id=id;style.dataset.expOwned='1';style.dataset.expSiteColors=product;
        if(!style.isConnected)(document.head||document.documentElement).append(style);
      }
      if(style.textContent!==text)style.textContent=text;
      if(document.documentElement.getAttribute(attribute)!==product)document.documentElement.setAttribute(attribute,product);
      document.documentElement.dataset.expSitePalette='slate-blue-'+palette.mode;
    }
    function apply(next){current=normalizeThemeMode(next);active=true;stopWatching??=watchSystem(()=>{if(current==='system')render();});render();}
    function clear(){active=false;stopWatching?.();stopWatching=null;style?.remove();document.getElementById(id)?.remove();style=null;
      if(document.documentElement.getAttribute(attribute)===product){document.documentElement.removeAttribute(attribute);delete document.documentElement.dataset.expSitePalette;}}
    return Object.freeze({apply,clear,refresh:render,palette:()=>active?resolveTheme(current):null});
  }
  function createThemeModeControl({value='system',onChange,label='Menu Theme'}){
    const row=document.createElement('label');row.className='row exp-site-colors';const copy=document.createElement('span');copy.className='copy';
    const title=document.createElement('strong');title.textContent=label;copy.append(title);
    const select=document.createElement('select');select.setAttribute('aria-label',label);select.dataset.expThemeMode='1';
    if(label==='Site Theme')select.dataset.expSiteColorsSelect='1';
    for(const {id,name} of sitePalettes){const option=document.createElement('option');option.value=id;option.textContent=name;select.append(option);}
    
    select.value=normalizeThemeMode(value);select.addEventListener('change',()=>onChange?.(select.value));row.append(copy,select);return row;
  }
  const createSiteColorControl = options => createThemeModeControl({...options,label:'Site Theme'});
  return Object.freeze({sitePalettes,sitePalette,createSiteColors,createSiteColorControl,createThemeModeControl,normalizeThemeMode,resolveTheme});
})();

// Flyout launcher rules shared by every Core copy on a page. Each copy computes the same answer from the
// launcher hosts' attributes alone, so products agree on one launcher without messaging each other.
const ExpLauncherFlyout = (() => {
  // 2: a site's top bar can hold one icon per product instead of the flyout; copies on 1 keep the grid for everyone.
  const PROTOCOL = '2';
  const SUITE_ORDER = Object.freeze(['dropper','ward','thread']);
  // Products that only run on their own sites (Dropper on Twitch, WARD on retailers) lead there.
  const SITE_PRODUCTS = Object.freeze(['dropper','ward','thread']);
  const idOf = host => String(host?.dataset?.productId || '');
  const rank = id => { const index = SUITE_ORDER.indexOf(id); return index < 0 ? SUITE_ORDER.length : index; };
  function isSiteProduct(productId) { return SITE_PRODUCTS.includes(String(productId || '')); }
  function flyoutOrder(hosts = []) {
    return [...new Set([...hosts].map(idOf).filter(Boolean))].sort((a,b) => rank(a) - rank(b) || a.localeCompare(b));
  }
  // An older Core on the page cannot draw tiles, so one launcher without the protocol keeps the grid for everyone.
  function flyoutActive(hosts = []) {
    const list = [...hosts];
    return list.length >= 2 && list.every(host => host?.dataset?.expFlyout === PROTOCOL);
  }
  function leadProduct(hosts = []) {
    const list = [...hosts];
    const site = flyoutOrder(list.filter(host => host?.dataset?.expSiteProduct === '1'));
    return site[0] || flyoutOrder(list)[0] || '';
  }
  return Object.freeze({ PROTOCOL, SUITE_ORDER, SITE_PRODUCTS, isSiteProduct, flyoutOrder, flyoutActive, leadProduct });
})();

// Product-neutral shared runtime. Product engines own their settings, content, and actions.
// exp-core owns shared UI, launcher, diagnostics, update, and coordination behavior.
const ExtraPotionsCore = (() => {
  'use strict';
  const version = '3.17.2';
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
  const SUITE_PRODUCTS = freezeSuiteContract({"thread":{"role":"product","priority":0,"launcherPriority":90,"themePriority":0,"capabilities":["reddit.reading","reddit.local-context","reddit.local-filtering"],"presentationPhases":["visibility","annotate"],"state":{"type":"thread.state-changed","fields":{"active":"boolean","loaded":"count"}},"menuSections":{"main":["feed","read"],"appearance":["look"],"advanced":["filters","people"],"system":["system"]},"repository":"THREAD","rootId":"exp-thread-root"},"dropper":{"role":"flagship","priority":4,"launcherPriority":110,"themePriority":4,"capabilities":["twitch.drops","twitch.campaigns","twitch.progress","twitch.claims","twitch.stream-management"],"presentationPhases":[],"state":{"type":"dropper.state-changed","fields":{"activeReward":"boolean","progressPercent":"percent-nullable","routingState":"token"}},"menuSections":{"main":["drops","streams","campaigns","settings"],"appearance":["appearance"],"advanced":["advanced"],"system":["system"]},"repository":"Dropper","rootId":"tdh-root"},"ward":{"role":"product","priority":2,"launcherPriority":60,"themePriority":1,"capabilities":["retail.classification","retail.cleanup","retail.coupons"],"presentationPhases":["classify","visibility"],"state":{"type":"ward.state-changed","fields":{"active":"boolean","pageType":"token","interventions":"count","hide":"count","dim":"count","collapse":"count","annotate":"count"}},"menuSections":{"main":["protection","amazon","tools"],"appearance":["appearance"],"advanced":["advanced","patterns","advanced-amazon"],"system":["system"]},"repository":"WARD","rootId":"exp-ward-root"}});
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
  const SUITE_SITE_PAUSE_PREFIX = 'exp:v3:suite-site-pause:';
  let suitePauseTimer;
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
  const menuControllers = new WeakMap();
  let noticeSerial = 0;
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
  // One suite size. Placement clamps this preferred width to the viewport.
  function menuWidth() { return ExpMenuPreferences.menuSizeTokens().width; }
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
    .fl-tool-header .fl-tool-chevron{font:var(--exp-font-size-body,13px)/1.42 system-ui}
    .fl-tool-body[hidden]{display:none!important}
    .fl-tool-body>.group,.fl-tool-body>.section,.fl-tool-body>.flat-group{grid-column:1/-1;min-width:0}
    .fl-tool-body :is(.group,.section,.flat-group){display:grid!important;grid-template-columns:minmax(0,1fr)!important}
    .fl-tool-body :is(.group,.section,.flat-group)>*{grid-column:1/-1!important;min-width:0}
    .group,.section,.flat-group{margin:0;padding:0;border:0;background:transparent}
    .group>h3,.section>h3,.section>h2{margin:8px 0 3px;font-size:var(--exp-font-size-small,11px);font-weight:800;color:var(--theme-muted)}
    .group:first-child>h3,.section:first-child>h3{margin-top:6px}
    .group>.row,.section>.row,.flat-group>.row{min-width:0}
    .row>.copy,.row>.row-copy,.row>.setting-label,.row>div:first-child{min-width:0;flex:1}
    .label,.copy>strong,.row-copy>strong,.setting-label{font-size:var(--exp-font-size-body,13px);font-weight:500;line-height:1.25}
    .copy>.help,.row-copy>small,.help,.empty,.note,.meta{font-size:var(--exp-font-size-small,11px);line-height:1.4;color:var(--theme-muted)}
    .copy>.help,.row-copy>small{display:block;margin-top:3px}
    .toggleSwitch{padding:0;min-width:34px;max-width:34px;min-height:20px;max-height:20px}
    .toggleSwitch>span{display:none}
    .row>.life-btn,.mini-row>.life-btn{width:auto;min-width:50px;margin:0;padding:3px 7px}
    .row>select,.mini-row>select{max-width:55%}
    .button-grid,.actions,.profile-actions,.menu-footer,.diagnostics-controls>div,.rules-transfer{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;min-width:0}
    .button-grid>*{min-width:0}
    .life-btn.warn{border-color:#cb6868!important;background:#402020!important;color:#ffd7d7!important}
    input:not([type=file]),textarea{box-sizing:border-box;max-width:100%;min-width:0;border:1px solid var(--theme-line);border-radius:6px;background:var(--theme-inset);color:var(--theme-text);padding:5px 6px;font-size:var(--exp-font-size-body,13px)}
    input[type=search],textarea{width:100%}
    .identity{display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid var(--theme-line)}
    .identity>.copy{flex:1;min-width:0}
    .identity-actions{display:flex;gap:6px;align-items:center}
    .identity-actions>.life-btn{width:auto;margin:0;padding:3px 6px}
    .theme-row{flex-wrap:wrap}
    .exp-theme-swatches{min-width:0}
    .appearance-group,.auth-advanced,.rule-card,.stat-card{grid-column:1/-1;min-width:0;border:1px solid var(--theme-line);border-radius:7px;margin-top:6px;padding:6px;background:var(--theme-inset)}
    summary{cursor:pointer;font-size:var(--exp-font-size-body,13px)}
    .feature-pair,.category-grid{display:block}
    .status-value,output{font-size:var(--exp-font-size-small,11px);color:var(--theme-muted)}
    .live,.sr-only,.status{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
    .toast{position:fixed;z-index:2147483647;right:12px;max-width:calc(100vw - 24px)}
    .update-notice{position:fixed;z-index:2147483647}
    .diag{margin:6px 0 0}
    .diag[hidden]{display:none!important}
    .diag:not([hidden]){display:block}
    .utility-grid,.stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
    .workspace-actions{grid-column:1/-1}
    .setting-arrow,.step-btn{width:25px;min-height:25px;border:1px solid var(--theme-line);border-radius:6px;background:var(--theme-raised);color:var(--theme-text)}
    .step-value{flex:1;text-align:center;font-size:var(--exp-font-size-small,11px)}
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

  function suiteSiteKey(hostname = location.hostname) {
    return `${SUITE_SITE_PAUSE_PREFIX}${String(hostname || 'local-document').trim().toLowerCase()}`;
  }

  // A DOM marker shares a failed persistence write across isolated Core copies on this page.
  function suitePauseFallback(hostname = location.hostname) {
    return [...document.querySelectorAll('meta[data-exp-suite-pause-fallback]')].find(node=>node.dataset.expSuitePauseFallback===suiteSiteKey(hostname));
  }
  function suitePauseValue(hostname = location.hostname) {
    const fallback=suitePauseFallback(hostname);
    if(fallback)return Number(fallback.dataset.until)||0;
    try{return Number(localStorage.getItem(suiteSiteKey(hostname)))||0;}catch{return 0;}
  }
  function suiteSitePausePersisted(hostname = location.hostname) {return !suitePauseFallback(hostname);}
  function suiteSitePaused(hostname = location.hostname) {
    const value=suitePauseValue(hostname);return value===1||value>Date.now();
  }

  function setSuiteSitePaused(paused, hostname = location.hostname, minutes = 0) {
    const host = String(hostname || 'local-document').trim().toLowerCase();
    const value = Boolean(paused);
    const until=value?(Number(minutes)>0?Date.now()+Math.min(1440,Number(minutes))*60000:1):0;
    const fallback=suitePauseFallback(host)||document.createElement('meta');
    fallback.dataset.expOwned='1';fallback.dataset.expSuitePauseFallback=suiteSiteKey(host);fallback.dataset.until=String(until);
    if(!fallback.isConnected)(document.head||document.documentElement).append(fallback);
    try {
      if (value) localStorage.setItem(suiteSiteKey(host),String(until));
      else localStorage.removeItem(suiteSiteKey(host));
      if((Number(localStorage.getItem(suiteSiteKey(host)))||0)===until)fallback.remove();
    } catch {}
    emitSuiteEvent('core', 'suite.site-control', { hostname: host, paused: value });
    scheduleSuitePauseExpiry();
    return value;
  }
  function scheduleSuitePauseExpiry(){clearTimeout(suitePauseTimer);const until=suitePauseValue();if(until>1){suitePauseTimer=setTimeout(()=>{if(suitePauseValue()===until)setSuiteSitePaused(false);else scheduleSuitePauseExpiry();},Math.max(0,until-Date.now()));}}
  addEventListener('storage',event=>{if(event.key!==suiteSiteKey())return;suitePauseFallback()?.remove();emitSuiteEvent('core','suite.site-control',{hostname:String(location.hostname||'local-document').toLowerCase(),paused:suiteSitePaused()});scheduleSuitePauseExpiry();});
  scheduleSuitePauseExpiry();

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

  // Only elements carrying the attribute are parsed; closest() skips the rest natively.
  // Visibility checks call this for every candidate element, so an ancestor-by-ancestor
  // JSON walk cost seconds on deep pages.
  function presentationStateChain(target) {
    const chain = [];
    let node = target instanceof Element ? target : target?.parentElement;
    while (node instanceof Element) {
      node = node.closest(PRESENTATION_STATE_SELECTOR);
      if (!node) break;
      const state = readPresentationState(node);
      if (Object.keys(state).length) chain.push(Object.freeze({ node, state }));
      node = node.parentElement;
    }
    return Object.freeze(chain);
  }

  const PRESENTATION_STATE_SELECTOR = '[data-exp-presentation-state]';
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
    // Roots are delivered in chunks, each a complete epoch through every phase, and the
    // event loop gets a turn whenever a task has run past its budget: listeners do real
    // work per root, and one task holding a whole page's batch froze Reddit for seconds.
    const CHUNK_ROOTS = 32;
    const TASK_BUDGET_MS = 8;
    const flush = () => {
      timer = 0;
      const started = performance.now();
      while (pending.size) {
        const chunk = [];
        for (const entry of pending) {
          pending.delete(entry[0]);
          if (entry[0].isConnected) chunk.push(entry);
          if (chunk.length >= CHUNK_ROOTS) break;
        }
        if (chunk.length) deliver(chunk);
        if (pending.size && performance.now() - started >= TASK_BUDGET_MS) {
          timer = setTimeout(flush, 0);
          return;
        }
      }
    };
    const deliver = (entries) => {
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
  function publishMenuPalette(host, theme) {
    if (!host || !theme) return;
    const palette = Object.fromEntries([...tokenNames,'id','skin','skinVertical','skinMode'].map(key => [key, theme[key]]));
    const serialized = JSON.stringify(palette);
    if (host.dataset.expMenuPalette === serialized) return;
    host.dataset.expMenuPalette = serialized;
    emit('menu-theme', host.dataset.productId);
  }
  // Every stylesheet Core injects is marked as owned by ExtraPotions so theming tools
  // leave it alone. A <style> node carries data-exp-owned; a constructed
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
    // Keep the editable handle without parsing a second copy of the adopted CSS.
    node.type = 'text/plain';
    node.textContent = css;
    let sheet;
    try {
      sheet = new CSSStyleSheet(); sheet.replaceSync(OWNED_SHEET_MARKER + css);
      shadow.adoptedStyleSheets = [...shadow.adoptedStyleSheets, sheet];
      if (!shadow.adoptedStyleSheets.includes(sheet)) throw new Error('Style adoption ignored');
    } catch {
      if (sheet) { try { shadow.adoptedStyleSheets = [...shadow.adoptedStyleSheets].filter(item => item !== sheet); } catch {} }
      sheet = undefined; node.type = 'text/css';
    }
    shadow.append(node);
    const observe = sheet ? new MutationObserver(() => { try { sheet.replaceSync(OWNED_SHEET_MARKER + node.textContent); } catch {} }) : null;
    observe?.observe(node, { childList: true, characterData: true, subtree: true });
    node.dispose = () => { observe?.disconnect(); if (sheet) shadow.adoptedStyleSheets = [...shadow.adoptedStyleSheets].filter(item => item !== sheet); node.remove(); };
    node.expSheet = sheet;
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
    // Products that have not loaded yet, or are switched off in the userscript manager, keep their place.
    const kept = Array.isArray(order) ? order.filter(id => typeof id === 'string') : [];
    const next = [...kept, ...ids.filter(id => !kept.includes(id))];
    if ((kept.length || completeSuite) && JSON.stringify(next) !== JSON.stringify(order)) write(GRID_ORDER, next);
  }
  // The single source of launcher coordinates for every product: the saved group position
  // (GRID_DELTA) plus the launcher's grid cell. Products position their launcher from this.
  function launcherPlacement(host) {
    const state = flyoutState();
    if (state.active) {
      // Every product launcher is a tile: hidden while the flyout is closed, in the flyout row while it is open.
      const { hub, panel } = flyoutBand(state);
      const index = Math.max(0, state.order.indexOf(host?.dataset?.productId));
      const left = panel.left + 1 + FLYOUT_PAD + index * (FLYOUT_TILE + FLYOUT_GAP);
      document.documentElement.dataset.expLauncherAnchor = hub.anchor;
      return { top: panel.top + 1 + FLYOUT_PAD, right: viewWidth() - left - FLYOUT_TILE, anchor: hub.anchor, delta: savedDelta(), flyout: true, size: FLYOUT_TILE };
    }
    const single = singleSlot(state);
    if (single) {
      document.documentElement.dataset.expLauncherAnchor = 'top';
      const left = state.row ? state.row.left + Math.max(0, state.order.indexOf(host?.dataset?.productId)) * (state.row.size + state.row.gap) : single.hub.left;
      return { top: single.hub.top, right: viewWidth() - left - single.hub.size, anchor: 'top', delta: savedDelta(), site: true, size: single.hub.size };
    }
    const { offset, x } = launcherCell(host);
    const delta = Math.max(8-(innerHeight-60), Math.min(4, Number(read(GRID_DELTA,0)) || 0));
    const origin = innerHeight-60+delta, anchor = origin <= (innerHeight-48)/2 ? 'top':'bottom';
    document.documentElement.dataset.expLauncherAnchor = anchor;
    const top = Math.max(8, Math.min(innerHeight-56, anchor === 'top' ? origin+offset : origin-offset));
    return { top: top + siteControlShift(origin, anchor), right: 12+x, anchor, delta };
  }
  function launcherCell(host) {
    const style = getComputedStyle(host);
    return { offset: parseFloat(style.getPropertyValue('--exp-launcher-offset')) || 0, x: parseFloat(style.getPropertyValue('--exp-launcher-x')) || 0 };
  }
  // Site controls the launchers must not cover: controls that stay put while the page scrolls (a fixed chat
  // button) and the controls in the page's header. Content that scrolls under the launchers is not avoided,
  // or the group would jump around while scrolling.
  const SITE_CONTROL = 'a[href],button,input,select,textarea,summary,iframe,[role=button],[role=link],[role=menuitem],[role=tab]';
  const SITE_CONTROL_CLEARANCE = 8;
  let shiftMemo = null, groupDragging = false;
  function pinnedControlAt(x, y) {
    let hit = document.elementsFromPoint(x, y).find(node => node !== document.documentElement && node !== document.body && !registrations.has(node) && !node.closest('[data-exp-product-launcher]'));
    // A site widget drawn in an open shadow root (Allbirds' "Shop Deals") hit-tests as its host; look inside.
    for (let depth = 0, inner; hit?.shadowRoot && depth < 4 && (inner = hit.shadowRoot.elementsFromPoint(x, y).find(node => node.getRootNode() === hit.shadowRoot)); depth++) hit = inner;
    const up = node => node.parentElement || (node.parentNode instanceof ShadowRoot ? node.parentNode.host : null);
    let control = null;
    for (let node = hit; node; node = up(node)) {
      if (registrations.has(node) || node.matches('[data-exp-product-launcher]')) return null;
      if (!control && node.matches(SITE_CONTROL)) control = node;
    }
    if (!control) return null;
    let scrolls = false;
    for (let node = control; node && node !== document.body && node !== document.documentElement; node = up(node)) {
      if (node.matches('[role=banner]') || (node.matches('header') && !node.parentElement?.closest('article,aside,main,nav,section'))) return control;
      const style = getComputedStyle(node);
      const scroller = node !== control && /auto|scroll/.test(style.overflowY) && node.scrollHeight > node.clientHeight;
      // An app that scrolls inside a container covering the whole window: its content is the page.
      if (scroller && node.clientWidth >= innerWidth * .9 && node.clientHeight >= innerHeight * .9) return null;
      scrolls ||= scroller;
      if (style.position === 'fixed') return control;
      // A sticky bar (a header, a toolbar) stays put; a tall sticky column (Reddit's sidebar) is page content.
      if (style.position === 'sticky') return node.getBoundingClientRect().height <= innerHeight * .25 ? control : null;
    }
    // A window that never scrolls (Twitch signed out) keeps everything outside its scrolling containers in place.
    const page = document.scrollingElement || document.documentElement;
    return !scrolls && page.scrollHeight <= page.clientHeight + 1 ? control : null;
  }
  function controlsUnder(box) {
    // Each sample is a full hit test, so the grid is as coarse as the smallest control worth avoiding allows.
    const found = new Set(), step = 16;
    for (let y = box.top; y <= box.bottom; y += step) for (let x = box.left; x <= box.right; x += step) {
      if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
      const control = pinnedControlAt(x, y);
      if (control) found.add(control);
    }
    return [...found].map(node => node.getBoundingClientRect()).filter(r => r.width && r.height);
  }
  // One vertical shift for the whole group, so order and spacing stay as the user arranged them.
  // It is never written to the saved position, and it is recomputed when the page changes.
  function siteControlShift(origin, anchor) {
    if (groupDragging) return 0;
    const now = performance.now();
    if (shiftMemo && shiftMemo.origin === origin && now - shiftMemo.at < 1000) return shiftMemo.value;
    // The flyout launcher is one 48px tile in the corner; the grid is every launcher cell.
    const cells = ExpLauncherFlyout.flyoutActive(launcherHosts()) ? [{ offset:0, x:0 }] : [...document.querySelectorAll('[data-exp-product-launcher="1"]')].map(launcherCell);
    if (!cells.length) return 0;
    const tops = cells.map(cell => Math.max(8, Math.min(innerHeight-56, anchor === 'top' ? origin+cell.offset : origin-cell.offset)));
    const c = SITE_CONTROL_CLEARANCE;
    const group = { top: Math.min(...tops) - c, bottom: Math.max(...tops) + 48 + c, right: innerWidth - 12 + c, left: innerWidth - 12 - 48 - Math.max(...cells.map(cell => cell.x)) - c };
    const at = s => ({ ...group, top: group.top + s, bottom: group.bottom + s });
    const fits = s => at(s).top >= 8 - c && at(s).bottom <= innerHeight - 8 + c;
    const hits = (s, blockers) => blockers.some(b => b.left < group.right && b.right > group.left && b.top < at(s).bottom && b.bottom > at(s).top);
    let blockers = [], value = 0;
    for (let round = 0; round < 4; round++) {
      const more = controlsUnder(at(value));
      if (!more.length) break;
      blockers = blockers.concat(more);
      const candidates = [0, ...blockers.flatMap(b => [b.top - group.bottom, b.bottom - group.top])].filter(s => fits(s) && !hits(s, blockers));
      if (!candidates.length) { value = 0; break; }
      value = candidates.reduce((best, s) => Math.abs(s) < Math.abs(best) ? s : best);
    }
    shiftMemo = { origin, at: now, value };
    return value;
  }
  // Chat buttons and sticky headers come and go after load, so the shift is rechecked once page changes and
  // scrolling pause, and at most every 2s while they go on (an infinite feed never pauses). Each check hit-tests a
  // grid of points, so rechecking on every change made scrolling a long page slow. Launchers move only when the
  // shift changes.
  const SITE_CHECK_PAUSE = 300, SITE_CHECK_MAX_WAIT = 2000;
  // A page that keeps changing (rotating adverts, tickers) but gives the same answer each time is checked less and
  // less often, up to every 4s; the first check that finds a different answer returns to the normal pace. A hidden
  // tab is not checked at all: the next change after it is shown again checks it.
  const SITE_CHECK_GAP_MAX = 4000;
  let siteCheckTimer = 0, siteCheckDue = 0, siteCheckLast = 0, siteCheckGap = 0;
  function recheckSiteControls() {
    const now = performance.now();
    if (!siteCheckTimer) siteCheckDue = now + SITE_CHECK_MAX_WAIT;
    clearTimeout(siteCheckTimer);
    siteCheckTimer = setTimeout(() => {
      siteCheckTimer = 0;
      const host = document.querySelector('[data-exp-product-launcher="1"]');
      if (!host || groupDragging || document.hidden) return;
      const before = shiftMemo ? shiftMemo.value : 0;
      shiftMemo = null;
      const delta = Math.max(8-(innerHeight-60), Math.min(4, Number(read(GRID_DELTA,0)) || 0));
      const origin = innerHeight-60+delta, value = siteControlShift(origin, origin <= (innerHeight-48)/2 ? 'top':'bottom');
      siteCheckLast = performance.now();
      siteCheckGap = value !== before ? 0 : Math.min(SITE_CHECK_GAP_MAX, Math.max(1000, siteCheckGap * 2));
      if (value !== before) emit('launcher-site-controls', 'core');
    }, Math.max(0, Math.min(SITE_CHECK_PAUSE, siteCheckDue - now), siteCheckLast + siteCheckGap - now));
  }
  // Restores the default launcher order and group position for every product.
  // Shared geometry for menus and notices: the launcher that owns them, the left edge of the launcher grid,
  // and any visible surface a product marks with data-exp-reserved (Dropper's progress card).
  function surfaceGeometry(host, ignoredSurface = null) {
    const launcherOf = node => node?.shadowRoot?.querySelector('[data-exp-part="launcher"],.launcher');
    const own = launcherOf(host)?.getBoundingClientRect();
    if (!own || !own.width) return null;
    const hosts = [...document.querySelectorAll('[data-exp-product-launcher="1"]')];
    const launchers = hosts.map(node => launcherOf(node)?.getBoundingClientRect()).filter(box => box?.width && box?.height);
    // A reserved surface never reaches into the launcher column: a product that marks a whole row holding
    // its launcher gets the same geometry as one that marks only the card beside it.
    const columnLeft = Math.min(...launchers.map(box => box.left));
    const reservedBoxes = hosts.flatMap(node => [...(node.shadowRoot?.querySelectorAll('[data-exp-reserved]') || [])]).filter(node=>node!==ignoredSurface&&!ignoredSurface?.contains(node))
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
    // An embedded progress card moves with this menu; it is not an external obstacle.
    const geometry = surfaceGeometry(host, panel);
    if (!geometry) return null;
    const { own, reserved, gridLeft, anchorTop } = geometry;
    // A product stylesheet may still size its menu; decide using the width the menu actually renders at.
    panel.style.width = Math.max(0, Math.min(preferredWidth, innerWidth - 24)) + 'px';
    const width = panel.offsetWidth || preferredWidth;
    Object.assign(panel.style, { left:'auto', bottom:'auto' });
    // Shared chrome has an !important viewport cap. The available space beside
    // the launcher can be smaller, so placement must own the winning height limit.
    const limitHeight = height => panel.style.setProperty('max-height', Math.max(0, height) + 'px', 'important');
    const finish = (side, right, top, h) => {
      top = Math.round(Math.max(8, Math.min(innerHeight - h - 8, top)));
      Object.assign(panel.style, { right:Math.round(right)+'px', top:top+'px' });
      host.dataset.menuSide = side;
      return { top, right:Math.round(right), width, side };
    };
    const slot = slotBand();
    if (slot?.hub?.dock === 'right') {
      // A left-rail entry opens beside the rail, rather than at the window's right edge.
      const viewport = viewWidth(), hub = slot.hub;
      panel.style.width = Math.min(preferredWidth, Math.max(0, viewport - 16)) + 'px';
      const w = panel.offsetWidth || preferredWidth;
      const beside = hub.left + hub.size + 8;
      const fitsBeside = beside + w <= viewport - 8;
      const left = fitsBeside ? beside : Math.max(8, Math.min(viewport - w - 8, hub.left));
      const top = fitsBeside ? (slot.bottom > hub.top + hub.size ? slot.bottom + 8 : hub.top) : slot.bottom + 8;
      const room = innerHeight - top - 8;
      limitHeight(room < 160 ? innerHeight - 16 : room);
      host.dataset.openDirection = 'down';
      return finish(room < 160 ? 'rail-viewport' : fitsBeside ? 'rail-beside' : 'rail-below', viewport - left - w, room < 160 ? 8 : top, panel.offsetHeight);
    }
    if (slot) {
      // From the flyout or a site slot: right-aligned 8px from the window edge, beyond the launcher and its open flyout.
      const blocks=reserved&&reserved.left<innerWidth-8&&reserved.right>innerWidth-8-width;
      const edge=blocks?(slot.down?Math.max(slot.bottom,reserved.bottom):Math.min(slot.top,reserved.top)):(slot.down?slot.bottom:slot.top);
      const room = slot.down ? innerHeight - edge - 16 : edge - 16;
      // In very short windows the open menu takes the viewport; Close/Escape restores the card and flyout.
      if(room<160){limitHeight(innerHeight-16);return finish('viewport',8,8,panel.offsetHeight);}
      limitHeight(room);
      const h = panel.offsetHeight;
      host.dataset.openDirection = slot.down ? 'down' : 'up';
      return finish('flyout', 8, slot.down ? edge + 8 : edge - 8 - h, h);
    }
    if (reserved) {
      const blockers=geometry.launchers.filter(box=>box.left<reserved.right&&box.right>reserved.right-width);
      const edge=anchorTop?Math.max(reserved.bottom,...blockers.map(box=>box.bottom)):Math.min(reserved.top,...blockers.map(box=>box.top));
      const room = anchorTop ? innerHeight - edge - 16 : edge - 16;
      if (room >= 200 && reserved.right - 8 >= width) {
        limitHeight(room);
        const h = panel.offsetHeight;
        host.dataset.openDirection = anchorTop ? 'down' : 'up';
        return finish('reserved', innerWidth - reserved.right, anchorTop ? edge + 8 : edge - 8 - h, h);
      }
    }
    if (gridLeft - 16 >= width) {
      limitHeight(innerHeight - 16);
      const h = panel.offsetHeight;
      host.dataset.openDirection = 'down';
      return finish('beside', innerWidth - gridLeft + 8, anchorTop ? own.top : own.bottom - h, h);
    }
    // Stacked menus clear the launcher and any reserved surface in its row.
    const band = [...geometry.launchers, ...(reserved ? [reserved] : [])].filter(box => box.left < innerWidth - 12 && box.right > innerWidth - 12 - width)
      .reduce((all, box) => ({ top:Math.min(all.top, box.top), bottom:Math.max(all.bottom, box.bottom) }), { top:own.top, bottom:own.bottom });
    const below = innerHeight - band.bottom - 16, above = band.top - 16;
    const up = anchorTop ? below < 160 && above > below : !(above < 160 && below > above);
    limitHeight(up ? above : below);
    const h = panel.offsetHeight;
    host.dataset.openDirection = up ? 'up' : 'down';
    return finish('stacked', 12, up ? band.top - h - 8 : band.bottom + 8, h);
  }
  // The single placement for update and changelog notices. With a menu open, the notice stacks beyond it
  // (above it, or below it when the launchers are anchored at the top) and shares its right edge; when the
  // window is too short for that, it sits beside the menu, on its left, instead of overlapping it. With no
  // menu open it takes the menu's place: above a reserved surface, or beside the launcher grid.
  function placeNotice(host, notice, panel = null) {
    const geometry = surfaceGeometry(host, notice);
    if (!geometry) return null;
    const { own, reserved, gridLeft, anchorTop } = geometry;
    const width = notice.offsetWidth || 260;
    const height = notice.offsetHeight || notice.scrollHeight || 72;
    const menu = panel && !panel.hidden && panel.getClientRects().length ? panel.getBoundingClientRect() : null;
    let right, top;
    if (menu?.width && menu?.height) {
      const beyond = anchorTop ? menu.bottom + 8 : menu.top - height - 8;
      const fits = anchorTop ? beyond + height <= innerHeight - 8 : beyond >= 8;
      if (fits) {
        right = menu.right;
        top = beyond;
      } else if (menu.left - 8 - width >= 8) {
        // A short window leaves no room beyond the menu: sit beside it instead, on the side away from the
        // launchers, lined up with the menu's edge nearest them, so nothing overlaps.
        right = menu.left - 8;
        top = anchorTop ? menu.top : menu.bottom - height;
      } else {
        right = menu.right;
        top = anchorTop ? menu.top - height - 8 : menu.bottom + 8;
      }
    } else if (slotBand()) {
      const band = slotBand();
      if (band.hub?.dock === 'right') {
        const left = Math.max(8, Math.min(viewWidth() - width - 8, band.hub.left + band.hub.size + 8));
        right = left + width; top = band.bottom + 8;
      } else {
        right = viewWidth() - 8;
        top = clearReserved(band.down ? band.bottom + 8 : band.top - height - 8, height, right - width, right, band.down, notice);
      }
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
    // With several products a menu belongs to the flyout: opening one any way (a tile, a shortcut, a product
    // call) shows the flyout with that product selected.
    if (flyoutState().active) { if (!setFlyoutOpen(true)) restackFlyout(); return; }
    const id = document.documentElement.getAttribute('data-exp-open-menu');
    const host = [...document.querySelectorAll('[data-exp-product-launcher="1"]')].find(node => node.dataset.productId === id);
    if (!host || typeof host.hidePopover !== 'function') return;
    try { if (host.matches(':popover-open')) host.hidePopover(); host.showPopover(); } catch {}
  }
  // Flyout launcher: with two or more products on a page, one shared launcher (the hub, owned by the lead
  // product's host) opens a row of tiles, and each tile is that product's own launcher. Every Core copy derives
  // the same state from host attributes; the open state lives on <html> as data-exp-flyout-open.
  const FLYOUT_ACCENTS = Object.freeze({ dropper:'#bc94f5', ward:'#e7bb75', thread:'#ff7636' });
  const FLYOUT_NAMES = Object.freeze({ dropper:'Dropper', ward:'WARD', thread:'THREAD' });
  const FLYOUT_TILE = 40, FLYOUT_GAP = 6, FLYOUT_PAD = 7;
  const launcherHosts = () => [...document.querySelectorAll('[data-exp-product-launcher="1"]')];
  const hostLauncher = host => host?.shadowRoot?.querySelector('[data-exp-part="launcher"],.launcher') || null;
  function flyoutState() {
    const hosts = launcherHosts();
    const row = hosts.length === 1 || (hosts.length > 1 && hosts.every(host => host.dataset.expFlyout === ExpLauncherFlyout.PROTOCOL)) ? siteRow(hosts.length) : null;
    const active = !row && ExpLauncherFlyout.flyoutActive(hosts);
    return { hosts, active, row, lead: active ? ExpLauncherFlyout.leadProduct(hosts) : '', order: active || row ? ExpLauncherFlyout.flyoutOrder(hosts) : [], open: active && document.documentElement.dataset.expFlyoutOpen === '1' };
  }
  // A top bar with room for every product's icon side by side (Twitch); otherwise null and the flyout is used.
  function siteRow(count) {
    const row = siteSlot()?.row;
    if (!row || !count) return null;
    const left = row.right - count * row.size - (count - 1) * row.gap;
    return left >= row.minLeft ? { left, top: row.top, size: row.size, gap: row.gap } : null;
  }
  // innerWidth counts a classic page scrollbar (or a reserved gutter); fixed-position parts live in the
  // narrower area beside it, so the flyout measures that area with a fixed probe inside a launcher host.
  let viewProbe = null;
  function viewWidth() {
    if (!viewProbe?.isConnected) {
      const root = document.querySelector('[data-exp-product-launcher="1"]')?.shadowRoot;
      if (!root) return innerWidth;
      viewProbe = document.createElement('div'); viewProbe.className = 'exp-view-probe'; viewProbe.setAttribute('aria-hidden', 'true');
      viewProbe.style.cssText = 'position:fixed;inset:0;visibility:hidden;pointer-events:none';
      root.append(viewProbe);
    }
    return viewProbe.getBoundingClientRect().width || innerWidth;
  }
  // Visible surfaces a product marks reserved (Dropper's progress strip under the top bar): a notice in the
  // slot's column moves past them instead of covering them. A hidden strip takes no room.
  function clearReserved(top, height, left, right, down, ignoredSurface = null) {
    const boxes = [...document.querySelectorAll('[data-exp-product-launcher="1"]')]
      .flatMap(host => [...(host.shadowRoot?.querySelectorAll('[data-exp-reserved]') || [])])
      .filter(node => node !== ignoredSurface && getComputedStyle(node).visibility !== 'hidden')
      .map(node => node.getBoundingClientRect()).filter(box => box.width && box.height && box.left < right && box.right > left)
      .sort((a, b) => down ? a.top - b.top : b.bottom - a.bottom);
    for (const box of boxes) if (box.top < top + height && box.bottom > top) top = down ? box.bottom + 8 : box.top - height - 8;
    return top;
  }
  function savedDelta() { return Math.max(8-(innerHeight-60), Math.min(4, Number(read(GRID_DELTA,0)) || 0)); }
  // The shared launcher sits in the site's slot when it has one, otherwise in the bottom-right corner.
  function flyoutHubBox() {
    const slot = siteSlot();
    if (slot) return { left:slot.left, top:slot.top, size:slot.size||FLYOUT_TILE, shape:slot.shape, anchor:'top', site:true, dock:slot.dock };
    const origin = innerHeight-60+savedDelta(), anchor = origin <= (innerHeight-48)/2 ? 'top' : 'bottom';
    return { left:viewWidth()-12-48, top:Math.max(8, Math.min(innerHeight-56, origin)) + siteControlShift(origin, anchor), size:48, anchor, site:false };
  }
  function flyoutPanelBox(hub, count) {
    const width = 2 + FLYOUT_PAD*2 + FLYOUT_TILE*count + FLYOUT_GAP*Math.max(0, count-1), height = 2 + FLYOUT_PAD*2 + FLYOUT_TILE;
    const left = Math.max(8, Math.min(viewWidth() - 8 - width, hub.dock === 'right' ? hub.left + hub.size + 6 : hub.left + hub.size - width));
    const top = hub.dock === 'right' && hub.left + hub.size + 6 + width <= viewWidth() - 8 ? hub.top : hub.anchor === 'top' ? hub.top + hub.size + 6 : hub.top - 6 - height;
    return { left, top, width, height, right:left+width, bottom:top+height };
  }
  function flyoutBand(state = flyoutState()) {
    const hub = flyoutHubBox(), panel = flyoutPanelBox(hub, state.order.length);
    // A closed flyout takes no room: menus and notices line up with the launcher alone.
    const room = state.open ? panel : { top:hub.top, bottom:hub.top + hub.size };
    return { hub, panel, top:Math.min(hub.top, room.top), bottom:Math.max(hub.top+hub.size, room.bottom), down:hub.anchor === 'top' };
  }
  // Sites with a better home for the launcher than the corner, one row per site. A slot that is missing, hidden
  // (theater mode, fullscreen) or too narrow returns null and the launcher uses the corner.
  const visibleBox = node => { const box = node.getBoundingClientRect(); if (box.width < 1 || box.height < 1) return null; const style = getComputedStyle(node); return style.visibility === 'hidden' || style.display === 'none' ? null : box; };
  // Twitch: the top bar between the search box and the first icon of the right-hand group. Twitch keeps a
  // zero-size Search button in that group and collapses search to an icon on narrow windows; both are ignored.
  // Theater mode and fullscreen hide the bar with style changes the page observer does not watch, so the slot's
  // container is watched for size changes instead (hiding it resizes it to zero).
  let slotWatch = null, watchedSlotNode = null;
  function watchSlotNode(node) {
    if (node === watchedSlotNode || typeof ResizeObserver !== 'function') return;
    slotWatch ??= new ResizeObserver(() => { slotMemo = null; scheduleGrid(); });
    if (watchedSlotNode) slotWatch.unobserve(watchedSlotNode);
    watchedSlotNode = node; if (node) slotWatch.observe(node);
  }
  function twitchSlot() {
    const bar = document.querySelector('nav[data-a-target="top-nav-container"] .top-nav__menu');
    if (bar) watchSlotNode(bar);
    if (!bar || bar.children.length < 3) return null;
    const barBox = visibleBox(bar);
    if (!barBox || barBox.height < 40 || barBox.top < -1 || barBox.top > 8) return null;
    const search = [...bar.children[1].querySelectorAll('input[type="search"],input[data-a-target="tw-input"]')].map(visibleBox).filter(Boolean);
    if (!search.length) return null;
    // Theater mode draws the player over the bar, which keeps its size: the bar must be on top where search is.
    const probe = document.elementFromPoint(search[0].left + search[0].width / 2, search[0].top + search[0].height / 2);
    if (!probe || !bar.contains(probe)) return null;
    const searchEnd = Math.max(...[...bar.children[1].querySelectorAll('input,button,a')].map(visibleBox).filter(Boolean).map(box => box.right));
    const icons = [...bar.children[2].querySelectorAll('button,a,input')].map(visibleBox).filter(Boolean);
    if (!icons.length) return null;
    const right = Math.min(...icons.map(box => box.left)) - 16, left = right - FLYOUT_TILE;
    if (left < searchEnd + 8) return null;
    // Product icons in a row match the size of Twitch's own first icon button.
    const first = icons.reduce((a, b) => a.left <= b.left ? a : b), size = Math.round(Math.max(28, Math.min(40, first.height)));
    return { left, top: Math.round(barBox.top + (barBox.height - FLYOUT_TILE) / 2), row: { right, minLeft: searchEnd + 8, size, gap: 8, top: Math.round(barBox.top + (barBox.height - size) / 2) } };
  }
  // Reddit's left-rail entry belongs to THREAD. Other products alone keep their existing placement.
  // Native accessible controls/rail geometry supply coordinates; no enhancement-script anchor is used.
  function redditSlot() {
    if (!document.querySelector('[data-exp-product-launcher="1"][data-product-id="thread"]')) return null;
    const rail = document.querySelector('#left-sidebar-container');
    watchSlotNode(rail);
    const box = rail && visibleBox(rail);
    const handles = [...document.querySelectorAll('button[aria-controls="left-sidebar-container"],button[aria-label="Collapse navigation"],button[aria-label="Collapse sidebar"],button[aria-label="Expand navigation"],button[aria-label="Expand sidebar"]')]
      .filter(node => !node.closest('[data-exp-owned]')).map(visibleBox).filter(Boolean);
    const handle = handles.find(r => r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < Math.min(innerWidth / 2, 420)) || null;
    const header = document.querySelector('reddit-header-large,shreddit-header,header[role="banner"]');
    const headerBox = header && visibleBox(header);
    const expanded = box && box.width >= 120 && box.right <= Math.min(viewWidth() - 48, 600) && box.bottom > 80;
    const size = handle ? Math.max(24, Math.min(48, Math.min(handle.width, handle.height))) : 32;
    let left = expanded ? box.right - size / 2 : handle ? handle.left + (handle.width - size) / 2 : 12;
    let top = handle ? handle.bottom + 8 : expanded ? Math.max(8, box.top) + 56 : Math.max(8, headerBox?.bottom || 48) + 12;
    // Sidebar links retain their hit targets. Slide clear of a native control in the proposed slot.
    const controls = [...(rail?.querySelectorAll('button,a[href]') || [])].slice(0,120).map(visibleBox).filter(Boolean);
    for (let attempt=0;attempt<8;attempt++) {
      const blocked = controls.find(r => r.left < left + size && r.right > left && r.top < top + size && r.bottom > top);
      if (!blocked) break;
      top = blocked.bottom + 8;
    }
    left = Math.max(8, Math.min(viewWidth() - size - 8, left));
    top = Math.max(8, Math.min(innerHeight - size - 8, top));
    return {left:Math.round(left),top:Math.round(top),dock:'right',size,shape:'circle'};
  }
  const SITE_SLOTS = Object.freeze([{ host:/(^|\.)twitch\.tv$/, find:twitchSlot },{ host:/^(www|sh)\.reddit\.com$/, find:redditSlot }]);
  let slotMemo = null, frozenSlot;
  function siteSlot() {
    // While the flyout is open the launcher stays put, so the open flyout never jumps under the pointer.
    if (frozenSlot !== undefined && frozenSlot?.dock !== 'right' && document.documentElement.dataset.expFlyoutOpen === '1') return frozenSlot;
    const now = performance.now();
    if (!slotMemo || now - slotMemo.at > 150 || slotMemo.width !== innerWidth || slotMemo.height !== innerHeight) {
      const row = SITE_SLOTS.find(entry => entry.host.test(location.hostname));
      let slot = null;
      try { slot = row ? row.find() : null; } catch {}
      slotMemo = { at:now, width:innerWidth, height:innerHeight, slot };
    }
    frozenSlot = document.documentElement.dataset.expFlyoutOpen === '1' ? slotMemo.slot : undefined;
    return slotMemo.slot;
  }
  // One product in a site slot: its own launcher sits there at tile size and its menu drops below it.
  function singleSlot(state = flyoutState()) {
    if (state.active) return null;
    const row = state.row;
    if (row) { const width = state.hosts.length * row.size + (state.hosts.length - 1) * row.gap; return { hub:{ left:row.left, top:row.top, size:row.size, width, anchor:'top', site:true, row:true }, panel:null, top:row.top, bottom:row.top + row.size, down:true }; }
    if (state.hosts.length !== 1) return null;
    const slot = siteSlot();
    return slot ? { hub:{ ...slot, size:slot.size||FLYOUT_TILE, anchor:'top', site:true }, panel:null, top:slot.top, bottom:slot.top + (slot.size||FLYOUT_TILE), down:true } : null;
  }
  function slotBand(state = flyoutState()) { return state.active ? flyoutBand(state) : singleSlot(state); }
  function setFlyoutOpen(value) {
    const root = document.documentElement, was = root.dataset.expFlyoutOpen === '1';
    value = Boolean(value) && flyoutState().active;
    if (was === value) return false;
    if (value) { frozenSlot = undefined; siteSlot(); root.dataset.expFlyoutOpen = '1'; frozenSlot = slotMemo?.slot ?? null; } else { delete root.dataset.expFlyoutOpen; frozenSlot = undefined; slotMemo = null; }
    syncFlyout();
    if (value) restackFlyout(); else document.dispatchEvent(new Event('exp-core:flyout-close'));
    emit('flyout', 'core');
    return true;
  }
  // Every host is its own top-layer popover, stacked in show order. Re-show the lead host first so its flyout
  // panel sits under every tile, and an open menu's host last so the menu sits above everything. Focus inside a
  // re-shown host is restored, so keyboard users keep their place.
  function restackFlyout() {
    const state = flyoutState();
    if (!state.active) return;
    const deepActive = () => { let node = document.activeElement; while (node?.shadowRoot?.activeElement) node = node.shadowRoot.activeElement; return node; };
    const focused = deepActive(), menu = document.documentElement.getAttribute('data-exp-open-menu') || '';
    const byId = id => state.hosts.find(host => host.dataset.productId === id);
    const sequence = [state.lead, ...state.order.filter(id => id !== state.lead && id !== menu), ...(menu && menu !== state.lead ? [menu] : [])].map(byId).filter(Boolean);
    // data-exp-restack marks these re-shows as Core's own for every Core copy, so their toggle events do not restack again.
    for (const host of sequence) { if (typeof host.showPopover !== 'function') continue; try { host.dataset.expRestack = '1'; if (host.matches(':popover-open')) host.hidePopover(); host.showPopover(); } catch { delete host.dataset.expRestack; } }
    if (focused?.isConnected && deepActive() !== focused) try { focused.focus({ preventScroll:true }); } catch {}
  }
  function focusFlyout(target) {
    document.documentElement.dataset.expFlyoutFocus = target;
    document.dispatchEvent(new Event('exp-core:flyout-focus'));
  }
  function onFlyoutFocus() {
    const target = document.documentElement.dataset.expFlyoutFocus || '';
    const state = flyoutState();
    if (!target || !state.active) return;
    syncFlyout();
    for (const host of state.hosts) {
      if (!registrations.has(host)) continue;
      const node = target === 'hub' ? (host.dataset.productId === state.lead ? host.shadowRoot?.querySelector('[data-exp-part="flyout-hub"]') : null) : (host.dataset.productId === target ? hostLauncher(host) : null);
      if (node) { delete document.documentElement.dataset.expFlyoutFocus; node.focus({ preventScroll:true }); }
    }
  }
  function onTileKey(event) {
    const host = event.currentTarget?.host, state = flyoutState();
    if (!state.open || !host || event.target !== hostLauncher(host) || event.altKey || event.ctrlKey || event.metaKey) return;
    const index = state.order.indexOf(host.dataset.productId), last = state.order.length - 1;
    const next = { ArrowRight:index+1, ArrowDown:index+1, ArrowLeft:index-1, ArrowUp:index-1, Home:0, End:last }[event.key];
    if (next === undefined) return;
    event.preventDefault(); event.stopPropagation();
    focusFlyout(state.order[Math.max(0, Math.min(last, next))]);
  }
  function onHubKey(event) {
    const state = flyoutState();
    if (!state.open || !['ArrowRight','ArrowDown','ArrowLeft','ArrowUp','Home','End'].includes(event.key)) return;
    event.preventDefault();
    focusFlyout(['ArrowLeft','ArrowUp','End'].includes(event.key) ? state.order.at(-1) : state.order[0]);
  }
  // Host protection and page scripts can re-show a launcher while the flyout is open, which lifts it above the
  // others (the lead's would cover every tile with its panel). Any re-show Core did not make restacks once a frame.
  let restackFrame = 0;
  function onHostToggle(event) {
    const host = event.currentTarget;
    if (host.dataset.expRestack) { delete host.dataset.expRestack; return; }
    if (event.newState !== 'open' || restackFrame || !flyoutState().open) return;
    restackFrame = requestAnimationFrame(() => { restackFrame = 0; if (flyoutState().open) restackFlyout(); });
  }
  function onFlyoutEscape(event) {
    if (event.key !== 'Escape' || !flyoutState().open) return;
    setFlyoutOpen(false);
    focusFlyout('hub');
  }
  function onFlyoutOutside(event) {
    if (!event.isTrusted || !flyoutState().open) return;
    const path = event.composedPath();
    if (launcherHosts().some(host => path.includes(host))) return;
    setFlyoutOpen(false);
  }
  function flyoutCss(productId) {
    const accent = FLYOUT_ACCENTS[productId] || '#a1a1aa', launcherPart = ':is([data-exp-part="launcher"],.launcher)';
    return `:host([data-exp-flyout-role]) ${launcherPart}{width:40px!important;height:40px!important;min-width:40px!important;min-height:40px!important;max-width:40px!important;max-height:40px!important;border-radius:10px!important;box-sizing:border-box!important}
:host([data-exp-flyout-role]) ${launcherPart} > :is(img,svg,.icon):not(.launcher-ring):not(.ring){width:26px!important;height:26px!important}
:host([data-exp-flyout-role="hidden"]) ${launcherPart}{visibility:hidden!important;pointer-events:none!important}
:host([data-exp-flyout-selected="1"]) ${launcherPart}{border-color:${accent}!important;box-shadow:inset 0 0 0 1px ${accent}!important}
.exp-flyout-hub{all:initial;position:fixed;z-index:2147483601;box-sizing:border-box;display:grid;place-items:center;width:48px;height:48px;border-radius:12px;background:radial-gradient(circle at 50% 35%,#1d1a24,#0c0b10 70%);border:1px solid color-mix(in srgb,${accent} 50%,#3f3f46);box-shadow:inset 0 1px 0 #ffffff12;cursor:pointer;pointer-events:auto}
.exp-flyout-hub[data-size="40"]{border-radius:10px}
.exp-flyout-hub[data-shape="circle"]{border-radius:50%;background:var(--theme-panel,#181c1f);box-shadow:none}
:host([data-exp-rail-launcher="circle"][data-exp-flyout-role="site"]) ${launcherPart}{width:var(--exp-rail-launcher-size)!important;height:var(--exp-rail-launcher-size)!important;min-width:var(--exp-rail-launcher-size)!important;min-height:var(--exp-rail-launcher-size)!important;max-width:var(--exp-rail-launcher-size)!important;max-height:var(--exp-rail-launcher-size)!important;border-radius:50%!important}
:host([data-exp-rail-launcher="circle"][data-exp-flyout-role="site"]) ${launcherPart}>:is(img,svg,.icon):not(.launcher-ring):not(.ring){width:22px!important;height:22px!important}
:host([data-exp-flyout-role="site"][data-exp-site-icon]) :is([data-exp-part="launcher"],.launcher){width:var(--exp-site-icon-size)!important;height:var(--exp-site-icon-size)!important;min-width:var(--exp-site-icon-size)!important;min-height:var(--exp-site-icon-size)!important;max-width:var(--exp-site-icon-size)!important;max-height:var(--exp-site-icon-size)!important;padding:0!important;border:0!important;border-radius:6px!important;background:transparent!important;box-shadow:none!important;overflow:visible!important;transition:none!important}
:host([data-exp-flyout-role="site"][data-exp-site-icon]) :is([data-exp-part="launcher"],.launcher):hover{background:color-mix(in srgb,currentColor 16%,transparent)!important}
:host([data-exp-flyout-role="site"][data-exp-site-icon]) :is([data-exp-part="launcher"],.launcher):focus-visible{outline:2px solid ${accent}!important;outline-offset:1px!important}
:host([data-exp-flyout-role="site"][data-exp-site-icon]) :is([data-exp-part="launcher"],.launcher)>:is(img,svg,.icon):not(.launcher-ring):not(.ring){width:22px!important;height:22px!important}
:host([data-exp-flyout-role="site"][data-exp-site-icon]) :is([data-exp-part="launcher"],.launcher) :is(.ring,.launcher-ring,.launcher-badge,.update-badge){display:none!important}
:host([data-exp-flyout-role="site"][data-exp-site-icon][data-exp-update="1"]) :is([data-exp-part="launcher"],.launcher)::after{content:'';position:absolute;top:2px;right:2px;width:7px;height:7px;border-radius:2px;background:${accent};pointer-events:none}
.exp-flyout-hub.has-ring{border-color:transparent}
.exp-flyout-ring{position:absolute;left:-6px;top:-6px;pointer-events:none;overflow:visible}
.exp-flyout-ring[hidden]{display:none}
.exp-flyout-hub:focus-visible{outline:2px solid ${accent};outline-offset:3px}
.exp-flyout-icon{display:grid;place-items:center;width:32px;height:32px;pointer-events:none}
.exp-flyout-hub[data-size="40"] .exp-flyout-icon{width:26px;height:26px}
.exp-flyout-hub[data-shape="circle"] .exp-flyout-icon{width:22px;height:22px}
.exp-flyout-icon>*{display:block!important;position:static!important;width:100%!important;height:100%!important;margin:0!important}
.exp-flyout-count{position:absolute;right:-6px;bottom:-6px;box-sizing:border-box;min-width:20px;height:16px;padding:0 4px;border-radius:4px;background:#27272a;border:1px solid #3f3f46;outline:2px solid #0e0e10;color:#fafafa;font:600 10px/14px Inter,"Segoe UI",system-ui,sans-serif;text-align:center;pointer-events:none}
.exp-flyout-mark{position:absolute;top:-5px;right:-5px;width:10px;height:10px;box-sizing:border-box;border-radius:3px;background:var(--exp-flyout-mark,#a1a1aa);outline:2px solid #0e0e10;pointer-events:none}
.exp-flyout-mark[hidden]{display:none}
.exp-flyout-panel{position:fixed;z-index:2147483590;box-sizing:border-box;background:#09090b;border:1px solid #27272a;border-radius:12px;box-shadow:0 12px 32px #0008;pointer-events:auto}
.exp-flyout-panel[hidden]{display:none!important}`;
  }
  // A product with an update marks its own host; the launcher corner shows the first marked product's colour.
  function setLauncherUpdate(productId, available) {
    const host = launcherHosts().find(node => node.dataset.productId === String(productId || ''));
    if (!host) return false;
    if (available) host.dataset.expUpdate = '1'; else delete host.dataset.expUpdate;
    syncFlyout(); emit('launcher-update', productId);
    return true;
  }
  // Progress (Dropper's drop progress) shows as a ring on the shared launcher. fraction is 0..1, or null to clear.
  function setLauncherProgress(productId, fraction) {
    const host = launcherHosts().find(node => node.dataset.productId === String(productId || ''));
    if (!host) return false;
    const value = Number(fraction);
    if (fraction === null || fraction === undefined || !Number.isFinite(value)) delete host.dataset.expProgress;
    else host.dataset.expProgress = String(Math.max(0, Math.min(1, value)));
    syncFlyout(); emit('launcher-progress', productId);
    return true;
  }
  // The ring is concentric with the launcher: its stroke centre is 3px outside the launcher edge (corner radius
  // + 3, stroke 2), which leaves an even 2px gap. It starts at the top centre, fills clockwise, and breaks with
  // 3px clearance around the count and the update marker.
  const SVG_NS = 'http://www.w3.org/2000/svg';
  function ringPath(size, radius) {
    // The ring runs along the launcher outline (1px inside its edge), so it reads as one border, not a second line.
    const a = 6, b = size + 4, r = radius - 1, c = (size + 10) / 2;
    return `M${c} ${a}H${b-r}A${r} ${r} 0 0 1 ${b} ${a+r}V${b-r}A${r} ${r} 0 0 1 ${b-r} ${b}H${a+r}A${r} ${r} 0 0 1 ${a} ${b-r}V${a+r}A${r} ${r} 0 0 1 ${a+r} ${a}Z`;
  }
  function renderRing(hub, size, radius, progress, mark) {
    let svg = hub.querySelector('[data-exp-part="flyout-ring"]');
    if (!progress) { svg?.setAttribute('hidden', ''); hub.classList.remove('has-ring'); return; }
    const s = size + 10;
    if (!svg) { svg = document.createElementNS(SVG_NS, 'svg'); svg.dataset.expPart = 'flyout-ring'; svg.setAttribute('class', 'exp-flyout-ring'); svg.setAttribute('aria-hidden', 'true'); hub.prepend(svg); }
    const key = [size, radius, progress.fraction, progress.color, mark].join('|');
    svg.removeAttribute('hidden'); hub.classList.add('has-ring');
    if (svg.dataset.key === key) return;
    svg.dataset.key = key;
    svg.setAttribute('width', s); svg.setAttribute('height', s); svg.setAttribute('viewBox', `0 0 ${s} ${s}`);
    const id = 'exp-flyout-ring-mask';
    const cuts = [`<rect x="${size-17}" y="${size-9}" width="${s-(size-17)}" height="${s-(size-9)}" fill="black"/>`].concat(mark ? [`<rect x="${size-4}" y="0" width="${s-(size-4)}" height="14" fill="black"/>`] : []);
    const d = ringPath(size, radius), pct = Math.round(progress.fraction * 1000) / 10;
    // The dark edge under the ring matches the count and marker outlines: the accent stays at 3:1 or better on light pages.
    svg.innerHTML = `<mask id="${id}"><rect width="${s}" height="${s}" fill="white"/>${cuts.join('')}</mask><g mask="url(#${id})"><path d="${d}" fill="none" stroke="#0e0e10" stroke-width="4"/><path d="${d}" fill="none" stroke="#3f3f46" stroke-width="2"/><path d="${d}" fill="none" stroke="${progress.color}" stroke-width="2" pathLength="100" stroke-dasharray="${pct} 200"/></g>`;
  }
  function removeHub(host) { host.shadowRoot?.querySelectorAll('[data-exp-part="flyout-hub"],[data-exp-part="flyout-panel"]').forEach(node => { node.expDragCleanup?.(); node.remove(); }); }
  function renderHub(host, state) {
    const shadow = host.shadowRoot;
    if (!shadow) return;
    let hub = shadow.querySelector('[data-exp-part="flyout-hub"]'), panel = shadow.querySelector('[data-exp-part="flyout-panel"]');
    if (!hub || !panel) {
      removeHub(host);
      panel = document.createElement('div'); panel.dataset.expPart = 'flyout-panel'; panel.className = 'exp-flyout-panel'; panel.hidden = true;
      hub = document.createElement('button'); hub.type = 'button'; hub.dataset.expPart = 'flyout-hub'; hub.className = 'exp-flyout-hub'; hub.setAttribute('aria-haspopup', 'true');
      const icon = document.createElement('span'); icon.className = 'exp-flyout-icon';
      const count = document.createElement('span'); count.dataset.expPart = 'flyout-count'; count.className = 'exp-flyout-count'; count.setAttribute('aria-hidden', 'true');
      const mark = document.createElement('span'); mark.dataset.expPart = 'flyout-mark'; mark.className = 'exp-flyout-mark'; mark.hidden = true;
      hub.append(icon, count, mark);
      hub.addEventListener('click', event => { const opening = document.documentElement.dataset.expFlyoutOpen !== '1'; setFlyoutOpen(opening); if (opening && event.detail === 0) focusFlyout(flyoutState().order[0]); });
      hub.addEventListener('keydown', onHubKey);
      // The corner launcher keeps vertical drag and its saved position; a site slot cannot be dragged.
      hub.expDragCleanup = bindLauncherDrag(hub, host.dataset.productId, { reorder:false, canDrag:() => !flyoutHubBox().site, title:'Drag to move the launcher.', layout:syncFlyout });
      shadow.append(panel, hub);
    }
    const icon = hub.querySelector('.exp-flyout-icon');
    if (!icon.firstElementChild) {
      const art = hostLauncher(host)?.querySelector('img,svg:not(.launcher-ring):not(.ring),.icon');
      if (art) { const copy = art.cloneNode(true); copy.removeAttribute('id'); copy.removeAttribute('style'); copy.setAttribute('aria-hidden', 'true'); icon.append(copy); }
    }
    const { hub:box, panel:panelBox } = flyoutBand(state);
    const others = state.order.length - 1;
    hub.querySelector('[data-exp-part="flyout-count"]').textContent = '+' + others;
    const updating = state.order.find(id => state.hosts.some(node => node.dataset.productId === id && node.dataset.expUpdate === '1'));
    const mark = hub.querySelector('[data-exp-part="flyout-mark"]');
    mark.hidden = !updating;
    if (updating) mark.style.setProperty('--exp-flyout-mark', FLYOUT_ACCENTS[updating] || '#a1a1aa');
    const progressHost = state.order.map(id => state.hosts.find(node => node.dataset.productId === id)).find(node => node?.dataset.expProgress !== undefined);
    renderRing(hub, box.size, box.shape === 'circle' ? box.size/2 : box.size === FLYOUT_TILE ? 10 : 12, progressHost ? { fraction:Number(progressHost.dataset.expProgress), color:FLYOUT_ACCENTS[progressHost.dataset.productId] || '#a1a1aa' } : null, Boolean(updating));
    hub.dataset.size = String(box.size);
    hub.dataset.shape = box.shape || 'rectangle';
    hub.setAttribute('aria-expanded', String(state.open));
    // The marker and ring are visual; the name carries the same news for screen readers.
    const notes = [];
    if (updating) notes.push(`${FLYOUT_NAMES[updating] || updating} update available`);
    if (progressHost) notes.push(`${FLYOUT_NAMES[progressHost.dataset.productId] || progressHost.dataset.productId} ${Math.round(Number(progressHost.dataset.expProgress) * 100)}%`);
    hub.setAttribute('aria-label', ['ExtraPotions: ' + state.order.map(id => FLYOUT_NAMES[id] || id).join(', '), ...notes].join('. '));
    Object.assign(hub.style, { left:Math.round(box.left)+'px', top:Math.round(box.top)+'px', width:box.size+'px', height:box.size+'px' });
    panel.hidden = !state.open;
    Object.assign(panel.style, { left:Math.round(panelBox.left)+'px', top:Math.round(panelBox.top)+'px', width:panelBox.width+'px', height:panelBox.height+'px' });
  }
  // Applies the flyout state to the hosts this Core copy registered. Safe to run any number of times.
  function syncFlyout() {
    const state = flyoutState(), root = document.documentElement;
    if (!state.active && root.dataset.expFlyoutOpen) delete root.dataset.expFlyoutOpen;
    const menu = root.getAttribute('data-exp-open-menu') || '';
    for (const host of state.hosts) {
      if (!registrations.has(host)) continue;
      const id = host.dataset.productId;
      const slot=siteSlot();
      if(slot?.shape==='circle'){host.dataset.expRailLauncher='circle';host.style.setProperty('--exp-rail-launcher-size',slot.size+'px');}
      else{delete host.dataset.expRailLauncher;host.style.removeProperty('--exp-rail-launcher-size');}
      if (!state.active) {
        if (singleSlot(state)) host.dataset.expFlyoutRole = 'site'; else delete host.dataset.expFlyoutRole;
        if (state.row) { host.dataset.expSiteIcon = '1'; host.style.setProperty('--exp-site-icon-size', state.row.size + 'px'); } else { delete host.dataset.expSiteIcon; host.style.removeProperty('--exp-site-icon-size'); }
        delete host.dataset.expFlyoutSelected; removeHub(host); continue;
      }
      delete host.dataset.expSiteIcon; host.style.removeProperty('--exp-site-icon-size');
      const role = state.open ? 'tile' : 'hidden';
      if (host.dataset.expFlyoutRole !== role) host.dataset.expFlyoutRole = role;
      if (state.open && menu === id) host.dataset.expFlyoutSelected = '1'; else delete host.dataset.expFlyoutSelected;
      if (id === state.lead) renderHub(host, state); else removeHub(host);
    }
  }
  function resetLauncherGrid(productId) { write(GRID_ORDER,[]); write(GRID_DELTA,0); layoutGrid(); emit('launcher-grid-moved', productId); }
  // Shared launcher drag for every product: drag moves the launcher group along the right edge;
  // Shift+drag and Alt+Arrow keys reorder. Listens on window in the capture phase so host pages
  // that stop pointer events (Twitch's player) cannot stall a drag. Returns a cleanup function.
  // reorder:false (the flyout launcher) moves the group only; canDrag() can refuse a drag (a site slot).
  function bindLauncherDrag(launcher, id, { layout = () => {}, reorder = true, canDrag = () => true, title = '' } = {}) {
    const removers = [];
    const on = (node,type,fn,opts) => { node.addEventListener(type,fn,opts); removers.push(() => node.removeEventListener(type,fn,opts)); };
    let startX=0,startY=0,startDelta=0,pointer=null,dragged=false,mode='',axis='',order=[];
    launcher.title = launcher.title || title || 'Drag to move the launchers. Shift+drag or Alt+Arrow keys reorder.';
    on(launcher,'pointerdown',e=>{if(e.button!==0||(reorder&&(flyoutState().active||singleSlot()))||(!reorder&&e.shiftKey)||!canDrag())return;pointer=e.pointerId;startX=e.clientX;startY=e.clientY;startDelta=Number(read(GRID_DELTA,0))||0;mode=e.shiftKey?'order':'group';order=interactionGridOrder();if(!order.includes(id))order.push(id);dragged=false;axis='';e.preventDefault();try{launcher.setPointerCapture(e.pointerId);}catch{}});
    // Listen on window in the capture phase so host pages that stop pointer events (Twitch's player) cannot stall a drag.
    on(launcher,'dragstart',e=>e.preventDefault());
    on(window,'pointermove',e=>{if(e.pointerId!==pointer)return;const dx=e.clientX-startX,dy=e.clientY-startY;if(!axis&&Math.max(Math.abs(dx),Math.abs(dy))>4)axis=mode;if(!axis)return;dragged=true;groupDragging=true;e.preventDefault();launcher.classList.add('is-dragging');if(axis==='group')write(GRID_DELTA,Math.round(Math.max(8-(innerHeight-60),Math.min(4,startDelta+dy))));else{const from=order.indexOf(id),offset=Math.abs(dx)>Math.abs(dy)?Math.round(-dx/56):Math.round(dy/56)*3,to=Math.max(0,Math.min(order.length-1,from+offset)),next=[...order];next.splice(from,1);next.splice(to,0,id);write(GRID_ORDER,next);}layoutGrid();emit('launcher-grid-moved',id);layout();},{passive:false,capture:true});
    const end=e=>{if(e.pointerId===pointer){pointer=null;if(groupDragging){groupDragging=false;shiftMemo=null;layoutGrid();emit('launcher-grid-moved',id);layout();}launcher.classList.remove('is-dragging');try{launcher.releasePointerCapture(e.pointerId);}catch{}}};
    on(window,'pointerup',end,true);on(window,'pointercancel',end,true);on(launcher,'lostpointercapture',end);
    on(launcher,'click',e=>{if(dragged){e.preventDefault();e.stopImmediatePropagation();dragged=false;}},true);
    on(launcher,'keydown',e=>{if(!reorder||flyoutState().active||!e.altKey||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();let next=interactionGridOrder();if(!next.includes(id))next.push(id);const from=next.indexOf(id),offset={ArrowLeft:1,ArrowRight:-1,ArrowUp:-3,ArrowDown:3}[e.key],to=Math.max(0,Math.min(next.length-1,from+offset));next=[...next];next.splice(from,1);next.splice(to,0,id);write(GRID_ORDER,next);layoutGrid();emit('launcher-grid-moved',id);layout();launcher.focus();});
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
  // True only when at least one released version lies in (previous, current], current among them,
  // and every one of them is quiet. Anything unparseable is not quiet.
  function isQuietUpgrade(previous, current, releasedVersions, quietVersions) {
    const pattern = /^\d+\.\d+\.\d+$/;
    previous = String(previous || '');
    current = String(current || '');
    if (!pattern.test(previous) || !pattern.test(current) || CoreFoundation.compareVersions(current, previous) <= 0) return false;
    const quiet = new Set(Array.from(quietVersions || [], String));
    const skipped = Array.from(releasedVersions || [], String).filter(version => pattern.test(version)
      && CoreFoundation.compareVersions(version, previous) > 0 && CoreFoundation.compareVersions(version, current) <= 0);
    return skipped.includes(current) && skipped.every(version => quiet.has(version));
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
    let anchor = document.documentElement.dataset.expLauncherAnchor === 'top' ? 'top' : 'bottom';
    let gridTop = Math.min(...launchers.map(box => box.top));
    let gridBottom = Math.max(...launchers.map(box => box.bottom));
    let gridRight = Math.max(...launchers.map(box => box.right));
    const band = slotBand();
    if (band) { anchor = band.down ? 'top' : 'bottom'; gridTop = band.top; gridBottom = band.bottom; gridRight = viewWidth() - 8; }
    let cursor = anchor === 'top' ? gridBottom + 8 : gridTop - 8;
    for (const { notice } of notices) {
      const width = Math.min(notice.offsetWidth || notice.scrollWidth || 260, Math.max(0, innerWidth - 24));
      const height = notice.offsetHeight || notice.scrollHeight || 72;
      const left = Math.max(8, Math.min(innerWidth - width - 8, gridRight - width));
      let top = anchor === 'top' ? cursor : cursor - height;
      if (band) top = clearReserved(top, height, left, left + width, anchor === 'top', notice);
      notice.style.setProperty('width', `${width}px`, 'important');
      notice.style.setProperty('left', `${left}px`, 'important');
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
    // Advertises the flyout protocol; every Core copy reads the lead and the mode from these attributes only.
    host.dataset.expFlyout = ExpLauncherFlyout.PROTOCOL;
    if (ExpLauncherFlyout.isSiteProduct(id)) host.dataset.expSiteProduct = '1'; else delete host.dataset.expSiteProduct;
    applyMatteToggleChrome(host);
    // The launcher is non-modal: site-wide dialog backdrop styles must never
    // paint over the page when the reference opens its manual popover.
    const backdropStyle = host.shadowRoot ? injectStyle(host.shadowRoot,
      ':host::backdrop{all:initial!important;display:none!important;background:transparent!important;pointer-events:none!important}',
      { expLauncherBackdrop: '1' }) : null;
    const stopProtect = CoreFoundation.protectLauncherHost(host);
    const flyoutStyle = host.shadowRoot ? injectStyle(host.shadowRoot, flyoutCss(id), { expFlyoutStyle: '1' }) : null;
    host.shadowRoot?.addEventListener('keydown', onTileKey);
    host.addEventListener('toggle', onHostToggle);
    let frame = 0;
    const refresh = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; layoutGrid(); syncFlyout(); controllers.get(host)?.layout(); }); };
    document.addEventListener('exp-core:coordination', refresh);
    addEventListener('resize', refresh);
    layoutGrid(); syncFlyout(); emit('launcher-added', id);
    const dispose = () => { stopProtect(); backdropStyle?.dispose(); flyoutStyle?.dispose(); host.shadowRoot?.removeEventListener('keydown', onTileKey); host.removeEventListener('toggle', onHostToggle); removeHub(host); delete host.dataset.expFlyoutRole; delete host.dataset.expFlyoutSelected; cancelAnimationFrame(frame); document.removeEventListener('exp-core:coordination', refresh); removeEventListener('resize', refresh); delete host.dataset.expProductLauncher; delete host.dataset.expFlyout; delete host.dataset.expSiteProduct; registrations.delete(host); layoutGrid(); emit('launcher-removed', id); };
    registrations.set(host, dispose);
    return dispose;
  }
  function themes() {
    return Object.freeze(CoreFoundation.THEME_MODES.map(id => Object.freeze(semanticTheme(CoreFoundation.resolveTheme(id)))));
  }
  function focusMenuSurface(panel) { if (!(panel instanceof HTMLElement)) return false; panel.tabIndex = -1; panel.style.outline = 'none'; panel.focus({ preventScroll: true }); return true; }
  const FLOATING_NOTICE_CSS = '.exp-floating-update{position:fixed;z-index:2147483647;box-sizing:border-box;width:min(312px,calc(100vw - 24px));max-width:calc(100vw - 24px);margin:0;padding:10px 32px 10px 10px;border:1px solid var(--exp-notice-border,#6f42b4);border-radius:10px;background:linear-gradient(180deg,var(--exp-notice-top,#251a35),var(--exp-notice-bottom,#18181d) 70%);color:var(--exp-notice-text,#f4f4f6);box-shadow:0 10px 28px #0008;font:500 var(--exp-font-size-small,11px)/1.45 system-ui,sans-serif}.exp-floating-update[hidden]{display:none!important}.exp-floating-update[data-exp-update-notice]{padding:10px;font:400 var(--exp-font-size-small,11px)/1.42 ui-sans-serif,system-ui,"Segoe UI",sans-serif}.exp-floating-update-dismiss{position:absolute;top:7px;right:7px;width:23px;height:23px;padding:0;border:1px solid transparent;border-radius:7px;background:transparent;color:inherit;cursor:pointer;font:15px/1 Arial,sans-serif}.exp-floating-update-dismiss:hover,.exp-floating-update-dismiss:focus-visible{border-color:var(--exp-notice-border,#6f42b4);outline:none}';
  function ensureFloatingNoticeStyle(shadow) {
    if (!shadow.querySelector('style[data-exp-floating-notice]')) {
      injectStyle(shadow, FLOATING_NOTICE_CSS, { expFloatingNotice: '1' });
    }
  }
  function syncNoticeTheme(notice, themeSource) {
    const theme = getComputedStyle(themeSource);
    const first = (names, fallback) => names.map(name => theme.getPropertyValue(name).trim()).find(Boolean) || fallback;
    notice.style.setProperty('--exp-notice-border', first(['--exp-notice-border','--theme-muted','--theme-accent','--accent','--accent2','--teal','--mb-brand'], theme.borderTopColor || '#6f42b4'));
    notice.style.setProperty('--exp-notice-top', first(['--exp-notice-top','--theme-bg','--theme-panel','--surface','--panel','--raised','--mb-surface','--bg','--mb-bg'], theme.backgroundColor || '#251a35'));
    notice.style.setProperty('--exp-notice-bottom', first(['--exp-notice-bottom','--theme-bg','--bg','--mb-bg','--surface','--mb-surface'], theme.backgroundColor || '#18181d'));
    notice.style.setProperty('--exp-notice-text', first(['--exp-notice-text','--theme-text','--text','--mb-ink'], theme.color || '#f4f4f6'));
  }
  // Core-owned update and changelog cards use the canonical menu-width notice
  // geometry. The legacy floating-notice coordinator remains exported
  // for compatibility, but it no longer owns these product notices.
  // Cards that appear on their own (menu closed) show one at a time: the owner is recorded on <html> so every
  // Core copy shares the queue, and a waiting card shows when the owner hides. The turn is taken even while a
  // product is alone, so products that load later wait for a card already showing. Products that draw their
  // own card (Dropper) take and give back a turn with the same calls.
  function takeNoticeTurn(token) {
    const root = document.documentElement, owner = root.dataset.expNoticeOwner || '';
    if (owner && owner !== token) return false;
    root.dataset.expNoticeOwner = String(token);
    return true;
  }
  function releaseNoticeTurn(token) {
    if (document.documentElement.dataset.expNoticeOwner !== String(token)) return;
    delete document.documentElement.dataset.expNoticeOwner;
    document.dispatchEvent(new Event('exp-core:notice-released'));
  }
  function createMenuNotice(options = {}) {
    const { shadow, panel, notice, versionButton = null } = options;
    const host = options.host || shadow?.host;
    if (!(shadow instanceof ShadowRoot) || !(panel instanceof Element) || !(notice instanceof Element)) {
      return Object.freeze({ show() {}, hide() {}, toggle() {}, layout() {}, setMenuOpen() {}, destroy() {} });
    }
    const durationMs = Math.max(0, Number(options.durationMs ?? 30000));
    const manageVersion = options.manageVersion !== false;
    let timer = 0, menuOpen = false, destroyed = false, frame = 0, waiting = false;
    const token = String(host?.dataset?.productId || 'product') + ':' + (++noticeSerial);

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
      dismiss.setAttribute('aria-label', 'Dismiss Changelog');
      dismiss.textContent = '×';
      notice.prepend(dismiss);
    }

    const themeSource = options.themeSource instanceof Element ? options.themeSource : panel;
    const returnFocus=options.returnFocus||versionButton;
    const syncTheme = () => syncNoticeTheme(notice, themeSource);
    function clearTimer() { clearTimeout(timer); timer = 0; }
    function queueLayout() {
      if (destroyed || frame) return;
      frame = requestAnimationFrame(() => { frame = 0; layout(); });
    }
    function layout() {
      if (destroyed || notice.hidden) return;
      syncTheme();
      const width = Math.min(menuWidth(), Math.max(0, innerWidth - 24));
      notice.style.setProperty('width', width + 'px', 'important');

      placeNotice(host || shadow.host, notice, menuOpen ? panel : null);
    }
    function release() { releaseNoticeTurn(token); }
    function retry() { if (waiting && !destroyed) show(); }
    function hide() {
      clearTimer();
      waiting = false;
      const focused=notice.contains(shadow.activeElement);notice.hidden = true;
      returnFocus?.setAttribute('aria-expanded', 'false');
      if(focused)returnFocus?.focus({preventScroll:true});
      release();
    }
    function show() {
      if (!menuOpen && !takeNoticeTurn(token)) { waiting = true; return; }
      waiting = false;
      notice.hidden = false;
      returnFocus?.setAttribute('aria-expanded', 'true');
      clearTimer();
      if (durationMs) timer = setTimeout(hide, durationMs);
      queueLayout();
    }
    function toggle() { if (notice.hidden) show(); else hide(); }
    function versionClick() { if (manageVersion) toggle(); else if (!notice.hidden) show(); }
    function setMenuOpen(value) {
      menuOpen = Boolean(value);
      // A notice shown inside the open menu needs the shared turn once it floats on its own; without it, it waits.
      if (!menuOpen && !notice.hidden && !takeNoticeTurn(token)) {
        clearTimer();
        notice.hidden = true;
        returnFocus?.setAttribute('aria-expanded', 'false');
        waiting = true;
      }
      queueLayout();
    }

    const resize = new ResizeObserver(queueLayout);
    resize.observe(panel);
    resize.observe(notice);
    const mutation = new MutationObserver(queueLayout);
    mutation.observe(notice, { attributes:true, attributeFilter:['hidden'], childList:true, subtree:true });
    const coordination = () => queueLayout();
    const escape=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();hide();}};notice.addEventListener('keydown',escape);
    dismiss.addEventListener('click', hide);
    versionButton?.addEventListener('click', versionClick);
    addEventListener('resize', queueLayout, { passive:true });
    document.addEventListener('exp-core:coordination', coordination);
    document.addEventListener('exp-core:notice-released', retry);

    return Object.freeze({
      show, hide, toggle, layout, setMenuOpen,
      destroy() {
        destroyed = true;
        cancelAnimationFrame(frame);
        clearTimer();
        resize.disconnect();
        mutation.disconnect();
        notice.removeEventListener('keydown',escape);dismiss.removeEventListener('click', hide);
        versionButton?.removeEventListener('click', versionClick);
        removeEventListener('resize', queueLayout);
        document.removeEventListener('exp-core:coordination', coordination);
        document.removeEventListener('exp-core:notice-released', retry);
        release();
      },
    });
  }

  function applyTheme(host, value, choices) {
    const controller = controllers.get(host) || menuControllers.get(host); if (!controller) return;
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
  // Behavior-only adapter for products with a custom progress surface. Full
  // Core chrome and custom shells share these bindings; no styles or nodes move.
  function createMenuController(options = {}) {
    const { id, host, shadow, panel, setOpen, getSettings = () => ({}) } = options;
    if (!id || !host || !shadow || !panel || typeof setOpen !== 'function') {
      throw new Error('Incomplete menu controller configuration');
    }
    if (menuControllers.has(host)) return menuControllers.get(host);
    // How long an untouched menu stays open; a product may ask for longer (Dropper: 60 seconds).
    const idleTimeoutMs = Math.max(15000, Number(options.idleTimeoutMs) || 0);
    let open = false, destroyed = false, timer = 0, deadline = 0;
    const removers = [];
    const on = (node, type, handler, opts) => {
      node.addEventListener(type, handler, opts);
      removers.push(() => node.removeEventListener(type, handler, opts));
    };
    const customThemeRoot = options.themeRoot;
    let customThemeMode = 'system';
    function setTheme(value) {
      if (!customThemeRoot) return;
      customThemeMode = CoreFoundation.normalizeThemeMode(value);
      const theme = CoreFoundation.resolveTheme(customThemeMode, id);
      for (const target of [customThemeRoot,panel]) {
        for (const key of tokenNames) target.style.setProperty('--theme-'+key,theme[key]);
        target.style.setProperty('--theme-skin',theme.accent);
        target.style.setProperty('--theme-skin-vertical',theme.accent);
        target.dataset.uiTheme=theme.id;target.dataset.themeSkin='flat';target.style.colorScheme=theme.mode;
      }
      host.dataset.uiTheme=theme.id;
      publishMenuPalette(host,theme);
    }
    if(customThemeRoot){
      const customSystemTheme = matchMedia('(prefers-color-scheme: dark)');
      on(customSystemTheme,'change',()=>{if(customThemeMode==='system')setTheme(customThemeMode);});
      setTheme(getSettings().uiTheme);
    }
    function cancelDismiss() {
      clearTimeout(timer);
      timer = 0;
      deadline = 0;
    }
    function enforceDeadline(now = Date.now()) {
      if (destroyed || !open || !deadline || now < deadline) return false;
      cancelDismiss();
      setOpen(false, false);
      return true;
    }
    function scheduleDismiss() {
      cancelDismiss();
      if (destroyed || !open || getSettings().menuAutoClose === false) return;
      deadline = Date.now() + idleTimeoutMs;
      timer = setTimeout(() => enforceDeadline(), idleTimeoutMs + 20);
    }
    function clearOwner() {
      if (document.documentElement.getAttribute('data-exp-open-menu') === id) {
        document.documentElement.removeAttribute('data-exp-open-menu');
      }
    }
    const keepOpen = typeof options.keepOpen === 'function' ? options.keepOpen : () => false;
    for (const type of ['pointerdown', 'click', 'wheel', 'keydown', 'input', 'change']) {
      on(panel, type, scheduleDismiss, { passive: type === 'wheel' });
    }
    on(document, 'exp-core:flyout-close', () => { if (open) setOpen(false, false); });
    on(document, 'exp-core:menu-open', () => {
      if (open && document.documentElement.getAttribute('data-exp-open-menu') !== id) setOpen(false, false);
    });
    if (options.closeOnOutsidePointer !== false) on(document, 'pointerdown', event => {
      if (!open || !event.isTrusted || event.composedPath().includes(host)) return;
      if (shadow.activeElement instanceof HTMLSelectElement) return;
      try { if (keepOpen(event)) return; } catch {}
      setOpen(false, false);
    }, true);
    const controller = Object.freeze({
      state(value) {
        if (destroyed) return;
        open = Boolean(value);
        if (open) {
          document.documentElement.setAttribute('data-exp-open-menu', id);
          document.dispatchEvent(new Event('exp-core:menu-open'));
        } else clearOwner();
        panel.classList.toggle('fl-rail-open', open);
        if (open) scheduleDismiss(); else cancelDismiss();
      },
      setTheme, scheduleDismiss, cancelDismiss, enforceDeadline,
      get isOpen() { return open; },
      get dismissAt() { return deadline; },
      get timerActive() { return Boolean(timer); },
      idleTimeoutMs,
      destroy() {
        if (destroyed) return;
        destroyed = true;
        open = false;
        cancelDismiss();
        clearOwner();
        removers.forEach(remove => remove());
        menuControllers.delete(host);
      },
    });
    removers.push(ExpMenuPreferences.bindMenuSize({host,shadow,panel,onLayout:options.onLayout}));
    menuControllers.set(host, controller);
    return controller;
  }

  function create(options) {
    const { id, host, shadow, launcher, panel, getSettings = () => ({}), setOpen, shortcutKey = '', productTheme, launcherSrc } = options;
    if (controllers.has(host)) return controllers.get(host);
    // All styling comes from the reference and the composition adapter. Remove
    // product copies and their constructed sheets before mounting the canonical UI. A product that registers its
    // launcher first keeps the launcher's own styles (backdrop and flyout), which follow the canonical sheet.
    const launcherStyles = [...shadow.querySelectorAll('style[data-exp-launcher-backdrop],style[data-exp-flyout-style]')];
    shadow.querySelectorAll('style').forEach(node => { if (!launcherStyles.includes(node)) node.dispose ? node.dispose() : node.remove(); });
    try { shadow.adoptedStyleSheets = []; } catch {}
    const styles = injectStyle(shadow, canonicalCss + compositionCss, { expCoreStyle:version });
    try { shadow.adoptedStyleSheets = [...shadow.adoptedStyleSheets, ...launcherStyles.map(node => node.expSheet).filter(Boolean)]; } catch {}
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
    let selected, requestedTheme = 'system', open = false, destroyed = false, frame = 0;
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
      themeRoot.style.colorScheme = selected.mode;
      host.style.colorScheme = selected.mode;
    }
    function syncThemeOwner() {
      host.dataset.expThemeDeprioritized = '0';
      host.dataset.expThemeOwner = id;
      paintTheme(localTheme);
    }
    function setTheme(value) {
      requestedTheme = CoreFoundation.normalizeThemeMode(value);
      localTheme = semanticTheme(CoreFoundation.resolveTheme(requestedTheme, id));
      publishMenuPalette(host, localTheme);
      syncThemeOwner();
    }
    const systemTheme = matchMedia('(prefers-color-scheme: dark)');
    const followSystemTheme = () => { if (requestedTheme === 'system') setTheme(requestedTheme); };
    systemTheme.addEventListener('change', followSystemTheme);
    removers.push(() => systemTheme.removeEventListener('change', followSystemTheme));
    function layout() {
      if (destroyed || !launcher.isConnected) return;
      const state = getSettings();
      themeRoot.style.setProperty('--exp-menu-width', menuWidth() + 'px');
      const fontTokens=ExpMenuPreferences.menuSizeTokens();themeRoot.style.setProperty('--exp-font-size-body',fontTokens.body+'px');themeRoot.style.setProperty('--exp-font-size-small',fontTokens.small+'px');
      themeRoot.classList.toggle('reduce-motion', state.reduceMotion === true || state.reduceMotion === 'on' || state.reducedMotion === 'reduce' || (state.reduceMotion === 'system' || state.reducedMotion === 'system') && matchMedia('(prefers-reduced-motion:reduce)').matches);
      themeRoot.style.setProperty('--exp-ui-opacity','1');
      const { top, right } = launcherPlacement(host);
      Object.assign(launcher.style,{top:top+'px',right:right+'px',bottom:'auto',left:'auto',zIndex:open?'2147483647':'2147483600'});
      Object.assign(panel.style,{overflowY:'auto',overflowX:'hidden',overscrollBehavior:'contain',zIndex:open?'2147483647':'2147483599'});
      if (!open) return;
      placeMenu(host, panel, menuWidth());
      menuNotices.forEach(notice=>notice.layout());
    }
    let arrangement, resize, mutation;
    const arrangementAnchor = document.createComment('menu arrangement styles'); shadow.append(arrangementAnchor);
    function mountMenu() {
      if (arrangement) return;
      const existingStyles = new Set(shadow.querySelectorAll('style'));
      arrangement = ExpMenuArrangement.mount({ panel, id, onChange: queueLayout, resetLaunchers() { resetLauncherGrid(id); queueLayout(); } });
      // Deferred base styles must retain their original precedence below product styles.
      for (const style of shadow.querySelectorAll('style')) if (!existingStyles.has(style)) shadow.insertBefore(style, arrangementAnchor);
      arrangementAnchor.remove();
      resize = new ResizeObserver(queueLayout); resize.observe(panel);
      mutation = new MutationObserver(records=>{if(records.some(r=>r.type==='childList'||r.attributeName==='hidden'))queueLayout();}); mutation.observe(panel,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
    }
    function queueLayout() { if (!frame && !destroyed) frame = requestAnimationFrame(() => { frame = 0; normalizeControls(panel); arrangement?.update(); layout(); }); }
    removers.push(bindLauncherDrag(launcher, id, { layout }));
    const menuController = createMenuController({ ...options, id, host, shadow, panel, getSettings, setOpen, onLayout:queueLayout });
    on(window,'keydown',e=>{if(shortcutKey&&e.altKey&&e.shiftKey&&e.key.toLowerCase()===shortcutKey.toLowerCase()&&!e.repeat){e.preventDefault();setOpen(!open,true);} });
    on(window,'resize',queueLayout);on(document,'exp-core:coordination',queueLayout);
    on(document,'exp-core:coordination',syncThemeOwner);
    const controller = {
      layout, setTheme,
      state(value) {open=Boolean(value);if(open)mountMenu();menuController.state(open);menuNotices.forEach(notice=>notice.setMenuOpen(open));if(open)panel.querySelectorAll('[data-exp-health]').forEach(node=>node.refreshHealth?.());queueLayout();},
      update(){normalizeControls(panel);if(open)panel.querySelectorAll('[data-exp-health]').forEach(node=>node.refreshHealth?.());queueLayout();},
      get dismissAt(){return menuController.dismissAt;},
      destroy(){destroyed=true;arrangement?.destroy();arrangementAnchor.remove();defaultSupport?.destroy();menuController.destroy();cancelAnimationFrame(frame);resize?.disconnect();mutation?.disconnect();menuNotices.forEach(notice=>notice.destroy());removers.forEach(f=>f());styles.dispose();controllers.delete(host);}
    };
    controllers.set(host,controller);setTheme(getSettings().uiTheme);
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
    // Installs and updates come only from published releases, never from the
    // branch: GitHub serves the newest release's asset at this address.
    const RELEASE_URL = 'https://github.com/' + repository + '/releases';
    const INSTALL_URL = RELEASE_URL + '/latest/download/' + String(options.scriptAsset || (productId + '.user.js'));
    const CACHE_KEY = 'exp:v3:' + productId + ':update-cache';
    const CHECK_INTERVAL = 12 * 60 * 60 * 1000;
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
      if(ExtraPotionsTools.productDataResetting(productId))return;
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
    // A release is quiet when the newest heading of its notes is that release, marked "(quiet)".
    function releaseQuiet(body, latest) {
      for (const line of String(body || '').split(/\r?\n/)) {
        if (!/^##\s+/.test(line)) continue;
        const heading = line.match(/^##\s+v?(\d+\.\d+\.\d+)\b(.*)$/);
        return Boolean(heading && heading[1] === latest && /\(quiet\)\s*$/.test(heading[2]));
      }
      return false;
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
        quiet: Boolean(next.quiet && latest && CoreFoundation.compareVersions(latest, currentVersion) > 0),
        checkedForVersion: next.checkedForVersion || null,
        lastRemoteVersion: latest || null,
        lastHttpStatus: Number(next.lastHttpStatus || 0),
        lastError: String(next.lastError || ''),
        installUrl: INSTALL_URL,
        releaseUrl: RELEASE_URL,
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
        state.quiet = false;
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
        state.quiet = releaseQuiet(payload.body, latest);
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
      INSTALL_URL,
      RELEASE_URL,
      CHECK_INTERVAL,
      check,
      status,
      compare: CoreFoundation.compareVersions,
    });
  }

  function createSupportControl({ url = SUPPORT_URL, label = 'Support' } = {}) {
    if (!url) return null;
    const wrapper = document.createElement('div');
    wrapper.className = 'support-wrap';
    const style = document.createElement('style');
    style.dataset.expSupportControl = '1';
    style.dataset.expOwned = '1';
    style.textContent = CoreFoundation.supportControlCss();
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
    wrapper.append(style, button, popover);
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
      versionButton: null,returnFocus:options.returnFocus||versionButton,
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
      // Some products close the menu without marking the panel hidden; only a drawn panel counts as open.
      controller.setMenuOpen(!panel.hidden && panel.getClientRects().length > 0);
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
    summary.textContent = 'Product Compatibility';
    const output = document.createElement('div');
    output.setAttribute('aria-live', 'polite');
    const refreshButton = document.createElement('button');
    refreshButton.type = 'button';
    refreshButton.className = 'life-btn action';
    refreshButton.textContent = 'Refresh Compatibility';

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
        line.textContent = `${product.id.toUpperCase()} ${product.version} · Core ${product.coreVersion} · ${health?.status === 'healthy' ? 'Healthy' : 'Check Compatibility'}${stateAge}`;
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
  function createDiagnosticsControls(getReport, notify = () => {}) { return ExtraPotionsDiagnostics.createControls(getReport, notify); }
  const { normalizeHealth, createHealthControls } = ExpHealthSummary;
  const { createRecoveryGuard } = ExpRecoveryControl;
  function createProduct({id,name,version:productVersion,subtitle='',artwork,theme,sections=[],getSettings,onSettings=()=>{},priority,supportUrl=SUPPORT_URL,keepOpen}) {
    const host=document.createElement('div');host.id='exp-'+id+'-root';host.dataset.expOwned='1';const shadow=host.attachShadow({mode:'open'});const panel=document.createElement('aside');panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label',name+' settings');
    const header=document.createElement('header');header.className='menu-head';const brand=document.createElement('div');brand.className='header-brand';const image=document.createElement('img');image.src=artwork;image.alt='';const copy=document.createElement('div');const titleRow=document.createElement('div');const title=document.createElement('strong');title.textContent=name;const v=document.createElement('button');v.type='button';v.className='version';v.textContent='v'+productVersion;v.setAttribute('aria-label','View '+name+' v'+productVersion+' Changelog');titleRow.append(title,v);copy.append(titleRow);brand.append(image,copy);const close=document.createElement('button');close.className='close';close.textContent='×';close.setAttribute('aria-label','Close '+name);const actions=document.createElement('div');actions.className='header-actions';const support=createSupportControl({url:supportUrl,label:'Support '+name});if(support)actions.append(support.element);actions.append(close);header.append(brand,actions);const divider=document.createElement('div');divider.className='header-divider';const nav=document.createElement('nav');
    let isOpen=false, activeId='';let chrome;
    const sectionMap=new Map();
    function renderSection(section,body){const content=section.render({core:api,onSettings});replaceMenuContent(body,content);chrome?.update();}
    function renderActive(){if(!activeId)return false;const entry=sectionMap.get(activeId);if(!entry||entry.body.hidden)return false;renderSection(entry.section,entry.body);return true;}
    function setOpen(value,focus=true){isOpen=Boolean(value);panel.hidden=!isOpen;launcher.setAttribute('aria-expanded',String(isOpen));if(isOpen){activeId='';nav.querySelectorAll('.route-body').forEach(n=>n.hidden=true);nav.querySelectorAll('button[data-section]').forEach(n=>n.setAttribute('aria-expanded','false'));}chrome.state(isOpen);if(focus)(isOpen?focusMenuSurface(panel):launcher.focus());}
    for(const section of sections){const group=document.createElement('section');group.className='tool-panel';const button=document.createElement('button');button.type='button';button.textContent=section.label;button.dataset.section=section.id;const body=document.createElement('div');body.className='route-body';body.hidden=true;sectionMap.set(section.id,{section,body,button});button.addEventListener('click',()=>{const opening=body.hidden;nav.querySelectorAll('.route-body').forEach(n=>n.hidden=true);nav.querySelectorAll('button[data-section]').forEach(n=>{n.classList.toggle('last-opened',n===button);n.setAttribute('aria-expanded',String(opening&&n===button));});body.hidden=!opening;activeId=opening?section.id:'';if(opening)renderSection(section,body);chrome.update();});group.append(button,body);nav.append(group);}
    const launcher=document.createElement('button');launcher.className='launcher';launcher.type='button';launcher.setAttribute('aria-label','Open '+name);const mark=image.cloneNode(true);launcher.append(mark);launcher.addEventListener('click',()=>setOpen(!isOpen));close.addEventListener('click',()=>setOpen(false));panel.append(header,divider,nav);shadow.append(panel,launcher);document.documentElement.append(host);chrome=create({id,host,shadow,panel,launcher,getSettings,setOpen,productTheme:theme,supportUrl,keepOpen});const unregister=registerLauncher(host,{productId:id,priority});
    const key=e=>{if(e.key==='Escape'&&isOpen)setOpen(false);};document.addEventListener('keydown',key);
    return {host,shadow,panel,launcher,versionButton:v,open:()=>setOpen(true),close:()=>setOpen(false),toggle:()=>setOpen(!isOpen),refresh:()=>chrome.update(),renderActive,get isOpen(){return isOpen;},destroy(){document.removeEventListener('keydown',key);support?.destroy();chrome.destroy();unregister();host.remove();}};
  }
  let gridFrame=0;
  let lastSlotKey='';
  const checkSlot=()=>{const slot=siteSlot();const key=slot?slot.left+','+slot.top:'';if(key!==lastSlotKey){lastSlotKey=key;emit('launcher-site-slot','core');}};
  const scheduleGrid=()=>{if(!gridFrame)gridFrame=requestAnimationFrame(()=>{gridFrame=0;layoutGrid();syncFlyout();checkSlot();recheckSiteControls();});};
  // Page changes can add, move or hide a site slot, so they also drop the remembered slot, at most once per
  // 150ms: a busy page (Twitch chat) would otherwise re-measure the top bar on every change.
  let slotStale=0;
  const markSlotStale=()=>{if(!slotStale)slotStale=setTimeout(()=>{slotStale=0;slotMemo=null;scheduleGrid();},150);};
  // Launcher attributes and launchers coming or going re-lay the grid on the next frame; any other page change
  // waits for the 150ms gate above.
  const launcherChange=record=>record.type==='attributes'||[...record.addedNodes,...record.removedNodes].some(node=>node.dataset?.expProductLauncher==='1');
  const gridObserver=new MutationObserver(records=>{markSlotStale();if(records.some(launcherChange))scheduleGrid();});
  const startGrid=()=>{if(!document.documentElement)return;gridObserver.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['data-exp-product-launcher','data-product-id','data-launcher-priority','data-launcher-reserved-rows','data-exp-flyout','data-exp-update','data-exp-progress','data-exp-open-menu','data-exp-flyout-open']});scheduleGrid();};
  if(document.documentElement)startGrid();else addEventListener('DOMContentLoaded',startGrid,{once:true});
  document.addEventListener('exp-core:coordination',scheduleGrid);
  document.addEventListener('exp-core:menu-open', raiseOpenMenuHost);
  document.addEventListener('exp-core:flyout-focus', onFlyoutFocus);
  document.addEventListener('pointerdown', onFlyoutOutside, true);
  addEventListener('keydown', onFlyoutEscape, true);
  addEventListener('resize',scheduleGrid,{passive:true});
  addEventListener('scroll',()=>{recheckSiteControls();if (/^(www|sh)\.reddit\.com$/.test(location.hostname)) markSlotStale();},{passive:true,capture:true});
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
      scriptAsset: options.scriptAsset,
      enabled: options.enabled,
      onError: options.onError,
    });
    return Object.freeze({ lifecycle, diagnostics, updates });
  }

  const api = Object.freeze({...ExtraPotionsTools,setMenuHelp:ExpMenuHelp.setMenuHelp,...ExpMenuPreferences,...ExpSiteColors,normalizeHealth,createHealthControls,createRecoveryGuard,version,sourceVersion,protocol,gridProtocol,reference:CoreFoundation,css:canonicalCss,themes,create,createMenuController,createProduct,menuTemplate:ExpLeanMenu.template,setMenuStatus:ExpLeanMenu.setMenuStatus,createSupportControl,createProductNotice,createLifecycle:()=>createProductLifecycle(api),createProductServices,registerLauncher,setLauncherUpdate,setLauncherProgress,bindLauncherDrag,launcherPlacement,placeMenu,placeNotice,resetLauncherGrid,layout:layoutGrid,replaceMenuContent,createDisclosure,createSystemGrid,isOwnedSheet,menuWidth,cloneSettings,applyTextGradient,injectStyle,applyTheme,applyMatteToggleChrome,applyTwoColumnSettingsGrid,applyContentDrivenMenuLayout,publishMenuPalette,createMenuNotice,takeNoticeTurn,releaseNoticeTurn,createReleaseUpdateChecker,registerFloatingNotice,layoutFloatingNotices,claimNotice,consumeVersionChange,isQuietUpgrade,focusMenuSurface,registerDiagnosticsProduct,registerSuiteProduct,suiteContract,suiteSnapshot,hasProductCapability,capabilityProviders,emitSuiteEvent,publishSuiteState,suiteStateSnapshot,latestSuiteState,subscribeSuiteState,onSuiteEvent,suiteSitePaused,suiteSitePausePersisted,setSuiteSitePaused,pageContext,observeNavigation,navigationObserverState,suiteTrust:SUITE_TRUST,registerPresentationProvider,presentationProviders,suiteHealth,readPresentationState,setPresentationState,clearPresentationState,presentationStateChain,isPresentationSuppressed,presentationPhases:PRESENTATION_PHASES,presentationChannels:PRESENTATION_CHANNELS,observePresentationState,observePage,observePageBatch,pageObserverState,suiteProducts:SUITE_PRODUCTS,suitePriority:SUITE_PRIORITY,productCompatibility:productCompatibilityReport,createCompatibilityControls:createSuiteCompatibilityControls,bindDiagnosticsControls:ExtraPotionsDiagnostics.bindControls,createDiagnosticsReport,downloadDiagnostics,createDiagnosticsControls,mountMenuArrangement:ExpMenuArrangement.mount,mountSubmenuTabs:ExpMenuArrangement.mountTabs,menuCategories:ExpMenuArrangement.categories,categorizeMenuSections:ExpMenuArrangement.describe,createMenuCategoryDisclosure:(label,category,...contents)=>ExpMenuArrangement.createDisclosure({document,label,category,contents}),collapseMenuSubmenus:ExpMenuArrangement.collapseSubmenus,compareVersions:CoreFoundation.compareVersions});
  return api;
})();
  // END EXP CORE

  // Small text helpers shared by every module. normalizeGameName is also the storage key for a game's priority,
  // its place in the order and its ignored record, so it must stay character for character as in 3.x.
  const cleanText = value => String(value || '').replace(/\s+/g, ' ').trim();
  const normalizeGameName = value => cleanText(value).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
  const parseTime = value => { const ms = value ? Date.parse(value) : 0; return Number.isFinite(ms) ? ms : 0; };

  // Saved data. 4.0 reads and writes the keys 3.8.x wrote, in the same places and formats, so an upgrade keeps
  // everything and a rollback to 3.8.x loses nothing. 4.0.0 never deletes a key or a saved setting it no longer
  // uses: removed settings stay in the stored object, and keys in KEYS marked 'unused' are left where they are.
  const SETTINGS_GM_KEY = 'exp:v3:dropper:settings';
  const LEGACY_SETTINGS_KEY = 'tdh-settings-v3';
  const CAMPAIGN_MEMORY_RESET_VERSION = '3.2.6';
  const CLAIM_HISTORY_LIMIT = 100;

  const SETTING_DEFAULTS = Object.freeze({
    claimBonus: true,
    keepTabActive: true,
    claimDrops: true,
    progressInTitle: true,
    findNextStream: true,
    muteRestarted: true,
    backgroundEarning: false,
    resumeSessionOnRestart: true,
    restoreChannelPlayer: true,
    rememberContentWarnings: false,
    reduceMotion: false,
    dropDetails: true,
    uiTheme: 'system',
    siteColors: 'system',
    hideTwitchSubscriptionPromos: true,
    campaignStrategy: 'priority',
    protectedChannels: Object.freeze([]),
    excludedChannels: Object.freeze([]),
    switchPolicy: 'normal',
  });
  // Settings 3.x had that 4.0 removed or merged into built-in behaviour. They are kept in storage, never read.
  const REMOVED_SETTINGS = Object.freeze([
    'autoPictureInPicture', 'badgeOnly', 'notifications', 'notifyClaimed', 'notifyCampaignEnding', 'notifyStalledProgress',
    'notifyStreamSwitches', 'notifyOnlyWhenHidden', 'notificationCooldownMinutes', 'pauseAutoSwitchMinutes',
    'pauseAutoSwitchUntil', 'queueEnabled', 'queueCount', 'queueOnStall', 'queueOnOffline', 'queueOnCategoryChange',
    'queuePreference', 'quietHoursEnabled', 'quietHoursStart', 'quietHoursEnd',
  ]);
  // 3.x removed these from the saved settings on every load (an old auth token among them); 4.0 drops them on save.
  const STRIPPED_SETTINGS = Object.freeze(['authToken', 'hideChatSubscriptionPromos', 'autoHideCard', 'collapsedPanelWidth', 'menuWidth', 'customOpacity', 'opacityPercent', '__proto__', 'constructor', 'prototype']);
  const CHOICES = Object.freeze({
    uiTheme: ['light', 'dark', 'system'],
    siteColors: ['light', 'dark', 'system'],
    switchPolicy: ['normal', 'stopped-earning'],
    campaignStrategy: ['priority', 'deadline', 'completion', 'shortest'],
  });

  // Every key 3.8.x stores. area: gm, local or session. scope: 'global' (the key itself), 'account'
  // (`<key>:account:<login>`), 'records' (`<key>:account:<login>:<id>`) or 'prefix' (`<key>:<anything>`).
  // use: 'kept' (4.0 reads it), 'unused' (left in place), 'core' (Core's), 'sync' (Dropper S's), 'new' (added by 4.0).
  const KEYS = Object.freeze([
    ['settings', SETTINGS_GM_KEY, 'gm', 'global', 'kept'],
    ['contentWarnings', 'exp:v3:dropper:content-warning-memory', 'gm', 'global', 'kept'],
    ['updateCache', 'exp:v3:dropper:update-cache', 'gm', 'global', 'core'],
    ['updateCacheLocal', 'exp:v3:dropper:update-cache', 'local', 'global', 'core'],
    ['legacySettings', LEGACY_SETTINGS_KEY, 'local', 'global', 'kept'],
    ['lastVersion', 'dropper-last-version-v2', 'local', 'global', 'kept'],
    ['gqlOperations', 'dropper-gql-operations-v1', 'local', 'global', 'kept'],
    ['categorySlugs', 'dropper-category-slugs-v4', 'local', 'global', 'kept'],
    ['updateReload', 'dropper-update-reload-pending', 'local', 'global', 'kept'],
    ['accountScopeOwner', 'dropper-account-scope-owner-v1', 'local', 'global', 'unused'],
    ['categorySlugsV3', 'dropper-category-slugs-v3', 'local', 'global', 'unused'],
    ['updateStateV2', 'dropper-update-state-v2', 'local', 'global', 'unused'],
    ['launcherTop', 'tdh-launcher-top', 'local', 'global', 'unused'],
    ['launcherGridDelta', 'tdh-launcher-grid-delta-v3', 'local', 'global', 'unused'],
    ['settingsV1', 'tdh-settings-v1', 'local', 'global', 'unused'],
    ['settingsV2', 'tdh-settings-v2', 'local', 'global', 'unused'],
    ['unscopedCampaignMemory', 'dropper-campaign-memory-v1', 'local', 'global', 'unused'],
    ['campaignMemory', 'dropper-campaign-memory-v1', 'local', 'account', 'kept'],
    ['campaignMemoryReset', 'dropper-campaign-memory-reset-v1', 'local', 'account', 'kept'],
    ['priorityOrder', 'dropper-campaign-priority-order-v1', 'local', 'account', 'kept'],
    ['ignoredGames', 'dropper-ignored-campaign-games-v1', 'local', 'account', 'kept'],
    ['tabInChargeSince', 'dropper-automation-tab-since-v1', 'local', 'account', 'kept'],
    ['notificationState', 'dropper-notification-quiet-v1', 'local', 'account', 'unused'],
    ['tempCampaignSkips', 'dropper-temp-campaign-skips-v1', 'local', 'account', 'unused'],
    ['priority', 'dropper-campaign-priority-v1', 'local', 'records', 'kept'],
    ['claimHistory', 'dropper-claim-history-v1', 'local', 'records', 'kept'],
    ['tabPresence', 'dropper-tab-presence-v1', 'local', 'records', 'kept'],
    ['claimLease', 'dropper-claim-lease-v1', 'local', 'prefix', 'kept'],
    ['syncAddress', 'dropper-sync-address-v1', 'local', 'global', 'sync'],
    ['syncState', 'dropper-sync-state-v1', 'local', 'global', 'sync'],
    ['syncDevice', 'dropper-sync-device-v1', 'local', 'global', 'sync'],
    ['syncDeviceName', 'dropper-sync-device-name-v1', 'local', 'global', 'sync'],
    ['activityLog', 'dropper-activity-log', 'session', 'account', 'kept'],
    ['mutePending', 'dropper-mute-pending-v1', 'session', 'account', 'kept'],
    ['viewingIntent', 'dropper-viewing-intent-v1', 'session', 'account', 'kept'],
    ['viewingNavigation', 'dropper-viewing-navigation-v1', 'session', 'account', 'kept'],
    ['viewingSelection', 'dropper-viewing-selection-v1', 'session', 'account', 'kept'],
    ['manualStreamLock', 'dropper-manual-stream-lock-v1', 'session', 'account', 'kept'],
    ['clientIntegrity', 'dropper-client-integrity-v1', 'session', 'account', 'kept'],
    ['campaignCatalog', 'dropper-campaign-catalog', 'session', 'account', 'kept'],
    ['campaignPageImport', 'dropper-campaign-page-import-v1', 'session', 'account', 'kept'],
    ['networkState', 'dropper-network-state', 'session', 'account', 'kept'],
    ['creditedProgressAt', 'dropper-credited-progress-at-v1', 'session', 'account', 'kept'],
    ['progressTimeline', 'dropper-progress-timeline-v1', 'session', 'account', 'kept'],
    ['recoveryLoop', 'dropper-recovery-loop-v1', 'session', 'account', 'kept'],
    ['campaignRestrictions', 'dropper-campaign-restrictions-v1', 'session', 'account', 'kept'],
    ['viewerId', 'dropper-viewer-id-v1', 'session', 'account', 'kept'],
    ['nativeEarnedRewards', 'dropper-native-earned-rewards-v1', 'session', 'account', 'kept'],
    ['routingSession', 'dropper-routing-session-v310', 'session', 'account', 'unused'],
    ['standbyStreams', 'dropper-standby-streams', 'session', 'account', 'unused'],
    ['standbyRefreshAt', 'dropper-standby-refresh-at', 'session', 'account', 'unused'],
    ['standbyMaintenanceAt', 'dropper-standby-maintenance-at', 'session', 'account', 'unused'],
    ['nextGameAfterClaim', 'dropper-next-game-after-claim', 'session', 'account', 'unused'],
    ['navigationGuard', 'dropper-auto-navigation-guard', 'session', 'account', 'unused'],
    ['navigationInFlight', 'dropper-navigation-in-flight', 'session', 'account', 'unused'],
    ['recoverySnapshot', 'dropper-recovery-snapshot-v1', 'session', 'account', 'unused'],
    ['controller', 'dropper-controller-v4', 'session', 'account', 'new'],
  ].map(([name, key, area, scope, use]) => Object.freeze({ name, key, area, scope, use })));
  const KEY = Object.freeze(Object.fromEntries(KEYS.map(entry => [entry.name, entry.key])));
  const KEY_SCOPE = Object.freeze(Object.fromEntries(KEYS.map(entry => [entry.name, entry.scope])));
  // Page keys 3.x stores as plain strings rather than JSON.
  const RAW_KEYS = new Set(['lastVersion', 'tabInChargeSince', 'accountScopeOwner']);

  function settingValue(name, value) {
    const fallback = SETTING_DEFAULTS[name];
    if (typeof fallback === 'boolean') return typeof value === 'boolean' ? value : fallback;
    if (Array.isArray(fallback)) {
      return Array.isArray(value)
        ? [...new Set(value.filter(item => typeof item === 'string').map(item => item.trim().toLowerCase()).filter(item => /^[a-z0-9_]{1,25}$/.test(item)))].slice(0, 100)
        : [];
    }
    const choice = name === 'campaignStrategy' ? cleanText(value).toLowerCase() : value;
    return CHOICES[name].includes(choice) ? choice : fallback;
  }

  function createStore({ local, session, gm, cookie = () => '', now = Date.now } = {}) {
    let writable = true;
    const login = () => cleanText(cookie('login') || cookie('name') || '').replace(/^@/, '').toLowerCase();
    const suffix = (account = login()) => encodeURIComponent(cleanText(account).toLowerCase() || 'signed-out');
    const scoped = (key, account) => `${key}:account:${suffix(account)}`;

    const read = (storage, key) => { try { return storage.getItem(key); } catch (_) { return null; } };
    const write = (storage, key, value) => {
      if (!writable) return false;
      try { storage.setItem(key, value); return true; } catch (_) { return false; }
    };
    const remove = (storage, key) => { if (writable) try { storage.removeItem(key); } catch (_) {} };
    const parse = (raw, fallback) => { if (raw == null) return fallback; try { return JSON.parse(raw); } catch (_) { return fallback; } };
    const keysWith = (storage, prefix) => {
      const found = [];
      try { for (let index = 0; index < storage.length; index += 1) { const key = storage.key(index); if (key?.startsWith(prefix)) found.push(key); } } catch (_) {}
      return found;
    };
    const gmGet = (key, fallback) => {
      try { const value = gm?.get(key, fallback); return value && typeof value.then === 'function' ? fallback : value; } catch (_) { return fallback; }
    };
    const gmSet = (key, value) => { if (!writable) return false; try { gm.set(key, value); return true; } catch (_) { return false; } };

    // Settings. GM first; the page copy only when the manager has none (3.x moved it to GM and removed the copy).
    // Without the manager's storage, changes last for this page only, as 3.x's in-memory settings did.
    let pageOnlySettings = null;
    function storedSettings() {
      let value = gmGet(SETTINGS_GM_KEY, null);
      if (value == null) value = pageOnlySettings ?? parse(read(local, LEGACY_SETTINGS_KEY), {});
      const stored = value && typeof value === 'object' && !Array.isArray(value) ? JSON.parse(JSON.stringify(value)) : {};
      if (stored.hideTwitchSubscriptionPromos == null && stored.hideChatSubscriptionPromos != null) {
        stored.hideTwitchSubscriptionPromos = Boolean(stored.hideChatSubscriptionPromos);
      }
      for (const name of STRIPPED_SETTINGS) delete stored[name];
      return stored;
    }
    function settings() {
      const stored = storedSettings();
      return Object.fromEntries(Object.keys(SETTING_DEFAULTS).map(name => [name, settingValue(name, Object.hasOwn(stored, name) ? stored[name] : SETTING_DEFAULTS[name])]));
    }
    // Merges known settings onto the stored object; everything else in it (removed settings too) stays.
    function saveSettings(patch = {}) {
      const stored = storedSettings();
      for (const [name, value] of Object.entries(patch)) if (Object.hasOwn(SETTING_DEFAULTS, name)) stored[name] = settingValue(name, value);
      if (!gm) pageOnlySettings = stored; else gmSet(SETTINGS_GM_KEY, stored);
      return settings();
    }

    // Account-scoped session values (one tab's working state).
    const sessionValue = {
      get: (name, fallback, account) => parse(read(session, scoped(KEY[name], account)), fallback),
      set: (name, value, account) => write(session, scoped(KEY[name], account), JSON.stringify(value)),
      remove: (name, account) => remove(session, scoped(KEY[name], account)),
    };
    // Page values, scoped to the account when KEYS says so, JSON or plain string as 3.x stored them.
    const localKey = (name, account) => KEY_SCOPE[name] === 'account' ? scoped(KEY[name], account) : KEY[name];
    const localValue = {
      get: (name, fallback, account) => { const raw = read(local, localKey(name, account)); return raw == null ? fallback : RAW_KEYS.has(name) ? raw : parse(raw, fallback); },
      set: (name, value, account) => write(local, localKey(name, account), RAW_KEYS.has(name) ? String(value) : JSON.stringify(value)),
    };

    // Priorities: one key per game (-1, 1; 0 is no key) plus the ranked order (normalized names).
    const priorityPrefix = account => scoped(KEY.priority, account) + ':';
    function priority(game, account) {
      const raw = read(local, priorityPrefix(account) + encodeURIComponent(normalizeGameName(game)));
      if (raw == null) return { value: 0, explicit: false };
      const value = Number(raw);
      return { value: [-1, 0, 1].includes(value) ? value : 0, explicit: true };
    }
    function setPriority(game, value, account) {
      if (![-1, 0, 1].includes(value) || !normalizeGameName(game)) return false;
      const key = priorityPrefix(account) + encodeURIComponent(normalizeGameName(game));
      if (value === 0) { remove(local, key); return true; }
      return write(local, key, String(value));
    }
    function priorities(account) {
      const prefix = priorityPrefix(account);
      return Object.fromEntries(keysWith(local, prefix).map(key => [decodeURIComponent(key.slice(prefix.length)), Number(read(local, key)) || 0]));
    }
    const cleanOrder = list => [...new Set((Array.isArray(list) ? list : []).map(normalizeGameName).filter(Boolean))].slice(0, 250);
    const priorityOrder = account => cleanOrder(parse(read(local, scoped(KEY.priorityOrder, account)), []));
    function setPriorityOrder(list, account) {
      const clean = cleanOrder(list);
      write(local, scoped(KEY.priorityOrder, account), JSON.stringify(clean));
      return clean;
    }

    // Ignored games: { updatedAt, games: { normalized: { game, expiresAt, ignoredAt } } }. Expired entries are
    // left out when read and dropped on the next write, as in 3.x.
    function ignoredGames(account, at = now()) {
      const saved = parse(read(local, scoped(KEY.ignoredGames, account)), {});
      const games = saved?.games && typeof saved.games === 'object' ? saved.games : {};
      const kept = {};
      for (const [storedKey, record] of Object.entries(games)) {
        const game = cleanText(record?.game || storedKey);
        const key = normalizeGameName(game || storedKey);
        const expiresAt = Number(record?.expiresAt || 0);
        if (!key || !Number.isFinite(expiresAt) || expiresAt <= at) continue;
        kept[key] = { game: game || storedKey, expiresAt, ignoredAt: Number(record?.ignoredAt || saved?.updatedAt || at) };
      }
      return { updatedAt: Number(saved?.updatedAt || 0), games: kept };
    }
    function setIgnoredGame(game, expiresAt, ignored, account, at = now()) {
      const label = cleanText(game), key = normalizeGameName(label);
      if (!key) return false;
      const current = ignoredGames(account, at);
      if (!ignored) {
        if (!current.games[key]) return false;
        delete current.games[key];
      } else {
        const endMs = Number(expiresAt || 0);
        if (!Number.isFinite(endMs) || endMs <= at) return false;
        const prior = current.games[key];
        current.games[key] = { game: label, expiresAt: Math.max(endMs, Number(prior?.expiresAt || 0)), ignoredAt: Number(prior?.ignoredAt || at) };
      }
      return write(local, scoped(KEY.ignoredGames, account), JSON.stringify({ updatedAt: at, games: current.games }));
    }
    const isIgnored = (game, account, at = now()) => Number(ignoredGames(account, at).games[normalizeGameName(game)]?.expiresAt || 0) > at;

    // Claim history: one key per record. DropperActiveViewing.createClaims owns the record rules; this is its storage.
    const claimPrefix = account => scoped(KEY.claimHistory, account) + ':record:';
    function claimRecords(account) {
      const prefix = claimPrefix(account);
      return keysWith(local, prefix)
        .map(key => ({ key, record: parse(read(local, key), null) }))
        .filter(item => item.record)
        .sort((a, b) => Number(b.record.updatedAt || 0) - Number(a.record.updatedAt || 0));
    }
    const putClaimRecord = (id, record, account) => write(local, claimPrefix(account) + encodeURIComponent(id), JSON.stringify(record));
    const removeClaimRecord = (id, account) => remove(local, claimPrefix(account) + encodeURIComponent(id));
    function claimStorage(account = login()) {
      return {
        read: () => claimRecords(account).slice(0, CLAIM_HISTORY_LIMIT).map(item => item.record),
        put: record => {
          if (!writable) return;
          local.setItem(claimPrefix(account) + encodeURIComponent(record.key), JSON.stringify(record));
          for (const stale of claimRecords(account).slice(CLAIM_HISTORY_LIMIT)) remove(local, stale.key);
        },
      };
    }

    // Campaign memory is valid only under the 3.2.6 reset marker; without it there is no memory yet.
    function campaignMemory(account) {
      const marker = parse(read(local, scoped(KEY.campaignMemoryReset, account)), {});
      if (cleanText(marker?.version) !== CAMPAIGN_MEMORY_RESET_VERSION) return { updatedAt: 0, campaigns: {} };
      const saved = parse(read(local, scoped(KEY.campaignMemory, account)), {});
      return saved && typeof saved === 'object' && saved.campaigns && typeof saved.campaigns === 'object'
        ? saved : { updatedAt: 0, campaigns: {} };
    }
    function setCampaignMemory(memory, account) {
      const marker = parse(read(local, scoped(KEY.campaignMemoryReset, account)), {});
      if (cleanText(marker?.version) !== CAMPAIGN_MEMORY_RESET_VERSION) {
        write(local, scoped(KEY.campaignMemoryReset, account), JSON.stringify({ version: CAMPAIGN_MEMORY_RESET_VERSION, at: now() }));
      }
      return write(local, scoped(KEY.campaignMemory, account), JSON.stringify(memory));
    }

    return Object.freeze({
      login, scoped, settings, saveSettings, session: sessionValue, local: localValue,
      priority, setPriority, priorities, priorityOrder, setPriorityOrder,
      ignoredGames, setIgnoredGame, isIgnored, claimRecords, putClaimRecord, removeClaimRecord, claimStorage, campaignMemory, setCampaignMemory,
      gm: Object.freeze({ get: gmGet, set: gmSet }),
      // A reset stops all writes until the page reloads.
      suspend: () => { writable = false; },
      resume: () => { writable = true; },
    });
  }

  // Which KEYS entry a stored key belongs to (null when none does).
  function storageKeyEntry(area, storageKey) {
    const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = { global: key => `^${key}$`, account: key => `^${key}:account:[^:]+$`, records: key => `^${key}:account:[^:]+:.+$`, prefix: key => `^${key}:.+$` };
    return KEYS.find(entry => entry.area === area && new RegExp(patterns[entry.scope](escape(entry.key))).test(storageKey)) || null;
  }

  // Twitch requests. The only module that talks to Twitch's servers. One request path: GM transport first (it is
  // not bound by the page's CORS rules), the page's own fetch as fallback; the second client ID after auth,
  // integrity or network failures; a circuit breaker after repeated failures.
  const GQL_URL = 'https://gql.twitch.tv/gql';
  const INTEGRITY_URL = 'https://gql.twitch.tv/integrity';
  const CLIENT_IDS = Object.freeze(['kimne78kx3ncx6brgo4mv6wki5h1ko', 'kd1unb4b3q4t58fwlpcbzcbnm76a8fp']);
  const GQL_HASH_PATTERN = /^[a-f0-9]{64}$/;
  const GQL_OPS = Object.freeze({
    inventory: { name: 'Inventory', hash: '3ab317a5753b25125f47d4ce962ebe928ff4e85047b77508340c94ebc20b6230', variables: { fetchRewardCampaigns: true } },
    viewerDropsDashboard: { name: 'ViewerDropsDashboard', hash: '69750554e0a81492f2d343558f84bdf3e324767650a2dbb6e79a3c629b4548cf', variables: { fetchRewardCampaigns: true } },
    currentDrop: { name: 'DropCurrentSessionContext', hash: '4d06b702d25d652afb9ef835d2a550031f1cf762b193523a92166f40ea3d142b', variables: {} },
    streamInfo: { name: 'VideoPlayerStreamInfoOverlayChannel', hash: '198492e0857f6aedead9665c81c5a06d67b25b58034649687124083ff288597d', variables: { channel: '' } },
    availableDrops: { name: 'ChannelDropsCampaigns', hash: 'bc073ff0bb13797898f83e93dc8009838545dec95ff7fe92243c8fa3a740f7e7', variables: { channelID: '' } },
    claimDrop: { name: 'DropsPage_ClaimDropRewards', hash: '3b8a08f5a35dc95d7de229dea731a106a9aa9fa2e84c8f693fd159943f273e4f', variables: { input: { dropInstanceID: '' } } },
    dropCampaignDetails: { name: 'DropCampaignDetails', hash: '1f4903ecfff5d0ba12820e28288d3c524606b28916084214a8c0bb9a2043727a', variables: { channelLogin: '', dropID: '' } },
  });
  const READ_ONLY_OPS = new Set(['inventory', 'viewerDropsDashboard', 'streamInfo', 'currentDrop', 'availableDrops', 'dropCampaignDetails']);
  const NETWORK = Object.freeze({ windowMs: 60 * 60 * 1000, softBudget: 180, failureThreshold: 3, errorCooldownMs: 5 * 60 * 1000, rateCooldownMs: 15 * 60 * 1000, authCooldownMs: 10 * 60 * 1000 });
  const INTEGRITY_MARGIN_MS = 60 * 1000;

  const valueType = value => value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  // Bounded GraphQL field names (never values) to describe a changed response in diagnostics.
  const fieldNames = value => value && typeof value === 'object' && !Array.isArray(value)
    ? Object.keys(value).filter(key => /^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(key)).slice(0, 12) : [];

  function inventoryResponseState(row) {
    const data = row?.data, user = data?.currentUser, inventory = user?.inventory, campaigns = inventory?.dropCampaignsInProgress;
    const errors = Array.isArray(row?.errors) ? row.errors : [];
    const types = { data: valueType(data), currentUser: valueType(user), inventory: valueType(inventory), campaigns: valueType(campaigns), errorCount: errors.length };
    const validRows = Array.isArray(campaigns) && campaigns.every(campaign => campaign && typeof campaign === 'object' && !Array.isArray(campaign));
    const valid = validRows && !errors.length;
    const status = valid ? (campaigns.length ? 'ok' : 'empty')
      : errors.length ? (validRows ? 'partial-response' : 'error')
        : data === null || user === null || inventory === null || campaigns === null ? 'unavailable' : 'shape-changed';
    return { valid, status, campaigns: valid ? campaigns : null,
      shape: { ...types, dataFields: fieldNames(data), userFields: fieldNames(user), inventoryFields: fieldNames(inventory) },
      detail: Object.entries(types).map(([key, value]) => `${key}=${value}`).join(';') };
  }

  function sessionResponseState(row) {
    const data = row?.data, user = data?.currentUser;
    const errors = Array.isArray(row?.errors) ? row.errors : [];
    const hasSession = Boolean(user && (Object.hasOwn(user, 'dropCurrentSession') || Object.hasOwn(user, 'dropCurrentSessionContext')));
    const session = user && Object.hasOwn(user, 'dropCurrentSession') ? user.dropCurrentSession : user?.dropCurrentSessionContext;
    const node = session?.currentSession ?? session?.drop ?? session;
    const drop = node?.drop ?? node?.currentDrop ?? node;
    const nodeObject = Boolean(node && typeof node === 'object' && !Array.isArray(node));
    const recognized = Boolean(nodeObject && (drop?.id || drop?.name || node.dropID || session?.dropID));
    const fields = ['dropID', 'currentMinutesWatched', 'requiredMinutesWatched', 'channel', 'game'];
    const expectedFields = Boolean(nodeObject && fields.some(key => Object.hasOwn(node, key)));
    const inactive = nodeObject && !recognized && node.dropID === '' && node.channel === null && node.game === null &&
      node.currentMinutesWatched === 0 && node.requiredMinutesWatched === 0;
    let status = data == null || user == null ? 'unavailable'
      : !hasSession ? 'shape-changed'
        : session === null || (session && Object.hasOwn(session, 'currentSession') && session.currentSession === null) ? 'absent'
          : inactive ? 'inactive' : recognized ? 'ok' : expectedFields ? 'unidentified' : 'shape-changed';
    if (errors.length) status = recognized ? 'partial-response' : 'error';
    return { valid: ['ok', 'absent', 'inactive', 'unidentified'].includes(status), status,
      shape: { data: valueType(data), currentUser: valueType(user), session: valueType(session), node: valueType(node), errorCount: errors.length,
        dataFields: fieldNames(data), userFields: fieldNames(user), sessionFields: fieldNames(session), nodeFields: fieldNames(node) } };
  }

  // A rejected shape alone does not prove a Twitch schema change; missing data is not an empty inventory.
  const GQL_EXPECTED_SHAPES = Object.freeze({
    Inventory: data => inventoryResponseState({ data }).valid,
    ViewerDropsDashboard: data => Array.isArray(data?.currentUser?.dropCampaigns) || data?.currentUser === null,
    DropCampaignDetails: data => {
      const campaign = data?.user?.dropCampaign || data?.dropCampaign;
      return Boolean(campaign?.id && campaign.allow && typeof campaign.allow.isEnabled === 'boolean' && Array.isArray(campaign.timeBasedDrops || campaign.drops));
    },
    ChannelDropsCampaigns: data => Array.isArray(data?.channelDropCampaigns),
    DropCurrentSessionContext: data => sessionResponseState({ data }).valid,
  });

  // An operation Twitch no longer knows, as opposed to an auth failure or a changed response.
  function gqlOperationFailureKind(row) {
    if (row?.data != null || !Array.isArray(row?.errors) || !row.errors.length) return '';
    const errors = row.errors.map(item => ({ message: cleanText(item?.message), code: cleanText(item?.extensions?.code) }));
    if (errors.some(item => /auth|forbidden|integrity|rate.?limit|too.?many|429|401|403/i.test(item.code))) return '';
    const notFound = /^(PersistedQueryNotFound|PERSISTED_QUERY_NOT_FOUND)$/i;
    if (errors.every(item => notFound.test(item.message) || notFound.test(item.code))) return 'hash-not-found';
    if (errors.every(item => /^(?:operation with name ['"][A-Za-z_][A-Za-z0-9_]*['"] not found|unknown operation named ['"][A-Za-z_][A-Za-z0-9_]*['"])[.!]?$/i.test(item.message))) return 'operation-not-found';
    return '';
  }

  const isSoftGqlError = item => /failed integrity check|integritycheckfailed|service error/i.test(cleanText(item?.message)) || /integritycheckfailed/i.test(cleanText(item?.extensions?.code));

  // Rows must match the batch. Soft integrity/service errors pass only with data; an unselectable Inventory passes
  // only in read-only batches that asked for that. Everything else, and any error in a mutation batch, throws.
  function parseGqlRows(json, status = 200, { requests = null, allowInventoryFailure = false } = {}) {
    if (status < 200 || status >= 300) throw new Error(`GQL HTTP ${status}`);
    const rows = Array.isArray(json) ? json : [json];
    if (!rows.length || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row) || (!Object.hasOwn(row, 'data') && !Array.isArray(row.errors)))) {
      throw new Error('Malformed Twitch GQL response');
    }
    if (requests && rows.length !== requests.length) throw new Error('Twitch GQL response count does not match the request batch');
    const readOnly = Array.isArray(requests) && requests.length > 0 && requests.every(request => READ_ONLY_OPS.has(request?.op));
    const hard = [];
    rows.forEach((row, index) => {
      const errors = Array.isArray(row.errors) ? row.errors : [];
      if (!errors.length) return;
      if (row.data != null && typeof row.data === 'object' && errors.every(isSoftGqlError)) return;
      if (allowInventoryFailure === true && readOnly && requests[index]?.op === 'inventory' && gqlOperationFailureKind(row)) return;
      hard.push(...errors);
    });
    if (hard.length) {
      const error = new Error(hard.map(item => cleanText(item?.message)).filter(Boolean).join(' · ') || 'Twitch GQL error');
      error.gqlDefinitionFailure = hard.every(item => gqlOperationFailureKind({ errors: [item] }));
      const inventoryIndex = requests?.findIndex(request => request?.op === 'inventory') ?? -1;
      if (inventoryIndex >= 0 && Array.isArray(rows[inventoryIndex]?.errors) && rows[inventoryIndex].errors.length) error.inventoryRow = rows[inventoryIndex];
      throw error;
    }
    return rows;
  }

  function integrityExpiresAt(expiration, at) {
    const value = Number(expiration || 0);
    if (value > 1e12) return value;
    if (value > 1e9) return value * 1000;
    return at + 10 * 60 * 1000;
  }

  function createTwitch({ store, cookie = () => '', pageFetch = null, gmRequest = null, now = Date.now, log = () => {}, setTimer = setTimeout, clearTimer = clearTimeout, timeoutMs = 15000 } = {}) {
    // Headers Twitch's own page sends, seen by the page network hook.
    let capture = { integrity: '', integrityExpiresAt: 0, clientId: '', deviceId: '', sessionId: '', clientVersion: '' };
    let integrity = { token: '', clientId: '', expiresAt: 0, transport: '', deviceId: '' };
    let integrityRequest = null, lastTransport = '';
    const health = {};
    let learned = (() => { const saved = store.local.get('gqlOperations', {}); return saved && typeof saved === 'object' ? saved : {}; })();

    const authToken = () => cookie('auth-token');
    const deviceId = () => cleanText(capture.deviceId) || cookie('unique_id') || cookie('unique_id_durable') || 'tdh-device';

    function captureHeaders(headers) {
      const map = {};
      if (headers && typeof headers.forEach === 'function' && !Array.isArray(headers)) headers.forEach((value, key) => { map[String(key).toLowerCase()] = String(value); });
      else if (Array.isArray(headers)) for (const [key, value] of headers) map[String(key).toLowerCase()] = String(value);
      else if (headers && typeof headers === 'object') for (const [key, value] of Object.entries(headers)) map[key.toLowerCase()] = String(value);
      if (map['client-integrity']) {
        capture.integrity = map['client-integrity'];
        capture.integrityExpiresAt = Math.max(Number(capture.integrityExpiresAt || 0), now() + 10 * 60 * 1000);
      }
      if (map['client-id']) capture.clientId = map['client-id'];
      if (map['x-device-id'] || map['device-id']) capture.deviceId = map['x-device-id'] || map['device-id'];
      if (map['client-session-id']) capture.sessionId = map['client-session-id'];
      if (map['client-version']) capture.clientVersion = map['client-version'];
    }
    function capturedIntegrity(clientId = '') {
      const token = cleanText(capture.integrity);
      if (!token) return '';
      if (Number(capture.integrityExpiresAt || 0) && Number(capture.integrityExpiresAt) <= now()) return '';
      if (clientId && capture.clientId && capture.clientId !== clientId) return '';
      return token;
    }

    // Learned operations: Twitch replaces persisted-query hashes every few weeks and an old hash can keep answering
    // with an outdated shape. The page always sends current ones; Dropper keeps each hash and its variable names.
    const learnedOperation = name => GQL_HASH_PATTERN.test(learned[name]?.hash || '') ? learned[name] : null;
    const builtIn = name => Object.values(GQL_OPS).find(op => op.name === name) || null;
    const saveLearned = () => store.local.set('gqlOperations', learned);
    function learnFromPage(operations, rows) {
      if (!Array.isArray(operations) || !Array.isArray(rows)) return;
      let changed = false;
      operations.forEach((operation, index) => {
        const name = cleanText(operation?.name), hash = cleanText(operation?.hash).toLowerCase(), known = builtIn(name), row = rows[index];
        if (!known || !GQL_HASH_PATTERN.test(hash) || hash === known.hash) return;
        if (!row?.data || (Array.isArray(row.errors) && row.errors.length)) return;
        if (GQL_EXPECTED_SHAPES[name] && !GQL_EXPECTED_SHAPES[name](row.data)) return;
        if (learnedOperation(name)?.hash === hash) return;
        learned[name] = { hash, variableKeys: (operation.variableKeys || []).map(cleanText).filter(Boolean).slice(0, 20), learnedAt: now() };
        changed = true;
        log('gql-operation', `Learned Twitch's current ${name} request`, { operation: name, hash: hash.slice(0, 12) });
      });
      if (changed) saveLearned();
    }
    function forgetLearned(name, reason, expectedHash = '') {
      const current = learnedOperation(name);
      if (!current || (expectedHash && current.hash !== expectedHash)) return;
      delete learned[name];
      saveLearned();
      log('gql-operation', `Dropped the learned ${name} request`, { operation: name, reason });
    }
    function payload(op, variables) {
      const known = learnedOperation(op.name);
      const defaults = known ? Object.fromEntries(Object.entries(op.variables || {}).filter(([key]) => known.variableKeys.includes(key))) : op.variables;
      return { operationName: op.name, variables: { ...defaults, ...(variables || {}) }, extensions: { persistedQuery: { version: 1, sha256Hash: known?.hash || op.hash } } };
    }
    const note = (name, result, detail = '') => { health[name] = { result, detail: cleanText(detail).slice(0, 160), at: now() }; };
    function checkResults(requests, json, status, payloads) {
      if (status < 200 || status >= 300) return;
      const rows = Array.isArray(json) ? json : [json];
      (requests || []).forEach((request, index) => {
        const name = GQL_OPS[request?.op]?.name, row = rows[index];
        if (!name || !row) return;
        const errors = (Array.isArray(row.errors) ? row.errors : []).map(item => cleanText(item?.message));
        const failure = gqlOperationFailureKind(row);
        if (failure) {
          note(name, failure, errors.join(' · ') || failure);
          // A reply to an older payload must not discard a newer hash learned meanwhile.
          forgetLearned(name, failure, payloads[index]?.extensions?.persistedQuery?.sha256Hash || '');
          return;
        }
        if (name === 'Inventory') { const state = inventoryResponseState(row); note(name, state.valid ? 'ok' : state.status, state.detail); return; }
        if (name === 'DropCurrentSessionContext') { const state = sessionResponseState(row); note(name, state.status, JSON.stringify(state.shape)); return; }
        if (row.data && GQL_EXPECTED_SHAPES[name] && !GQL_EXPECTED_SHAPES[name](row.data)) { note(name, 'shape-changed', 'expected fields missing'); return; }
        note(name, errors.length ? 'error' : 'ok', errors.join(' · '));
      });
    }

    // Circuit breaker, kept per tab in session storage as in 3.x.
    const freshNetwork = () => ({ requestTimes: [], consecutiveFailures: 0, openUntil: 0, reason: '', lastOpenedAt: 0, softBudgetWarnedAt: 0 });
    let network = { ...freshNetwork(), ...(store.session.get('networkState', null) || {}) };
    const saveNetwork = () => store.session.set('networkState', network);
    function circuit() {
      const at = now();
      network.requestTimes = (network.requestTimes || []).filter(time => at - time < NETWORK.windowMs);
      if (Number(network.openUntil || 0) && at >= Number(network.openUntil)) {
        log('network', 'Circuit breaker closed', { previousReason: network.reason });
        Object.assign(network, { openUntil: 0, reason: '', consecutiveFailures: 0 });
        saveNetwork();
      }
      return { open: Number(network.openUntil || 0) > at, openUntil: Number(network.openUntil || 0), reason: network.reason || '',
        requestsLastHour: network.requestTimes.length, softBudget: NETWORK.softBudget, consecutiveFailures: Number(network.consecutiveFailures || 0) };
    }
    function beforeRequest() {
      const state = circuit();
      if (state.open) { const error = new Error(`Network protection active: ${state.reason || 'cooldown'}`); error.circuitOpen = true; throw error; }
      const at = now();
      network.requestTimes.push(at);
      if (network.requestTimes.length >= NETWORK.softBudget && at - Number(network.softBudgetWarnedAt || 0) >= NETWORK.windowMs) {
        network.softBudgetWarnedAt = at;
        log('network-budget', 'High Dropper GQL request volume', { requestsLastHour: network.requestTimes.length });
      }
      saveNetwork();
    }
    function succeeded() {
      if (network.consecutiveFailures) log('network', 'Twitch GQL recovered', { previousFailures: network.consecutiveFailures });
      network.consecutiveFailures = 0;
      saveNetwork();
    }
    function failed(error) {
      if (error?.circuitOpen) return;
      const message = cleanText(error?.message || String(error));
      network.consecutiveFailures = Number(network.consecutiveFailures || 0) + 1;
      const open = (reason, ms) => Object.assign(network, { openUntil: now() + ms, reason, lastOpenedAt: now() });
      if (/\b429\b|rate.?limit|too many requests/i.test(message)) open('Twitch rate limit response', NETWORK.rateCooldownMs);
      else if (!/integrity/i.test(message) && /\b401\b|\b403\b|unauthorized|forbidden/i.test(message)) open('authorization failures', NETWORK.authCooldownMs);
      else if (network.consecutiveFailures >= NETWORK.failureThreshold) open('repeated Twitch GQL failures', NETWORK.errorCooldownMs);
      saveNetwork();
      log('network-error', 'Twitch GQL request failed', { message, consecutiveFailures: network.consecutiveFailures });
    }

    async function post(url, { clientId, auth, token = '', body = null, transport }) {
      const device = deviceId();
      const headers = { 'Client-ID': clientId, Authorization: `OAuth ${auth}`, 'X-Device-Id': device, 'Device-ID': device, 'Content-Type': 'application/json' };
      if (token) headers['Client-Integrity'] = token;
      if (capture.sessionId) headers['Client-Session-Id'] = capture.sessionId;
      if (capture.clientVersion) headers['Client-Version'] = capture.clientVersion;
      const data = body == null ? '' : typeof body === 'string' ? body : JSON.stringify(body);
      if (transport === 'page') {
        if (typeof pageFetch !== 'function') throw new Error('Twitch page fetch unavailable');
        // OAuth goes in Authorization. With cookies, browsers reject Twitch's `Access-Control-Allow-Origin: *`.
        const controller = typeof AbortController === 'function' ? new AbortController() : null;
        let timer;
        const timeout = new Promise((_, reject) => { timer = setTimer(() => { reject(new Error('Twitch request timed out')); controller?.abort(); }, timeoutMs); });
        try {
          return await Promise.race([timeout, (async () => {
            const response = await pageFetch(url, { method: 'POST', credentials: 'omit', headers, body: data, signal: controller?.signal });
            let json = null;
            try { json = await response.json(); } catch (_) {}
            return { status: Number(response.status) || 0, json };
          })()]);
        } finally { clearTimer(timer); }
      }
      if (typeof gmRequest !== 'function') throw new Error('GM_xmlhttpRequest unavailable');
      headers.Origin = 'https://www.twitch.tv';
      headers.Referer = 'https://www.twitch.tv/';
      return new Promise((resolve, reject) => {
        gmRequest({
          method: 'POST', url, headers, data, timeout: timeoutMs,
          onload(response) {
            let json = response.response;
            try {
              if (typeof json === 'string') json = JSON.parse(json);
              if (!json && response.responseText) json = JSON.parse(response.responseText);
            } catch (_) { json = null; }
            resolve({ status: Number(response.status) || 0, json });
          },
          ontimeout() { reject(new Error('Twitch request timed out')); },
          onerror(response) { reject(new Error(`Twitch network error${response?.status ? ` (${response.status})` : ''}`)); },
        });
      });
    }

    // Integrity tokens: cached per client ID, transport and device. The page transport only ever uses the token
    // Twitch's page minted; Dropper mints its own only through GM.
    function storeIntegrity(clientId, token, expiresAt, transport) {
      integrity = { token, clientId, expiresAt, transport, deviceId: deviceId() };
      lastTransport = transport;
      store.session.set('clientIntegrity', integrity);
    }
    // The page's own integrity token (bridge.js), already checked: kept for the page transport, as 3.x did.
    function acceptPageIntegrity(token, expiresAt) {
      if (typeof token !== 'string' || !/^[\x21-\x7e]{1,8192}$/.test(token) || !(Number(expiresAt) > now())) return false;
      Object.assign(capture, { integrity: token, integrityExpiresAt: Number(expiresAt) });
      storeIntegrity(capture.clientId || CLIENT_IDS[0], token, Number(expiresAt), 'page');
      return true;
    }
    function clearIntegrity({ clearCapture = false } = {}) {
      integrity = { token: '', clientId: '', expiresAt: 0, transport: '', deviceId: '' };
      integrityRequest = null;
      store.session.remove('clientIntegrity');
      if (clearCapture) Object.assign(capture, { integrity: '', integrityExpiresAt: 0 });
    }
    function cachedIntegrity(clientId, transport) {
      const device = deviceId();
      const fits = saved => saved?.token && saved.clientId === clientId && saved.transport === transport && saved.deviceId === device && Number(saved.expiresAt || 0) - INTEGRITY_MARGIN_MS > now();
      if (fits(integrity)) return integrity.token;
      const saved = store.session.get('clientIntegrity', null);
      if (!fits(saved)) return '';
      integrity = { token: String(saved.token), clientId, expiresAt: Number(saved.expiresAt), transport, deviceId: device };
      return integrity.token;
    }
    function adoptCaptured(clientId) {
      const token = capturedIntegrity(clientId);
      if (!token) return '';
      storeIntegrity(clientId || capture.clientId || CLIENT_IDS[0], token, Number(capture.integrityExpiresAt || 0) || now() + 10 * 60 * 1000, 'page');
      return token;
    }
    async function ensureIntegrity(clientId, { force = false, transport }) {
      // A forced refresh mints a new GM token; it never drops the page's own token. A page token Twitch rejects is
      // cleared where the rejection is handled (request), so it is never adopted again.
      if (force && transport !== 'page') clearIntegrity();
      if (transport === 'page') {
        const adopted = adoptCaptured(clientId);
        if (adopted) return adopted;
        throw new Error('Twitch page integrity unavailable');
      }
      if (!force) {
        const cached = cachedIntegrity(clientId, transport);
        if (cached) return cached;
        if (integrityRequest?.clientId === clientId && integrityRequest.transport === transport) return integrityRequest.promise;
      }
      const promise = (async () => {
        const auth = authToken();
        if (!auth) throw new Error('Not logged in');
        const result = await post(INTEGRITY_URL, { clientId, auth, body: {}, transport });
        const token = result.status >= 200 && result.status < 300 ? cleanText(result.json?.token) : '';
        if (!token) throw new Error('Twitch integrity token missing');
        storeIntegrity(clientId, token, integrityExpiresAt(result.json?.expiration, now()), transport);
        return token;
      })().finally(() => { if (integrityRequest?.promise === promise) integrityRequest = null; });
      integrityRequest = { clientId, transport, promise };
      return promise;
    }

    function transports() {
      const list = [];
      if (typeof gmRequest === 'function') list.push('gm');
      if (typeof pageFetch === 'function') list.push('page');
      // The page goes first with its own token, unless it just failed (GM then leads until the page hands over a new token).
      const first = capturedIntegrity() && list.includes('page') && lastTransport !== 'gm' ? 'page' : list.includes(lastTransport) ? lastTransport : '';
      return first ? [first, ...list.filter(item => item !== first)] : list;
    }

    // requests: [{ op, variables }]. Resolves with one row per request.
    async function request(requests, { allowInventoryFailure = false } = {}) {
      const auth = authToken();
      if (!auth) throw new Error('Not logged in');
      const claimOnly = requests.length > 0 && requests.every(item => item?.op === 'claimDrop');
      const body = requests.map(item => payload(GQL_OPS[item.op], item.variables));
      const send = async (clientId, { refresh = false, transport }) => {
        let token = '';
        try { token = await ensureIntegrity(clientId, { force: refresh && transport !== 'page', transport }); } catch (error) {
          if (transport === 'page') token = adoptCaptured(clientId);
          if (!token) throw error;
        }
        beforeRequest();
        const result = await post(GQL_URL, { clientId, auth, token, body, transport });
        checkResults(requests, result.json, result.status, body);
        return parseGqlRows(result.json, result.status, { requests, allowInventoryFailure });
      };
      const pageDeadEnd = error => /page integrity unavailable/i.test(error?.message || '');
      const tryClient = async (clientId, { refresh = false } = {}) => {
        let lastError = null, skipPage = false;
        for (const transport of transports()) {
          if (transport === 'page' && skipPage) continue;
          try {
            const rows = await send(clientId, { refresh: refresh || Boolean(lastError && /failed to fetch|network error|timed out|page integrity unavailable/i.test(lastError.message || '')), transport });
            lastTransport = transport;
            return rows;
          } catch (error) {
            // The first actionable failure wins over the page dead end.
            if (!lastError || pageDeadEnd(lastError) || !pageDeadEnd(error)) lastError = error;
            if (/integrity/i.test(error?.message || '') && !pageDeadEnd(error)) { clearIntegrity({ clearCapture: true }); lastTransport = 'gm'; }
            if (error?.circuitOpen || error?.gqlDefinitionFailure) throw error;
            if (pageDeadEnd(error)) { skipPage = true; lastTransport = 'gm'; }
            else if (/failed to fetch|network error|timed out/i.test(error?.message || '') && transport === 'page') lastTransport = 'gm';
          }
        }
        throw lastError || new Error('Twitch GQL unavailable');
      };

      if (claimOnly) {
        try { const rows = await send(CLIENT_IDS[0], { transport: transports()[0] || 'page' }); succeeded(); return rows; } catch (error) { failed(error); throw error; }
      }
      try {
        const rows = await tryClient(CLIENT_IDS[0]);
        succeeded();
        return rows;
      } catch (error) {
        let failure = error;
        if (/integrity/i.test(failure?.message || '') && !pageDeadEnd(failure) && !failure?.circuitOpen) {
          try { const rows = await tryClient(CLIENT_IDS[0], { refresh: true }); succeeded(); return rows; } catch (retryError) { failure = retryError; }
        }
        if (/401|403|integrity|failed to fetch|network error|timed out|page integrity unavailable/i.test(failure?.message || '') && !failure?.circuitOpen) {
          try {
            lastTransport = 'gm';
            const rows = await tryClient(CLIENT_IDS[1], { refresh: true });
            succeeded();
            return rows;
          } catch (fallbackError) { failed(fallbackError); throw fallbackError; }
        }
        failed(failure);
        throw failure;
      }
    }

    function snapshot() {
      const saved = integrity.token ? integrity : store.session.get('clientIntegrity', null);
      return {
        integrity: { cached: Boolean(saved?.token) && Number(saved?.expiresAt || 0) - INTEGRITY_MARGIN_MS > now(), transport: saved?.transport || lastTransport || (capture.integrity ? 'page' : null) },
        network: circuit(),
        operations: Object.fromEntries(Object.values(GQL_OPS).map(op => [op.name, {
          source: learnedOperation(op.name) ? 'learned-from-twitch' : 'built-in',
          hash: (learnedOperation(op.name)?.hash || op.hash).slice(0, 12),
          lastResult: health[op.name]?.result || null,
        }])),
      };
    }

    return Object.freeze({ request, captureHeaders, learnFromPage, acceptPageIntegrity, clearIntegrity, snapshot, deviceId, isLoggedIn: () => Boolean(authToken()) });
  }

  // BEGIN DROPPER ACTIVE VIEWING
  // Original implementation of the approved Dropper feature specification.
  // No twitch-autoclaim or TwitchDropsMiner implementation is included here.
  const DropperActiveViewing = (() => {
    const text = value => String(value ?? '').trim();
    const number = value => value !== null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
    const terminal = new Set(['confirmed', 'already-claimed', 'blocked', 'unconfirmed', 'discarded']);
    const outcomes = new Set(['pending', 'retryable', ...terminal]);
    const evidenceKinds = new Set(['request', 'page-control', 'control-dismissed', 'claim-result', 'inventory', 'timeout', 'network', 'permission', 'integrity', 'unknown', 'context-change']);
    const claimKinds = new Set(['drop', 'bonus']);

    function createIntent({ now = Date.now, load = () => null, save = () => {} } = {}) {
      let state = null;
      let generation = 0;
      function persist() { try { save({ ...state }); } catch (_) {} }
      function context(account, channel, automaticArrival = false, arrivalSource = '') {
        account = text(account).toLowerCase(); channel = text(channel).toLowerCase();
        if (state && state.account === account && state.channel === channel) return false;
        const sameAccount = state?.account === account;
        const previous = sameAccount ? state : null;
        let restored = null;
        try { restored = load(account); } catch (_) {}
        const saved = restored?.account === account && restored.channel === channel ? restored : null;
        state = {
          account, channel, paused: Boolean(saved?.paused),
          pauseReason: saved?.paused ? (saved.pauseReason === 'viewer' ? 'viewer' : 'unknown') : '',
          manualStream: Boolean(channel && !automaticArrival && (arrivalSource === 'viewer-link' || saved?.manualStream !== false)),
          arrivalSource: text(arrivalSource) || (automaticArrival ? 'dropper-navigation' : saved?.arrivalSource || (saved ? 'restored-selection' : 'unclassified-arrival')),
          playback: 'unknown', changedAt: now(),
          generation: ++generation,
          recoveryAttempts: previous?.channel === channel ? previous.recoveryAttempts || 0 : 0,
          lastRecoveryAt: 0,
        };
        persist();
        return true;
      }
      function pause(knownViewer = false) {
        if (!state?.channel) return;
        state.paused = true;
        if (knownViewer || state.pauseReason !== 'viewer') state.pauseReason = knownViewer ? 'viewer' : 'unknown';
        state.playback = 'paused'; state.changedAt = now(); persist();
      }
      function resume({ explicit = false, remounted = false } = {}) {
        if (!state) return false;
        if (state.paused && (remounted || state.pauseReason === 'viewer') && !explicit) return false;
        state.paused = false; state.pauseReason = ''; state.playback = 'playing';
        state.recoveryAttempts = 0; state.lastRecoveryAt = 0; state.changedAt = now(); persist();
        return true;
      }
      function observe(playback) {
        if (!state) return;
        const next = ['playing', 'paused', 'buffering', 'ended', 'error', 'unknown'].includes(playback) ? playback : 'unknown';
        if (next !== state.playback) { state.playback = next; state.changedAt = now(); }
      }
      function allowSwitching() {
        if (!state) return;
        state.manualStream = false; state.arrivalSource = 'viewer-enabled-switching'; state.changedAt = now(); persist();
      }
      function navigationAllowed(explicit = false) {
        return Boolean(state && (explicit || (!state.paused && !state.manualStream)));
      }
      function takeRecovery(explicit = false) {
        if (!state?.channel) return false;
        if (!explicit && (state.paused || state.manualStream || state.playback === 'unknown')) return false;
        if (!explicit && (state.recoveryAttempts >= 3 || (state.lastRecoveryAt && now() - state.lastRecoveryAt < 30000))) return false;
        if (explicit) { state.paused = false; state.pauseReason = ''; }
        state.recoveryAttempts += 1; state.lastRecoveryAt = now(); persist();
        return true;
      }
      function snapshot() { return state ? { ...state } : { playback: 'unknown', paused: false, manualStream: false, generation }; }
      return Object.freeze({ context, pause, resume, observe, allowSwitching, navigationAllowed, takeRecovery, snapshot });
    }

    // A synchronous, per-record store is used under the caller's reward lock.
    // No asynchronous read/modify/write of a shared history array is performed.
    function createClaims({ now = Date.now, read = () => [], put = () => {}, id = () => Math.random().toString(36).slice(2), limit = 100, onStorageError = () => {} } = {}) {
      let records = new Map();
      let storageFailed = false;
      function refresh() {
        try {
          for (const raw of read() || []) {
            if (!raw || !outcomes.has(raw.outcome) || !claimKinds.has(raw.kind) || !text(raw.key)) continue;
            if (text(raw.key).length > 512 || text(raw.rewardId).length > 180 || text(raw.campaignId).length > 180 || text(raw.rewardName).length > 160 || text(raw.game).length > 120) continue;
            if (/https?:|[\r\n<>]/i.test(raw.key + (raw.rewardId || '') + (raw.campaignId || '') + (raw.rewardName || '') + (raw.game || ''))) continue;
            const record = {
              key: text(raw.key), kind: raw.kind, rewardId: text(raw.rewardId), campaignId: text(raw.campaignId),
              rewardName: text(raw.rewardName).slice(0, 160), game: text(raw.game).slice(0, 120),
              attemptId: text(raw.attemptId).slice(0, 100), at: Number(raw.at) || 0,
              updatedAt: Number(raw.updatedAt) || 0, attempts: Math.max(1, Math.min(3, Number(raw.attempts) || 1)),
              outcome: raw.outcome, evidence: evidenceKinds.has(raw.evidence) ? raw.evidence : 'unknown',
              nextAttemptAt: Math.max(0, Number(raw.nextAttemptAt) || 0),
            };
            const existing = records.get(record.key);
            if (!existing || Number(record.updatedAt || 0) >= Number(existing.updatedAt || 0)) records.set(record.key, record);
          }
        } catch (_) {}
        const sorted = [...records.values()].sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt));
        records = new Map(sorted.slice(0, limit).map(record => [record.key, record]));
      }
      function persist(record) {
        record.updatedAt = now();
        try { put({ ...record }); } catch (_) { storageFailed = true; onStorageError(); return null; }
        storageFailed = false; records.set(record.key, record);
        return { ...record };
      }
      function expire() {
        refresh();
        for (const record of records.values()) {
          if (record.outcome === 'pending' && now() - record.at >= 45000) {
            persist({ ...record, outcome: 'unconfirmed', evidence: 'timeout' });
          }
        }
      }
      function begin({ key, rewardId = '', campaignId = '', rewardName = '', game = '', kind = 'drop', evidence = 'request' }) {
        expire();
        if (!claimKinds.has(kind) || !text(key) || key.length > 512 || /https?:|[\r\n<>]/i.test(key + rewardId + campaignId + rewardName + game)) return null;
        const prior = records.get(key);
        if (prior && (prior.outcome !== 'retryable' || prior.attempts >= 3 || now() < prior.nextAttemptAt)) return null;
        return persist({
          key, rewardId: text(rewardId).slice(0, 180), campaignId: text(campaignId).slice(0, 180),
          rewardName: text(rewardName).slice(0, 160), game: text(game).slice(0, 120), kind,
          attemptId: text(id()), at: now(), updatedAt: now(),
          attempts: (prior?.attempts || 0) + 1, outcome: 'pending', evidence: evidenceKinds.has(evidence) ? evidence : 'request', nextAttemptAt: 0,
        });
      }
      function settle(key, attemptId, outcome, evidence = 'unknown') {
        refresh();
        const record = records.get(key);
        if (!record || record.attemptId !== attemptId || !outcomes.has(outcome) || outcome === 'pending') return null;
        if (record.outcome === 'confirmed' || record.outcome === 'already-claimed' || record.outcome === 'discarded') return null;
        // Authoritative inventory may resolve an earlier timeout. Other late
        // responses must not reopen blocked/unknown records or repeat a count.
        if (record.outcome !== 'pending' && !(outcome === 'confirmed' && evidence === 'inventory')) return null;
        return persist({ ...record, outcome,
          evidence: evidenceKinds.has(evidence) ? evidence : 'unknown',
          nextAttemptAt: outcome === 'retryable' && record.attempts < 3 ? now() + 30000 * record.attempts : 0,
        });
      }
      function snapshot() { expire(); return [...records.values()].sort((a, b) => b.updatedAt - a.updatedAt).map(record => ({ ...record })); }
      return Object.freeze({ begin, settle, snapshot, get storageFailed() { return storageFailed; } });
    }

    function claimResponse(row) {
      if (Array.isArray(row?.errors) && row.errors.length) return { outcome: 'unconfirmed', evidence: 'unknown' };
      const status = row?.data?.claimDropRewards?.status;
      if (status === 'ELIGIBLE_FOR_ALL') return { outcome: 'confirmed', evidence: 'claim-result' };
      if (status === 'DROP_INSTANCE_ALREADY_CLAIMED') return { outcome: 'already-claimed', evidence: 'claim-result' };
      return { outcome: 'unconfirmed', evidence: 'unknown' };
    }
    function claimFailure(error) {
      const message = text(error?.message || error);
      if (/integrity/i.test(message)) return { outcome: 'blocked', evidence: 'integrity' };
      if (/\b(?:401|403)\b|unauthorized|forbidden|permission/i.test(message)) return { outcome: 'blocked', evidence: 'permission' };
      if (/\b(?:429|500|502|503|504)\b|network error|failed to fetch|timed?\s*out/i.test(message)) return { outcome: 'retryable', evidence: 'network' };
      return { outcome: 'unconfirmed', evidence: 'unknown' };
    }

    function requirement(drop) {
      if (drop?.self?.isClaimed === true) return 0;
      const total = number(drop?.requiredMinutesWatched ?? drop?.requiredMinutes);
      const current = number(drop?.self?.currentMinutesWatched ?? drop?.currentMinutes);
      return total !== null && total > 0 && current !== null && current >= 0 ? Math.max(0, total - current) : null;
    }
    function planPrerequisites(drop, drops = [], timingModel = 'unknown') {
      const byId = new Map(drops.filter(item => item?.id).map(item => [String(item.id), item]));
      const visiting = new Set(); const visited = new Set(); const dependencies = [];
      let issue = ''; let blocked = false;
      function walk(node, depth) {
        const key = text(node?.id);
        if (depth > 64 || visiting.has(key)) { issue = 'cyclic-prerequisite'; return; }
        if (visited.has(key)) return;
        visiting.add(key);
        for (const dependency of node?.preconditionDrops || []) {
          const child = byId.get(text(dependency?.id));
          if (!child) { issue ||= 'missing-prerequisite'; blocked = true; continue; }
          walk(child, depth + 1);
          const claimed = child.self?.isClaimed === true;
          const remaining = requirement(child);
          const explicitCompleted = dependency?.requirement === 'completed' || dependency?.requiresClaim === false;
          const satisfied = claimed || (explicitCompleted && remaining === 0);
          if (!satisfied) blocked = true;
          if (!dependencies.some(item => item.id === text(child.id))) dependencies.push({
            id: text(child.id), remainingMinutes: remaining,
            claimed, satisfied,
            requirement: explicitCompleted ? 'completed' : dependency?.requirement === 'claimed' || dependency?.requiresClaim === true ? 'claimed' : 'not-verified',
          });
        }
        visiting.delete(key); visited.add(key);
      }
      walk(drop, 0);
      const ownRemaining = requirement(drop);
      const outstanding = dependencies.filter(item => !item.satisfied);
      const known = ownRemaining !== null && outstanding.every(item => item.remainingMinutes !== null);
      let totalRemaining = null;
      if (!outstanding.length && !issue) totalRemaining = ownRemaining;
      else if (known && !issue && timingModel === 'sequential') totalRemaining = ownRemaining + outstanding.reduce((sum, item) => sum + item.remainingMinutes, 0);
      else if (known && !issue && timingModel === 'parallel') totalRemaining = Math.max(ownRemaining, ...outstanding.map(item => item.remainingMinutes));
      return {
        ready: !issue && (!blocked || drop?.self?.hasPreconditionsMet === true),
        reason: issue || (blocked && drop?.self?.hasPreconditionsMet !== true ? 'prerequisite-required' : ''),
        ownRemainingMinutes: ownRemaining, totalRemainingMinutes: totalRemaining,
        timingModel: ['sequential', 'parallel'].includes(timingModel) ? timingModel : outstanding.length ? 'unknown' : 'single-reward',
        dependencies,
      };
    }

    function deadlineAssessment(campaign, drop, plan, now = Date.now(), bufferMinutes = 2) {
      const endMs = Date.parse(drop?.endAt || campaign?.endAt || '');
      const deadlineMs = Number.isFinite(endMs) ? endMs : null;
      const minutesUntilDeadline = deadlineMs === null ? null : Math.max(0, Math.floor((deadlineMs - now) / 60000));
      const rawRemaining = plan?.totalRemainingMinutes;
      const remaining = typeof rawRemaining === 'number' || (typeof rawRemaining === 'string' && rawRemaining.trim() !== '')
        ? number(rawRemaining) : null;
      const requiredMinutes = remaining !== null && remaining >= 0 ? remaining : null;
      const safeBufferMinutes = Math.max(0, Number(bufferMinutes) || 0);
      const finishable = minutesUntilDeadline === null || requiredMinutes === null ? null : requiredMinutes + safeBufferMinutes <= minutesUntilDeadline;
      const marginMinutes = minutesUntilDeadline === null || requiredMinutes === null ? null : minutesUntilDeadline - requiredMinutes - safeBufferMinutes;
      const urgency = finishable === false ? 'unfinishable' : marginMinutes === null ? 'unknown' : marginMinutes <= 15 ? 'tight' : marginMinutes <= 60 ? 'soon' : 'comfortable';
      return { deadlineMs, minutesUntilDeadline, requiredMinutes, bufferMinutes: safeBufferMinutes, finishable, marginMinutes, urgency };
    }

    function campaignSequence(campaign, now = Date.now(), bufferMinutes = 2) {
      const drops = campaign?.timeBasedDrops || campaign?.drops || [];
      let known = true, inProgress = false, pendingClaims = 0, watchRewards = 0;
      let estimateReason = '', outstanding = [];
      const fail = reason => { known = false; estimateReason ||= reason; };
      const declaredModel = text(campaign?.timingModel).toLowerCase();
      for (const drop of drops) {
        if (drop?.self?.isClaimed === true) continue;
        const paid = Number(drop?.requiredSubs ?? drop?.requiredSubscriptions ?? drop?.requiredSubscriptionCount ?? drop?.subscriptionRequirement?.requiredSubs ?? 0) > 0;
        if (paid) continue;
        watchRewards += 1;
        const total = number(drop?.requiredMinutesWatched ?? drop?.requiredMinutes);
        if (total === null || total <= 0) { fail('unknown-reward-duration'); continue; }
        const current = number(drop?.self?.currentMinutesWatched ?? drop?.currentMinutes);
        if (current === null || current < 0) { fail('unknown-reward-progress'); continue; }
        if (current >= total) { pendingClaims += 1; continue; }
        if (current > 0) inProgress = true;
        const plan = planPrerequisites(drop, drops, declaredModel);
        if (plan.totalRemainingMinutes === null) fail(plan.reason || 'prerequisite-timing-unverified');
        const start = Date.parse(drop.startAt || campaign?.startAt || '');
        const end = Date.parse(drop.endAt || campaign?.endAt || '');
        if (Number.isFinite(start) && start > now) fail('reward-window-not-open');
        outstanding.push({ remaining: Math.max(0, total - current), start, end });
      }
      // Twitch campaign watch-time milestones accrue simultaneously. Never add
      // their overlapping bars, or transfer one reward's credit to another ID.
      // https://dev.twitch.tv/docs/drops/campaign-guide/#time-based-drops
      const windowKey = item => `${Number.isFinite(item.start) ? item.start : ''}:${Number.isFinite(item.end) ? item.end : ''}`;
      if (new Set(outstanding.map(windowKey)).size > 1) fail('different-reward-windows');
      const timingModel = !known ? 'unknown' : outstanding.length <= 1 ? 'single-reward' : declaredModel === 'sequential' ? 'sequential' : 'parallel';
      const remainingMinutes = !watchRewards || !known ? null : timingModel === 'sequential'
        ? outstanding.reduce((sum, item) => sum + item.remaining, 0)
        : Math.max(0, ...outstanding.map(item => item.remaining));
      const rewardEnd = outstanding.find(item => Number.isFinite(item.end))?.end;
      const endAt = Number.isFinite(rewardEnd) ? new Date(rewardEnd).toISOString() : campaign?.endAt;
      const deadline = deadlineAssessment({ ...campaign, endAt }, null, { totalRemainingMinutes: remainingMinutes }, now, bufferMinutes);
      return { watchRewards, remainingMinutes, pendingClaims, inProgress, timingModel, estimateReason, ...deadline };
    }

    function rankCampaignCandidates(candidates, { priorityOf = () => 0, now = Date.now(), activeGame = '', bufferMinutes = 2 } = {}) {
      const active = text(activeGame).toLowerCase();
      return [...(candidates || [])].map(item => {
        const rawDeadline = number(item?.endMs);
        const parsedDeadline = Date.parse(item?.campaignEndAt || item?.dropEndAt || item?.endAt || '');
        const deadlineMs = rawDeadline !== null ? rawDeadline : (Number.isFinite(parsedDeadline) ? parsedDeadline : null);
        const remaining = number(item?.sequenceRemainingMinutes ?? item?.remainingMinutes);
        const minutesUntilDeadline = deadlineMs === null ? null : Math.max(0, Math.floor((deadlineMs - now) / 60000));
        const safeBuffer = Math.max(0, Number(bufferMinutes) || 0);
        const finishable = minutesUntilDeadline === null || remaining === null ? null : remaining + safeBuffer <= minutesUntilDeadline;
        const marginMinutes = minutesUntilDeadline === null || remaining === null ? null : minutesUntilDeadline - remaining - safeBuffer;
        return {
          ...item,
          sequencePriority: Number(priorityOf(item?.game)) || 0,
          sequenceFinishable: finishable,
          sequenceMarginMinutes: marginMinutes,
          sequenceMinutesUntilDeadline: minutesUntilDeadline,
          sequenceInProgress: Boolean(Number(item?.currentMinutes) > 0 || item?.sequenceInProgress),
          sequenceActiveGame: Boolean(active && text(item?.game).toLowerCase() === active),
        };
      }).sort((a, b) => {
        const feasibility = value => value === false ? 1 : 0;
        const feasibleDelta = feasibility(a.sequenceFinishable) - feasibility(b.sequenceFinishable);
        if (feasibleDelta) return feasibleDelta;
        if (b.sequencePriority !== a.sequencePriority) return b.sequencePriority - a.sequencePriority;
        if (a.sequenceActiveGame !== b.sequenceActiveGame) return a.sequenceActiveGame ? -1 : 1;
        const endA = Number.isFinite(Number(a.endMs)) ? Number(a.endMs) : Number.MAX_SAFE_INTEGER;
        const endB = Number.isFinite(Number(b.endMs)) ? Number(b.endMs) : Number.MAX_SAFE_INTEGER;
        if (endA !== endB) return endA - endB;
        const marginA = Number.isFinite(a.sequenceMarginMinutes) ? a.sequenceMarginMinutes : Number.MAX_SAFE_INTEGER;
        const marginB = Number.isFinite(b.sequenceMarginMinutes) ? b.sequenceMarginMinutes : Number.MAX_SAFE_INTEGER;
        if (marginA !== marginB) return marginA - marginB;
        if (a.sequenceInProgress !== b.sequenceInProgress) return a.sequenceInProgress ? -1 : 1;
        const remA = number(a.sequenceRemainingMinutes ?? a.remainingMinutes);
        const remB = number(b.sequenceRemainingMinutes ?? b.remainingMinutes);
        if (remA !== null && remB !== null && remA !== remB) return remA - remB;
        return text(a.game).localeCompare(text(b.game));
      });
    }
    function eligibility(campaign, drop, context = {}) {
      const now = context.now ?? Date.now();
      let accountLink = false;
      const result = (code, label, detail, extra = {}) => ({ code, label, detail, ...extra, ...(accountLink ? { accountLink: true } : {}) });
      if (!campaign || !drop) return result('unknown', 'Eligibility not verified', 'Campaign or reward details are unavailable.');
      const timestamps = [campaign.startAt, campaign.endAt, drop.startAt || campaign.startAt, drop.endAt || campaign.endAt].map(value => Date.parse(value));
      if (timestamps.some(value => !Number.isFinite(value))) return result('unknown-window', 'Eligibility not verified', 'The campaign or reward time window is not verified.');
      const start = Math.max(timestamps[0], timestamps[2]); const end = Math.min(timestamps[1], timestamps[3]);
      if (end <= start) return result('unknown-window', 'Eligibility not verified', 'The campaign and reward time windows do not overlap.');
      if (now < start) return result('not-started', 'Campaign not started', 'This reward is not available to earn yet.');
      if (now >= end) return result('expired', 'Campaign ended', 'This reward is no longer available to earn.');
      if (campaign.self?.isAccountConnected === false || campaign.isAccountConnected === false) {
        // An unlinked account still earns watch time. It only blocks once every
        // eligible reward is earned, because then nothing here can be claimed.
        accountLink = true;
        const paid = item => Number(item?.requiredSubs ?? item?.requiredSubscriptions ?? item?.requiredSubscriptionCount ?? item?.subscriptionRequirement?.requiredSubs ?? 0) > 0;
        const watch = (campaign.timeBasedDrops || campaign.drops || [drop]).filter(item => Number(item?.requiredMinutesWatched || 0) > 0 && !paid(item));
        if (watch.length && watch.every(item => item?.self?.isClaimed || Number(item?.self?.currentMinutesWatched || 0) >= Number(item.requiredMinutesWatched))) {
          return result('account-link', 'Account link required', 'Every eligible reward is earned. Link the game account to claim them.');
        }
      }
      if (campaign.self?.isEligible === false || drop.self?.isEligible === false) return result('participation', 'Campaign not eligible', 'Twitch reports that this account is not eligible.');
      if (Number(drop.requiredSubs ?? drop.requiredSubscriptions ?? drop.requiredSubscriptionCount ?? drop.subscriptionRequirement?.requiredSubs ?? 0) > 0) return result('paid-requirement', 'Paid reward excluded', 'Dropper only assists with free watch rewards.');
      const plan = planPrerequisites(drop, campaign.timeBasedDrops || campaign.drops || []);
      const deadline = deadlineAssessment(campaign, drop, plan, now);
      const campaignPlan = campaignSequence(campaign, now);
      if (!plan.ready) return result(plan.reason, 'Previous reward required', plan.reason === 'prerequisite-required' ? 'Complete or claim the prerequisite shown for this reward.' : 'The prerequisite chain is incomplete or invalid.', { plan, deadline, campaignPlan });
      const game = text(campaign.game?.displayName || campaign.game?.name || campaign.game).toLowerCase();
      if (context.game && game && text(context.game).toLowerCase() !== game) return result('wrong-game', 'Stream not eligible', 'This stream is in a different game category.', { plan, deadline, campaignPlan });
      const allowedLogins = (context.allowedChannels || []).map(x => text(x).toLowerCase()).filter(Boolean);
      const channelLogin = text(context.channel).toLowerCase();
      const channelMismatch = Boolean(allowedLogins.length && channelLogin && !allowedLogins.includes(channelLogin));
      if (channelMismatch && context.verified !== true && context.verificationPending === true) {
        return result('verification-pending', 'Verification pending', 'Dropper is waiting for Twitch campaign evidence or credited progress for this Drops-tagged stream.', { plan, deadline, campaignPlan });
      }
      if (channelMismatch && context.verified !== true) return result('wrong-channel', 'Stream not eligible', "This stream does not meet the selected campaign's channel requirements.", { plan, deadline, campaignPlan });
      if (context.verified !== true) return result('unknown', 'Eligibility not verified', 'Dropper does not yet have enough information to verify this stream.', { plan, deadline, campaignPlan });
      if (deadline.finishable === false) return result('deadline-risk', 'Deadline risk', 'The verified watch requirement is longer than the remaining campaign window.', { plan, deadline, campaignPlan, deadlineMs: end, estimateMinutes: plan.totalRemainingMinutes });
      return result('eligible', 'Eligible stream', deadline.urgency === 'tight' ? 'This stream is eligible, but the reward deadline is close.' : 'Twitch campaign or credited-progress evidence verifies this stream.', { plan, deadline, campaignPlan, deadlineMs: end, estimateMinutes: plan.totalRemainingMinutes });
    }

    function selectorHealth(entry, now = Date.now(), staleAfterMs = 15 * 60 * 1000) {
      if (!entry?.applicable) return { status: 'not-applicable', ageMs: null, matchedAgeMs: null };
      const checkedAt = number(entry.checkedAt);
      const matchedAt = number(entry.lastMatchedAt);
      const ageMs = checkedAt === null ? null : Math.max(0, now - checkedAt);
      const matchedAgeMs = matchedAt === null ? null : Math.max(0, now - matchedAt);
      if (entry.state === 'detection-failed') return { status: 'degraded', ageMs, matchedAgeMs };
      if (entry.state === 'attempted') return { status: 'action-pending', ageMs, matchedAgeMs };
      if (entry.state === 'matched') return { status: 'observed', ageMs, matchedAgeMs: 0 };
      if (matchedAgeMs !== null && matchedAgeMs > Math.max(0, staleAfterMs)) return { status: 'stale-observation', ageMs, matchedAgeMs };
      if (matchedAgeMs !== null) return { status: 'observed-recently', ageMs, matchedAgeMs };
      // No historical match is not evidence of a broken selector when there is
      // simply nothing claimable on the current page.
      return { status: 'monitoring', ageMs, matchedAgeMs: null };
    }

    function recoveryDiagnosis(health, { delayedMs = 5 * 60 * 1000, stalledMs = 6 * 60 * 1000 } = {}) {
      if (!health?.login) return { code: 'no-stream', recoverable: false };
      if (health.pauseReason === 'viewer') return { code: 'viewer-paused', recoverable: false };
      if (health.live === false) return { code: 'offline', recoverable: true };
      if (health.gameMatches === false) return { code: 'wrong-game', recoverable: true };
      if (health.playback === 'error') return { code: 'playback-error', recoverable: true };
      if (health.playback === 'paused' && health.pauseReason !== 'viewer' && (health.visibilityState === 'hidden' || health.pictureInPicture === true)) {
        return { code: 'credit-delayed-background', recoverable: false };
      }
      if ((health.playback === 'paused' || health.playback === 'ended') && health.pauseReason !== 'viewer') {
        return { code: 'playback-stopped', recoverable: true };
      }
      if (health.inVerificationGrace) return { code: 'verification-grace', recoverable: false };
      if (health.campaignVerified === false) return { code: 'eligibility-unverified', recoverable: false };
      const progressAgeMs = Math.max(0, Number(health.progressAgeMs || 0));
      const delayedThresholdMs = Math.max(0, delayedMs);
      const stalledThresholdMs = Math.max(0, stalledMs);
      if (health.backgrounded === true && progressAgeMs >= delayedThresholdMs) {
        return { code: 'credit-delayed-background', recoverable: false };
      }
      if (Number(health.foregroundGraceRemainingMs || 0) > 0 && progressAgeMs >= delayedThresholdMs) {
        return { code: 'foreground-revalidation-grace', recoverable: false };
      }
      if (progressAgeMs >= stalledThresholdMs) return { code: 'credit-stalled', recoverable: true };
      if (health.playback === 'buffering' && progressAgeMs >= delayedThresholdMs) return { code: 'buffering', recoverable: false };
      if (progressAgeMs >= delayedThresholdMs) return { code: 'credit-delayed', recoverable: false };
      return { code: 'healthy', recoverable: false };
    }

    function createLease({ now = Date.now, id = () => `${Date.now()}-${Math.random()}`, read = () => null, write = () => {}, remove = () => {}, ttlMs = 8000, settle = () => Promise.resolve() } = {}) {
      async function run(key, task) {
        const owner = text(id());
        const startedAt = now();
        let current = null;
        try { current = read(key); } catch (_) {}
        if (current && Number(current.expiresAt || 0) > startedAt && current.owner !== owner) return false;
        const token = `${owner}:${startedAt}:${Math.random().toString(36).slice(2)}`;
        const lease = { owner, token, expiresAt: startedAt + Math.max(1000, Number(ttlMs) || 8000) };
        try { write(key, lease); } catch (_) { return false; }
        try { await settle(); } catch (_) {}
        let held = null;
        try { held = read(key); } catch (_) {}
        if (!held || held.token !== token || Number(held.expiresAt || 0) <= now()) return false;
        try { return await task(); }
        finally {
          try {
            const latest = read(key);
            if (latest?.token === token) remove(key);
          } catch (_) {}
        }
      }
      return Object.freeze({ run });
    }
    function inventoryClaimCandidates(campaigns, { limit = 3, excludeRewardId = '' } = {}) {
      const excluded = text(excludeRewardId);
      const candidates = [];
      for (const campaign of campaigns || []) {
        const campaignId = text(campaign?.id);
        const campaignKey = campaignId || text(campaign?.campaignKey);
        const game = text(campaign?.game?.displayName || campaign?.game?.name || campaign?.game);
        const endAt = text(campaign?.endAt);
        const parsedEnd = endAt ? Date.parse(endAt) : NaN;
        const endMs = Number.isFinite(parsedEnd) ? parsedEnd : Number.MAX_SAFE_INTEGER;
        const drops = campaign?.timeBasedDrops || campaign?.drops || [];
        drops.forEach((drop, dropOrder) => {
          const self = drop?.self || {};
          const rewardId = text(drop?.id);
          if (excluded && rewardId && rewardId === excluded) return;
          if (self.isClaimed === true || drop?.isClaimed === true) return;
          const requiredSubs = Number(drop?.requiredSubs ?? drop?.requiredSubscriptions ?? drop?.requiredSubscriptionCount ?? drop?.subscriptionRequirement?.requiredSubs ?? 0) || 0;
          if (requiredSubs > 0) return;
          const required = number(drop?.requiredMinutesWatched ?? drop?.requiredMinutes);
          const current = number(self.currentMinutesWatched ?? drop?.currentMinutes);
          const instanceID = text(self.dropInstanceID || drop?.dropInstanceID);
          if (!instanceID || required === null || required <= 0 || current === null || current < required) return;
          candidates.push({
            id: rewardId,
            dropInstanceID: instanceID,
            isClaimed: false,
            name: text(drop?.name || drop?.benefitEdges?.[0]?.benefit?.name || 'Completed Drop'),
            game,
            campaignId,
            campaignKey,
            campaign: text(campaign?.name || game),
            campaignStartAt: text(campaign?.startAt),
            campaignEndAt: endAt,
            dropStartAt: text(drop?.startAt),
            dropEndAt: text(drop?.endAt),
            endMs,
            currentMinutes: current,
            requiredMinutes: required,
            remainingMinutes: 0,
            percent: 100,
            inventorySweep: true,
            dropOrder,
          });
        });
      }
      candidates.sort((a, b) => {
        if (a.endMs !== b.endMs) return a.endMs - b.endMs;
        if (a.campaignKey !== b.campaignKey) return a.campaignKey.localeCompare(b.campaignKey);
        return a.dropOrder - b.dropOrder;
      });
      const max = Math.max(0, Math.min(10, Number(limit) || 0));
      return max ? candidates.slice(0, max) : [];
    }
    function claimPresentation(record) {
      const outcome = record?.outcome;
      const evidence = record?.evidence;
      if (outcome === 'confirmed') return 'Reward claimed';
      if (outcome === 'already-claimed') return 'Already claimed';
      if (outcome === 'retryable') return 'Claim retry pending';
      if (outcome === 'blocked') return 'Claim needs attention';
      if (outcome === 'pending') return 'Claim sent · Waiting for Twitch';
      if (outcome === 'discarded') return 'Claim context changed';
      if (outcome === 'unconfirmed' && evidence === 'timeout') return 'Claim sent · Confirmation unavailable';
      return 'Claim not confirmed';
    }

    return Object.freeze({ createIntent, createClaims, claimResponse, claimFailure, planPrerequisites, deadlineAssessment, campaignSequence, rankCampaignCandidates, eligibility, selectorHealth, recoveryDiagnosis, createLease, inventoryClaimCandidates, claimPresentation });
  })();
  // END DROPPER ACTIVE VIEWING

  // The campaign model: Twitch's dashboard and inventory merged into one list, one rule for whether a campaign or
  // reward is open, the ignored games and the priority order. No network and no page access; twitch.js fetches,
  // the controller decides when.
  const CAMPAIGN_CATALOG_TTL_MS = 7 * 24 * 60 * 60 * 1000;
  const CAMPAIGN_MEMORY_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
  const OPEN_STATUSES = new Set(['ACTIVE', 'TEST', 'OPEN']);
  const EXCLUDED_CATEGORY_SLUGS = new Set(['first-partners-collection']);
  const EXCLUDED_CAMPAIGN_NAMES = new Set(['first partners collection']);

  const campaignDrops = campaign => campaign?.timeBasedDrops || campaign?.drops || [];
  const campaignGame = item => !item || typeof item !== 'object' ? '' : typeof item.game === 'string' ? cleanText(item.game) : cleanText(item.game?.displayName || item.game?.name || '');
  const isPageCampaignKey = key => /^page:/i.test(cleanText(key));

  function campaignKey(campaign) {
    return String(campaign?.id || `${campaign?.game?.displayName || campaign?.game?.name || ''}|${campaign?.name || ''}`).toLowerCase();
  }

  function requiresSubscription(drop) {
    if (!drop) return false;
    return (Number(drop.requiredSubs ?? drop.requiredSubscriptions ?? drop.requiredSubscriptionCount ?? drop.subscriptionRequirement?.requiredSubs ?? 0) || 0) > 0;
  }
  const watchDrops = campaign => campaignDrops(campaign).filter(drop => !requiresSubscription(drop) && Number(drop?.requiredMinutesWatched || 0) > 0);
  const dropDone = drop => Boolean(drop?.self?.isClaimed) || Number(drop?.self?.currentMinutesWatched || 0) >= Number(drop?.requiredMinutesWatched || 0);
  function watchDropsComplete(campaign) {
    if (campaign?.nativeRewardsPending) return false;
    const drops = watchDrops(campaign);
    return Boolean(drops.length && drops.every(dropDone));
  }

  function campaignIsExcluded(item) {
    if (!item) return false;
    const campaignName = typeof item.campaign === 'string' ? item.campaign : item.name || '';
    const slug = cleanText(item.gameSlug || item.game?.slug || '').toLowerCase();
    return EXCLUDED_CATEGORY_SLUGS.has(slug) || EXCLUDED_CAMPAIGN_NAMES.has(normalizeGameName(campaignGame(item))) || EXCLUDED_CAMPAIGN_NAMES.has(normalizeGameName(campaignName));
  }

  const timeWindow = item => ({ startMs: parseTime(item?.startAt || item?.campaignStartAt), endMs: parseTime(item?.endAt || item?.campaignEndAt), startAt: item?.startAt || item?.campaignStartAt || '', endAt: item?.endAt || item?.campaignEndAt || '' });

  // The one open rule (3.x had two). `listed`: shown in the menu and counted. `open`: may be routed to, which also
  // needs known campaign dates. Twitch returns some campaigns without dates; they are listed, never routed. A
  // page-scraped row (id `page:…`) without a verified window is neither. A reward can have its own narrower dates.
  function campaignState(campaign, { reward = null, now = Date.now(), ignored = false, completed = false } = {}) {
    const own = timeWindow(campaign);
    const status = cleanText(campaign?.status).toUpperCase();
    const datesKnown = Boolean(own.startMs && own.endMs && own.endMs > own.startMs);
    let reason = 'open';
    if (campaign?.self?.isEligible === false || reward?.self?.isEligible === false) reason = 'participation-not-eligible';
    else if (campaignIsExcluded(campaign) || campaignIsExcluded(reward)) reason = 'excluded';
    else if (status && !OPEN_STATUSES.has(status)) reason = 'status-closed';
    else if (isPageCampaignKey(campaign?.id) && !datesKnown) reason = 'page-dates-unverified';
    else if (own.startMs && own.endMs && own.endMs <= own.startMs) reason = 'dates-invalid';
    else if (own.startMs && own.startMs > now) reason = 'not-started';
    else if (own.endMs && own.endMs <= now) reason = 'expired';
    else if (reward && timeWindow(reward).startMs > now) reason = 'reward-not-started';
    else if (reward && timeWindow(reward).endMs && timeWindow(reward).endMs <= now) reason = 'reward-ended';
    const listed = reason === 'open';
    if (listed && ignored) reason = 'ignored-game';
    else if (listed && completed) reason = 'completed';
    else if (listed && !datesKnown) reason = 'campaign-dates-unknown';
    return { open: reason === 'open', listed, reason, datesKnown, status: status || null, ...own };
  }

  // Finds campaign-shaped objects anywhere in a GQL payload (dashboard, inventory, details).
  function extractCampaigns(payload) {
    const found = [], seen = new Set();
    const visit = (value, depth) => {
      if (!value || depth > 12) return;
      if (Array.isArray(value)) { value.forEach(item => visit(item, depth + 1)); return; }
      if (typeof value !== 'object' || seen.has(value)) return;
      seen.add(value);
      const drops = value.timeBasedDrops || value.drops;
      if (Array.isArray(drops) && drops.length && (value.id || value.name) && value.game) found.push(value);
      Object.values(value).forEach(item => visit(item, depth + 1));
    };
    visit(payload, 0);
    return found;
  }

  // Later lists win field by field; rewards merge by ID, their `self` progress merged too. An enabled allow-list
  // without channels is incomplete, so it does not replace a known channel list.
  function mergeCampaigns(...lists) {
    const merged = new Map();
    for (const campaign of lists.flat()) {
      const key = String(campaign?.id || campaignKey(campaign) || '').toLowerCase();
      if (!key) continue;
      const prior = merged.get(key);
      if (!prior) { merged.set(key, campaign); continue; }
      const drops = new Map(campaignDrops(prior).map(drop => [String(drop?.id || drop?.name || ''), drop]));
      for (const drop of campaignDrops(campaign)) {
        const id = String(drop?.id || drop?.name || '');
        drops.set(id, { ...(drops.get(id) || {}), ...drop, self: { ...(drops.get(id)?.self || {}), ...(drop?.self || {}) } });
      }
      merged.set(key, {
        ...prior, ...campaign,
        allow: campaign?.allow?.isEnabled === false || campaign?.allow?.channels?.length ? campaign.allow : prior.allow || campaign.allow,
        status: campaign?.status || prior?.status || '',
        game: { ...(prior?.game || {}), ...(campaign?.game || {}) },
        timeBasedDrops: [...drops.values()],
      });
    }
    return [...merged.values()];
  }

  // The stored catalog keeps only the fields 4.0 uses (same shape 3.x cached).
  function compactCampaigns(campaigns) {
    const bool = (value, name) => typeof value === 'boolean' ? { [name]: value } : {};
    return (campaigns || []).slice(0, 250).map(campaign => ({
      id: campaign?.id || '', name: campaign?.name || '', status: campaign?.status || '', startAt: campaign?.startAt || '', endAt: campaign?.endAt || '',
      game: { id: campaign?.game?.id || '', name: campaign?.game?.name || '', displayName: campaign?.game?.displayName || '', slug: campaign?.game?.slug || '' },
      ...bool(campaign?.isAccountConnected, 'isAccountConnected'),
      self: { ...bool(campaign?.self?.isAccountConnected, 'isAccountConnected'), ...bool(campaign?.self?.isEligible, 'isEligible') },
      allow: {
        isEnabled: campaign?.allow?.isEnabled !== false,
        channels: (campaign?.allow?.channels || []).slice(0, 250).map(channel => ({ id: channel?.id || '', name: channel?.name || channel?.login || '', login: channel?.login || channel?.name || '', displayName: channel?.displayName || '' })),
      },
      timeBasedDrops: campaignDrops(campaign).slice(0, 100).map(drop => ({
        id: drop?.id || '', name: drop?.name || drop?.benefitEdges?.[0]?.benefit?.name || '', startAt: drop?.startAt || '', endAt: drop?.endAt || '',
        requiredMinutesWatched: Number(drop?.requiredMinutesWatched || 0),
        requiredSubs: Number(drop?.requiredSubs ?? drop?.requiredSubscriptions ?? drop?.requiredSubscriptionCount ?? drop?.subscriptionRequirement?.requiredSubs ?? 0) || 0,
        preconditionDrops: (drop?.preconditionDrops || []).map(item => ({
          id: item?.id || '',
          ...(['claimed', 'completed'].includes(item?.requirement) ? { requirement: item.requirement } : {}),
          ...bool(item?.requiresClaim, 'requiresClaim'),
        })),
        benefitEdges: [{ benefit: { name: drop?.benefitEdges?.[0]?.benefit?.name || drop?.name || '', imageAssetURL: drop?.benefitEdges?.[0]?.benefit?.imageAssetURL || '' } }],
        self: {
          isClaimed: Boolean(drop?.self?.isClaimed),
          ...bool(drop?.self?.hasPreconditionsMet, 'hasPreconditionsMet'),
          ...bool(drop?.self?.isEligible, 'isEligible'),
          currentMinutesWatched: drop?.self?.currentMinutesWatched == null ? null : Number(drop.self.currentMinutesWatched),
          dropInstanceID: drop?.self?.dropInstanceID || '',
        },
      })),
    }));
  }

  const CAMPAIGN_RETIRE_MIN_LISTED = 12;

  function createCampaigns({ store, now = Date.now, log = () => {} } = {}) {
    // Catalog: the merged list, cached per tab for a week like 3.x.
    function catalog() {
      const saved = store.session.get('campaignCatalog', null);
      const at = Number(saved?.at || 0);
      return at && now() - at <= CAMPAIGN_CATALOG_TTL_MS && Array.isArray(saved?.campaigns) ? saved.campaigns : [];
    }
    function saveCatalog(campaigns) {
      const compact = compactCampaigns(campaigns);
      store.session.set('campaignCatalog', { at: now(), campaigns: compact });
      return compact;
    }

    // Memory: which campaigns were seen and completed, kept for 90 days after they end.
    function isCompleted(campaignOrKey, memory = store.campaignMemory()) {
      const key = typeof campaignOrKey === 'string' ? campaignOrKey : campaignKey(campaignOrKey);
      if (!key) return false;
      if (!isPageCampaignKey(key)) return Boolean(memory.campaigns?.[key]?.completedAt);
      // A page row has no stable ID; a completed campaign for its game counts.
      const game = cleanText(typeof campaignOrKey === 'object' ? campaignGame(campaignOrKey) : '').toLowerCase();
      return Boolean(game && Object.values(memory.campaigns || {}).some(record => record?.completedAt && cleanText(record.game).toLowerCase() === game));
    }
    function remember(campaigns, source = 'unknown') {
      const at = now();
      const memory = store.campaignMemory();
      const records = { ...(memory.campaigns || {}) };
      let changed = false;
      for (const [key, record] of Object.entries(records)) {
        const endMs = parseTime(record?.endAt);
        if (endMs && at - endMs > CAMPAIGN_MEMORY_RETENTION_MS) { delete records[key]; changed = true; }
      }
      for (const campaign of campaigns || []) {
        const key = campaignKey(campaign);
        if (!key) continue;
        const prior = records[key] || {}, page = isPageCampaignKey(key), drops = watchDrops(campaign);
        const completeNow = !page && watchDropsComplete(campaign);
        const completedAt = page ? 0 : (prior.completedAt || (completeNow ? at : 0));
        const next = {
          id: campaign?.id || prior.id || '', name: campaign?.name || prior.name || '', game: campaignGame(campaign) || prior.game || '',
          startAt: campaign?.startAt || prior.startAt || '', endAt: campaign?.endAt || prior.endAt || '',
          status: completedAt ? 'completed' : campaignState(campaign, { now: at }).listed ? 'open' : cleanText(campaign?.status).toLowerCase() || 'seen',
          completedAt, seenAt: at, watchDrops: drops.length, completedWatchDrops: drops.filter(dropDone).length, source,
        };
        if (JSON.stringify(prior) !== JSON.stringify(next)) { records[key] = next; changed = true; }
        if (completeNow && !prior.completedAt) log('campaign-complete', `Remembered completed campaign ${next.name || next.game}`, { campaignKey: key });
      }
      if (changed) store.setCampaignMemory({ updatedAt: at, campaigns: records });
      return records;
    }
    // A full dashboard list (12 or more, as in 3.x) closes remembered open campaigns it no longer lists, except
    // inventory campaigns, the selected one and page rows. Records are marked closed, never deleted.
    function retireUnlisted(listed, { keep = [], source = 'viewer-drops-dashboard' } = {}) {
      if (!Array.isArray(listed) || listed.length < CAMPAIGN_RETIRE_MIN_LISTED) return 0;
      const known = new Set([...listed, ...keep].map(item => (typeof item === 'string' ? cleanText(item).toLowerCase() : campaignKey(item))).filter(Boolean));
      const at = now(), memory = store.campaignMemory(), records = { ...(memory.campaigns || {}) }, retired = [];
      for (const [key, record] of Object.entries(records)) {
        if (!record || record.completedAt || known.has(key) || isPageCampaignKey(key)) continue;
        if (['expired', 'completed', 'closed'].includes(cleanText(record.status).toLowerCase())) continue;
        records[key] = { ...record, status: 'closed', closedAt: at, source };
        retired.push(record.name || key);
      }
      if (!retired.length) return 0;
      store.setCampaignMemory({ updatedAt: at, campaigns: records });
      log('campaign-memory', `Closed ${retired.length} remembered campaign${retired.length === 1 ? '' : 's'} Twitch no longer lists`, { source, listed: listed.length, campaigns: retired.slice(0, 8) });
      return retired.length;
    }
    function markCompleted(key, details = {}) {
      const id = cleanText(key);
      // Page rows only complete by ending; other paths have no stable ID to mark.
      if (!id || (isPageCampaignKey(id) && cleanText(details.source).toLowerCase() !== 'campaign-ended')) return false;
      const memory = store.campaignMemory();
      const prior = memory.campaigns?.[id] || {};
      if (prior.completedAt) return true;
      const at = now();
      store.setCampaignMemory({ updatedAt: at, campaigns: { ...memory.campaigns, [id]: {
        ...prior, id: details.id || prior.id || '', name: details.name || prior.name || '', game: details.game || prior.game || '',
        startAt: details.startAt || prior.startAt || '', endAt: details.endAt || prior.endAt || '',
        status: cleanText(details.status).toLowerCase() || 'completed', completedAt: at, seenAt: at, source: details.source || 'inventory-audit',
      } } });
      return true;
    }

    // The state of a campaign (and optionally one of its rewards) with this account's ignored games and memory.
    const state = (campaign, reward = null, at = now()) => campaignState(campaign, { reward, now: at, ignored: store.isIgnored(campaignGame(campaign) || campaignGame(reward), undefined, at), completed: isCompleted(campaign) });

    // Open games for the menu: one row per game, grouped across its campaigns, ignored ones included and marked.
    function openGames(campaigns, at = now()) {
      const byGame = new Map();
      for (const campaign of campaigns || []) {
        const current = campaignState(campaign, { now: at });
        const game = campaignGame(campaign), key = normalizeGameName(game);
        if (!current.listed || !current.datesKnown || !key) continue;
        const row = byGame.get(key) || { key, game, campaignKeys: new Set(), campaignNames: new Set(), earliestEndMs: current.endMs, latestEndMs: current.endMs, latestEndAt: current.endAt };
        row.campaignKeys.add(campaignKey(campaign) || `${key}:${current.endMs}`);
        const name = cleanText(campaign?.name);
        if (name && normalizeGameName(name) !== key) row.campaignNames.add(name);
        row.earliestEndMs = Math.min(row.earliestEndMs, current.endMs);
        if (current.endMs >= row.latestEndMs) { row.latestEndMs = current.endMs; row.latestEndAt = current.endAt || row.latestEndAt; }
        byGame.set(key, row);
      }
      const ignored = store.ignoredGames(undefined, at).games;
      return [...byGame.values()].map(row => ({
        key: row.key, game: row.game, campaignCount: row.campaignKeys.size, campaignNames: [...row.campaignNames],
        earliestEndMs: row.earliestEndMs, latestEndMs: row.latestEndMs, latestEndAt: row.latestEndAt,
        ignored: Number(ignored[row.key]?.expiresAt || 0) > at,
      })).sort((a, b) => a.game.localeCompare(b.game));
    }

    // Ignoring a game lasts until its last open campaign ends; a refresh may extend that, never shorten it.
    const ignoreGame = (game, latestEndMs, ignored = true) => store.setIgnoredGame(game, latestEndMs, ignored);
    function extendIgnoredGames(rows, at = now()) {
      const ignored = store.ignoredGames(undefined, at).games;
      let changed = false;
      for (const row of rows || []) {
        const record = ignored[row.key];
        if (record && Number(row.latestEndMs || 0) > Number(record.expiresAt || 0)) changed = store.setIgnoredGame(row.game || record.game, row.latestEndMs, true, undefined, at) || changed;
      }
      return changed;
    }

    // Priorities: the ranked order first (score 1000 - index), then 3.x's older per-game -1/0/1 for games not in it.
    // The account is resolved once per ranking pass, not per game (3.x read the cookie at most twice).
    function priorityScorer() {
      const account = store.login(), order = store.priorityOrder(account);
      return game => {
        const index = order.indexOf(normalizeGameName(game));
        return index >= 0 ? 1000 - index : store.priority(game, account).value;
      };
    }
    function priorityRank(game) {
      const index = store.priorityOrder().indexOf(normalizeGameName(game));
      if (index >= 0) return { rank: index + 1, score: 1000 - index, explicit: true, source: 'ranked' };
      const legacy = store.priority(game);
      return { rank: null, score: legacy.value, explicit: legacy.explicit, source: legacy.explicit ? 'legacy' : 'default' };
    }
    // Adds open games missing from the order at its end, higher older priorities first.
    function reconcileOrder(rows) {
      const keyed = new Map((rows || []).map(row => [normalizeGameName(row.game), row]).filter(([key]) => key));
      const existing = store.priorityOrder();
      const missing = [...keyed.keys()].filter(key => !existing.includes(key))
        .sort((left, right) => store.priority(keyed.get(right).game).value - store.priority(keyed.get(left).game).value);
      const next = [...existing, ...missing].slice(0, 250);
      return JSON.stringify(next) === JSON.stringify(existing) ? existing : store.setPriorityOrder(next);
    }
    // Moves a game to a 1-based position among the open games; closed games keep their saved slots.
    function moveGame(game, position, rows) {
      if (!Number.isInteger(position)) return false;
      const order = reconcileOrder(rows);
      const visible = [...new Set((rows || []).map(row => normalizeGameName(row.game)).filter(key => key && order.includes(key)))]
        .sort((left, right) => order.indexOf(left) - order.indexOf(right));
      const key = normalizeGameName(game), from = visible.indexOf(key), to = position - 1;
      if (from < 0 || to < 0 || to >= visible.length || to === from) return false;
      const visibleKeys = new Set(visible);
      visible.splice(from, 1);
      visible.splice(to, 0, key);
      let index = 0;
      store.setPriorityOrder(order.map(entry => visibleKeys.has(entry) ? visible[index++] : entry));
      return true;
    }

    // What stands before a reward: its prerequisite rewards in the same campaign (shared rules in active-viewing.js).
    const prerequisites = (reward, campaign) => DropperActiveViewing.planPrerequisites(reward, campaignDrops(campaign));

    return Object.freeze({ prerequisites, catalog, saveCatalog, remember, retireUnlisted, markCompleted, isCompleted, state, openGames, ignoreGame, extendIgnoredGames, priorityScorer, priorityRank, reconcileOrder, moveGame });
  }

  // Twitch's All campaigns page, read as 3.8.3 read it: while the viewer has it open, its open rows join the
  // campaign pool (they are not saved). 3.x's scroll-and-import flow only ran from its retired handoff code, so it
  // is not carried over.
  const CAMPAIGNS_PAGE_URL = 'https://www.twitch.tv/drops/campaigns';
  const PAGE_CAMPAIGN_IMPORT_MIN = 12;
  const CAMPAIGN_PAGE_DISPLAY = Object.freeze({ ACCORDION: 'accordion', TEXT_BLOCK: 'text-block', EMPTY: 'empty', LOADING: 'loading', TIMEOUT: 'timeout', GQL_AUTH: 'gql-auth', GQL_INVENTORY: 'gql-inventory', UNKNOWN: 'unknown' });

  function createCampaignsPage({ log = () => {} } = {}) {
    // 3.x's names, so the carried-over code reads as it did.
    const logActivity = log;
    const isCampaigns = () => location.href.split('?')[0] === CAMPAIGNS_PAGE_URL;
    let lastCampaignPageScanSignature = '';
    let lastCampaignPageDisplay = { mode: CAMPAIGN_PAGE_DISPLAY.UNKNOWN };

    function scrapeCampaignsFromPage() {
      if (!isCampaigns()) return [];
      const campaigns = [];
      const seen = new Set();
      const main = campaignsPageMainRoot();
      const display = detectCampaignsPageDisplay(main);

      const pushCampaign = (game, dateText = "") => {
        const title = cleanText(game);
        if (!title || campaignIsExcluded({ game: title, campaign: title, gameSlug: "" })) return;
        if (/^(inventory|all campaigns|open drop campaigns|open reward campaigns|closed drop campaigns|closed reward campaigns|social media badge|drops?|campaign)$/i.test(title)) return;
        const key = campaignTitleKey(title);
        if (!key || seen.has(key)) return;
        const { startAt, endAt } = parseCampaignDateRange(dateText);
        const startMs = Date.parse(startAt || "") || 0;
        const endMs = Date.parse(endAt || "") || 0;
        // Page-derived campaigns are routing hints, so unknown or malformed
        // windows must never be promoted to ACTIVE.
        if (!startMs || !endMs || endMs <= startMs || endMs <= Date.now()) return;
        seen.add(key);
        campaigns.push({
          id: `page:${key}`,
          name: title,
          status: "ACTIVE",
          startAt,
          endAt,
          game: {
            id: "",
            displayName: title,
            name: title,
            slug: "",
          },
          // The All Campaigns page proves membership and dates, not the actual
          // reward duration. Keep this as a shell until Twitch supplies Drop details.
          timeBasedDrops: [],
        });
      };

      const readGameFromCampaignRoot = (root, dateText = "") => {
        if (!root) return "";
        const image = root.querySelector?.("img.tw-image, img[alt]");
        let game = cleanText(image?.getAttribute("alt") || "");
        if (!game || /drops?|campaign|image|logo/i.test(game)) {
          const lines = cleanText(root.textContent || "")
            .split(/\n+/)
            .map((line) => cleanText(line))
            .filter(Boolean);
          game = lines.find((line) => (
            line.length > 1 &&
            line.length < 80 &&
            line !== dateText &&
            !/\b(?:AM|PM)\b/i.test(line) &&
            !/^\w+,\s+\w+\s+\d/i.test(line) &&
            !/^(inventory|all campaigns|open drop campaigns|open reward campaigns|social media badge)$/i.test(line)
          )) || "";
        }
        return game;
      };

      const readDateFromRoot = (root) => {
        if (!root) return "";
        for (const node of root.querySelectorAll?.("div, span, p") || []) {
          const text = cleanText(node.textContent);
          if (node.children.length === 0 && /\w+,\s+\w+\s+\d/.test(text) && /[-–]/.test(text)) {
            return text;
          }
        }
        const headingText = cleanText(root.textContent || "");
        const range = headingText.match(/\w+,\s+\w+\s+\d[\s\S]{0,40}[-–][\s\S]{0,40}\d:\d{2}\s*(?:AM|PM)/i);
        return cleanText(range?.[0] || "");
      };

      // Accordion display: Twitch lists each open campaign as an expandable heading row.
      if (
        display.mode === CAMPAIGN_PAGE_DISPLAY.ACCORDION ||
        display.mode === CAMPAIGN_PAGE_DISPLAY.UNKNOWN ||
        display.accordionHeaders > 0
      ) {
        for (const { heading, button } of openCampaignAccordionButtons(main)) {
          const dateText = readDateFromRoot(button) || readDateFromRoot(heading);
          const game = readGameFromCampaignRoot(button, dateText) || readGameFromCampaignRoot(heading, dateText);
          pushCampaign(game, dateText);
        }
      }

      // Date-leaf / text-row display: campaign windows appear without accordion buttons.
      if (
        campaigns.length < PAGE_CAMPAIGN_IMPORT_MIN &&
        (
          display.mode === CAMPAIGN_PAGE_DISPLAY.TEXT_BLOCK ||
          display.mode === CAMPAIGN_PAGE_DISPLAY.UNKNOWN ||
          display.dateLeaves > 0
        )
      ) {
        for (const dateNode of campaignDateLeafNodes(main)) {
          const dateText = cleanText(dateNode.textContent);
          let root = dateNode.parentElement;
          for (let depth = 0; depth < 6 && root; depth += 1) {
            const game = readGameFromCampaignRoot(root, dateText);
            if (game) {
              pushCampaign(game, dateText);
              break;
            }
            root = root.parentElement;
          }
        }
      }

      // Plain Open Drop Campaigns text block: game / publisher / date range triples.
      if (
        campaigns.length < PAGE_CAMPAIGN_IMPORT_MIN &&
        display.mode !== CAMPAIGN_PAGE_DISPLAY.EMPTY
      ) {
        const pageText = main.innerText || "";
        const openIdx = pageText.search(/Open (?:Drop|Reward) Campaigns/i);
        if (openIdx >= 0) {
          let section = pageText.slice(openIdx);
          const closedIdx = section.search(/\nClosed\s+(?:Drop|Reward)\s+Campaigns/i);
          if (closedIdx >= 0) section = section.slice(0, closedIdx);
          if (!/There are no Drops campaigns available currently/i.test(section)) {
            const blockRe = /^([^\n]{2,80})\n([^\n]{2,80})\n((?:[A-Za-z]{3},\s+[A-Za-z]{3}\s+\d{1,2},?\s+\d{1,2}:\d{2}\s*(?:AM|PM))\s*[-–]\s*(?:[A-Za-z]{3},\s+[A-Za-z]{3}\s+\d{1,2},?\s+\d{1,2}:\d{2}\s*(?:AM|PM))[^\n]*)$/gm;
            let match;
            while ((match = blockRe.exec(section))) {
              const game = cleanText(match[1]);
              const publisher = cleanText(match[2]);
              const dateText = cleanText(match[3]);
              if (/^(open (?:drop|reward) campaigns|some drops campaigns|to include drops|learn more|rewards are limited)/i.test(game)) continue;
              if (/\b(?:AM|PM)\b/i.test(game) || /\b(?:AM|PM)\b/i.test(publisher)) continue;
              pushCampaign(game, dateText);
            }
          }
        }
      }

      if (campaigns.length) {
        const signature = `${display.mode}:${campaigns.length}:${campaigns.slice(0, 8).map((item) => item.game?.displayName || item.name).join("|")}`;
        if (signature !== lastCampaignPageScanSignature) {
          lastCampaignPageScanSignature = signature;
          logActivity("campaign-page-scan", `Read ${campaigns.length} open campaigns from All campaigns (${display.mode})`, {
            display: display.mode,
            accordionHeaders: display.accordionHeaders,
            dateLeaves: display.dateLeaves,
            games: campaigns.slice(0, 8).map((item) => item.game?.displayName || item.name),
          });
        }
      } else if (display.mode === CAMPAIGN_PAGE_DISPLAY.EMPTY) {
        const signature = `empty:${display.hasEmptyMessage ? 1 : 0}`;
        if (signature !== lastCampaignPageScanSignature) {
          lastCampaignPageScanSignature = signature;
          logActivity("campaign-page-scan", "All campaigns page reports no open Drop campaigns in this view", {
            display: display.mode,
          });
        }
      }
      return campaigns;
    }

    function campaignsPageMainRoot() {
      return (
        document.querySelector("main.twilight-main .drops-root__content") ||
        document.querySelector("main.twilight-main") ||
        document.querySelector("main") ||
        document
      );
    }

    function findCampaignsSectionMarker(main, section) {
      const pattern = section === "open"
        ? /^open\s+(?:drop|reward)\s+campaigns$/i
        : /^closed\s+(?:drop|reward)\s+campaigns$/i;
      return [...main.querySelectorAll('h1, h2, h3, h4, h5, [role="heading"], div, span, p')].find((el) => (
        pattern.test(cleanText(el.textContent || ""))
      )) || null;
    }

    function findCampaignsOpenMarker(main = campaignsPageMainRoot()) {
      return findCampaignsSectionMarker(main, "open");
    }

    function findCampaignsClosedMarker(main = campaignsPageMainRoot()) {
      return findCampaignsSectionMarker(main, "closed");
    }

    function nodeIsWithinOpenCampaignSection(node, main = campaignsPageMainRoot()) {
      if (!node) return false;
      const openMarker = findCampaignsOpenMarker(main);
      if (!openMarker) return false;
      const afterOpen = Boolean(openMarker.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING);
      if (!afterOpen) return false;
      const closedMarker = findCampaignsClosedMarker(main);
      if (!closedMarker) {
        // If Twitch says a Closed section exists but its boundary cannot be
        // located, fail closed rather than treating the rest of the page as open.
        const pageText = cleanText(main.innerText || main.textContent || "");
        return !/closed\s+(?:drop|reward)\s+campaigns/i.test(pageText);
      }
      return Boolean(node.compareDocumentPosition(closedMarker) & Node.DOCUMENT_POSITION_FOLLOWING);
    }

    function openCampaignAccordionHeadings(main = campaignsPageMainRoot()) {
      return [...main.querySelectorAll(
        '.accordion-header[role="heading"][aria-level="3"], .accordion-header[role="heading"], [role="heading"][aria-level="3"]',
      )].filter((heading) => {
        if (!main.contains(heading)) return false;
        if (!heading.querySelector("button[aria-expanded]")) return false;
        return nodeIsWithinOpenCampaignSection(heading, main);
      });
    }

    function openCampaignAccordionButtons(main = campaignsPageMainRoot()) {
      return openCampaignAccordionHeadings(main).map((heading) => {
        const button = heading.querySelector(":scope > button[aria-expanded]") || heading.querySelector("button[aria-expanded]");
        return button ? { heading, button } : null;
      }).filter(Boolean);
    }

    function campaignDateLeafNodes(main = campaignsPageMainRoot()) {
      return [...main.querySelectorAll("div, span, p")].filter((node) => {
        if (!node || node.children.length > 0) return false;
        if (!nodeIsWithinOpenCampaignSection(node, main)) return false;
        const text = cleanText(node.textContent);
        return /\w+,\s+\w+\s+\d/.test(text) && /[-–]/.test(text) && /\b(?:AM|PM)\b/i.test(text);
      });
    }

    function parseCampaignDateRange(text) {
      const match = cleanText(text).match(
        /([A-Za-z]{3},\s+[A-Za-z]{3}\s+\d{1,2},?\s+\d{1,2}:\d{2}\s*(?:AM|PM))\s*[-–]\s*([A-Za-z]{3},\s+[A-Za-z]{3}\s+\d{1,2},?\s+\d{1,2}:\d{2}\s*(?:AM|PM))/i,
      );
      if (!match) return { startAt: "", endAt: "" };
      const now = Date.now();
      const year = new Date(now).getFullYear();
      const candidates = [];
      for (const startYear of [year - 1, year, year + 1]) {
        const startMs = Date.parse(`${match[1]} ${startYear}`);
        let endMs = Date.parse(`${match[2]} ${startYear}`);
        if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) continue;
        // Twitch omits the year; ranges that cross New Year need the end bumped forward.
        if (endMs < startMs) endMs = Date.parse(`${match[2]} ${startYear + 1}`);
        if (!Number.isFinite(endMs) || endMs <= startMs) continue;
        candidates.push({ startMs, endMs });
      }
      if (!candidates.length) return { startAt: "", endAt: "" };
      // Prefer the range containing now. Otherwise choose the nearest upcoming
      // range, then the most recently ended range. Section membership remains
      // authoritative; this only resolves Twitch's omitted year safely.
      const containing = candidates
        .filter((item) => item.startMs <= now && item.endMs > now)
        .sort((a, b) => a.endMs - b.endMs)[0];
      const upcoming = candidates
        .filter((item) => item.startMs > now)
        .sort((a, b) => a.startMs - b.startMs)[0];
      const recent = candidates
        .filter((item) => item.endMs <= now)
        .sort((a, b) => b.endMs - a.endMs)[0];
      const selected = containing || upcoming || recent;
      return {
        startAt: selected ? new Date(selected.startMs).toISOString() : "",
        endAt: selected ? new Date(selected.endMs).toISOString() : "",
      };
    }

    function campaignTitleKey(value) {
      return cleanText(value).toLowerCase();
    }

    function detectCampaignsPageDisplay(main = campaignsPageMainRoot()) {
      const pageText = main.innerText || "";
      const hasOpenDropSection = /Open Drop campaigns/i.test(pageText);
      const hasOpenRewardSection = /Open reward campaigns/i.test(pageText);
      const hasClosedSection = /Closed\s+(?:Drop|Reward)\s+Campaigns/i.test(pageText);
      const hasEmptyMessage = /There are no Drops campaigns available currently/i.test(pageText);
      const accordionHeaders = openCampaignAccordionHeadings(main).length;
      const dateLeaves = campaignDateLeafNodes(main).length;
      let mode = CAMPAIGN_PAGE_DISPLAY.UNKNOWN;
      if (accordionHeaders > 0) {
        mode = CAMPAIGN_PAGE_DISPLAY.ACCORDION;
      } else if (dateLeaves > 0 || (hasOpenDropSection && !hasEmptyMessage && /[A-Za-z]{3},\s+[A-Za-z]{3}\s+\d/.test(pageText))) {
        mode = CAMPAIGN_PAGE_DISPLAY.TEXT_BLOCK;
      } else if (hasEmptyMessage && accordionHeaders === 0 && dateLeaves === 0) {
        mode = CAMPAIGN_PAGE_DISPLAY.EMPTY;
      } else if (!hasOpenDropSection && !hasOpenRewardSection && !hasClosedSection && !hasEmptyMessage) {
        mode = CAMPAIGN_PAGE_DISPLAY.LOADING;
      }
      lastCampaignPageDisplay = {
        mode,
        accordionHeaders,
        dateLeaves,
        hasEmptyMessage,
        hasOpenDropSection,
        hasOpenRewardSection,
        hasClosedSection,
        at: Date.now(),
      };
      return lastCampaignPageDisplay;
    }

    return Object.freeze({ rows: scrapeCampaignsFromPage, display: detectCampaignsPageDisplay, open: isCampaigns });
  }

  // Pure choice of the next reward and stream: no storage, no network, no page. The controller passes in the
  // campaign list, the open rule (campaigns.state), the ranking inputs and the visible streams. Nothing here
  // marks a campaign complete; the caller remembers campaigns through campaigns.remember.
  const WINNABLE_BUFFER_MS = 3 * 60 * 1000;
  const SHELL_MIN_WINDOW_MS = 15 * 60 * 1000;
  const FAR_FUTURE = Number.MAX_SAFE_INTEGER;
  const CAMPAIGN_STRATEGIES = ['priority', 'deadline', 'completion', 'shortest'];
  const CATEGORY_SLUG_ALIASES = Object.freeze({
    'rainbow six siege': 'tom-clancys-rainbow-six-siege',
    'overwatch': 'overwatch-2',
    'the blood of dawnwalker': 'dawnwalker',
    'delta force': 'delta-force-hawk-ops',
  });

  const plannerDrops = campaign => campaign?.timeBasedDrops || campaign?.drops || [];
  const plannerGame = campaign => cleanText(campaign?.game?.displayName || campaign?.game?.name || '');
  const knownNumber = value => value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);

  function gameSlug(value) {
    return cleanText(value).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/&/g, 'and').replace(/['’ʼ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  // Same game, allowing Twitch's category aliases (Delta Force is "delta-force-hawk-ops").
  function gameNamesMatch(a, b) {
    const left = normalizeGameName(a), right = normalizeGameName(b);
    if (!left || !right) return false;
    if (left === right) return true;
    const leftAlias = CATEGORY_SLUG_ALIASES[left], rightAlias = CATEGORY_SLUG_ALIASES[right];
    return Boolean((leftAlias && gameSlug(leftAlias) === gameSlug(b)) || (rightAlias && gameSlug(rightAlias) === gameSlug(a)));
  }

  function progressPercent(current, required) {
    const now = knownNumber(current), total = Number(required);
    if (now === null || !Number.isFinite(total) || total <= 0) return null;
    return now >= total ? 100 : Math.max(0, Math.min(99, Math.round((now / total) * 100)));
  }
  // Watch time done (a claim is separate). A campaign shell without reward details is never complete.
  function rewardComplete(item) {
    if (!item || item.needsDropDetails) return false;
    if (item.isClaimed) return true;
    const current = Number(item.currentMinutes), required = Number(item.requiredMinutes);
    if (item.currentMinutes != null && Number.isFinite(current) && Number.isFinite(required) && required > 0) return current >= required;
    return Number(item.percent || 0) >= 100;
  }
  // Can the remaining watch time finish before the end, with a 3-minute buffer? Unknown ends fit; a reward with
  // unknown progress needs at least 15 usable minutes.
  function fitsWindow(item, now) {
    if (!item) return false;
    const endMs = Number(item.endMs || parseTime(item.campaignEndAt || item.dropEndAt || item.endAt) || 0);
    if (!Number.isFinite(endMs) || endMs <= 0 || endMs >= FAR_FUTURE / 2) return true;
    const usableMs = endMs - now - WINNABLE_BUFFER_MS;
    if (usableMs <= 0) return false;
    const remaining = knownNumber(item.remainingMinutes);
    if (item.needsDropDetails || remaining === null || remaining >= FAR_FUTURE / 2) return usableMs >= SHELL_MIN_WINDOW_MS;
    return remaining <= 0 || remaining * 60 * 1000 <= usableMs;
  }

  // Twitch names the reward image differently by operation (3.x dropBenefitImage).
  const rewardImageOf = drop => cleanText(drop?.rewardImage || drop?.imageAssetURL || drop?.imageURL || drop?.imageUrl || drop?.benefitEdges?.[0]?.benefit?.imageAssetURL || '');

  // A reward as a routing target. The end is the earlier of the campaign's and the reward's own.
  function rewardTarget(campaign, drop = null) {
    const game = plannerGame(campaign);
    const ends = [parseTime(campaign?.endAt), parseTime(drop?.endAt)].filter(Boolean);
    const target = {
      game, gameSlug: campaign?.game?.slug || '', gameId: campaign?.game?.id || '',
      campaignId: campaign?.id || '', campaignKey: campaignKey(campaign), campaign: cleanText(campaign?.name) || game,
      campaignStartAt: campaign?.startAt || '', campaignEndAt: campaign?.endAt || drop?.endAt || '',
      endMs: ends.length ? Math.min(...ends) : FAR_FUTURE,
    };
    if (!drop) return { ...target, id: '', dropInstanceID: '', name: target.campaign || 'Drop', rewardImage: '', dropStartAt: '', dropEndAt: '', percent: null, currentMinutes: null, requiredMinutes: null, remainingMinutes: null, needsDropDetails: true };
    const required = Number(drop.requiredMinutesWatched || 0);
    const current = knownNumber(drop.self?.currentMinutesWatched);
    return {
      ...target, id: drop.id || '', dropInstanceID: drop.self?.dropInstanceID || '', isClaimed: Boolean(drop.self?.isClaimed),
      name: drop.name || drop.benefitEdges?.[0]?.benefit?.name || 'Drop',
      rewardImage: rewardImageOf(drop),
      dropStartAt: drop.startAt || '', dropEndAt: drop.endAt || '',
      percent: progressPercent(current, required), currentMinutes: current, requiredMinutes: required,
      remainingMinutes: current === null ? null : Math.max(0, required - current), needsDropDetails: false,
    };
  }

  // Watch rewards that can be earned now: unclaimed, free, open by the campaign's and their own dates, not done,
  // prerequisites met.
  function earnableRewards(campaign, { state, now }) {
    const drops = plannerDrops(campaign);
    return drops.filter(drop => {
      if (drop?.self?.isClaimed || requiresSubscription(drop)) return false;
      const required = Number(drop?.requiredMinutesWatched || 0);
      const current = knownNumber(drop?.self?.currentMinutesWatched);
      if (required <= 0 || !state(campaign, drop, now).open) return false;
      if (current !== null && current >= required) return false;
      return DropperActiveViewing.planPrerequisites(drop, drops).ready;
    }).map(drop => rewardTarget(campaign, drop));
  }

  function strategyOf(value) {
    const strategy = cleanText(value).toLowerCase();
    return CAMPAIGN_STRATEGIES.includes(strategy) ? strategy : 'priority';
  }
  // Campaign Order: the shared ranking (priority, then the active game, deadline, margin, progress), re-sorted
  // for the other strategies. Rewards that cannot finish always go last.
  function rankRewards(candidates, { strategy = 'priority', priorityOf = () => 0, now, activeGame = '' } = {}) {
    const base = DropperActiveViewing.rankCampaignCandidates(candidates, { priorityOf, now, activeGame });
    const chosen = strategyOf(strategy);
    if (chosen === 'priority') return base;
    const original = new Map(base.map((item, index) => [item, index]));
    const remaining = item => { const value = Number(item?.sequenceRemainingMinutes ?? item?.remainingMinutes); return Number.isFinite(value) ? value : FAR_FUTURE; };
    const deadline = item => { const value = Number(item?.endMs); return Number.isFinite(value) ? value : FAR_FUTURE; };
    const completion = item => { const value = Number(item?.percent); return Number.isFinite(value) && item?.percent != null ? Math.max(0, Math.min(100, value)) : item?.sequenceInProgress ? 0.5 : 0; };
    const unfinishable = item => item?.sequenceFinishable === false ? 1 : 0;
    return [...base].sort((a, b) => {
      const feasible = unfinishable(a) - unfinishable(b);
      if (feasible) return feasible;
      if (chosen === 'deadline') { const delta = deadline(a) - deadline(b); if (delta) return delta; }
      if (chosen === 'completion') { const delta = completion(b) - completion(a) || remaining(a) - remaining(b); if (delta) return delta; }
      if (chosen === 'shortest') { const delta = remaining(a) - remaining(b); if (delta) return delta; }
      if (b.sequencePriority !== a.sequencePriority) return b.sequencePriority - a.sequencePriority;
      return (original.get(a) || 0) - (original.get(b) || 0);
    });
  }

  const sameTarget = (pick, target) => Boolean(pick && target && (
    (cleanText(pick.campaignKey || pick.campaignId) && cleanText(pick.campaignKey || pick.campaignId).toLowerCase() === cleanText(target.campaignKey || target.campaignId).toLowerCase())
    || (pick.id && target.id && String(pick.id) === String(target.id))));

  // One pass of 3.x's open-campaign pick. Campaigns whose rewards are not loaded yet (Twitch's dashboard often
  // omits them) are queued as shells by their end date; a shell with under 15 usable minutes yields to anything
  // else. Unwinnable rewards yield when a winnable one exists.
  function pickOnce(campaigns, { state, now, skip, rank, current, preferCurrent }) {
    const candidates = [];
    for (const campaign of campaigns || []) {
      const key = campaignKey(campaign);
      if (skip.has(key) || !plannerGame(campaign) || !state(campaign, null, now).open) continue;
      if (watchDropsComplete(campaign)) continue;
      const rewards = earnableRewards(campaign, { state, now });
      if (rewards.length) { candidates.push(...rewards); continue; }
      // Only a campaign without reward rows (or whose rewards Twitch has not sent yet) becomes a shell; one whose
      // rewards are all paid or waiting on a prerequisite has nothing to earn.
      if (plannerDrops(campaign).length && !campaign.nativeRewardsPending) continue;
      candidates.push(rewardTarget(campaign));
    }
    const incomplete = candidates.filter(item => !rewardComplete(item));
    const shellSafe = incomplete.filter(item => {
      if (!item.needsDropDetails) return true;
      const endMs = Number(item.endMs || 0);
      if (!Number.isFinite(endMs) || endMs <= 0 || endMs >= FAR_FUTURE / 2) return true;
      return endMs - now - WINNABLE_BUFFER_MS >= SHELL_MIN_WINDOW_MS;
    });
    const pool = shellSafe.length ? shellSafe : incomplete;
    const winnable = pool.filter(item => fitsWindow(item, now));
    const ranked = rank(winnable.length ? winnable : pool);
    const keepCurrent = preferCurrent && current && !current.isClaimed && !current.needsDropDetails && !rewardComplete(current) && fitsWindow(current, now);
    return (keepCurrent && ranked.find(item => sameTarget(item, current))) || ranked[0] || null;
  }

  // The next reward to earn. Skips excluded and deferred campaign keys, shells whose details came back empty
  // recently (`detailsMissed`), and rewards that cannot finish. With preferCurrent, an unfinished winnable current
  // target is kept. Returns { next, excluded } so the caller can keep skipped keys out of later picks.
  function pickReward(campaigns, { state, now, rank = items => items, current = null, preferCurrent = true, excludedKeys = [], deferredKeys = [], detailsMissed = () => false } = {}) {
    const excluded = new Set(excludedKeys.map(key => cleanText(key).toLowerCase()).filter(Boolean));
    const missed = new Set(deferredKeys.map(key => cleanText(key).toLowerCase()).filter(Boolean));
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const next = pickOnce(campaigns, { state, now, skip: new Set([...excluded, ...missed]), rank, current, preferCurrent });
      if (!next) break;
      const key = cleanText(next.campaignKey || next.campaignId).toLowerCase();
      if (campaignIsExcluded(next) || (!next.needsDropDetails && !fitsWindow(next, now))) { if (key) excluded.add(key); continue; }
      if (next.needsDropDetails && key && detailsMissed(key)) { missed.add(key); continue; }
      return { next, excluded: [...excluded] };
    }
    return { next: null, excluded: [...excluded] };
  }

  // After a reward reaches full watch time: the next reward in the same campaign, if one can finish. The finished
  // reward counts as watched for prerequisites without being marked claimed.
  function nextInCampaign(campaigns, finished, { state, now }) {
    const wantedGame = cleanText(finished?.game).toLowerCase();
    const wantedKey = cleanText(finished?.campaignKey || finished?.campaignId).toLowerCase();
    if (!wantedGame) return null;
    const options = [];
    for (const campaign of campaigns || []) {
      if ((wantedKey && campaignKey(campaign) !== wantedKey) || plannerGame(campaign).toLowerCase() !== wantedGame) continue;
      if (!state(campaign, null, now).open) continue;
      const drops = plannerDrops(campaign).map(drop => {
        const required = Number(drop?.requiredMinutesWatched) || 0, current = Number(drop?.self?.currentMinutesWatched) || 0;
        const justFinished = finished.id ? drop?.id === finished.id : cleanText(drop?.name).toLowerCase() === cleanText(finished.name).toLowerCase() && current >= required;
        return justFinished ? { ...drop, self: { ...(drop.self || {}), isClaimed: Boolean(drop.self?.isClaimed), currentMinutesWatched: Math.max(current, required) } } : drop;
      });
      options.push(...earnableRewards({ ...campaign, timeBasedDrops: drops }, { state, now }));
    }
    const earning = options.filter(item => !rewardComplete(item));
    const winnable = earning.filter(item => fitsWindow(item, now));
    const pool = winnable.length ? winnable : earning;
    const left = item => Number.isFinite(item.remainingMinutes) ? item.remainingMinutes : Infinity;
    pool.sort((a, b) => (b.currentMinutes > 0) - (a.currentMinutes > 0) || (left(a) === left(b) ? 0 : left(a) - left(b)));
    const next = pool[0] || null;
    return next && fitsWindow(next, now) ? next : null;
  }

  // The selected reward as it is now in the campaign list (fresh progress), or null when it is gone.
  function findReward(campaigns, target) {
    const key = cleanText(target?.campaignKey || target?.campaignId).toLowerCase();
    if (!key) return null;
    for (const campaign of campaigns || []) {
      if (campaignKey(campaign) !== key && cleanText(campaign?.id).toLowerCase() !== key) continue;
      if (!target.id) return { ...rewardTarget(campaign), campaignObject: campaign };
      const drop = plannerDrops(campaign).find(item => String(item?.id || '') === String(target.id));
      return drop ? { ...rewardTarget(campaign, drop), campaignObject: campaign, drop } : null;
    }
    // The same campaign under another key shape (a row first seen without its id): the selected reward in a
    // campaign of the same game keeps the lock (3.x preserveLockedCampaignIdentity).
    if (target.id && target.game) {
      for (const campaign of campaigns || []) {
        if (!gameNamesMatch(plannerGame(campaign), target.game)) continue;
        const drop = plannerDrops(campaign).find(item => String(item?.id || '') === String(target.id));
        if (drop) return { ...rewardTarget(campaign, drop), campaignObject: campaign, drop };
      }
    }
    return null;
  }

  // The open campaigns in Campaign Order, one entry per campaign (the menu's queue). Page rows without an end
  // date are left out: they would never expire.
  function campaignQueue(campaigns, { state, now, rank = items => items }) {
    const byKey = new Map();
    for (const campaign of campaigns || []) {
      const key = campaignKey(campaign), game = plannerGame(campaign);
      if (!key || !game || !state(campaign, null, now).open || watchDropsComplete(campaign)) continue;
      const endMs = parseTime(campaign?.endAt);
      if (/^page:/i.test(key) && !endMs) continue;
      const prior = byKey.get(key);
      if (prior && prior.endMs <= (endMs || FAR_FUTURE)) continue;
      const sequence = DropperActiveViewing.campaignSequence(campaign, now);
      byKey.set(key, {
        key, id: campaign?.id || '', name: cleanText(campaign?.name) || game, game, startAt: campaign?.startAt || '', endAt: campaign?.endAt || '',
        endMs: endMs || FAR_FUTURE, campaign, sequenceRemainingMinutes: sequence.remainingMinutes, sequenceFinishable: sequence.finishable,
        sequenceMarginMinutes: sequence.marginMinutes, sequenceInProgress: sequence.inProgress, pendingClaims: sequence.pendingClaims,
      });
    }
    return rank([...byKey.values()]);
  }

  // The channels a campaign is limited to (empty when it is not limited).
  function allowedChannels(campaign) {
    const allow = campaign?.allow;
    if (!allow || allow.isEnabled === false || !Array.isArray(allow.channels)) return [];
    const seen = new Set();
    return allow.channels.map(channel => ({ id: cleanText(channel?.id), login: cleanText(channel?.login || channel?.name).toLowerCase(), displayName: cleanText(channel?.displayName || channel?.name || channel?.login) }))
      .filter(channel => channel.login && !seen.has(channel.login) && seen.add(channel.login));
  }

  // How strong a stream candidate's evidence is (0 best): live and allowed by the campaign, live and Drops-tagged,
  // live in the game, then campaign hints and fresh cache.
  function streamEvidence(candidate) {
    const live = candidate?.availability === 'live' || candidate?.visibleInCategory === true;
    const hint = candidate?.availability === 'campaign-hint' || candidate?.source === 'campaign-hint';
    const freshCached = candidate?.freshCached === true;
    const acl = candidate?.allowListMatch === true || candidate?.aclMatched === true || candidate?.campaignAclMatched === true;
    const drops = candidate?.dropsTagged === true;
    const [rank, label] = live && acl ? [0, 'live-campaign-allowed'] : live && drops ? [1, 'live-drops-tagged'] : live ? [2, 'live-same-game']
      : hint && acl ? [3, 'campaign-hint-allowed'] : hint && drops ? [4, 'campaign-hint'] : freshCached && acl ? [5, 'fresh-cache-allowed']
        : freshCached && drops ? [6, 'fresh-cache-drops'] : [7, 'stale-cache'];
    return { rank, label, live, acl, drops, hint, freshCached };
  }

  function shuffled(items, random) {
    const list = [...items];
    for (let index = list.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(random() * (index + 1));
      [list[index], list[swap]] = [list[swap], list[index]];
    }
    return list;
  }

  // Orders the streams visible in the game's category. Excluded channels are dropped. Drops-tagged streams come
  // first, each group shuffled (3.x's default "Any Eligible"), then a stable sort by evidence. When the campaign is
  // limited to channels, only those are routable; temporarily skipped (failed) channels are not routable.
  function classifyStreams(streams, { excluded = [], skipped = [], allowed = [], now, random = Math.random } = {}) {
    const excludedSet = new Set(excluded.map(login => cleanText(login).toLowerCase()));
    const skippedSet = new Set(skipped.map(login => cleanText(login).toLowerCase()).filter(Boolean));
    const allowedSet = new Set(allowed.map(channel => cleanText(channel?.login ?? channel).toLowerCase()).filter(Boolean));
    const limited = allowedSet.size > 0;
    const usable = (streams || []).filter(item => !excludedSet.has(cleanText(item?.login || item?.broadcasterLogin).toLowerCase()));
    const ordered = [...shuffled(usable.filter(item => item.dropsTagged), random), ...shuffled(usable.filter(item => !item.dropsTagged), random)];
    const visible = ordered.map(item => {
      const login = cleanText(item.login).toLowerCase();
      const allowListMatch = Boolean(login && allowedSet.has(login));
      const temporarilySkipped = Boolean(login && skippedSet.has(login));
      const campaignCompatible = !limited || allowListMatch;
      const reason = temporarilySkipped ? 'temporary-skip' : allowListMatch ? 'campaign-allow-list-match' : limited ? 'campaign-allow-list-mismatch' : item.dropsTagged === true ? 'drops-tagged' : 'same-game-probationary';
      return { ...item, login, seenAt: Number(item.seenAt || now), visibleInCategory: true, allowListMatch, dropsTagged: item.dropsTagged === true, temporarilySkipped, campaignCompatible, routable: !temporarilySkipped && campaignCompatible, reason };
    }).map((item, index) => ({ item, index, evidence: streamEvidence(item) }))
      .sort((a, b) => a.evidence.rank - b.evidence.rank || a.index - b.index)
      .map(({ item, evidence }) => ({ ...item, evidenceRank: evidence.rank, evidenceLabel: evidence.label }));
    return { limited, visible, compatible: visible.filter(item => item.campaignCompatible), routable: visible.filter(item => item.routable) };
  }

  // The only state machine: idle → select → find-stream → open-stream → verify → earning, plus waiting and paused.
  // It alone navigates, through its own guard. Claims run beside it and never block it (3.x's claim state had done
  // nothing since 3.1.11). Inputs are injected: the campaign list, the page reader, the clock and navigation.
  // The built-in rule replaces 3.x's six backup-stream settings: when the stream stops earning (offline, another
  // category, credit stalled) Dropper moves on.
  const CONTROLLER_VERSION = 1;
  const CONTROLLER_STATES = Object.freeze({ IDLE: 'idle', SELECT: 'select', FIND: 'find-stream', OPEN: 'open-stream', VERIFY: 'verify', EARNING: 'earning', WAITING: 'waiting', PAUSED: 'paused' });
  const CONTROLLER_TIMING = Object.freeze({
    navigation: 30 * 1000, verify: 90 * 1000, firstCredit: 6 * 60 * 1000, waitRetry: 30 * 1000, noCampaignRetry: 60 * 1000,
    offlineGrace: 60 * 1000, categoryGrace: 15 * 1000, settle: 15 * 1000, finalPoll: 15 * 1000, stallRecheck: 30 * 1000,
    healthyDelayed: 5 * 60 * 1000, healthyStalled: 6 * 60 * 1000, unhealthyDelayed: 90 * 1000, unhealthyStalled: 2 * 60 * 1000,
    firstWatchGrace: 90 * 1000, sessionFresh: 90 * 1000, staleSession: 6 * 60 * 60 * 1000,
    creditAttemptTtl: 30 * 60 * 1000, creditDefer: 15 * 60 * 1000, discoveryDefer: 5 * 60 * 1000, discoveryLimit: 2 * 60 * 1000,
    inFlight: 20 * 1000, guardWindow: 60 * 1000, guardLimit: 6, guardCooldown: 90 * 1000, recoveryWindow: 5 * 60 * 1000,
  });
  const HOLD_TEXT = Object.freeze({
    'site-paused': 'Paused on this site', 'protected-channel': 'Protected channel', 'stream-locked': 'Staying on this stream',
    'viewer-paused': 'Playback paused', 'manual-stream': 'Your stream is selected', 'switching-off': 'Automatic stream switching is off',
    'recovery-paused': 'Recovery paused · Resume from System', 'browsing-tab': 'Automatic switching is off in this tab', 'earning-now': 'Current stream is earning',
  });
  const TRUSTED_TWITCH = /^https:\/\/(?:www\.)?twitch\.tv\//i;

  function controllerDefaults(state = CONTROLLER_STATES.IDLE, at = 0) {
    return {
      version: CONTROLLER_VERSION, state, enteredAt: at, updatedAt: at, deadlineAt: 0, target: null, stream: '', slug: '',
      failed: [], excluded: [], deferred: {}, creditAttempts: {}, discoveryStartedAt: 0, evidence: null,
      baseline: { minutes: null, percent: null }, firstCreditWindow: false, earningStartedAt: 0, verification: null,
      mismatchSince: 0, offlineSince: 0, waitReason: '', waitingFor: '', reason: '', recovery: { stage: 0, startedAt: 0, lastCheckAt: 0 },
      flight: null, guard: { events: [], blockedUntil: 0 }, finalPollFor: '',
    };
  }

  function createController({
    store, campaigns, data, page, intent, settings = () => store.settings(), navigate, requestPoll = () => {}, inCharge = () => true,
    sitePaused = () => false, switchingTab = () => true, manualLock = () => null, slugFor = target => target?.gameSlug || '', now = Date.now, random = Math.random, log = () => {},
  } = {}) {
    let status = '';
    // The last earning-health diagnosis, for the card label (not saved).
    let diagnosis = '';
    const lower = value => cleanText(value).toLowerCase();
    const setStatus = text => { status = cleanText(text); };
    const login = () => lower(page.login());
    const stateOf = (campaign, reward, at) => campaigns.state(campaign, reward, at);
    const pool = () => data.campaigns() || [];
    const rank = at => items => rankRewards(items, { strategy: settings().campaignStrategy, priorityOf: campaigns.priorityScorer(), now: at, activeGame: read().target?.game || '' });
    const keyOf = target => lower(target?.campaignKey || target?.campaignId);
    const active = (map, at) => Object.fromEntries(Object.entries(map || {}).filter(([, until]) => Number(until) > at));

    // State lives in this tab's session storage, like 3.x's routing session (a new key; 3.x's is left alone).
    function read() {
      const raw = store.session.get('controller', null);
      if (!raw || raw.version !== CONTROLLER_VERSION || !Object.values(CONTROLLER_STATES).includes(raw.state)) return controllerDefaults(CONTROLLER_STATES.IDLE, now());
      if (raw.updatedAt && now() - Number(raw.updatedAt) > CONTROLLER_TIMING.staleSession) { store.session.remove('controller'); return controllerDefaults(CONTROLLER_STATES.IDLE, now()); }
      return { ...controllerDefaults(raw.state, now()), ...raw };
    }
    function write(next) {
      const value = { ...next, version: CONTROLLER_VERSION, updatedAt: now() };
      store.session.set('controller', value);
      return value;
    }
    function go(state, patch = {}, reason = '') {
      const previous = read(), at = now(), changed = previous.state !== state;
      const holdsWait = state === CONTROLLER_STATES.WAITING || state === CONTROLLER_STATES.PAUSED;
      const next = write({
        ...previous, ...patch, state,
        enteredAt: changed ? at : previous.enteredAt || at,
        deadlineAt: 'deadlineAt' in patch ? Number(patch.deadlineAt || 0) : changed ? 0 : previous.deadlineAt,
        // The first-credit extension belongs to one verification of one stream.
        firstCreditWindow: 'firstCreditWindow' in patch ? Boolean(patch.firstCreditWindow) : Boolean(!changed && previous.firstCreditWindow && lower(previous.stream) === lower(patch.stream ?? previous.stream)),
        waitReason: 'waitReason' in patch ? cleanText(patch.waitReason) : holdsWait ? previous.waitReason : '',
        reason: reason || previous.reason,
      });
      if (changed || reason) log('routing-controller', reason || `${previous.state} → ${state}`, { from: previous.state, to: state, game: next.target?.game || null, stream: next.stream || null });
      return next;
    }
    const failedWith = (session, channel) => [...new Set([...(session.failed || []), lower(channel)].filter(Boolean))];
    const baselineOf = target => ({ minutes: target?.currentMinutes ?? null, percent: target?.percent ?? null });
    function adopt(target) {
      store.session.remove('creditedProgressAt');
      const { campaignObject, drop, ...plain } = target || {};
      return plain;
    }

    // The selected reward with fresh progress. A later actual minute (not a first observation) stamps credit.
    function refreshTarget(session) {
      if (!session.target) return session;
      const fresh = findReward(pool(), session.target);
      if (!fresh) return session;
      const { campaignObject, drop, ...plain } = fresh;
      // A poll that omits the artwork does not erase the known image of the same reward.
      if (session.target.id === plain.id && !plain.rewardImage && session.target.rewardImage) plain.rewardImage = session.target.rewardImage;
      // A lower reading for the same reward (session 21, then inventory 20) keeps the higher credit (3.x applyDrop).
      if (session.target.id === plain.id && Number(session.target.currentMinutes) > Number(plain.currentMinutes)) plain.currentMinutes = session.target.currentMinutes;
      const before = Number(session.target.currentMinutes), after = Number(plain.currentMinutes);
      const credited = session.target.id === plain.id && session.target.currentMinutes != null && plain.currentMinutes != null && after > before;
      if (credited) store.session.set('creditedProgressAt', now());
      // New credit for the earning reward confirms the stream again; the original verification time stays (3.x).
      const proof = session.verification;
      const verification = credited && session.state === CONTROLLER_STATES.EARNING && proof && proof.dropId === plain.id ? { ...proof, progressConfirmed: true, progressConfirmedAt: now() } : proof;
      const changed = verification !== proof || JSON.stringify({ ...session.target, ...plain }) !== JSON.stringify(session.target);
      return changed ? write({ ...session, verification, target: { ...session.target, ...plain } }) : session;
    }
    const targetCampaign = target => findReward(pool(), { campaignKey: target?.campaignKey || target?.campaignId })?.campaignObject || null;
    // The target's campaign as the open rule sees it: the listed campaign, or one rebuilt from the stored target.
    const campaignFor = target => targetCampaign(target) || { id: target?.campaignId || target?.campaignKey || '', name: target?.campaign || '', game: { displayName: target?.game || '', slug: target?.gameSlug || '' }, startAt: target?.campaignStartAt || '', endAt: target?.campaignEndAt || '' };

    // Channels the target campaign is limited to. A new page can list a campaign before its details arrive, so
    // the last known list for this campaign (and only this campaign) is kept.
    function targetAllowList(target) {
      const key = keyOf(target);
      if (!key) return [];
      const campaign = targetCampaign(target);
      if (campaign && campaign.allow && Array.isArray(campaign.allow.channels) && (campaign.allow.channels.length || campaign.allow.isEnabled === false)) {
        const channels = allowedChannels(campaign);
        store.session.set('campaignRestrictions', { campaignKey: key, channels });
        return channels;
      }
      const known = store.session.get('campaignRestrictions', null);
      return lower(known?.campaignKey) === key && Array.isArray(known.channels) ? known.channels : [];
    }

    // What holds automatic switching, in 3.x's order. A stream-order change also respects "switch only when not
    // earning". Returns '' when switching may go ahead.
    function holdReason(reason = '') {
      if (sitePaused()) return 'site-paused';
      if (!switchingTab()) return 'browsing-tab';
      const channel = login();
      if (channel && (settings().protectedChannels || []).map(lower).includes(channel)) return 'protected-channel';
      if (reason === 'campaign-order-changed' && settings().switchPolicy === 'stopped-earning' && earningConfirmed()) return 'earning-now';
      if (manualLock()) return 'stream-locked';
      if (intent && !intent.navigationAllowed(false)) return intent.snapshot().paused ? 'viewer-paused' : 'manual-stream';
      return '';
    }
    function earningConfirmed(at = now()) {
      const session = read(), proof = session.verification;
      return Boolean(session.target?.id && proof?.progressConfirmed && proof.dropId === session.target.id && lower(proof.channel) === login()
        && lower(proof.campaignKey) === keyOf(session.target) && at >= proof.at && at - Math.max(proof.at, Number(proof.progressConfirmedAt) || 0) < CONTROLLER_TIMING.healthyDelayed);
    }

    // Recovery pause (kept key, so System's Resume carries over): three recovery moves in five minutes, the
    // fourth suspends. A move counts as recovery when its reason says so or a stream has already failed.
    function recoveryState(at = now()) {
      const value = store.session.get('recoveryLoop', { events: [], suspended: false });
      return { events: (Array.isArray(value?.events) ? value.events : []).filter(time => Number.isFinite(time) && time > at - CONTROLLER_TIMING.recoveryWindow).slice(-3), suspended: Boolean(value?.suspended) };
    }
    function recoveryAllows(reason, session, at) {
      if (/manual|update-install/i.test(reason)) return true;
      const loop = recoveryState(at);
      if (loop.suspended) return false;
      if (!/recover|retry|fallback|restart|stall/i.test(reason) && !(session.failed || []).length) return true;
      if (loop.events.length >= 3) {
        store.session.set('recoveryLoop', { ...loop, suspended: true });
        log('recovery-paused', 'Recovery paused after three navigations within five minutes');
        return false;
      }
      store.session.set('recoveryLoop', { events: [...loop.events, at], suspended: false });
      return true;
    }
    function resumeRecovery() {
      if (sitePaused() || intent?.snapshot().paused) return false;
      store.session.set('recoveryLoop', { events: [], suspended: false });
      log('recovery-resumed', 'Recovery resumed from System');
      return true;
    }

    // The navigation guard: one move in flight at a time (20 s), at most six moves a minute (then 90 s off), and a
    // fresh stream page settles for 15 s first.
    function inFlight(session, at) {
      const flight = session.flight;
      if (!flight?.target) return false;
      if (page.locationKey() === flight.target || Number(flight.expiresAt) <= at) { write({ ...session, flight: null }); return false; }
      return true;
    }
    function move(url, reason, { manual = false } = {}) {
      let session = read();
      const at = now();
      if (!url || !TRUSTED_TWITCH.test(url) || page.locationKey() === locationKeyOf(url)) return false;
      if (!manual && (!inCharge() || holdReason(reason))) return false;
      if (inFlight(session, at)) return false;
      const events = (session.guard?.events || []).filter(time => time > at - CONTROLLER_TIMING.guardWindow);
      if (Number(session.guard?.blockedUntil || 0) > at) { setStatus(`Auto-switch paused · Reload loop protection ${Math.ceil((session.guard.blockedUntil - at) / 1000)}s`); return false; }
      if (!manual && page.login() && at - page.startedAt < CONTROLLER_TIMING.settle) return false;
      if (events.length + 1 > CONTROLLER_TIMING.guardLimit) {
        write({ ...session, guard: { events: [...events, at], blockedUntil: at + CONTROLLER_TIMING.guardCooldown } });
        log('navigation-guard', 'Automatic routing paused to stop a reload loop', { reason });
        setStatus('Auto-switch paused · Reload loop protection');
        return false;
      }
      if (!recoveryAllows(reason, session, at)) {
        go(CONTROLLER_STATES.PAUSED, { stream: '', waitReason: 'recovery-paused', deadlineAt: 0 }, 'Recovery paused after repeated stream changes');
        setStatus(HOLD_TEXT['recovery-paused']);
        return false;
      }
      session = read();
      write({ ...session, guard: { events: [...events, at], blockedUntil: 0 }, flight: { target: locationKeyOf(url), reason, expiresAt: at + CONTROLLER_TIMING.inFlight } });
      log('navigation', 'Automatic Twitch navigation', { reason, to: url });
      navigate(url, reason);
      return true;
    }

    function bootstrap(reason) {
      const session = read(), target = session.target, at = now();
      if (!settings().findNextStream) return go(CONTROLLER_STATES.PAUSED, { waitReason: 'switching-off' }, 'Automatic stream routing disabled');
      if (!target || target.isClaimed || !stateOf(campaignFor(target), null, at).open) return go(CONTROLLER_STATES.SELECT, {}, reason);
      if (rewardComplete(target)) return advance(target, reason);
      if (Number(session.deferred?.[keyOf(target)]) > at) return select(at);
      return verifyCurrentChannel(target, at, reason) || go(CONTROLLER_STATES.FIND, { stream: '', failed: [], evidence: null }, reason);
    }
    // On start, a live channel already showing the saved target's game is verified where it is, unless the viewer
    // excluded it or the campaign is limited to other channels (the filters category discovery applies).
    function verifyCurrentChannel(target, at, reason) {
      const channel = login(), info = channel ? page.stream() : null;
      if (!channel || !info?.live || !info.game || !gameNamesMatch(target.game, info.game)) return null;
      if ((settings().excludedChannels || []).map(lower).includes(channel)) return null;
      const allowed = targetAllowList(target);
      if (allowed.length && !allowed.some(item => lower(item?.login ?? item) === channel)) return null;
      return go(CONTROLLER_STATES.VERIFY, {
        stream: channel, evidence: { source: 'current-channel', dropsTagged: Boolean(info.dropsEnabled), game: info.game, seenAt: at },
        baseline: baselineOf(target), deadlineAt: at + CONTROLLER_TIMING.verify, mismatchSince: 0, offlineSince: 0,
      }, `${reason} · verifying current same-game channel`);
    }

    // The selected reward is evicted when it is claimed, closed, completed, excluded or can no longer finish
    // while another reward can. A deferred target goes back to selection.
    function reconcile(at) {
      let session = read();
      const target = session.target;
      if (!target) return false;
      if (target.isClaimed) {
        go(CONTROLLER_STATES.SELECT, { target: null, stream: '', evidence: null, waitReason: '' }, 'Twitch confirms the selected reward was already claimed · selecting next reward');
        return true;
      }
      if (rewardComplete(target)) return false;
      const key = keyOf(target);
      const fresh = findReward(pool(), target);
      const current = stateOf(fresh?.campaignObject || campaignFor(target), fresh?.drop || null, at);
      let reason = '';
      if (!current.open) reason = `Campaign ${target.campaign || target.game} is not routable · ${current.reason}`;
      else if (campaignIsExcluded(target)) reason = `Campaign ${target.campaign || target.game} is excluded`;
      else if (!fitsWindow(target, at)) {
        const replacement = pickReward(pool(), { state: stateOf, now: at, rank: rank(at), excludedKeys: [key], preferCurrent: false }).next;
        if (replacement && fitsWindow(replacement, at)) reason = `Campaign ${target.campaign || target.game} can no longer finish before its deadline`;
      }
      if (!reason) {
        if (Number(session.deferred?.[key]) > at && !(session.state === CONTROLLER_STATES.WAITING && session.waitReason === 'reward-credit-unconfirmed')) { select(at); return true; }
        return false;
      }
      log('routing-target-evicted', reason, { campaignKey: key, state: session.state });
      go(CONTROLLER_STATES.SELECT, { target: null, slug: '', stream: '', failed: [], excluded: [...new Set([...(session.excluded || []), key])], evidence: null, waitReason: '', flight: null }, reason);
      setStatus('Previous campaign ended · Selecting next eligible campaign');
      return true;
    }

    function pickNext(session, at, preferCurrent = true) {
      return pickReward(pool(), { state: stateOf, now: at, rank: rank(at), current: session.target, preferCurrent, excludedKeys: session.excluded || [], deferredKeys: Object.keys(active(session.deferred, at)), detailsMissed: key => Boolean(data.detailsMissed?.(key)) });
    }

    function select(at = now()) {
      const session = read(), target = session.target, key = keyOf(target);
      const retryAt = Number(session.deferred?.[key]) || 0;
      if (target && !target.isClaimed && rewardComplete(target)) return advance(target, 'Completed Drop already has full watch credit');
      if (target && !target.isClaimed && !campaignIsExcluded(target) && retryAt <= at && stateOf(campaignFor(target), null, at).open && fitsWindow(target, at)) {
        return go(CONTROLLER_STATES.FIND, { stream: '', failed: [], deadlineAt: 0 }, 'Continuing active unfinished campaign');
      }
      const { next, excluded } = pickNext(session, at);
      if (!next) {
        if (target && !target.isClaimed && retryAt > at) {
          const creditCooldown = Number(session.creditAttempts?.[key]?.count) >= 3;
          return go(CONTROLLER_STATES.WAITING, { stream: login() || session.stream, waitReason: creditCooldown ? 'reward-credit-unconfirmed' : 'no-eligible-campaign', deadlineAt: retryAt }, 'Campaign deferred · keeping current stream open until cooldown ends');
        }
        requestPoll('routing-no-campaign');
        return go(CONTROLLER_STATES.WAITING, { target: null, stream: '', excluded, waitReason: 'no-eligible-campaign', deadlineAt: at + CONTROLLER_TIMING.noCampaignRetry }, 'No eligible watch-time campaign available');
      }
      if (next.needsDropDetails || !(Number(next.requiredMinutes) > 0)) {
        requestPoll('routing-campaign-details');
        return go(CONTROLLER_STATES.WAITING, { excluded, waitingFor: next.campaignKey, waitReason: 'campaign-details', deadlineAt: at + CONTROLLER_TIMING.waitRetry }, `Waiting for Drop details for ${next.campaign || next.game}`);
      }
      return go(CONTROLLER_STATES.FIND, { target: adopt(next), discoveryStartedAt: at, failed: [], excluded, stream: '', evidence: null, waitReason: '', waitingFor: '', deadlineAt: 0 }, `Selected ${next.campaign || next.game}`);
    }

    // Full watch time: the next reward in the same campaign if one can finish, otherwise a new selection.
    function advance(finished, reason) {
      const at = now();
      campaigns.remember(pool(), 'watch-progress-complete');
      const next = nextInCampaign(pool(), finished, { state: stateOf, now: at });
      requestPoll(next ? 'drop-earned-next-drop' : 'drop-earned-next-campaign');
      if (next) {
        go(CONTROLLER_STATES.FIND, { target: adopt(next), stream: '', failed: [], evidence: null, waitReason: '', deadlineAt: 0 }, `${finished.name || 'Drop'} earned · continuing ${finished.campaign || finished.game || 'campaign'}`);
        setStatus(`${finished.name || 'Drop'} Earned · Next Drop: ${next.name || 'Drop'}`);
        return true;
      }
      go(CONTROLLER_STATES.SELECT, { target: null, completed: { game: finished.game, name: finished.name, id: finished.id, campaignKey: finished.campaignKey }, stream: '', failed: [], evidence: null, waitReason: '', deadlineAt: 0 }, `${finished.name || 'Drop'} earned · selecting next eligible campaign`);
      setStatus(`${finished.name || 'Drop'} Earned · Selecting next campaign`);
      return true;
    }

    function findStream(at, { manual = false } = {}) {
      const session = read(), target = session.target;
      if (!target || target.isClaimed || rewardComplete(target)) return bootstrap('Active Drop changed while finding a stream');
      if (!session.discoveryStartedAt) write({ ...session, discoveryStartedAt: at });
      const slug = slugFor(target);
      if (!target.game || !slug) {
        requestPoll('routing-category-missing');
        return go(CONTROLLER_STATES.WAITING, { waitReason: 'category-unresolved', deadlineAt: at + CONTROLLER_TIMING.waitRetry }, 'Waiting for a verified Twitch category route');
      }
      if (page.category() !== slug) {
        const url = `https://www.twitch.tv/directory/category/${encodeURIComponent(slug)}`;
        go(CONTROLLER_STATES.FIND, { slug, deadlineAt: at + CONTROLLER_TIMING.navigation }, `Opening ${target.game} category`);
        move(url, manual ? 'manual-stream-skip' : 'routing-find-category', { manual });
        return true;
      }
      const allowed = targetAllowList(target);
      const streams = classifyStreams(page.streams(), { excluded: settings().excludedChannels || [], skipped: session.failed, allowed, now: at, random });
      const candidate = streams.routable[0];
      if (!candidate) {
        if (session.failed.length && streams.compatible.length) {
          log('stream-rotation-reset', 'All visible eligible streamers were tried; clearing temporary rotation', { tried: session.failed });
          setStatus(`All visible ${target.game} Streams checked · Retrying shortly`);
          return go(CONTROLLER_STATES.WAITING, { slug, stream: '', failed: [], evidence: null, waitReason: 'stream-cycle-reset', deadlineAt: at + CONTROLLER_TIMING.waitRetry }, `Cleared temporary streamer rotation after trying ${session.failed.length} stream${session.failed.length === 1 ? '' : 's'}`);
        }
        setStatus(allowed.length ? `Waiting for a live ${target.campaign || target.game} Stream` : `Waiting on ${target.game} Category for an eligible stream`);
        return go(CONTROLLER_STATES.WAITING, { slug, stream: '', evidence: null, waitReason: allowed.length ? 'no-live-allowed-channel' : 'no-category-stream', deadlineAt: at + CONTROLLER_TIMING.waitRetry },
          allowed.length ? `No live allow-listed ${target.campaign || target.game} stream visible yet` : `No usable ${target.game} stream visible yet`);
      }
      const acl = candidate.allowListMatch, tagged = candidate.dropsTagged;
      go(CONTROLLER_STATES.OPEN, {
        slug, stream: candidate.login, baseline: baselineOf(target), deadlineAt: at + CONTROLLER_TIMING.navigation,
        evidence: { source: acl ? 'campaign-acl' : 'category', dropsTagged: tagged, campaignAclMatched: acl, campaignAllowListPresent: allowed.length > 0, campaignAllowListMatch: acl, evidenceRank: candidate.evidenceRank, evidenceLabel: candidate.evidenceLabel, game: target.game, seenAt: at },
      }, acl ? `Opening campaign-allowed stream ${candidate.login}` : tagged ? `Opening Drops-tagged stream ${candidate.login} for campaign verification` : `Opening category stream ${candidate.login} for Drop verification`);
      setStatus(acl ? `Opening ${candidate.login} For ${target.campaign || target.game}` : tagged ? `Opening ${candidate.login} · Verifying ${target.game} Campaign` : `Opening ${candidate.login} · Verifying Drops eligibility`);
      move(candidate.href, manual ? 'manual-stream-skip' : acl ? 'routing-open-campaign-acl-stream' : tagged ? 'routing-open-drops-verification-stream' : 'routing-open-probationary-stream', { manual });
      return true;
    }

    function openStream(at) {
      const session = read(), channel = login(), target = lower(session.stream);
      if (channel && channel === target) {
        requestPoll('routing-stream-arrival', true);
        return go(CONTROLLER_STATES.VERIFY, { deadlineAt: at + CONTROLLER_TIMING.verify, mismatchSince: 0, offlineSince: 0, finalPollFor: '' }, `Arrived at ${channel} · verifying stream`);
      }
      if (session.deadlineAt && at >= session.deadlineAt) {
        return go(CONTROLLER_STATES.FIND, { failed: failedWith(session, target), stream: '', evidence: null, deadlineAt: 0 }, `Could not reach ${target || 'target stream'} · returning to category`);
      }
      setStatus(`Opening ${session.stream || 'Drops stream'}…`);
      return false;
    }

    // Fresh limits revoke stale allow-list proof; missing limits leave it alone.
    function syncAllowList(session, channel) {
      const evidence = session.evidence;
      if (!evidence || !session.target) return session;
      const allowed = targetAllowList(session.target).map(item => item.login);
      const present = allowed.length > 0, match = Boolean(present && channel && allowed.includes(channel));
      const rejected = Boolean(channel) && evidence.campaignAclMatched === true && present && !match;
      if (evidence.campaignAllowListPresent === present && evidence.campaignAllowListMatch === match && !rejected) return session;
      return write({ ...session, evidence: { ...evidence, campaignAllowListPresent: present, campaignAllowListMatch: match, ...(rejected ? { campaignAclMatched: false } : {}) } });
    }

    // After three uncredited first-credit windows for one campaign (within 30 minutes), it is deferred for 15.
    function creditDeadline(session, channel, at) {
      const key = keyOf(session.target);
      if (!key) return false;
      const attempts = Object.fromEntries(Object.entries(session.creditAttempts || {}).filter(([, entry]) => entry && Number(entry.expiresAt) > at).slice(-19));
      const count = Math.min(3, (Number(attempts[key]?.count) || 0) + 1);
      attempts[key] = { count, expiresAt: at + CONTROLLER_TIMING.creditAttemptTtl };
      session = write({ ...session, creditAttempts: attempts });
      if (count < 3) return false;
      const retryAt = at + CONTROLLER_TIMING.creditDefer;
      attempts[key].expiresAt = retryAt;
      const patch = { creditAttempts: attempts, deferred: { ...active(session.deferred, at), [key]: retryAt }, discoveryStartedAt: 0, mismatchSince: 0, recovery: { stage: 0, startedAt: 0, lastCheckAt: 0 } };
      const { next, excluded } = pickNext({ ...session, ...patch }, at, false);
      if (next) return go(CONTROLLER_STATES.SELECT, { ...patch, excluded, stream: '', evidence: null, waitReason: '', deadlineAt: 0 }, 'Reward credit unconfirmed after three stream attempts · deferring campaign for 15 minutes');
      return go(CONTROLLER_STATES.WAITING, { ...patch, waitReason: 'reward-credit-unconfirmed', deadlineAt: retryAt }, `Reward credit unconfirmed · keeping ${channel || session.stream || 'current stream'} open for a 15-minute cooldown`);
    }

    function verify(at) {
      let session = read();
      const channel = login(), target = lower(session.stream), info = page.stream(), targetReward = session.target;
      session = syncAllowList(session, channel || target);
      const gameMatches = Boolean(info.game && targetReward?.game && gameNamesMatch(targetReward.game, info.game));
      if (channel && target && channel !== target) {
        if (session.deadlineAt && at >= session.deadlineAt) return go(CONTROLLER_STATES.FIND, { failed: failedWith(session, target), stream: '', deadlineAt: 0 }, 'Verification route changed before target stream stabilized');
        return false;
      }
      if (at - page.startedAt < CONTROLLER_TIMING.settle) { setStatus(`Loading ${target || channel || targetReward?.game} Before verification…`); return false; }
      if (info.game && !gameMatches) {
        const since = session.mismatchSince || at;
        if (!session.mismatchSince) session = write({ ...session, mismatchSince: since });
        if (at - since >= CONTROLLER_TIMING.categoryGrace) return go(CONTROLLER_STATES.FIND, { failed: failedWith(session, target || channel), stream: '', evidence: null, mismatchSince: 0, deadlineAt: 0 }, `Rejected ${target || channel || 'stream'} · category is ${info.game}`);
        setStatus(`Verifying ${targetReward?.game} · Twitch still shows ${info.game}`);
        return false;
      }
      // The first known observation can be historical progress: it becomes the baseline, never proof.
      const minutes = targetReward?.currentMinutes ?? null, percent = targetReward?.percent ?? null;
      const identity = Boolean(channel && channel === target);
      if (identity && ((session.baseline.minutes == null && minutes != null) || (session.baseline.percent == null && percent != null))) {
        session = write({ ...session, baseline: { minutes: session.baseline.minutes ?? minutes, percent: session.baseline.percent ?? percent } });
      }
      const progressProof = identity && ((session.baseline.minutes != null && minutes != null && Number(minutes) > Number(session.baseline.minutes))
        || (session.baseline.percent != null && percent != null && Number(percent) > Number(session.baseline.percent)));
      const evidence = session.evidence || {};
      const campaignProof = Boolean(evidence.campaignAclMatched || evidence.gqlCampaignSupported);
      const sessionProof = Boolean(evidence.gqlSessionDropMatched && evidence.gqlSessionIdentityLevel === 'exact-drop');
      if (info.live && gameMatches && (sessionProof || progressProof)) {
        const key = keyOf(targetReward);
        const without = map => Object.fromEntries(Object.entries(map || {}).filter(([entry]) => entry !== key));
        return go(CONTROLLER_STATES.EARNING, {
          earningStartedAt: at, deadlineAt: 0, mismatchSince: 0, offlineSince: 0, baseline: baselineOf(targetReward), recovery: { stage: 0, startedAt: 0, lastCheckAt: 0 },
          evidence: { ...evidence, campaignVerified: campaignProof || sessionProof, verifiedChannel: channel || target, creditedProgressVerified: progressProof, verifiedAt: at },
          verification: { at, method: progressProof ? 'credited-progress' : 'session-drop-match', channel: channel || target, dropId: targetReward?.id || '', campaignKey: key, progressConfirmed: progressProof, sessionMatched: sessionProof, campaignSupported: campaignProof || sessionProof },
          creditAttempts: without(session.creditAttempts), deferred: without(session.deferred),
        }, `Verified earning on ${channel || target} for ${targetReward?.campaign || targetReward?.game}`);
      }
      // Campaign support proves eligibility, not earning: an eligible live stream waits for Twitch's first credit.
      if (campaignProof && info.live && gameMatches && session.deadlineAt && !session.firstCreditWindow) {
        session = write({ ...session, firstCreditWindow: true, deadlineAt: Math.max(session.deadlineAt, (session.enteredAt || at) + CONTROLLER_TIMING.firstCredit) });
      }
      const remaining = session.deadlineAt ? Math.max(0, session.deadlineAt - at) : 0;
      if (session.deadlineAt && remaining > 0 && remaining <= CONTROLLER_TIMING.finalPoll && session.finalPollFor !== (target || channel)) {
        write({ ...session, finalPollFor: target || channel });
        requestPoll('routing-final-verification', true);
        setStatus(`Verifying ${target || channel || targetReward?.game} · Final Twitch check`);
        return false;
      }
      if (session.deadlineAt && at >= session.deadlineAt) {
        if (campaignProof && info.live && gameMatches) {
          if (creditDeadline(session, target || channel, at)) return true;
          session = read();
        }
        return go(CONTROLLER_STATES.FIND, { failed: failedWith(session, target || channel), stream: '', evidence: null, mismatchSince: 0, deadlineAt: 0 }, `Verification deadline expired for ${target || channel || 'stream'}`);
      }
      setStatus(campaignProof && info.live && gameMatches ? `Eligible ${target || channel || 'Drops stream'} · ${creditLabel(session, at)}`
        : (evidence.dropsTagged || info.dropsEnabled) ? `Verifying ${target || channel || 'Drops stream'} · Waiting for campaign proof` : `Verifying ${target || channel || 'Drops stream'} For ${targetReward?.game}`);
      return false;
    }
    function creditLabel(session, at) {
      const poll = data.session?.() || null;
      const fresh = poll && lower(poll.channel) === lower(session.stream) && poll.at <= at && at - poll.at <= CONTROLLER_TIMING.sessionFresh;
      if (!fresh) return 'Waiting for reward session';
      return { unidentified: 'Reward session unidentified', inactive: 'No active reward session', absent: 'Reward session missing', 'shape-changed': 'Reward session format unrecognized' }[poll.responseStatus]
        || (['error', 'unavailable', 'partial-response'].includes(poll.responseStatus) ? 'Reward session check unavailable' : poll.identityLevel === 'exact-drop' ? 'Waiting for Twitch credit' : 'Reward session does not match selected Drop');
    }

    // Earning: the built-in move-on rule. Offline for a minute, another category for 15 seconds, or no new
    // credit for 6 minutes (2 when the stream looks unhealthy) followed by two 30-second Twitch rechecks.
    function earning(at) {
      let session = read();
      const target = session.target;
      if (!target || target.isClaimed) return go(CONTROLLER_STATES.SELECT, {}, 'Current Drop claimed or cleared');
      if (rewardComplete(target)) return advance(target, 'Earning reached 100%');
      const channel = login(), info = page.stream();
      session = syncAllowList(session, channel);
      const allowed = targetAllowList(target).map(item => item.login);
      const verified = Boolean(session.evidence?.verifiedChannel && channel === lower(session.evidence.verifiedChannel) && session.evidence.campaignVerified === true);
      if (allowed.length && channel && !allowed.includes(channel) && !verified) {
        return go(CONTROLLER_STATES.FIND, { failed: failedWith(session, channel), stream: '', evidence: null, deadlineAt: 0 }, `Verified session invalidated · ${channel} is not verified for ${target.campaign || target.game}`);
      }
      if (!channel || !info.live) {
        const since = session.offlineSince || at;
        if (!session.offlineSince) session = write({ ...session, offlineSince: since });
        if (at - since >= CONTROLLER_TIMING.offlineGrace) return go(CONTROLLER_STATES.FIND, { failed: failedWith(session, session.stream || channel), stream: '', offlineSince: 0, deadlineAt: 0 }, 'Verified stream went offline');
        setStatus(`Waiting for ${session.stream || target.game} Stream to recover`);
        return false;
      }
      const gameMatches = Boolean(info.game && gameNamesMatch(target.game, info.game));
      if (info.game && !gameMatches) {
        const since = session.mismatchSince || at;
        if (!session.mismatchSince) session = write({ ...session, mismatchSince: since });
        if (at - since >= CONTROLLER_TIMING.categoryGrace) return go(CONTROLLER_STATES.FIND, { failed: failedWith(session, channel), stream: '', mismatchSince: 0, deadlineAt: 0 }, `${channel} changed category from ${target.game} to ${info.game}`);
        setStatus(`Category changed to ${info.game} · Confirming before switching`);
        return false;
      }
      if (session.offlineSince || session.mismatchSince) session = write({ ...session, offlineSince: 0, mismatchSince: 0 });

      const health = page.health?.() || {};
      const creditedAt = Number(store.session.get('creditedProgressAt', 0)) || 0;
      const creditedRecently = Boolean(creditedAt && Number(target.currentMinutes || 0) > 0 && at - creditedAt <= CONTROLLER_TIMING.unhealthyDelayed);
      const healthy = Boolean((info.live && health.playing && gameMatches) || creditedRecently);
      const anchor = Math.max(session.earningStartedAt || session.enteredAt || 0, creditedAt);
      const diagnosis = DropperActiveViewing.recoveryDiagnosis({
        login: channel, live: true, gameMatches, playback: health.playback || 'unknown', pauseReason: health.pauseReason || '',
        visibilityState: health.visibilityState, pictureInPicture: health.pictureInPicture, backgrounded: health.backgrounded,
        foregroundGraceRemainingMs: health.foregroundGraceRemainingMs, campaignVerified: true,
        inVerificationGrace: at - (session.earningStartedAt || session.enteredAt || at) < CONTROLLER_TIMING.firstWatchGrace,
        progressAgeMs: anchor ? at - anchor : 0,
      }, healthy ? { delayedMs: CONTROLLER_TIMING.healthyDelayed, stalledMs: CONTROLLER_TIMING.healthyStalled } : { delayedMs: CONTROLLER_TIMING.unhealthyDelayed, stalledMs: CONTROLLER_TIMING.unhealthyStalled });
      diagnosisCode(diagnosis.code);
      const resetRecovery = { stage: 0, startedAt: 0, lastCheckAt: 0 };
      if (diagnosis.code !== 'credit-stalled' && session.recovery?.stage) session = write({ ...session, recovery: resetRecovery });
      if (diagnosis.code === 'playback-stopped' || diagnosis.code === 'playback-error') {
        return go(CONTROLLER_STATES.FIND, { failed: failedWith(session, channel), stream: '', recovery: resetRecovery, deadlineAt: 0 }, `Playback stopped on ${channel}`);
      }
      const holding = { 'credit-delayed-background': `Twitch credit delayed in background · Holding ${channel}`, 'foreground-revalidation-grace': 'Browser active again · Rechecking Twitch credit', 'credit-delayed': `Twitch credit delayed · Holding ${channel}`, buffering: `Playback buffering · Holding ${channel}` }[diagnosis.code];
      if (holding) { setStatus(holding); return false; }
      const stallMs = healthy ? CONTROLLER_TIMING.healthyStalled : CONTROLLER_TIMING.unhealthyStalled;
      if (diagnosis.code === 'credit-stalled' && anchor && at - anchor >= stallMs) {
        const stage = Number(session.recovery?.stage || 0);
        if (!stage) {
          requestPoll('stall-recovery-recheck', true);
          write({ ...session, recovery: { stage: 1, startedAt: at, lastCheckAt: at } });
          setStatus('Credit stalled · Rechecking Twitch before switching');
          return false;
        }
        if (stage === 1 && at - Number(session.recovery.startedAt || at) >= CONTROLLER_TIMING.stallRecheck) {
          requestPoll('stall-recovery-final-check', true);
          write({ ...session, recovery: { ...session.recovery, stage: 2, lastCheckAt: at } });
          setStatus('Credit still stalled · Final Twitch check');
          return false;
        }
        if (stage < 2 || at - Number(session.recovery.lastCheckAt || at) < CONTROLLER_TIMING.stallRecheck) return false;
        return go(CONTROLLER_STATES.FIND, { failed: failedWith(session, channel), stream: '', recovery: resetRecovery, deadlineAt: 0 }, `No credited progress from ${channel} after two Twitch rechecks`);
      }
      setStatus(target.currentMinutes == null ? `Earning ${target.name || 'Drop'} on ${channel}` : `Earning ${target.name || 'Drop'} · ${target.currentMinutes}/${target.requiredMinutes} min`);
      return false;
    }

    // A campaign whose streams stayed unavailable for two minutes of discovery yields for five, when another exists.
    function deferUnavailable(session, at) {
      if (!['no-category-stream', 'no-live-allowed-channel'].includes(session.waitReason)) return false;
      const key = keyOf(session.target), startedAt = Number(session.discoveryStartedAt || 0);
      if (!key || !startedAt || at - startedAt < CONTROLLER_TIMING.discoveryLimit) return false;
      const deferred = { ...active(session.deferred, at), [key]: at + CONTROLLER_TIMING.discoveryDefer };
      const { next, excluded } = pickNext({ ...session, deferred }, at, false);
      if (!next) return false;
      setStatus('No compatible stream found · Trying another campaign');
      return go(CONTROLLER_STATES.SELECT, { deferred, discoveryStartedAt: 0, excluded, stream: '', evidence: null, waitReason: '', deadlineAt: 0 }, `Temporarily deferred ${session.target.campaign || session.target.game} after stream discovery; selecting another campaign`);
    }

    function waiting(at) {
      let session = read();
      const target = session.target;
      if (session.waitReason === 'reward-credit-unconfirmed') {
        const minutes = target?.currentMinutes ?? null, percent = target?.percent ?? null;
        if ((session.baseline.minutes == null && minutes != null) || (session.baseline.percent == null && percent != null)) {
          session = write({ ...session, baseline: { minutes: session.baseline.minutes ?? minutes, percent: session.baseline.percent ?? percent } });
        }
        const advanced = (session.baseline.minutes != null && minutes != null && Number(minutes) > Number(session.baseline.minutes))
          || (session.baseline.percent != null && percent != null && Number(percent) > Number(session.baseline.percent));
        if (advanced || session.evidence?.gqlSessionDropMatched === true) return verify(at);
        if (at < Number(session.deadlineAt || 0)) { setStatus('Reward credit unconfirmed · Keeping current stream open during cooldown'); return false; }
        return go(CONTROLLER_STATES.SELECT, { waitReason: '', deadlineAt: 0, stream: '', evidence: null }, 'Reward-credit cooldown ended · checking campaigns again');
      }
      if (['no-category-stream', 'no-live-allowed-channel'].includes(session.waitReason)) {
        const slug = slugFor(target);
        if (slug && page.category() === slug) {
          const streams = classifyStreams(page.streams(), { excluded: settings().excludedChannels || [], skipped: session.failed, allowed: targetAllowList(target), now: at, random });
          if (streams.routable.length) {
            go(CONTROLLER_STATES.FIND, { waitReason: '', deadlineAt: 0 }, `Twitch rendered ${streams.routable.length} usable ${target?.game || 'category'} stream candidate${streams.routable.length === 1 ? '' : 's'}`);
            return findStream(at);
          }
        }
        setStatus(session.waitReason === 'no-live-allowed-channel' ? `Waiting for a live campaign-compatible ${target?.game || 'Target'} Stream` : `Waiting for ${target?.game || 'Target'} Category streams to render`);
      } else if (session.waitReason === 'stream-cycle-reset') setStatus(`All visible ${target?.game || 'Target'} Streams checked · Retry pending`);
      if (!session.deadlineAt || at < session.deadlineAt) return false;
      const deferred = deferUnavailable(session, at);
      if (deferred) return deferred;
      if (['no-category-stream', 'no-live-allowed-channel', 'stream-cycle-reset', 'category-unresolved'].includes(session.waitReason)) return go(CONTROLLER_STATES.FIND, { waitReason: '', deadlineAt: 0 }, 'Retrying stream discovery');
      requestPoll('routing-wait-retry');
      return go(CONTROLLER_STATES.SELECT, { waitReason: '', deadlineAt: 0 }, 'Retrying campaign selection');
    }

    // One step. Only the tab in charge acts; others observe.
    function tick(reason = 'heartbeat') {
      const at = now();
      if (recoveryState(at).suspended) { setStatus(HOLD_TEXT['recovery-paused']); return false; }
      if (!inCharge()) return false;
      let session = read();
      if (!settings().findNextStream) {
        if (session.state !== CONTROLLER_STATES.PAUSED || session.waitReason !== 'switching-off') go(CONTROLLER_STATES.PAUSED, { waitReason: 'switching-off', deadlineAt: 0 }, 'Automatic stream routing disabled');
        setStatus(HOLD_TEXT['switching-off']);
        return false;
      }
      const hold = holdReason(reason);
      if (hold) {
        const viewing = intent?.snapshot() || {};
        // Playback stopped by the browser in a hidden tab is not the viewer's pause: hold without a transition.
        if (viewing.paused && viewing.pauseReason !== 'viewer' && page.hidden?.()) return false;
        if (session.state !== CONTROLLER_STATES.PAUSED || session.waitReason !== hold || session.evidence || session.stream) {
          go(CONTROLLER_STATES.PAUSED, { waitReason: hold, stream: '', evidence: null, deadlineAt: 0, mismatchSince: 0, offlineSince: 0 }, HOLD_TEXT[hold]);
        }
        setStatus(HOLD_TEXT[hold]);
        return false;
      }
      session = refreshTarget(session);
      if (reconcile(at)) return true;
      session = read();
      if ([CONTROLLER_STATES.IDLE, CONTROLLER_STATES.PAUSED].includes(session.state)) session = bootstrap(reason);
      if (inFlight(session, at)) return true;
      switch (session.state) {
        case CONTROLLER_STATES.SELECT: return select(at);
        case CONTROLLER_STATES.FIND: return findStream(at);
        case CONTROLLER_STATES.OPEN: return openStream(at);
        case CONTROLLER_STATES.VERIFY: return verify(at);
        case CONTROLLER_STATES.EARNING: return earning(at);
        case CONTROLLER_STATES.WAITING: return waiting(at);
        default: return false;
      }
    }

    // Twitch evidence for the stream being verified or earned, from a poll: campaigns this channel supports and
    // the current reward session. Campaign support records eligibility only; the exact reward proves earning.
    function observe({ channel, available = null, session: rewardSession = null } = {}) {
      const session = read(), target = session.target, stream = lower(session.stream), channelLogin = lower(channel);
      if (!target || !channelLogin || channelLogin !== stream || !stateOf(campaignFor(target), null, now()).open) return false;
      const sessionGame = !rewardSession || !target.game || gameNamesMatch(target.game, rewardSession.game || '');
      const campaignMatch = Boolean(rewardSession && sessionGame && keyOf(target) && lower(rewardSession.campaignKey || rewardSession.campaignId) === keyOf(target));
      const dropMatch = Boolean(rewardSession && sessionGame && target.id && cleanText(rewardSession.id) === cleanText(target.id));
      if (session.state === CONTROLLER_STATES.EARNING) {
        if (!campaignMatch || !dropMatch) return false;
        write({ ...session, evidence: { ...(session.evidence || {}), gqlCampaignSupported: true, gqlSessionMatched: true, gqlSessionCampaignMatched: true, gqlSessionDropMatched: true, gqlSessionIdentityLevel: 'exact-drop', gqlEvidenceAt: now() } });
        return true;
      }
      if (session.state !== CONTROLLER_STATES.VERIFY) return false;
      const supported = Array.isArray(available) && available.length ? available.some(item => stateOf(item, null, now()).open && (campaignKey(item) === keyOf(target) || lower(item?.id) === keyOf(target))) : null;
      if (supported !== true && !campaignMatch && !dropMatch) return false;
      const level = dropMatch ? 'exact-drop' : campaignMatch ? (target.id && rewardSession?.id ? 'campaign-only-different-drop' : 'campaign-fallback') : 'none';
      write({ ...syncAllowList(session, channelLogin), evidence: { ...(read().evidence || {}), gqlCampaignSupported: Boolean(session.evidence?.gqlCampaignSupported || supported === true), gqlSessionMatched: campaignMatch || dropMatch, gqlSessionCampaignMatched: campaignMatch, gqlSessionDropMatched: dropMatch, gqlSessionIdentityLevel: level, gqlEvidenceAt: now() } });
      log('stream-verification-evidence', dropMatch ? 'Twitch matched the selected Drop session' : campaignMatch ? 'Twitch matched the target campaign session' : 'Twitch confirmed target campaign support', { channel: channelLogin });
      return true;
    }

    // Skip streamer: the current stream joins the temporary rotation and discovery runs now (a viewer action).
    function skipStream() {
      const session = read();
      if (!session.target) return false;
      go(CONTROLLER_STATES.FIND, { failed: failedWith(session, login() || session.stream), stream: '', evidence: null, waitReason: '', deadlineAt: 0 }, 'Skip streamer');
      return findStream(now(), { manual: true });
    }
    function clearSkipped(resume = false) {
      const session = read(), cleared = [...(session.failed || [])];
      const waitingOnStreams = session.state === CONTROLLER_STATES.WAITING && ['no-category-stream', 'no-live-allowed-channel', 'stream-cycle-reset'].includes(session.waitReason);
      if (resume && waitingOnStreams) { go(CONTROLLER_STATES.FIND, { failed: [], waitReason: '', deadlineAt: 0 }, 'Skipped streamer rotation cleared manually'); tick('manual-clear'); }
      else if (cleared.length) write({ ...session, failed: [] });
      log('stream-skip-clear', 'Cleared temporary skipped streamer rotation', { cleared });
      return cleared.length;
    }

    // Campaign Order changed: leave for the new top reward straight away, within the usual limits.
    function reorder(reason = 'campaign-order-changed') {
      const none = (why = '') => ({ switched: false, why });
      if (!settings().findNextStream) return none('Automatic switching is off');
      if (!inCharge()) return none('Another tab is routing');
      const session = read(), at = now();
      if (![CONTROLLER_STATES.SELECT, CONTROLLER_STATES.FIND, CONTROLLER_STATES.OPEN, CONTROLLER_STATES.VERIFY, CONTROLLER_STATES.EARNING].includes(session.state) || !session.target || session.target.isClaimed) return none();
      const hold = holdReason(reason);
      if (hold) return none(HOLD_TEXT[hold]);
      const { next: top, excluded } = pickNext(session, at, false);
      if (!top) return none();
      if (keyOf(top) === keyOf(session.target) || (top.id && top.id === session.target.id)) return { switched: false, why: '', alreadyTop: true, game: top.game };
      if (top.needsDropDetails || !(Number(top.requiredMinutes) > 0)) return none('Reward details pending');
      const leaving = session.target.game || 'Campaign';
      go(CONTROLLER_STATES.SELECT, { target: null, stream: '', evidence: null, excluded, deadlineAt: 0 }, `Campaign order changed · moving from ${leaving} to ${top.game}`);
      tick(reason);
      return { switched: true, why: '', game: top.game, from: leaving };
    }

    function diagnosisCode(code) { diagnosis = cleanText(code); }
    const snapshot = () => { const session = read(); return { ...session, status, diagnosis: session.state === CONTROLLER_STATES.EARNING ? diagnosis : '', recoveryLoop: recoveryState() }; };
    return Object.freeze({ tick, observe, skipStream, clearSkipped, reorder, resumeRecovery, earningConfirmed, snapshot, status: () => status });
  }

  function locationKeyOf(url) {
    try { const parsed = new URL(url); return `${parsed.origin}${parsed.pathname}${parsed.search}`; } catch (_) { return ''; }
  }

  // Twitch page reading and the viewer's own playback: the only module that touches Twitch's DOM. The selectors,
  // text matchers and playback rules are 3.x's, carried over unchanged inside createPage (they were tuned against
  // live Twitch); only their inputs are injected. Removed in 4.0: picture-in-picture when away.
  const RESERVED = new Set([
    'directory', 'downloads', 'drops', 'friends', 'inventory', 'jobs', 'messages',
    'moderator', 'p', 'popout', 'prime', 'privacy', 'products', 'search', 'settings',
    'store', 'subs', 'subscriptions', 'turbo', 'user', 'videos', 'wallet',
  ]);
  const STREAMING_TOGETHER_LABEL = /^stream(?:ing)?\s+together\b/i;
  const PROMO_STARTUP_SCAN_DELAY_MS = 8 * 1000;
  const PROMO_SCAN_INTERVAL_MS = 15 * 1000;
  const MUTE_PENDING_MS = 45 * 1000;
  const FOREGROUND_REVALIDATION_GRACE_MS = 30 * 1000;
  const CATEGORY_SLUG_CACHE_KEY = 'dropper-category-slugs-v4';
  const VIEWING_INTENT_KEY = 'dropper-viewing-intent-v1';
  const VIEWING_NAVIGATION_KEY = 'dropper-viewing-navigation-v1';
  const VIEWING_SELECTION_KEY = 'dropper-viewing-selection-v1';
  const MUTE_PENDING_KEY = 'dropper-mute-pending-v1';

  function createPage({ store, session = sessionStorage, gm = null, settings: readSettings, intent, wantedGame = () => '', isAutomationTab = () => true, sitePaused = () => false, onChange = () => {}, log = () => {}, startedAt = Date.now() } = {}) {
    // 3.x's names, so the carried-over code reads as it did.
    const viewingIntent = intent;
    const logActivity = log;
    const productResetting = false;
    const PAGE_STARTED_AT = startedAt;
    const ExtraPotionsCore = { suiteSitePaused: sitePaused };
    let currentSettings = readSettings();
    const settings = new Proxy({}, { get: (_, name) => currentSettings[name] });
    const storageAccountLogin = () => store.login();
    const readSession = (key, fallback) => { try { const raw = session.getItem(store.scoped(key)); return raw == null ? fallback : JSON.parse(raw); } catch (_) { return fallback; } };
    const writeSession = (key, value) => { try { session.setItem(store.scoped(key), JSON.stringify(value)); } catch (_) {} };
    const removeSession = key => { try { session.removeItem(store.scoped(key)); } catch (_) {} };
    const GM_getValue = gm ? (key, fallback) => gm.get(key, fallback) : undefined;
    const GM_setValue = gm ? (key, value) => gm.set(key, value) : undefined;
    const refreshViewingControls = () => onChange('viewing');
    const queueClaimScan = () => onChange('claims');
    const setStatus = text => onChange('status', text);
    let viewingAccount = '';
    let viewingVideo = null;
    let videoMountedDuringPause = false;
    let viewingListenersInstalled = false;
    let recentPlaybackControl = { action: '', at: 0 };
    const playerPresentationRecovery = { attempted: false, viewerInteracted: false, lastResult: '' };
    let screenWakeLock = null;
    let wakeLockPending = false;
    let suppressedSubscriptionPromoCount = 0;
    let lastPromoScanAt = 0;
    let browserBackgroundSince = 0;
    let browserForegroundRestoredAt = 0;
    let categorySlugCache = {};

    function resetViewingAccount(account) {
      viewingAccount = account;
      viewingVideo = null;
      videoMountedDuringPause = false;
      recentPlaybackControl = { action: '', at: 0 };
    }

    function watchingLogin() {
      const parts = location.pathname.split("/").filter(Boolean);
      if (!parts.length || RESERVED.has(parts[0].toLowerCase())) return "";
      return parts[0].toLowerCase();
    }

    function isTrustedTwitchUrl(url) {
      try {
        const parsed = new URL(url, location.href);
        const host = parsed.hostname.toLowerCase();
        return parsed.protocol === "https:" && (host === "twitch.tv" || host === "www.twitch.tv" || host === "player.twitch.tv" || host === "embed.twitch.tv" || host.endsWith(".twitch.tv"));
      } catch (_) {
        return false;
      }
    }

    function twitchChannelHref(url) {
      if (!isTrustedTwitchUrl(url)) return "";
      try {
        const parsed = new URL(url, location.href);
        const parts = parsed.pathname.split("/").filter(Boolean);
        if (parts.length !== 1) return "";
        const login = parts[0].toLowerCase();
        if (!login || RESERVED.has(login)) return "";
        return parsed.href;
      } catch (_) {
        return "";
      }
    }

    function streamLoginFromUrl(url) {
      const href = twitchChannelHref(url);
      if (!href) return "";
      try {
        return new URL(href).pathname.split("/").filter(Boolean)[0]?.toLowerCase() || "";
      } catch (_) {
        return "";
      }
    }

    function currentDirectorySlug() {
      const match = location.pathname.match(/^\/directory\/category\/([^/?#]+)/i);
      return match ? decodeURIComponent(match[1]).toLowerCase() : "";
    }

    function isDirectoryCategoryPage() {
      return location.pathname.toLowerCase().startsWith("/directory/category/");
    }

    function streamViewerCount(value) {
      if (value === null || value === undefined || value === "") return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
    }

    function normalizedGameSlug(value) {
      return cleanText(value)
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/['’ʼ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    }

    function categorySlugFromUrl(url) {
      try {
        const parsed = new URL(url, location.href);
        const host = parsed.hostname.toLowerCase();
        if (
          parsed.protocol !== "https:" ||
          !(host === "twitch.tv" || host === "www.twitch.tv" || host.endsWith(".twitch.tv"))
        ) return "";
        const match = parsed.pathname.match(/^\/directory\/category\/([^/?#]+)/i);
        return match ? decodeURIComponent(match[1]).toLowerCase() : "";
      } catch (_) {
        return "";
      }
    }

    function loadCategorySlugCache() {
      try {
        const parsed = JSON.parse(localStorage.getItem(CATEGORY_SLUG_CACHE_KEY) || "{}");
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
        let changed = false;
        for (const [game, slug] of Object.entries(parsed)) {
          if (EXCLUDED_CAMPAIGN_NAMES.has(normalizeGameName(game)) || EXCLUDED_CATEGORY_SLUGS.has(normalizedGameSlug(slug))) {
            delete parsed[game];
            changed = true;
          }
        }
        if (changed && !productResetting) localStorage.setItem(CATEGORY_SLUG_CACHE_KEY, JSON.stringify(parsed));
        return parsed;
      } catch (_) {
        return {};
      }
    }

    function saveCategorySlugCache() {
      if (productResetting) return;
      try {
        localStorage.setItem(CATEGORY_SLUG_CACHE_KEY, JSON.stringify(categorySlugCache));
      } catch (_) {
        /* ignore */
      }
    }

    function expectedCategorySlugCandidates(gameName) {
      const gameKey = normalizeGameName(gameName);
      const candidates = new Set();
      const fallback = normalizedGameSlug(gameName);
      const alias = normalizedGameSlug(CATEGORY_SLUG_ALIASES[gameKey] || "");
      if (fallback) candidates.add(fallback);
      if (alias) candidates.add(alias);
      return candidates;
    }

    function categorySlugCoversGame(gameName, slug) {
      const normalized = normalizedGameSlug(slug);
      return Boolean(normalized && expectedCategorySlugCandidates(gameName).has(normalized));
    }

    function suppliedCategorySlugMatchesGame(gameName, slugOrUrl) {
      const slug = categorySlugFromUrl(slugOrUrl) || normalizedGameSlug(slugOrUrl);
      if (!slug) return false;
      if (categorySlugCoversGame(gameName, slug)) return true;
      const learned = categorySlugCache[normalizeGameName(gameName)];
      return Boolean(learned && learned === slug);
    }

    function campaignGameSlugFallback(dropOrGame) {
      if (!dropOrGame || typeof dropOrGame !== "object") return "";
      const gameId = cleanText(dropOrGame.gameId || dropOrGame.game?.id || "");
      const gameName = cleanText(
        typeof dropOrGame.game === "string"
          ? dropOrGame.game
          : dropOrGame.game?.displayName || dropOrGame.game?.name || ""
      );
      if (!gameId || !gameName || EXCLUDED_CAMPAIGN_NAMES.has(normalizeGameName(gameName))) return "";
      const slug = normalizedGameSlug(gameName);
      return slug && !EXCLUDED_CATEGORY_SLUGS.has(slug) ? slug : "";
    }

    function rememberCategorySlug(gameName, slugOrUrl, source = "observed") {
      const gameKey = normalizeGameName(gameName);
      const slug = categorySlugFromUrl(slugOrUrl) || normalizedGameSlug(slugOrUrl);
      if (!gameKey || !slug) return "";
      if (EXCLUDED_CAMPAIGN_NAMES.has(gameKey) || EXCLUDED_CATEGORY_SLUGS.has(slug)) {
        if (categorySlugCache[gameKey]) {
          delete categorySlugCache[gameKey];
          saveCategorySlugCache();
        }
        logActivity("category-route-rejected", "Rejected excluded Twitch category", { game: gameName, slug, source });
        return "";
      }

      const trustedObservedSource = ["twitch-link", "active-stream", "canonical-alias", "twitch-gql"].includes(source);
      if (!trustedObservedSource && !suppliedCategorySlugMatchesGame(gameName, slug)) {
        logActivity("category-route-rejected", "Rejected mismatched category slug", {
          game: gameName,
          slug,
          source,
        });
        return "";
      }

      const existing = cleanText(categorySlugCache[gameKey] || "");
      if (
        existing &&
        source === "twitch-campaign-game-id" &&
        (existing === slug || existing.startsWith(`${slug}-`))
      ) {
        return existing;
      }

      if (categorySlugCache[gameKey] !== slug) {
        categorySlugCache[gameKey] = slug;
        saveCategorySlugCache();
        logActivity("category-route", `Learned category slug for ${gameName}`, {
          game: gameName,
          slug,
          source,
        });
      }
      return slug;
    }

    function findObservedCategorySlug(gameName) {
      const wanted = normalizeGameName(gameName);
      if (!wanted) return "";

      const links = [
        document.querySelector('[data-a-target="stream-game-link"]'),
        ...document.querySelectorAll('a[href*="/directory/category/"]'),
      ].filter(Boolean);

      for (const link of links) {
        const text = cleanText(
          link.textContent ||
          link.getAttribute?.("aria-label") ||
          link.getAttribute?.("title") ||
          "",
        );
        if (!text || !gameNamesMatch(gameName, text)) continue;

        const slug = categorySlugFromUrl(link.href);
        if (slug) return rememberCategorySlug(gameName, slug, "twitch-link");
      }
      return "";
    }

    function resolveCategorySlug(dropOrGame) {
      const gameName = typeof dropOrGame === "string"
        ? cleanText(dropOrGame)
        : cleanText(dropOrGame?.game || "");

      if (!gameName) return "";

      const gameKey = normalizeGameName(gameName);
      if (EXCLUDED_CAMPAIGN_NAMES.has(gameKey)) return "";

      // Known Twitch routes must win over shortened campaign slugs and cached
      // name-derived routes, otherwise the same invalid directory repeats.
      const alias = cleanText(CATEGORY_SLUG_ALIASES[gameKey] || "");
      if (alias) {
        rememberCategorySlug(gameName, alias, "canonical-alias");
        return normalizedGameSlug(alias);
      }

      // A campaign-supplied category takes precedence over links on the current
      // stream, which may belong to a different edition of the same game.
      const supplied = typeof dropOrGame === "object"
        ? cleanText(dropOrGame?.gameSlug || "")
        : "";
      if (supplied && suppliedCategorySlugMatchesGame(gameName, supplied)) {
        const resolved = normalizedGameSlug(supplied);
        if (resolved) rememberCategorySlug(gameName, resolved, "twitch-gql");
        return resolved;
      }

      const cached = normalizedGameSlug(categorySlugCache[gameKey] || "");
      if (cached && !EXCLUDED_CATEGORY_SLUGS.has(cached)) return cached;

      const observed = findObservedCategorySlug(gameName);
      if (observed) return observed;

      if (supplied) {
        logActivity("category-route-rejected", "Ignored stale supplied category slug", {
          game: gameName,
          suppliedSlug: supplied,
        });
      }

      const gameIdFallback = campaignGameSlugFallback(dropOrGame);
      if (gameIdFallback) {
        rememberCategorySlug(gameName, gameIdFallback, "twitch-campaign-game-id");
        logActivity("category-route", "Derived category slug from Twitch campaign game ID", {
          game: gameName,
          gameId: dropOrGame?.gameId || dropOrGame?.game?.id || null,
          slug: gameIdFallback,
        });
        return gameIdFallback;
      }

      // Games whose Twitch slug is the name itself (Minecraft) should not wait
      // for a directory link. Keep alias-backed names like Delta Force on the
      // canonical slug instead of inventing a shorter route.
      const derived = normalizedGameSlug(gameName);
      if (derived && !alias && !EXCLUDED_CATEGORY_SLUGS.has(derived) && categorySlugCoversGame(gameName, derived)) {
        rememberCategorySlug(gameName, derived, "normalized-name");
        return derived;
      }

      logActivity("category-route-rejected", "No verified Twitch category slug available", { game: gameName });
      return "";
    }
    function normalizeDropsMarkerText(value) {
      const text = cleanText(value);
      if (!text) return "";
      try {
        return text
          .normalize("NFKD")
          .replace(/\p{M}+/gu, "")
          .toLowerCase()
          .replace(/[^\p{L}\p{N}]+/gu, " ")
          .trim();
      } catch (_) {
        return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      }
    }

    function textLooksLikeDropsMarker(value) {
      const normalized = normalizeDropsMarkerText(value);
      if (!normalized || normalized.length > 48) return false;
      // "Drops" is Twitch's product name in localized UI. The status word after it
      // may be translated, so accept one or two short words after Drop/Drops.
      return /^drops?(?:\s+[\p{L}\p{N}-]+){0,2}$/u.test(normalized);
    }

    function elementLooksLikeDropsMarker(node) {
      if (!node || node.nodeType !== 1) return false;
      const attrs = [
        node.getAttribute?.("data-a-target"),
        node.getAttribute?.("data-test-selector"),
        node.getAttribute?.("aria-label"),
        node.getAttribute?.("href"),
      ].filter(Boolean).join(" ");
      if (/drop/i.test(attrs)) return true;

      const text = cleanText(node.textContent);
      if (!textLooksLikeDropsMarker(text)) return false;

      const tagName = String(node.tagName || "").toLowerCase();
      if (tagName === "a" || tagName === "button") return true;
      if (node.getAttribute?.("role") === "button" || node.getAttribute?.("role") === "link") return true;

      const markerAncestor = node.closest?.(
        'a[href*="/tags/" i], a[href*="/directory/all/tags/" i], [data-a-target*="tag" i], [data-test-selector*="tag" i], [aria-label*="tag" i]',
      );
      if (markerAncestor) return true;

      // Twitch sometimes renders tags as simple leaf spans/divs with no stable tag
      // attribute. Only allow the short, standalone label itself, never card/title text.
      return !node.children?.length && text.length <= 48;
    }

    function streamHasDropsEnabledTag(root = null) {
      const scope = root || document.querySelector("#live-channel-stream-information");
      if (!scope) return false;
      if (scope.querySelector?.(
        '[data-a-target*="drop" i], [data-test-selector*="drop" i], [aria-label*="drop" i], a[href*="/tags/" i][href*="drop" i], a[href*="/directory/all/tags/" i][href*="drop" i]',
      )) return true;
      for (const node of scope.querySelectorAll?.("a, span, p, div, button, [role='button'], [role='link']") || []) {
        if (elementLooksLikeDropsMarker(node)) return true;
      }
      return false;
    }

    function readStreamInfo() {
      const root = document.querySelector("#live-channel-stream-information");
      const login = watchingLogin();
      if (!root || !login) {
        return {
          channelName: login || "",
          title: "",
          game: "",
          gameSlug: "",
          gameCategoryUrl: "",
          viewers: "",
          uptime: "",
          dropsEnabled: false,
          live: false,
        };
      }
      const channelName = cleanText(root.querySelector("h1.tw-title, h1")?.textContent) || login;
      const title = cleanText(document.querySelector('[data-a-target="stream-title"]')?.textContent);
      // A Streaming Together session can show the collaboration label and every
      // participant's category. The label is not a game, and the stream belongs
      // to the target game when any shown category matches it.
      const gameLinks = [...new Set([
        ...document.querySelectorAll('[data-a-target="stream-game-link"]'),
        ...root.querySelectorAll('a[href*="/directory/category/"], a[href*="/directory/game/"]'),
      ])]
        .map((link) => ({ name: cleanText(link.textContent), href: link.href || "" }))
        .filter((link) => link.name && !STREAMING_TOGETHER_LABEL.test(link.name));
      const wanted = cleanText(wantedGame());
      const gameLink = (wanted && gameLinks.find((link) => gameNamesMatch(wanted, link.name))) || gameLinks[0] || null;
      const game = gameLink?.name || "";
      const games = [...new Set(gameLinks.map((link) => link.name))];
      const gameCategoryUrl = gameLink?.href || "";
      const gameSlug = categorySlugFromUrl(gameCategoryUrl);
      if (game && gameSlug) rememberCategorySlug(game, gameSlug, "active-stream");
      const viewers = cleanText(document.querySelector('[data-a-target="animated-channel-viewers-count"]')?.textContent);
      const uptime = cleanText(document.querySelector('.live-time span[aria-hidden="true"]')?.textContent);
      const dropsEnabled = streamHasDropsEnabledTag(root);
      const live = Boolean(root.querySelector('.tw-channel-status-text-indicator, [class*="ChannelStatusTextIndicator"]')) || /\bLIVE\b/i.test(root.textContent || "");
      return { channelName, title, game, games, gameSlug, gameCategoryUrl, viewers, uptime, dropsEnabled, live };
    }

    function closestDirectoryStreamCard(link) {
      if (!link) return null;

      const direct = link.closest(
        'article, [role="listitem"], li, [data-a-target*="preview-card"], [data-test-selector*="preview-card"], [class*="preview-card"]',
      );
      if (direct && streamHasDropsEnabledTag(direct)) return direct;

      let node = link.parentElement;
      let best = direct || node;
      for (let depth = 0; node && depth < 9; depth += 1, node = node.parentElement) {
        if (node.matches?.('main, [role="main"]')) break;

        const channelLinks = node.querySelectorAll?.(
          'a[data-a-target="preview-card-channel-link"][href], a[data-test-selector*="channel-link"][href]',
        ) || [];
        if (channelLinks.length !== 1) continue;

        const hasCategory = Boolean(node.querySelector?.(
          'a[href*="/directory/category/"], a[href*="/directory/game/"]',
        ));
        const text = cleanText(node.textContent || "");
        const hasLiveSignal = Boolean(
          node.querySelector?.('[data-a-target*="live"], [data-test-selector*="live"], [aria-label*="Live" i]') ||
          /\bLIVE\b/i.test(text) ||
          /[\d,.]+\s*(?:viewers?|watching)\b/i.test(text)
        );
        const hasDropsSignal = streamHasDropsEnabledTag(node);

        if (hasCategory || hasLiveSignal || hasDropsSignal) best = node;
        if (hasDropsSignal && hasLiveSignal) return node;
      }
      return best || link.parentElement;
    }

    function streamCandidateIsPromoted(card, link = null) {
      const promotedSelector = [
        '.side-nav-card__link--promoted-followed',
        '[data-a-target*="promoted" i]',
        '[data-a-target*="sponsored" i]',
        '[data-a-target*="advertisement" i]',
        '[data-test-selector*="promoted" i]',
        '[data-test-selector*="sponsored" i]',
        '[data-test-selector*="advertisement" i]',
        '[class*="promoted" i]',
        '[class*="sponsored" i]',
        '[class*="advertisement" i]',
      ].join(",");

      if (link?.matches?.(promotedSelector) || link?.closest?.(promotedSelector)) return true;
      if (card?.matches?.(promotedSelector) || card?.querySelector?.(promotedSelector)) return true;

      const badgeNodes = card?.querySelectorAll?.(
        '[aria-label], [title], [data-a-target], [data-test-selector], span, p, div'
      ) || [];
      for (const node of badgeNodes) {
        if (node.children?.length) continue;
        const label = cleanText(
          node.getAttribute?.("aria-label") ||
          node.getAttribute?.("title") ||
          node.textContent ||
          ""
        );
        if (/^(?:sponsored|promoted|advertisement|ad)$/i.test(label)) return true;
      }
      return false;
    }

    function collectDirectoryStreamCandidates(gameName, gameSlug = "", excludedStreams = []) {
      const wantedGame = normalizeGameName(gameName);
      const wantedSlug = resolveCategorySlug({ game: gameName, gameSlug });
      const pageSlug = currentDirectorySlug();
      const pageIsTargetCategory = Boolean(
        isDirectoryCategoryPage() &&
        wantedSlug &&
        (pageSlug === wantedSlug || pageSlug.includes(wantedSlug) || wantedSlug.includes(pageSlug))
      );
      const excluded = new Set(
        (excludedStreams || []).map((login) => cleanText(login).toLowerCase()).filter(Boolean),
      );
      const candidates = [];
      const seen = new Set();
      const scanAt = Date.now();

      const links = [
        ...document.querySelectorAll(
          'a[data-a-target="preview-card-channel-link"], a[data-test-selector*="channel-link"]',
        ),
      ];

      for (const link of links) {
        const href = twitchChannelHref(link.href);
        if (!href) continue;
        const login = streamLoginFromUrl(href);
        if (!login || excluded.has(login) || seen.has(login)) continue;
        seen.add(login);

        const card = closestDirectoryStreamCard(link);

        if (streamCandidateIsPromoted(card, link)) {
          logActivity("stream-candidate-rejected", "Ignored promoted or sponsored Twitch placement", {
            stream: login,
            game: gameName || null,
            source: "category",
          });
          continue;
        }

        const text = cleanText(card?.textContent);
        const normalizedText = normalizeGameName(text);
        const hasDropsTag = streamHasDropsEnabledTag(card);

        const gameMatches =
          pageIsTargetCategory ||
          !wantedGame ||
          !normalizedText ||
          normalizedText.includes(wantedGame);

        if (!gameMatches) continue;
        const viewerMatch = text.match(/([\d,.]+)\s*(?:viewers?|watching)/i);
        const viewers = viewerMatch ? streamViewerCount(viewerMatch[1].replace(/,/g, "")) : null;
        candidates.push({
          login,
          href,
          label: login,
          viewers,
          dropsTagged: hasDropsTag,
          game: gameName,
          gameSlug: wantedSlug,
          seenAt: scanAt,
          visibleInCategory: true,
        });
      }

      // Ordering is the planner's (classifyStreams).
      return candidates;
    }
    function browserAttentionSnapshot(now = Date.now()) {
      const visibilityState = document.visibilityState || (document.hidden ? 'hidden' : 'visible');
      let documentFocused = !document.hidden;
      try {
        if (typeof document.hasFocus === 'function') documentFocused = document.hasFocus();
      } catch (_) {}
      const backgrounded = Boolean(document.hidden || !documentFocused);

      if (backgrounded) {
        if (!browserBackgroundSince) browserBackgroundSince = now;
      } else if (browserBackgroundSince) {
        browserBackgroundSince = 0;
        browserForegroundRestoredAt = now;
      }

      const foregroundGraceRemainingMs = !backgrounded && browserForegroundRestoredAt
        ? Math.max(0, FOREGROUND_REVALIDATION_GRACE_MS - (now - browserForegroundRestoredAt))
        : 0;

      return {
        visibilityState,
        documentFocused,
        backgrounded,
        backgroundSince: browserBackgroundSince,
        foregroundRestoredAt: browserForegroundRestoredAt,
        foregroundGraceRemainingMs,
      };
    }
    function muteOpenedStreamsEnabled() {
      currentSettings = readSettings(); // a stale tab sees the saved opt-out
      if (!settings.muteRestarted) writeSession(MUTE_PENDING_KEY, null);
      return Boolean(settings.muteRestarted);
    }

    function requestMuteAfterNavigation(reason = "automatic-routing") {
      if (!muteOpenedStreamsEnabled()) return;
      writeSession(MUTE_PENDING_KEY, {
        at: Date.now(),
        reason: String(reason || ""),
        expiresAt: Date.now() + MUTE_PENDING_MS,
      });
    }

    function mutePendingSnapshot(now = Date.now()) {
      const pending = readSession(MUTE_PENDING_KEY, null);
      if (!pending) return null;
      if (Number(pending.expiresAt || 0) <= now) {
        writeSession(MUTE_PENDING_KEY, null);
        return null;
      }
      return pending;
    }

    function twitchMuteControl() {
      return document.querySelector(
        '[data-a-target="player-mute-unmute-button"], button[aria-label^="Mute"], button[aria-label^="Unmute"]',
      );
    }

    function streamVideoElement() {
      return document.querySelector("video");
    }

    function playerPresentationSnapshot() {
      const video = streamVideoElement();
      const root = video?.closest('[data-a-player-state="mini"]');
      const bounds = video?.getBoundingClientRect();
      return { mode: document.fullscreenElement ? 'fullscreen' : document.pictureInPictureElement ? 'browser-pip' : root ? 'twitch-mini' : video ? 'channel' : 'missing',
        width: Math.round(bounds?.width || 0), height: Math.round(bounds?.height || 0),
        expandControl: Boolean(root?.querySelector('button[aria-label="Expand Player"]')),
        recovery: {...playerPresentationRecovery} };
    }

    function restoreChannelPlayer(explicit = false) {
      const login = watchingLogin();
      if (!login || location.pathname.toLowerCase().replace(/\/$/, '') !== '/' + login.toLowerCase()) return false;
      if (document.fullscreenElement || document.pictureInPictureElement) return false;
      if (!explicit && (!settings.restoreChannelPlayer || playerPresentationRecovery.attempted || playerPresentationRecovery.viewerInteracted || Date.now() - PAGE_STARTED_AT > 30000 || document.hidden || viewingIntent.snapshot().paused)) return false;
      const mini = streamVideoElement()?.closest('[data-a-player-state="mini"]');
      if (!mini) return false;
      // Observed in Twitch's public player UI: this control restores the anchored player.
      // It is deliberately scoped to the mini-player, not a generic expand/fullscreen button.
      const expand = mini.querySelector('button[aria-label="Expand Player"]');
      if (!expand || expand.disabled || !expand.getClientRects().length) {playerPresentationRecovery.lastResult='expand-control-unavailable';return false;}
      playerPresentationRecovery.attempted = true;
      try { expand.click(); playerPresentationRecovery.lastResult='expand-requested';
        logActivity('playback','Requested normal channel player',{reason:explicit?'user-restore-channel-player':'mini-player-on-arrival'});return true;
      } catch (_) {playerPresentationRecovery.lastResult='expand-failed';return false;}
    }

    function streamVideoIsPlaying(video = streamVideoElement()) {
      return Boolean(video && !video.paused && !video.ended && video.readyState > 1);
    }

    function ensureStreamPlaying(explicit = false) {
      if (ExtraPotionsCore.suiteSitePaused?.()) return;
      if (!watchingLogin()) return false;
      syncViewingContext();
      const video = streamVideoElement();
      if (!video || streamVideoIsPlaying(video) || video.ended || video.error || video.readyState < 1) return false;
      // Gates remain Twitch/user decisions. A paused or unknown player is never
      // interpreted as authorization to start playback or open another stream.
      if (!viewingIntent.takeRecovery(explicit)) return false;
      if (explicit) {
        videoMountedDuringPause = false;
        recentPlaybackControl = { action: 'resume', at: Date.now() };
      }
      try {
        const playing = video.play();
        logActivity('playback', 'Requested playback resume', { reason: explicit ? 'user-resume' : 'authorized-recovery' });
        if (playing && typeof playing.catch === 'function') playing.catch(() => {
          viewingIntent.pause(false);
          logActivity('playback', 'Playback resume was blocked', { reason: 'player-rejected' });
          setStatus('Playback needs attention');
          refreshViewingControls();
        });
        return true;
      } catch (_) {
        viewingIntent.pause(false);
        refreshViewingControls();
        return false;
      }
    }

    function ensureStreamMuted() {
      if (ExtraPotionsCore.suiteSitePaused?.()) return;
      if (!muteOpenedStreamsEnabled()) return false;
      const pending = mutePendingSnapshot();
      if (!pending) return false;
      if (!watchingLogin()) return false;

      const video = document.querySelector("video");
      let changed = false;
      if (video && !video.muted) {
        try {
          video.muted = true;
          changed = true;
        } catch (_) { /* ignore */ }
      }

      const button = twitchMuteControl();
      const label = cleanText(button?.getAttribute("aria-label") || button?.textContent || "").toLowerCase();
      // Twitch labels the control for the action it will take: "Mute" means currently unmuted.
      if (button && /^mute\b/.test(label)) {
        try {
          button.click();
          changed = true;
        } catch (_) { /* ignore */ }
      }

      if (video?.muted) {
        // Keep the pending window briefly so Twitch's autoplay unmute can be re-applied.
        if (Date.now() - Number(pending.at || 0) > 12000) writeSession(MUTE_PENDING_KEY, null);
      }
      if (changed) logActivity('playback', 'Muted a Dropper-opened stream', { reason: 'mute-opened-streams-enabled' });
      return changed;
    }

    async function syncScreenWakeLock() {
      const shouldHold = Boolean(settings.keepTabActive && !document.hidden && watchingLogin() && streamVideoIsPlaying() && !viewingIntent.snapshot().paused);
      if (!shouldHold) {
        const lock = screenWakeLock; screenWakeLock = null;
        try { await lock?.release(); } catch (_) {}
        return;
      }
      if (screenWakeLock || wakeLockPending || !navigator.wakeLock?.request) return;
      wakeLockPending = true;
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (settings.keepTabActive && !document.hidden && streamVideoIsPlaying() && !viewingIntent.snapshot().paused) {
          screenWakeLock = lock;
          lock.addEventListener('release', () => { if (screenWakeLock === lock) screenWakeLock = null; }, { once: true });
        } else await lock.release();
      } catch (_) { /* Unsupported or denied wake locks never affect playback. */ }
      finally { wakeLockPending = false; }
    }
    function automaticViewingArrival(login = watchingLogin(), now = Date.now()) {
      const requested = readSession(VIEWING_NAVIGATION_KEY, null);
      const selected = readSession(VIEWING_SELECTION_KEY, null);
      if (selected?.channel === login && selected.until > now) return false;
      if (requested && requested.channel === login && requested.until > now) return true;
      // A restored switching tab can outlive the short navigation marker. Keep
      // its known automatic arrival distinct from an unknown paused player.
      const saved = readSession(VIEWING_INTENT_KEY, null);
      return Boolean(login && settings.resumeSessionOnRestart && isAutomationTab() && saved &&
        saved.account === storageAccountLogin() && saved.channel === login && saved.manualStream === false && !saved.paused);
    }

    function syncViewingContext() {
      const account = storageAccountLogin();
      if (viewingAccount !== account) resetViewingAccount(account);
      const login = watchingLogin() || '';
      const automaticArrival = automaticViewingArrival(login);
      const selected = readSession(VIEWING_SELECTION_KEY, null);
      const arrivalSource = selected?.channel === login && selected.until > Date.now() ? 'viewer-link' : automaticArrival ? 'dropper-navigation' : '';
      const changed = viewingIntent.context(account, login, automaticArrival, arrivalSource);
      if (changed) {
        viewingVideo = null;
        recentPlaybackControl = { action: '', at: 0 };
      }
      const video = login ? streamVideoElement() : null;
      if (video !== viewingVideo) {
        viewingVideo = video;
        videoMountedDuringPause = viewingIntent.snapshot().paused;
      }
      if (!video) viewingIntent.observe('unknown');
      else if (video.ended) viewingIntent.observe('ended');
      else if (video.error) viewingIntent.observe('error');
      else if (video.paused) {
        // An unrequested paused player is not permission to force playback.
        if (!automaticArrival || viewingIntent.snapshot().paused) viewingIntent.pause(false);
        else viewingIntent.observe('paused');
      } else {
        const held = viewingIntent.snapshot();
        const explicitResume = recentPlaybackControl.action === 'resume' && Date.now() - recentPlaybackControl.at < 1500;
        if (held.paused && (videoMountedDuringPause || held.pauseReason === 'viewer') && !explicitResume) {
          // Preserve a known pause through a same-channel player replacement.
          // This does not intercept or replace Twitch's media methods.
          try { video.pause(); } catch (_) {}
        } else viewingIntent.observe(video.readyState > 1 ? 'playing' : 'buffering');
      }
      return viewingIntent.snapshot();
    }

    function noteRequestedViewingNavigation(target) {
      const channel = streamLoginFromUrl(target) || '';
      removeSession(VIEWING_SELECTION_KEY);
      if (channel) writeSession(VIEWING_NAVIGATION_KEY, { channel, until: Date.now() + 30000 });
      else removeSession(VIEWING_NAVIGATION_KEY);
    }

    function recordViewerChannelSelection(event) {
      if (!event.isTrusted || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      if (event.composedPath?.().some(node => node?.id === 'tdh-root')) return;
      const anchor = event.target?.closest?.('a[href]');
      if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return;
      if (!isTrustedTwitchUrl(anchor.href)) return;
      const channel = streamLoginFromUrl(anchor.href);
      if (!channel) return;
      writeSession(VIEWING_SELECTION_KEY, { channel, until: Date.now() + 30000 });
    }

    function installViewingIntent() {
      if (viewingListenersInstalled) return;
      viewingListenersInstalled = true;
      syncViewingContext();
      document.addEventListener('click', recordViewerChannelSelection, true);
      const editable = node => Boolean(node?.closest?.('input,textarea,select,[contenteditable="true"],[role="textbox"]'));
      const control = event => {
        if (!event.isTrusted || !watchingLogin() || editable(event.target)) return;
        const video = streamVideoElement();
        if (!video) return;
        const keyboard = event.type === 'keydown';
        if (keyboard && (event.altKey || event.ctrlKey || event.metaKey || event.repeat || ![' ', 'k', 'K'].includes(event.key))) return;
        if (!keyboard && event.target !== video && !event.target?.closest?.('[data-a-target="player-play-pause-button"],[data-a-target="player-overlay-play-button"]')) return;
        recentPlaybackControl = { action: video.paused ? 'resume' : 'pause', at: Date.now() };
      };
      const media = event => {
        if (!watchingLogin() || event.target !== streamVideoElement()) return;
        syncViewingContext();
        const explicit = Date.now() - recentPlaybackControl.at < 1500;
        if (event.type === 'pause' && !event.target.ended && !event.target.error) viewingIntent.pause(explicit && recentPlaybackControl.action === 'pause');
        if (event.type === 'playing') {
          if (viewingIntent.resume({ explicit: explicit && recentPlaybackControl.action === 'resume', remounted: videoMountedDuringPause })) {
            videoMountedDuringPause = false;
            removeSession(VIEWING_NAVIGATION_KEY);
          } else { try { event.target.pause(); } catch (_) {} }
        }
        if (event.type === 'waiting' || event.type === 'stalled') viewingIntent.observe('buffering');
        if (event.type === 'ended') viewingIntent.observe('ended');
        if (event.type === 'error') viewingIntent.observe('error');
        refreshViewingControls();
        syncScreenWakeLock();
      };
      const preserveLayoutChoice = event => {
        if (!event.isTrusted || event.composedPath().some(node => node?.id === 'tdh-root')) return;
        if (event.type === 'keydown' && !['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key)) return;
        playerPresentationRecovery.viewerInteracted = true;
      };
      for (const type of ['pointerdown','wheel','touchmove','keydown']) document.addEventListener(type, preserveLayoutChoice, {capture:true,passive:true});
      // exp-core-allow: records the viewer's own player controls (pause/play), not a menu.
      document.addEventListener('pointerdown', control, true);
      document.addEventListener('keydown', control, true);
      for (const type of ['pause', 'playing', 'waiting', 'stalled', 'ended', 'error']) document.addEventListener(type, media, true);
      for (const type of ['fullscreenchange', 'enterpictureinpicture', 'leavepictureinpicture']) {
        document.addEventListener(type, () => { syncViewingContext(); queueClaimScan(); refreshViewingControls(); }, true);
      }
      window.addEventListener('popstate', () => { syncViewingContext(); refreshViewingControls(); });
      document.addEventListener('visibilitychange', syncScreenWakeLock);
      window.addEventListener('pagehide', () => { try { screenWakeLock?.release(); } catch (_) {} screenWakeLock = null; });
    }
    // BEGIN DROPPER CONTENT WARNING MEMORY
    // Site-wide consent contains only known classification IDs in manager storage.
    // A trusted manual confirmation teaches it; page clicks and unknown gates do not.
    const contentWarningMemory = (() => {
      const KEY = 'exp:v3:dropper:content-warning-memory';
      const BUTTON = 'button[data-a-target="content-classification-gate-overlay-start-watching-button"]';
      const ROOT = '[data-a-target="content-classification-gate-overlay"],[data-a-target="player-overlay-content-gate"]';
      const labels = new Map([
        ['mature-rated games', 'mature-rated-games'],
        ['sexual themes', 'sexual-themes'],
        ['drugs, intoxication, or excessive tobacco use', 'drugs-intoxication'],
        ['drugs, alcohol use, or excessive tobacco use', 'drugs-intoxication'],
        ['violent and graphic depictions', 'graphic-violence'],
        ['significant profanity or vulgarity', 'profanity'],
        ['gambling', 'gambling'],
        ['politics and sensitive social issues', 'politics-sensitive-issues'],
      ]);
      const known = new Set(labels.values());
      const normalize = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
      const valid = value => Array.isArray(value) ? [...new Set(value.filter(id => known.has(id)))].slice(0, known.size) : [];
      let installed = false, disposed = false, epoch = 0, state = 'idle';
      let clicked = new WeakMap();
      const attempts = new Map(), timers = new Set();

      function read() {
        if (productResetting || disposed) return [];
        try { return typeof GM_getValue === 'function' ? valid(GM_getValue(KEY, [])) : []; } catch (_) { return []; }
      }
      function write(ids) {
        if (productResetting || disposed || typeof GM_getValue !== 'function' || typeof GM_setValue !== 'function') return false;
        try {
          const value = valid(ids); GM_setValue(KEY, value);
          return JSON.stringify(read()) === JSON.stringify(value);
        } catch (_) { return false; }
      }
      function enabled() {
        if (productResetting || disposed) return false;
        try {
          const current = typeof GM_getValue === 'function' ? GM_getValue('exp:v3:dropper:settings', null) : null;
          if (typeof current?.rememberContentWarnings === 'boolean') return current.rememberContentWarnings;
        } catch (_) { /* local opt-in remains available; missing consent never authorizes a click */ }
        return settings.rememberContentWarnings === true;
      }
      function visible(node) {
        if (!node?.isConnected || node.closest('[hidden],[inert]') || !node.getClientRects().length) return false;
        const css = getComputedStyle(node);
        return css.display !== 'none' && css.visibility === 'visible';
      }
      function prompt(button = document.querySelector(BUTTON)) {
        const root = button?.closest(ROOT);
        if (!root || !button.matches(BUTTON) || button.disabled || !visible(button)) return null;
        // Content labels are acknowledgments, not login, age-verification or access controls.
        if (root.querySelector('input,select,textarea') || /verify your age|age verification|date of birth|sign in to watch/i.test(root.textContent)) return null;
        const items = [...root.querySelectorAll('li')].filter(visible);
        if (!items.length || items.length > known.size) return null;
        const ids = items.map(item => labels.get(normalize(item.textContent)));
        if (ids.some(id => !id)) return null;
        return { root, button, ids: [...new Set(ids)].sort(), route: location.pathname };
      }
      function refresh() { onChange('warnings'); }
      function later(callback, delay) {
        const timer = setTimeout(() => { timers.delete(timer); callback(); }, delay);
        timers.add(timer);
      }
      function manual(event) {
        if (!event.isTrusted || event.defaultPrevented || event.button !== 0 || !enabled() || ExtraPotionsCore.suiteSitePaused?.()) return;
        const button = event.target?.closest?.(BUTTON), accepted = prompt(button);
        if (!accepted || !watchingLogin()) return;
        recentPlaybackControl = { action:'resume', at:Date.now() };
        const ticket = epoch;
        function confirm(remaining) {
          if (ticket !== epoch || !enabled() || ExtraPotionsCore.suiteSitePaused?.() || event.defaultPrevented || location.pathname !== accepted.route) return;
          if (!visible(accepted.button) && !prompt()) {
            if (write([...read(), ...accepted.ids])) {
              state = 'remembered';
              logActivity('content-warning', 'Remembered accepted Twitch content warnings', {scope:'site-wide', types:accepted.ids.length});
              refresh();
            } else state = 'storage-unavailable';
          } else if (remaining > 0) later(() => confirm(remaining - 1), 200);
          else state = 'confirmation-unavailable';
        }
        later(() => confirm(10), 0);
      }
      function process() {
        if (!enabled() || ExtraPotionsCore.suiteSitePaused?.() || !watchingLogin()) return false;
        if (typeof viewingIntent !== 'undefined' && viewingIntent.snapshot().pauseReason === 'viewer') return false;
        const found = prompt(); if (!found) return false;
        const saved = read();
        if (!found.ids.every(id => saved.includes(id))) { state = 'awaiting-acceptance'; return false; }
        const signature = found.route + ':' + found.ids.join(','), now = Date.now();
        const previous = attempts.get(signature);
        if (clicked.get(found.button) === signature || (previous && (now - previous.at < 10000 || previous.count >= 3))) return false;
        clicked.set(found.button, signature);
        attempts.set(signature, {at:now, count:(previous?.count || 0) + 1});
        if (attempts.size > 50) attempts.delete(attempts.keys().next().value);
        try {
          recentPlaybackControl = {action:'resume', at:now};
          found.button.click(); state = 'accepted-remembered';
          logActivity('content-warning', 'Accepted remembered Twitch content warnings', {scope:'site-wide', types:found.ids.length});
          return true;
        } catch (_) { state = 'confirmation-unavailable'; return false; }
      }
      function clear() {
        epoch += 1; for (const timer of timers) clearTimeout(timer); timers.clear();
        clicked = new WeakMap(); attempts.clear();
        const cleared = write([]); state = cleared ? 'forgotten' : 'storage-unavailable'; refresh(); return cleared;
      }
      function install() { if (installed || disposed) return; installed = true; document.addEventListener('click', manual, true); }
      function dispose() { disposed = true; epoch += 1; for (const timer of timers) clearTimeout(timer); timers.clear(); document.removeEventListener('click', manual, true); }
      function snapshot() { return {enabled:enabled(), scope:'site-wide', rememberedTypes:read().length, state}; }
      return Object.freeze({install, process, clear, dispose, snapshot});
    })();
    // END DROPPER CONTENT WARNING MEMORY
    function isSubscriptionPromoText(value) {
      const text = cleanText(value);
      if (!text || text.length > 360) return false;
      return (
        /\bgift\s+(?:a\s+)?sub\b/i.test(text) ||
        /\bsubscribe(?:\s*:|\s+for|\s+to|\s+with|\s+and|\s*$)/i.test(text) ||
        /\bsub(?:scription)?\s+benefits?\b/i.test(text) ||
        /\bsub\s+for\b/i.test(text)
      );
    }

    function subscriptionPromoStyle() {
      let style = document.getElementById("dropper-subscription-promo-style");
      if (!settings.hideTwitchSubscriptionPromos) {
        style?.remove();
        return;
      }
      if (style) return;

      style = document.createElement("style");
      style.id = "dropper-subscription-promo-style";
      style.textContent = `
        button[data-a-target="subscribe-button"],
        [data-a-target="subscribe-button"],
        button[data-a-target="gift-sub-button"],
        [data-a-target="gift-sub-button"],
        button[data-a-target="gift-a-sub-button"],
        [data-a-target="gift-a-sub-button"],
        button[data-test-selector*="subscribe-button" i],
        button[data-test-selector*="gift-sub" i],
        button[aria-label^="Subscribe" i],
        button[aria-label*="Gift a Sub" i],
        [role="button"][aria-label^="Subscribe" i],
        [role="button"][aria-label*="Gift a Sub" i],
        div.community-highlight,
        div.community-highlight-stack__backlog-card,
        div.pinned-chat__highlight-card,
        div.pinned-chat__highlight-card__collapsed,
        div.highlight.highlight__collapsed:has([data-test-selector="header-content"]) {
          display: none !important;
        }
      `;
      (document.head || document.documentElement).appendChild(style);
    }

    function restoreTwitchSubscriptionPromos() {
      document.getElementById("dropper-subscription-promo-style")?.remove();
      document.querySelectorAll('[data-dropper-sub-promo-suppressed="true"]').forEach((node) => {
        const previous = node.getAttribute("data-dropper-prev-display");
        if (previous) node.style.display = previous;
        else node.style.removeProperty("display");
        node.removeAttribute("data-dropper-sub-promo-suppressed");
        node.removeAttribute("data-dropper-prev-display");
        node.removeAttribute("data-dropper-sub-promo-scope");
      });
    }

    function suppressPromoNode(node, scope) {
      if (!(node instanceof Element)) return false;
      if (node.closest("#tdh-root")) return false;
      if (node.getAttribute("data-dropper-sub-promo-suppressed") === "true") return false;

      node.setAttribute("data-dropper-prev-display", node.style.display || "");
      node.setAttribute("data-dropper-sub-promo-suppressed", "true");
      node.setAttribute("data-dropper-sub-promo-scope", scope);
      node.style.setProperty("display", "none", "important");
      suppressedSubscriptionPromoCount += 1;
      return true;
    }

    function suppressChatSubscriptionPromos() {
      const chat = findTwitchChatColumn();
      if (!chat) return 0;

      const candidates = chat.querySelectorAll([
        "button",
        '[role="button"]',
        'a[href*="/subscriptions"]',
        'a[href*="/subscribe"]',
        '[data-a-target*="subscribe" i]',
        '[data-test-selector*="subscribe" i]',
        '[aria-label*="subscribe" i]',
        '[aria-label*="sub for" i]'
      ].join(","));

      const cards = new Set();
      candidates.forEach((candidate) => {
        let node = candidate instanceof Element ? candidate : null;
        let matched = null;

        for (let depth = 0; node && node !== chat && depth < 7; depth += 1, node = node.parentElement) {
          if (node.getAttribute?.("data-dropper-sub-promo-suppressed") === "true") {
            matched = node;
            break;
          }

          const text = cleanText(node.textContent);
          if (!isSubscriptionPromoText(text)) continue;

          const rect = node.getBoundingClientRect();
          const compactCard = rect.width >= 180 && rect.height >= 36 && rect.height <= 190;
          if (compactCard) matched = node;
        }

        if (matched) cards.add(matched);
      });

      let hidden = 0;
      cards.forEach((card) => {
        if (suppressPromoNode(card, "chat")) hidden += 1;
      });
      return hidden;
    }

    function suppressPageSubscriptionPromos() {
      const chat = findTwitchChatColumn();
      const selectors = [
        'button[data-a-target*="subscribe" i]',
        'button[data-a-target*="gift-sub" i]',
        'button[data-a-target*="gift-a-sub" i]',
        'button[data-test-selector*="subscribe" i]',
        'button[data-test-selector*="gift-sub" i]',
        'button[aria-label*="subscribe" i]',
        'button[aria-label*="gift a sub" i]',
        '[role="button"][aria-label*="subscribe" i]',
        '[role="button"][aria-label*="gift a sub" i]',
        'a[href*="/subscriptions"]',
        'a[href*="/subscribe"]'
      ].join(",");

      let hidden = 0;
      document.querySelectorAll(selectors).forEach((candidate) => {
        if (!(candidate instanceof Element)) return;
        if (candidate.closest("#tdh-root")) return;
        if (chat?.contains(candidate)) return;

        const text = cleanText(
          candidate.textContent ||
          candidate.getAttribute("aria-label") ||
          candidate.getAttribute("title") ||
          ""
        );

        const explicitSelector = Boolean(
          candidate.matches?.(
            '[data-a-target="subscribe-button"], [data-a-target="gift-sub-button"], [data-a-target="gift-a-sub-button"]'
          )
        );
        if (!explicitSelector && !isSubscriptionPromoText(text)) return;

        const rect = candidate.getBoundingClientRect();
        if (rect.height > 120 || rect.width > 420) return;

        if (suppressPromoNode(candidate, "page-cta")) hidden += 1;
      });

      return hidden;
    }

    function suppressTwitchHighlightPromos() {
      let hidden = 0;
      const targets = new Set();

      document.querySelectorAll(
        "div.community-highlight, div.community-highlight-stack__backlog-card, div.pinned-chat__highlight-card, div.pinned-chat__highlight-card__collapsed, div.highlight.highlight__collapsed"
      ).forEach((candidate) => {
        if (!(candidate instanceof Element)) return;
        if (candidate.closest("#tdh-root")) return;

        const outerCommunity = candidate.matches("div.community-highlight")
          ? candidate
          : candidate.closest("div.community-highlight");
        const backlogCard = candidate.matches("div.community-highlight-stack__backlog-card")
          ? candidate
          : candidate.closest("div.community-highlight-stack__backlog-card");
        const pinnedCard = candidate.matches("div.pinned-chat__highlight-card, div.pinned-chat__highlight-card__collapsed")
          ? candidate
          : candidate.closest("div.pinned-chat__highlight-card, div.pinned-chat__highlight-card__collapsed");
        const highlight = candidate.matches("div.highlight.highlight__collapsed")
          ? candidate
          : candidate.querySelector?.("div.highlight.highlight__collapsed");

        const target = outerCommunity || backlogCard || pinnedCard || highlight || candidate;
        if (target) targets.add(target);
      });

      targets.forEach((target) => {
        const scope = target.matches?.("div.community-highlight")
          ? "community-highlight"
          : target.matches?.("div.community-highlight-stack__backlog-card")
            ? "community-highlight-backlog"
            : target.matches?.("div.pinned-chat__highlight-card, div.pinned-chat__highlight-card__collapsed")
              ? "pinned-highlight"
              : "highlight";
        if (suppressPromoNode(target, scope)) hidden += 1;
      });

      return hidden;
    }

    function suppressTwitchSubscriptionPromos() {
      if (ExtraPotionsCore.suiteSitePaused?.()) return;
      lastPromoScanAt = Date.now();
      if (!settings.hideTwitchSubscriptionPromos) {
        restoreTwitchSubscriptionPromos();
        return 0;
      }

      subscriptionPromoStyle();
      const hidden = suppressChatSubscriptionPromos() + suppressPageSubscriptionPromos() + suppressTwitchHighlightPromos();
      if (hidden) {
        logActivity(
          "twitch-ui",
          "Suppressed " + hidden + " Twitch promo" + (hidden === 1 ? "" : "s"),
          { totalSuppressed: suppressedSubscriptionPromoCount }
        );
      }
      return hidden;
    }

    function findTwitchChatColumn() {
      const selectors = [
        '[data-a-target="right-column"]',
        '[data-test-selector="chat-room-component-layout"]',
        '.right-column',
        '.chat-shell',
      ];
      for (const selector of selectors) {
        const node = document.querySelector(selector);
        if (!node) continue;
        const rect = node.getBoundingClientRect();
        if (rect.width >= 260 && rect.height >= 120) return node;
      }
      return null;
    }

    categorySlugCache = loadCategorySlugCache();

    // The controller's page inputs (see the inputs table in docs/v4-design.md).
    const locationKey = () => `${location.origin}${location.pathname}${location.search}`;
    function health() {
      const attention = browserAttentionSnapshot();
      const viewing = viewingIntent.snapshot();
      return {
        playing: streamVideoIsPlaying(), playback: viewing.playback || 'unknown', pauseReason: viewing.pauseReason || '',
        visibilityState: attention.visibilityState, pictureInPicture: Boolean(document.pictureInPictureElement),
        backgrounded: attention.backgrounded, foregroundGraceRemainingMs: attention.foregroundGraceRemainingMs,
      };
    }
    const streams = () => (isDirectoryCategoryPage() ? collectDirectoryStreamCandidates(wantedGame(), '') : []);
    const category = () => (isDirectoryCategoryPage() ? currentDirectorySlug() : '');
    // Called before Dropper leaves the page: the arrival is Dropper's own, and the new stream may be muted.
    function noteNavigation(url, reason) {
      noteRequestedViewingNavigation(url);
      if (streamLoginFromUrl(url)) requestMuteAfterNavigation(reason);
    }
    // At document start: listeners only.
    function install() {
      installViewingIntent();
      contentWarningMemory.install();
    }
    // Once the document has loaded.
    function boot() {
      for (const type of ['blur', 'focus', 'pageshow']) window.addEventListener(type, () => browserAttentionSnapshot(), { passive: true });
      document.addEventListener('visibilitychange', () => browserAttentionSnapshot());
      subscriptionPromoStyle();
      setTimeout(() => { if (settings.hideTwitchSubscriptionPromos) suppressTwitchSubscriptionPromos(); }, PROMO_STARTUP_SCAN_DELAY_MS);
    }
    // One heartbeat of page work, in 3.x's order.
    function heartbeat(now = Date.now()) {
      currentSettings = readSettings();
      if (sitePaused()) return;
      syncViewingContext();
      restoreChannelPlayer();
      contentWarningMemory.process();
      ensureStreamMuted();
      ensureStreamPlaying();
      void syncScreenWakeLock();
      if (now - lastPromoScanAt >= PROMO_SCAN_INTERVAL_MS) suppressTwitchSubscriptionPromos();
    }

    return Object.freeze({
      login: watchingLogin, path: () => location.pathname, stream: readStreamInfo, category, streams, health, locationKey, hidden: () => document.hidden, startedAt,
      slugFor: target => resolveCategorySlug(target), rememberSlug: rememberCategorySlug, channelFromUrl: streamLoginFromUrl, isTrustedUrl: isTrustedTwitchUrl,
      noteNavigation, install, boot, heartbeat, sync: syncViewingContext, resume: () => ensureStreamPlaying(true), restorePlayer: () => restoreChannelPlayer(true),
      player: playerPresentationSnapshot, warnings: contentWarningMemory, promos: { suppress: suppressTwitchSubscriptionPromos, restore: restoreTwitchSubscriptionPromos },
      videoPlaying: streamVideoIsPlaying, refreshSettings: () => { currentSettings = readSettings(); },
    });
  }

  // One tab in charge. Each Dropper tab writes its own presence entry (so two tabs writing at once never erase each
  // other) and announces itself on a BroadcastChannel. Two gates, as in 3.x: the tab in charge (a tab chosen for
  // switching outranks the rest, then the oldest) runs the controller; only a tab chosen for switching may change
  // streams. The choice lives in window.name, so it survives reloads of that tab only.
  const TAB_PRESENCE_KEY = 'dropper-tab-presence-v1';
  const TAB_STALE_MS = 20 * 1000;
  const TAB_PRESENCE_INTERVAL_MS = 4 * 1000;
  const AUTOMATION_TAB_NAME = 'exp-dropper-automation-tab';
  const AUTOMATION_TAB_SINCE_KEY = 'dropper-automation-tab-since-v1';
  const ADOPT_AFTER_UPDATE_MS = 7 * 24 * 60 * 60 * 1000;

  function createTabs({ store, local = localStorage, pageWindow = window, startedAt = Date.now(), id = null, now = Date.now, describe = () => ({}), onChange = () => {}, channelFactory = name => (typeof BroadcastChannel === 'function' ? new BroadcastChannel(name) : null) } = {}) {
    const tabId = id || `t${startedAt.toString(36)}-${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2, 11)}`;
    let channel = null, channelAccount = '', timer = 0;
    const prefix = () => `${store.scoped(TAB_PRESENCE_KEY)}:`;

    const isSwitchingTab = () => { try { return String(pageWindow.name || '').split('|').includes(AUTOMATION_TAB_NAME); } catch (_) { return false; } };
    function chooseForSwitching() {
      try { if (!isSwitchingTab()) pageWindow.name = pageWindow.name ? `${pageWindow.name}|${AUTOMATION_TAB_NAME}` : AUTOMATION_TAB_NAME; } catch (_) {}
    }

    function entries() {
      const map = {}, start = prefix();
      try {
        for (let index = 0; index < local.length; index += 1) {
          const key = local.key(index);
          if (!key?.startsWith(start)) continue;
          try { const entry = JSON.parse(local.getItem(key) || 'null'); if (entry && typeof entry === 'object' && !Array.isArray(entry)) map[key.slice(start.length)] = entry; } catch (_) {}
        }
      } catch (_) {}
      return map;
    }
    const live = (map, at) => Object.fromEntries(Object.entries(map).filter(([, entry]) => entry && at - Number(entry.at || 0) <= TAB_STALE_MS));
    function peers(at = now()) {
      return Object.entries(live(entries(), at)).filter(([key]) => key !== tabId).map(([key, entry]) => ({ id: key, ...entry }))
        .sort((a, b) => Number(a.startedAt || 0) - Number(b.startedAt || 0));
    }

    function openChannel() {
      const account = store.login();
      if (channel && channelAccount === account) return;
      try { channel?.close(); } catch (_) {}
      channel = null;
      try {
        channel = channelFactory(`${TAB_PRESENCE_KEY}:${encodeURIComponent(account || 'signed-out')}`);
        channelAccount = account;
        if (!channel) return;
        channel.onmessage = event => {
          const data = event?.data;
          if (!data || data.id === tabId) return;
          if (data.type === 'bye') { try { local.removeItem(prefix() + data.id); } catch (_) {} }
          if (data.type === 'ping') publish();
          onChange();
        };
        channel.postMessage({ type: 'ping', id: tabId });
      } catch (_) { channel = null; }
    }

    function publish(extra = {}) {
      const at = now();
      openChannel();
      const all = entries(), alive = live(all, at);
      for (const key of Object.keys(all)) if (!(key in alive)) { try { local.removeItem(prefix() + key); } catch (_) {} }
      const entry = { at, startedAt, path: location.pathname || '/', hidden: Boolean(document.hidden), automation: isSwitchingTab(), ...describe(), ...extra };
      try { local.setItem(prefix() + tabId, JSON.stringify(entry)); } catch (_) {}
      try { channel?.postMessage({ type: 'presence', id: tabId, entry }); } catch (_) {}
      return entry;
    }
    function leave() {
      try { local.removeItem(prefix() + tabId); } catch (_) {}
      try { channel?.postMessage({ type: 'bye', id: tabId }); } catch (_) {}
    }

    // A tab chosen for switching outranks every other; among equals the oldest wins.
    function inCharge(at = now()) {
      const others = peers(at);
      if (!others.length) return true;
      const chosen = isSwitchingTab();
      const rivals = others.filter(peer => Boolean(peer.automation) === chosen);
      if (!chosen && rivals.length < others.length) return false;
      if (!rivals.length) return true;
      return startedAt <= Number(rivals[0]?.startedAt || 0);
    }

    // Before tabs were chosen, any Dropper tab could switch. A fresh single tab with switching on and no saved
    // viewing state is chosen; for a week after updating, a tab loading with routing under way keeps switching.
    // A tab opened from another one carries a copy of its session state, so it is never adopted.
    function adoptAfterUpdate({ routingUnderWay = false, findNextStream = false, resumeSessionOnRestart = false, channel: login = '' } = {}) {
      try {
        if (!routingUnderWay && findNextStream && !pageWindow.opener && !store.session.get('viewingIntent', null) && !store.session.get('viewingSelection', null)
          && !store.session.get('manualStreamLock', null) && !peers().length) { chooseForSwitching(); return 'fresh'; }
        let since = Number(store.local.get('tabInChargeSince', 0)) || 0;
        if (!since) { since = now(); store.local.set('tabInChargeSince', String(since)); }
        const saved = store.session.get('viewingIntent', null);
        const restored = resumeSessionOnRestart && saved && saved.account === store.login() && saved.channel === login && saved.manualStream === false && !saved.paused;
        if (routingUnderWay && !pageWindow.opener && (restored || now() - since < ADOPT_AFTER_UPDATE_MS)) { chooseForSwitching(); return 'adopted'; }
      } catch (_) {}
      return '';
    }

    function start() {
      publish();
      clearInterval(timer);
      timer = setInterval(() => publish(), TAB_PRESENCE_INTERVAL_MS);
      window.addEventListener('pagehide', leave);
      window.addEventListener('beforeunload', leave);
    }
    function stop() { clearInterval(timer); timer = 0; leave(); try { channel?.close(); } catch (_) {} channel = null; }

    return Object.freeze({ id: tabId, start, stop, publish, leave, peers, inCharge, isSwitchingTab, chooseForSwitching, adoptAfterUpdate });
  }

  // Claims: one ledger (shared rules in active-viewing.js, records in store.claimStorage) for the GQL claim of a
  // finished reward, the inventory sweep, and Twitch's own claim and bonus buttons. 3.x's claim code is carried
  // over unchanged inside createClaimsRunner; its inputs are injected. A claim never blocks the controller: a
  // confirmed claim marks the reward claimed in the data, and the controller moves on from there. Removed in 4.0:
  // system notifications for claims (the in-menu status stays).
  const CLAIM_SCAN_MIN_INTERVAL_MS = 5000;
  const BONUS_CONFIRM_SETTLE_MS = 3000;
  const CLAIM_RETRY_INTERVAL_MS = 30 * 1000;
  const INVENTORY_CLAIM_SWEEP_LIMIT = 3;
  const TWITCH_DOM_SELECTORS = Object.freeze({
    bonusClaim: 'button[aria-label="Claim Bonus"], .claimable-bonus__icon',
    bonusContainer: '.community-points-summary,[data-test-selector="community-points-summary"],[data-a-target="community-points-summary"]',
    dropClaim: [
      '[data-test-selector="DropsCampaignInProgressRewardPresentation-claim-button"]',
      'button[data-a-target="drops-claim-button"]',
    ].join(','),
    inventoryCard: '.inventory-max-width > div:not(:first-child)',
    rewardPresentation: '[role="progressbar"],[data-test-selector*="RewardPresentation"]',
  });
  const INVENTORY_URL = 'https://www.twitch.tv/drops/inventory';

  function createClaimsRunner({ store, session = sessionStorage, local = localStorage, twitch, page, intent, tabs, settings: readSettings, target = () => null, inventory: readInventory = () => [], onConfirmed = () => {}, onChange = () => {}, requestPoll = () => {}, sitePaused = () => false, log = () => {} } = {}) {
    // 3.x's names, so the carried-over code reads as it did.
    const logActivity = log;
    const productResetting = false;
    const ExtraPotionsCore = { suiteSitePaused: sitePaused };
    const viewingIntent = intent;
    const TAB_ID = tabs.id;
    let currentSettings = readSettings();
    const settings = new Proxy({}, { get: (_, name) => currentSettings[name] });
    const storageAccountLogin = () => store.login();
    const watchingLogin = () => page.login();
    const syncViewingContext = () => page.sync();
    const isAutoRoutingController = () => tabs.inCharge();
    const isInventory = () => page.path() === new URL(INVENTORY_URL).pathname;
    const currentDrop = () => target();
    const dropProgressComplete = rewardComplete;
    const campaignGameName = campaign => cleanText(campaign?.game?.displayName || campaign?.game?.name || '');
    const gql = requests => twitch.request(requests);
    const queueGqlPollSoon = reason => requestPoll(reason);
    const setStatus = text => onChange('status', text);
    const renderClaimHistory = () => onChange('claims');
    const readSession = (key, fallback) => { try { const raw = session.getItem(store.scoped(key)); return raw == null ? fallback : JSON.parse(raw); } catch (_) { return fallback; } };
    const writeSession = (key, value) => { try { session.setItem(store.scoped(key), JSON.stringify(value)); } catch (_) {} };
    const continueAfterConfirmedDropClaim = attempt => onConfirmed(attempt);
    const CLAIM_GROUPS = Object.freeze([
      { id: 'bonus', kind: 'bonus', selector: TWITCH_DOM_SELECTORS.bonusClaim, applies: () => Boolean(watchingLogin()) },
      { id: 'stream-drop', kind: 'drop', selector: TWITCH_DOM_SELECTORS.dropClaim, applies: () => Boolean(watchingLogin()) },
      { id: 'inventory-drop', kind: 'drop', selector: TWITCH_DOM_SELECTORS.dropClaim, applies: () => isInventory() },
    ]);
    let claimHealth = {};
    let claimLedgerInstance = null, claimLedgerAccount = '';
    let claimAnonymousSequence = 0;
    const claimNodeIds = new WeakMap();
    const confirmedBonusControls = new WeakMap();
    let lastAnonymousAttemptAt = { bonus: 0, drop: 0 };
    let anonymousClaimBackoff = { bonus: { streak: 0, until: 0 }, drop: { streak: 0, until: 0 } };
    let lastDropAt = 0, lastBonusAt = 0, lastClaimAttemptAt = 0;
    let lastClaimIntegrityFallback = null;
    let inventoryClaimSweepState = null, inventoryClaimSweepPromise = null;
    let dropClaimObserver = null, bonusClaimObserver = null, claimScanTimer = null;
    let lastClaimScanAt = 0, claimScanQueuedAt = 0;

    // The shared ledger over this account's stored claim records (store.claimStorage keeps the newest 100).
    function claimLedger() {
      const account = storageAccountLogin();
      if (claimLedgerInstance && claimLedgerAccount === account) return claimLedgerInstance;
      claimLedgerAccount = account;
      const storage = store.claimStorage(account);
      claimLedgerInstance = DropperActiveViewing.createClaims({
        onStorageError: () => setStatus('Claim history unavailable · Automatic claim not confirmed'),
        id: () => globalThis.crypto?.randomUUID?.() || `${TAB_ID}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        read: storage.read, put: storage.put,
      });
      return claimLedgerInstance;
    }
    const fallbackClaimLease = DropperActiveViewing.createLease({
      id: () => TAB_ID,
      ttlMs: 8000,
      read: key => { try { return JSON.parse(local.getItem(key) || 'null'); } catch (_) { return null; } },
      write: (key, value) => { local.setItem(key, JSON.stringify(value)); },
      remove: key => local.removeItem(key),
      // A short settle lets simultaneous tabs observe which write actually won.
      settle: () => new Promise(resolve => setTimeout(resolve, 25)),
    });

    function claimContext() {
      syncViewingContext();
      return { channel: watchingLogin() || '', account: storageAccountLogin(), generation: viewingIntent.snapshot().generation, campaign: String(currentDrop()?.campaignKey || currentDrop()?.campaignId || '') };
    }

    function claimContextIsCurrent(context) {
      if(ExtraPotionsCore.suiteSitePaused())return false;
      return context.channel === (watchingLogin() || '') && context.account === storageAccountLogin() && context.generation === viewingIntent.snapshot().generation && context.campaign === String(currentDrop()?.campaignKey || currentDrop()?.campaignId || '');
    }

    function claimRecordKey(drop) {
      const identity = String(drop?.id || drop?.dropInstanceID || '');
      return identity ? `drop:${String(drop.campaignId || drop.campaignKey || '').toLowerCase()}:${identity}` : '';
    }

    function claimLeaseStorageKey(key, account) {
      return `dropper-claim-lease-v1:${encodeURIComponent(account || 'signed-out')}:${encodeURIComponent(key)}`;
    }

    async function withClaimLock(key, context, task) {
      if (!claimContextIsCurrent(context)) return false;
      if (navigator.locks?.request) {
        return navigator.locks.request(`dropper-claim:${context.account}:${key}`, { ifAvailable: true }, lock => lock && claimContextIsCurrent(context) ? task() : false);
      }
      if (!isAutoRoutingController()) return false;
      return fallbackClaimLease.run(claimLeaseStorageKey(key, context.account), () => claimContextIsCurrent(context) ? task() : false);
    }

    function applyConfirmedDropClaim(campaigns, attempt) {
      const campaignId = cleanText(attempt?.campaignId).toLowerCase();
      const rewardId = cleanText(attempt?.rewardId);
      if (!campaignId || !rewardId) return campaigns || [];
      return (campaigns || []).map(campaign => {
        const key = cleanText(campaignKey(campaign) || campaign?.id).toLowerCase();
        if (key !== campaignId && cleanText(campaign?.id).toLowerCase() !== campaignId) return campaign;
        const drops = (campaign.timeBasedDrops || campaign.drops || []).map(drop => {
          if (cleanText(drop?.id) !== rewardId) return drop;
          return { ...drop, self: { ...(drop.self || {}), isClaimed: true } };
        });
        return { ...campaign, timeBasedDrops: drops, drops };
      });
    }

    function recordClaimOutcome(ledger, attempt, outcome, evidence) {
      const settled = ledger.settle(attempt.key, attempt.attemptId, outcome, evidence);
      if (!settled) return null;
      const label = DropperActiveViewing.claimPresentation(settled);
      if (outcome === 'confirmed' || outcome === 'already-claimed') {
        if (anonymousClaimBackoff[attempt.kind]) anonymousClaimBackoff[attempt.kind] = { streak: 0, until: 0 };
        if (attempt.kind === 'bonus') lastBonusAt = Date.now();
        else lastDropAt = Date.now();
        if (attempt.kind === 'drop') {
          continueAfterConfirmedDropClaim(attempt);
        }
      }
      logActivity('claim-result', label, { kind: attempt.kind, rewardId: attempt.rewardId || null, outcome, evidence });
      setStatus(label);
      if (outcome === 'confirmed') {
        onChange('toast', label);
      }
      for (const health of Object.values(claimHealth)) {
        if (health.kind === attempt.kind) { health.lastOutcome = outcome; health.lastEvidence = evidence; health.lastResultAt = Date.now(); }
      }
      renderClaimHistory();
      return settled;
    }

    function reconcileClaimHistory(campaigns) {
      const ledger = claimLedger();
      for (const record of ledger.snapshot()) {
        if (record.kind !== 'drop' || !record.rewardId || !['pending', 'unconfirmed', 'retryable', 'blocked'].includes(record.outcome)) continue;
        const campaign = (campaigns || []).find(item => String(item.id || '').toLowerCase() === record.campaignId.toLowerCase());
        const drop = (campaign?.timeBasedDrops || campaign?.drops || []).find(item => String(item.id || '') === record.rewardId);
        if (drop?.self?.isClaimed === true) recordClaimOutcome(ledger, record, 'confirmed', 'inventory');
      }
    }

    function claimTargetRendered(button) {
      if (!button?.isConnected) return false;
      const ownStyle = getComputedStyle(button);
      if (ownStyle.pointerEvents === 'none') return false;
      try {
        if (typeof button.checkVisibility === 'function') {
          return button.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
        }
      } catch (_) {}
      for (let node = button; node && node !== document.documentElement; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
      }
      return true;
    }

    function isSafeClaimTarget(button, group) {
      if (!button || button.tagName !== 'BUTTON' || !button.isConnected || button.disabled || button.getAttribute('aria-disabled') === 'true' || button.closest('[inert]')) return false;
      const label = cleanText(`${button.getAttribute('aria-label') || ''} ${button.textContent || ''}`);
      if (/\b(?:subscribe|subscription|gift|purchase|buy|redeem|spend)\b/i.test(label)) return false;
      const bonusContainer = button.closest(TWITCH_DOM_SELECTORS.bonusContainer);
      if (group.kind === 'bonus' && !bonusContainer && !button.querySelector('.claimable-bonus__icon')) return false;
      if (claimTargetRendered(button)) return true;
      return Boolean(
        group.kind === 'bonus' &&
        document.fullscreenElement &&
        bonusContainer &&
        button.matches('button[aria-label="Claim Bonus"]') &&
        button.querySelector('.claimable-bonus__icon')
      );
    }

    function claimTargetIdentity(button, group) {
      if (group.kind === 'bonus') {
        const previous = confirmedBonusControls.get(button);
        const marker = button.querySelector('.claimable-bonus__icon');
        // Twitch may reuse a button for later bonuses. Only a confirmed dismissal
        // followed by a new bonus marker (or a remounted control) starts a new claim.
        if (previous && (previous.detached || (marker && marker !== previous.marker))) {
          claimNodeIds.delete(button);
          confirmedBonusControls.delete(button);
        }
      }
      if (group.kind === 'drop') {
        const carrier = button.closest('[data-drop-id],[data-drop-instance-id]');
        const rewardId = carrier?.getAttribute('data-drop-id') || '';
        const instanceId = carrier?.getAttribute('data-drop-instance-id') || '';
        for (const campaign of readInventory()) {
          const reward = (campaign.timeBasedDrops || campaign.drops || []).find(item => (rewardId && item.id === rewardId) || (instanceId && item.self?.dropInstanceID === instanceId));
          if (reward && !reward.self?.isClaimed) return {
            id: reward.id, campaignId: String(campaign.id || ''), campaignKey: campaignKey(campaign),
            dropInstanceID: reward.self?.dropInstanceID || '',
            name: reward.name || reward.benefitEdges?.[0]?.benefit?.name || 'Drop',
            game: campaignGameName(campaign),
          };
        }
        if (!isInventory() && currentDrop()?.id && dropProgressComplete(currentDrop())) return currentDrop();
      }
      if (!claimNodeIds.has(button)) claimNodeIds.set(button, `anonymous:${TAB_ID}:${++claimAnonymousSequence}`);
      return { anonymous: claimNodeIds.get(button) };
    }

    function bonusControlStillClaimable(button) {
      if (!button?.isConnected) return false;
      const container = button.closest(TWITCH_DOM_SELECTORS.bonusContainer);
      if (!container) return false;
      if (!button.querySelector('.claimable-bonus__icon')) return false;
      return isSafeClaimTarget(button, CLAIM_GROUPS[0]);
    }

    function confirmDismissedBonusControl(button, ledger, attempt, context, marker) {
      setTimeout(() => {
        if (!claimContextIsCurrent(context)) return;
        const current = ledger.snapshot().find(record => record.key === attempt.key && record.attemptId === attempt.attemptId);
        if (!current || current.outcome !== 'pending') return;
        if (bonusControlStillClaimable(button)) return;
        const settled = recordClaimOutcome(ledger, attempt, 'confirmed', 'control-dismissed');
        if (settled?.outcome === 'confirmed') confirmedBonusControls.set(button, { marker, detached: !button.isConnected });
      }, BONUS_CONFIRM_SETTLE_MS);
    }

    function queuePageClaim(button, group) {
      if (!isSafeClaimTarget(button, group)) return false;
      const context = claimContext();
      if (context.account === 'signed-out') return false;
      const identity = claimTargetIdentity(button, group);
      const key = identity.anonymous || claimRecordKey(identity);
      if (!key) return false;
      if (identity.anonymous && (Date.now() - lastAnonymousAttemptAt[group.kind] < 1500 || Date.now() < anonymousClaimBackoff[group.kind].until)) return false;
      void withClaimLock(key, context, async () => {
        if (!isSafeClaimTarget(button, group)) return false;
        if (identity.anonymous && (Date.now() - lastAnonymousAttemptAt[group.kind] < 1500 || Date.now() < anonymousClaimBackoff[group.kind].until)) return false;
        const ledger = claimLedger();
        const attempt = ledger.begin({
          key, rewardId: identity.id || '', campaignId: identity.campaignId || identity.campaignKey || '',
          rewardName: group.kind === 'bonus' ? 'Bonus chest' : cleanText(identity.name || currentDrop()?.name || 'Drop'),
          game: cleanText(identity.game || currentDrop()?.game || ''), kind: group.kind, evidence: 'page-control'
        });
        if (!attempt) return false;
        if (identity.anonymous) {
          lastAnonymousAttemptAt[group.kind] = Date.now();
          // Twitch redraws a rejected claim button, so each retry looks new. Without a confirmation, every third attempt
          // waits longer: 1, 2, 4, 8 and then 15 minutes.
          const backoff = anonymousClaimBackoff[group.kind];
          backoff.streak += 1;
          if (backoff.streak % 3 === 0) backoff.until = Date.now() + Math.min(15 * 60 * 1000, 60 * 1000 * 2 ** (backoff.streak / 3 - 1));
        }
        try {
          const bonusMarker = group.kind === 'bonus' ? button.querySelector('.claimable-bonus__icon') : null;
          button.click();
          if (group.kind === 'bonus') confirmDismissedBonusControl(button, ledger, attempt, context, bonusMarker);
          claimHealth[group.id] = { ...claimHealth[group.id], kind: group.kind, state: 'attempted', lastAttemptAt: Date.now() };
          logActivity('claim-attempt', 'Claim sent', { kind: group.kind, rewardId: identity.id || null, evidence: 'page-control' });
          setStatus('Claim sent · Waiting for Twitch');
          queueGqlPollSoon('claim-confirmation', 1500);
          renderClaimHistory();
          return true;
        } catch (_) {
          if (claimContextIsCurrent(context)) recordClaimOutcome(ledger, attempt, 'unconfirmed', 'page-control');
          return false;
        }
      }).catch(() => { claimHealth[group.id] = { ...claimHealth[group.id], kind: group.kind, state: 'detection-failed' }; });
      return true;
    }

    function scanClaimGroups(root = document, kind = '') {
      if (!kind) {
        if (claimScanTimer) { clearTimeout(claimScanTimer); claimScanTimer = null; }
        lastClaimScanAt = Date.now();
        claimScanQueuedAt = 0;
      }
      let queued = 0;
      for (const group of CLAIM_GROUPS) {
        if (kind && kind !== group.kind) continue;
        const applicable = group.applies() && (group.kind === 'bonus' ? settings.claimBonus : settings.claimDrops);
        const checkedAt = Date.now();
        const previous = claimHealth[group.id] || {};
        claimHealth[group.id] = {
          ...previous,
          kind: group.kind,
          applicable,
          state: applicable ? 'no-claimable-reward' : 'not-applicable',
          checkedAt,
          checks: Number(previous.checks || 0) + 1,
          consecutiveNoMatch: applicable ? Number(previous.consecutiveNoMatch || 0) + 1 : 0,
        };
        if (!applicable) continue;
        try {
          const candidates = new Set();
          for (const node of [...(root.matches?.(group.selector) ? [root] : []), ...(root.querySelectorAll?.(group.selector) || [])]) {
            const button = node.closest?.('button');
            if (button && isSafeClaimTarget(button, group)) candidates.add(button);
          }
          if (group.id === 'inventory-drop') {
            for (const card of document.querySelectorAll(TWITCH_DOM_SELECTORS.inventoryCard)) {
              if (!card.querySelector(TWITCH_DOM_SELECTORS.rewardPresentation)) continue;
              for (const button of card.querySelectorAll('button')) if (isDropClaimButton(button) && isSafeClaimTarget(button, group)) candidates.add(button);
            }
          }
          if (candidates.size) {
            claimHealth[group.id].state = 'matched';
            claimHealth[group.id].lastMatchedAt = checkedAt;
            claimHealth[group.id].matchCount = Number(claimHealth[group.id].matchCount || 0) + candidates.size;
            claimHealth[group.id].consecutiveNoMatch = 0;
          }
          for (const button of candidates) if (queuePageClaim(button, group)) queued += 1;
        } catch (_) { claimHealth[group.id].state = 'detection-failed'; claimHealth[group.id].lastFailureAt = Date.now(); }
      }
      renderClaimHistory();
      return queued;
    }

    function queueClaimScan(reason = 'mutation', immediate = false) {
      if(ExtraPotionsCore.suiteSitePaused())return;
      if (!settings.claimBonus && !settings.claimDrops) return;
      const now = Date.now();
      const earliest = immediate ? now : Math.max(now, lastClaimScanAt + CLAIM_SCAN_MIN_INTERVAL_MS);
      if (claimScanTimer && claimScanQueuedAt && claimScanQueuedAt <= earliest) return;
      if (claimScanTimer) clearTimeout(claimScanTimer);
      claimScanQueuedAt = earliest;
      claimScanTimer = setTimeout(() => {
        claimScanTimer = null;
        claimScanQueuedAt = 0;
        scanClaimGroups();
      }, Math.max(0, earliest - now));
    }

    function claimSelectorHealthSnapshot(now = Date.now()) {
      return Object.fromEntries(Object.entries(claimHealth).map(([id, entry]) => [id, {
        ...entry,
        health: DropperActiveViewing.selectorHealth(entry, now),
      }]));
    }

    function claimHealthSummary(now = Date.now()) {
      const records = claimLedger().snapshot();
      if (claimLedger().storageFailed) return 'Claim history unavailable · Check browser storage';
      const confirmed = records.filter(record => record.outcome === 'confirmed' || record.outcome === 'already-claimed').length;
      const pending = records.filter(record => record.outcome === 'pending' || record.outcome === 'retryable').length;
      const attention = records.filter(record => record.outcome === 'blocked' || record.outcome === 'unconfirmed').length;
      const parts = [];
      if (!records.length) parts.push('Claims: none');
      else {
        parts.push(`Claims: ${confirmed} confirmed`);
        if (pending) parts.push(`${pending} pending`);
        if (attention) parts.push(`${attention} needs attention`);
      }

      const labels = {
        'monitoring': 'monitoring',
        'observed': 'control observed',
        'observed-recently': 'control seen recently',
        'stale-observation': 'control not seen recently',
        'action-pending': 'claim pending',
        'degraded': 'detector degraded',
      };
      const health = claimSelectorHealthSnapshot(now);
      for (const [id, entry] of Object.entries(health)) {
        if (!entry?.applicable) continue;
        const label = id === 'bonus' ? 'Bonus' : id === 'inventory-drop' ? 'Inventory' : 'Drop';
        parts.push(`${label}: ${labels[entry.health?.status] || entry.health?.status || 'monitoring'}`);
      }

      const sweep = inventoryClaimSweepState || {};
      if (sweep.reason === 'claimed') parts.push(`Inventory sweep: ${Number(sweep.confirmed || 0)} claimed`);
      else if (sweep.reason === 'none-ready') parts.push('Inventory sweep: none ready');
      else if (sweep.reason === 'inventory-unavailable') parts.push('Inventory sweep: unavailable');
      else if (sweep.reason === 'secondary-tab') parts.push('Inventory sweep: managed by another tab');
      else if (sweep.reason === 'disabled') parts.push('Inventory sweep: disabled');
      return parts.join(' · ');
    }

    function isDropClaimButton(button) {
      const text = cleanText(button.getAttribute("aria-label") || button.textContent || "");
      return /^(?:claim(?: (?:now|drop|reward))?|領取|领取|받기|получить)$/i.test(text);
    }

    async function claimDropViaGql(drop) {
      const instanceID = drop?.dropInstanceID;
      if (!settings.claimDrops || !instanceID || drop?.isClaimed || !dropProgressComplete(drop)) return false;
      const context = claimContext();
      if (context.account === 'signed-out') return false;
      const key = claimRecordKey(drop);
      if (!key) return false;
      try {
        return await withClaimLock(key, context, async () => {
          const ledger = claimLedger();
          // An unidentified page attempt must settle before a second path sends
          // a mutation for a possibly identical reward.
          if (ledger.snapshot().some(record => record.kind === 'drop' && !record.rewardId && record.outcome === 'pending')) return false;
          const attempt = ledger.begin({
            key, rewardId: drop.id || '', campaignId: drop.campaignId || drop.campaignKey || '',
            rewardName: cleanText(drop.name || drop.benefitEdges?.[0]?.benefit?.name || 'Drop'),
            game: cleanText(drop.game || ''), kind: 'drop'
          });
          if (!attempt) return false;
          logActivity('claim-attempt', 'Claim sent', { rewardId: attempt.rewardId, evidence: 'request' });
          try {
            const result = await gql([{ op: "claimDrop", variables: { input: { dropInstanceID: instanceID } } }]);
            if (!claimContextIsCurrent(context)) { ledger.settle(key, attempt.attemptId, 'discarded', 'context-change'); return false; }
            const outcome = DropperActiveViewing.claimResponse(result[0]);
            recordClaimOutcome(ledger, attempt, outcome.outcome, outcome.evidence);
            queueGqlPollSoon('claim-confirmation', 1500);
            return outcome.outcome === 'confirmed' || outcome.outcome === 'already-claimed';
          } catch (error) {
            if (!claimContextIsCurrent(context)) { ledger.settle(key, attempt.attemptId, 'discarded', 'context-change'); return false; }
            const outcome = DropperActiveViewing.claimFailure(error);
            recordClaimOutcome(ledger, attempt, outcome.outcome, outcome.evidence);
            if (outcome.evidence === 'integrity') {
              lastClaimIntegrityFallback = { at: Date.now(), drop: drop.name || null, game: drop.game || null, alreadyOnInventory: isInventory(), navigatedToInventory: false };
              setStatus('Claim needs attention · Use Twitch claim control');
            }
            return false;
          }
        });
      } catch (_) { return false; }
    }

    async function sweepClaimReadyInventory(campaigns, source = 'inventory') {
      const state = { at: Date.now(), source, candidates: 0, selected: 0, confirmed: 0, reason: '' };
      if (!settings.claimDrops) { state.reason = 'disabled'; inventoryClaimSweepState = state; return 0; }
      if (storageAccountLogin() === 'signed-out') { state.reason = 'signed-out'; inventoryClaimSweepState = state; return 0; }
      if (!isAutoRoutingController()) { state.reason = 'secondary-tab'; inventoryClaimSweepState = state; return 0; }
      const candidates = DropperActiveViewing.inventoryClaimCandidates(campaigns, {
        limit: INVENTORY_CLAIM_SWEEP_LIMIT,
        excludeRewardId: currentDrop()?.id || '',
      });
      state.candidates = candidates.length;
      if (!candidates.length) { state.reason = 'none-ready'; inventoryClaimSweepState = state; return 0; }
      for (const drop of candidates) {
        if (storageAccountLogin() === 'signed-out' || !isAutoRoutingController()) { state.reason = 'context-changed'; break; }
        state.selected += 1;
        const accepted = await claimDropViaGql(drop);
        if (accepted) state.confirmed += 1;
      }
      state.at = Date.now();
      if (!state.reason) state.reason = state.confirmed ? 'claimed' : 'checked';
      inventoryClaimSweepState = state;
      logActivity('inventory-claim-sweep', `Checked ${state.selected} completed inventory reward${state.selected === 1 ? '' : 's'}`, {
        source, candidates: state.candidates, selected: state.selected, confirmed: state.confirmed, limit: INVENTORY_CLAIM_SWEEP_LIMIT,
      });
      return state.confirmed;
    }

    function queueInventoryClaimSweep(campaigns, source = 'inventory') {
      if (inventoryClaimSweepPromise) return inventoryClaimSweepPromise;
      if (!Array.isArray(campaigns)) {
        inventoryClaimSweepState = { at: Date.now(), source, candidates: null, selected: 0, confirmed: 0, reason: 'inventory-unavailable' };
        return Promise.resolve(0);
      }
      const snapshot = campaigns;
      inventoryClaimSweepPromise = Promise.resolve()
        .then(() => sweepClaimReadyInventory(snapshot, source))
        .catch(() => 0)
        .finally(() => { inventoryClaimSweepPromise = null; });
      return inventoryClaimSweepPromise;
    }

    function maybeClaimCurrentDrop(drop) {
      const now = Date.now();
      if (!drop?.dropInstanceID || now - lastDropAt < 1200) return;
      if ((drop.currentMinutes || 0) < (drop.requiredMinutes || Infinity)) return;

      const endMs = parseTime(drop.campaignEndAt || drop.dropEndAt);
      if (endMs && endMs <= now) return;
      if (now - lastClaimAttemptAt < CLAIM_RETRY_INTERVAL_MS) return;

      lastClaimAttemptAt = now;
      return claimDropViaGql(drop);
    }

    function syncClaimWatchers() {
      // One observer and one ledger own bonus and Drop page actions.
      if (bonusClaimObserver) { bonusClaimObserver.disconnect(); bonusClaimObserver = null; }
      if (ExtraPotionsCore.suiteSitePaused?.() || (!settings.claimBonus && !settings.claimDrops)) {
        dropClaimObserver?.disconnect(); dropClaimObserver = null;
        clearTimeout(claimScanTimer); claimScanTimer = null;
        return;
      }
      if (!dropClaimObserver && document.documentElement) {
        dropClaimObserver = new MutationObserver(() => queueClaimScan('mutation'));
        dropClaimObserver.observe(document.documentElement, { childList: true, subtree: true });
      }
      queueClaimScan('watcher-sync', true);
    }

    function nativeRewardClaimEvidence(inventory = null, campaigns = []) {
      const storageKey = 'dropper-native-earned-rewards-v1';
      const saved = readSession(storageKey, { claims: [], groups: [] });
      const claims = new Set(Array.isArray(saved?.claims) ? saved.claims : []);
      const groups = new Map((Array.isArray(saved?.groups) ? saved.groups : []).map(group => [group.key, group]));
      let changed = false;
      for (const edge of Array.isArray(inventory?.earnedDropRewards?.edges) ? inventory.earnedDropRewards.edges : []) {
        const reward = edge?.node;
        const campaignId = cleanText(reward?.campaign?.id).toLowerCase();
        const rewardId = cleanText(reward?.item?.id);
        if (reward?.status !== 'CLAIMED' || !campaignId || !rewardId) continue;
        const key = campaignId + ':' + rewardId;
        if (!claims.has(key)) { claims.add(key); changed = true; }
      }
      for (const campaign of campaigns || []) {
        const campaignId = cleanText(campaign?.id).toLowerCase();
        if (!campaignId) continue;
        for (const group of Array.isArray(campaign.rewardGroups) ? campaign.rewardGroups : []) {
          const id = cleanText(group?.id);
          if (!id) continue;
          const key = campaignId + ':' + id;
          const rewardIds = (Array.isArray(group.rewards) ? group.rewards : []).map(reward => cleanText(reward?.id));
          const criteria = group.progressCriteria;
          // Only exact, complete identities for explicitly non-repeatable watch
          // groups prove that the corresponding routing target is already done.
          if (criteria?.requirementType !== 'WATCH') {
            if (groups.delete(key)) changed = true;
            continue;
          }
          const claimableOnce = criteria.isRepeatable === false && rewardIds.length > 0 && rewardIds.every(Boolean);
          const record = { key, campaignId, id, rewardIds, claimableOnce, name: cleanText(group.name),
            requiredMinutes: Number(criteria.requirements?.minutesWatched) || 0 };
          if (JSON.stringify(groups.get(key)) !== JSON.stringify(record)) { groups.set(key, record); changed = true; }
        }
      }
      const state = { claims: [...claims].slice(-2000), groups: [...groups.values()].slice(-2000) };
      if (changed) writeSession(storageKey, state);
      const retainedClaims = new Set(state.claims);
      const claimedGroups = new Set(state.groups.filter(group => group.claimableOnce && group.rewardIds.length &&
        group.rewardIds.every(id => retainedClaims.has(group.campaignId + ':' + id))).map(group => group.key));
      return { ...state, claimedGroups };
    }

    function overlayNativeClaimedRewards(campaigns) {
      const evidence = nativeRewardClaimEvidence(null, campaigns);
      return (campaigns || []).map(campaign => {
        const campaignId = cleanText(campaign?.id).toLowerCase();
        const drops = (campaign.timeBasedDrops || campaign.drops || []).map(drop =>
          evidence.claimedGroups.has(campaignId + ':' + cleanText(drop.id))
            ? { ...drop, self: { ...drop.self, isClaimed: true } } : drop);
        for (const group of evidence.groups) {
          if (group.campaignId !== campaignId || !evidence.claimedGroups.has(group.key) ||
              drops.some(drop => cleanText(drop.id) === group.id)) continue;
          drops.push({ id: group.id, name: group.name, requiredMinutesWatched: group.requiredMinutes,
            self: { isClaimed: true, currentMinutesWatched: null } });
        }
        // A partial legacy list must not turn one claimed native group into a
        // completed campaign. Missing groups still need an authoritative lookup.
        const nativeRewardsPending = evidence.groups.some(group => group.campaignId === campaignId &&
          !evidence.claimedGroups.has(group.key) && !drops.some(drop => cleanText(drop.id) === group.id));
        return { ...campaign, timeBasedDrops: drops, nativeRewardsPending };
      });
    }

    // A finished reward that is the controller's target, claimed once its watch time is complete. The caller waits
    // for it before the controller moves on, or the claim would see its context change and give up.
    async function heartbeat() {
      currentSettings = readSettings();
      const drop = currentDrop();
      if (settings.claimDrops && drop) return maybeClaimCurrentDrop(drop);
      return false;
    }
    function refreshSettings() { currentSettings = readSettings(); syncClaimWatchers(); }

    return Object.freeze({
      heartbeat, refreshSettings, syncWatchers: syncClaimWatchers, scan: scanClaimGroups, queueScan: queueClaimScan,
      claim: claimDropViaGql, sweep: queueInventoryClaimSweep, reconcile: reconcileClaimHistory,
      ledger: () => claimLedger().snapshot(), summary: claimHealthSummary, health: claimSelectorHealthSnapshot,
      nativeEvidence: nativeRewardClaimEvidence, overlayClaimed: overlayNativeClaimedRewards, integrityFallback: () => lastClaimIntegrityFallback,
    });
  }

  // The data layer: when to ask Twitch, and what the answers mean. It keeps the inventory, the dashboard catalog,
  // DropCampaignDetails for rewards still missing details, and the reward session on the current channel, and
  // builds the one campaign pool the controller reads. Only twitch.request reaches the network. 3.x's poll path
  // mixed data and routing decisions; here a poll only updates data and hands channel evidence to the controller.
  const POLL_INTERVAL_MS = 60 * 1000;
  const POLL_RECOVERY_INTERVAL_MS = 30 * 1000;
  const POLL_MAX_BACKOFF_MS = 5 * 60 * 1000;
  const POLL_STARTUP_QUIET_MS = 12 * 1000;
  const POLL_MIN_GAP_MS = 15 * 1000;
  const POLL_URGENT_GAP_MS = 5 * 1000;
  const DASHBOARD_STALE_MS = 5 * 60 * 1000;
  const DETAILS_RETRY_MS = 60 * 1000;
  const DETAILS_MISS_TTL_MS = 15 * 60 * 1000;
  const DETAILS_BATCH = 8;

  const dropsOf = campaign => campaign?.timeBasedDrops || campaign?.drops || [];
  const gameOf = campaign => cleanText(campaign?.game?.displayName || campaign?.game?.name || '');
  const knownMinutes = value => value == null || value === '' || !Number.isFinite(Number(value)) || Number(value) < 0 ? null : Number(value);

  // The reward Twitch says this channel is crediting (DropCurrentSessionContext), matched to a known campaign.
  function parseSessionDrop(result, campaignList) {
    const session = result?.data?.currentUser?.dropCurrentSession || result?.data?.currentUser?.dropCurrentSessionContext || {};
    if (Object.hasOwn(session, 'currentSession') && session.currentSession === null) return null;
    const node = session.currentSession || session.drop || session;
    const dropNode = node.drop || node.currentDrop || (node.id || node.name ? node : {});
    const dropId = dropNode.id || node.dropID || session.dropID || '';
    const current = knownMinutes(dropNode.self?.currentMinutesWatched ?? dropNode.currentMinutesWatched ?? node.currentMinutesWatched ?? session.currentMinutesWatched);
    if (!dropId && current === null && !dropNode.name) return null;
    let matched = null;
    for (const campaign of campaignList || []) {
      const drop = dropId ? dropsOf(campaign).find(item => item.id === dropId) : null;
      if (drop) { matched = { campaign, drop }; break; }
    }
    const drop = matched?.drop || dropNode;
    const campaign = matched?.campaign;
    if (requiresSubscription(drop)) return null;
    const required = Number(drop.requiredMinutesWatched ?? node.requiredMinutesWatched ?? session.requiredMinutesWatched) || 0;
    const minutes = current ?? knownMinutes(drop.self?.currentMinutesWatched);
    if (!drop.name && !required && !dropId) return null;
    return {
      id: drop.id || dropId || '', isClaimed: Boolean(drop.self?.isClaimed), name: drop.name || drop.benefitEdges?.[0]?.benefit?.name || 'Current drop',
      game: gameOf(campaign) || cleanText(drop.game?.displayName || drop.game?.name || session.game?.displayName || session.game?.name || ''),
      gameSlug: campaign?.game?.slug || '', campaignId: campaign?.id || '', campaignKey: campaign ? campaignKey(campaign) : '', campaign: campaign?.name || '',
      campaignStartAt: campaign?.startAt || '', campaignEndAt: campaign?.endAt || drop.endAt || '', dropStartAt: drop.startAt || '', dropEndAt: drop.endAt || '',
      percent: progressPercent(minutes, required), currentMinutes: minutes, requiredMinutes: required, remainingMinutes: minutes == null ? null : Math.max(0, required - minutes),
      dropInstanceID: drop.self?.dropInstanceID || drop.dropInstanceID || node.dropInstanceID || session.dropInstanceID || '', session: true,
    };
  }

  // Campaigns this channel supports (ChannelDropsCampaigns).
  function parseAvailableCampaigns(result) {
    const channel = result?.data?.channel || result?.data?.user || {};
    const list = result?.data?.channelDropCampaigns || channel.viewerDropCampaigns || channel.dropCampaigns;
    return Array.isArray(list) ? list : [];
  }

  // How a session reward relates to the selected one: the exact reward, the same campaign without a reward ID
  // (campaign fallback), another reward of the same campaign, or unrelated.
  function sessionIdentity(drop, target) {
    const lower = value => cleanText(value).toLowerCase();
    const targetKey = lower(target?.campaignKey || target?.campaignId), targetId = lower(target?.id);
    const key = lower(drop?.campaignKey || drop?.campaignId), id = lower(drop?.id);
    const campaignMatched = Boolean(targetKey && key && targetKey === key);
    const dropMatched = Boolean(targetId && id && targetId === id);
    const exact = Boolean(dropMatched && (!(targetKey && key) || campaignMatched));
    const fallback = Boolean(campaignMatched && !(targetId && id));
    const otherReward = Boolean(campaignMatched && targetId && id && !dropMatched);
    return { level: exact ? 'exact-drop' : fallback ? 'campaign-fallback' : otherReward ? 'campaign-only-different-drop' : 'none', matches: exact || fallback };
  }

  // Inventory minutes are authoritative; a matching session counter may run ahead of them (never past the
  // requirement), and stands in when the inventory has no live row. A catalog shell's 0 never hides the session.
  function reconcileProgress({ sessionMinutes = null, inventoryMinutes = null, required = 0, inventoryLive = false, sessionEligible = true } = {}) {
    const inventoryValid = inventoryMinutes != null && Number.isFinite(Number(inventoryMinutes)) && Number(inventoryMinutes) >= 0;
    const sessionValid = sessionEligible && sessionMinutes != null && Number.isFinite(Number(sessionMinutes)) && Number(sessionMinutes) >= 0;
    let chosen = null, source = 'none';
    if (inventoryValid && (inventoryLive || Number(inventoryMinutes) > 0)) {
      chosen = Number(inventoryMinutes); source = 'inventory-authoritative';
      if (sessionValid && Number(sessionMinutes) > chosen && (!required || Number(sessionMinutes) <= required)) { chosen = Number(sessionMinutes); source = 'session-ahead-of-inventory'; }
    } else if (sessionValid) {
      if (required && Number(sessionMinutes) > required) source = 'session-rejected-implausible';
      else { chosen = Number(sessionMinutes); source = inventoryValid ? 'session-over-catalog-shell' : 'session-fallback'; }
    } else if (inventoryValid) { chosen = Number(inventoryMinutes); source = inventoryLive ? 'inventory-authoritative' : 'catalog-shell'; }
    if (required > 0 && chosen != null) chosen = Math.min(required, Math.max(0, chosen));
    return { minutes: chosen, source };
  }

  // Page-scraped rows (`page:` IDs) give way to a real open campaign for the same game.
  function suppressPageShells(list, isOpen) {
    const titleKey = value => normalizeGameName(value);
    const real = new Set((list || []).filter(campaign => !/^page:/i.test(campaignKey(campaign)) && isOpen(campaign)).map(campaign => titleKey(gameOf(campaign))).filter(Boolean));
    if (!real.size) return list || [];
    return (list || []).filter(campaign => !/^page:/i.test(campaignKey(campaign)) || !real.has(titleKey(gameOf(campaign))));
  }

  function createDrops({ store, twitch, campaigns, claims = null, campaignsPage = null, page, controller = () => null, cookie = () => '', now = Date.now, log = () => {}, onChange = () => {} } = {}) {
    let inventory = [], inventoryHealth = { valid: false, status: 'not-seen', at: 0, lastValidAt: 0 };
    let haveInventory = false;
    const details = new Map(), detailsMisses = new Map(), detailsAttempts = new Map();
    let sessionNote = null, sessionDrop = null, available = [];
    let lastPollAt = 0, nextPollAt = now() + POLL_STARTUP_QUIET_MS, pendingReason = 'startup', inFlight = false, errorStreak = 0, lastError = '', dashboardAt = 0;
    const target = () => controller()?.snapshot().target || null;
    const isOpen = (campaign, at = now()) => campaigns.state(campaign, null, at).open;

    function campaignsFromMemory(at) {
      const memory = store.campaignMemory();
      return Object.entries(memory.campaigns || {}).filter(([, record]) => record && !record.completedAt && !['expired', 'completed', 'closed'].includes(cleanText(record.status).toLowerCase())
        && cleanText(record.game) && Math.max(0, Number(record.completedWatchDrops || 0)) < Math.max(1, Number(record.watchDrops || 1)))
        .map(([key, record]) => ({ id: record.id || key, name: cleanText(record.name) || cleanText(record.game), status: 'ACTIVE', startAt: record.startAt || '', endAt: record.endAt || '', game: { id: '', displayName: cleanText(record.game), name: cleanText(record.game), slug: '' }, timeBasedDrops: [] }))
        .filter(campaign => !campaignIsExcluded(campaign) && isOpen(campaign, at));
    }

    // The campaign pool: catalog, details, live inventory progress, remembered open campaigns and the open All
    // campaigns page's rows while the viewer has it open, page shells
    // dropped for real campaigns, inventory-claimed rewards marked, and the selected reward's progress
    // reconciled with a matching session counter.
    function pool(at = now()) {
      const merged = mergeCampaigns(mergeCampaigns(campaigns.catalog(), [...details.values()]), inventory, mergeCampaigns(campaignsFromMemory(at), campaignsPage?.rows() || []));
      const routable = suppressPageShells(merged, campaign => isOpen(campaign, at));
      const claimed = claims ? claims.overlayClaimed(routable) : routable;
      return overlaySession(claimed, at);
    }
    function overlaySession(list, at) {
      const selected = target();
      if (!selected?.id || !sessionDrop) return list;
      const identity = sessionIdentity(sessionDrop, selected);
      if (!identity.matches) return list;
      const key = cleanText(selected.campaignKey || selected.campaignId).toLowerCase();
      const live = inventory.some(campaign => campaignKey(campaign) === key && dropsOf(campaign).some(drop => drop.id === selected.id));
      return list.map(campaign => {
        if (campaignKey(campaign) !== key || !isOpen(campaign, at)) return campaign;
        const drops = dropsOf(campaign).map(drop => {
          if (drop.id !== selected.id) return drop;
          const { minutes } = reconcileProgress({ sessionMinutes: sessionDrop.currentMinutes, inventoryMinutes: drop.self?.currentMinutesWatched, required: Number(drop.requiredMinutesWatched || 0), inventoryLive: live });
          return minutes == null ? drop : { ...drop, self: { ...(drop.self || {}), currentMinutesWatched: minutes, dropInstanceID: drop.self?.dropInstanceID || sessionDrop.dropInstanceID || '' } };
        });
        return { ...campaign, timeBasedDrops: drops };
      });
    }

    // Inventory: open campaigns become the live progress source; an ended one is remembered as ended.
    function acceptInventory(row, at) {
      const result = inventoryResponseState(row);
      inventoryHealth = { valid: result.valid, status: result.status, at, lastValidAt: result.valid ? at : inventoryHealth.lastValidAt };
      if (!result.valid) return null;
      const viewerId = cleanText(row?.data?.currentUser?.id);
      if (/^\d{1,32}$/.test(viewerId)) store.session.set('viewerId', viewerId);
      claims?.nativeEvidence(row?.data?.currentUser?.inventory, result.campaigns);
      inventory = result.campaigns.filter(campaign => {
        const current = campaigns.state(campaign, null, at);
        if (current.reason === 'expired') campaigns.markCompleted(campaignKey(campaign), { id: campaign?.id, name: campaign?.name, game: gameOf(campaign), startAt: campaign?.startAt, endAt: campaign?.endAt, source: 'campaign-ended', status: 'expired' });
        return current.listed || current.reason === 'completed' || current.reason === 'ignored-game';
      });
      haveInventory = true;
      campaigns.remember(inventory, 'inventory');
      claims?.reconcile(result.campaigns);
      void claims?.sweep(result.campaigns, 'inventory-poll');
      return inventory;
    }

    // The dashboard replaces catalog membership; rows keep known details and live progress, and page rows for
    // games the dashboard omitted stay selectable.
    function acceptDashboard(list, at) {
      if (!Array.isArray(list)) return;
      dashboardAt = at;
      const selected = controller()?.snapshot().target;
      campaigns.retireUnlisted(list, { keep: [...inventory, ...(selected ? [cleanText(selected.campaignKey || selected.campaignId)] : [])] });
      // The saved catalog row first (3.x withKnownCampaignDetails): names, channel lists and credit it already knew.
      const saved = new Map(campaigns.catalog().map(item => [campaignKey(item), item]));
      const rows = list.map(campaign => mergeCampaigns(saved.has(campaignKey(campaign)) ? [saved.get(campaignKey(campaign))] : [], [campaign], details.has(campaignKey(campaign)) ? [details.get(campaignKey(campaign))] : [], inventory.filter(item => campaignKey(item) === campaignKey(campaign)))[0]);
      const games = new Set(rows.map(campaign => normalizeGameName(gameOf(campaign))).filter(Boolean));
      const pageRows = campaigns.catalog().filter(campaign => /^page:/i.test(campaignKey(campaign)) && !games.has(normalizeGameName(gameOf(campaign))));
      campaigns.saveCatalog(mergeCampaigns(rows, pageRows));
      // Twitch's own category slugs are trusted, so a slug that cannot be derived from the name still routes (3.x).
      for (const campaign of rows) if (gameOf(campaign) && campaign?.game?.slug) page.rememberSlug?.(gameOf(campaign), campaign.game.slug, 'twitch-gql');
      campaigns.remember(rows, 'viewer-drops-dashboard');
    }

    const detailsMissed = (key, at = now()) => { const missedAt = detailsMisses.get(cleanText(key).toLowerCase()) || 0; return Boolean(missedAt && at - missedAt < DETAILS_MISS_TTL_MS); };

    // DropCampaignDetails for the campaign the controller waits on, or a selected reward still missing its name or
    // watch requirement. Once per minute per campaign; an empty answer is remembered for 15 minutes.
    async function loadDetails(at) {
      const state = controller()?.snapshot() || {};
      const selected = state.target;
      const waiting = state.state === 'waiting' && state.waitReason === 'campaign-details';
      const key = cleanText(waiting ? state.waitingFor : selected?.campaignKey || selected?.campaignId).toLowerCase();
      if (!key || /^page:/i.test(key) || detailsMissed(key, at)) return false;
      const campaign = pool(at).find(item => campaignKey(item) === key);
      if (!campaign?.id) return false;
      const record = dropsOf(campaign).find(drop => String(drop?.id) === String(selected?.id));
      const incomplete = Boolean(!waiting && selected && (!record || !cleanText(record.name || record.benefitEdges?.[0]?.benefit?.name) || !(Number(record.requiredMinutesWatched) > 0)));
      // Twitch credits another reward of the same campaign: one lookup to learn its prerequisites (3.x).
      const sibling = Boolean(!waiting && selected && sessionDrop && cleanText(sessionDrop.campaignKey || sessionDrop.campaignId).toLowerCase() === key && String(sessionDrop.id) !== String(selected.id) && !details.has(key));
      if (!waiting && !incomplete && !sibling) return false;
      if (waiting && dropsOf(campaign).length && !watchDrops(campaign).length) { detailsMisses.set(key, at); return false; }
      if (at - (detailsAttempts.get(key) ?? -Infinity) < DETAILS_RETRY_MS) return false;
      const viewerId = cleanText(store.session.get('viewerId', ''));
      if (!/^\d{1,32}$/.test(viewerId)) return false;
      detailsAttempts.set(key, at);
      const asked = context();
      let detailed = null;
      try {
        const [row] = await twitch.request([{ op: 'dropCampaignDetails', variables: { dropID: String(campaign.id), channelLogin: viewerId } }]);
        const found = row?.data?.user?.dropCampaign || row?.data?.dropCampaign || null;
        if (found?.id && String(found.id) === String(campaign.id) && !(Array.isArray(row?.errors) && row.errors.length)) detailed = found;
      } catch (error) { log('campaign-details', 'DropCampaignDetails skipped', { message: cleanText(error?.message || error) }); return false; }
      if (!detailed || !Array.isArray(dropsOf(detailed))) return false;
      if (!sameContext(asked)) { log('campaign-details', 'Late reward details ignored', { campaignKey: key }); return false; }
      const found = dropsOf(detailed).length > 0;
      if (found) details.set(key, compactCampaigns(mergeCampaigns([campaign], [detailed]))[0]);
      if (!found || !watchDrops(detailed).length) detailsMisses.set(key, at);
      log('campaign-details', found ? `Loaded reward details for ${campaign.name || key}` : `No reward details returned for ${campaign.name || key}`, { campaignKey: key });
      return found;
    }

    // The reward session and supported campaigns on the current channel; the controller gets them as evidence.
    async function loadSession(channel, channelId, at) {
      const selected = target();
      const note = { at, channel, responseStatus: null, identityLevel: 'none', dropId: null, campaignKey: null, minutes: null, error: null };
      sessionDrop = null; available = [];
      try {
        const requests = [{ op: 'currentDrop', variables: { channelLogin: channel } }];
        if (channelId) requests.push({ op: 'availableDrops', variables: { channelID: channelId } });
        const asked = context();
        const rows = await twitch.request(requests);
        if (!sameContext(asked)) { note.responseStatus = 'stale'; sessionNote = note; return; }
        available = channelId ? parseAvailableCampaigns(rows[1]) : [];
        if (available.length) claims?.nativeEvidence(null, available);
        note.responseStatus = sessionResponseState(rows[0]).status;
        sessionDrop = parseSessionDrop(rows[0], mergeCampaigns(pool(at), available));
        if (sessionDrop && selected?.game && sessionDrop.game && !gameNamesMatch(sessionDrop.game, selected.game)) sessionDrop = null;
        note.dropId = sessionDrop?.id || null;
        note.campaignKey = sessionDrop?.campaignKey || null;
        note.minutes = sessionDrop?.currentMinutes ?? null;
        note.identityLevel = sessionDrop && selected ? sessionIdentity(sessionDrop, selected).level : 'none';
      } catch (error) { note.error = cleanText(error?.message || error); note.responseStatus = 'error'; }
      sessionNote = note;
      controller()?.observe({ channel, available, session: sessionDrop });
    }

    function wantsDashboard(at) {
      const state = controller()?.snapshot() || {};
      if (/^\/drops\/(?:campaigns|inventory)/.test(page.path())) return true;
      if (state.state === 'select' || (state.state === 'waiting' && ['no-eligible-campaign', 'campaign-details'].includes(state.waitReason))) return true;
      return !campaigns.catalog().length || !dashboardAt || at - dashboardAt > DASHBOARD_STALE_MS;
    }

    // A reply belongs to the account and page it was asked for (3.x pollContextIsCurrent).
    const context = () => ({ account: cleanText(store.login?.() || cookie('login')).toLowerCase(), path: page.path() });
    const sameContext = asked => { const current = context(); return current.account === asked.account && current.path === asked.path; };
    async function poll(reason = 'heartbeat') {
      const at = now();
      lastPollAt = at;
      if (!cookie('auth-token')) { lastError = 'Not logged in'; onChange('status', 'Waiting for Twitch login…'); return false; }
      const channel = page.login();
      const dashboard = wantsDashboard(at);
      const requests = [{ op: 'inventory' }];
      if (dashboard) requests.push({ op: 'viewerDropsDashboard' });
      if (channel) requests.push({ op: 'streamInfo', variables: { channel } });
      try {
        const asked = context();
        const rows = await twitch.request(requests, { allowInventoryFailure: true });
        if (!sameContext(asked)) { log('poll', 'Late Drop state ignored after an account or page change', { reason }); return false; }
        let index = 0;
        acceptInventory(rows[index++], at);
        if (dashboard) acceptDashboard(rows[index++]?.data?.currentUser?.dropCampaigns, at);
        const streamRow = channel ? rows[index++] : null;
        await loadDetails(now());
        if (channel) await loadSession(channel, streamRow?.data?.user?.id ? String(streamRow.data.user.id) : '', now());
        else { sessionNote = null; sessionDrop = null; available = []; }
        lastError = '';
        errorStreak = 0;
        log('poll', `Drop state refreshed (${reason})`);
        onChange('data');
        return true;
      } catch (error) {
        if (error?.inventoryRow) acceptInventory(error.inventoryRow, at);
        lastError = cleanText(error?.message || error);
        errorStreak += 1;
        log('poll-error', 'Drop state refresh failed', { message: lastError, reason });
        onChange('status', /Not logged in/.test(lastError) ? 'Waiting for Twitch login…' : `Drops update failed: ${lastError}`);
        return false;
      }
    }

    function interval() {
      if (errorStreak > 0) return Math.min(POLL_INTERVAL_MS * 2 ** Math.min(errorStreak - 1, 3), POLL_MAX_BACKOFF_MS);
      const state = controller()?.snapshot() || {};
      if (!state.target || ['select', 'find-stream', 'open-stream', 'verify', 'waiting'].includes(state.state)) return POLL_RECOVERY_INTERVAL_MS;
      const creditedAt = Number(store.session.get('creditedProgressAt', 0)) || 0;
      return creditedAt && now() - creditedAt > 90 * 1000 ? POLL_RECOVERY_INTERVAL_MS : POLL_INTERVAL_MS;
    }

    // Asks for a poll soon; urgent ones may run 5 s after the last instead of 15 s.
    function request(reason = 'heartbeat', urgent = false) {
      pendingReason = reason;
      const due = urgent ? Math.max(now(), lastPollAt + POLL_URGENT_GAP_MS) : now();
      if (!nextPollAt || due < nextPollAt) nextPollAt = due;
    }
    async function heartbeat() {
      const at = now();
      if (inFlight || !nextPollAt || at < nextPollAt) return false;
      if (lastPollAt && at - lastPollAt < POLL_URGENT_GAP_MS) return false;
      const circuit = twitch.snapshot?.()?.network;
      if (circuit?.open) { nextPollAt = Math.max(nextPollAt, circuit.openUntil || 0); onChange('status', `Network pause · ${circuit.reason || 'Protection active'}`); return false; }
      inFlight = true;
      try { return await poll(pendingReason); }
      finally { inFlight = false; nextPollAt = now() + interval(); pendingReason = 'heartbeat'; }
    }

    // Twitch's own replies seen on the page (bridge.js): the same paths as a poll, without a request of Dropper's.
    function ingest(rows, operations = [], source = 'twitch-page-intercept') {
      if (!Array.isArray(rows) || !rows.length) return false;
      const at = now();
      let inventoryRow = null, dashboard = null, sessionRow = null, channelCampaigns = null;
      const detailed = [];
      rows.forEach((row, index) => {
        if (!row || typeof row !== 'object') return;
        const data = row.data;
        if (operations?.[index]?.name === 'Inventory' || Object.hasOwn(data?.currentUser || {}, 'inventory')) inventoryRow = row;
        if (!data || typeof data !== 'object' || (Array.isArray(row.errors) && row.errors.length)) return;
        const found = data.user?.dropCampaign || data.dropCampaign;
        if (found?.id && Array.isArray(dropsOf(found))) detailed.push(found);
        if (Array.isArray(data.currentUser?.dropCampaigns)) dashboard = data.currentUser.dropCampaigns;
        if (data.currentUser?.dropCurrentSession || data.currentUser?.dropCurrentSessionContext) sessionRow = row;
        const list = data.channelDropCampaigns || data.channel?.viewerDropCampaigns || data.user?.viewerDropCampaigns || data.channel?.dropCampaigns;
        if (Array.isArray(list)) channelCampaigns = list;
      });
      if (!inventoryRow && !dashboard && !sessionRow && !channelCampaigns && !detailed.length) return false;
      if (inventoryRow) acceptInventory(inventoryRow, at);
      if (dashboard) acceptDashboard(dashboard, at);
      for (const found of detailed) {
        const key = campaignKey(found), known = pool(at).find(item => campaignKey(item) === key);
        if (key && dropsOf(found).length) details.set(key, compactCampaigns(mergeCampaigns(known ? [known] : [], [found]))[0]);
      }
      const channel = page.login();
      if (channel && (sessionRow || channelCampaigns)) {
        if (channelCampaigns) { available = parseAvailableCampaigns({ data: { channel: { viewerDropCampaigns: channelCampaigns } } }); claims?.nativeEvidence(null, available); }
        if (sessionRow) {
          const selected = target();
          sessionDrop = parseSessionDrop(sessionRow, mergeCampaigns(pool(at), available));
          if (sessionDrop && selected?.game && sessionDrop.game && !gameNamesMatch(sessionDrop.game, selected.game)) sessionDrop = null;
        }
        controller()?.observe({ channel, available, session: sessionDrop });
      }
      log('page-gql', 'Twitch page data seen', { source, inventory: Boolean(inventoryRow), dashboard: Boolean(dashboard), session: Boolean(sessionRow), channel: Boolean(channelCampaigns), details: detailed.length });
      onChange('data');
      return true;
    }

    // A confirmed claim: mark the reward claimed in the live data straight away (the next poll confirms it).
    function markClaimed(attempt) {
      const key = cleanText(attempt?.campaignId).toLowerCase(), id = cleanText(attempt?.rewardId);
      if (!key || !id) return;
      inventory = inventory.map(campaign => (campaignKey(campaign) !== key && cleanText(campaign?.id).toLowerCase() !== key) ? campaign
        : { ...campaign, timeBasedDrops: dropsOf(campaign).map(drop => (cleanText(drop?.id) === id ? { ...drop, self: { ...(drop.self || {}), isClaimed: true } } : drop)) });
      request('claim-confirmation', true);
    }

    return Object.freeze({
      campaigns: pool, inventory: () => inventory, session: () => sessionNote, sessionDrop: () => sessionDrop, available: () => available,
      detailsMissed, poll, heartbeat, request, markClaimed, interval, ingest,
      snapshot: () => ({ inventoryHealth, haveInventory, lastPollAt, nextPollAt, errorStreak, lastError, dashboardAt, details: details.size, session: sessionNote }),
    });
  }

  // Twitch's own GQL traffic on the page, as 3.8.3 read it: a small hook in the page world (fetch and XHR to
  // gql.twitch.tv) passes Dropper only the Drops fields it uses, behind a per-load secret. From it Dropper learns the
  // page's current query hashes, its integrity token and session headers, and sees inventory, dashboard, details,
  // reward session and channel campaigns without waiting for its own poll. Page events are untrusted: every payload
  // is validated and bounded before use.
  function twitchPageNetworkHook(channel, correlation, supportedNames) {
    if (window.__tdhTwitchNetHooked) return;
    window.__tdhTwitchNetHooked = 1;
    const limit = 1024 * 1024, supported = new Set(supportedNames);
    const endpoint = value => {
      try { const p = new URL(String(value || ''), location.href);
        const pathname = p.pathname.replace(/\/+$/, '') || '/';
        return p.protocol === 'https:' && p.hostname==="gql.twitch.tv" && !p.port && !p.username && !p.password &&
          !p.hash && ['/gql', '/integrity'].includes(pathname) ? pathname : ''; } catch (_) { return ''; }
    };
    const scope = () => {
      const get = key => {
        const value = document.cookie.split(';').map(x => x.trim()).find(x => x.startsWith(key + '='));
        try { return value ? decodeURIComponent(value.slice(key.length + 1)) : ''; } catch (_) { return ''; }
      };
      return {account: (get('login') || get('name') || 'signed-out').toLowerCase(), path: location.pathname};
    };
    const headerNames = new Set(['client-id', 'client-integrity', 'x-device-id', 'device-id', 'client-session-id', 'client-version']);
    const headers = input => {
      const output = {};
      try { new Headers(input || {}).forEach((value, key) => { if (headerNames.has(key)) output[key] = value; }); } catch (_) {}
      return output;
    };
    const operations = body => {
      try {
        if (typeof body !== 'string' || body.length > limit) return null;
        const rows = [].concat(JSON.parse(body));
        if (!rows.length || rows.length > 50) return null;
        return rows.map(row => ({name: row?.operationName || '', hash: row?.extensions?.persistedQuery?.sha256Hash || '', variableKeys: Object.keys(row?.variables || {})}));
      } catch (_) { return null; }
    };
    const pick = (value, keys) => value === null ? null : value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(keys.filter(key => Object.hasOwn(value, key)).map(key => [key, value[key]])) : undefined;
    const emit = (url, capturedHeaders, text, status, requestScope, ops) => {
      try {
        if (typeof text !== 'string' || text.length > limit || status < 200 || status >= 300) return;
        let json = JSON.parse(text), selectedOps = null;
        if (endpoint(url) === '/integrity') json = pick(json, ['token', 'expiration']);
        else {
          const rows = [].concat(json);
          if (!ops || rows.length !== ops.length) return;
          json = []; selectedOps = [];
          ops.forEach((op, index) => {
            if (!supported.has(op.name)) return;
            const row = rows[index], data = pick(row?.data, ['currentUser', 'channelDropCampaigns', 'channel', 'user', 'dropCampaign', 'claimDropRewards']);
            if (data?.currentUser) data.currentUser = pick(data.currentUser, ['id', 'inventory', 'dropCampaigns', 'dropCurrentSession', 'dropCurrentSessionContext']);
            if (data?.channel) data.channel = pick(data.channel, ['viewerDropCampaigns', 'dropCampaigns']);
            if (data?.user) data.user = pick(data.user, ['viewerDropCampaigns', 'dropCampaign', 'id', 'login', 'displayName', 'stream', 'broadcastSettings']);
            if (data?.claimDropRewards) data.claimDropRewards = pick(data.claimDropRewards, ['status']);
            json.push({data, ...(Array.isArray(row?.errors) ? {errors: row.errors.slice(0, 10).map(error => ({message: String(error?.message || 'Twitch request failed').slice(0, 240)}))} : {})});
            selectedOps.push(op);
          });
          if (!json.length) return;
        }
        window.dispatchEvent(new CustomEvent(channel, {detail: {secret: correlation, url, headers: capturedHeaders, json, status, requestScope, operations: selectedOps}}));
      } catch (_) {}
    };
    const nativeFetch = window.fetch;
    if (typeof nativeFetch === 'function') window.fetch = function(input, init) {
      const url = typeof input === 'string' ? input : input?.url || String(input || '');
      if (!endpoint(url)) return nativeFetch.apply(this, arguments);
      const capturedHeaders = headers(init?.headers || input?.headers), requestScope = scope();
      let body = Promise.resolve(init?.body);
      try { if (init?.body === undefined && typeof input?.clone === 'function') body = input.clone().text(); } catch (_) {}
      body = body.catch(() => undefined);
      return nativeFetch.apply(this, arguments).then(response => {
        try { Promise.all([response.clone().text(), body]).then(([text, requestBody]) => emit(url, capturedHeaders, text, response.status, requestScope, operations(requestBody))).catch(() => {}); } catch (_) {}
        return response;
      });
    };
    const X = window.XMLHttpRequest;
    if (typeof X !== 'function') return;
    const open = X.prototype.open, setHeader = X.prototype.setRequestHeader, send = X.prototype.send;
    X.prototype.open = function(method, url) {
      this.__tdhUrl = String(url || ''); this.__tdhHeaders = {};
      return open.apply(this, arguments);
    };
    X.prototype.setRequestHeader = function(name, value) {
      const key = String(name).toLowerCase();
      if (headerNames.has(key)) (this.__tdhHeaders ||= {})[key] = String(value);
      return setHeader.apply(this, arguments);
    };
    X.prototype.send = function(body) {
      if (endpoint(this.__tdhUrl)) {
        const requestScope = scope(), ops = operations(body), url = this.__tdhUrl, capturedHeaders = {...this.__tdhHeaders};
        this.addEventListener('load', () => {
          try { const text = this.responseType === 'json' ? JSON.stringify(this.response) : this.responseText;
            emit(url, capturedHeaders, text, this.status, requestScope, ops); } catch (_) {}
        }, {once: true});
      }
      return send.apply(this, arguments);
    };
  }

  function createBridge({ store, twitch, drops, page, pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window, log = () => {} } = {}) {
    // 3.x's names, so the carried-over code reads as it did.
    const storageAccountLogin = () => store.login();
    const syncViewingContext = () => page.sync();
    let twitchNetworkHooksInstalled = false, twitchNetworkHookMode = 'not-installed';
    function handleInterceptedTwitchPayload(url, headers, json, status = 200, operations = null) {
      twitch.captureHeaders(headers);
      if (!json) return;
      if (String(url || '').includes('/integrity')) {
        const expiration = Number(json.expiration);
        twitch.acceptPageIntegrity(json.token, expiration > 1e12 ? expiration : expiration * 1000);
        return;
      }
      if (status >= 200 && status < 300) {
        try { twitch.learnFromPage(operations, Array.isArray(json) ? json : [json]); } catch (_) { /* learning is best effort */ }
      }
      try { drops.ingest(Array.isArray(json) ? json : [json], operations || [], 'twitch-page-intercept'); } catch (_) { /* non-Drops or error payloads */ }
    }

    // Page events are untrusted. The correlation token is not authentication.
    // Bound traversal before copying, and expose only the fields Drops consumes.
    function validateTwitchBridgePayload(detail, correlation) {
      try {
        if (!detail || detail.secret !== correlation) return null;
        const url = new URL(detail.url, location.href);
        const pathname = url.pathname.replace(/\/+$/, '') || '/';
        if (url.protocol !== 'https:' || url.hostname !== 'gql.twitch.tv' || url.port || url.username || url.password ||
            !['/gql', '/integrity'].includes(pathname) || url.hash) return null;
        if (detail.requestScope?.account !== storageAccountLogin() || detail.requestScope?.path !== location.pathname) return null;
        if (!Number.isInteger(detail.status) || detail.status < 200 || detail.status >= 300) return null;
        const seen = new Set();
        let nodes = 0, bytes = 0;
        const bounded = (value, depth = 0) => {
          if (++nodes > 100000 || depth > 32) return false;
          if (value == null || typeof value === 'boolean') return true;
          if (typeof value === 'number') return Number.isFinite(value);
          if (typeof value === 'string') { bytes += value.length * 2; return bytes <= 2 * 1024 * 1024; }
          if (typeof value !== 'object' || seen.has(value)) return false;
          seen.add(value);
          if (Array.isArray(value) && value.length > 10000) return false;
          for (const [key, property] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
            bytes += key.length * 2 + 16;
            if (bytes > 2 * 1024 * 1024 || ['__proto__', 'constructor', 'prototype'].includes(key) ||
                !Object.hasOwn(property, 'value') || !bounded(property.value, depth + 1)) return false;
          }
          return true;
        };
        if (!bounded(detail.json) || !bounded(detail.headers || {}) || !bounded(detail.operations)) return null;
        const headers = {};
        const limits = {'client-id': 64, 'client-integrity': 8192, 'x-device-id': 128, 'device-id': 128, 'client-session-id': 128, 'client-version': 128};
        for (const [key, value] of Object.entries(detail.headers || {})) {
          const name = key.toLowerCase();
          if (!Object.hasOwn(limits, name)) continue;
          if (typeof value !== 'string' || !value.length || value.length > limits[name] || !/^[\x21-\x7e]+$/.test(value)) return null;
          headers[name] = value;
        }
        if (headers['client-id'] && !CLIENT_IDS.includes(headers['client-id'])) return null;
        if (pathname === '/integrity') {
          const token = detail.json?.token, expiration = detail.json?.expiration;
          const expiresAt = expiration > 1e12 ? expiration : expiration * 1000;
          if (typeof token !== 'string' || !/^[\x21-\x7e]{1,8192}$/.test(token) ||
              !Number.isFinite(expiration) || expiresAt <= Date.now() || expiresAt > Date.now() + 24 * 60 * 60 * 1000) return null;
          return {url: url.href, headers, status: detail.status, json: {token, expiration}, operations: null};
        }
        const rows = Array.isArray(detail.json) ? detail.json : [detail.json];
        const operations = detail.operations;
        if (!Array.isArray(operations) || !operations.length || operations.length > 50 || rows.length !== operations.length) return null;
        const supported = new Set(Object.values(GQL_OPS).map(op => op.name));
        const selectedRows = [], selectedOperations = [];
        const pick = (value, keys) => value === null ? null : value && typeof value === 'object' && !Array.isArray(value)
          ? Object.fromEntries(keys.filter(key => Object.hasOwn(value, key)).map(key => [key, value[key]])) : undefined;
        for (let index = 0; index < operations.length; index++) {
          const op = operations[index], row = rows[index];
          if (!op || typeof op.name !== 'string' || op.name.length > 80 || !/^[a-f0-9]{64}$/i.test(op.hash || '') ||
              !Array.isArray(op.variableKeys) || op.variableKeys.length > 20 ||
              op.variableKeys.some(key => typeof key !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(key) || ['__proto__', 'constructor', 'prototype'].includes(key))) return null;
          if (!supported.has(op.name)) continue;
          if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
          if ((!Object.hasOwn(row, 'data') && !(Array.isArray(row.errors) && row.errors.length)) ||
              (Object.hasOwn(row, 'data') && row.data !== null && (typeof row.data !== 'object' || Array.isArray(row.data))) ||
              (Object.hasOwn(row, 'errors') && !Array.isArray(row.errors))) return null;
          const data = pick(row.data, ['currentUser', 'channelDropCampaigns', 'channel', 'user', 'dropCampaign', 'claimDropRewards']);
          if (data?.currentUser) data.currentUser = pick(data.currentUser, ['id', 'inventory', 'dropCampaigns', 'dropCurrentSession', 'dropCurrentSessionContext']);
          if (data?.channel) data.channel = pick(data.channel, ['viewerDropCampaigns', 'dropCampaigns']);
          if (data?.user) data.user = pick(data.user, ['viewerDropCampaigns', 'dropCampaign', 'id', 'login', 'displayName', 'stream', 'broadcastSettings']);
          if (data?.claimDropRewards) data.claimDropRewards = pick(data.claimDropRewards, ['status']);
          selectedRows.push({data, ...(Array.isArray(row.errors) ? {errors: row.errors.slice(0, 10).map(error => ({message: typeof error?.message === 'string' ? error.message.slice(0, 240) : 'Twitch request failed'}))} : {})});
          selectedOperations.push({name: op.name, hash: op.hash.toLowerCase(), variableKeys: [...op.variableKeys]});
        }
        return selectedRows.length ? {url: url.href, headers, status: detail.status, json: selectedRows, operations: selectedOperations} : null;
      } catch (_) { return null; }
    }

    function installTwitchNetworkHooks(uw = pageWindow) {
      if (twitchNetworkHooksInstalled || !uw) return;
      twitchNetworkHooksInstalled = true;

      const channel = "tdh-twitch-gql-intercept-v1";
      const secret = `tdh-${Math.random().toString(36).slice(2, 10)}`;
      const onPayload = (event) => {
        const detail = validateTwitchBridgePayload(event?.detail, secret);
        if (!detail) return;
        syncViewingContext();
        handleInterceptedTwitchPayload(detail.url, detail.headers || {}, detail.json, detail.status, detail.operations);
      };
      try { uw.addEventListener(channel, onPayload, true); } catch (_) { /* ignore */ }
      try { window.addEventListener(channel, onPayload, true); } catch (_) { /* ignore */ }

      // Page-world inject keeps ad-blocker failures off the Dropper.user.js stack.
      const injector = `(${twitchPageNetworkHook.toString()})(${JSON.stringify(channel)},${JSON.stringify(secret)},${JSON.stringify(Object.values(GQL_OPS).map(op => op.name))});`;

      twitchNetworkHookMode = "unavailable";
      try {
        const script = document.createElement("script");
        script.textContent = injector;
        (document.documentElement || document.head || document.body).appendChild(script);
        script.remove();
        if (uw.__tdhTwitchNetHooked) twitchNetworkHookMode = "page-script";
      } catch (_) {
        /* CSP may block injection; Dropper still polls GQL over GM. */
      }
      // Safari often strips inline script tags. Eval/Function on unsafeWindow
      // still installs the page-world hook without wrapping userscript fetch.
      if (twitchNetworkHookMode === "unavailable") {
        try {
          if (typeof uw.eval === "function") uw.eval(injector);
          else if (typeof uw.Function === "function") uw.Function(injector)();
          if (uw.__tdhTwitchNetHooked) twitchNetworkHookMode = "page-eval";
        } catch (_) {
          /* Safari userscripts may still be unable to hook page fetch. */
        }
      }
    }

    return Object.freeze({ install: () => installTwitchNetworkHooks(pageWindow), mode: () => twitchNetworkHookMode });
  }

  // What the menu and card show, as plain data built from the module snapshots. No DOM; the UI only paints it.

  // Status text from several modules: one owner, a fixed order. A data-layer problem (login, network pause,
  // failed update) holds until a poll succeeds; a claim notice or page notice lasts a minute; otherwise the
  // controller's own status shows. A menu action's own message (ui) shows for a minute above claims.
  const STATUS_ORDER = ['drops', 'ui', 'claims', 'controller', 'page'];
  const STATUS_TRANSIENT_MS = 60 * 1000;

  function createStatusOwner({ now = Date.now } = {}) {
    const latest = {};
    return Object.freeze({
      set(source, text) { latest[source] = { text: cleanText(text), at: now() }; },
      clear(source) { delete latest[source]; },
      current(controllerText = '') {
        const at = now();
        for (const source of STATUS_ORDER) {
          if (source === 'controller') { if (cleanText(controllerText)) return { source, text: cleanText(controllerText) }; continue; }
          const entry = latest[source];
          if (!entry?.text) continue;
          if (source !== 'drops' && at - entry.at > STATUS_TRANSIENT_MS) continue;
          return { source, text: entry.text };
        }
        return { source: '', text: '' };
      },
    });
  }

  const HEALTHY_DELAYED_MS = 5 * 60 * 1000;
  const CARD_TONE_COLORS = { Stalled: '#ef4444', Delayed: '#f59e0b' };

  // The card's state label, in 3.x's order and wording.
  // Holds where the viewer picked the stream; Twitch crediting it still reads as earning (3.x manualEarningVerified).
  const VIEWER_HOLDS = ['manual-stream', 'stream-locked', 'protected-channel'];
  function cardState({ loggedIn, paused, reward, state, verified, diagnosis, background, heldEarning = false }) {
    if (!loggedIn) return ['Login required', 'warn'];
    if (paused) return ['Paused', 'warn'];
    if (reward?.needsDropDetails) return ['Details pending', 'warn'];
    if (reward && reward.requiredMinutes > 0 && reward.currentMinutes >= reward.requiredMinutes) return [reward.isClaimed ? 'Claimed ✓' : 'Earned', 'good'];
    if (state === 'verify') return ['Verifying', 'warn'];
    if (state === 'open-stream') return ['Opening', 'warn'];
    if (state === 'find-stream') return ['Finding', 'warn'];
    if (state === 'waiting') return ['Waiting', 'warn'];
    if (heldEarning && reward) return [background ? 'BG earning' : 'Earning', 'good'];
    if (state === 'earning' && reward) {
      const held = { 'credit-delayed-background': ['BG delayed', 'warn'], 'foreground-revalidation-grace': ['Rechecking', 'warn'], 'credit-stalled': ['Stalled', 'bad'], 'credit-delayed': ['Delayed', 'warn'], buffering: ['Delayed', 'warn'] }[diagnosis];
      if (held) return held;
      return verified ? [background ? 'BG earning' : 'Earning', 'good'] : ['Syncing', 'warn'];
    }
    return reward ? ['Waiting', ''] : ['Idle', ''];
  }

  function shortAge(ms) {
    const seconds = Math.max(0, Math.floor(ms / 1000));
    return seconds < 60 ? `${seconds}s` : seconds < 3600 ? `${Math.floor(seconds / 60)}m` : `${Math.floor(seconds / 3600)}h`;
  }

  // The strip's second line when Twitch is not counting (it takes the bar's place).
  function stripPause({ controller, game, creditAge = 0 }) {
    if (controller.diagnosis === 'credit-stalled') return { text: creditAge ? `Stalled · no credit for ${shortAge(creditAge)}` : 'Stalled · no new credit', tone: 'bad' };
    if (controller.mismatchSince) return { text: game ? `Wrong category · ${game}` : 'Wrong category', tone: 'warn' };
    if (controller.offlineSince) return { text: 'Stream offline', tone: 'bad' };
    return null;
  }

  // The one status line that replaced stream health, eligibility, earning confidence and switch history.
  function statusLine({ label, tone, status, reward, switching }) {
    const heading = { Earning: 'Earning', 'BG earning': 'Earning in background', Syncing: 'Waiting for Twitch', Stalled: 'Progress stalled', Delayed: 'Credit delayed', 'BG delayed': 'Credit delayed', Rechecking: 'Rechecking', Paused: 'Paused', 'Login required': 'Login required', 'Claimed ✓': 'Claimed', Earned: 'Earned' }[label] || 'Waiting for Twitch';
    const fallback = !reward ? 'No active reward is selected.' : switching ? 'Waiting for an eligible stream.' : 'Dropper is waiting for campaign or credited-progress evidence.';
    return { label: heading, detail: status || fallback, tone: tone === 'good' ? 'good' : tone === 'bad' ? 'bad' : tone || reward ? 'warn' : 'muted' };
  }

  // The switching select: off, normal or stopped-earning, or "held" with the reason it is held.
  function switchingPolicy({ settings, locked, manualStream, switchingTab }) {
    const heldLabel = locked ? 'Stream Locked' : !switchingTab ? 'Not Enabled in This Tab' : 'Manual Stream Protected';
    const value = !settings.findNextStream ? 'off' : locked || manualStream || !switchingTab ? 'held' : settings.switchPolicy === 'stopped-earning' ? 'stopped-earning' : 'normal';
    return { value, heldLabel };
  }

  function buildView({ now = Date.now(), loggedIn = false, settings = {}, controller = {}, reward = null, intent = {}, channel = '', game = '', lastPollAt = 0, status = '', switchingTab = false, locked = false, background = false, campaigns = null, deadline = null, unclaimed = [], peers = 0, inCharge = true, eligibility = null, creditedAt = 0, playing = false }) {
    const creditAge = creditedAt > 0 ? Math.max(0, now - creditedAt) : 0;
    const heldEarning = controller.state === 'paused' && VIEWER_HOLDS.includes(controller.waitReason) && playing && creditedAt > 0 && creditAge < HEALTHY_DELAYED_MS && Number(reward?.currentMinutes) > 0;
    const [label, tone] = cardState({ loggedIn, paused: Boolean(intent.paused), reward, state: controller.state, verified: Boolean(controller.verification), diagnosis: controller.diagnosis, background: background && settings.backgroundEarning, heldEarning });
    const unknown = !reward || reward.needsDropDetails;
    const percent = unknown || reward.percent == null ? null : Math.max(0, Math.min(100, Math.round(reward.percent)));
    const credited = unknown || reward.currentMinutes == null ? '—' : reward.currentMinutes;
    const required = unknown || !reward.requiredMinutes ? '—' : reward.requiredMinutes;
    const known = !unknown && reward.currentMinutes != null && reward.requiredMinutes > 0;
    const pause = stripPause({ controller, game, creditAge });
    const age = reward && lastPollAt ? shortAge(now - lastPollAt) : '';
    return {
      card: {
        label, tone, shortLabel: { 'Login required': 'Login', 'Details pending': 'Details' }[label] || label,
        dot: CARD_TONE_COLORS[label] || (/Earning|Claim/.test(label) ? '#22c55e' : '#9147ff'),
        rewardName: reward ? reward.name || 'Current Drop' : 'Waiting for Twitch to start a Drop session',
        game: reward?.game || game || '', channel: channel || '', percent, credited, required,
        minutesTitle: unknown ? (reward ? 'Loading Drop details' : '') : reward.requiredMinutes ? `${reward.currentMinutes == null ? 'Pending' : reward.currentMinutes} / ${reward.requiredMinutes} min` : 'Waiting for first credited minute',
        pauseText: intent.paused || !reward ? 'Resume' : 'Pause', pauseDisabled: !reward || !channel || !loggedIn,
        checked: age || '—', checkedTitle: age ? `Checked ${age} ago` : 'Checked —',
        stripPause: reward ? pause : null,
        stripLeft: !pause && known ? `· ${Math.max(0, Math.ceil(reward.requiredMinutes - reward.currentMinutes))}m` : '',
        image: reward?.rewardImage || '',
      },
      status: statusLine({ label, tone, status, reward, switching: settings.findNextStream }),
      titleProgress: percent == null ? '' : `${percent}%`,
      policy: switchingPolicy({ settings, locked, manualStream: Boolean(intent.manualStream), switchingTab }),
      reward, controller, state: controller.state || '', loggedIn,
      campaigns: campaigns || campaignRows({ strategy: settings.campaignStrategy }),
      deadline: deadlineLine(deadline), inventory: inventoryRow(reward, percent), unclaimed,
      multiTab: multiTabLine(peers, inCharge), accountLink: accountLinkText(eligibility, reward), eligibilityCode: eligibility?.code || '',
    };
  }

  // With other Dropper tabs open: which one switches streams.
  function multiTabLine(peers, inCharge) {
    if (!peers) return null;
    return inCharge
      ? { role: 'controller', text: `Multi-tab safety · This tab controls switching · ${peers} other Dropper tab${peers === 1 ? '' : 's'} passive` }
      : { role: 'passive', text: 'Multi-tab safety · Passive tab · another Dropper tab controls automatic switching' };
  }
  // An unlinked game account still earns watch time; the warning says so (3.x wording).
  function accountLinkText(eligibility, reward) {
    if (!(eligibility?.code === 'account-link' || eligibility?.accountLink === true)) return '';
    const game = cleanText(reward?.game);
    return `${game || 'This campaign'} requires a linked game account to claim rewards. Dropper still earns its watch time.`;
  }

  // ——— Campaigns section ———
  const UNCLAIMED_CLAIM_SOON_MS = 5 * 24 * 60 * 60 * 1000;
  const STRATEGY_LABELS = { priority: 'My Priority', deadline: 'Ending Soonest', completion: 'Closest to Completion', shortest: 'Shortest Remaining' };
  const viewNumber = value => (value !== null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null);
  const viewDrops = campaign => campaign?.timeBasedDrops || campaign?.drops || [];
  const viewGame = campaign => cleanText(campaign?.game?.displayName || campaign?.game?.name || campaign?.gameName || (typeof campaign?.game === 'string' ? campaign.game : ''));
  const viewDropName = drop => cleanText(drop?.name || drop?.benefitEdges?.[0]?.benefit?.name || drop?.benefit?.name || drop?.rewards?.[0]?.name || 'Reward');
  const viewSubs = drop => viewNumber(drop?.requiredSubs ?? drop?.requiredSubscriptions ?? drop?.requiredSubscriptionCount ?? drop?.subscriptionRequirement?.requiredSubs) || 0;
  // "2d 4h", "5h 10m", or "12m".
  function viewSpan(minutes) {
    const total = Math.max(0, Math.round(Number(minutes) || 0));
    if (total < 60) return `${total}m`;
    if (total < 1440) return `${Math.floor(total / 60)}h ${total % 60}m`;
    return `${Math.floor(total / 1440)}d ${Math.floor((total % 1440) / 60)}h`;
  }
  function campaignEndLabel(endAt, endMs = 0, now = Date.now()) {
    const ms = Number(endMs) || Date.parse(endAt || '') || 0;
    if (!ms) return 'No end date';
    if (ms <= now) return 'Expired';
    try { return `Ends ${new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`; } catch (_) { return `Ends ${cleanText(endAt)}`; }
  }

  // The planner line above the list: total watch time, campaign count, first end, at-risk and untimed counts.
  function campaignPlanText(queue, { isIgnored = () => false, now = Date.now() } = {}) {
    let campaigns = 0, remaining = 0, unknown = 0, atRisk = 0, earliest = 0;
    for (const item of queue || []) {
      if (!item || isIgnored(item.game)) continue;
      campaigns += 1;
      const left = viewNumber(item.sequenceRemainingMinutes);
      if (left === null) unknown += 1; else remaining += Math.max(0, left);
      if (item.sequenceFinishable === false) atRisk += 1;
      const endMs = viewNumber(item.endMs);
      if (endMs !== null && endMs > now && endMs < Number.MAX_SAFE_INTEGER / 2 && (!earliest || endMs < earliest)) earliest = endMs;
    }
    if (!campaigns) return '';
    const known = campaigns - unknown;
    const parts = [known > 0 ? `~${viewSpan(remaining)} watch` : 'Watch time unknown', `${campaigns} campaign${campaigns === 1 ? '' : 's'}`];
    if (earliest > now) parts.push(`First ends ${viewSpan((earliest - now) / 60000)}`);
    if (atRisk) parts.push(`${atRisk} at risk`);
    if (unknown && known > 0) parts.push(`${unknown} untimed`);
    return parts.join(' · ');
  }

  // Unclaimed subscription rewards per game key: { count, maxSubs }.
  function subscriptionRewards(campaigns, keyOf) {
    const result = new Map();
    for (const campaign of campaigns || []) {
      const key = keyOf(viewGame(campaign));
      if (!key) continue;
      for (const drop of viewDrops(campaign)) {
        const subs = viewSubs(drop);
        if (drop?.self?.isClaimed === true || !subs) continue;
        const entry = result.get(key) || { count: 0, maxSubs: 0 };
        entry.count += 1; entry.maxSubs = Math.max(entry.maxSubs, subs);
        result.set(key, entry);
      }
    }
    return result;
  }
  const subscriptionText = entry => (entry?.count ? `${entry.count} subscription reward${entry.count === 1 ? '' : 's'} (up to ${entry.maxSubs} sub${entry.maxSubs === 1 ? '' : 's'})` : '');

  // Open games in the order Dropper picks them (or the ranked order under My priority), with each row's line.
  function campaignRows({ games = [], order = [], strategy = 'priority', pickOrder = [], watching = '', queue = [], pool = [], now = Date.now(), failed = false }) {
    const key = game => normalizeGameName(game);
    const visible = order.filter(entry => games.some(item => key(item.game) === entry));
    const manual = strategy === 'priority';
    const position = (list, item) => { const index = list.indexOf(key(item.game)); return index < 0 ? Number.MAX_SAFE_INTEGER : index; };
    const sorted = [...games].sort((a, b) => (manual ? 0 : position(pickOrder, a) - position(pickOrder, b)) || position(visible, a) - position(visible, b));
    const watchingKey = key(watching), nextKey = pickOrder.find(entry => entry !== watchingKey) || '';
    const subs = subscriptionRewards(pool, key);
    const ignoredCount = games.filter(item => item.ignored).length;
    const ignoredKeys = new Set(games.filter(item => item.ignored).map(item => key(item.game)));
    const rows = sorted.map((item, index) => {
      const gameKey = key(item.game);
      const lead = gameKey && gameKey === watchingKey ? 'Watching · ' : gameKey && gameKey === nextKey && !item.ignored ? 'Next · ' : '';
      const end = campaignEndLabel(item.latestEndAt, item.latestEndMs, now), extra = subscriptionText(subs.get(item.key));
      return {
        game: item.game, key: item.key, ignored: item.ignored, latestEndMs: item.latestEndMs, rank: manual ? visible.indexOf(gameKey) : index,
        meta: `${lead}${item.campaignCount} campaign${item.campaignCount === 1 ? '' : 's'} · ${item.campaignCount > 1 ? `Latest ${end.toLowerCase()}` : end}${extra ? ` · ${extra}` : ''}`,
      };
    });
    return {
      rows, manual, strategy, strategyLabel: STRATEGY_LABELS[strategy] || STRATEGY_LABELS.priority, ignored: ignoredCount, failed,
      plan: rows.length ? campaignPlanText(queue, { isIgnored: game => ignoredKeys.has(key(game)), now }) : '',
    };
  }

  // Finished but unclaimed watch rewards, longest since ending first (those close soonest).
  function unclaimedRewards(campaigns, now = Date.now()) {
    const items = [];
    for (const campaign of campaigns || []) {
      const endMs = Date.parse(campaign?.endAt || ''), ended = Number.isFinite(endMs) && endMs > 0 && endMs <= now;
      for (const drop of viewDrops(campaign)) {
        if (drop?.self?.isClaimed === true || viewSubs(drop)) continue;
        const required = viewNumber(drop?.requiredMinutesWatched ?? drop?.requiredMinutes), current = viewNumber(drop?.self?.currentMinutesWatched ?? drop?.currentMinutes);
        if (required === null || required <= 0 || current === null || current < required) continue;
        const item = { name: viewDropName(drop), game: viewGame(campaign), ended, endedAgoMs: ended ? now - endMs : 0, claimSoon: ended && now - endMs >= UNCLAIMED_CLAIM_SOON_MS };
        item.line = `${item.name}${item.game ? ` · ${item.game}` : ''} · ${ended ? `campaign ended ${viewSpan(item.endedAgoMs / 60000)} ago` : 'campaign still running'}${item.claimSoon ? ' · claim soon' : ''}`;
        items.push(item);
      }
    }
    return items.sort((a, b) => b.endedAgoMs - a.endedAgoMs || a.game.localeCompare(b.game));
  }

  // The deadline line under Campaigns, from the shared eligibility deadline.
  function deadlineLine(deadline) {
    if (!Number.isFinite(deadline?.minutesUntilDeadline)) return null;
    const minutes = Math.max(0, Math.round(deadline.minutesUntilDeadline));
    const left = viewSpan(minutes);
    const required = Number.isFinite(deadline.requiredMinutes) ? Math.max(0, Math.round(deadline.requiredMinutes)) : null;
    if (deadline.finishable === false) return { tone: 'bad', text: `⚠ Campaign ends in ${left} · ${required ?? '?'} min watch still required · Not finishable in time` };
    return { tone: minutes <= 60 ? 'warn' : 'muted', text: `Campaign ends in ${left}${required !== null ? ` · ${required} min watch remaining` : ''}${deadline.urgency === 'tight' ? ' · Close deadline' : ''}` };
  }

  // The Drops inventory row for the selected reward.
  function inventoryRow(reward, percent) {
    if (!reward) return { name: 'No active Drop', meta: 'Waiting for Twitch', state: 'Idle' };
    const current = reward.currentMinutes == null || reward.currentMinutes === '' ? null : Number(reward.currentMinutes), required = Number(reward.requiredMinutes) || 0;
    const done = required > 0 && current !== null && current >= required;
    return {
      name: reward.name || 'Current Drop',
      meta: reward.needsDropDetails ? 'Twitch details pending' : required && Number.isFinite(current) && current >= 0 ? `${current} / ${required} Min` : 'Progress pending',
      state: reward.needsDropDetails ? 'Details pending' : reward.isClaimed ? 'Claimed' : done ? 'Claim ready' : percent == null ? 'Progress pending' : `${percent}%`,
    };
  }

  // The menu, the progress card and the update notice. Layout, markup and styles are 3.8.3's, carried over as
  // written minus the controls 4.0 removed; what they show comes from one view model (view.js), painted by the
  // render functions at the end of this file.
  const RELEASES_URL = 'https://github.com/ExtraPotions/Dropper/releases';
  const LAST_VERSION_KEY = 'dropper-last-version-v2';
  const UPDATE_NOTICE_DURATION_MS = 30 * 1000;
  const UPDATE_RELOAD_KEY = 'dropper-update-reload-pending';
  const UPDATE_RETURN_DELAY_MS = 3 * 1000;
  const UPDATE_RELOAD_FALLBACK_MS = 45 * 1000;
  const UPDATE_RELOAD_PENDING_TTL_MS = 2 * 60 * 1000;
  const QUIET_RELEASES = Object.freeze(['3.4.43', '3.4.30', '3.4.27', '3.4.26']);
  const RELEASE_NOTES = {
    '4.0.2': ["The one-line card (Drop Details off) has its own Menu button.", "The Dropper gem is purple throughout. Built on Core 3.17.2."],
    '4.0.1': ["Release notes show in full in the changelog card.", "Built on Core 3.17.1."],
    '4.0.0': ["Dropper is rebuilt from the ground up; your settings, priorities and claim history carry over.", "The progress card stays in view in place of the Stream Chat title bar, and the menu opens from its edge like a file cabinet.", "Turn off Drop Details in Look for a one-line card. Hide Chat on the card collapses Twitch chat, and Expand Chat stays in reach.", "Labels are in Title Case. Built on Core 3.17.0."],
  };
  const UPDATE_NOTICE_TURN = 'dropper:update';
  const SKIP_STREAMER_ARM_MS = 3000;
  const SKIP_STREAMER_ARM_TICK_MS = 250;
  const TWITCH_LOGIN_URL = 'https://www.twitch.tv/login';
  const TWITCH_CONNECTIONS_URL = 'https://www.twitch.tv/settings/connections';
  const TWITCH_CHAT_TOGGLE = '[data-a-target="right-column__toggle-collapse-btn"]';
  const TWITCH_KEEP_CLEAR = TWITCH_CHAT_TOGGLE + ',[data-a-target="player-controls"],.player-controls,#live-channel-stream-information,[data-a-target="stream-info-card-component"],.channel-info-content';

  function createUi({ store, controller, drops, claims, page, tabs, intent, campaigns, view, saveSettings: save, log = () => {}, notify = () => {}, manualLock = () => null, poll = () => {}, sections = [], resetKeys = [], now = Date.now } = {}) {
    // 3.x's names, so the carried-over code reads as it did.
    const DEFAULTS = SETTING_DEFAULTS;
    const viewingIntent = intent;
    const logActivity = log;
    const setStatus = text => { notify(text); render(); };
    const contentWarningMemory = page.warnings;
    const syncViewingContext = () => page.sync();
    const ensureStreamPlaying = force => page.resume(force);
    const restoreChannelPlayer = force => page.restorePlayer(force);
    const watchingLogin = () => page.login();
    const requestGqlPoll = (reason, urgent) => poll(reason, urgent);
    const claimAutomationTab = () => tabs.chooseForSwitching?.();
    const claimNotice = changeId => ExtraPotionsCore.claimNotice('dropper', changeId);
    const compareVersions = (a, b) => ExtraPotionsCore.compareVersions(a, b);
    // Settings read through a proxy; 3.x's "settings.x = y; saveSettings()" becomes one saved patch.
    let pendingSettings = {};
    const settings = new Proxy({}, {
      get: (_, name) => (Object.hasOwn(pendingSettings, name) ? pendingSettings[name] : store.settings()[name]),
      set: (_, name, value) => { pendingSettings[name] = value; return true; },
    });
    function saveSettings() { const patch = pendingSettings; pendingSettings = {}; return save(patch); }
    let currentDrop = null;
    let productResetting = false;
    let ui = null;
    let railOpen = false;
    let lastPanelId = '';
    let lastSubmenuId = '';
    let clusterTop = 0;
    let launcherGridDelta = 0;
    let siteColors = null;
    let updateNoticeTimer = null;
    let updateNoticeState = null;
    let lastUpdateNoticeVersion = '';
    let updateReloadTimer = null;
    let updateFallbackTimer = null;
    let waitingUpdateNotice = null;
    let skipStreamerArm = { login: '', expiresAt: 0 };
    let skipStreamerArmTimer = null;
    let lastNativeTitle = '';
    let lastView = null;

    function registerBadgeGrid(host, productId) {
      ExtraPotionsCore.registerDiagnosticsProduct(productId, APP_VERSION, host);
      ExtraPotionsCore.registerLauncher(host, { productId });
      const refreshProductChrome = () => requestAnimationFrame(() => {
        layoutChrome();
        ExtraPotionsCore.layoutFloatingNotices();
      });
      document.addEventListener('exp-core:coordination', refreshProductChrome);
      addEventListener('resize', refreshProductChrome, { passive: true });
      ExtraPotionsCore.layout();
    }
    function syncMenuSizing() {
      if (!ui?.cluster) return;
      ui.cluster.style.setProperty('--exp-menu-width', `${ExtraPotionsCore.menuWidth()}px`);
    }
    // With other ExtraPotions products on the page, update cards show one at a time.
    document.addEventListener('exp-core:notice-released', () => {
      if (!waitingUpdateNotice) return;
      const args = waitingUpdateNotice;
      waitingUpdateNotice = null;
      showUpdateNotice(...args);
    });
    // Update checks come from exp-core: a small lookup of the latest GitHub release.
    const updateChecker = ExtraPotionsCore.createReleaseUpdateChecker({
      productId: 'dropper',
      repository: 'ExtraPotions/Dropper',
      currentVersion: APP_VERSION,
    });

    function css() {
      return `
        :host { all: initial; }
        * { box-sizing: border-box; }
        .cluster {
          position: fixed; right: 12px; z-index: 2147483600;
          display: flex; flex-direction: column-reverse; align-items: flex-end;
          width: max-content; max-width: calc(100vw - 24px); gap: 8px;
          --exp-ui-opacity:1; --exp-menu-width:260px;
          font: 13px/1.42 ui-sans-serif, system-ui, "Segoe UI", sans-serif; color: var(--theme-text);
        }
        .cluster.open-up { flex-direction: column; }
        #tdh-tools-dock,
        #tdh-drop-card,
        .update-notice {
          opacity:1;
          transition:opacity .15s ease;
        }
        .progress-stack {
          width:min(var(--exp-menu-width,260px), calc(100vw - 24px));
          display:flex; flex-direction:column; align-items:stretch;
          transition:.15s width;
          gap:6px;
        }

        .cluster #tdh-tools-dock,
        .cluster > .update-notice[data-placement="menu"] {
          width:min(var(--exp-menu-width,260px), calc(100vw - 24px));
        }

        .progress-stack.badge-only .badge-row { justify-content:flex-end; min-height:48px!important; }
        .progress-stack.badge-only #tdh-settings-launcher {
          border-radius:12px;
          border-left:1px solid color-mix(in srgb, var(--theme-accent) 47%, transparent);
        }
        .badge-only-progress-slot{display:block;width:100%;margin:0 0 5px;min-width:0}
        .badge-only-progress-slot[hidden]{display:none!important}
        .badge-only-progress-slot #tdh-drop-card{position:relative!important;inset:auto!important;display:block!important;width:100%!important;min-width:0!important;max-width:none!important;margin:0!important}
        .compact-line { height:auto; min-height:48px; padding:6px 10px; display:grid; grid-template-columns:6px minmax(0,1fr) auto auto; gap:7px; align-items:center; cursor:pointer; }
        .compact-dot { width:6px; height:6px; border-radius:2px; background:#9147ff; }
        .compact-reward { font-size:var(--exp-font-size-small,11px); font-weight:800; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .compact-extra { font-size:var(--exp-font-size-small,11px); color:#b8b8c0; white-space:nowrap; }
        .state-pill { display:inline-flex; align-items:center; border:1px solid #34343a; border-radius:5px; padding:1px 5px; font-size:var(--exp-font-size-small,11px); font-weight:800; color:#d0d0d5; background:#1c1c21; white-space:nowrap; }
        .state-pill.good { color:#c8ffd7; border-color:#22c55e66; background:#22c55e18; }
        .state-pill.warn { color:#ffe5a8; border-color:#f59e0b66; background:#f59e0b18; }
        .state-pill.bad { color:#ffd1d1; border-color:#ef444466; background:#ef444418; }
        .stream-info { padding:7px 9px 6px; display:grid; grid-template-columns:32px minmax(0,1fr); gap:7px; align-items:center; }
        .stream-info-hidden { display:none; }
        .stream-head { min-width:0; display:flex; align-items:center; gap:5px; }
        .stream-channel { font-size:var(--exp-font-size-body,13px); font-weight:800; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .stream-live { font-size:var(--exp-font-size-small,11px); font-weight:900; background:#eb0400; color:#fff; border-radius:4px; padding:1px 4px; }
        .stream-title { display:none; }
        .stream-game { font-size:var(--exp-font-size-small,11px); color:#adadb8; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .stream-badges { display:flex; gap:4px; flex-wrap:nowrap; align-items:center; justify-self:end; font-size:var(--exp-font-size-small,11px); color:#8f8f98; }
        .stream-badges[hidden] { display:none !important; }
        .stream-badge { padding:1px 4px; border:1px solid #34343b; border-radius:99px; }
        .stream-badge.drops-enabled { color:#d7ffd7; border-color:#22c55e66; background:#22c55e18; }
        .stream-dot { color:#5f5f68; }
        .drop-section { padding:7px 9px 8px; border-top:1px solid #29292f; }
        .drop-kicker { font-size:var(--exp-font-size-small,11px); color:#bf94ff; font-weight:900; letter-spacing:.07em; text-transform:uppercase; margin-bottom:2px; }
        .drop-head { display:flex; align-items:center; justify-content:space-between; gap:8px; padding-right:24px; }
        .drop-name { font-size:var(--exp-font-size-body,13px); font-weight:800; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .drop-game { display:none; }
        .drop-bar-row { margin-top:6px; display:grid; grid-template-columns:minmax(0,1fr) auto; gap:7px; align-items:center; }
        .drop-bar { height:6px; border-radius:99px; background:#2b2b31; overflow:hidden; }
        .drop-bar > span { display:block; height:100%; width:0; background:#9147ff; transition:.2s width,.2s background; }
        .drop-percent { font-size:var(--exp-font-size-small,11px); font-weight:800; color:#bf94ff; min-width:28px; text-align:right; }
        .drop-meta { font-size:var(--exp-font-size-small,11px); color:#9c9ca5; margin-top:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .drop-status-row { margin-top:4px; display:flex; align-items:center; gap:6px; flex-wrap:wrap; font-size:var(--exp-font-size-small,11px); color:#a7a7b0; }
        .progress-age { color:#a7a7b0; }
        .progress-age.warn { color:#f59e0b; }
        .progress-age.bad { color:#ef4444; font-weight:800; }
        /* 3.2.0 progress panel */
        .cluster{pointer-events:none!important}
        .cluster :is(#tdh-tools-dock,.update-notice,#tdh-drop-card,#tdh-settings-launcher){pointer-events:auto!important}
        .cluster .progress-stack{height:auto;min-height:48px;pointer-events:none!important}
        .cluster .badge-row{position:fixed!important;min-height:112px!important;height:auto!important;justify-content:flex-end!important;align-items:center!important;pointer-events:none!important}
        .cluster[data-launcher-anchor="top"] #tdh-settings-launcher{align-self:flex-start!important}
        .cluster #tdh-drop-card[data-presentation="page-card"]{position:relative!important;inset:auto!important;right:auto!important;left:auto!important;top:auto!important;bottom:auto!important;flex:0 0 auto!important;margin:0!important}
        .cluster .badge-only-progress-slot #tdh-drop-card[data-presentation="menu-card"]{position:relative!important;inset:auto!important;right:auto!important;left:auto!important;width:100%!important;min-width:0!important;max-width:none!important;margin:0!important}
        /* In a short window the menu shows progress as one row (stream and percentage), so the section and subsection tabs stay in view; the details remain in Drops → Progress. */
        @media (max-height:480px){.cluster .badge-only-progress-slot #tdh-drop-card[data-presentation="menu-card"] :is(.progress-category,.drop-bar,.progress-reward-row,.drop-status-row){display:none!important}.cluster .badge-only-progress-slot #tdh-drop-card[data-presentation="menu-card"]{min-height:0!important}}

        .badge-row {display:flex!important;flex-wrap:nowrap!important;align-items:center!important;gap:8px!important;width:100%!important;min-height:112px!important;height:auto!important;position:relative!important}
        #tdh-drop-card {position:relative!important;order:0!important;flex:1 1 auto!important;width:auto!important;min-width:0!important;max-width:none!important;min-height:112px!important;margin:0!important;overflow:hidden!important;isolation:isolate!important;cursor:default!important;background:var(--theme-panel)!important;border:1px solid color-mix(in srgb,var(--theme-line) 94%,var(--theme-accent) 6%)!important;border-radius:12px!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.03),inset 0 0 18px rgba(255,255,255,.012),0 8px 28px #0006!important;opacity:1!important;transition:border-color .16s ease,box-shadow .16s ease!important}
        #tdh-drop-card:focus-within{border-color:color-mix(in srgb,var(--theme-line) 72%,var(--theme-accent) 28%)!important}
        #tdh-drop-card::before{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;border-radius:inherit;background-image:radial-gradient(circle,rgba(255,255,255,.045) .6px,transparent .7px);background-size:4px 4px;opacity:.18;mix-blend-mode:soft-light}
        #tdh-drop-card::after{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;border-radius:inherit;background:linear-gradient(to bottom,rgba(255,255,255,.018),rgba(255,255,255,.004) 28%,transparent 55%);opacity:1}
        #tdh-drop-card .expanded-content{position:relative!important;z-index:1!important;display:block!important}
        #tdh-drop-card .compact-line{display:none!important}
        .stream-info,.stream-info-hidden{min-height:110px!important;padding:10px 11px!important;display:block!important}
        .progress-copy{width:100%!important;min-width:0!important;display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;grid-template-areas:"head head" "category category" "bar bar" "reward reward" "status status"!important;column-gap:10px!important;row-gap:7px!important}
        .progress-head{grid-area:head!important;min-width:0!important;display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:10px!important;align-items:center!important}
        .stream-channel{min-width:0!important;color:var(--theme-text)!important;font-size:var(--exp-font-size-body,13px)!important;font-weight:850!important;line-height:1.15!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
        .progress-head .drop-percent{min-width:38px!important;color:var(--theme-accent2)!important;font-size:var(--exp-font-size-body,13px)!important;font-weight:900!important;line-height:1!important;text-align:right!important;white-space:nowrap!important}
        .progress-category{grid-area:category!important;min-width:0!important;color:var(--theme-muted)!important;font-size:var(--exp-font-size-small,11px)!important;line-height:1.15!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
        .drop-bar{grid-area:bar!important;height:7px!important;margin:1px 0 0!important;border-radius:3px!important;background:color-mix(in srgb,var(--theme-line) 62%,transparent)!important;overflow:hidden!important}
        .drop-bar>span{display:block!important;height:100%!important;width:0;border-radius:inherit!important;background:var(--theme-accent)!important}
        .progress-reward-row{grid-area:reward!important;min-width:0!important;display:flex!important;align-items:center!important;gap:6px!important;color:var(--theme-muted)!important;font-size:var(--exp-font-size-small,11px)!important;line-height:1.15!important}
        .progress-reward-row .drop-meta{margin:0!important;flex:0 0 auto!important;color:var(--theme-muted)!important;font-size:var(--exp-font-size-small,11px)!important;white-space:nowrap!important}
        .progress-dot{flex:0 0 auto!important;color:color-mix(in srgb,var(--theme-muted) 78%,transparent)!important}
        .progress-reward-row .drop-name{min-width:0!important;color:var(--theme-muted)!important;font-size:var(--exp-font-size-small,11px)!important;font-weight:650!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
        .drop-status-row{grid-area:status!important;min-width:0!important;margin:0!important;display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:8px!important;align-items:center!important;color:var(--theme-muted)!important;font-size:var(--exp-font-size-small,11px)!important;line-height:1!important}
        .status-meta-chip{box-sizing:border-box!important;min-width:0!important;height:24px!important;display:flex!important;align-items:center!important;overflow:hidden!important;border:1px solid color-mix(in srgb,var(--theme-line) 88%,var(--theme-accent) 12%)!important;border-radius:6px!important;background:color-mix(in srgb,var(--theme-bg) 94%,var(--theme-panel) 6%)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.018)!important}
        .drop-status-row .state-pill{box-sizing:border-box!important;min-width:0!important;min-height:0!important;height:22px!important;display:inline-flex!important;align-items:center!important;gap:5px!important;padding:0 8px!important;border:0!important;border-radius:0!important;background:transparent!important;color:var(--theme-muted)!important;font-size:var(--exp-font-size-small,11px)!important;font-weight:800!important;line-height:1!important;white-space:nowrap!important}
        .drop-status-row .state-pill::before{content:""!important;flex:0 0 auto!important;width:6px!important;height:6px!important;border-radius:2px!important;background:currentColor!important;box-shadow:0 0 7px color-mix(in srgb,currentColor 42%,transparent)!important}
        .drop-status-row .state-pill.good{color:light-dark(#21643b,#8fd7a0)!important}
        .drop-status-row .state-pill.warn{color:light-dark(#7a4b00,#e4bd6c)!important}
        .drop-status-row .state-pill.bad{color:light-dark(#9d2828,#dc9393)!important}
        .status-chip-divider{flex:0 0 auto!important;width:1px!important;height:12px!important;background:color-mix(in srgb,var(--theme-line) 82%,transparent)!important}
        .status-clock-icon{flex:0 0 auto!important;width:10px!important;height:10px!important;margin-left:7px!important;color:color-mix(in srgb,var(--theme-muted) 86%,var(--theme-text) 14%)!important}
        #tdh-updated-ago{box-sizing:border-box!important;min-width:0!important;max-width:100%!important;padding:0 8px 0 4px!important;border:0!important;color:var(--theme-muted)!important;font-size:var(--exp-font-size-small,11px)!important;font-weight:600!important;font-variant-numeric:tabular-nums!important;line-height:1!important;text-align:left!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
        .skip-streamer-chip{appearance:none!important;box-sizing:border-box!important;height:24px!important;min-height:24px!important;min-width:64px!important;max-width:82px!important;padding:0 9px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:5px!important;border:1px solid color-mix(in srgb,var(--theme-line) 72%,var(--theme-accent) 28%)!important;border-radius:6px!important;background:color-mix(in srgb,var(--theme-bg) 95%,var(--theme-accent) 5%)!important;color:color-mix(in srgb,var(--theme-text) 84%,var(--theme-accent) 16%)!important;font:800 var(--exp-font-size-small,11px)/1 ui-sans-serif,system-ui,sans-serif!important;cursor:pointer!important;white-space:nowrap!important;overflow:hidden!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.018)!important;transition:border-color .14s ease,background .14s ease,color .14s ease,box-shadow .14s ease!important}
        .skip-streamer-chip:hover,.skip-streamer-chip:focus-visible{border-color:color-mix(in srgb,var(--theme-accent) 72%,var(--theme-line) 28%)!important;background:color-mix(in srgb,var(--theme-panel) 88%,var(--theme-accent) 12%)!important;color:var(--theme-accent2)!important;box-shadow:0 0 0 1px color-mix(in srgb,var(--theme-accent) 16%,transparent)!important;outline:none!important}
        .skip-streamer-chip:disabled{opacity:.36!important;cursor:default!important;box-shadow:none!important}
        .skip-streamer-chip .skip-icon{flex:0 0 auto!important;width:10px!important;height:10px!important;fill:currentColor!important}
        .skip-streamer-chip .skip-label{min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
        .skip-streamer-chip .skip-countdown{display:inline-grid!important;place-items:center!important;min-width:18px!important;height:16px!important;margin-left:1px!important;padding:0 4px!important;border-radius:4px!important;background:#ef4444!important;color:#fff!important;font-size:var(--exp-font-size-small,11px)!important;font-weight:900!important;line-height:1!important}
        .skip-streamer-chip .skip-countdown[hidden]{display:none!important}
        .skip-streamer-chip.is-armed{min-width:94px!important;max-width:104px!important;border-color:color-mix(in srgb,#ef4444 62%,var(--theme-line))!important;background:color-mix(in srgb,var(--theme-panel) 90%,#ef4444 10%)!important;color:#efb0b0!important}
        .skip-streamer-chip.is-armed .skip-icon{display:none!important}
        .progress-stack .stream-info {padding:9px 10px!important}
        .progress-stack .progress-copy {row-gap:6px!important}
        .progress-stack .stream-channel,
        .progress-stack .progress-head .drop-percent {font-size:var(--exp-font-size-body,13px)!important}
        .progress-stack .progress-category,
        .progress-stack .progress-reward-row,
        .progress-stack .progress-reward-row .drop-meta,
        .progress-stack .progress-reward-row .drop-name {font-size:var(--exp-font-size-small,11px)!important}
        .progress-stack .drop-status-row {grid-template-columns:minmax(0,1fr) auto!important;gap:5px!important}
        .progress-stack .status-meta-chip {height:22px!important}
        .progress-stack .drop-status-row .state-pill {height:20px!important;gap:4px!important;padding-inline:6px!important;font-size:var(--exp-font-size-small,11px)!important}
        .progress-stack .drop-status-row .state-pill::before {width:5px!important;height:5px!important}
        .progress-stack .status-chip-divider {height:10px!important}
        .progress-stack .status-clock-icon {width:8.5px!important;height:8.5px!important;margin-left:5px!important}
        .progress-stack #tdh-updated-ago {padding:0 6px 0 3px!important;font-size:var(--exp-font-size-small,11px)!important}
        .progress-stack .skip-streamer-chip {height:22px!important;min-height:22px!important;min-width:49px!important;max-width:56px!important;padding-inline:7px!important;gap:4px!important;font-size:var(--exp-font-size-small,11px)!important}
        .progress-stack .skip-streamer-chip .skip-icon {width:9px!important;height:9px!important}
        .progress-stack .skip-streamer-chip.is-armed {min-width:94px!important;max-width:104px!important;padding-inline:6px!important}

        #tdh-drop-card[data-presentation="page-card"]{background:var(--theme-bg)!important;border-color:var(--theme-line)!important;border-radius:16px!important;box-shadow:0 16px 44px #0006!important;font:400 calc(var(--exp-font-size-body,14px) - 1px)/1.45 Inter,"Segoe UI",system-ui,sans-serif!important;letter-spacing:-.1px;transition:none!important}
        #tdh-drop-card::before,#tdh-drop-card::after{display:none!important}
        #tdh-drop-card .stream-channel{font-weight:600!important;line-height:1.35!important}
        #tdh-drop-card .drop-percent{font-weight:650!important;color:var(--theme-accent)!important}
        .strip-toggle,.strip-art,.strip-meta{display:none!important}
        .cluster #tdh-drop-card[data-presentation="strip"]{position:fixed!important;z-index:2147483598!important;box-sizing:border-box!important;min-height:0!important;height:52px!important;margin:0!important;padding:0 10px!important;background:#09090b!important;border:1px solid #27272a!important;border-radius:8px!important;box-shadow:none!important;pointer-events:auto!important;overflow:hidden!important;container-type:inline-size!important}
        .cluster #tdh-drop-card[data-presentation="strip"] .strip-toggle{appearance:none!important;display:block!important;position:absolute!important;inset:0!important;z-index:1!important;margin:0!important;padding:0!important;border:0!important;border-radius:8px!important;background:transparent!important;cursor:pointer!important}
        .cluster #tdh-drop-card[data-presentation="strip"] .strip-toggle:focus-visible{outline:2px solid #bc94f5!important;outline-offset:-2px!important}
        .cluster #tdh-drop-card[data-presentation="strip"] .expanded-content{pointer-events:none!important}
        .cluster #tdh-drop-card[data-presentation="strip"] .skip-streamer-chip{position:relative!important;z-index:2!important;pointer-events:auto!important}
        .cluster #tdh-drop-card[data-presentation="strip"]:not(.is-expanded) :is(.expanded-content,.stream-info){display:block!important;height:50px!important;padding:0!important;margin:0!important}
        .cluster #tdh-drop-card[data-presentation="strip"]:not(.is-expanded) .progress-copy{display:grid!important;grid-template-columns:36px minmax(0,auto) minmax(40px,1fr) auto auto!important;grid-template-areas:"art name name percent skip" "art meta bar bar skip"!important;align-content:center!important;align-items:center!important;column-gap:10px!important;row-gap:3px!important;height:50px!important;padding:0!important;margin:0!important}
        .cluster #tdh-drop-card[data-presentation="strip"]:not(.is-expanded) :is(.progress-head,.progress-reward-row,.drop-status-row){display:contents!important}
        .cluster #tdh-drop-card[data-presentation="strip"]:not(.is-expanded) :is(.progress-category,.progress-dot,.drop-meta,.stream-channel,.status-meta-chip){display:none!important}
        .cluster #tdh-drop-card[data-presentation="strip"]:not(.is-expanded) .strip-art{grid-area:art!important;display:grid!important;place-items:center!important;box-sizing:border-box!important;width:36px!important;height:36px!important;border:1px solid #3f3f46!important;border-radius:8px!important;background:#1d1a24!important;color:#bc94f5!important;overflow:hidden!important}
        .cluster #tdh-drop-card[data-presentation="strip"]:not(.is-expanded) .strip-art img{grid-area:1/1!important;width:100%!important;height:100%!important;object-fit:cover!important}
        .cluster #tdh-drop-card[data-presentation="strip"]:not(.is-expanded) .strip-art img[hidden]{display:none!important}
        .cluster #tdh-drop-card[data-presentation="strip"]:not(.is-expanded) .strip-art svg{grid-area:1/1!important;width:18px!important;height:18px!important}
        .cluster #tdh-drop-card[data-presentation="strip"]:not(.is-expanded) .strip-art img:not([hidden]) + svg{display:none!important}
        .cluster #tdh-drop-card[data-presentation="strip"]:not(.is-expanded) .drop-name{grid-area:name!important;min-width:0!important;font:600 13px/16px Inter,"Segoe UI",system-ui,sans-serif!important;color:#fafafa!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;margin:0!important}
        .cluster #tdh-drop-card[data-presentation="strip"]:not(.is-expanded) .drop-percent{grid-area:percent!important;font:650 13px/16px Inter,"Segoe UI",system-ui,sans-serif!important;color:#bc94f5!important;margin:0!important}
        .cluster #tdh-drop-card[data-presentation="strip"]:not(.is-expanded) .strip-meta{grid-area:meta!important;display:flex!important;gap:4px!important;min-width:0!important;overflow:hidden!important;font:400 12px/15px Inter,"Segoe UI",system-ui,sans-serif!important;color:#a1a1aa!important;white-space:nowrap!important}
        .cluster #tdh-drop-card[data-presentation="strip"]:not(.is-expanded) .strip-channel{min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important}
        .cluster #tdh-drop-card[data-presentation="strip"]:not(.is-expanded) .strip-left{flex:none!important}
        .cluster #tdh-drop-card[data-presentation="strip"][data-strip-pause]:not(.is-expanded) .strip-meta{grid-area:auto!important;grid-row:2!important;grid-column:2/5!important}
        .cluster #tdh-drop-card[data-presentation="strip"][data-strip-pause]:not(.is-expanded) .drop-bar{display:none!important}
        .cluster #tdh-drop-card[data-presentation="strip"][data-strip-pause="warn"]:not(.is-expanded) .strip-meta{color:#f2cf75!important}
        .cluster #tdh-drop-card[data-presentation="strip"][data-strip-pause="bad"]:not(.is-expanded) .strip-meta{color:#ff9ea6!important}
        .cluster #tdh-drop-card[data-presentation="strip"]:not(.is-expanded) .drop-bar{grid-area:bar!important;height:4px!important;min-height:4px!important;margin:0!important;border-radius:2px!important;background:#ffffff14!important;overflow:hidden!important}
        .cluster #tdh-drop-card[data-presentation="strip"]:not(.is-expanded) .drop-bar > span{background:#bc94f5!important;border-radius:2px!important}
        .cluster #tdh-drop-card[data-presentation="strip"]:not(.is-expanded) .skip-streamer-chip{grid-area:skip!important;height:36px!important;min-height:36px!important;padding:0 10px!important}
        /* In a narrow strip an armed Skip leaves no room for both the minutes and the bar; the bar steps aside while it counts down. */
        @container (max-width:300px){.cluster #tdh-drop-card[data-presentation="strip"]:not(.is-expanded) .progress-copy:has(.skip-streamer-chip.is-armed){grid-template-areas:"art name name percent skip" "art meta meta meta skip"!important}.cluster #tdh-drop-card[data-presentation="strip"]:not(.is-expanded) .progress-copy:has(.skip-streamer-chip.is-armed) .drop-bar{display:none!important}}
        .cluster #tdh-drop-card[data-presentation="strip"].is-expanded{height:auto!important;padding:12px!important;box-shadow:0 12px 32px #0008!important}
        .cluster #tdh-drop-card[data-presentation="strip"].is-expanded .strip-toggle{cursor:default!important}
        #tdh-drop-card :is(.stream-game,.drop-meta,.drop-name,.state-pill,#tdh-updated-ago){font-size:var(--exp-font-size-small,12px)!important;line-height:1.35!important;font-weight:400!important}
        #tdh-drop-card .status-meta-chip{border:0!important;background:transparent!important;box-shadow:none!important}
        #tdh-drop-card .state-pill::before{box-shadow:none!important}
        #tdh-drop-card .skip-streamer-chip{border-color:var(--theme-line)!important;background:transparent!important;color:var(--theme-text)!important;box-shadow:none!important;font-family:Inter,"Segoe UI",system-ui,sans-serif!important;font-weight:500!important}
        #tdh-drop-card .skip-streamer-chip:focus-visible{outline:2px solid var(--theme-focus)!important;outline-offset:2px!important}
        #tdh-drop-card .skip-streamer-chip.is-armed{border-color:#dc9393!important;color:#efb0b0!important}

        #tdh-settings-launcher {
          position:relative; width:48px; min-width:48px; height:48px; min-height:48px; align-self:flex-end; padding:0; margin:0;
          display:grid; place-items:center; border:1px solid color-mix(in srgb,var(--theme-accent) 30%,transparent); border-radius:10px;
          background:var(--theme-panel,#18181b); box-shadow:0 6px 22px #0006; cursor:grab; touch-action:none; user-select:none;
          transition:.14s border-color,.14s box-shadow,.14s background,.14s transform;
        }
        .action-pair{display:grid;grid-column:1/-1;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:6px}
        #tdh-clear-activity{grid-column:1/-1}
        .action-separator{grid-column:1/-1;width:100%;border:0;border-top:1px solid var(--theme-line,#34343b);margin:8px 0 0}
        .mini-row:has(#tdh-queue-preference){grid-column:1/-1}
        #tdh-queue-preference{width:124px;min-width:124px;max-width:124px;flex:0 0 124px}
        .action-pair>.life-btn{min-width:0;margin:0;white-space:normal}
        .stream-subsection-label{grid-column:1/-1;min-width:0;margin:1px 0 2px;color:var(--theme-accent2);font-size:var(--exp-font-size-small,11px);font-weight:900;line-height:1.2;letter-spacing:.08em;text-transform:uppercase}
        .stream-subsection-label.with-divider{margin-top:7px;padding-top:8px;border-top:1px solid var(--theme-line,#34343b)}
        #tdh-streams-body>.queue-switches,
        #tdh-streams-body>.queue-collapsible,
        #tdh-clear-skipped-streamers{grid-column:1/-1}
        .queue-switches{display:grid;grid-template-columns:minmax(58px,.7fr) minmax(0,1.3fr);column-gap:10px;row-gap:0;min-width:0;margin:6px 0;padding:2px 0;border:0;align-items:stretch}
        .queue-switches-label{grid-column:1;grid-row:1/span 3;display:flex;align-items:center;min-width:0;font-size:var(--exp-font-size-body,13px);font-weight:700;line-height:1.2;color:var(--theme-text,#efeff1)}
        .queue-switches>.fl-switch{grid-column:2;display:flex!important;flex-direction:row!important;align-items:center!important;justify-content:space-between!important;gap:10px;min-width:0;padding:5px 0!important;text-align:left!important}
        .queue-switches>.fl-switch>span:first-child{display:block;flex:1 1 auto;width:auto!important;min-width:0!important;min-height:0!important;white-space:normal!important;word-break:normal!important;overflow-wrap:normal!important;line-height:1.25;text-align:left}
        .queue-switches>.fl-switch>.toggleSwitch{flex:0 0 34px;margin-left:auto}
        #tdh-progress-body{padding-bottom:5px}
        #tdh-progress-body>.fl-switch,
        #tdh-progress-body>.mini-row{padding:4px 0}
        #tdh-progress-body>.theme-row{min-height:22px;padding:3px 0;gap:6px}
        .cluster #tdh-progress-body>.theme-row>span {display:none}
        .cluster #tdh-progress-body>.theme-row {gap:0}

        .appearance-separator{grid-column:1/-1;width:100%;border:0;border-top:1px solid var(--theme-line,#34343b);margin:3px 0 1px}

        #tdh-refresh-now,#tdh-reset-session{border-color:#cb6868!important;background:#402020!important;color:#ffd7d7!important}
        #tdh-settings-launcher:hover {
          border-color:color-mix(in srgb,var(--theme-accent) 58%,transparent);
          background:color-mix(in srgb,var(--theme-panel,#18181b) 96%,var(--theme-accent) 4%);
          box-shadow:0 8px 24px #0007; transform:scale(1.015);
        }
        #tdh-settings-launcher[aria-expanded="true"] {
          border-color:color-mix(in srgb,var(--theme-accent) 72%,transparent);
          background:var(--theme-panel,#18181b);
          box-shadow:0 0 0 1px color-mix(in srgb,var(--theme-accent) 22%,transparent),0 8px 26px #0008;
          transform:scale(1.01);
        }
        #tdh-settings-launcher.is-dragging {
          cursor:grabbing; transform:scale(1.03); box-shadow:0 10px 28px #0009;
        }
        #tdh-settings-launcher.update-available::after {
          content:"↑"; position:absolute; top:-4px; right:-4px; width:14px; height:14px; display:grid; place-items:center;
          border:2px solid var(--theme-panel,#18181b); border-radius:4px; background:#f59e0b; color:#111114; font-size:var(--exp-font-size-small,11px); font-weight:950;
          box-shadow:0 2px 6px #0007; z-index:4; pointer-events:none;
        }
        #tdh-settings-launcher .ring { position:absolute; top:50%; left:50%; width:44px; height:44px; pointer-events:none; transform:translate(-50%,-50%); }
        #tdh-settings-launcher .track { fill:none; stroke:color-mix(in srgb,var(--theme-line,#34343b) 72%,transparent); stroke-width:2.5; }
        #tdh-settings-launcher .fill { fill:none; stroke:var(--theme-accent,#9147ff); stroke-width:2.5; stroke-linecap:round; transition:.2s stroke; }
        #tdh-settings-launcher .icon { position:absolute; top:50%; left:50%; width:40px; height:40px; pointer-events:none; z-index:1; transform:translate(-50%,-50%); }
        #tdh-tools-dock {
          position:fixed; right:12px; top:auto; bottom:auto;
          display:none; width:min(var(--exp-menu-width,260px), calc(100vw - 24px)); max-width:calc(100vw - 24px);
          height:max-content; min-height:0; max-height:none; overflow-x:hidden; overflow-y:auto; overscroll-behavior:contain; flex:0 0 auto;
          transition:.15s width;
          padding:9px 9px 4px; background:var(--theme-bg); border:1px solid var(--theme-line); border-radius:14px; box-shadow:0 18px 50px #0008; color-scheme:dark;
        }
        #tdh-tools-dock.fl-rail-open { display:block; height:max-content; min-height:0; max-height:none; }
        #tdh-tools-dock:focus { outline:none; }
        #tdh-tools-dock :is(.fl-tool-body,.row,.group,.section,.fl-tool-title) { min-width:0; max-width:100%; overflow-wrap:anywhere; }
        #tdh-tools-dock :is(input,select,textarea) { min-width:0; max-width:100%; }
        #tdh-tools-dock :is(option,optgroup) { background:var(--theme-panel) !important; color:var(--theme-text) !important; }
        .menu-head {
          position:relative;
          display:grid; grid-template-columns:minmax(0,1fr) auto;
          align-items:start; gap:8px; width:100%;
        }
        .header-actions { display:flex; align-items:flex-start; gap:5px; position:static; }
        #tdh-rail-close {
          width:30px; height:30px; min-width:30px; padding:0;
          border:1px solid #3a3a42; border-radius:8px; background:#151519; color:#b8b8c0;
          cursor:pointer;
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
        #tdh-rail-title { margin:0; font-size:15px; font-weight:800; line-height:1.1; }
        #tdh-header-version {
          min-height:18px; padding:1px 6px; border:1px solid #4a3b61; border-radius:5px;
          background:#1b1721; color:#c9a7ff; cursor:pointer; font:800 var(--exp-font-size-small,11px)/1 ui-sans-serif,system-ui,sans-serif;
          white-space:nowrap;
        }
        #tdh-header-version:hover, #tdh-header-version:focus-visible {
          border-color:#9147ff; background:#251d31; color:#fff; outline:none;
        }
        #tdh-rail-subtitle {
          margin-top:2px; font-size:var(--exp-font-size-small,11px); line-height:1.2; color:#adadb8;
          white-space:normal; overflow-wrap:anywhere;
        }
        #tdh-rail-close { font:18px/1 Arial,sans-serif; }
        #tdh-rail-close:hover, #tdh-rail-close:focus-visible { border-color:#9147ff; color:#fff; background:#211b2b; outline:none; }
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
        .update-kicker { margin-bottom:2px; color:var(--theme-accent2); font-size:var(--exp-font-size-small,11px); font-weight:900; letter-spacing:.08em; text-transform:uppercase; }
        .update-title { font-size:var(--exp-font-size-body,13px); line-height:1.25; font-weight:850; color:var(--theme-text); }
        .update-version {
          flex:none; padding:2px 6px;
          border:1px solid color-mix(in srgb,var(--theme-accent) 62%,var(--theme-line));
          border-radius:5px;
          background:color-mix(in srgb,var(--theme-panel) 82%,var(--theme-accent) 18%);
          color:var(--theme-text);
          font-size:var(--exp-font-size-small,11px); font-weight:800; white-space:nowrap;
        }
        .update-text { margin-top:6px; font-size:var(--exp-font-size-small,11px); line-height:1.45; color:var(--theme-muted); white-space:normal; overflow:visible; }
        .update-list { margin:7px 0 0; padding:0 0 0 15px; color:var(--theme-text); font-size:var(--exp-font-size-small,11px); line-height:1.4; scrollbar-width:thin; }
        .update-list li::marker { color:var(--theme-accent); }
        .update-list li + li { margin-top:3px; }
        .update-footer { display:flex; justify-content:flex-end; gap:6px; margin-top:8px; padding-top:7px; border-top:1px solid var(--theme-line); }
        .update-action, .update-release, .update-dismiss, .life-btn {
          border:1px solid var(--theme-line); border-radius:7px;
          background:var(--theme-bg); color:var(--theme-text); cursor:pointer;
        }
        .update-action, .update-release { min-height:27px; padding:0 10px; font-family:inherit; font-size:var(--exp-font-size-small,11px); font-weight:800; }
        .update-action { display:inline-flex; align-items:center; justify-content:center; text-decoration:none; }
        .update-action[hidden], .update-release[hidden] { display:none; }
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
          border-color:transparent; background:transparent; color:var(--theme-muted); font-family:Arial,sans-serif; font-size:15px; line-height:1;
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
        .toast { margin-bottom:7px; padding:6px 8px; border:1px solid #34343b; border-radius:8px; background:#18181b; color:#efeff1; font-size:var(--exp-font-size-small,11px); box-shadow:0 8px 24px #0006; }
        .toast[hidden] { display:none; }
        .fl-tool-panel { position:relative; margin-top:5px; border:1px solid #27272d; background:#19191e; border-radius:9px; overflow:visible; }
        .fl-tool-header { display:flex; justify-content:space-between; align-items:flex-start; height:auto; min-height:0; padding:7px 8px; cursor:pointer; border-radius:8px; }
        .fl-tool-header:hover { background:#9147ff18; }
        .fl-tool-header.last-opened { box-shadow:inset 3px 0 0 #b783ff; }
        .fl-tool-title { min-width:0; flex:1; font-size:var(--exp-font-size-body,13px); font-weight:700; white-space:normal; overflow-wrap:anywhere; }
        .fl-tool-chevron { background:none; border:0; color:#adadb8; cursor:pointer; }
        .fl-tool-body { padding:0 10px 8px; }
        .fl-tool-body:not(.fl-tool-hidden) { display:grid; height:auto; min-height:0; max-height:none; overflow:visible; grid-template-columns:repeat(2,minmax(0,1fr)); align-items:stretch; column-gap:8px; }
        .cluster .fl-tool-body:not(.fl-tool-hidden) { grid-template-columns:minmax(0,1fr); }
        .cluster .fl-tool-body:not(.fl-tool-hidden) > * { grid-column:1/-1; }
        .fl-tool-body > :is(.fl-switch,.mini-row,.life-btn) { min-width:0; }
        .fl-tool-body > :is(.compact-inventory,.campaign-manager,.diag) { grid-column:1/-1; }
        #tdh-diagnostics-body { padding-bottom:2px; }
        #tdh-diagnostics-body > [data-dropper-tools] { grid-column:1/-1; min-width:0; display:grid; grid-template-columns:minmax(0,1fr)!important; gap:6px!important; margin-top:10px!important; align-items:stretch; }
        #tdh-diagnostics-body > [data-dropper-tools]:not(:has(> details[open])) { grid-auto-rows:1fr; }
        #tdh-diagnostics-body>[data-dropper-tools]>details[open]{grid-column:1/-1!important}
        #tdh-diagnostics-body>[data-dropper-tools]>details:not([open]){grid-column:auto!important}
        #tdh-diagnostics-body > [data-dropper-tools] > details { min-width:0; margin-top:0!important; padding:5px 10px!important; border:1px solid color-mix(in srgb,var(--theme-line) 72%,transparent); border-radius:8px; background:color-mix(in srgb,var(--theme-panel) 80%,var(--theme-raised) 20%); overflow-wrap:anywhere; transition:background .14s ease,border-color .14s ease; }
        #tdh-diagnostics-body > [data-dropper-tools] > details > summary { display:flex; align-items:center; justify-content:space-between; gap:8px; min-height:24px; list-style:none; cursor:pointer; color:var(--theme-text); font-size:var(--exp-font-size-body,13px); font-weight:600; line-height:1.3; border-radius:4px; }
        #tdh-diagnostics-body > [data-dropper-tools] > details > summary::-webkit-details-marker { display:none; }
        #tdh-diagnostics-body > [data-dropper-tools] > details > summary::after { content:""; flex:0 0 5px; width:5px; height:5px; margin-right:2px; border-right:1.5px solid var(--theme-muted); border-bottom:1.5px solid var(--theme-muted); transform:rotate(-45deg); }
        #tdh-diagnostics-body > [data-dropper-tools] > details[open] { border-color:color-mix(in srgb,var(--theme-accent) 30%,var(--theme-line)); }
        #tdh-diagnostics-body > [data-dropper-tools] > details[open] > summary::after { transform:rotate(45deg); }
        #tdh-diagnostics-body > [data-dropper-tools] > details:has(> summary:hover) { background:var(--theme-raised); border-color:color-mix(in srgb,var(--theme-accent) 25%,var(--theme-line)); }
        #tdh-diagnostics-body > [data-dropper-tools] > details > summary:focus-visible { outline:2px solid var(--theme-accent); outline-offset:4px; }
        #tdh-diagnostics-body :is(button,summary) { font-family:ui-sans-serif,system-ui,"Segoe UI",sans-serif; }
        #tdh-diagnostics-body > .action-pair > .life-btn { background:color-mix(in srgb,var(--theme-panel) 80%,var(--theme-raised) 20%); border-color:color-mix(in srgb,var(--theme-line) 72%,transparent); border-radius:8px; font-weight:600; }
        #tdh-diagnostics-body > .action-pair > .life-btn:hover { background:var(--theme-raised); border-color:color-mix(in srgb,var(--theme-accent) 25%,var(--theme-line)); }
        @media (prefers-reduced-motion:reduce) { #tdh-diagnostics-body > [data-dropper-tools] > details { transition:none; } }
        #tdh-diagnostics-body > [data-dropper-tools] :is(button,select) { max-width:100%; min-width:0; white-space:normal; }

        .fl-tool-hidden { display:none !important; }
        .fl-switch, .mini-row { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; height:auto; min-height:0; padding:6px 0; }
        .fl-switch + .fl-switch, .mini-row + .mini-row { border-top:1px solid #26262b; }
        .fl-switch-text, .mini-row > span {
          min-width:0;
          font-size:var(--exp-font-size-body,13px);
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
        .life-btn { width:100%; min-height:28px; margin-top:6px; font-size:var(--exp-font-size-body,13px); }
        .life-btn.last-opened { box-shadow:inset 3px 0 0 #b783ff; }
        .select-lite { min-width:0; max-width:72px; background:#111114; color:#efeff1; border:1px solid #34343b; border-radius:6px; padding:4px 6px; font-size:var(--exp-font-size-body,13px); }
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
          color:var(--theme-text);
          font-size:var(--exp-font-size-small,11px);
          font-weight:700;
        }
        .auth-required > span { min-width:0; white-space:nowrap; }
        .auth-required[hidden] { display:none !important; }
        .auth-required .life-btn {
          width:auto;
          min-width:64px;
          margin:0;
          flex:0 0 auto;
        }
        .account-link-warning {
          grid-column:1/-1; display:flex; align-items:center; justify-content:space-between; gap:8px;
          margin-top:6px; padding:8px; border:1px solid color-mix(in srgb,#f59e0b 58%,var(--theme-line));
          border-radius:8px; background:color-mix(in srgb,var(--theme-panel) 82%,#f59e0b 18%); color:var(--theme-text);
        }
        .account-link-warning[hidden] { display:none!important; }
        .account-link-warning-copy { min-width:0; display:flex; flex-direction:column; gap:2px; }
        .account-link-warning-copy strong { font-size:var(--exp-font-size-small,11px); line-height:1.2; }
        .account-link-warning-copy span { color:color-mix(in srgb,#ffe6ad 78%,var(--theme-muted)); font-size:var(--exp-font-size-small,11px); line-height:1.35; overflow-wrap:anywhere; }
        .account-link-warning .life-btn { width:auto; min-width:104px; margin:0; flex:0 0 auto; }
        .deadline-status {
          grid-column:1/-1; margin-top:6px; padding:6px 8px; border:1px solid var(--theme-line);
          border-radius:8px; background:var(--theme-inset); color:var(--theme-muted); font-size:var(--exp-font-size-small,11px); font-weight:750; line-height:1.35;
        }
        .deadline-status[hidden] { display:none!important; }
        .deadline-status[data-tone="warn"] { border-color:color-mix(in srgb,#e2b34a 58%,var(--theme-line)); color:color-mix(in srgb,#c77700 72%,var(--theme-text)); }
        .deadline-status[data-tone="bad"] { border-color:color-mix(in srgb,#df5b65 62%,var(--theme-line)); color:color-mix(in srgb,#d0222d 62%,var(--theme-text)); }
        .multi-tab-status {
          grid-column:1/-1; margin:3px 0 4px; padding:6px 8px; border:1px solid color-mix(in srgb,var(--theme-accent) 40%,var(--theme-line));
          border-radius:7px; background:color-mix(in srgb,var(--theme-panel) 92%,var(--theme-accent) 8%);
          color:var(--theme-muted); font-size:var(--exp-font-size-small,11px); font-weight:750; line-height:1.35;
        }
        .multi-tab-status[hidden] { display:none!important; }
        .multi-tab-status[data-role="controller"] { color:color-mix(in srgb,#76d69a 78%,var(--theme-text)); border-color:color-mix(in srgb,#3ac978 46%,var(--theme-line)); }
        .multi-tab-status[data-role="passive"] { color:color-mix(in srgb,#c77700 72%,var(--theme-text)); border-color:color-mix(in srgb,#e2b34a 55%,var(--theme-line)); }
        .session-recovery-status {
          grid-column:1/-1; margin:3px 0 4px; padding:6px 8px; border:1px solid color-mix(in srgb,#57b5ff 44%,var(--theme-line));
          border-radius:7px; background:color-mix(in srgb,var(--theme-panel) 92%,#57b5ff 8%); color:color-mix(in srgb,#a8d5ff 78%,var(--theme-text)); font-size:var(--exp-font-size-small,11px); font-weight:750; line-height:1.35;
        }
        .session-recovery-status[hidden] { display:none!important; }
        .campaign-strategy-row { padding:6px 8px; margin:0; border-bottom:1px solid var(--theme-line); }
        .campaign-strategy-row .select-lite { max-width:136px; width:136px; }
        .earning-confidence {
          grid-column:1/-1; display:flex; align-items:baseline; justify-content:space-between; gap:8px;
          margin:3px 0 4px; padding:7px 8px; border:1px solid var(--theme-line); border-radius:8px;
          background:var(--theme-inset); color:var(--theme-muted);
        }
        .earning-confidence strong { color:var(--theme-text); font-size:var(--exp-font-size-small,11px); line-height:1.25; }
        .earning-confidence span { min-width:0; text-align:right; font-size:var(--exp-font-size-small,11px); line-height:1.3; overflow-wrap:anywhere; }
        .earning-confidence[data-tone="good"] { border-color:color-mix(in srgb,#3ac978 56%,var(--theme-line)); }
        .earning-confidence[data-tone="warn"] { border-color:color-mix(in srgb,#e2b34a 58%,var(--theme-line)); }
        .earning-confidence[data-tone="bad"] { border-color:color-mix(in srgb,#df5b65 62%,var(--theme-line)); }
        .stream-health-list,.eligibility-checklist-list { padding:3px 8px 7px; }
        .status-check-row { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:8px; align-items:center; padding:5px 0; }
        .status-check-row + .status-check-row { border-top:1px solid var(--theme-line); }
        .status-check-label { min-width:0; color:var(--theme-muted); font-size:var(--exp-font-size-small,11px); line-height:1.3; }
        .status-check-value { max-width:150px; color:var(--theme-text); font-size:var(--exp-font-size-small,11px); font-weight:800; line-height:1.3; text-align:right; overflow-wrap:anywhere; }
        .status-check-value[data-tone="good"] { color:color-mix(in srgb,#1f9d55 72%,var(--theme-text)); }
        .status-check-value[data-tone="warn"] { color:color-mix(in srgb,#c77700 72%,var(--theme-text)); }
        .status-check-value[data-tone="bad"] { color:color-mix(in srgb,#d0222d 62%,var(--theme-text)); }
        #tdh-stream-lock[aria-pressed="true"] { border-color:color-mix(in srgb,var(--theme-accent) 72%,var(--theme-line)); background:color-mix(in srgb,var(--theme-panel) 76%,var(--theme-accent) 24%); }
        .campaign-priority-controls { display:flex; align-items:center; flex-wrap:wrap; gap:6px; margin-top:4px; color:var(--theme-text); font-size:var(--exp-font-size-small,11px); }
        #tdh-open-campaigns .campaign-priority-position { width:auto; min-width:72px; max-width:100%; min-height:36px !important; border-radius:5px; border-color:var(--theme-muted) !important; background:var(--theme-panel) !important; }
        #tdh-open-campaigns .campaign-priority-position:focus-visible { outline:2px solid var(--theme-focus) !important; outline-offset:2px; }
        .campaign-priority-position:disabled { opacity:.6; cursor:default; }
        @media (pointer:coarse) { #tdh-open-campaigns .campaign-priority-position { min-height:44px !important; } }
        .routing-history-list,.claim-history-list { max-height:180px; overflow:auto; padding:3px 8px 7px; }
        .routing-history-row,.claim-history-row { display:grid; gap:2px; padding:6px 0; min-width:0; }
        .routing-history-row + .routing-history-row,.claim-history-row + .claim-history-row { border-top:1px solid var(--theme-line); }
        .routing-history-main,.claim-history-main { min-width:0; color:var(--theme-text); font-size:var(--exp-font-size-small,11px); font-weight:750; line-height:1.35; overflow-wrap:anywhere; }
        .routing-history-time,.claim-history-time { color:var(--theme-muted); font-size:var(--exp-font-size-small,11px); line-height:1.25; }
        #tdh-toggle-inventory,
        #tdh-refresh-campaign-data { grid-column:1/-1; }
        .auth-advanced { margin-top:2px; border:0; border-bottom:1px solid var(--theme-line); border-radius:0; background:transparent; padding:0; }
        .auth-advanced > summary { cursor:pointer; list-style:disclosure-closed inside; color:var(--theme-text); font-size:var(--exp-font-size-body,13px); font-weight:600; user-select:none; }
        .auth-advanced[open] > summary { list-style-type:disclosure-open; }
        .auth-advanced[open] > summary { margin-bottom:6px; color:var(--theme-text); }
        .auth-advanced-body { display:flex; flex-direction:column; gap:6px; }
        .auth-hint { color:var(--theme-muted); font-size:var(--exp-font-size-small,11px); line-height:1.35; }
        .auth-input { width:100%; min-height:30px; border:1px solid var(--theme-line); border-radius:6px; background:var(--theme-inset); color:var(--theme-text); padding:6px 8px; font-size:var(--exp-font-size-body,13px); }
        .auth-input:focus { outline:2px solid var(--theme-focus); outline-offset:2px; border-color:var(--theme-focus); }
        .theme-row { grid-column:1/-1; display:flex; align-items:center; justify-content:space-between; gap:10px; min-height:28px; padding:6px 0; font-size:var(--exp-font-size-body,13px); }
        .fl-tool-panel { border-color:var(--theme-line); background:var(--theme-panel); }
        .fl-tool-body { border-color:var(--theme-line); background:var(--theme-bg); color:var(--theme-text); }
        .select-lite, .life-btn { border-color:var(--theme-line); background:var(--theme-raised); color:var(--theme-text); }
        .cluster a { color:var(--theme-link); }
        .fl-tool-chevron, #tdh-rail-subtitle, .compact-extra { color:var(--theme-muted); }
        @media (forced-colors: active) {
          .toggleSwitch { forced-color-adjust:none; border:1px solid CanvasText; background:Canvas; }
          .toggleSwitch::after { border-color:CanvasText; background:CanvasText; }
          .toggleSwitch[aria-checked="true"] { border-color:Highlight; background:Highlight; }
          .toggleSwitch[aria-checked="true"]::after { border-color:HighlightText; background:HighlightText; }
        }
        .cluster[data-ui-theme="warm"] #tdh-tools-dock {
          border:1px solid color-mix(in srgb,var(--theme-line) 84%,var(--theme-accent) 16%) !important;
          background-image:
            radial-gradient(120% 65% at 50% -18%,color-mix(in srgb,var(--theme-accent) 9%,transparent),transparent 72%),
            linear-gradient(180deg,color-mix(in srgb,var(--theme-panel) 42%,var(--theme-bg) 58%),var(--theme-bg) 44%) !important;
          background-clip:padding-box !important;
          box-shadow:0 18px 50px #0009,inset 0 1px 0 #ffedcf12;
        }
        .cluster[data-ui-theme="warm"] .header-icon {
          background:linear-gradient(155deg,color-mix(in srgb,var(--theme-accent) 13%,var(--theme-panel)),var(--theme-panel) 70%);
          box-shadow:inset 0 1px 0 #ffedcf20,0 2px 9px #0005;
        }
        .cluster[data-ui-theme="warm"] #tdh-header-version {
          border-color:color-mix(in srgb,var(--theme-line) 66%,var(--theme-accent) 34%);
          background:color-mix(in srgb,var(--theme-panel) 88%,var(--theme-accent) 12%);
          color:var(--theme-accent2);
        }
        .cluster[data-ui-theme="warm"] #tdh-rail-close {
          border-color:var(--theme-line);background:var(--theme-panel);color:var(--theme-muted);
        }
        .cluster[data-ui-theme="warm"] .header-divider {
          background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--theme-accent) 55%,transparent) 50%,transparent);
        }
        .cluster[data-ui-theme="warm"] :is(.fl-tool-header,.life-btn):not(.last-opened) {
          box-shadow:inset 0 1px 0 #ffedcf0a;
        }
        .compact-inventory { display:none; margin-top:6px; border:1px solid #9147ff55; background:#111114; border-radius:9px; overflow:hidden; }
        .compact-inventory.open { display:block; }
        .campaign-manager { margin-top:6px; border:1px solid color-mix(in srgb,var(--theme-accent) 34%,var(--theme-line)); border-radius:9px; background:var(--theme-bg); overflow:hidden; }
        .campaign-manager > summary { list-style:none; display:flex; align-items:center; justify-content:space-between; gap:8px; padding:7px 8px; cursor:pointer; }
        .campaign-manager > summary::-webkit-details-marker { display:none; }
        .campaign-manager-title { flex:0 0 auto; white-space:nowrap; font-size:var(--exp-font-size-body,13px); font-weight:600; color:var(--theme-text); }
        .campaign-manager-summary { flex:1 1 0; min-width:0; white-space:normal; overflow-wrap:anywhere; line-height:1.25; text-align:left; font-size:var(--exp-font-size-small,11px); font-weight:700; color:var(--theme-muted); }
        .campaign-manager[open] > summary { border-bottom:1px solid var(--theme-line); }
        .campaign-manager-note { padding:6px 8px 3px; font-size:var(--exp-font-size-small,11px); line-height:1.35; color:var(--theme-muted); }
        .campaign-manager-note[data-tone="warn"] { color:color-mix(in srgb,#c77700 72%,var(--theme-text)); }
        #tdh-campaign-planner { color:var(--theme-text); font-weight:700; }
        .unclaimed-badge { flex:0 0 auto; padding:1px 6px; border:1px solid color-mix(in srgb,#e2b34a 58%,var(--theme-line)); border-radius:8px; color:color-mix(in srgb,#c77700 72%,var(--theme-text)); font-size:var(--exp-font-size-small,11px); font-weight:800; white-space:nowrap; }
        .unclaimed-badge[hidden] { display:none; }
        .unclaimed-section { border-bottom:1px solid var(--theme-line); }
        .unclaimed-section[hidden] { display:none; }
        .unclaimed-title { padding:6px 8px 0; font-size:var(--exp-font-size-small,11px); font-weight:800; letter-spacing:.04em; text-transform:uppercase; color:var(--theme-muted); }
        .eligibility-chip {
          grid-column:1/-1; margin-top:6px;
          border:1px solid color-mix(in srgb,var(--theme-line) 68%,var(--theme-accent) 32%);
          border-radius:8px; background:var(--theme-panel); overflow:hidden;
        }
        .eligibility-chip > summary {
          list-style:none; display:flex; align-items:center; gap:6px; min-height:28px;
          box-sizing:border-box; padding:5px 8px; cursor:pointer;
          color:var(--theme-text); font-size:var(--exp-font-size-small,11px); font-weight:800;
        }
        .eligibility-chip > summary::-webkit-details-marker { display:none; }
        .eligibility-chip > summary::after {
          content:"▸"; margin-left:auto; color:var(--theme-muted); font-size:var(--exp-font-size-small,11px); transition:.12s transform;
        }
        .eligibility-chip[open] > summary::after { transform:rotate(90deg); }
        .eligibility-chip > summary > #tdh-eligibility-summary { flex:1 1 auto; min-width:0; }
        .eligibility-checklist-count { min-width:0; white-space:normal; overflow-wrap:anywhere; line-height:1.25; text-align:left; color:var(--theme-muted); font-size:var(--exp-font-size-small,11px); font-weight:700; }
        .eligibility-chip > .eligibility-checklist-list { border-top:1px solid var(--theme-line); }
        .eligibility-chip[data-tone="good"] { border-color:color-mix(in srgb,#3ac978 58%,var(--theme-line)); }
        .eligibility-chip[data-tone="warn"] { border-color:color-mix(in srgb,#e2b34a 58%,var(--theme-line)); }
        .eligibility-chip[data-tone="bad"] { border-color:color-mix(in srgb,#df5b65 58%,var(--theme-line)); }
        .eligibility-chip[data-tone="muted"] { border-color:var(--theme-line); }
        .eligibility-detail {
          padding:0 8px 7px; border-top:1px solid var(--theme-line);
          color:var(--theme-muted); font-size:var(--exp-font-size-small,11px); line-height:1.4;
        }
        .eligibility-detail[hidden] { display:none; }
        .campaign-game-list { max-height:240px; overflow:auto; padding:2px 7px 6px; }
        .campaign-game-row { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:8px; align-items:center; min-height:36px; padding:6px 0; }
        .campaign-game-row + .campaign-game-row { border-top:1px solid #242429; }
        .campaign-game-copy { min-width:0; }
        .campaign-game-name { overflow:hidden; color:var(--theme-text); font-size:var(--exp-font-size-small,11px); font-weight:800; text-overflow:ellipsis; white-space:nowrap; }
        .campaign-game-meta { margin-top:2px; color:var(--theme-muted); font-size:var(--exp-font-size-small,11px); line-height:1.3; }
        .campaign-ignore-check { position:relative; box-sizing:border-box; width:22px; height:22px; padding:0; border:1px solid var(--theme-line); border-radius:6px; background:var(--theme-panel); color:var(--theme-text); cursor:pointer; }
        .campaign-ignore-check::after { content:""; position:absolute; inset:4px; border-radius:3px; background:transparent; }
        .campaign-ignore-check[aria-checked="true"] { border-color:var(--theme-accent); background:color-mix(in srgb,var(--theme-panel) 70%,var(--theme-accent) 30%); }
        .campaign-ignore-check[aria-checked="true"]::after { content:"✓"; display:grid; place-items:center; inset:0; background:transparent; color:var(--theme-text); font-size:13px; font-weight:900; }
        .campaign-ignore-check:focus-visible { outline:2px solid var(--theme-accent2); outline-offset:2px; }
        .inventory-head { padding:7px 8px; border-bottom:1px solid #2a2a30; display:flex; align-items:center; justify-content:space-between; gap:8px; }
        .inventory-head strong { font-size:var(--exp-font-size-body,13px); }
        .inventory-head span { font-size:var(--exp-font-size-small,11px); color:#adadb8; }
        .inventory-list { padding:3px 7px 6px; }
        .inventory-item { display:grid; grid-template-columns:24px minmax(0,1fr) auto; gap:7px; align-items:center; padding:6px 0; }
        .inventory-item + .inventory-item { border-top:1px solid #242429; }
        .reward-thumb { width:24px; height:24px; border-radius:6px; background:linear-gradient(135deg,#9147ff,#5c16c5); display:grid; place-items:center; font-size:var(--exp-font-size-small,11px); font-weight:900; color:#fff; }
        .reward-copy { min-width:0; }
        .reward-name { font-size:var(--exp-font-size-small,11px); font-weight:800; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .reward-meta { margin-top:1px; font-size:var(--exp-font-size-small,11px); color:#adadb8; }
        .reward-state { font-size:var(--exp-font-size-small,11px); font-weight:800; color:#bf94ff; white-space:nowrap; }
        .queue-list { display:block; }
        .queue-collapsible {
          grid-column:1/-1;
          margin-top:6px;
          border:1px solid color-mix(in srgb,var(--theme-accent) 34%,var(--theme-line));
          border-radius:9px;
          background:var(--theme-bg);
          overflow:hidden;
        }
        .queue-collapsible > summary {
          list-style:none;
        }
        .queue-collapsible > summary::-webkit-details-marker {
          display:none;
        }
        .queue-summary-head {
          min-height:32px;
          padding:7px 8px;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:8px;
          cursor:pointer;
          user-select:none;
        }
        .queue-summary-head:hover,
        .queue-summary-head:focus-visible {
          background:color-mix(in srgb,var(--theme-panel) 88%,var(--theme-accent) 12%);
          outline:none;
        }
        .queue-summary-head > div {
          min-width:0;
          display:flex;
          align-items:baseline;
          flex-wrap:wrap;
          gap:0 4px;
        }
        .queue-summary-head strong {
          font-size:var(--exp-font-size-small,11px);
          white-space:nowrap;
        }
        .queue-summary-head span:not(.queue-summary-chevron) {
          min-width:0;
          color:var(--theme-muted);
          font-size:var(--exp-font-size-small,11px);
          white-space:normal;
          overflow-wrap:anywhere;
        }
        .queue-summary-chevron {
          display:none;
          flex:0 0 auto;
          color:var(--theme-muted);
          font-size:var(--exp-font-size-body,13px);
          transition:.15s transform;
        }
        .queue-collapsible[open] .queue-summary-chevron {
          transform:rotate(90deg);
        }
        .queue-collapsible[open] .inventory-list {
          border-top:1px solid var(--theme-line);
        }
        .diag { display:none; box-sizing:border-box;width:100%;min-width:0;height:160px;max-height:160px;overflow:auto;overscroll-behavior:contain;overflow-wrap:anywhere;box-shadow:inset 0 2px 6px #0006; margin-top:6px; padding:7px; border:1px solid #2b2b31; border-radius:7px; background:#101014; font:var(--exp-font-size-small,11px)/1.45 ui-monospace,SFMono-Regular,Consolas,monospace; color:#b8b8c0; white-space:pre-wrap; }
        .diag.open { display:block; }
        .has-tooltip { position:relative; }
        .has-tooltip::after { content:attr(data-tip); position:absolute; left:0; top:calc(100% + 4px); width:min(190px, calc(100vw - 48px)); max-width:100%; padding:6px 8px; border:1px solid #3b3b44; border-radius:7px; background:#0e0e10; color:#efeff1; box-shadow:0 6px 18px #0007; box-sizing:border-box; font-size:var(--exp-font-size-small,11px); line-height:1.35; white-space:normal; overflow-wrap:anywhere; opacity:0; pointer-events:none; z-index:999; transform:translateY(-2px); transition:.12s opacity,.12s transform; }
        .has-tooltip:hover::after, .has-tooltip:focus-visible::after { opacity:1; transform:translateY(0); }
        .reduce-motion *, .reduce-motion *::before, .reduce-motion *::after { animation:none !important; transition:none !important; }
        @media (max-width:700px) {
          .badge-row { width:100%; }
          #tdh-drop-card { flex:1 1 auto; width:auto; min-width:0; max-width:none; }
        }

        .cluster #tdh-drop-card[data-presentation="compact-card"]{position:fixed!important;display:block!important;box-sizing:border-box!important;height:auto!important;min-height:0!important;margin:0!important;padding:0!important;border:1px solid var(--theme-line,#848494)!important;border-radius:7px!important;background:var(--theme-bg,#18181b)!important;background-image:none!important;box-shadow:0 4px 10px #0003!important;color:var(--theme-text,#efeff1)!important;font-family:"Segoe UI",system-ui,sans-serif!important;overflow:hidden!important;container-type:normal!important}
        .cluster #tdh-drop-card[data-presentation="compact-card"]:is(::before,::after){display:none!important}
        .cluster #tdh-drop-card[data-presentation="compact-card"] .stream-info{padding:7px 7px 0!important;min-height:0!important;background:transparent!important;border:0!important}
        .cluster #tdh-drop-card[data-presentation="compact-card"] .progress-copy{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;grid-template-areas:"game status" "name percent" "bar bar"!important;gap:4px 6px!important;width:100%!important;padding:0!important;min-width:0!important;align-items:center!important}
        .cluster #tdh-drop-card[data-presentation="compact-card"] :is(.progress-head,.progress-category,.progress-reward-row,.drop-status-row,.status-meta-chip){display:contents!important}
        .cluster #tdh-drop-card[data-presentation="compact-card"] :is(.stream-channel,.strip-art,.strip-meta,.progress-dot,.status-chip-divider,.status-clock-icon,#tdh-updated-ago){display:none!important}
        .cluster #tdh-drop-card[data-presentation="compact-card"] .stream-game{grid-area:game!important;font:600 12px/1.35 "Segoe UI",sans-serif!important;color:var(--theme-text)!important;min-width:0!important;white-space:normal!important;overflow-wrap:anywhere!important}
        .cluster #tdh-drop-card[data-presentation="compact-card"] .drop-name{grid-area:name!important;font:400 12px/1.35 "Segoe UI",sans-serif!important;color:var(--theme-text)!important;white-space:normal!important;overflow-wrap:anywhere!important}
        .cluster #tdh-drop-card[data-presentation="compact-card"] .drop-percent{grid-area:percent!important;font:400 11px/1.35 "Segoe UI",sans-serif!important;color:var(--theme-text)!important}
        .cluster #tdh-drop-card[data-presentation="compact-card"] .drop-bar{grid-area:bar!important;height:5px!important;min-height:5px!important;margin:2px 0 0!important;background:var(--theme-raised,#3a3a3d)!important;border-radius:2px!important}
        .cluster #tdh-drop-card[data-presentation="compact-card"] #tdh-drop-fill{height:100%!important;background:var(--theme-accent2,#bf94ff)!important;border-radius:2px!important}
        .cluster #tdh-drop-card[data-presentation="compact-card"] .state-pill{grid-area:status!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;font:500 11px/1.35 "Segoe UI",sans-serif!important;white-space:normal!important;text-align:right!important}
        .cluster #tdh-drop-card .compact-card-actions{display:flex;align-items:center;gap:4px;padding:6px 7px 7px;min-width:0}
        .cluster #tdh-drop-card .compact-card-actions .drop-meta{flex:1;min-width:0;margin-right:auto;font:400 11px/1.35 "Segoe UI",sans-serif!important;color:var(--theme-text)!important;white-space:normal!important;overflow-wrap:anywhere!important}
        .cluster #tdh-drop-card .compact-card-actions button{flex:none;box-sizing:border-box;min-width:0;min-height:28px;padding:3px 5px;border:1px solid var(--theme-muted,#adadb8);border-radius:5px;background:var(--theme-panel,#1f1f23);color:var(--theme-text);font:400 11px/1.35 "Segoe UI",sans-serif;cursor:pointer;white-space:nowrap}
        .cluster #tdh-drop-card .compact-card-actions .skip-countdown{display:none!important}
        .cluster #tdh-drop-card .compact-card-actions button:disabled{cursor:default;opacity:.6}
        .cluster #tdh-drop-card .compact-card-actions button:focus-visible{outline:2px solid var(--theme-focus,#bf94ff);outline-offset:1px}
        .cluster #tdh-drop-card[data-presentation="compact-card"] .strip-toggle{display:none!important}
        .cluster #tdh-drop-card[data-collapsed="true"] :is(.expanded-content,.compact-card-actions){display:none!important}
        .cluster #tdh-drop-card[data-collapsed="true"] .strip-toggle{display:block!important;position:static!important;width:100%!important;height:auto!important;min-height:30px!important;padding:6px!important;color:var(--theme-text)!important;background:var(--theme-bg)!important;opacity:1!important;transform:none!important;font:600 12px "Segoe UI",sans-serif!important}
        .cluster #tdh-drop-card[data-chat-docked="true"] .strip-toggle{display:block!important;position:static!important;width:100%!important;min-height:26px!important;padding:4px 6px!important;border:0!important;border-bottom:1px solid var(--theme-line)!important;background:var(--theme-bg)!important;color:var(--theme-text)!important;font:600 12px "Segoe UI",sans-serif!important;cursor:pointer!important}
        /* Floating progress card as a drawer: one front line closed, the details pull out below it. */
        .cluster #tdh-drop-card[data-presentation="compact-card"][data-progress-placement="outside"]:not([data-collapsed="true"]){border:1px solid color-mix(in srgb,var(--theme-line) 40%,transparent)!important;border-radius:9px!important;background:var(--theme-panel)!important;box-shadow:0 10px 24px #0006!important;overflow:clip!important}
        .cluster #tdh-drop-card[data-presentation="compact-card"][data-progress-placement="outside"]:not([data-collapsed="true"]) .stream-info{padding:0!important}
        .cluster #tdh-drop-card[data-presentation="compact-card"][data-progress-placement="outside"]:not([data-collapsed="true"]) .progress-copy{grid-template-columns:10px auto minmax(0,1fr) auto 46px!important;grid-template-areas:". channel game percent ." "bar bar bar bar bar" "name name name name name" "status status status ago ago"!important;gap:0!important}
        .cluster #tdh-drop-card[data-presentation="compact-card"][data-progress-placement="outside"]:not([data-collapsed="true"]) :is(#tdh-stream-channel,#tdh-stream-game,#tdh-drop-percent){pointer-events:none!important;align-self:center!important;min-height:38px!important;display:flex!important;align-items:center!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;font:600 13px/1.3 "Segoe UI",sans-serif!important}
        .cluster #tdh-drop-card[data-presentation="compact-card"][data-progress-placement="outside"]:not([data-collapsed="true"]) #tdh-stream-channel{grid-area:channel!important;color:var(--theme-text)!important}
        .cluster #tdh-drop-card[data-presentation="compact-card"][data-progress-placement="outside"]:not([data-collapsed="true"]) .stream-game{grid-area:game!important;min-width:0!important;padding-left:5px!important;color:var(--theme-muted)!important;font-weight:400!important}
        .cluster #tdh-drop-card[data-presentation="compact-card"][data-progress-placement="outside"]:not([data-collapsed="true"]) .stream-game::before{content:"· ";white-space:pre}
        .cluster #tdh-drop-card[data-presentation="compact-card"][data-progress-placement="outside"]:not([data-collapsed="true"]) .drop-percent{grid-area:percent!important;padding-left:8px!important;color:var(--theme-accent)!important;font-weight:700!important}
        .cluster #tdh-drop-card[data-presentation="compact-card"][data-progress-placement="outside"]:not([data-collapsed="true"]) .drop-bar{grid-area:bar!important;pointer-events:none!important;height:3px!important;min-height:3px!important;margin:0!important;border-radius:0!important;background:var(--theme-inset)!important}
        .cluster #tdh-drop-card[data-presentation="compact-card"][data-progress-placement="outside"]:not([data-collapsed="true"]) #tdh-drop-fill{border-radius:0!important;background:var(--theme-accent)!important}
        .cluster #tdh-drop-card[data-presentation="compact-card"][data-progress-placement="outside"]:not([data-collapsed="true"]) .strip-toggle{appearance:none!important;display:block!important;position:absolute!important;top:0!important;left:0!important;right:0!important;height:41px!important;z-index:5!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;color:transparent!important;font-size:0!important;cursor:pointer!important}
        .cluster #tdh-drop-card[data-presentation="compact-card"][data-progress-placement="outside"]:not([data-collapsed="true"]) .strip-toggle::after{content:"";position:absolute;right:9px;top:18px;width:26px;height:13px;transform:translateY(-50%);border-radius:7px 7px 4px 4px;background:var(--theme-inset);box-shadow:inset 0 2px 3px #0005}
        .cluster #tdh-drop-card[data-presentation="compact-card"][data-progress-placement="outside"]:not([data-collapsed="true"]).is-expanded .strip-toggle::after{background:color-mix(in srgb,var(--theme-accent) 22%,var(--theme-inset))}
        .cluster #tdh-drop-card[data-presentation="compact-card"][data-progress-placement="outside"]:not([data-collapsed="true"]) .strip-toggle:focus-visible{outline:2px solid var(--theme-focus,var(--theme-accent))!important;outline-offset:-2px!important}
        .cluster #tdh-drop-card[data-presentation="compact-card"][data-progress-placement="outside"]:not([data-collapsed="true"]):not(.is-expanded) :is(.drop-name,.state-pill,.compact-card-actions){display:none!important}
        .cluster #tdh-drop-card[data-presentation="compact-card"][data-progress-placement="outside"]:not([data-collapsed="true"]) :is(.drop-name,.state-pill,#tdh-updated-ago){background:var(--theme-inset)!important;align-self:stretch!important;font:400 12px/1.35 "Segoe UI",sans-serif!important}
        .cluster #tdh-drop-card[data-presentation="compact-card"][data-progress-placement="outside"]:not([data-collapsed="true"]) .drop-name{grid-area:name!important;padding:8px 10px 2px!important;font-weight:600!important;color:var(--theme-text)!important}
        .cluster #tdh-drop-card[data-presentation="compact-card"][data-progress-placement="outside"]:not([data-collapsed="true"]) .state-pill{grid-area:status!important;padding:2px 0 4px 10px!important;text-align:left!important;font-size:11px!important}
        .cluster #tdh-drop-card[data-presentation="compact-card"][data-progress-placement="outside"]:not([data-collapsed="true"]).is-expanded #tdh-updated-ago{display:block!important;grid-area:ago!important;padding:2px 10px 4px 0!important;text-align:right!important;color:var(--theme-muted)!important;font-size:11px!important}
        .cluster #tdh-drop-card[data-presentation="compact-card"][data-progress-placement="outside"]:not([data-collapsed="true"]) .compact-card-actions{padding:4px 10px 9px!important;background:var(--theme-inset)!important}
        .cluster #tdh-drop-card[data-presentation="compact-card"][data-progress-placement="outside"]:not([data-collapsed="true"]) .compact-card-actions button{border-color:color-mix(in srgb,var(--theme-line) 60%,transparent)!important;border-radius:6px!important}
        /* Progress cabinet: the card stays where it is and the menu opens from it as one piece (below, or above when the launcher sits at the bottom). */
        .cluster #tdh-drop-card .chat-collapse{display:none}
        .cluster #tdh-drop-card #tdh-chat-hide{display:none!important}
        .cluster #tdh-drop-card[data-chat-toggle="1"] #tdh-chat-hide{display:block!important}
        .cluster #tdh-drop-card[data-chat-toggle="1"]:not(.is-expanded) .chat-collapse{display:grid!important;place-items:center!important;position:absolute!important;left:4px!important;top:7px!important;width:26px!important;height:26px!important;padding:0!important;margin:0!important;border:0!important;border-radius:6px!important;background:transparent!important;color:var(--theme-text)!important;cursor:pointer!important;z-index:6!important}
        .cluster #tdh-drop-card[data-chat-toggle="1"] .chat-collapse:is(:hover,:focus-visible){background:var(--theme-inset)!important;outline:none!important;box-shadow:0 0 0 2px var(--theme-focus,var(--theme-accent))!important}
        .cluster #tdh-drop-card[data-chat-toggle="1"] .chat-collapse svg{width:16px!important;height:16px!important}
        /* The one-line card (Drop Details off) has its own Menu button in place of the drawer handle. */
        .cluster #tdh-drop-card .strip-menu{display:none}
        .cluster #tdh-drop-card:not(.is-expanded)[data-presentation="compact-card"][data-progress-placement="outside"]:not([data-collapsed="true"]) .strip-toggle::after{display:none!important}
        .cluster #tdh-drop-card:not(.is-expanded)[data-presentation="compact-card"][data-progress-placement="outside"]:not([data-collapsed="true"]) .progress-copy{grid-template-columns:10px auto minmax(0,1fr) auto 58px!important}
        .cluster #tdh-drop-card:not(.is-expanded)[data-presentation="compact-card"][data-progress-placement="outside"]:not([data-collapsed="true"]) .strip-menu{display:block!important;position:absolute!important;right:6px!important;top:7px!important;z-index:6!important;box-sizing:border-box!important;height:26px!important;margin:0!important;padding:0 8px!important;border:1px solid color-mix(in srgb,var(--theme-line) 60%,transparent)!important;border-radius:6px!important;background:var(--theme-panel,#1f1f23)!important;color:var(--theme-text)!important;font:400 11px/1.35 "Segoe UI",sans-serif!important;cursor:pointer!important;white-space:nowrap!important}
        @media(pointer:coarse){.cluster #tdh-drop-card:not(.is-expanded)[data-presentation="compact-card"][data-progress-placement="outside"]:not([data-collapsed="true"]) .strip-menu{height:32px!important;top:5px!important}}
        .cluster #tdh-drop-card .strip-menu:hover{background:var(--theme-inset)!important}
        .cluster #tdh-drop-card .strip-menu:focus-visible{outline:2px solid var(--theme-focus,var(--theme-accent))!important;outline-offset:1px!important}
        .cluster #tdh-drop-card[data-chat-toggle="1"]:not(.is-expanded)[data-presentation="compact-card"][data-progress-placement="outside"]:not([data-collapsed="true"]) .progress-copy{grid-template-columns:36px auto minmax(0,1fr) auto 58px!important}
        .cluster #tdh-drop-card .card-head-actions{display:none}
        .cluster #tdh-drop-card[data-cabinet] .card-head-actions{display:flex!important;position:absolute!important;top:0!important;right:6px!important;height:41px!important;align-items:center!important;gap:2px!important;z-index:6!important}
        .cluster #tdh-drop-card[data-cabinet] .card-head-actions .header-actions{display:flex!important;align-items:center!important;gap:2px!important}
        .cluster #tdh-drop-card[data-cabinet] .strip-toggle::after{display:none!important}
        .cluster #tdh-drop-card[data-cabinet][data-presentation="compact-card"][data-progress-placement="outside"]:not([data-collapsed="true"]) .progress-copy{grid-template-columns:10px auto minmax(0,1fr) auto 128px!important}
        .cluster #tdh-drop-card[data-cabinet="below"]{border-bottom-left-radius:0!important;border-bottom-right-radius:0!important;box-shadow:none!important}
        .cluster #tdh-drop-card[data-cabinet="above"]{border-top-left-radius:0!important;border-top-right-radius:0!important;box-shadow:none!important}
        .cluster #tdh-tools-dock[data-cabinet][data-cabinet] :is(.menu-head,.header-divider)[class]{display:none!important}
        .cluster #tdh-drop-card .card-head-actions :is(#tdh-header-version,.support-button,#tdh-rail-close){box-sizing:border-box!important;display:grid!important;place-items:center!important;width:26px!important;height:26px!important;min-width:26px!important;min-height:26px!important;padding:0!important;border:0!important;border-radius:6px!important;background:transparent!important;color:var(--theme-text)!important;cursor:pointer!important;font:18px/1 Arial,sans-serif!important}
        .cluster #tdh-drop-card .card-head-actions :is(#tdh-header-version,.support-button,#tdh-rail-close):is(:hover,:focus-visible){background:var(--theme-inset)!important;outline:none!important}
        .cluster #tdh-drop-card .card-head-actions :is(#tdh-header-version,.support-button,#tdh-rail-close):focus-visible{box-shadow:0 0 0 2px var(--theme-focus,var(--theme-accent))!important}
        .cluster #tdh-drop-card .card-head-actions .exp-changelog-icon{width:15px!important;height:15px!important;fill:none!important;stroke:currentColor!important;stroke-width:1.6!important}
        .cluster #tdh-drop-card .card-head-actions .support-button svg{width:15px!important;height:15px!important}
        .cluster #tdh-drop-card .card-head-actions [data-exp-version-label]{display:none!important}
        .cluster #tdh-tools-dock[data-cabinet="below"][data-cabinet]{border-top-left-radius:0!important;border-top-right-radius:0!important;border-top:0!important}
        .cluster #tdh-tools-dock[data-cabinet="above"][data-cabinet]{border-bottom-left-radius:0!important;border-bottom-right-radius:0!important;border-bottom:0!important}
        .cluster #tdh-drop-card[data-progress-placement="menu"]{position:static!important;width:100%!important;max-width:100%!important;border:0!important;border-bottom:1px solid var(--theme-line)!important;border-radius:0!important;box-shadow:none!important}
        .cluster #tdh-drop-card[data-progress-placement="menu"] #tdh-card-menu{display:none!important}
        #tdh-campaign-order-note{display:none!important}
        #tdh-campaign-search{box-sizing:border-box;width:100%;min-width:0;padding:7px 8px;margin:6px 0;border:1px solid var(--theme-line);border-radius:7px;background:var(--theme-inset,#0e0e10);color:var(--theme-text);font:12px "Segoe UI",sans-serif;min-height:34px}
        .campaign-game-row[hidden]{display:none!important}
        .campaign-ignore-check[role="switch"]{width:34px!important;min-width:34px!important;height:24px!important;min-height:24px!important;border:1px solid var(--theme-line)!important;border-radius:6px!important;background:var(--theme-raised)!important;padding:3px!important}
        .campaign-ignore-check[role="switch"]::after{content:''!important;display:block!important;width:12px!important;height:16px!important;border-radius:3px!important;background:var(--theme-text)!important;transform:none!important}
        .campaign-ignore-check[role="switch"][aria-checked=true]{background:var(--theme-accent)!important}
        .campaign-ignore-check[role="switch"][aria-checked=true]::after{transform:translateX(12px)!important;background:var(--theme-onAccent)!important}
        @media(pointer:coarse){.cluster #tdh-drop-card .compact-card-actions button{min-height:36px}}
      `;
    }

    function dropperGemSvg(className) {
      return `<svg class="${className}" viewBox="0 0 128 128" aria-hidden="true"><polygon points="29.00,24.00 62.00,24.00 62.00,40.20 47.90,40.20" fill="#D9B5FF"/><polygon points="66.00,24.00 99.00,24.00 80.10,40.20 66.00,40.20" fill="#CDBBF0"/><polygon points="47.90,40.20 62.00,40.20 62.00,52.29" fill="#8C39F2"/><polygon points="66.00,40.20 80.10,40.20 66.00,52.29" fill="#5E4A93"/><polygon points="99.00,24.00 119.00,53.00 89.30,53.54 80.10,40.20" fill="#806AB8"/><polygon points="80.10,40.20 89.30,53.54 66.00,53.96 66.00,52.29" fill="#4A3779"/><polygon points="119.00,53.00 66.00,111.78 66.00,79.38 89.30,53.54" fill="#5E4A93"/><polygon points="89.30,53.54 66.00,79.38 66.00,53.96" fill="#2C1F4D"/><polygon points="62.00,111.78 9.00,53.00 38.70,53.54 62.00,79.38" fill="#7428E8"/><polygon points="62.00,79.38 38.70,53.54 62.00,53.96" fill="#7428E8"/><polygon points="9.00,53.00 29.00,24.00 47.90,40.20 38.70,53.54" fill="#5417B3"/><polygon points="38.70,53.54 47.90,40.20 62.00,52.29 62.00,53.96" fill="#9B5AF9"/></svg>`;
    }

    function switchHtml(id, label, description, on) {
      const tip = String(description || "").trim().replace(/&/g, "&amp;").replace(/"/g, "&quot;");
      const labelClass = tip ? "fl-switch-text has-tooltip" : "fl-switch-text";
      const tipAttr = tip ? ` data-tip="${tip}" aria-description="${tip}"` : "";
      return `
        <div class="fl-switch">
          <label class="${labelClass}"${tipAttr} id="${id}-label" for="${id}">${label}</label>
          <button id="${id}" type="button" class="fl-switch-input toggleSwitch" role="switch" aria-labelledby="${id}-label" aria-checked="${on ? "true" : "false"}"></button>
        </div>`;
    }

    function mountUi() {
      if (ui) return ui;
      const host = document.createElement("div");
      host.id = "tdh-root";
      const shadow = host.attachShadow({ mode: "open" });
      shadow.innerHTML = `
        <style>${css()}</style>
        <div class="cluster" id="tdh-cluster">
          <aside id="tdh-tools-dock" data-exp-part="dock" role="region" aria-labelledby="tdh-rail-title">
            <div class="menu-head">
              <div class="header-brand">
                <div class="header-icon" aria-hidden="true">
                  ${dropperGemSvg("menu-icon")}
                </div>
                <div class="header-copy">
                  <div class="header-title-row">
                    <h2 id="tdh-rail-title">Dropper</h2>
                    <button type="button" id="tdh-header-version" aria-label="View Dropper v${APP_VERSION} Changelog">v${APP_VERSION}</button>
                  </div>
                </div>
              </div>
              <div class="header-actions">
                <button type="button" id="tdh-rail-close" aria-label="Close">×</button>
              </div>
            </div>
            <div class="header-divider"></div>
            <div class="badge-only-progress-slot" id="tdh-badge-only-progress-slot" aria-label="Drop Progress" hidden></div>
            <div class="toast" id="tdh-toast" hidden></div>
            <div class="update-notice" id="tdh-update-notice" data-exp-update-notice="1" hidden>
              <button type="button" class="update-dismiss" id="tdh-update-dismiss" aria-label="Dismiss Update Notice">×</button>
              <div class="update-head">
                <div class="update-heading">
                  <div class="update-kicker" id="tdh-update-kicker">What's New</div>
                  <div class="update-title" id="tdh-update-title"></div>
                </div>
                <div class="update-version" id="tdh-update-version"></div>
              </div>
              <div class="update-text" id="tdh-update-text"></div>
              <ul class="update-list" id="tdh-update-list"></ul>
              <div class="update-footer">
                <button type="button" class="update-release" id="tdh-update-release">GitHub Release</button>
                <a class="update-action" id="tdh-update-action" href="#" target="_blank" rel="noopener noreferrer" role="button">View Update</a>
              </div>
            </div>
            <section class="fl-tool-panel"><div class="fl-tool-header" data-panel="tdh-drops-body"><span class="fl-tool-title">Drops</span><button class="fl-tool-chevron" type="button" aria-expanded="false">▸</button></div><div class="fl-tool-body fl-tool-hidden" id="tdh-drops-body">
              ${switchHtml("tdh-claim-drops", "Auto-claim Drops", "", settings.claimDrops)}
              ${switchHtml("tdh-claim-bonus", "Auto-Claim Bonus Chests", "Attempts free bonus claims. A click is not counted as confirmation.", settings.claimBonus)}
              <div class="auth-required" id="tdh-auth-required" hidden>
                <span>Twitch Login Required</span>
                <button type="button" class="life-btn" id="tdh-twitch-login" aria-label="Open Twitch Login">Log in</button>
              </div>
              <div class="account-link-warning" id="tdh-account-link-warning" role="alert" hidden>
                <div class="account-link-warning-copy">
                  <strong>Game Account Not Linked</strong>
                  <span id="tdh-account-link-detail">This campaign requires a linked game account before Twitch can award progress.</span>
                </div>
                <button type="button" class="life-btn" id="tdh-account-link-open">Open Connections</button>
              </div>
              <div class="deadline-status" id="tdh-deadline-status" data-tone="muted" role="status" hidden></div>
              <details class="campaign-manager" id="tdh-open-campaigns">
                <summary><span class="campaign-manager-title">Open Campaigns</span><span class="campaign-manager-summary" id="tdh-open-campaign-summary">Loading…</span></summary>
                <div class="mini-row campaign-strategy-row"><span>Campaign Order</span><select class="select-lite" id="tdh-campaign-strategy"><option value="priority">My Priority</option><option value="deadline">Ending Soonest</option><option value="completion">Closest to Completion</option><option value="shortest">Shortest Remaining</option></select></div>

                <div class="campaign-game-list" id="tdh-open-campaign-list"></div>
              </details>
              <button type="button" class="life-btn" id="tdh-toggle-inventory" data-exp-primary="1">Show Drops Inventory</button>
              <div class="compact-inventory" id="tdh-compact-inventory"><div class="inventory-head"><div><strong>Campaign Drops</strong><span id="tdh-inventory-game"></span></div></div><div class="inventory-list" id="tdh-inventory-list"></div></div>
              <details class="campaign-manager" id="tdh-claim-history-panel">
                <summary><span class="campaign-manager-title">Claim History</span><span class="unclaimed-badge" id="tdh-unclaimed-summary" hidden></span><span class="campaign-manager-summary" id="tdh-claim-health">No claims yet</span></summary>
                <div class="unclaimed-section" id="tdh-unclaimed-panel" hidden>
                  <div class="unclaimed-title">Unclaimed Rewards</div>
                  <div class="claim-history-list" id="tdh-unclaimed-list"></div>
                </div>
                <div class="claim-history-list" id="tdh-claim-history"><div class="campaign-manager-note">No claimed Drops recorded for this account.</div></div>
              </details>
            </div></section>
            <section class="fl-tool-panel"><div class="fl-tool-header" data-panel="tdh-streams-body"><span class="fl-tool-title">Streams</span><button class="fl-tool-chevron" type="button" aria-expanded="false">▸</button></div><div class="fl-tool-body fl-tool-hidden" id="tdh-streams-body">
              <div class="stream-subsection-label">Current Stream</div>
              <div class="campaign-manager-note" id="tdh-viewing-status" role="status"></div>
              <div class="earning-confidence" id="tdh-earning-confidence" data-tone="muted" role="status">
                <strong id="tdh-earning-confidence-label">Waiting for Twitch</strong>
                <span id="tdh-earning-confidence-detail">No verified earning evidence yet.</span>
              </div>
              <div class="multi-tab-status" id="tdh-multi-tab-status" role="status" hidden></div>
              <div class="session-recovery-status" id="tdh-session-recovery-status" role="status" hidden></div>
              <div class="action-pair action-stack"><button type="button" class="life-btn" id="tdh-resume-playback">Resume Playback</button><button type="button" class="life-btn" id="tdh-allow-switching">Allow Switching</button></div>
              <div class="action-pair action-stack">
                <button type="button" class="life-btn" id="tdh-stream-lock" aria-pressed="false">Stay on This Stream</button>
                <button type="button" class="life-btn" id="tdh-recovery-action" hidden>Recheck Twitch</button>
              </div>
              ${switchHtml("tdh-find-next", "Automatic Stream Switching", "Uses eligible alternatives only when you permit switching. Manual selections and pauses stay protected.", settings.findNextStream)}
              ${switchHtml("tdh-mute-next", "Mute Opened Streams", "Mutes streams Dropper opens or switches to, Including same-tab routing.", settings.muteRestarted)}
              <details class="auth-advanced"><summary>Interruption Rules</summary><div class="auth-advanced-body">
                <label for="tdh-protected-channels">Protected Channels</label><input id="tdh-protected-channels" placeholder="channel1, channel2" maxlength="2000">
                <label for="tdh-excluded-channels">Never Automatically Open</label><input id="tdh-excluded-channels" placeholder="channel1, channel2" maxlength="2000">
                <div class="mini-row"><label for="tdh-switch-policy">Switch Policy</label><select id="tdh-switch-policy"><option value="normal">Follow Campaign Order</option><option value="stopped-earning">Keep an Earning Stream</option></select></div>

              </div></details>
              <details class="auth-advanced">
                <summary>Playback Options</summary>
                <div class="auth-advanced-body">
                  ${switchHtml("tdh-remember-content-warnings", "Remember Accepted Warnings", "Remembers content warning types you accept across all Twitch channels. New warning types still ask.", settings.rememberContentWarnings)}
                  <button id="tdh-forget-content-warnings" type="button" class="life-btn">Forget Accepted Warnings</button>
                  ${switchHtml("tdh-restore-channel-player", "Restore Player on Arrival", "Returns an initial Twitch mini-player to the normal channel view. Stops after you interact with the page.", settings.restoreChannelPlayer)}
                  <button id="tdh-restore-channel-player-now" type="button" class="life-btn">Restore Channel Player</button>
                  ${switchHtml("tdh-background-earning", "Background Tracking", "Reports actual Twitch credit in hidden tabs or Picture-in-Picture. Does not simulate viewing.", settings.backgroundEarning)}
                </div>
              </details>
              <details class="auth-advanced">
                <summary>Routing & Backup</summary>
                <div class="auth-advanced-body">
                  ${switchHtml("tdh-resume-session", "Resume Last Drop Session", "After a browser restart, the tab chosen for switching resumes its stream. Twitch verifies credit again before progress counts.", settings.resumeSessionOnRestart)}
                  <button type="button" class="life-btn" id="tdh-clear-skipped-streamers" data-help="Clears The Temporary Streamer Rotation And Immediately Retries Discovery When Waiting.">Clear Skipped Streamers</button>
                </div>
              </details>
            </div></section>
            <section class="fl-tool-panel"><div class="fl-tool-header" data-panel="tdh-progress-body"><span class="fl-tool-title">Appearance</span><button class="fl-tool-chevron" type="button" aria-expanded="false">▸</button></div><div class="fl-tool-body fl-tool-hidden" id="tdh-progress-body">
              ${switchHtml("tdh-drop-details", "Drop Details", "", settings.dropDetails)}
              ${switchHtml("tdh-progress-title", "Show Progress in Tab", "", settings.progressInTitle)}
              ${switchHtml("tdh-keep-tab", "Keep Screen Awake", "Requests a screen wake lock during actual playback. Does not override visibility or pauses.", settings.keepTabActive)}
              ${switchHtml("tdh-hide-sub-promos", "Hide Twitch Subscribe Promos", "", settings.hideTwitchSubscriptionPromos)}
              ${switchHtml("tdh-reduce-motion", "Reduce Motion", "", settings.reduceMotion)}
            </div></section>
            ${sections.map(section => `<section class="fl-tool-panel"><div class="fl-tool-header" data-panel="${section.id}"><span class="fl-tool-title">${section.title}</span><button class="fl-tool-chevron" type="button" aria-expanded="false">▸</button></div><div class="fl-tool-body fl-tool-hidden" id="${section.id}"></div></section>
            `).join('')}<section class="fl-tool-panel"><div class="fl-tool-header" data-panel="tdh-diagnostics-body"><span class="fl-tool-title">System</span><button class="fl-tool-chevron" type="button" aria-expanded="false">▸</button></div><div class="fl-tool-body fl-tool-hidden" id="tdh-diagnostics-body">
              <div class="action-pair"><button type="button" class="life-btn" id="tdh-diagnostics-toggle" aria-label="Show Diagnostics">Show</button>
              <button type="button" class="life-btn" id="tdh-copy-diagnostics" aria-label="Copy Diagnostics">Copy</button></div>
              <div class="diag" id="tdh-diagnostics" role="region" aria-label="Site and Plugin Diagnostics" tabindex="0"></div>
            </div></section>
          </aside>
          <div class="progress-stack">
            <div class="badge-row" data-exp-part="launcher-row">
            <section id="tdh-drop-card" data-exp-part="progress-card" aria-live="polite">
              <button type="button" class="strip-toggle" id="tdh-strip-toggle" aria-controls="tdh-stream-info" aria-expanded="false" aria-label="Show Drop Details"></button>
              <div class="card-head-actions" id="tdh-card-head-actions"></div>
              <button type="button" class="chat-collapse" id="tdh-chat-collapse" aria-label="Hide Chat"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3.5h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H8l-3 2.5v-2.5H3a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"></path></svg></button>
              <button type="button" class="strip-menu" id="tdh-strip-menu" aria-label="Open Dropper Menu">Menu</button>
              <div class="expanded-content">
                <div class="stream-info" id="tdh-stream-info">
                  <div class="progress-copy">
                    <span class="strip-art" id="tdh-strip-art" aria-hidden="true"><img alt="" hidden><svg viewBox="0 0 16 16"><path d="M2.5 6h11v2.5h-11zM3.5 8.5h9V14h-9zM8 6v8M8 6C6.4 6 4.8 5.3 4.8 4.1c0-1 1.3-1.5 2-.7C7.5 4.1 8 6 8 6Zm0 0c1.6 0 3.2-.7 3.2-1.9 0-1-1.3-1.5-2-.7C8.5 4.1 8 6 8 6Z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"></path></svg></span>
                    <span class="strip-meta" id="tdh-strip-meta"><span class="strip-channel"></span><span class="strip-left"></span></span>
                    <div class="progress-head">
                      <div class="stream-channel" id="tdh-stream-channel">Finding stream…</div>
                      <div class="drop-percent" id="tdh-drop-percent">0%</div>
                    </div>
                    <div class="progress-category"><span class="stream-game" id="tdh-stream-game">Waiting for category</span></div>
                    <div class="drop-bar" role="progressbar" aria-label="Twitch Credited Drop Progress" aria-valuemin="0" aria-valuemax="100"><span id="tdh-drop-fill"></span></div>
                    <div class="progress-reward-row">
                      <span class="drop-name" id="tdh-drop-name">Waiting for Drop</span>
                    </div>
                    <div class="drop-status-row">
                      <div class="status-meta-chip">
                        <span class="state-pill" id="tdh-drop-state">Idle</span>
                        <span class="status-chip-divider" aria-hidden="true"></span>
                        <svg class="status-clock-icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.6"></circle><path d="M8 4.5v3.8l2.5 1.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path></svg>
                        <span id="tdh-updated-ago">Checked —</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="compact-card-actions">
                <span class="drop-meta" id="tdh-drop-meta">— / — min</span>
                <button type="button" id="tdh-chat-hide">Hide Chat</button>
                <button type="button" id="tdh-card-pause">Resume</button>
                <button type="button" id="tdh-skip-streamer" aria-label="No active streamer to skip"><span class="skip-label">Skip</span><span class="skip-countdown" hidden></span></button>
                <button type="button" id="tdh-card-menu" aria-label="Open Dropper Menu" aria-expanded="false">Menu</button>
              </div>
            </section>
            <button type="button" id="tdh-settings-launcher" data-exp-part="launcher" aria-controls="tdh-tools-dock" aria-expanded="false" aria-label="Open Dropper Settings" data-userscript-launcher="userscript-launcher-v1" data-launcher-id="dropper" data-launcher-preferred-position="right-bottom">
              <svg class="ring" viewBox="0 0 36 36" aria-hidden="true"><path class="track" d="M18 3H24A9 9 0 0 1 33 12V24A9 9 0 0 1 24 33H12A9 9 0 0 1 3 24V12A9 9 0 0 1 12 3H18Z"></path><path class="fill" id="tdh-ring" d="M18 3H24A9 9 0 0 1 33 12V24A9 9 0 0 1 24 33H12A9 9 0 0 1 3 24V12A9 9 0 0 1 12 3H18Z" pathLength="100" stroke-dasharray="0 100"></path></svg>
              ${dropperGemSvg("icon")}
            </button>
            </div>
          </div>
        </div>`;
      document.documentElement.appendChild(host);
      registerBadgeGrid(host, "dropper");
      ui = { host, shadow, cluster: shadow.getElementById("tdh-cluster"), launcher: shadow.getElementById("tdh-settings-launcher"), dock: shadow.getElementById("tdh-tools-dock") };
      // Text wrapping, width transitions, and nested panels can change the menu
      // after the initial layout. Coalesce resize work without another poll loop.
      let chromeLayoutFrame = 0;
      const chromeResizeObserver = new ResizeObserver(() => {
        if (!host.isConnected || ui?.host !== host) {
          cancelAnimationFrame(chromeLayoutFrame);
          chromeResizeObserver.disconnect();
          return;
        }
        if (chromeLayoutFrame) return;
        chromeLayoutFrame = requestAnimationFrame(() => {
          chromeLayoutFrame = 0;
          if (host.isConnected && ui?.host === host) layoutChrome();
        });
      });
      chromeResizeObserver.observe(ui.dock);
      chromeResizeObserver.observe(shadow.querySelector(".badge-row"));
      chromeResizeObserver.observe(shadow.getElementById("tdh-drop-card"));
      const chatTargets='.stream-chat,.stream-chat-header,.chat-room__content,button[aria-label="Previous leaderboard set"],button[aria-label="Expand Top Gifters Leaderboard"],[data-testid="leaderboard-top-three-entry"]';
      const chatObserver = new MutationObserver(records => {
        if (!host.isConnected) { restoreChatProgressSlot(); ui.chatResizeObserver?.disconnect(); chatObserver.disconnect(); removeEventListener('pagehide',restoreChatProgressSlot); return; }
        if (records.some(record => [...record.addedNodes, ...record.removedNodes].some(node =>
          node.nodeType === 1 && (node === ui.chatProgressSlot?.node || node.contains(ui.chatProgressSlot?.node) ||
            node.matches(chatTargets) || node.querySelector(chatTargets))))) requestAnimationFrame(layoutChrome);
      });
      chatObserver.observe(document.documentElement, {childList:true, subtree:true});
      ui.chatResizeObserver = new ResizeObserver(() => requestAnimationFrame(layoutChrome));
      addEventListener('pagehide', restoreChatProgressSlot);
      const updateNotice = shadow.getElementById("tdh-update-notice");
      updateNotice?.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();hideUpdateNotice();}});
      if (updateNotice) {
        updateNotice.dataset.placement = "menu";
        delete updateNotice.dataset.expFloatingNotice;
        ui.cluster.append(updateNotice);
        new ResizeObserver(() => requestAnimationFrame(positionMenuUpdateNotice)).observe(updateNotice);
        new MutationObserver(() => requestAnimationFrame(positionMenuUpdateNotice)).observe(updateNotice,{attributes:true,attributeFilter:["hidden","class"]});
      }
      bindDrag();
      bindSwitches();
      mountCompactDropperNavigation();
      mountProductTools();
      bindPanels();
      ExtraPotionsCore.mountMenuArrangement({ panel: ui.dock, id: "dropper", onChange: () => requestAnimationFrame(layoutChrome), resetLaunchers() { ExtraPotionsCore.resetLauncherGrid("dropper"); requestAnimationFrame(layoutChrome); } });
      ExtraPotionsCore.setMenuStatus("dropper", systemHealthSnapshot);
      ui.menuController = ExtraPotionsCore.createMenuController({
        id: "dropper", host, shadow, panel: ui.dock, themeRoot: ui.cluster,
        getSettings: () => settings, setOpen: setRailOpen, onLayout:layoutChrome, idleTimeoutMs: 60000,
      });
      const progressCard = shadow.getElementById("tdh-drop-card");
      const syncProgressPalette = () => {
        const menuStyle = getComputedStyle(ui.dock);
        for (const key of ["bg", "panel", "line", "text", "muted", "accent", "accent2", "focus"]) {
          const property = `--theme-${key}`, value = menuStyle.getPropertyValue(property).trim();
          if (progressCard.style.getPropertyValue(property) !== value) progressCard.style.setProperty(property, value);
        }
      };
      // Core resolves the menu palette on the dock; the floating card is its sibling.
      const progressPaletteObserver = new MutationObserver(() => {
        if (!host.isConnected) { progressPaletteObserver.disconnect(); return; }
        syncProgressPalette();
      });
      progressPaletteObserver.observe(ui.dock, { attributes: true, attributeFilter: ["style"] });
      syncProgressPalette();
      // A reward image that fails to load falls back to the gift icon until the reward changes.
      const stripArtImage = shadow.querySelector("#tdh-strip-art img");
      stripArtImage?.addEventListener("error", () => { stripArtImage.dataset.failed = stripArtImage.getAttribute("src") || ""; stripArtImage.hidden = true; });
      shadow.getElementById('tdh-card-pause')?.addEventListener('click',cardPause);
      shadow.getElementById('tdh-card-menu')?.addEventListener('click',()=>setRailOpen(!railOpen,true));
      // The one-line card's Menu shows only while the menu is closed, so it only opens.
      shadow.getElementById('tdh-strip-menu')?.addEventListener('click',()=>setRailOpen(true,true));
      // The card covers the Stream Chat title bar, so it carries Twitch's collapse-chat button for it.
      const hideChat=()=>{if(railOpen)setRailOpen(false);const toggle=visibleChatToggle();restoreChatProgressSlot();toggle?.click();requestAnimationFrame(layoutChrome);};
      for(const id of ['tdh-chat-hide','tdh-chat-collapse'])shadow.getElementById(id)?.addEventListener('click',hideChat);
      bindDropperControls();
      
      renderSwitches();
      applyMotionSetting();
      applyAppearanceSettings();
      render();
      syncMenuSizing();
      layoutChrome();
      ui.launcher.addEventListener("click", () => setRailOpen(!railOpen));
      // Badge Only opens the same compact card, keeping progress out of the menu.
      const stripToggle = shadow.getElementById("tdh-strip-toggle");
      const setStripOpen = (open) => {
        progressCard.classList.toggle("is-expanded", open);
        stripToggle.setAttribute("aria-expanded", String(open));
        requestAnimationFrame(layoutChrome);
      };
      // The card's front opens and closes the menu (keyboard activation moves focus into it and back).
      stripToggle.addEventListener("click", (event) => {
        const keyboard = event.detail === 0;
        setRailOpen(!railOpen, keyboard);
        if (keyboard && !railOpen) stripToggle.focus({ preventScroll: true });
      });
      // exp-core-allow: the progress strip is a Dropper floating card beside the Core dock, not a Core menu, so Core's outside-press close and keepOpen do not cover it.
      document.addEventListener("pointerdown", (event) => {
        if (!progressCard.classList.contains("is-expanded") || progressCard.dataset.presentation === "compact-card" || event.composedPath().includes(progressCard)) return;
        setStripOpen(false);
      }, true);
      shadow.getElementById("tdh-header-version")?.addEventListener("click", (event) => {
        event.stopPropagation();
        if (!railOpen) setRailOpen(true);
        showCurrentChangelog();
        scheduleMenuDismiss();
      });
      // Core owns the support control: its button, popover, donation options and outside-press closing.
      const support = ExtraPotionsCore.createSupportControl({ label: "Support Dropper" });
      if (support) shadow.querySelector(".header-actions")?.prepend(support.element);
      // The menu has no header of its own any more: changelog, support and close sit on the card's front row.
      shadow.getElementById("tdh-card-head-actions")?.append(shadow.getElementById("tdh-header-version"), shadow.querySelector(".header-actions"));
      const supportPopover = support?.popover || null;
      const closeSupportPopover = () => support?.hide();
      shadow.getElementById("tdh-rail-close").addEventListener("click", () => {
        closeSupportPopover();
        setRailOpen(false);
      });
      document.addEventListener("keydown", (event) => {
        if (event.altKey && (event.key === "g" || event.key === "G") && !event.repeat) { event.preventDefault(); setRailOpen(!railOpen, true); }
        if (event.key === "Escape" && supportPopover?.hidden === false) { closeSupportPopover(); return; }
        if (event.key === "Escape" && skipStreamerArmSnapshot()) { clearSkipStreamerArm('escape'); event.preventDefault(); return; }
        if (event.key === "Escape" && railOpen) setRailOpen(false, true);
        if (!event.altKey && (event.key === "r" || event.key === "R") && railOpen) requestGqlPoll("keyboard-refresh", true);
      });
      return ui;
    }

    function mountCompactDropperNavigation(){
      const shadow=ui.shadow,drops=shadow.getElementById('tdh-drops-body'),settingsBody=shadow.getElementById('tdh-streams-body');
      const section=body=>body.closest('.fl-tool-panel');
      section(drops).querySelector('.fl-tool-title').textContent='Campaigns';
      const campaigns=shadow.getElementById('tdh-open-campaigns');if(campaigns)campaigns.open=true;
      section(settingsBody).querySelector('.fl-tool-title').textContent='Settings';
      const advanced=ExtraPotionsCore.createDisclosure('Advanced',...settingsBody.childNodes);
      advanced.id='tdh-settings-advanced';
      const lookBody=shadow.getElementById('tdh-progress-body');
      const lookSection=section(lookBody);
      lookSection.querySelector('.fl-tool-title').textContent='Look';
      const claim=shadow.getElementById('tdh-claim-drops')?.closest('.fl-switch');
      const claimLabel=claim?.querySelector('.fl-switch-text');if(claimLabel)claimLabel.textContent='Claim Completed Drops';
      const bonus=shadow.getElementById('tdh-claim-bonus')?.closest('.fl-switch');if(bonus)advanced.append(bonus);
      advanced.querySelector('#tdh-find-next')?.closest('.fl-switch')?.remove();
      advanced.querySelector('#tdh-allow-switching')?.remove();
      const policy=advanced.querySelector('#tdh-switch-policy');
      policy.setAttribute('aria-label','Stream Switching');
      const option=(value,text,disabled=false)=>{const node=document.createElement('option');node.value=value;node.textContent=text;node.disabled=disabled;return node;};
      policy.replaceChildren(option('normal','Follow Campaign Order'),option('stopped-earning','Keep an Earning Stream'),option('off','Stay on This Stream'),option('held','Manual Stream Protected',true));
      const policyRow=policy.closest('.mini-row');policyRow.querySelector('label').textContent='Switching';
      const mute=advanced.querySelector('#tdh-mute-next')?.closest('.fl-switch');
      const notifications=[...advanced.querySelectorAll('details')].find(d=>d.querySelector(':scope>summary')?.textContent==='Notifications');
      const interruptions=[...advanced.querySelectorAll('details')].find(d=>d.querySelector(':scope>summary')?.textContent==='Interruption Rules');
      const pause=advanced.querySelector('#tdh-pause-switch')?.closest('.mini-row');if(pause&&interruptions)interruptions.append(pause);
      settingsBody.replaceChildren(...[claim,policyRow,mute,notifications,advanced].filter(Boolean));
      refreshStreamPolicyControl();
      const search=document.createElement('input');search.type='search';search.id='tdh-campaign-search';search.placeholder='Find a Game';search.setAttribute('aria-label','Search Campaigns');search.addEventListener('input',filterCampaignRows);drops.prepend(search);
      const empty=document.createElement('p');empty.id='tdh-campaign-filter-empty';empty.hidden=true;empty.textContent='No matching campaigns.';drops.append(empty);
    }

    function filterCampaignRows(){
      const query=ui.shadow.getElementById('tdh-campaign-search')?.value.trim().toLowerCase()||'';
      const rows=[...ui.shadow.querySelectorAll('#tdh-open-campaign-list .campaign-game-row')];
      for(const row of rows)row.hidden=Boolean(query&&!row.querySelector('.campaign-game-name')?.textContent.toLowerCase().includes(query));
      const empty=ui.shadow.getElementById('tdh-campaign-filter-empty');if(empty)empty.hidden=!query||!rows.length||rows.some(row=>!row.hidden);
    }

    function mountProductTools() {
      const target=ui.shadow.getElementById('tdh-diagnostics-body');
      if(!target||target.querySelector('[data-exp-product-system]'))return;
      ui.healthControl=ExtraPotionsCore.createProductTimeline('dropper',systemHealthSnapshot,setStatus,{layout:'grouped'});
      const timeline=ui.healthControl.element,log=ui.healthControl.log,rows=document.createElement('div');
      ui.healthControl.activity.append(rows);
      log.addEventListener('toggle',()=>{if(log.open)renderRecentActivity(rows);});
      const diagnostics=document.createElement('div');diagnostics.className='diagnostics-controls';
      diagnostics.append(target.querySelector('.action-pair'),target.querySelector('#tdh-diagnostics'));
      // Menu size is a display choice, so it lives at the end of Appearance.
      const appearance=ui.shadow.getElementById('tdh-progress-body');
      if(appearance&&!appearance.querySelector('[data-dropper-menu-preferences]')){const preferences=ExtraPotionsCore.createMenuSizeControls();preferences.dataset.dropperMenuPreferences='1';appearance.prepend(preferences);}
      if(appearance&&!appearance.querySelector('[data-dropper-site-colors]')){
        const menu=ExtraPotionsCore.createThemeModeControl({value:settings.uiTheme,onChange:uiTheme=>{settings.uiTheme=uiTheme;saveSettings();applyAppearanceSettings();}});
        const site=ExtraPotionsCore.createSiteColorControl({value:settings.siteColors,onChange:siteColors=>{settings.siteColors=siteColors;saveSettings();applySiteColors();}});
        site.dataset.dropperSiteColors='1';appearance.querySelector('[data-dropper-menu-preferences]')?.after(menu,site);
      }
      const system=ExtraPotionsCore.createProductSystem({id:'dropper',version:APP_VERSION,timeline,diagnostics,onReset:resetAllDropperData,notify:setStatus,layout:'grouped',issueSettings:()=>({current:settings,defaults:DEFAULTS})});
      target.replaceChildren(system);
    }

    function layoutChrome() {
      if (!ui?.cluster?.isConnected) { restoreChatProgressSlot(); return; }
      syncMenuSizing();

      syncProgressPanelPlacement();
      const badgeRow = ui.shadow.querySelector(".badge-row");
      const progressStack = ui.shadow.querySelector(".progress-stack");
      const progressCard = ui.shadow.getElementById("tdh-drop-card");
      const pageCardShown = progressCard?.dataset.presentation === "page-card";
      // exp-core owns launcher coordinates. As a flyout tile (or alone in a site slot) the launcher is 40px and
      // sits exactly where Core places it.
      const placement = ExtraPotionsCore.launcherPlacement(ui.host);
      const shared = Boolean(placement.flyout || placement.site);
      const launcherWidth = shared ? placement.size || 40 : 48;
      const rowHeight = pageCardShown ? Math.max(112, progressCard.offsetHeight || 112) : launcherWidth;
      const panelWidth = ExtraPotionsCore.menuWidth();
      const menuPanelWidth = Math.min(panelWidth, Math.max(0, window.innerWidth - 24));
      const rowGap = pageCardShown ? 8 : 0;
      const rowWidth = pageCardShown ? panelWidth + rowGap + launcherWidth : launcherWidth;

      const reservedRows = pageCardShown ? 1 : 0;
      if (ui.host.dataset.launcherReservedRows !== String(reservedRows)) {
        ui.host.dataset.launcherReservedRows = String(reservedRows);
        document.dispatchEvent(new CustomEvent("exp-core:coordination", { detail: { type: "launcher-reservation", productId: "dropper", rows: reservedRows } }));
      }

      // With the launchers anchored at the bottom the launcher sits at the bottom of Dropper's row and the card
      // rises above it; anchored at the top the launcher sits at the top of the row and the card hangs below it,
      // so the card is never pushed off the edge of the window.
      launcherGridDelta = placement.delta;
      const anchor = placement.anchor;
      ui.cluster.dataset.launcherAnchor = anchor;
      ui.cluster.dataset.sharedLauncher = shared ? "1" : "0";
      clusterTop = shared || anchor === "top" ? placement.top : placement.top - (rowHeight - 48);

      if (badgeRow) {
        badgeRow.style.setProperty("width", `${Math.min(rowWidth, window.innerWidth - 24)}px`, "important");
        badgeRow.style.setProperty("right", `${shared ? Math.round(placement.right) : 12}px`, "important");
        badgeRow.style.setProperty("left", "auto", "important");
        // A shared launcher sits exactly where exp-core puts it (a site slot may be closer than 8px to the top).
        badgeRow.style.setProperty("top", `${shared ? clusterTop : Math.max(8, Math.min(window.innerHeight - rowHeight - 8, clusterTop))}px`, "important");
        badgeRow.style.setProperty("bottom", "auto", "important");
        badgeRow.style.setProperty("gap", `${rowGap}px`, "important");
        badgeRow.style.setProperty("min-height", `${rowHeight}px`, "important");
      }

      if (progressStack) {
        progressStack.style.width = `${Math.min(rowWidth, window.innerWidth - 24)}px`;
        progressStack.style.minHeight = `${rowHeight}px`;
      }

      const badgeOnlySlot = ui.shadow.getElementById("tdh-badge-only-progress-slot");
      // Tells exp-core the progress card is showing beside the launchers, so menus and notices open above it
      // instead of over it. In Badge Only the card lives in the menu and reserves nothing.
      if (progressCard) {
        // The strip under the top bar is reserved too, so update cards and changelogs open below it.
        if (["page-card", "strip", "compact-card"].includes(progressCard.dataset.presentation)) progressCard.dataset.expReserved = "1";
        else delete progressCard.dataset.expReserved;
      }
      if (progressCard?.dataset.presentation === "page-card") {
        progressCard.style.setProperty("width", `${Math.min(panelWidth, Math.max(0, window.innerWidth - 80))}px`, "important");
        progressCard.style.setProperty("max-width", `calc(100vw - 80px)`, "important");
        for (const property of ["left", "right", "top", "bottom"]) progressCard.style.removeProperty(property);
      } else if (progressCard?.dataset.presentation === "menu-card" && badgeOnlySlot) {
        // Inside the menu, match the same inner content width used by every
        // .fl-tool-panel. Core owns the viewport-clamped outer menu width.
        badgeOnlySlot.style.setProperty("width", "100%", "important");
        badgeOnlySlot.style.setProperty("margin-left", "0", "important");
        badgeOnlySlot.style.setProperty("margin-right", "0", "important");
        progressCard.style.setProperty("width", "100%", "important");
        progressCard.style.setProperty("max-width", "100%", "important");
        for (const property of ["left", "right", "top", "bottom"]) progressCard.style.removeProperty(property);
      }

      if(progressCard?.dataset.progressPlacement==='menu'){
        progressCard.style.setProperty('width','100%','important');progressCard.style.setProperty('max-width','100%','important');
        for(const property of ['left','right','top','bottom'])progressCard.style.removeProperty(property);
      } else if(progressCard?.dataset.presentation==='compact-card'){
        // Open, the card widens to the menu's width (its right edge stays put) so card and drawers line up.
        const cardWidth=railOpen?menuPanelWidth:ExtraPotionsCore.menuSizeTokens().cardWidth;
        progressCard.style.setProperty('width',cardWidth+'px','important');progressCard.style.setProperty('max-width','calc(100vw - 24px)','important');
        if(!positionChatProgressCard()){
          progressCard.style.setProperty('width',cardWidth+'px','important');progressCard.style.setProperty('max-width','calc(100vw - 24px)','important');
          ExtraPotionsCore.placeNotice(ui.host,progressCard);updateProgressCardAside();
        }
      } else updateProgressCardAside();
      positionProgressStrip();
      if (railOpen) {
        // exp-core owns menu placement: beside the launcher grid, lined up with this launcher.
        ui.dock.style.overflowY = "auto";
        let safeMenuTop = ExtraPotionsCore.placeMenu(ui.host, ui.dock, menuPanelWidth)?.top ?? 8;
        safeMenuTop = attachMenuToCard(progressCard) ?? safeMenuTop;

        document.documentElement.dataset.expDropperMenuOpen = "1";
        const previousTop = document.documentElement.style.getPropertyValue("--exp-dropper-menu-top");
        const nextTop = `${Math.round(safeMenuTop)}px`;
        document.documentElement.style.setProperty("--exp-dropper-menu-top", nextTop);
        if (previousTop !== nextTop) {
          document.dispatchEvent(new CustomEvent("exp-core:coordination", { detail: { type: "dropper-menu-position", productId: "dropper" } }));
        }
      } else {
        ui.dock.style.overflowY = "";
        for (const property of ["top", "bottom", "left", "right", "width", "max-height"]) ui.dock.style.removeProperty(property);
      }

      ui.cluster.classList.remove("open-up");
      ui.cluster.style.top = "0px";
      ui.cluster.style.right = "0px";
      ui.cluster.style.gap = "0px";
      ui.cluster.style.zIndex = railOpen ? "2147483647" : "2147483600";

      positionMenuUpdateNotice();
    }

    // Progress cabinet: the open menu hangs from the card's edge at the card's width. Below the card when the card is
    // in chat or the launchers sit at the top; above it when the launchers sit at the bottom of the window.
    // Returns the menu's top, or null when the card is not showing (Core's own placement then stands).
    function attachMenuToCard(card) {
      const box = card?.getBoundingClientRect();
      if (!box || !box.width || !box.height) { delete ui.dock.dataset.cabinet; delete card?.dataset.cabinet; return null; }
      const below = card.dataset.chatDocked === 'true' || ui.cluster.dataset.launcherAnchor === 'top' || box.top + box.height / 2 < innerHeight / 2;
      const side = below ? 'below' : 'above';
      card.dataset.cabinet = side; ui.dock.dataset.cabinet = side;
      const room = Math.max(0, below ? innerHeight - box.bottom - 8 : box.top - 8);
      ui.dock.style.setProperty('width', `${Math.round(box.width)}px`, 'important');
      ui.dock.style.setProperty('right', `${Math.round(innerWidth - box.right)}px`, 'important');
      ui.dock.style.setProperty('left', 'auto', 'important');
      ui.dock.style.setProperty('max-height', `${Math.round(room)}px`, 'important');
      ui.dock.style.setProperty('bottom', 'auto', 'important');
      const top = below ? box.bottom : box.top - Math.min(ui.dock.offsetHeight, room);
      ui.dock.style.setProperty('top', `${Math.round(top)}px`, 'important');
      return Math.round(top);
    }

    // Launcher dragging is shared suite behavior owned by exp-core.
    function bindDrag() {
      ExtraPotionsCore.bindLauncherDrag(ui.launcher, "dropper", { layout: layoutChrome });
    }

    // Core owns inactivity, native-select protection and suite menu exclusivity.
    function clearMenuDismissTimer() {
      ui?.menuController?.cancelDismiss();
    }

    function scheduleMenuDismiss() {
      ui?.menuController?.scheduleDismiss();
    }

    function enforceAutoDismissDeadlines(now = Date.now()) {
      ui?.menuController?.enforceDeadline(now);
    }

    function setRailOpen(open, focus) {
      if(open)ui.healthControl?.refresh();
      railOpen = open;
      syncProgressPanelPlacement();
      if (open) {
        collapseToolPanels();
        collapseNestedPanels();
        // Core's section tabs remember the user's last tab under this key; reopen it, else Drops.
        let remembered = null;
        try { remembered = localStorage.getItem("exp:suite:menu-tab:dropper"); } catch {}
        const sectionHeader = (key) => /^[a-z0-9-]+$/.test(key || "") ? ui.shadow.querySelector(`.fl-tool-header[data-panel="${key}"]`) : null;
        (sectionHeader(remembered) || sectionHeader("tdh-drops-body"))?.click();
      }
      ui.menuController.state(open);
      ui.launcher.setAttribute("aria-expanded", String(open));
      const cardMenu=ui.shadow.getElementById("tdh-card-menu");if(cardMenu){cardMenu.textContent='Menu';cardMenu.setAttribute('aria-expanded',String(open));cardMenu.setAttribute('aria-label',open?'Close Dropper Menu':'Open Dropper Menu');}

      if (open) {
        document.documentElement.dataset.expDropperMenuOpen = "1";
        scheduleMenuDismiss();
        refreshTwitchAuthStatus();
      } else {
        // An update card shown inside the open menu floats on its own now, so it needs the shared turn; without it,
        // it waits for the turn like a card that arrived while the menu was closed.
        const updateCard = ui.shadow.getElementById("tdh-update-notice");
        if (updateCard && !updateCard.hidden && updateNoticeState && ExtraPotionsCore.takeNoticeTurn?.(UPDATE_NOTICE_TURN) === false) {
          const s = updateNoticeState;
          clearTimeout(updateNoticeTimer);
          updateCard.hidden = true;
          waitingUpdateNotice = [s.title, s.text, s.actionText, s.action, { ...s }];
        }
        clearSkipStreamerArm("menu-closed");
        delete document.documentElement.dataset.expDropperMenuOpen;
        document.documentElement.style.removeProperty("--exp-dropper-menu-top");
        document.dispatchEvent(new CustomEvent("exp-core:coordination", { detail: { type: "dropper-menu-closed", productId: "dropper" } }));
        clearMenuDismissTimer();
        const notice = ui.shadow.getElementById("tdh-update-notice");
        if (
          notice &&
          !notice.hidden &&
          notice.dataset.placement === "menu"
        ) {
          hideUpdateNotice();
        }
      }

      layoutChrome();
      requestAnimationFrame(layoutChrome);
      if (focus && open && !ExtraPotionsCore.focusMenuSurface(ui.dock)) {
        ui.dock.tabIndex = -1;
        ui.dock.focus({ preventScroll: true });
      }
      if (focus && !open) ui.launcher.focus();
    }

    function collapseToolPanels() {
      ui.shadow.querySelectorAll(".fl-tool-header").forEach((header) => {
        const body = ui.shadow.getElementById(header.dataset.panel);
        body.classList.add("fl-tool-hidden");
        header.setAttribute("aria-expanded", "false");
        header.classList.toggle("last-opened", header.dataset.panel === lastPanelId);
        const chevron = header.querySelector(".fl-tool-chevron");
        chevron.textContent = "▸";
        chevron.setAttribute("aria-expanded", "false");
      });
    }

    function collapseNestedPanels() {
      const inventory = ui.shadow.getElementById("tdh-compact-inventory");
      const inventoryButton = ui.shadow.getElementById("tdh-toggle-inventory");
      inventory?.classList.remove("open");
      if (inventoryButton) {
        inventoryButton.textContent = "Show Drops Inventory";
        inventoryButton.classList.toggle("last-opened", lastSubmenuId === "inventory");
      }
      const diagnostics = ui.shadow.getElementById("tdh-diagnostics");
      const diagnosticsButton = ui.shadow.getElementById("tdh-diagnostics-toggle");
      diagnostics?.classList.remove("open");
      if (diagnostics) diagnostics.hidden = true;
      if (diagnosticsButton) {
        diagnosticsButton.textContent = "Show"; diagnosticsButton.setAttribute("aria-label", "Show Diagnostics");
        diagnosticsButton.setAttribute("aria-expanded", "false");
        diagnosticsButton.classList.toggle("last-opened", lastSubmenuId === "diagnostics");
      }
    }

    function bindPanels() {
      ui.shadow.querySelectorAll(".fl-tool-header").forEach((header) => {
        header.addEventListener("click", () => {
          const target = ui.shadow.getElementById(header.dataset.panel);
          const willOpen = target.classList.contains("fl-tool-hidden");
          if (willOpen) {
            lastPanelId = header.dataset.panel;
            collapseNestedPanels();
          }
          ui.shadow.querySelectorAll(".fl-tool-header").forEach((other) => {
            const body = ui.shadow.getElementById(other.dataset.panel);
            const open = other === header && willOpen;
            body.classList.toggle("fl-tool-hidden", !open);
            other.setAttribute("aria-expanded", String(open));
            other.querySelector(".fl-tool-chevron").textContent = open ? "▾" : "▸";
            other.querySelector(".fl-tool-chevron").setAttribute("aria-expanded", String(open));
            other.classList.toggle("last-opened", other.dataset.panel === lastPanelId);
          });
          requestAnimationFrame(layoutChrome);
        });
      });
    }

    // With the shared flyout launcher (or Dropper alone in Twitch's top bar) the launcher has no card beside it:
    // progress shows as a one-row strip over Twitch's Stream Chat title bar instead.
    function sharedLauncher() {
      const placement = ExtraPotionsCore.launcherPlacement(ui.host);
      return Boolean(placement?.flyout || placement?.site);
    }

    function syncProgressPanelPlacement() {
      if (!ui) return;
      const card = ui.shadow.getElementById("tdh-drop-card");
      const menuSlot = ui.shadow.getElementById("tdh-badge-only-progress-slot");
      const badgeRow = ui.shadow.querySelector(".badge-row");
      if (!card || !menuSlot || !badgeRow || !ui.launcher) return;
      // Progress cabinet: the card never moves into the menu. It stays beside the launcher or in chat, and the menu
      // opens from it. Drop details keeps the reward line and controls showing while the menu is closed.
      menuSlot.hidden=true;
      if(card.parentElement!==ui.cluster)ui.cluster.append(card);
      card.dataset.progressPlacement='outside';
      card.dataset.presentation='compact-card';card.dataset.expReserved='1';
      delete card.dataset.expanded;delete card.dataset.chatCollapsed;
      card.dataset.collapsed='false';
      card.classList.toggle('is-expanded',Boolean(railOpen||settings.dropDetails));
      if(!railOpen){delete card.dataset.cabinet;delete ui.dock.dataset.cabinet;}
      const toggle=ui.shadow.getElementById('tdh-strip-toggle');
      toggle.textContent=railOpen?'Close Dropper Menu':'Open Dropper Menu';
      toggle.setAttribute('aria-label',toggle.textContent);
      toggle.setAttribute('aria-controls','tdh-tools-dock');
      toggle.setAttribute('aria-expanded',String(Boolean(railOpen)));
      // The Menu button is the keyboard and screen-reader control; the tappable front is a pointer shortcut.
      toggle.tabIndex=-1;toggle.setAttribute('aria-hidden','true');
    }

    function isCardDrawer(card) {
      return card.dataset.presentation==='compact-card'&&card.dataset.progressPlacement==='outside'&&card.dataset.chatDocked!=='true'&&card.dataset.collapsed!=='true';
    }

    function restoreChatProgressSlot() {
      const slot=ui?.chatProgressSlot;
      if(!slot)return;
      ui.chatResizeObserver?.unobserve(slot.node);
      for(const [property,value,priority] of slot.styles) {
        if(value)slot.node.style.setProperty(property,value,priority);else slot.node.style.removeProperty(property);
      }
      for(const [name,value] of slot.attributes) {
        if(value===null)slot.node.removeAttribute(name);else slot.node.setAttribute(name,value);
      }
      ui.chatProgressSlot=null;
    }

    function visibleChatToggle() {
      return [...document.querySelectorAll(TWITCH_CHAT_TOGGLE)].find(node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden') || document.querySelector(TWITCH_CHAT_TOGGLE);
    }

    function positionChatProgressCard() {
      const card=ui?.shadow.getElementById('tdh-drop-card');
      if(!card||card.dataset.progressPlacement==='menu')return false;
      const content=document.querySelector('.stream-chat .chat-room__content');
      // The card takes the place of the Stream Chat title bar (user, 2026-11-13); without one, the top gifters strip.
      const title=document.querySelector('.stream-chat .stream-chat-header');
      const titleBox=title?.getBoundingClientRect();
      const leaderboard=content?.querySelector('button[aria-label="Previous leaderboard set"],button[aria-label="Expand Top Gifters Leaderboard"],[data-testid="leaderboard-top-three-entry"]');
      let panel=leaderboard;
      while(panel && panel.parentElement!==content)panel=panel.parentElement;
      if(title&&titleBox?.height>0&&titleBox.width>=160&&getComputedStyle(title).display!=='none')panel=title;
      if(panel===title&&title?.querySelector(TWITCH_CHAT_TOGGLE))card.dataset.chatToggle='1';else delete card.dataset.chatToggle;
      const box=panel?.getBoundingClientRect();
      // Twitch's slot can extend a fractional pixel past the layout viewport at zoomed sizes.
      const left=box?Math.max(0,box.left):0,right=box?Math.min(innerWidth,box.right):0;
      const available=box && right-left>=160 && box.height>0 && box.top>=0 && box.bottom<=innerHeight &&
        getComputedStyle(content).visibility!=='hidden' && getComputedStyle(content).display!=='none';
      if(ui.chatProgressSlot?.node!==panel || !available || card.dataset.collapsed==='true')restoreChatProgressSlot();
      delete card.dataset.chatDocked;
      if(!available){delete card.dataset.chatToggle;return false;}
      card.dataset.chatDocked='true';
      card.style.setProperty('width',(right-left)+'px','important');
      card.style.setProperty('max-width','100vw','important');
      if(card.dataset.collapsed!=='true' && box.top+card.offsetHeight>innerHeight-8) {
        restoreChatProgressSlot();delete card.dataset.chatDocked;return false;
      }
      // Keep React's leaderboard mounted; reserve the card's height without covering chat messages.
      if(card.dataset.collapsed!=='true' && !ui.chatProgressSlot) {
        const properties=['height','min-height','max-height','visibility','overflow','flex-shrink'];
        ui.chatProgressSlot={node:panel,styles:properties.map(p=>[p,panel.style.getPropertyValue(p),panel.style.getPropertyPriority(p)]),attributes:['inert','aria-hidden'].map(n=>[n,panel.getAttribute(n)])};
        panel.setAttribute('inert','');panel.setAttribute('aria-hidden','true');
        ui.chatResizeObserver?.observe(panel);
      }
      card.style.setProperty('left',left+'px','important');
      card.style.setProperty('top',(card.dataset.collapsed==='true'?Math.max(0,box.top-card.offsetHeight):box.top)+'px','important');
      card.style.setProperty('right','auto','important');card.style.setProperty('bottom','auto','important');
      if(ui.chatProgressSlot) {
        const height=Math.ceil(card.getBoundingClientRect().height)+'px';
        for(const [property,value] of [['height',height],['min-height',height],['max-height',height],['visibility','hidden'],['overflow','hidden'],['flex-shrink','0']]) {
          if(panel.style.getPropertyValue(property)!==value)panel.style.setProperty(property,value,'important');
        }
      }
      return true;
    }

    // The strip sits over the Stream Chat title bar. Without one (directory pages, collapsed chat) it lines up with
    // the launcher like an update card. Clicking it opens the full card in place.
    function positionProgressStrip() {
      const card = ui?.shadow.getElementById("tdh-drop-card");
      if (!card) return;
      if (card.dataset.presentation !== "strip") { card.style.removeProperty("visibility"); return; }
      // The open flyout's tile row crosses the chat title bar; the strip steps aside until the flyout closes.
      card.style.setProperty("visibility", document.documentElement.dataset.expFlyoutOpen === "1" ? "hidden" : "visible", "important");
      const header = document.querySelector(".stream-chat-header");
      const box = header?.getBoundingClientRect();
      const visible = box && box.width >= 160 && box.height >= 24 && box.bottom > 0 && box.top < window.innerHeight && getComputedStyle(header).visibility !== "hidden";
      card.style.setProperty("position", "fixed", "important");
      if (visible) {
        card.style.setProperty("width", `${Math.round(box.width - 16)}px`, "important");
        card.style.setProperty("left", `${Math.round(box.left + 8)}px`, "important");
        // 52px is taller than Twitch's 40px title bar: line up with its top so the top bar stays clear.
        card.style.setProperty("top", `${Math.round(box.top)}px`, "important");
        card.style.setProperty("right", "auto", "important");
        card.style.setProperty("bottom", "auto", "important");
        card.dataset.stripAnchor = "chat";
      } else {
        card.style.setProperty("width", `${Math.min(ExtraPotionsCore.menuWidth(), window.innerWidth - 24)}px`, "important");
        ExtraPotionsCore.placeNotice(ui.host, card, railOpen ? ui.dock : null);
        card.dataset.stripAnchor = "launcher";
      }
    }

    function updateProgressCardAside() {
      const card = ui?.shadow.getElementById("tdh-drop-card");
      if (!card) return;
      card.style.removeProperty('position');
      if (!['page-card','compact-card'].includes(card.dataset.presentation)) return;
      const box = card.getBoundingClientRect();
      if (!box.width || !box.height) return;
      const launcherNodes = [...document.querySelectorAll('[data-exp-product-launcher="1"]')]
        .map(host => host.shadowRoot?.querySelector('[data-exp-part="launcher"],.launcher')).filter(Boolean);
      const visibleBoxes = nodes => nodes.filter(node => {
        const style = getComputedStyle(node);
        return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) !== 0;
      }).map(node => node.getBoundingClientRect()).filter(r => r.width && r.height);
      const launchers = visibleBoxes(launcherNodes);
      const obstacles = [...visibleBoxes([...document.querySelectorAll(TWITCH_KEEP_CLEAR)]), ...launchers];
      const overlap = (left, top, boxes = obstacles) => boxes.reduce((area, r) => area + Math.max(0, Math.min(left + box.width, r.right) - Math.max(left, r.left)) * Math.max(0, Math.min(top + box.height, r.bottom) - Math.max(top, r.top)), 0);
      if (!overlap(box.left, box.top)) return;
      const maxLeft = Math.max(8, window.innerWidth - box.width - 8);
      const maxTop = Math.max(8, window.innerHeight - box.height - 8);
      const xs = [box.left, 8, maxLeft, ...obstacles.flatMap(r => [r.left - box.width - 8, r.right + 8])];
      const ys = [box.top, 8, maxTop, ...obstacles.flatMap(r => [r.top - box.height - 8, r.bottom + 8])];
      let best = null;
      for (const x of xs) for (const y of ys) {
        const left = Math.max(8, Math.min(maxLeft, x)), top = Math.max(8, Math.min(maxTop, y));
        const launcherArea = overlap(left, top, launchers), area = overlap(left, top), distance = Math.abs(left - box.left) + Math.abs(top - box.top);
        // Keep suite controls reachable before minimizing overlap with Twitch's content.
        if (!best || launcherArea < best.launcherArea || (launcherArea === best.launcherArea && (area < best.area || (area === best.area && distance < best.distance)))) best = { left, top, launcherArea, area, distance };
      }
      // Keep progress visible even when the window offers no completely clear space.
      card.style.setProperty('position', 'fixed', 'important');
      card.style.setProperty('left', `${best.left}px`, 'important');
      card.style.setProperty('top', `${best.top}px`, 'important');
    }

    // Optional Twitch page colours from Core's shared palettes. Only neutral surfaces, text, borders and links change;
    // Twitch's purple buttons, live and status colours stay, and its dark overlay container keeps its own values.
    function twitchSiteColorCss(p, scope) {
      const alpha = (color, percent) => `color-mix(in srgb,${color} ${percent}%,transparent)`;
      const solid = (color, percent) => `color-mix(in srgb,${color} ${percent}%,${p.bg})`;
      const groups = [
        [p.bg, ['background-body','background-social-column']],
        [p.panel, ['background-base','background-input','background-input-focus','background-modal']],
        [p.raised, ['background-alt','background-alt-2','background-float','background-chat-alt','background-chat-line-mentioning','background-ftue-tooltip','background-snackbar-info']],
        [p.inset, ['background-chat','background-chat-header']],
        [alpha(p.text, p.mode === 'dark' ? 13 : 6), ['background-hover','background-interactable-alpha-hover','background-interactable-alpha-selected']],
        [alpha(p.line, 30), ['background-button-secondary-default','background-placeholder','background-selectable','background-tag-default','background-input-disabled','background-segmented-button']],
        [alpha(p.line, 40), ['background-interactable-hover','background-button-secondary-hover','background-button-text-hover','background-selectable-hover','background-tag-hover','background-button-icon-primary-hover','border-base','border-tab','border-tag','border-selectable','border-selectable-hover','border-spinner','border-bottom-sheet-item']],
        [alpha(p.line, 50), ['background-interactable-active','background-button-secondary-active','background-button-text-active','background-tag-active','background-segmented-bar','background-button-icon-primary-active']],
        [alpha(p.text, 40), ['background-scrollbar']],
        [solid(p.line, 35), ['border-region']],
        [p.line, ['border-input-hover','border-segmented-button','border-selectable-hover-outer']],
        [p.accent, ['border-input-focus','border-tab-active','text-link','text-link-active','text-link-visited','text-tab-active','text-button-text']],
        [`color-mix(in srgb,${p.accent} 75%,${p.text})`, ['text-link-hover','text-link-focus','border-tab-hover','border-tab-focus']],
        [p.text, ['text-base','text-alt','text-input','text-label','text-tab','text-tag','text-button-secondary','text-button-text-hover','text-button-disabled','text-snackbar-info','border-spinner-fill']],
        [p.muted, ['text-alt-2','text-hint','text-label-optional','text-keyboard-prompt','border-input','border-input-checkbox','border-toggle','border-quote']],
        [alpha(p.text, 70), ['text-input-placeholder']],
      ];
      const vars = groups.flatMap(([value, names]) => names.map(name => `--color-${name}:${value}!important`)).join(';');
      return `${scope}{color-scheme:${p.mode};${vars};background-color:${p.bg}!important}
  ${scope} ::selection{background:${alpha(p.accent, 35)};color:${p.text}}`;
    }

    function applySiteColors() {
      if (ExtraPotionsCore.suiteSitePaused?.()) { siteColors?.clear(); return; }
      siteColors ??= ExtraPotionsCore.createSiteColors({
        product: 'dropper',
        css: twitchSiteColorCss,
      });
      siteColors.apply(settings.siteColors);
    }

    function applyAppearanceSettings() {
      applySiteColors();
      if (!ui) return;
      ExtraPotionsCore.applyTheme(ui.host, settings.uiTheme);
      const stack = ui.shadow.querySelector(".progress-stack");
      if (!stack) return;
      stack.classList.toggle("badge-only", Boolean(settings.badgeOnly));
      syncProgressPanelPlacement();
      ui.cluster.dataset.badgeOnly = settings.badgeOnly ? "true" : "false";
      requestAnimationFrame(layoutChrome);
    }

    function applyMotionSetting() {
      ui?.cluster?.classList.toggle("reduce-motion", Boolean(settings.reduceMotion));
    }

    function applyProgressColor(percent) {
      if (!ui) return;
      const fill = ui.shadow.getElementById("tdh-drop-fill");
      const pct = ui.shadow.getElementById("tdh-drop-percent");
      const ring = ui.shadow.getElementById("tdh-ring");
      if (fill) fill.style.background = 'var(--theme-accent)';
      if (pct) pct.style.color = 'var(--theme-text)';
      if (ring) ring.style.stroke = 'var(--theme-accent)';
    }

    function notifyUser(text) {
      if (!ui) return;
      const toast = ui.shadow.getElementById("tdh-toast");
      if (!toast) return;
      toast.textContent = text;
      toast.hidden = false;
      clearTimeout(notifyUser.timer);
      notifyUser.timer = setTimeout(() => { toast.hidden = true; }, 3000);
      requestAnimationFrame(layoutChrome);
    }

    function showCurrentChangelog() {
      showUpdateNotice(
        "Dropper Changelog",
        `What\'s new in v${APP_VERSION}.`,
        "",
        null,
        {
          kicker: "Current Version",
          version: APP_VERSION,
          details: RELEASE_NOTES[APP_VERSION] || [],
          releaseUrl: RELEASES_URL,
          placement: "menu",
        },
      );
    }

    function placeUpdateNotice() {
      if (!ui) return;
      const notice = ui.shadow.getElementById("tdh-update-notice");
      if (!notice) return;
      notice.dataset.placement = "menu";
      delete notice.dataset.expFloatingNotice;
      for (const property of ["left", "right", "top", "bottom", "width"]) {
        notice.style.removeProperty(property);
      }
      if (notice.parentElement !== ui.cluster) ui.cluster.appendChild(notice);
    }

    function noticePanelWidth() {
      return ExtraPotionsCore.menuWidth();
    }

    function positionMenuUpdateNotice() {
      if (!ui) return;
      const notice = ui.shadow.getElementById("tdh-update-notice");
      if (!notice || notice.hidden) return;
      const width = Math.min(noticePanelWidth(), Math.max(0, window.innerWidth - 24));
      notice.style.setProperty("width", `${width}px`, "important");
      // exp-core owns notice placement: beyond an open menu, above the progress card, or beside the launchers.
      ExtraPotionsCore.placeNotice(ui.host, notice, railOpen ? ui.dock : null);
    }

    function showUpdateNotice(title, text, actionText = "View Update", action = null, options = {}) {
      const details = Array.isArray(options.details) ? options.details.slice(0, 4) : [];
      const state = {
        title,
        text,
        actionText,
        action,
        kicker: options.kicker || "What's New",
        version: options.version || APP_VERSION,
        details,
        releaseUrl: options.releaseUrl || RELEASES_URL,
        actionUrl: options.actionUrl || "",
        placement: "menu",
      };
      if (!ui) { updateNoticeState = state; return; }
      if (!railOpen && ExtraPotionsCore.takeNoticeTurn?.(UPDATE_NOTICE_TURN) === false) {
        waitingUpdateNotice = [title, text, actionText, action, options];
        return;
      }
      waitingUpdateNotice = null;

      clearTimeout(updateNoticeTimer);
      placeUpdateNotice();
      const notice = ui.shadow.getElementById("tdh-update-notice");
      const list = ui.shadow.getElementById("tdh-update-list");
      ui.shadow.getElementById("tdh-update-kicker").textContent = state.kicker;
      ui.shadow.getElementById("tdh-update-title").textContent = title;
      ui.shadow.getElementById("tdh-update-version").textContent = state.version ? `v${state.version}` : "";
      ui.shadow.getElementById("tdh-update-text").textContent = text || "";

      list.replaceChildren();
      details.forEach((detail) => {
        const item = document.createElement("li");
        item.textContent = detail;
        list.appendChild(item);
      });
      list.hidden = details.length === 0;

      const releaseButton = ui.shadow.getElementById("tdh-update-release");
      releaseButton.hidden = !state.releaseUrl;
      releaseButton.onclick = state.releaseUrl
        ? () => window.open(state.releaseUrl, "_blank", "noopener")
        : null;

      const button = ui.shadow.getElementById("tdh-update-action");
      const hasDistinctAction = Boolean(action && action !== hideUpdateNotice);
      button.hidden = !hasDistinctAction;
      button.textContent = actionText;
      if (hasDistinctAction && state.actionUrl) {
        button.href = state.actionUrl;
        button.target = "_blank";
        button.rel = "noopener noreferrer";
      } else {
        button.removeAttribute("href");
      }
      button.onclick = hasDistinctAction
        ? (event) => {
            if (!state.actionUrl) event.preventDefault();
            action(event);
          }
        : null;

      notice.hidden = false;
      updateNoticeState = state;
      requestAnimationFrame(() => { layoutChrome(); });

      updateNoticeTimer = setTimeout(() => {
        if (!notice.hidden) hideUpdateNotice();
      }, UPDATE_NOTICE_DURATION_MS);
    }

    function hideUpdateNotice() {
      clearTimeout(updateNoticeTimer);
      updateNoticeTimer = null;
      const notice = ui?.shadow?.getElementById("tdh-update-notice");
      if (notice) {const focused=notice.contains(ui.shadow.activeElement);notice.hidden = true;if(focused)ui.shadow.getElementById("tdh-header-version")?.focus({preventScroll:true});}
      updateNoticeState = null;
      ExtraPotionsCore.releaseNoticeTurn?.(UPDATE_NOTICE_TURN);
      requestAnimationFrame(() => { layoutChrome(); });
    }

    // The checker's cached result under the names the rest of Dropper already reads.
    function loadUpdateState() {
      const status = updateChecker.status();
      return {
        checkedForVersion: status.checkedForVersion || "",
        lastCheckAt: Number(status.checkedAt || 0),
        lastRemoteVersion: status.lastRemoteVersion || "",
        lastHttpStatus: Number(status.lastHttpStatus || 0),
        lastError: status.lastError || "",
        availableVersion: status.available ? status.latest : "",
        availableAt: status.available ? Number(status.checkedAt || 0) : 0,
      };
    }

    function markUpdateAvailable(version, details = [], quiet = false) {
      if (!ui || !version || compareVersions(version, APP_VERSION) <= 0) return;

      const alreadyAnnounced = lastUpdateNoticeVersion === version;
      ui.launcher?.classList.add("update-available");
      ExtraPotionsCore.setLauncherUpdate?.("dropper", true);
      if (ui.launcher) {
        ui.launcher.removeAttribute("title");
        ui.launcher.setAttribute("aria-label", `Open Dropper Settings · Update v${version} Available`);
      }

      if (alreadyAnnounced) return;
      lastUpdateNoticeVersion = version;
      // Quiet releases show only the badge and label above.
      if (quiet) return;
      if (!claimNotice(`available:${version}`)) return;

      showUpdateNotice(
        "New Dropper Version Available",
        `v${version} is ready to install.`,
        "Install Update",
        () => beginUpdateInstall(version),
        {
          kicker: "Update Available",
          version,
          details: details.length ? details.slice(0, 4) : [
            "A newer Dropper build is available.",
            "Install the latest userscript to get the newest fixes and improvements.",
            "After reinstalling, return to Twitch and Dropper will refresh this page automatically.",
          ],
          actionUrl: updateChecker.INSTALL_URL,
          placement: "menu",
        },
      );

      notifyUser(`Dropper v${version} Update available`);
    }

    function clearUpdateAvailableIndicator() {
      lastUpdateNoticeVersion = "";
      ui?.launcher?.classList.remove("update-available");
      ExtraPotionsCore.setLauncherUpdate?.("dropper", false);
      if (ui?.launcher) {
        ui.launcher.removeAttribute("title");
        ui.launcher.setAttribute("aria-label", "Open Dropper Settings");
      }
    }

    function checkCachedUpdateNotice() {
      const status = updateChecker.status();
      if (status.available && status.latest) {
        markUpdateAvailable(status.latest, status.details, status.quiet);
        return true;
      }
      clearUpdateAvailableIndicator();
      return false;
    }

    function checkVersionNotice() {
      clearUpdateAvailableIndicator();

      let previous = '';
      try { previous = localStorage.getItem(LAST_VERSION_KEY) || ''; } catch (_) {}
      if (previous && previous !== APP_VERSION
          && !ExtraPotionsCore.isQuietUpgrade(previous, APP_VERSION, Object.keys(RELEASE_NOTES), QUIET_RELEASES)
          && claimNotice(`updated:${APP_VERSION}`)) {
        showUpdateNotice(
          "Dropper Updated",
          `Updated from v${previous} to v${APP_VERSION}.`,
          "",
          null,
          { kicker: "Update Complete", version: APP_VERSION, details: RELEASE_NOTES[APP_VERSION] || [], placement: "menu" },
        );
      }
      try { localStorage.setItem(LAST_VERSION_KEY, APP_VERSION); } catch (_) {}
      checkCachedUpdateNotice();
    }

    function scheduleUpdateCheck(force = false) {
      if (typeof GM_xmlhttpRequest !== "function") return;
      updateChecker.check(force).then((result) => {
        if (result.available && result.latest) {
          if (lastUpdateNoticeVersion !== result.latest) {
            logActivity("update", `Dropper v${result.latest} is available`, {
              installedVersion: APP_VERSION,
              remoteVersion: result.latest,
            });
          }
          markUpdateAvailable(result.latest, result.details, result.quiet);
        } else if (result.latest) {
          clearUpdateAvailableIndicator();
        } else if (result.state === "failed" && result.lastError) {
          logActivity("update-error", result.lastError);
        }
      }).catch((error) => logActivity("update-error", cleanText(error?.message || "Update check failed")));
    }

    function loadUpdateReloadState() {
      try {
        const parsed = JSON.parse(localStorage.getItem(UPDATE_RELOAD_KEY) || "{}");
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
      } catch (_) {
        return {};
      }
    }

    function saveUpdateReloadState(state) {
      if (typeof productResetting !== 'undefined' && productResetting) return;
      try {
        localStorage.setItem(UPDATE_RELOAD_KEY, JSON.stringify(state || {}));
      } catch (_) {
        /* ignore */
      }
    }

    function clearUpdateReloadState(reason = "") {
      clearTimeout(updateReloadTimer);
      clearTimeout(updateFallbackTimer);
      updateReloadTimer = null;
      updateFallbackTimer = null;
      try { localStorage.removeItem(UPDATE_RELOAD_KEY); } catch (_) { /* ignore */ }
      if (reason) logActivity("update-reload", reason);
    }

    function validUpdateReloadState(now = Date.now()) {
      const state = loadUpdateReloadState();
      if (!state?.startedAt || !state?.targetVersion) return null;

      if (Number(state.expiresAt || 0) <= now) {
        clearUpdateReloadState("Pending update refresh expired");
        return null;
      }

      if (compareVersions(APP_VERSION, state.targetVersion) >= 0) {
        clearUpdateReloadState(`Installed v${APP_VERSION} already satisfies pending update v${state.targetVersion}`);
        return null;
      }

      return state;
    }

    function performUpdateReload(reason) {
      const state = validUpdateReloadState();
      if (!state) return false;

      clearUpdateReloadState(`Refreshing Twitch after update install · ${reason}`);
      setStatus("Update install started · Refreshing Twitch");
      location.reload();
      return true;
    }

    function scheduleUpdateReload(delayMs = UPDATE_RETURN_DELAY_MS, reason = "return") {
      const state = validUpdateReloadState();
      if (!state) return false;

      const now = Date.now();
      const reloadAt = now + Math.max(0, Number(delayMs) || 0);
      const existingReloadAt = Number(state.reloadAt || 0);

      // Keep an already-sooner refresh instead of extending it because focus and
      // visibility events often arrive together.
      if (existingReloadAt && existingReloadAt <= reloadAt) return true;

      state.reloadAt = reloadAt;
      state.reloadReason = reason;
      saveUpdateReloadState(state);

      clearTimeout(updateReloadTimer);
      updateReloadTimer = setTimeout(() => {
        performUpdateReload(reason);
      }, Math.max(0, reloadAt - Date.now()));

      setStatus(`Update install started · Refreshing in ${Math.max(1, Math.ceil(delayMs / 1000))}s`);
      return true;
    }

    function markUpdateInstallerLeft(reason = "blur") {
      const state = validUpdateReloadState();
      if (!state || state.leftAt) return false;
      state.leftAt = Date.now();
      state.leftReason = reason;
      saveUpdateReloadState(state);
      logActivity("update-reload", "Left Twitch for userscript installer", {
        targetVersion: state.targetVersion,
        reason,
      });
      return true;
    }

    function handleUpdateInstallerReturn(reason = "focus") {
      const state = validUpdateReloadState();
      if (!state) return false;

      if (state.leftAt) {
        return scheduleUpdateReload(UPDATE_RETURN_DELAY_MS, `returned-via-${reason}`);
      }

      // If the browser never reported blur/hidden, the fallback deadline can
      // still safely trigger a refresh while Twitch is visible.
      if (Date.now() >= Number(state.fallbackAt || 0)) {
        return scheduleUpdateReload(UPDATE_RETURN_DELAY_MS, `fallback-via-${reason}`);
      }
      return false;
    }

    function enforceUpdateReloadPending(now = Date.now()) {
      const state = validUpdateReloadState(now);
      if (!state) return false;

      if (state.reloadAt && now >= Number(state.reloadAt)) {
        return performUpdateReload(state.reloadReason || "scheduled");
      }

      if (now < Number(state.fallbackAt || 0)) return false;

      if (!state.leftAt) {
        clearUpdateReloadState("Update installer was not detected; automatic refresh cancelled");
        setStatus("Update refresh cancelled · Reload Twitch after installing");
        return false;
      }

      if (document.visibilityState === "visible") {
        return scheduleUpdateReload(UPDATE_RETURN_DELAY_MS, "45-second-fallback");
      }
      return false;
    }

    function scheduleUpdateReloadFallback() {
      const state = validUpdateReloadState();
      if (!state) return;

      clearTimeout(updateFallbackTimer);
      const delay = Math.max(0, Number(state.fallbackAt || 0) - Date.now());
      updateFallbackTimer = setTimeout(() => {
        enforceUpdateReloadPending(Date.now());
      }, delay + 20);
    }

    function beginUpdateInstall(targetVersion) {
      const version = cleanText(targetVersion);
      if (!version || compareVersions(version, APP_VERSION) <= 0) return false;

      const now = Date.now();
      clearTimeout(updateReloadTimer);
      clearTimeout(updateFallbackTimer);
      updateReloadTimer = null;
      updateFallbackTimer = null;

      saveUpdateReloadState({
        sourceVersion: APP_VERSION,
        targetVersion: version,
        startedAt: now,
        leftAt: 0,
        fallbackAt: now + UPDATE_RELOAD_FALLBACK_MS,
        expiresAt: now + UPDATE_RELOAD_PENDING_TTL_MS,
        reloadAt: 0,
        reloadReason: "",
      });

      logActivity("update-reload", `Started install for Dropper v${version}`, {
        installUrl: updateChecker.INSTALL_URL,
        fallbackSeconds: Math.round(UPDATE_RELOAD_FALLBACK_MS / 1000),
        expiresSeconds: Math.round(UPDATE_RELOAD_PENDING_TTL_MS / 1000),
      });

      scheduleUpdateReloadFallback();
      setStatus("Update installer opened · Return to Twitch after reinstalling");
      return true;
    }

    function resumeUpdateReloadPending() {
      const state = validUpdateReloadState();
      if (!state) return;
      scheduleUpdateReloadFallback();
      enforceUpdateReloadPending(Date.now());
    }

    // ——— Painting the view model (new in 4.0) ———
    const shadowNode = id => ui?.shadow.getElementById(id) || null;
    const setText = (id, text) => { const node = shadowNode(id); if (node && node.textContent !== text) node.textContent = text; return node; };

    // Everything the menu and card show, from one fresh view.
    function render() {
      if (!ui || productResetting) return;
      lastView = view();
      currentDrop = lastView.reward;
      syncProgressSurfaces();
      refreshStreamInfo();
      syncStripSummary();
      refreshViewingControls();
      refreshStatusLine();
      refreshTwitchAuthStatus();
      renderSwitches();
      refreshDeadline();
      refreshOpenCampaignList();
      renderClaimHistory();
      updateTitle();
      ui.healthControl?.refresh();
      ExtraPotionsCore.publishSuiteState('dropper', 'dropper.state-changed', {
        activeReward: Boolean(currentDrop), progressPercent: lastView.card.percent, routingState: lastView.state || 'unknown',
      });
    }

    function syncProgressSurfaces() {
      const card = lastView.card;
      setText('tdh-drop-name', card.rewardName);
      const meta = setText('tdh-drop-meta', `${card.credited} / ${card.required} min`);
      if (meta) { meta.setAttribute('aria-label', currentDrop ? `${card.credited} of ${card.required} minutes credited by Twitch` : 'Twitch credited progress unknown'); meta.title = card.minutesTitle; }
      const fill = shadowNode('tdh-drop-fill'), ring = shadowNode('tdh-ring'), bar = fill?.closest('[role=progressbar]');
      if (bar) { if (card.percent == null) bar.removeAttribute('aria-valuenow'); else bar.setAttribute('aria-valuenow', String(card.percent)); }
      if (fill) fill.style.width = `${card.percent ?? 0}%`;
      if (ring) ring.setAttribute('stroke-dasharray', `${card.percent ?? 0} 100`);
      setText('tdh-drop-percent', card.percent == null ? '—' : `${card.percent}%`);
      ExtraPotionsCore.setLauncherProgress?.('dropper', card.percent == null ? null : card.percent / 100);
      if (card.percent != null) applyProgressColor(card.percent);
      syncCompactState();
      renderCompactInventory();
    }

    function syncCompactState() {
      const card = lastView.card;
      const pause = shadowNode('tdh-card-pause');
      if (pause) { pause.textContent = card.pauseText; pause.disabled = card.pauseDisabled; }
      const menu = shadowNode('tdh-card-menu');
      if (menu) { menu.textContent = 'Menu'; menu.setAttribute('aria-expanded', String(railOpen)); menu.setAttribute('aria-label', railOpen ? 'Close Dropper Menu' : 'Open Dropper Menu'); }
      const cls = `state-pill${card.tone ? ` ${card.tone}` : ''}`;
      const state = shadowNode('tdh-compact-state');
      if (state) { state.textContent = card.label; state.className = cls; }
      const detail = shadowNode('tdh-drop-state');
      if (detail) { detail.textContent = card.shortLabel; detail.className = cls; detail.title = card.label; detail.setAttribute('aria-label', card.label); }
      const updated = shadowNode('tdh-updated-ago');
      if (updated) { updated.textContent = card.checked; updated.title = card.checkedTitle; updated.setAttribute('aria-label', card.checkedTitle); updated.className = 'progress-age'; }
      const dot = shadowNode('tdh-compact-dot');
      if (dot) dot.style.background = card.dot;
      renderSkipStreamerControl();
    }

    function refreshStreamInfo() {
      const box = shadowNode('tdh-stream-info');
      if (!box) return;
      box.classList.remove('stream-info-hidden');
      setText('tdh-stream-channel', lastView.card.channel || 'Finding stream…');
      setText('tdh-stream-game', lastView.card.game || 'Waiting for category');
    }

    // The strip: reward artwork, then the channel and the minutes left, or why Twitch is not counting.
    function syncStripSummary() {
      const art = shadowNode('tdh-strip-art'), meta = shadowNode('tdh-strip-meta'), image = art?.querySelector('img');
      if (!art || !meta || !image) return;
      const { stripPause, stripLeft, image: source } = lastView.card;
      const card = shadowNode('tdh-drop-card');
      if (stripPause) card?.setAttribute('data-strip-pause', stripPause.tone); else card?.removeAttribute('data-strip-pause');
      const channelNode = meta.querySelector('.strip-channel'), leftNode = meta.querySelector('.strip-left');
      if (channelNode) channelNode.textContent = stripPause ? stripPause.text : cleanText(shadowNode('tdh-stream-channel')?.textContent);
      if (leftNode) leftNode.textContent = stripLeft;
      if ((image.getAttribute('src') || '') !== source) { if (source) image.setAttribute('src', source); else image.removeAttribute('src'); }
      image.hidden = !source || image.dataset.failed === source;
    }

    function updateTitle() {
      const prefix = /^\[\d{1,3}%\]\s+/;
      const title = cleanText(document.title);
      if (title && !prefix.test(title)) lastNativeTitle = title;
      const progress = settings.progressInTitle ? lastView.titleProgress : '';
      if (!progress) { if (prefix.test(title) && lastNativeTitle) document.title = lastNativeTitle; return; }
      const wanted = `[${progress}] ${lastNativeTitle || title.replace(prefix, '') || 'Twitch'}`;
      if (document.title !== wanted) document.title = wanted;
    }

    // The one status line (3.x's earning-confidence box).
    function refreshStatusLine() {
      const box = shadowNode('tdh-earning-confidence');
      if (!box) return;
      box.dataset.tone = lastView.status.tone;
      setText('tdh-earning-confidence-label', lastView.status.label);
      setText('tdh-earning-confidence-detail', lastView.status.detail);
    }

    function refreshViewingControls() {
      if (!ui || !lastView) return;
      const state = intent.snapshot(), lock = manualLock();
      setText('tdh-viewing-status', state.manualStream ? 'Your selected stream is protected from automatic navigation.' : 'Automatic navigation follows your stream settings.');
      const resume = shadowNode('tdh-resume-playback');
      if (resume) resume.hidden = !state.paused && state.playback === 'playing';
      refreshStreamPolicyControl();
      const streamLock = shadowNode('tdh-stream-lock');
      if (streamLock) {
        streamLock.hidden = !watchingLogin();
        streamLock.setAttribute('aria-pressed', String(Boolean(lock)));
        streamLock.textContent = lock ? 'Release Stream Lock' : 'Stay on This Stream';
      }
      const multi = shadowNode('tdh-multi-tab-status');
      if (multi) { multi.hidden = !lastView.multiTab; multi.textContent = lastView.multiTab?.text || ''; if (lastView.multiTab) multi.dataset.role = lastView.multiTab.role; else delete multi.dataset.role; }
      const warning = shadowNode('tdh-account-link-warning');
      if (warning) { warning.hidden = !lastView.accountLink; if (lastView.accountLink) setText('tdh-account-link-detail', lastView.accountLink); }
      const recovery = shadowNode('tdh-recovery-action'), action = recoveryAction();
      if (recovery) { recovery.hidden = !action; recovery.dataset.action = action?.action || ''; recovery.textContent = action?.label || 'Recheck Twitch'; }
    }

    // Recovery choices from the controller's state (resume has its own button).
    function recoveryAction() {
      const snapshot = lastView.controller, lock = manualLock();
      if (intent.snapshot().paused) return null;
      if (lastView.eligibilityCode === 'account-link') return { action: 'connections', label: 'Open Connections' };
      if (lock && snapshot.diagnosis === 'credit-stalled') return { action: 'unlock', label: 'Release Stream Lock' };
      if (snapshot.offlineSince || snapshot.mismatchSince || snapshot.diagnosis === 'credit-stalled') return { action: 'find-stream', label: 'Find Another Stream' };
      if (!watchingLogin() && currentDrop) return { action: 'find-stream', label: 'Find Eligible Stream' };
      if (currentDrop && !(snapshot.state === 'earning' && snapshot.verification)) return { action: 'recheck', label: 'Recheck Twitch' };
      return null;
    }

    function refreshStreamPolicyControl() {
      const select = shadowNode('tdh-switch-policy');
      if (!select || !lastView) return;
      const held = select.querySelector('[value=held]');
      if (held) held.textContent = lastView.policy.heldLabel;
      select.value = lastView.policy.value;
    }
    function applyStreamSwitchingPolicy(value) {
      if (!['off', 'normal', 'stopped-earning'].includes(value)) return;
      const patch = { findNextStream: value !== 'off' };
      if (patch.findNextStream) {
        patch.switchPolicy = value;
        claimAutomationTab();
        store.session.remove('manualStreamLock');
        syncViewingContext();
        intent.allowSwitching();
      }
      save(patch);
      controller.tick('stream-policy');
      render();
    }

    function refreshTwitchAuthStatus() {
      const loggedIn = lastView ? lastView.loggedIn : true;
      const required = shadowNode('tdh-auth-required'), button = shadowNode('tdh-twitch-login');
      if (required) required.hidden = loggedIn;
      if (button) { button.hidden = loggedIn; button.textContent = 'Log in'; button.classList.toggle('last-opened', !loggedIn); }
      requestAnimationFrame(layoutChrome);
    }

    const SWITCHES = {
      'tdh-claim-bonus': 'claimBonus', 'tdh-keep-tab': 'keepTabActive', 'tdh-claim-drops': 'claimDrops', 'tdh-progress-title': 'progressInTitle',
      'tdh-find-next': 'findNextStream', 'tdh-mute-next': 'muteRestarted', 'tdh-background-earning': 'backgroundEarning', 'tdh-resume-session': 'resumeSessionOnRestart',
      'tdh-reduce-motion': 'reduceMotion', 'tdh-drop-details': 'dropDetails', 'tdh-hide-sub-promos': 'hideTwitchSubscriptionPromos', 'tdh-restore-channel-player': 'restoreChannelPlayer', 'tdh-remember-content-warnings': 'rememberContentWarnings',
    };
    function bindSwitches() {
      for (const [id, key] of Object.entries(SWITCHES)) {
        shadowNode(id)?.addEventListener('click', () => {
          const value = !store.settings()[key];
          save({ [key]: value });
          if (key === 'rememberContentWarnings') contentWarningMemory.process();
          if (key === 'findNextStream' && value) { claimAutomationTab(); syncViewingContext(); intent.allowSwitching(); }
          if (key === 'reduceMotion') applyMotionSetting();
          if (key === 'dropDetails') { syncProgressPanelPlacement(); requestAnimationFrame(layoutChrome); }
          render();
        });
      }
    }
    function renderSwitches() {
      const current = store.settings();
      for (const [id, key] of Object.entries(SWITCHES)) shadowNode(id)?.setAttribute('aria-checked', current[key] ? 'true' : 'false');
    }

    // Campaigns: when the selected campaign ends and how much watch time it still needs.
    function refreshDeadline() {
      const status = shadowNode('tdh-deadline-status');
      if (!status) return;
      const deadline = lastView.deadline;
      status.hidden = !deadline;
      status.dataset.tone = deadline?.tone || 'muted';
      status.textContent = deadline?.text || '';
    }

    function renderCompactInventory() {
      const list = shadowNode('tdh-inventory-list');
      if (!list) return;
      list.replaceChildren();
      setText('tdh-inventory-game', currentDrop?.game ? ` · ${currentDrop.game}` : '');
      const row = lastView.inventory;
      const item = document.createElement('div'); item.className = 'inventory-item current';
      const thumb = document.createElement('div'); thumb.className = 'reward-thumb'; thumb.textContent = '◆';
      const copy = document.createElement('div'); copy.className = 'reward-copy';
      const title = document.createElement('div'); title.className = 'reward-name'; title.textContent = row.name;
      const sub = document.createElement('div'); sub.className = 'reward-meta'; sub.textContent = row.meta;
      copy.append(title, sub);
      const badge = document.createElement('div'); badge.className = 'reward-state'; badge.textContent = row.state;
      item.append(thumb, copy, badge);
      list.append(item);
    }

    function renderClaimHistory() {
      const output = shadowNode('tdh-claim-history');
      if (!output) return;
      setText('tdh-claim-health', claims.summary());
      const records = claims.ledger().filter(record => record.outcome === 'confirmed' || record.outcome === 'already-claimed').slice(0, 12);
      output.replaceChildren(...(records.length ? records.map(record => {
        const row = document.createElement('div'); row.className = 'claim-history-row';
        const main = document.createElement('div'); main.className = 'claim-history-main';
        const reward = cleanText(record.rewardName || (record.kind === 'bonus' ? 'Bonus chest' : 'Drop')), game = cleanText(record.game);
        main.textContent = `${reward}${game ? ` · ${game}` : ''} · ${record.outcome === 'already-claimed' ? 'Already claimed' : 'Claimed'}`;
        const time = document.createElement('div'); time.className = 'claim-history-time';
        time.textContent = new Date(Number(record.updatedAt || record.at || Date.now())).toLocaleString();
        row.append(main, time);
        return row;
      }) : [Object.assign(document.createElement('div'), { className: 'campaign-manager-note', textContent: 'No claimed Drops recorded for this account.' })]));
      const unclaimed = lastView.unclaimed, panel = shadowNode('tdh-unclaimed-panel'), summary = shadowNode('tdh-unclaimed-summary'), list = shadowNode('tdh-unclaimed-list');
      if (!panel || !summary || !list) return;
      panel.hidden = summary.hidden = !unclaimed.length;
      summary.textContent = unclaimed.length ? `${unclaimed.length} unclaimed` : '';
      list.replaceChildren(...unclaimed.slice(0, 20).map(item => { const row = Object.assign(document.createElement('div'), { className: 'campaign-manager-note', textContent: item.line }); if (item.claimSoon) row.dataset.tone = 'warn'; return row; }));
      if (unclaimed.length) list.append(Object.assign(document.createElement('div'), { className: 'campaign-manager-note', textContent: 'Open your Twitch Drops inventory to claim. Twitch limits how long claiming stays open after a campaign ends.' }));
    }

    // Open campaigns: one row per game in the order Dropper picks them, with priority position and ignore.
    function refreshOpenCampaignList(force = false) {
      const list = shadowNode('tdh-open-campaign-list'), summary = shadowNode('tdh-open-campaign-summary');
      if (!list || !summary) return;
      // A background refresh must not remove the native picker while it is in use.
      if (!force && ui.shadow.activeElement?.matches('.campaign-priority-position')) return;
      const games = lastView.campaigns;
      const strategy = shadowNode('tdh-campaign-strategy');
      if (strategy && strategy.value !== games.strategy) strategy.value = games.strategy;
      summary.textContent = games.rows.length ? `${games.rows.length} game${games.rows.length === 1 ? '' : 's'}${games.ignored ? ` · ${games.ignored} ignored` : ''}` : 'No open games';
      list.replaceChildren();
      if (games.plan) list.append(Object.assign(document.createElement('div'), { className: 'campaign-manager-note', id: 'tdh-campaign-planner', textContent: games.plan }));
      if (!games.rows.length) {
        list.append(Object.assign(document.createElement('div'), { className: 'campaign-manager-note', textContent: games.failed ? 'Campaigns unavailable. Retrying.' : 'No open campaigns. Refreshing.' }));
        return;
      }
      for (const item of games.rows) {
        const row = document.createElement('div'); row.className = 'campaign-game-row';
        const copy = document.createElement('div'); copy.className = 'campaign-game-copy';
        const title = document.createElement('div'); title.className = 'campaign-game-name'; title.textContent = item.game;
        const meta = document.createElement('div'); meta.className = 'campaign-game-meta'; meta.textContent = item.meta;
        copy.append(title, meta);
        if (games.manual) copy.append(priorityPicker(item, games.rows.length));
        const check = document.createElement('button');
        check.type = 'button'; check.className = 'campaign-ignore-check'; check.setAttribute('role', 'switch');
        check.setAttribute('aria-checked', String(item.ignored));
        check.setAttribute('aria-label', `${item.ignored ? 'Stop ignoring' : 'Ignore'} ${item.game} until ${new Date(item.latestEndMs).toLocaleString()}`);
        check.addEventListener('click', () => {
          const ignored = check.getAttribute('aria-checked') !== 'true';
          if (!campaigns.ignoreGame(item.game, item.latestEndMs, ignored)) return;
          log(ignored ? 'campaign-game-ignored' : 'campaign-game-restored', `${item.game} ${ignored ? 'ignored until its latest campaign ends' : 'restored to campaign routing'}`, { game: item.game, expiresAt: ignored ? new Date(item.latestEndMs).toISOString() : null });
          requestGqlPoll('campaign-ignore-changed', false);
          controller.tick('campaign-ignore-changed');
          render();
        });
        row.append(copy, check);
        list.append(row);
      }
      filterCampaignRows();
    }
    function priorityPicker(item, count) {
      const label = document.createElement('label'); label.className = 'campaign-priority-controls';
      const select = document.createElement('select'); select.className = 'select-lite campaign-priority-position';
      const name = `Priority position for ${item.game}`;
      select.setAttribute('aria-label', name);
      select.disabled = item.rank < 0 || count < 2;
      const option = position => Object.assign(document.createElement('option'), { value: String(position), textContent: `#${position}` });
      select.append(option(item.rank + 1));
      select.value = String(item.rank + 1);
      // Only the active picker needs the full list of positions.
      const populate = () => { if (select.options.length === count) return; select.replaceChildren(...Array.from({ length: count }, (_, index) => option(index + 1))); select.value = String(item.rank + 1); };
      select.addEventListener('focus', populate);
      select.addEventListener('pointerdown', populate);
      select.addEventListener('blur', () => { const selected = select.selectedOptions[0]; if (selected) select.replaceChildren(selected); });
      select.addEventListener('change', () => {
        const position = Number(select.value);
        if (!campaigns.moveGame(item.game, position, lastView.campaigns.rows)) return;
        const moved = controller.reorder('campaign-priority-changed');
        if (!moved.switched) controller.tick('campaign-priority-changed');
        notify(`${item.game} moved to priority #${position}${moved.switched ? ` · Switching to ${moved.game}` : moved.why ? ` · Current stream unchanged (${moved.why})` : ''}`);
        lastView = view();
        refreshOpenCampaignList(true);
        [...ui.shadow.querySelectorAll('.campaign-priority-position')].find(node => node.getAttribute('aria-label') === name)?.focus({ preventScroll: true });
      });
      label.append(select);
      return label;
    }

    // Skip: the first press arms it for three seconds, the second skips the streamer.
    function skipStreamerArmSnapshot(at = Date.now()) {
      const login = cleanText(skipStreamerArm?.login).toLowerCase(), expiresAt = Number(skipStreamerArm?.expiresAt || 0);
      if (!login || !expiresAt || expiresAt <= at) return null;
      return { login, expiresAt, remainingMs: expiresAt - at, remainingSeconds: Math.max(1, Math.ceil((expiresAt - at) / 1000)) };
    }
    function clearSkipStreamerArm() {
      clearTimeout(skipStreamerArmTimer);
      skipStreamerArmTimer = null;
      const previous = skipStreamerArmSnapshot();
      skipStreamerArm = { login: '', expiresAt: 0 };
      renderSkipStreamerControl();
      return Boolean(previous);
    }
    function skipStreamerTick() {
      clearTimeout(skipStreamerArmTimer);
      const armed = skipStreamerArmSnapshot();
      if (!armed) skipStreamerArm = { login: '', expiresAt: 0 };
      renderSkipStreamerControl();
      if (armed) skipStreamerArmTimer = setTimeout(skipStreamerTick, Math.min(SKIP_STREAMER_ARM_TICK_MS, Math.max(40, armed.remainingMs + 10)));
    }
    function handleSkipStreamerClick() {
      const active = cleanText(watchingLogin()).toLowerCase(), armed = skipStreamerArmSnapshot();
      clearSkipStreamerArm();
      if (armed && active && armed.login === active) { controller.skipStream(); render(); return; }
      if (!active || !currentDrop) { setStatus('No active stream to skip'); notifyUser('No active stream to skip'); return; }
      skipStreamerArm = { login: active, expiresAt: Date.now() + SKIP_STREAMER_ARM_MS };
      log('stream-skip-arm', 'Armed streamer skip confirmation', { stream: active, confirmSeconds: SKIP_STREAMER_ARM_MS / 1000 });
      skipStreamerTick();
    }
    function renderSkipStreamerControl() {
      const button = shadowNode('tdh-skip-streamer');
      if (!button) return;
      const active = cleanText(watchingLogin()).toLowerCase(), canSkip = Boolean(currentDrop && active);
      let armed = skipStreamerArmSnapshot();
      if (armed && (!canSkip || armed.login !== active)) { clearTimeout(skipStreamerArmTimer); skipStreamerArmTimer = null; skipStreamerArm = { login: '', expiresAt: 0 }; armed = null; }
      const label = button.querySelector('.skip-label'), countdown = button.querySelector('.skip-countdown');
      button.disabled = !canSkip;
      button.setAttribute('aria-disabled', String(!canSkip));
      button.classList.toggle('is-armed', Boolean(armed));
      if (label) label.textContent = armed ? 'Confirm' : 'Skip';
      if (countdown) { countdown.hidden = !armed; countdown.textContent = armed ? `${armed.remainingSeconds}s` : ''; }
      const who = active || armed?.login;
      button.title = armed ? `Click again within ${armed.remainingSeconds}s to skip ${who}` : canSkip ? `Arm skip for ${active}; click again within 3 seconds to confirm` : 'No active streamer to skip';
      button.setAttribute('aria-label', armed ? `Confirm skip ${who}, ${armed.remainingSeconds} seconds remaining` : canSkip ? `Arm skip streamer ${active}` : 'No active streamer to skip');
    }

    function cardPause() {
      syncViewingContext();
      if (intent.snapshot().paused) ensureStreamPlaying(true);
      else { intent.pause(true); const video = document.querySelector('video'); if (video && !video.paused) { try { video.pause(); } catch (_) { /* the player refused */ } } }
      render();
    }

    // System → Status: Core's timeline asks this for the headline.
    function systemHealthSnapshot() {
      const snapshot = controller.snapshot(), checkedAt = drops.snapshot().lastPollAt || null;
      if (ExtraPotionsCore.suiteSitePaused?.() || intent.snapshot().paused) return { state: 'paused', reason: 'Automatic viewing changes are paused. Pending reward confirmation is preserved.', checkedAt };
      if (snapshot.recoveryLoop?.suspended) return { state: 'attention', reason: 'Automatic recovery stopped after repeated stream changes or reloads.', checkedAt, action: { label: 'Resume Recovery', run: () => { controller.resumeRecovery(); render(); } } };
      if (snapshot.state === 'earning' && controller.earningConfirmed()) return { state: 'working', reason: 'Twitch has recently credited reward progress.', checkedAt };
      if (!(lastView?.reward || snapshot.target) || !watchingLogin()) return { state: 'waiting', reason: 'Waiting for a selected reward and an eligible Twitch stream.', checkedAt };
      return { state: 'waiting', reason: snapshot.state === 'verify' ? 'Checking this stream against the selected campaign. Twitch has not confirmed credited progress yet.' : 'Waiting for Twitch to credit the next progress update. Campaign eligibility does not guarantee credited minutes.', checkedAt };
    }
    // System → Recent activity: the status line, then the last activity entries.
    function renderRecentActivity(rows) {
      rows.replaceChildren(Object.assign(document.createElement('p'), { textContent: lastView?.status.detail || '' }));
      const entries = store.session.get('activityLog', []);
      for (const entry of (Array.isArray(entries) ? entries : []).slice(-12).reverse()) rows.append(Object.assign(document.createElement('p'), { textContent: `${new Date(entry.at).toLocaleTimeString()} · ${entry.message}` }));
    }
    // Copy diagnostics: the version, every module's snapshot and the recent activity.
    function diagnosticsReport() {
      return ExtraPotionsCore.createDiagnosticsReport('Dropper', {
        host: ui?.host, shadow: ui?.shadow,
        product: 'dropper', version: APP_VERSION, at: new Date().toISOString(), view: view(),
        controller: controller.snapshot(), drops: drops.snapshot(), claims: { summary: claims.summary(), ledger: claims.ledger().slice(0, 12) },
        tabs: tabs.peers?.() || [], intent: intent.snapshot(), activity: store.session.get('activityLog', []),
      });
    }
    function diagnosticsText() { return JSON.stringify(diagnosticsReport(), null, 2); }

    function resetAllDropperData() {
      productResetting = true;
      save({ findNextStream: false, claimDrops: false, claimBonus: false, keepTabActive: false, backgroundEarning: false, restoreChannelPlayer: false, rememberContentWarnings: false });
      contentWarningMemory.dispose?.();
      store.suspend();
      for (const timer of [updateReloadTimer, updateFallbackTimer, updateNoticeTimer]) clearTimeout(timer);
      try {
        // Every key 4.0 knows, plus 3.x tab and progress keys it no longer reads, so Reset leaves nothing behind.
        ExtraPotionsCore.clearProductData('dropper', { legacyKeys: [...new Set([...KEYS.map(entry => entry.key), 'dropper-tab-id-v1', 'dropper-tab-started-v1', 'tdh-drop', 'tdh-progress', 'tdh-progress-at', ...resetKeys])] });
        location.reload();
      } catch (error) { productResetting = false; store.resume(); throw error; }
    }

    function openOutside(url) {
      try { window.open(url, '_blank', 'noopener,noreferrer'); } catch (_) { location.assign(url); }
    }

    function bindDropperControls() {
      const s = ui.shadow;
      s.getElementById('tdh-forget-content-warnings')?.addEventListener('click', () => setStatus(contentWarningMemory.clear() ? 'Accepted content warnings forgotten across Twitch' : 'Could not clear remembered warnings in your userscript manager'));
      s.getElementById('tdh-restore-channel-player-now')?.addEventListener('click', () => setStatus(restoreChannelPlayer(true) ? 'Channel player restore requested' : 'No compatible Twitch mini-player found on this channel page'));
      s.getElementById('tdh-resume-playback')?.addEventListener('click', () => { ensureStreamPlaying(true); render(); });
      s.getElementById('tdh-switch-policy')?.addEventListener('change', event => applyStreamSwitchingPolicy(event.target.value));
      s.getElementById('tdh-stream-lock')?.addEventListener('click', () => {
        const login = cleanText(watchingLogin()).toLowerCase(), locked = Boolean(manualLock());
        if (locked || !login) { store.session.remove('manualStreamLock'); log('stream-lock', 'Released stay on this stream', { reason: 'viewer-release' }); }
        else { store.session.set('manualStreamLock', { login, at: Date.now(), reason: 'viewer-lock' }); log('stream-lock', 'Stay on this stream enabled', { stream: login }); }
        render();
      });
      s.getElementById('tdh-recovery-action')?.addEventListener('click', event => {
        const action = event.currentTarget.dataset.action;
        if (action === 'connections') openOutside(TWITCH_CONNECTIONS_URL);
        else if (action === 'unlock') store.session.remove('manualStreamLock');
        else if (action === 'find-stream') {
          claimAutomationTab();
          store.session.remove('manualStreamLock');
          syncViewingContext();
          intent.allowSwitching();
          save({ findNextStream: true });
          controller.skipStream();
        } else requestGqlPoll('manual-recovery-recheck', true);
        render();
      });
      s.getElementById('tdh-claim-history-panel')?.addEventListener('toggle', renderClaimHistory);
      s.getElementById('tdh-open-campaigns')?.addEventListener('toggle', event => { if (event.currentTarget.open) { render(); requestGqlPoll('open-campaign-list', false); } });
      s.getElementById('tdh-twitch-login')?.addEventListener('click', () => { openOutside(TWITCH_LOGIN_URL); setStatus('Finish Twitch login, then return to Dropper'); setTimeout(render, 1500); });
      s.getElementById('tdh-account-link-open')?.addEventListener('click', () => { openOutside(TWITCH_CONNECTIONS_URL); setStatus('Open Twitch connections and link the required game account'); });
      const inventory = s.getElementById('tdh-compact-inventory');
      s.getElementById('tdh-toggle-inventory')?.addEventListener('click', event => {
        const open = inventory.classList.toggle('open');
        if (open) lastSubmenuId = 'inventory';
        event.currentTarget.textContent = open ? 'Hide Drops Inventory' : 'Show Drops Inventory';
        event.currentTarget.classList.toggle('last-opened', lastSubmenuId === 'inventory');
        s.getElementById('tdh-diagnostics-toggle')?.classList.toggle('last-opened', lastSubmenuId === 'diagnostics');
        renderCompactInventory();
        requestAnimationFrame(layoutChrome);
      });
      s.getElementById('tdh-skip-streamer')?.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); handleSkipStreamerClick(); });
      s.getElementById('tdh-clear-skipped-streamers')?.addEventListener('click', event => {
        const button = event.currentTarget, cleared = controller.clearSkipped(true);
        button.textContent = cleared ? `Cleared ${cleared} Streamer${cleared === 1 ? '' : 's'}` : 'No skipped streamers';
        setTimeout(() => { button.textContent = 'Clear Skipped Streamers'; }, 1600);
      });
      ExtraPotionsCore.bindDiagnosticsControls({
        show: s.getElementById('tdh-diagnostics-toggle'), copy: s.getElementById('tdh-copy-diagnostics'), output: s.getElementById('tdh-diagnostics'),
        getReport: diagnosticsReport,
        onShow: opening => { if (opening) lastSubmenuId = 'diagnostics'; requestAnimationFrame(layoutChrome); },
        onCopy: () => log('diagnostics', 'Diagnostics copied to clipboard'),
      });
      for (const [id, key] of [['tdh-protected-channels', 'protectedChannels'], ['tdh-excluded-channels', 'excludedChannels']]) {
        const input = s.getElementById(id);
        if (!input) continue;
        input.value = (store.settings()[key] || []).join(', ');
        input.addEventListener('change', () => {
          const list = [...new Set(input.value.toLowerCase().split(/[\s,]+/).filter(value => /^[a-z0-9_]{1,25}$/.test(value)))].slice(0, 100);
          input.value = save({ [key]: list })[key].join(', ');
          render();
        });
      }
      const strategy = s.getElementById('tdh-campaign-strategy');
      strategy.value = store.settings().campaignStrategy;
      strategy.addEventListener('change', () => {
        save({ campaignStrategy: strategy.value });
        const moved = controller.reorder('campaign-order-changed');
        const label = { priority: 'My Priority', deadline: 'Ending Soonest', completion: 'Closest to Completion', shortest: 'Shortest Remaining' }[store.settings().campaignStrategy];
        setStatus(moved.switched ? `Campaign order: ${label} · Switching to ${moved.game}` : moved.alreadyTop ? `Campaign order: ${label} · ${moved.game} is already first` : `Campaign order: ${label} · Current stream unchanged${moved.why ? ` (${moved.why})` : ''}`);
      });
      s.getElementById('tdh-update-dismiss')?.addEventListener('click', hideUpdateNotice);
    }

    function mount() {
      if (ui) return ui;
      mountUi();
      // 3.x's version check runs once the menu exists; it is the only writer of the last-version key.
      resumeUpdateReloadPending();
      checkVersionNotice();
      scheduleUpdateCheck();
      // Leaving for the update installer and coming back reloads onto the new version (3.x's flow).
      addEventListener('blur', () => markUpdateInstallerLeft('blur'), { passive: true });
      addEventListener('focus', () => handleUpdateInstallerReturn('focus'), { passive: true });
      addEventListener('pageshow', () => handleUpdateInstallerReturn('pageshow'), { passive: true });
      document.addEventListener('visibilitychange', () => { if (document.hidden) markUpdateInstallerLeft('hidden'); else handleUpdateInstallerReturn('visible'); });
      return ui;
    }
    // Each heartbeat: a release check when the last one is stale.
    function heartbeat(at = Date.now()) {
      const state = loadUpdateState();
      if (state.checkedForVersion !== APP_VERSION || at - Number(state.lastCheckAt || 0) >= updateChecker.CHECK_INTERVAL) scheduleUpdateCheck();
    }

    return Object.freeze({
      mount, render, heartbeat, toast: text => notifyUser(text), siteControl: () => { applySiteColors(); render(); }, open: () => { mount(); setRailOpen(true, true); },
      isOpen: () => railOpen, diagnostics: diagnosticsReport, shadow: () => ui?.shadow || null, resetting: () => productResetting,
    });
  }

  // Wiring and startup: the only file that reads browser globals. It builds every module from the real storages,
  // the userscript manager's functions and the page, then runs the heartbeat. Page reading, tabs, the data layer
  // and the menu are wired here as their modules land (milestone 3).
  const APP_VERSION = '4.0.2';
  const HEARTBEAT_MS = 5000;
  const ACTIVITY_LOG_LIMIT = 40;
  const SECRET_META = /token|cookie|auth|password|integrity|secret/i;

  function readCookie(name) {
    try {
      const entry = document.cookie.split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`));
      return entry ? decodeURIComponent(entry.slice(name.length + 1)) : '';
    } catch (_) { return ''; }
  }

  // Activity details are kept small and never hold credentials.
  function sanitizeMeta(meta, depth = 0) {
    if (meta == null || typeof meta !== 'object') return typeof meta === 'string' ? cleanText(meta).slice(0, 240) : meta;
    if (depth > 2) return '[…]';
    if (Array.isArray(meta)) return meta.slice(0, 10).map(item => sanitizeMeta(item, depth + 1));
    return Object.fromEntries(Object.entries(meta).slice(0, 20).filter(([key]) => !SECRET_META.test(key)).map(([key, value]) => [key, sanitizeMeta(value, depth + 1)]));
  }

  function createDropper({ pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window } = {}) {
    const gm = typeof GM_getValue === 'function' && typeof GM_setValue === 'function' ? { get: GM_getValue, set: GM_setValue } : null;
    // Page storage can be denied (browser privacy settings); every read then falls back and writes are skipped.
    const pageStorage = read => { try { return read() || null; } catch (_) { return null; } };
    const local = pageStorage(() => localStorage), session = pageStorage(() => sessionStorage);
    const store = createStore({ local, session, gm, cookie: readCookie });
    // 3.x's activity log: the last 40 entries in this tab's session, shown under System → Recent activity.
    function log(type, message, meta = null) {
      const entry = { at: Date.now(), type: cleanText(type || 'info').slice(0, 32), message: cleanText(message || '').slice(0, 240), meta: meta ? sanitizeMeta(meta) : null };
      const list = store.session.get('activityLog', []);
      store.session.set('activityLog', [...(Array.isArray(list) ? list : []), entry].slice(-ACTIVITY_LOG_LIMIT));
      return entry;
    }
    const statusOwner = createStatusOwner();
    let ui = null;
    // Menu sections and reset keys an extension (Dropper S) adds before the menu is built.
    const extraSections = [], extraResetKeys = [], whenReady = [];
    // Module notices: status text goes to the status owner, a toast to the menu, anything else repaints.
    const changed = source => (kind, text) => {
      if (kind === 'status') statusOwner.set(source, text);
      if (kind === 'data' && source === 'drops') statusOwner.clear('drops');
      if (kind === 'toast') ui?.toast(text); else ui?.render();
    };
    const twitch = createTwitch({
      store, cookie: readCookie, log,
      gmRequest: typeof GM_xmlhttpRequest === 'function' ? GM_xmlhttpRequest : null,
      pageFetch: typeof pageWindow.fetch === 'function' ? pageWindow.fetch.bind(pageWindow) : null,
    });
    const campaigns = createCampaigns({ store, log });
    // After a version change, 3.x's startup reset: a cached integrity token and a GQL or integrity pause from the
    // old version are dropped. The last-version key is written only by the update notice.
    const previousVersion = String(store.local.get('lastVersion', '') || '');
    if (previousVersion && previousVersion !== APP_VERSION) {
      store.session.remove('clientIntegrity');
      // The old version's navigation guard and move in flight do not carry over (3.x cleared both keys).
      const routing = store.session.get('controller', null);
      if (routing && typeof routing === 'object') store.session.set('controller', { ...routing, flight: null, guard: { events: [], blockedUntil: 0 } });
      const network = store.session.get('networkState', null);
      if (/gql|integrity/i.test(network?.reason || '')) store.session.set('networkState', { requestTimes: [], consecutiveFailures: 0, openUntil: 0, reason: '', lastOpenedAt: 0, softBudgetWarnedAt: 0 });
    }
    const intent = DropperActiveViewing.createIntent({
      load: account => store.session.get('viewingIntent', null, account),
      save: state => store.session.set('viewingIntent', state, state.account),
    });
    let controller = null;
    const startedAt = Date.now();
    const tabs = createTabs({ store, local, startedAt, describe: () => ({ routingState: controller?.snapshot().state || 'idle' }) });
    const page = createPage({
      store, session, gm, intent, log, startedAt, settings: () => store.settings(), onChange: changed('page'),
      wantedGame: () => controller?.snapshot().target?.game || '',
      isAutomationTab: tabs.isSwitchingTab, sitePaused: () => Boolean(ExtraPotionsCore.suiteSitePaused?.()),
    });
    // The viewer's "Stay on This Stream" lock holds only on the stream it was set on.
    function manualLock() {
      const lock = store.session.get('manualStreamLock', null), channel = page.login();
      if (!lock?.login) return null;
      if (channel && lock.login.toLowerCase() === channel) return { ...lock, login: channel };
      if (channel) store.session.remove('manualStreamLock');
      return null;
    }
    let drops = null;
    const claims = createClaimsRunner({
      store, local, session, twitch, page, intent, tabs, log, settings: () => store.settings(), onChange: changed('claims'),
      // The selected reward with this poll's progress, so a reward that just finished is claimed on the same heartbeat.
      target: () => { const selected = controller?.snapshot().target; return selected ? (findReward(drops?.campaigns() || [], selected) || selected) : null; },
      inventory: () => drops?.inventory() || [],
      onConfirmed: attempt => drops?.markClaimed(attempt), requestPoll: (reason, urgent) => drops?.request(reason, urgent),
      sitePaused: () => Boolean(ExtraPotionsCore.suiteSitePaused?.()),
    });
    const campaignsPage = createCampaignsPage({ log });
    drops = createDrops({ store, twitch, campaigns, claims, campaignsPage, page, cookie: readCookie, log, controller: () => controller, onChange: changed('drops') });
    controller = createController({
      store, campaigns, page, intent, log,
      data: { campaigns: () => drops.campaigns(), session: () => drops.session(), detailsMissed: key => drops.detailsMissed(key) },
      requestPoll: (reason, urgent) => drops.request(reason, urgent),
      navigate: (url, reason) => { page.noteNavigation(url, reason); location.assign(url); },
      slugFor: target => page.slugFor(target),
      inCharge: () => tabs.inCharge(), switchingTab: tabs.isSwitchingTab, manualLock,
      sitePaused: () => Boolean(ExtraPotionsCore.suiteSitePaused?.()),
    });
    // Every settings change goes through here, so the modules that cache settings see it at once.
    function saveSettings(patch) {
      const before = store.settings();
      const after = store.saveSettings(patch);
      page.refreshSettings();
      claims.refreshSettings();
      if (before.hideTwitchSubscriptionPromos !== after.hideTwitchSubscriptionPromos) (after.hideTwitchSubscriptionPromos ? page.promos.suppress : page.promos.restore)();
      ui?.render();
      return after;
    }
    // What the menu and card show now.
    // When the shown reward last gained credited minutes: the controller's record for its target, else seen here.
    let lastCredit = { id: '', minutes: null, at: 0 };
    function creditFor(reward, at) {
      const id = cleanText(reward?.id), minutes = reward?.currentMinutes == null ? null : Number(reward.currentMinutes);
      if (id !== lastCredit.id) lastCredit = { id, minutes, at: 0 };
      else if (minutes != null && lastCredit.minutes != null && minutes > lastCredit.minutes) lastCredit = { id, minutes, at };
      else if (minutes != null && (lastCredit.minutes == null || minutes > lastCredit.minutes)) lastCredit.minutes = minutes;
      const recorded = id && controller.snapshot().target?.id === id ? Number(store.session.get('creditedProgressAt', 0)) || 0 : 0;
      return Math.max(recorded, lastCredit.at);
    }
    function view() {
      const at = Date.now(), snapshot = controller.snapshot(), settings = store.settings(), pool = drops.campaigns();
      // The selected reward; with none selected (switching off), the one Twitch credits on this channel, as in 3.x.
      // A stream the viewer holds shows what Twitch credits there, as with switching off.
      const held = snapshot.state === 'paused' && ['manual-stream', 'stream-locked', 'protected-channel'].includes(snapshot.waitReason);
      const session = !snapshot.target || held ? drops.sessionDrop() : null;
      const found = session ? findReward(pool, session) : snapshot.target ? findReward(pool, snapshot.target) : null;
      const sessionMinutes = session && session.currentMinutes != null ? session.currentMinutes : null;
      // Credited minutes for the selected reward never step back on the card either (the controller keeps the high mark).
      const kept = !session && found && snapshot.target?.id === found.id && Number(snapshot.target.currentMinutes) > Number(found.currentMinutes) ? Number(snapshot.target.currentMinutes) : null;
      const shownMinutes = session && found && sessionMinutes != null ? sessionMinutes : kept;
      const reward = found && shownMinutes != null
        ? { ...found, currentMinutes: shownMinutes, percent: progressPercent(shownMinutes, found.requiredMinutes), remainingMinutes: Math.max(0, found.requiredMinutes - shownMinutes) }
        : found || session || snapshot.target || null;
      const creditedAt = creditFor(reward, at);
      const channel = page.login(), streamGame = page.stream?.()?.game || '';
      const games = campaigns.openGames(pool, at);
      campaigns.extendIgnoredGames(games, at);
      const order = campaigns.reconcileOrder(games);
      const rank = items => rankRewards(items, { strategy: settings.campaignStrategy, priorityOf: campaigns.priorityScorer(), now: at, activeGame: reward?.game || '' });
      const queue = campaignQueue(pool, { state: (campaign, item, when) => campaigns.state(campaign, item, when), now: at, rank });
      const pickOrder = [...new Set(queue.filter(item => !store.isIgnored(item.game, undefined, at)).map(item => normalizeGameName(item.game)))];
      const eligibility = found?.campaignObject && found.drop ? DropperActiveViewing.eligibility(found.campaignObject, found.drop, { now: at }) : null;
      return buildView({
        now: at, loggedIn: Boolean(readCookie('auth-token')), settings, controller: snapshot, reward, intent: intent.snapshot(),
        channel, game: streamGame, lastPollAt: drops.snapshot().lastPollAt, status: statusOwner.current(snapshot.status).text,
        switchingTab: tabs.isSwitchingTab(), locked: Boolean(manualLock()), background: document.hidden,
        campaigns: campaignRows({ games, order, strategy: settings.campaignStrategy, pickOrder, watching: reward?.game || '', queue, pool, now: at, failed: Boolean(drops.snapshot().lastError) && !pool.length }),
        deadline: eligibility?.deadline || null, eligibility, peers: tabs.peers().length, inCharge: tabs.inCharge(), unclaimed: unclaimedRewards(mergeCampaigns(pool, drops.inventory()), at),
        creditedAt, playing: page.videoPlaying(),
      });
    }
    const bridge = createBridge({ store, twitch, drops, page, pageWindow, log });
    let timer = 0;
    // Page work and the controller run every heartbeat; a poll still in flight is skipped by drops itself.
    async function heartbeat() {
      page.heartbeat();
      await drops.heartbeat();
      await claims.heartbeat();
      controller.tick('heartbeat');
      ui?.heartbeat();
      ui?.render();
    }
    function boot() {
      ui = createUi({
        store, controller, drops, claims, page, tabs, intent, campaigns, view, saveSettings, log, manualLock, sections: extraSections, resetKeys: extraResetKeys,
        notify: text => statusOwner.set('ui', text), poll: (reason, urgent) => drops.request(reason, urgent),
      });
      ui.mount();
      for (const callback of whenReady.splice(0)) { try { callback(); } catch (error) { log('extension', String(error?.message || error)); } }
      // The suite's per-site switch: claims, site colors, promos and the page follow it at once.
      ExtraPotionsCore.onSuiteEvent?.(event => {
        if (event.type !== 'suite.site-control' || event.detail?.hostname !== location.hostname.toLowerCase()) return;
        claims.refreshSettings();
        if (ExtraPotionsCore.suiteSitePaused?.()) page.promos.restore(); else heartbeat();
        ui.siteControl();
      }, { type: 'suite.site-control' });
      log('lifecycle', `Dropper ${APP_VERSION} started`);
      page.boot();
      claims.syncWatchers();
      tabs.start();
      for (const type of ['focus', 'pageshow']) window.addEventListener(type, heartbeat, { passive: true });
      document.addEventListener('visibilitychange', () => { if (!document.hidden) heartbeat(); });
      heartbeat();
      timer = setInterval(heartbeat, HEARTBEAT_MS);
    }
    // Listeners at document start; the rest once the document has loaded (3.x's order).
    function start() {
      if (timer) return;
      // Before the viewing intent is first saved, as in 3.x: a fresh single tab can be chosen for switching.
      const settings = store.settings(), state = controller.snapshot().state;
      // Twitch's page traffic is hooked at document start, before Twitch's own requests (3.x's order).
      bridge.install();
      tabs.adoptAfterUpdate({ routingUnderWay: !['idle', 'paused'].includes(state), findNextStream: settings.findNextStream, resumeSessionOnRestart: settings.resumeSessionOnRestart, channel: page.login() });
      page.install();
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
      else boot();
    }
    function stop() { clearInterval(timer); timer = 0; tabs.stop(); }
    // Dropper S's way in: the records it syncs, a refresh after applying them, the earning-turn pause, diagnostics,
    // and a menu section. Record kinds and IDs match what 3.x synced, so the wire format is unchanged.
    const sync = Object.freeze({
      account: () => store.login(),
      ignored: { read: account => store.ignoredGames(account).games, write: (account, games) => store.local.set('ignoredGames', { updatedAt: Date.now(), games }, account) },
      order: { read: () => store.priorityOrder(), write: list => store.setPriorityOrder(list) },
      priorities: { read: account => store.priorities(account), set: (account, id, value) => store.setPriority(id, value, account) },
      claims: { read: account => store.claimRecords(account).map(item => item.record), put: (account, id, record) => store.putClaimRecord(id, record, account), remove: (account, id) => store.removeClaimRecord(id, account) },
      channels: { read: () => { const current = store.settings(); return { protected: [...current.protectedChannels], excluded: [...current.excludedChannels] }; }, write: lists => saveSettings({ protectedChannels: lists.protected, excludedChannels: lists.excluded }) },
      changed: reason => { ui?.render(); controller.tick(reason || 'sync'); },
      paused: () => Boolean(intent.snapshot().paused),
      pause: () => { page.sync(); intent.pause(true); const video = document.querySelector('video'); if (video && !video.paused) { try { video.pause(); } catch (_) { /* the player refused */ } } ui?.render(); },
      resume: () => { if (!page.resume(true)) intent.resume({ explicit: true }); ui?.render(); },
      diagnostics: () => ui?.diagnostics() || {},
      resetting: () => Boolean(ui?.resetting()),
      shadow: () => ui?.shadow() || null,
      log,
      addSection: section => { if (!ui) extraSections.push(section); },
      addResetKeys: keys => extraResetKeys.push(...keys),
      ready: callback => { if (ui) callback(); else whenReady.push(callback); },
    });
    // 3.x's console entry points.
    window.dropperShow = () => ui?.open();
    window.tdhShow = window.dropperShow;
    window.dropperDebug = () => ui?.diagnostics() || null;
    window.tdhDebug = window.dropperDebug;
    window.dropperScrapeCampaignsPage = () => {
      const open = campaignsPage.open();
      const display = open ? campaignsPage.display() : { mode: CAMPAIGN_PAGE_DISPLAY.UNKNOWN, accordionHeaders: 0, dateLeaves: 0, hasEmptyMessage: false, hasOpenDropSection: false, hasOpenRewardSection: false, hasClosedSection: false, at: Date.now(), offCampaignsPage: true };
      const rows = campaignsPage.rows();
      return { display, count: rows.length, games: rows.map(item => item.game?.displayName || item.name || '') };
    };
    window.tdhScrapeCampaignsPage = window.dropperScrapeCampaignsPage;
    // 3.x's auth import is the dashboard poll in 4.0.
    window.dropperImportCampaignsViaAuth = async () => { await drops.poll('console-auth-import'); return drops.campaigns(); };
    window.tdhImportCampaignsViaAuth = window.dropperImportCampaignsViaAuth;
    return Object.freeze({ start, stop, heartbeat, view, saveSettings, log, sync, bridge, get ui() { return ui; }, campaignsPage, store, twitch, campaigns, controller, intent, page, tabs, drops, claims, version: APP_VERSION });
  }

  const dropper = createDropper();
  dropper.start();
})();
