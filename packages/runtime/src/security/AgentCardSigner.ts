import { CompactSign, compactVerify, importPKCS8, importSPKI } from 'jose';
import type { AgentCard, AgentCardSignature } from '../types/agent-card.js';

export interface SigningKey {
  keyId: string;
  algorithm: AgentCardSignature['algorithm'];
  privateKeyPem: string;
}

export interface VerificationKey {
  keyId: string;
  publicKeyPem: string;
}

export interface AgentCardVerificationResult {
  valid: boolean;
  verifiedKeyId?: string;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export async function signAgentCard(card: AgentCard, key: SigningKey): Promise<AgentCard> {
  const { signatures, ...signaturelessCard } = card;
  const signedAt = signaturelessCard.signedAt ?? new Date().toISOString();
  const payloadCard: AgentCard = { ...signaturelessCard, signedAt };
  const privateKey = await importPKCS8(key.privateKeyPem, key.algorithm);
  const jws = await new CompactSign(textEncoder.encode(canonicalize(payloadCard)))
    .setProtectedHeader({
      alg: key.algorithm,
      kid: key.keyId,
      typ: 'a2a-agent-card+jws',
    })
    .sign(privateKey);

  return {
    ...payloadCard,
    signatures: [
      ...(signatures ?? []),
      {
        algorithm: key.algorithm,
        keyId: key.keyId,
        jws,
      },
    ],
  };
}

export async function verifyAgentCard(
  card: AgentCard,
  trustedKeys: VerificationKey[],
): Promise<AgentCardVerificationResult> {
  const signatures = card.signatures ?? [];
  if (signatures.length === 0 || trustedKeys.length === 0) {
    return { valid: false };
  }

  const signaturelessCard = { ...card };
  delete signaturelessCard.signatures;
  const expectedPayload = canonicalize(signaturelessCard);
  const trustedKeysById = new Map(trustedKeys.map((key) => [key.keyId, key]));

  for (const signature of signatures) {
    const trustedKey = trustedKeysById.get(signature.keyId);
    if (!trustedKey) {
      continue;
    }

    try {
      const publicKey = await importSPKI(trustedKey.publicKeyPem, signature.algorithm);
      const verified = await compactVerify(signature.jws, publicKey);
      if (
        verified.protectedHeader.alg === signature.algorithm &&
        verified.protectedHeader.kid === signature.keyId &&
        textDecoder.decode(verified.payload) === expectedPayload
      ) {
        return { valid: true, verifiedKeyId: signature.keyId };
      }
    } catch {
      continue;
    }
  }

  return { valid: false };
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`);
  return `{${entries.join(',')}}`;
}
