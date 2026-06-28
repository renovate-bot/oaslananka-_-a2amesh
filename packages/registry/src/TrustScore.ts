import type { RegisteredAgent } from './storage/IAgentStorage.js';

export type TrustLevel = 'unverified' | 'bronze' | 'silver' | 'gold' | 'platinum';
export type TrustSignalStatus = 'pass' | 'warn' | 'fail';

export interface TrustScoreSignals {
  conformanceProfile?: string;
  signatureVerified?: boolean;
  sbomPublished?: boolean;
  uptimePercent?: number;
  p95LatencyMs?: number;
  errorRatePercent?: number;
}

export interface TrustScoreFactor {
  id: string;
  label: string;
  status: TrustSignalStatus;
  points: number;
  maxPoints: number;
}

export interface RegistryTrustScore {
  score: number;
  level: TrustLevel;
  badges: readonly string[];
  factors: readonly TrustScoreFactor[];
}

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function levelFor(score: number): TrustLevel {
  if (score >= 90) return 'platinum';
  if (score >= 75) return 'gold';
  if (score >= 55) return 'silver';
  if (score >= 35) return 'bronze';
  return 'unverified';
}

function factor(
  id: string,
  label: string,
  status: TrustSignalStatus,
  points: number,
  maxPoints: number,
): TrustScoreFactor {
  return { id, label, status, points, maxPoints };
}

function skillScore(agent: RegisteredAgent): TrustScoreFactor {
  const skills = agent.card.skills ?? [];
  if (skills.length === 0) {
    return factor('skills', 'Agent card declares no skills', 'warn', 0, 10);
  }
  const documented = skills.filter(
    (skill) => skill?.description && skill?.inputModes && skill?.outputModes,
  );
  const points = documented.length === skills.length ? 10 : 5;
  return factor(
    'skills',
    'Agent card skill metadata quality',
    points === 10 ? 'pass' : 'warn',
    points,
    10,
  );
}

function healthScore(agent: RegisteredAgent): TrustScoreFactor {
  if (agent.status === 'healthy') return factor('health', 'Registry health status', 'pass', 20, 20);
  if (agent.status === 'unknown')
    return factor('health', 'Registry health status is unknown', 'warn', 8, 20);
  return factor('health', 'Registry health status is unhealthy', 'fail', 0, 20);
}

function protocolScore(agent: RegisteredAgent): TrustScoreFactor {
  const version = agent.card.protocolVersion;
  if (version === '1.0') return factor('protocol', 'A2A protocol version declared', 'pass', 15, 15);
  if (version) return factor('protocol', `A2A protocol version ${version} declared`, 'warn', 8, 15);
  return factor('protocol', 'A2A protocol version is missing', 'fail', 0, 15);
}

function conformanceScore(signals: TrustScoreSignals): TrustScoreFactor {
  if (signals.conformanceProfile) {
    return factor(
      'conformance',
      `Conformance profile ${signals.conformanceProfile}`,
      'pass',
      15,
      15,
    );
  }
  return factor('conformance', 'No conformance profile attached', 'warn', 0, 15);
}

function isNumber(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function operationsScore(signals: TrustScoreSignals): TrustScoreFactor {
  const uptimePercent = signals.uptimePercent;
  const p95LatencyMs = signals.p95LatencyMs;
  const errorRatePercent = signals.errorRatePercent;
  const hasUptime = isNumber(uptimePercent);
  const hasLatency = isNumber(p95LatencyMs);
  const hasErrorRate = isNumber(errorRatePercent);

  if (!hasUptime && !hasLatency && !hasErrorRate) {
    return factor('operations', 'Operational signals not yet attached', 'warn', 5, 15);
  }

  let points = 0;
  if (hasUptime && uptimePercent >= 99) points += 5;
  if (hasLatency && p95LatencyMs <= 1000) points += 5;
  if (hasErrorRate && errorRatePercent <= 1) points += 5;

  return factor(
    'operations',
    'Operational signals',
    points >= 10 ? 'pass' : points > 0 ? 'warn' : 'fail',
    points,
    15,
  );
}

function badgesFor(
  agent: RegisteredAgent,
  signals: TrustScoreSignals,
  level: TrustLevel,
): string[] {
  const badges = [`trust:${level}`];
  if (signals.conformanceProfile) badges.push(`conformance:${signals.conformanceProfile}`);
  if (agent.status === 'healthy') badges.push('health:healthy');
  if (signals.signatureVerified) badges.push('signature:verified');
  if (signals.sbomPublished) badges.push('sbom:published');
  return badges;
}

export function computeRegistryTrustScore(
  agent: RegisteredAgent,
  signals: TrustScoreSignals = {},
): RegistryTrustScore {
  const factors = [
    healthScore(agent),
    protocolScore(agent),
    skillScore(agent),
    conformanceScore(signals),
    operationsScore(signals),
  ];
  const raw = factors.reduce((total, item) => total + item.points, 0);
  const max = factors.reduce((total, item) => total + item.maxPoints, 0);
  const score = max > 0 ? clampScore((raw / max) * 100) : 0;
  const level = levelFor(score);
  return { score, level, badges: badgesFor(agent, signals, level), factors };
}
