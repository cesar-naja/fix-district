import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const START = /<h2\b[^>]*>Playwright automated results<\/h2>/;
const END = /<p\b[^>]*>End of Playwright automated results\.<\/p>/;
const STATE = /<ac:plain-text-body><!\[CDATA\[(\{"schema":1,"runs":[\s\S]*?)\]\]><\/ac:plain-text-body>/;
const TZ = 'America/Chicago';
const xml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const code = value => `<code>${xml(value)}</code>`;
const link = (url, text) => `<a href="${xml(url)}">${xml(text)}</a>`;
export const dayKey = date => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(date));

export function summarize(report, meta) {
  const counts = { passed: 0, failed: 0, flaky: 0, skipped: 0 };
  const browsers = new Set();
  let setupFailed = false;
  const visit = suite => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        if (test.projectName === 'setup') {
          setupFailed ||= test.status === 'unexpected';
          continue;
        }
        browsers.add(test.projectName || 'default');
        const bucket = { expected: 'passed', unexpected: 'failed', flaky: 'flaky', skipped: 'skipped' }[test.status];
        if (!bucket) throw new Error('Unrecognized Playwright test outcome. Refusing to publish misleading counts.');
        counts[bucket]++;
      }
    }
    for (const child of suite.suites ?? []) visit(child);
  };
  if (report && !Array.isArray(report.suites)) throw new Error('Invalid Playwright JSON report.');
  for (const suite of report?.suites ?? []) visit(suite);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const infrastructure = !report || setupFailed || Boolean(report.errors?.length) || total === counts.skipped;
  const status = meta.jobResult !== 'success' || counts.failed || infrastructure
    ? 'FAILED' : counts.flaky ? 'FLAKY' : counts.skipped ? 'PASSED WITH SKIPS' : 'PASSED';
  return {
    ...meta, ...counts, total, status, infrastructure, reportAvailable: Boolean(report),
    duration: Math.round((report?.stats?.duration ?? 0) / 1000),
    browsers: [...browsers].sort(),
  };
}

export function rotate(runs, incoming, now = new Date()) {
  // Compare local calendar dates, not 120 hours (DST days can be 23/25 hours).
  const today = dayKey(now);
  const lower = new Date(`${today}T12:00:00Z`);
  lower.setUTCDate(lower.getUTCDate() - 4);
  const oldest = lower.toISOString().slice(0, 10);
  const byRun = new Map();
  for (const run of [...runs, ...(incoming ? [incoming] : [])]) {
    const day = dayKey(run.timestamp);
    if (day < oldest || day > today) continue;
    const previous = byRun.get(run.id);
    if (!previous || Number(run.attempt) >= Number(previous.attempt)) byRun.set(run.id, run);
  }
  return [...byRun.values()].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function overview(repoUrl) {
  return `<p>${link(repoUrl, 'Browse Fix District on GitHub')} · ${link(`${repoUrl}/actions/workflows/playwright.yml`, 'Open GitHub Actions')} · ${link(`${repoUrl}/blob/main/e2e/README.md`, 'Read the E2E setup guide')}</p>
<p>Manual runs on the default branch publish here. The table shows the current Chicago calendar day and the previous four days. Each publication removes older rows from the displayed table.</p>`;
}

export function render(runs, now = new Date()) {
  const latest = runs[0];
  const stamp = new Intl.DateTimeFormat('en-US', { timeZone: TZ, dateStyle: 'medium', timeStyle: 'short' });
  const cell = value => `<td><p>${xml(value)}</p></td>`;
  const rows = runs.map(run => `<tr>${cell(stamp.format(new Date(run.timestamp)))}${cell(run.status)}${cell(run.passed)}${cell(run.failed)}${cell(run.flaky)}${cell(run.skipped)}${cell(run.reportAvailable ? `${run.duration}s` : 'Unavailable')}${cell(run.browsers.join(', ') || 'Unavailable')}<td><p>${link(run.url, `#${run.number} · ${run.sha.slice(0, 7)}`)}</p></td></tr>`).join('');
  const banner = latest
    ? `<p><strong>Latest run: ${xml(latest.status)}</strong> · ${xml(stamp.format(new Date(latest.timestamp)))} (Chicago)</p>${latest.infrastructure ? '<p>Execution/setup issue or missing report. Open the workflow run for details; zero counts do not mean the suite passed.</p>' : ''}`
    : '<p>No published runs in the current five-day window.</p>';
  const headers = ['Run started (Chicago)', 'Result', 'Passed', 'Failed', 'Flaky', 'Skipped', 'Duration', 'Browsers', 'Workflow run'];
  return `<h2>Playwright automated results</h2>${banner}
<p>Five calendar days, including today. Last refreshed: ${xml(stamp.format(now))} (Chicago). A flaky test passed after a retry. A passed test may include an intentional expected failure.</p>
<table><tbody><tr>${headers.map(h => `<th><p>${xml(h)}</p></th>`).join('')}</tr>${rows}</tbody></table>
<p>Open a run above for the individual test results. Failed jobs may also provide an HTML report under Artifacts.</p>
<ac:structured-macro ac:name="expand"><ac:parameter ac:name="title">Publisher data — managed automatically</ac:parameter><ac:rich-text-body><ac:structured-macro ac:name="code"><ac:parameter ac:name="language">json</ac:parameter><ac:plain-text-body><![CDATA[${JSON.stringify({ schema: 1, runs }).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')}]]></ac:plain-text-body></ac:structured-macro></ac:rich-text-body></ac:structured-macro>
<p>End of Playwright automated results.</p>`;
}

export function updateBody(body, incoming, repoUrl, now = new Date()) {
  const start = START.exec(body);
  const end = END.exec(body);
  if (!start && !end) {
    if (!incoming) return body;
    if (body.includes('"schema":1,"runs":')) throw new Error('Found publisher state without section markers. Restore the managed section before publishing.');
    return `${body}${overview(repoUrl)}${render(rotate([], incoming, now), now)}`;
  }
  if (!start || !end || end.index < start.index) throw new Error('Managed section markers are incomplete. Existing content was not changed.');
  const finish = end.index + end[0].length;
  const section = body.slice(start.index, finish);
  const match = STATE.exec(section);
  if (!match) throw new Error('Publisher history is missing. Restore it before publishing to avoid losing results.');
  const state = JSON.parse(match[1]);
  if (state.schema !== 1 || !Array.isArray(state.runs)) throw new Error('Invalid publisher history.');
  const runs = rotate(state.runs, incoming, now);
  if (!incoming && JSON.stringify(runs) === JSON.stringify(state.runs)) return body;
  return body.slice(0, start.index) + render(runs, now) + body.slice(finish);
}

export async function publish({ apiBase, pageId, email, token, incoming, repoUrl, fetchImpl = fetch, now = new Date() }) {
  const base = new URL(apiBase);
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || !(/^[a-z0-9-]+\.atlassian\.net$/i.test(base.hostname) || base.hostname === 'api.atlassian.com')) {
    throw new Error('Confluence API base must be an HTTPS Atlassian site or api.atlassian.com gateway.');
  }
  if (!/^\d+$/.test(pageId)) throw new Error('CONFLUENCE_PAGE_ID must be numeric.');
  const url = `${apiBase.replace(/\/$/, '')}/wiki/api/v2/pages/${pageId}`;
  const headers = { Authorization: `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`, Accept: 'application/json', 'Content-Type': 'application/json' };
  const request = (target, options = {}) => fetchImpl(target, { ...options, headers, redirect: 'error', signal: AbortSignal.timeout(30_000) });
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await request(`${url}?body-format=storage`);
    if (!response.ok) throw new Error(`Confluence read failed (HTTP ${response.status}). Check API base, page ID, token, and page access.`);
    const page = await response.json();
    if (page.status !== 'current' || typeof page.body?.storage?.value !== 'string' || !Number.isInteger(page.version?.number)) throw new Error('Expected a published Confluence page with storage-format content.');
    const value = updateBody(page.body.storage.value, incoming, repoUrl, now);
    if (value === page.body.storage.value) return;
    const result = await request(url, { method: 'PUT', body: JSON.stringify({ id: pageId, status: 'current', title: page.title, body: { representation: 'storage', value }, version: { number: page.version.number + 1, message: incoming ? 'Playwright results updated (five-day window)' : 'Playwright five-day retention cleanup' } }) });
    if (result.status === 409) continue; // Re-read and merge any concurrently published result.
    if (!result.ok) throw new Error(`Confluence update failed (HTTP ${result.status}). Existing results were not confirmed updated.`);
    return;
  }
  throw new Error('Confluence page kept changing. Retry publishing after the other editor finishes.');
}

