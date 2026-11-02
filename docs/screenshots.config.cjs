'use strict';

// Public images contain only the product and its actual built release notes.
module.exports = {
  build: ["scripts/assemble-parts.cjs","scripts/minify-dist.cjs"],
  userscript: 'dropper.user.js',
  host: '#tdh-root',
  url: 'https://www.twitch.tv/directory',
  page: '<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}</style><main></main>',
  viewport: {width:960,height:1400},
  productOnly: true,
  shots: [
    {file:'menu-light.png',section:'Settings',mode:'light',collapsed:true},
    {file:'menu-dark.png',section:'Settings',mode:'dark',collapsed:true},
    {file:'changelog.png',section:'Settings',mode:'dark',collapsed:true,notice:true},
  ],
};
