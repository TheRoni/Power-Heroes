// Builds the Claude test-link page from the real game files (index.html + every stylesheet it links).
// Claude wraps the page in its own <html>/<head>/<body>, so this keeps only the parts that belong inside,
// moves the title and viewport to the top, and puts all the styling inline.
const fs = require('fs');

const ROOT = '/home/user/power-heroes';
const OUT = process.argv[2];

const html = fs.readFileSync(`${ROOT}/index.html`, 'utf8');
const sheets = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map((m) => m[1]);
const css = sheets.map((file) => fs.readFileSync(`${ROOT}/${file}`, 'utf8').trim()).join('\n\n');
const title = html.match(/<title>([^<]*)<\/title>/)[1];
const body = html.match(/<body>([\s\S]*)<\/body>/)[1].trim();

const page = `<title>${title}</title>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<style>
${css}
</style>

${body}
`;
fs.writeFileSync(OUT, page);
console.log(`Wrote ${OUT} (${page.split('\n').length} lines, styles from: ${sheets.join(', ')})`);
