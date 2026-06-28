/* global __ENV */

import { check, sleep } from 'k6';
import http from 'k6/http';

const registryUrl = __ENV.A2A_REGISTRY_URL || 'http://127.0.0.1:3099';
const profile = __ENV.PERF_PROFILE || 'smoke';
const isLoad = profile === 'load';
const expectedAgents = Number(__ENV.PERF_EXPECTED_AGENTS || '1');

export const options = {
  scenarios: isLoad
    ? {
        registry_load: {
          executor: 'ramping-vus',
          stages: [
            { duration: '10s', target: 5 },
            { duration: '20s', target: 5 },
            { duration: '10s', target: 0 },
          ],
        },
      }
    : {
        registry_smoke: {
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
  const health = http.get(`${registryUrl}/health`, { tags: { endpoint: 'registry-health' } });
  check(health, {
    'registry health status is 200': (response) => response.status === 200,
    'registry health is ok': (response) => response.json('status') === 'ok',
    'registry health counts seeded agents': (response) =>
      Number(response.json('agents')) >= expectedAgents,
  });

  const agents = http.get(`${registryUrl}/agents?public=true`, {
    tags: { endpoint: 'registry-list' },
  });
  check(agents, {
    'registry list status is 200': (response) => response.status === 200,
    'registry list returns seeded agents': (response) =>
      Array.isArray(response.json()) && response.json().length >= expectedAgents,
  });

  const search = http.get(`${registryUrl}/agents/search?public=true&skill=echo`, {
    tags: { endpoint: 'registry-search' },
  });
  check(search, {
    'registry search status is 200': (response) => response.status === 200,
    'registry search finds echo agents': (response) =>
      Array.isArray(response.json()) && response.json().length >= expectedAgents,
  });

  const recentTasks = http.get(`${registryUrl}/tasks/recent?limit=5`, {
    tags: { endpoint: 'registry-task-poll' },
  });
  check(recentTasks, {
    'registry task poll status is 200': (response) => response.status === 200,
    'registry task poll returns array': (response) => Array.isArray(response.json()),
  });

  sleep(isLoad ? 0.2 : 0.05);
}
