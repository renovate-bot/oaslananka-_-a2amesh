import { describe, expect, it } from 'vitest';

interface CheckOpenApiModule {
  REQUIRED_OPERATIONS: Array<[string, string]>;
  REQUIRED_SCHEMAS: string[];
  validateOpenApiDocument(document: unknown): string[];
}

interface RegistryOpenApiModule {
  registryOpenApiDocument: Record<string, unknown>;
}

async function loadCheckOpenApiModule(): Promise<CheckOpenApiModule> {
  return (await import(
    new URL('../../scripts/check-openapi.mjs', import.meta.url).href
  )) as unknown as CheckOpenApiModule;
}

async function loadRegistryOpenApiModule(): Promise<RegistryOpenApiModule> {
  return (await import('../../packages/registry/src/openapi.js')) as RegistryOpenApiModule;
}

describe('registry OpenAPI contract check', () => {
  it('accepts the registry OpenAPI document and covers required routes and schemas', async () => {
    const { REQUIRED_OPERATIONS, REQUIRED_SCHEMAS, validateOpenApiDocument } =
      await loadCheckOpenApiModule();
    const { registryOpenApiDocument } = await loadRegistryOpenApiModule();

    expect(validateOpenApiDocument(registryOpenApiDocument)).toEqual([]);

    const paths = registryOpenApiDocument['paths'] as Record<string, Record<string, unknown>>;
    for (const [method, path] of REQUIRED_OPERATIONS) {
      expect(paths[path]?.[method.toLowerCase()]).toBeDefined();
    }

    const components = registryOpenApiDocument['components'] as {
      schemas: Record<string, unknown>;
    };
    for (const schemaName of REQUIRED_SCHEMAS) {
      expect(components.schemas[schemaName]).toBeDefined();
    }
  });

  it('rejects documents missing a required registry route', async () => {
    const { validateOpenApiDocument } = await loadCheckOpenApiModule();
    const { registryOpenApiDocument } = await loadRegistryOpenApiModule();
    const document = structuredClone(registryOpenApiDocument) as {
      paths: Record<string, unknown>;
    };

    delete document.paths['/agents/stream'];

    expect(validateOpenApiDocument(document)).toContain('GET /agents/stream path is missing');
  });

  it('rejects documents missing runtime error responses exposed by middleware', async () => {
    const { validateOpenApiDocument } = await loadCheckOpenApiModule();
    const { registryOpenApiDocument } = await loadRegistryOpenApiModule();
    const document = structuredClone(registryOpenApiDocument) as {
      paths: {
        '/health': {
          get: {
            responses: Record<string, unknown>;
          };
        };
      };
    };

    delete document.paths['/health'].get.responses['403'];
    delete document.paths['/health'].get.responses['429'];

    expect(validateOpenApiDocument(document)).toEqual(
      expect.arrayContaining([
        'GET /health must define a 403 response',
        'GET /health must define a 429 response',
      ]),
    );
  });

  it('requires legacy AgentCard protocolVersion support for accepted registrations', async () => {
    const { validateOpenApiDocument } = await loadCheckOpenApiModule();
    const { registryOpenApiDocument } = await loadRegistryOpenApiModule();
    const document = structuredClone(registryOpenApiDocument) as {
      components: {
        schemas: {
          AgentCard: {
            properties: {
              protocolVersion: {
                enum: string[];
              };
            };
          };
        };
      };
    };

    document.components.schemas.AgentCard.properties.protocolVersion.enum = ['1.0', '1.2'];

    expect(validateOpenApiDocument(document)).toContain(
      'components.schemas.AgentCard.properties.protocolVersion.enum must include 0.3, 1.0, 1.2',
    );
  });
});
