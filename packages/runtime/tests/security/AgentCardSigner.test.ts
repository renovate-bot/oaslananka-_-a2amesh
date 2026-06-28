import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { signAgentCard, verifyAgentCard } from '../../src/security/AgentCardSigner.js';
import type { AgentCard } from '../../src/types/agent-card.js';

function createCard(): AgentCard {
  return {
    protocolVersion: '1.0',
    name: 'Signed Agent',
    description: 'Agent card signing test fixture',
    url: 'https://agent.example/a2a',
    version: '1.0.0',
    defaultInputModes: ['text'],
    defaultOutputModes: ['text'],
  };
}

function createEs256KeyPair(keyId = 'agent-key-1') {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  return {
    signingKey: {
      keyId,
      algorithm: 'ES256' as const,
      privateKeyPem: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
    },
    verificationKey: {
      keyId,
      publicKeyPem: publicKey.export({ format: 'pem', type: 'spki' }).toString(),
    },
  };
}

describe('AgentCardSigner', () => {
  it('signs an agent card and verifies the produced JWS', async () => {
    const { signingKey, verificationKey } = createEs256KeyPair();

    const signed = await signAgentCard(createCard(), signingKey);
    const result = await verifyAgentCard(signed, [verificationKey]);

    expect(signed.signedAt).toEqual(expect.any(String));
    expect(signed.signatures).toHaveLength(1);
    expect(signed.signatures?.[0]).toEqual(
      expect.objectContaining({
        algorithm: 'ES256',
        keyId: 'agent-key-1',
        jws: expect.stringMatching(/^[^.]+\.[^.]+\.[^.]+$/),
      }),
    );
    expect(result).toEqual({ valid: true, verifiedKeyId: 'agent-key-1' });
  });

  it('rejects a manipulated signed card', async () => {
    const { signingKey, verificationKey } = createEs256KeyPair();

    const signed = await signAgentCard(createCard(), signingKey);
    const tampered: AgentCard = {
      ...signed,
      url: 'https://attacker.example/a2a',
    };

    await expect(verifyAgentCard(tampered, [verificationKey])).resolves.toEqual({
      valid: false,
    });
  });

  it('rejects signatures whose key id is not trusted', async () => {
    const { signingKey } = createEs256KeyPair('untrusted-key');
    const { verificationKey } = createEs256KeyPair('trusted-key');

    const signed = await signAgentCard(createCard(), signingKey);

    await expect(verifyAgentCard(signed, [verificationKey])).resolves.toEqual({ valid: false });
  });
});
