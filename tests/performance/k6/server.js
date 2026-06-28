/* global __ENV, __ITER, __VU */

import { check, sleep } from 'k6';
import http from 'k6/http';

const baseUrl = __ENV.A2A_SERVER_URL || 'http://127.0.0.1:3101';
const profile = __ENV.PERF_PROFILE || 'smoke';
const isLoad = profile === 'load';
const jsonHeaders = { headers: { 'Content-Type': 'application/json' } };

export const options = {
  scenarios: isLoad
    ? {
        server_load: {
          executor: 'ramping-vus',
          stages: [
            { duration: '10s', target: 5 },
            { duration: '20s', target: 5 },
            { duration: '10s', target: 0 },
          ],
        },
      }
    : {
        server_smoke: {
          executor: 'shared-iterations',
          vus: 1,
          iterations: 8,
          maxDuration: '30s',
        },
      },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: isLoad ? ['p(95)<500', 'p(99)<1000'] : ['p(95)<750', 'p(99)<1500'],
    checks: ['rate==1'],
  },
};

export default function () {
  const card = http.get(`${baseUrl}/.well-known/agent-card.json`, {
    tags: { endpoint: 'agent-card' },
  });
  check(card, {
    'agent card status is 200': (response) => response.status === 200,
    'agent card has name': (response) => response.json('name') === 'A2A Mesh Performance Agent',
  });

  const health = http.get(`${baseUrl}/health`, { tags: { endpoint: 'server-health' } });
  check(health, {
    'server health status is 200': (response) => response.status === 200,
    'server health is healthy': (response) => response.json('status') === 'healthy',
  });

  const send = http.post(
    `${baseUrl}/`,
    JSON.stringify({
      jsonrpc: '2.0',
      id: `send-${__VU}-${__ITER}`,
      method: 'message/send',
      params: {
        message: createMessage(`k6 ${profile} ${__VU}-${__ITER}`),
        configuration: { blocking: true },
      },
    }),
    { ...jsonHeaders, tags: { endpoint: 'message-send' } },
  );
  check(send, {
    'message/send status is 200': (response) => response.status === 200,
    'message/send returns task id': (response) => typeof response.json('result.id') === 'string',
    'message/send returns valid task state': (response) =>
      ['SUBMITTED', 'QUEUED', 'WORKING', 'INPUT_REQUIRED', 'COMPLETED'].includes(
        response.json('result.status.state'),
      ),
  });

  const httpTasks = http.get(`${baseUrl}/tasks?limit=5`, {
    tags: { endpoint: 'tasks-http-poll' },
  });
  check(httpTasks, {
    'http task poll status is 200': (response) => response.status === 200,
    'http task poll returns tasks': (response) => Array.isArray(response.json()),
  });

  const rpcTasks = http.post(
    `${baseUrl}/rpc`,
    JSON.stringify({
      jsonrpc: '2.0',
      id: `list-${__VU}-${__ITER}`,
      method: 'tasks/list',
      params: { limit: 5 },
    }),
    { ...jsonHeaders, tags: { endpoint: 'tasks-rpc-poll' } },
  );
  check(rpcTasks, {
    'rpc task poll status is 200': (response) => response.status === 200,
    'rpc task poll returns total': (response) => typeof response.json('result.total') === 'number',
  });

  sleep(isLoad ? 0.2 : 0.05);
}

function createMessage(text) {
  return {
    role: 'user',
    parts: [{ type: 'text', text }],
    messageId: `k6-${profile}-${__VU}-${__ITER}`,
    timestamp: new Date().toISOString(),
  };
}