export async function main(env = process.env) {
  const preview = process.argv.includes('--preview');
  const cleanup = env.CONFLUENCE_CLEANUP_ONLY === 'true';
  const repo = env.GITHUB_REPOSITORY || 'cesar-naja/fix-district';
  const repoUrl = `https://github.com/${repo}`;
  let report = null;
  if (!cleanup) {
    try { report = JSON.parse(await readFile(env.PLAYWRIGHT_JSON_PATH || 'test-results/results.json', 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw new Error('Could not parse Playwright JSON report.'); }
  }
  const incoming = cleanup ? null : summarize(report, {
    id: env.GITHUB_RUN_ID || 'preview', attempt: Number(env.GITHUB_RUN_ATTEMPT || 1),
    number: env.GITHUB_RUN_NUMBER || 'preview', sha: env.GITHUB_SHA || 'local',
    timestamp: env.RUN_STARTED_AT || report?.stats?.startTime || new Date().toISOString(),
    url: `${repoUrl}/actions/runs/${env.GITHUB_RUN_ID || '0'}`,
    jobResult: env.TEST_JOB_RESULT || 'failure',
  });
  if (preview) {
    await writeFile('confluence-preview.html', `<!doctype html><meta charset="utf-8"><title>Confluence results preview</title><style>body{font:16px system-ui;max-width:1200px;margin:40px auto;color:#172b4d}h2{margin-top:32px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #dfe1e6;padding:8px;text-align:left}th{background:#deebff}a{color:#0052cc}ac\\:structured-macro{display:none}</style>${overview(repoUrl)}${render(incoming ? [incoming] : [])}`);
    console.log('Wrote confluence-preview.html. Preview only; nothing was sent to Confluence.');
    return;
  }
  for (const key of ['CONFLUENCE_API_BASE', 'CONFLUENCE_PAGE_ID', 'CONFLUENCE_EMAIL', 'CONFLUENCE_API_TOKEN']) {
    if (!env[key]) throw new Error(`Missing ${key}. Add it in GitHub repository settings.`);
  }
  await publish({ apiBase: env.CONFLUENCE_API_BASE, pageId: env.CONFLUENCE_PAGE_ID, email: env.CONFLUENCE_EMAIL, token: env.CONFLUENCE_API_TOKEN, incoming, repoUrl });
  console.log('Confluence five-day results updated. No attachments uploaded.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
