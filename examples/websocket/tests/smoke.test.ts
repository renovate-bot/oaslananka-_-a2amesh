import assert from 'node:assert/strict';
import test from 'node:test';
import { runExample } from '../src/index.js';

void test('websocket example sends and receives a JSON-RPC response', async () => {
  const result = await runExample();

  assert.equal(result.mode, 'websocket');
  assert.equal(result.reply, 'websocket transport is reachable');
  assert.ok(result.port > 0);
});
