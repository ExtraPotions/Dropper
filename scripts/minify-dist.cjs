'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { minify } = require('terser');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_INPUT = path.join(ROOT, 'src', 'dropper.user.js');
const DEFAULT_OUTPUT = path.join(ROOT, 'dropper.user.js');
const ICON_URL = 'https://raw.githubusercontent.com/ExtraPotions/Dropper/main/assets/dropper-launcher.svg';
const { assembleDropperSource } = require('./core-modules.cjs');

function splitHeader(source) {
  const end = source.indexOf('// ==/UserScript==');
  if (end < 0) return { header: '', body: source };
  let cursor = end + '// ==/UserScript=='.length;
  while (source[cursor] === '\r' || source[cursor] === '\n') cursor += 1;
  while (source.startsWith('//', cursor)) {
    const lineEnd = source.indexOf('\n', cursor);
    if (lineEnd < 0) {
      cursor = source.length;
      break;
    }
    cursor = lineEnd + 1;
  }
  while (source[cursor] === '\r' || source[cursor] === '\n') cursor += 1;
  return { header: source.slice(0, cursor).trimEnd(), body: source.slice(cursor) };
}

function cleanInstallHeader(header) {
  return header
    .split('\n')
    .filter((line) => !/^\/\/ @resource\s/u.test(line) && !/^\/\/ @grant\s+GM_getResourceText/u.test(line))
    .join('\n');
}

async function minifyUserscript(inputPath, outputPath = DEFAULT_OUTPUT) {
  let source = fs.readFileSync(inputPath, 'utf8').replace(/\r\n/g, '\n');
  if (path.resolve(inputPath) === DEFAULT_INPUT) {
    source = assembleDropperSource(source, ROOT);
    const icon = source.match(/^\/\/ @icon\s+(.+)$/m)?.[1]?.trim();
    if (icon !== ICON_URL) throw new Error('Manager icon must reference the borderless launcher SVG');
    if (/data:image\//u.test(source)) throw new Error('Images must be referenced by URL instead of embedded data');
  }
  const originalBytes = Buffer.byteLength(source);
  const { header, body } = splitHeader(source);
  const result = await minify(body, {
    compress: { passes: 3, ecma: 2020, dead_code: true },
    mangle: { toplevel: true },
    format: { comments: false, ecma: 2020 },
  });
  if (!result.code) throw new Error(`Terser produced empty output for ${inputPath}`);
  const output = `${cleanInstallHeader(header)}\n\n${result.code}\n`;
  fs.writeFileSync(outputPath, output);
  const outputBytes = Buffer.byteLength(output);
  const sha256 = crypto.createHash('sha256').update(output).digest('hex');
  return {
    originalBytes,
    minBytes: outputBytes,
    outputBytes,
    sha256,
    outputPath,
    minified: true,
  };
}

module.exports = {
  minifyUserscript,
  splitHeader,
  cleanInstallHeader,
};

if (require.main === module) {
  (async () => {
    const input = process.argv[2] || DEFAULT_INPUT;
    const output = process.argv[3] || DEFAULT_OUTPUT;
    const stats = await minifyUserscript(input, output);
    if (stats.minified) {
      console.log(`${path.basename(output)} ${stats.originalBytes} -> ${stats.outputBytes} bytes sha256=${stats.sha256}`);
      return;
    }
    console.log(`${path.basename(output)} ${stats.outputBytes} bytes sha256=${stats.sha256}`);
  })().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
