import assert from 'node:assert/strict';
import test from 'node:test';
import { runExample } from '../src/index.js';

void test('streaming example receives a completed task event', async () => {
  const result = await runExample();

  assert.equal(result.mode, 'streaming');
  assert.ok(result.states.includes('COMPLETED'));
  assert.match(result.text, /streamed:hello stream/u);
  assert.ok(result.taskId);
});
