export type PolicyDecision = 'allow' | 'block' | 'review';

export interface PolicyRequest {
  tenant?: string;
  principal?: string;
  skillId?: string;
  toolId?: string;
  action: string;
  attributes?: Record<string, string | number | boolean | null | undefined>;
}

export interface PolicyCondition {
  attribute: string;
  equals?: string | number | boolean | null;
  in?: readonly (string | number | boolean | null)[];
  exists?: boolean;
}

export interface PolicyRule {
  id: string;
  description?: string;
  effect: PolicyDecision;
  tenants?: readonly string[];
  principals?: readonly string[];
  skills?: readonly string[];
  tools?: readonly string[];
  actions?: readonly string[];
  conditions?: readonly PolicyCondition[];
}

export interface PolicyEngineOptions {
  defaultDecision?: PolicyDecision;
}

export interface PolicySimulationResult {
  decision: PolicyDecision;
  matchedRules: readonly { id: string; effect: PolicyDecision; description?: string }[];
  reasons: readonly string[];
}

const RANK: Record<PolicyDecision, number> = { allow: 1, review: 2, block: 3 };

function selectorMatches(
  values: readonly string[] | undefined,
  value: string | undefined,
): boolean {
  return (
    !values ||
    values.length === 0 ||
    values.includes('*') ||
    (value !== undefined && values.includes(value))
  );
}

function conditionMatches(condition: PolicyCondition, request: PolicyRequest): boolean {
  const value = request.attributes?.[condition.attribute];
  if (typeof condition.exists === 'boolean' && (value !== undefined) !== condition.exists)
    return false;
  if ('equals' in condition && value !== condition.equals) return false;
  if (condition.in) {
    if (value === undefined) return false;
    if (!condition.in.includes(value)) return false;
  }
  return true;
}

function ruleMatches(rule: PolicyRule, request: PolicyRequest): boolean {
  return (
    selectorMatches(rule.tenants, request.tenant) &&
    selectorMatches(rule.principals, request.principal) &&
    selectorMatches(rule.skills, request.skillId) &&
    selectorMatches(rule.tools, request.toolId) &&
    selectorMatches(rule.actions, request.action) &&
    (rule.conditions ?? []).every((condition) => conditionMatches(condition, request))
  );
}

export class PolicyEngine {
  readonly #rules: readonly PolicyRule[];
  readonly #defaultDecision: PolicyDecision;

  constructor(rules: readonly PolicyRule[], options: PolicyEngineOptions = {}) {
    this.#rules = [...rules];
    this.#defaultDecision = options.defaultDecision ?? 'block';
  }

  simulate(request: PolicyRequest): PolicySimulationResult {
    const rules = this.#rules.filter((rule) => ruleMatches(rule, request));
    if (rules.length === 0) {
      return {
        decision: this.#defaultDecision,
        matchedRules: [],
        reasons: [`No rule matched; default decision is ${this.#defaultDecision}.`],
      };
    }
    const decision = rules.reduce<PolicyDecision>(
      (current, rule) => (RANK[rule.effect] > RANK[current] ? rule.effect : current),
      'allow',
    );
    return {
      decision,
      matchedRules: rules.map((rule) => ({
        id: rule.id,
        effect: rule.effect,
        ...(rule.description ? { description: rule.description } : {}),
      })),
      reasons: rules.map((rule) => `Rule ${rule.id} matched with ${rule.effect}.`),
    };
  }

  can(request: PolicyRequest): boolean {
    return this.simulate(request).decision === 'allow';
  }
}

export function createPolicyEngine(
  rules: readonly PolicyRule[],
  options: PolicyEngineOptions = {},
): PolicyEngine {
  return new PolicyEngine(rules, options);
}
