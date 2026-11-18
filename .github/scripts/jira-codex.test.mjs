import { test } from 'node:test';
import assert from 'node:assert/strict';
import { issueKey, storyText, testSummary } from './jira-codex.mjs';

test('accepts Jira keys and rejects shell, path and multiline input', () => {
  assert.equal(issueKey('FD-1'), 'FD-1');
  for (const value of ['', 'fd-1', 'FD-0', 'FD-1\n', 'FD-1\nbranch=main', 'FD-1;echo hi', '../FD-1', undefined]) {
    assert.throws(() => issueKey(value));
  }
});

test('preserves nested ADF acceptance criteria and custom fields as data', () => {
  const story = { key: 'FD-1', fields: { description: { type: 'doc', content: [{ type: 'bulletList', content: [{ type: 'text', text: 'Acceptance criterion' }] }] }, customfield_10001: 'Custom criterion' } };
  assert.deepEqual(JSON.parse(storyText(story)), story);
});

const report = { stats: { expected: 5, unexpected: 0, flaky: 1, skipped: 2 }, errors: [] };
test('reports counts and explains retry passes', () => {
  assert.match(testSummary(report, 'success', 'success'), /\*\*PASSED\*\*/);
  assert.match(testSummary(report, 'success', 'success'), /5 passed, 0 failed, 1 flaky, 2 skipped/);
});

test('never presents missing, empty, failed or interrupted execution as passing', () => {
  assert.match(testSummary(undefined, 'failure', ''), /No JSON report/);
  assert.match(testSummary({ stats: {} }, 'success', 'success'), /counts unavailable/);
  for (const [data, job, outcome] of [
    [report, 'failure', 'failure'],
    [report, 'cancelled', 'success'],
    [{ ...report, errors: [{}] }, 'success', 'success'],
    [{ stats: { expected: 0, unexpected: 0, flaky: 0, skipped: 4 } }, 'success', 'success'],
    [{ stats: { ...report.stats, unexpected: 1 } }, 'failure', 'failure'],
  ]) assert.match(testSummary(data, job, outcome), /FAILED \/ INCOMPLETE/);
});
