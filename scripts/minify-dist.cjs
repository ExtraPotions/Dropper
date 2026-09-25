'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { minify } = require('terser');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_INPUT = path.join(ROOT, 'src', 'dropper.user.js');
const DEFAULT_OUTPUT = path.join(ROOT, 'dropper.user.js');
const MINIFY_THRESHOLD_BYTES = 2 * 1024 * 1024;
const ICON_URL = 'https://raw.githubusercontent.com/ExtraPotions/Dropper/main/assets/dropper-launcher.svg';

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

function shouldMinify(byteLength, thresholdBytes = MINIFY_THRESHOLD_BYTES) {
  return byteLength > thresholdBytes;
}

function readableInstall(source) {
  const { header, body } = splitHeader(source);
  const cleanedHeader = cleanInstallHeader(header);
  if (cleanedHeader === header) {
    if (source === '') return source;
    return source.endsWith('\n') ? source : `${source}\n`;
  }
  const assembled = body ? `${cleanedHeader}\n\n${body}` : `${cleanedHeader}\n`;
  return assembled.endsWith('\n') ? assembled : `${assembled}\n`;
}

async function minifyUserscript(inputPath, outputPath = DEFAULT_OUTPUT, options = {}) {
  const source = fs.readFileSync(inputPath, 'utf8').replace(/\r\n/g, '\n');
  if (path.resolve(inputPath) === DEFAULT_INPUT) {
    const shared = fs.readFileSync(path.join(ROOT, 'src/shared-diagnostics.js'), 'utf8').replace(/\r\n/g, '\n').trim();
    if (!source.includes(shared)) throw new Error('Shared diagnostics differ; run node scripts/sync-diagnostics.cjs');
    const icon = source.match(/^\/\/ @icon\s+(.+)$/m)?.[1]?.trim();
    if (icon !== ICON_URL) throw new Error('Manager icon must reference the borderless launcher SVG');
    if (/data:image\//u.test(source)) throw new Error('Images must be referenced by URL instead of embedded data');
  }
  const originalBytes = Buffer.byteLength(source);
  const thresholdBytes = options.thresholdBytes ?? MINIFY_THRESHOLD_BYTES;
  let output;
  let minified = false;
  if (shouldMinify(originalBytes, thresholdBytes)) {
    const { header, body } = splitHeader(source);
    const result = await minify(body, {
      compress: { passes: 3, ecma: 2020, dead_code: true },
      mangle: { toplevel: true },
      format: { comments: false, ecma: 2020 },
    });
    if (!result.code) throw new Error(`Terser produced empty output for ${inputPath}`);
    output = `${cleanInstallHeader(header)}\n\n${result.code}\n`;
    minified = true;
  } else {
    output = readableInstall(source);
  }
  fs.writeFileSync(outputPath, output);
  const outputBytes = Buffer.byteLength(output);
  const sha256 = crypto.createHash('sha256').update(output).digest('hex');
  return {
    originalBytes,
    minBytes: outputBytes,
    outputBytes,
    sha256,
    outputPath,
    minified,
  };
}

module.exports = {
  MINIFY_THRESHOLD_BYTES,
  minifyUserscript,
  splitHeader,
  cleanInstallHeader,
  shouldMinify,
  readableInstall,
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
