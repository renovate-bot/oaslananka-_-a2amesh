import assert from 'node:assert/strict';
import test from 'node:test';
import { runExample } from '../src/index.js';

void test('push notification example delivers a completed task snapshot', async () => {
  const result = await runExample();

  assert.equal(result.mode, 'push-notifications');
  assert.ok(result.taskId);
  assert.ok(result.deliveredStates.includes('COMPLETED'));
});
