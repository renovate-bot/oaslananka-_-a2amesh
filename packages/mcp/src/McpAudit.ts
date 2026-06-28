import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export type McpAuditSeverity = 'low' | 'medium' | 'high';
export type McpApprovalDecision = 'allow' | 'review' | 'block';

export interface McpAuditFinding {
  id: string;
  severity: McpAuditSeverity;
  message: string;
}

export interface McpAuditPolicy {
  allowedTools?: readonly string[];
  blockedTools?: readonly string[];
  approvalRequiredTools?: readonly string[];
  sensitiveKeywords?: readonly string[];
  maxDescriptionLength?: number;
}

export interface McpAuditResult {
  toolName: string;
  risk: McpAuditSeverity;
  findings: readonly McpAuditFinding[];
}

export interface McpApprovalResult extends McpAuditResult {
  decision: McpApprovalDecision;
}

const DEFAULT_KEYWORDS = ['credential', 'cookie', 'file system', 'network', 'shell', 'browser'];

function normalizedName(tool: Tool): string {
  return tool.name.trim().toLowerCase();
}

function includesName(values: readonly string[] | undefined, name: string): boolean {
  return Boolean(values?.some((value) => value.trim().toLowerCase() === name));
}

function severityRank(severity: McpAuditSeverity): number {
  return { low: 1, medium: 2, high: 3 }[severity];
}

function highestSeverity(findings: readonly McpAuditFinding[]): McpAuditSeverity {
  return findings.reduce<McpAuditSeverity>(
    (current, finding) =>
      severityRank(finding.severity) > severityRank(current) ? finding.severity : current,
    'low',
  );
}

function hasOpenSchema(tool: Tool): boolean {
  const schema = tool.inputSchema;
  return !schema || (schema.type === 'object' && !('properties' in schema));
}

export function auditMcpTool(tool: Tool, policy: McpAuditPolicy = {}): McpAuditResult {
  const name = normalizedName(tool);
  const findings: McpAuditFinding[] = [];
  const description = tool.description ?? '';

  if (includesName(policy.blockedTools, name)) {
    findings.push({
      id: 'tool-blocked',
      severity: 'high',
      message: `Tool ${tool.name} is blocked by policy.`,
    });
  }

  if (policy.allowedTools && !includesName(policy.allowedTools, name)) {
    findings.push({
      id: 'tool-not-allowed',
      severity: 'high',
      message: `Tool ${tool.name} is not in the allowed tool list.`,
    });
  }

  if (includesName(policy.approvalRequiredTools, name)) {
    findings.push({
      id: 'approval-required',
      severity: 'medium',
      message: `Tool ${tool.name} requires approval.`,
    });
  }

  const keywords = policy.sensitiveKeywords ?? DEFAULT_KEYWORDS;
  const lowerDescription = description.toLowerCase();
  for (const keyword of keywords) {
    if (lowerDescription.includes(keyword.toLowerCase())) {
      findings.push({
        id: 'sensitive-keyword',
        severity: 'medium',
        message: `Description mentions ${keyword}.`,
      });
    }
  }

  if (description.length > (policy.maxDescriptionLength ?? 600)) {
    findings.push({
      id: 'long-description',
      severity: 'low',
      message: 'Tool description is unusually long.',
    });
  }

  if (hasOpenSchema(tool)) {
    findings.push({
      id: 'open-input-schema',
      severity: 'medium',
      message: 'Tool input schema is broad or missing properties.',
    });
  }

  return { toolName: tool.name, risk: highestSeverity(findings), findings };
}

export function decideMcpToolApproval(tool: Tool, policy: McpAuditPolicy = {}): McpApprovalResult {
  const audit = auditMcpTool(tool, policy);
  const hasHigh = audit.findings.some((finding) => finding.severity === 'high');
  const hasReview = audit.findings.some(
    (finding) => finding.id === 'approval-required' || finding.severity === 'medium',
  );
  const decision: McpApprovalDecision = hasHigh ? 'block' : hasReview ? 'review' : 'allow';
  return { ...audit, decision };
}

export function createAllowedMcpTools(
  tools: readonly Tool[],
  policy: McpAuditPolicy = {},
): string[] {
  return tools
    .filter((tool) => decideMcpToolApproval(tool, policy).decision !== 'block')
    .map((tool) => tool.name);
}
