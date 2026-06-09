// Static-pattern scanner for AI agent governance gaps in Python agent files.

import * as fs from 'fs';
import * as path from 'path';

export interface FileResult {
  filePath: string;
  content: string;
}

interface GovCheck {
  pass: boolean;
  matches: string[];
}

export interface AnalysisResult {
  filePath: string;
  frameworks: string[];
  auditTrail: GovCheck;
  policyEnforcement: GovCheck;
  revocation: GovCheck;
  humanOversight: GovCheck;
  errorHandling: GovCheck;
}

const AGENT_FRAMEWORK_PATTERNS: RegExp[] = [
  /^\s*(?:import\s+(?:langchain|crewai|openai|anthropic|autogen|google\.generativeai|smolagents|llama_index|haystack|semantic_kernel|dspy|pydantic_ai))/m,
  /^\s*(?:from\s+(?:langchain|crewai|openai|anthropic|autogen|google\.generativeai|smolagents|llama_index|haystack|semantic_kernel|dspy|pydantic_ai)[\s.])/m,
];

const AUDIT_TRAIL_PATTERNS: RegExp[] = [
  /import\s+asqav/,
  /from\s+asqav\s+import/,
  /asqav\./,
  /\.sign\s*\(/,
  /audit_trail/i,
  /log_action/i,
  /action_log/i,
  /audit_log/i,
  /logging\.getLogger/,
  /logger\.\w+\(/,
];

const POLICY_PATTERNS: RegExp[] = [
  /rate_limit/i,
  /ratelimit/i,
  /policy/i,
  /\bscope\b/i,
  /allowed_actions/i,
  /action_gate/i,
  /\bguard\b/i,
  /permission/i,
  /restrict/i,
  /whitelist/i,
  /allowlist/i,
  /max_iterations/i,
  /max_steps/i,
  /\btimeout\b/i,
];

const REVOCATION_PATTERNS: RegExp[] = [
  /revoke/i,
  /\bdisable[d]?\b/i,
  /kill_switch/i,
  /killswitch/i,
  /suspend/i,
  /shutdown/i,
  /terminate/i,
  /emergency_stop/i,
  /circuit_breaker/i,
];

const HUMAN_OVERSIGHT_PATTERNS: RegExp[] = [
  /human_in_the_loop/i,
  /human_in_loop/i,
  /hitl/i,
  /\bapproval\b/i,
  /approve/i,
  /multi_party/i,
  /require_approval/i,
  /manual_review/i,
  /human_review/i,
  /confirm_action/i,
  /await_confirmation/i,
  /human_oversight/i,
];

const ERROR_HANDLING_PATTERN: RegExp = /try\s*:/;
const EXCEPT_PATTERN: RegExp = /except\s*(?:\w|[:(])/;

// Skips build/venv dirs, symlinks, and files over 1 MiB.
export function scanDirectory(dirPath: string): FileResult[] {
  const results: FileResult[] = [];

  function walk(currentPath: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentPath, { withFileTypes: true });
    } catch (err) {
      return;
    }

    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const fullPath: string = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        const skip: string[] = [
          'node_modules', '.git', '__pycache__', '.venv', 'venv',
          'env', '.env', '.tox', '.mypy_cache', '.pytest_cache',
          'dist', 'build', '.eggs',
        ];
        if (!skip.includes(entry.name)) {
          walk(fullPath);
        }
        continue;
      }

      if (!entry.name.endsWith('.py')) continue;

      const stat: fs.Stats = fs.statSync(fullPath);
      if (stat.size > 1024 * 1024) continue;

      let content: string;
      try {
        content = fs.readFileSync(fullPath, 'utf-8');
      } catch (err) {
        continue;
      }

      const usesAgent: boolean = AGENT_FRAMEWORK_PATTERNS.some((pat: RegExp) => pat.test(content));
      if (usesAgent) {
        results.push({ filePath: fullPath, content });
      }
    }
  }

  walk(dirPath);
  return results;
}

function checkPatterns(patterns: RegExp[], content: string): GovCheck {
  return {
    pass: patterns.some((p: RegExp) => p.test(content)),
    matches: patterns
      .filter((p: RegExp) => p.test(content))
      .map((p: RegExp) => {
        const m: RegExpMatchArray | null = content.match(p);
        return m ? m[0].trim() : null;
      })
      .filter((v): v is string => v !== null),
  };
}

export function analyzeFile(filePath: string, content: string): AnalysisResult {
  const detectedFrameworks: string[] = [];
  for (const pat of AGENT_FRAMEWORK_PATTERNS) {
    const match: RegExpMatchArray | null = content.match(pat);
    if (match) {
      const line: string = match[0].trim();
      const fwMatch: RegExpMatchArray | null = line.match(/(?:import|from)\s+([\w.]+)/);
      if (fwMatch && !detectedFrameworks.includes(fwMatch[1].replace(/\.$/, ''))) {
        detectedFrameworks.push(fwMatch[1].replace(/\.$/, ''));
      }
    }
  }

  const auditTrail: GovCheck = checkPatterns(AUDIT_TRAIL_PATTERNS, content);
  const policyEnforcement: GovCheck = checkPatterns(POLICY_PATTERNS, content);
  const revocation: GovCheck = checkPatterns(REVOCATION_PATTERNS, content);
  const humanOversight: GovCheck = checkPatterns(HUMAN_OVERSIGHT_PATTERNS, content);

  const hasTry: boolean = ERROR_HANDLING_PATTERN.test(content);
  const hasExcept: boolean = EXCEPT_PATTERN.test(content);
  const errorHandling: GovCheck = {
    pass: hasTry && hasExcept,
    matches: hasTry && hasExcept ? ['try/except'] : [],
  };

  return {
    filePath,
    frameworks: detectedFrameworks,
    auditTrail,
    policyEnforcement,
    revocation,
    humanOversight,
    errorHandling,
  };
}

export type CategoryKey = 'auditTrail' | 'policyEnforcement' | 'revocation' | 'humanOversight' | 'errorHandling';

interface CategoryDef {
  key: CategoryKey;
  label: string;
}

interface CategoryTotal {
  pass: number;
  gap: number;
  files: string[];
}

// Canonical ordered list of governance categories; single source for keys + labels.
export const GOVERNANCE_CATEGORIES: CategoryDef[] = [
  { key: 'auditTrail', label: 'Audit Trail' },
  { key: 'policyEnforcement', label: 'Policy Enforcement' },
  { key: 'revocation', label: 'Revocation Capability' },
  { key: 'humanOversight', label: 'Human Oversight' },
  { key: 'errorHandling', label: 'Error Handling' },
];

// Weight each category equally toward a 0-100 compliance score (empty category counts as full).
export function computeScore(results: AnalysisResult[]): number {
  let score: number = 0;
  for (const { key } of GOVERNANCE_CATEGORIES) {
    const total: number = results.length;
    const passCount: number = results.filter((r: AnalysisResult) => r[key].pass).length;
    score += total > 0 ? (passCount / total) * 20 : 20;
  }
  return Math.round(score);
}

export function generateReport(results: AnalysisResult[]): string {
  if (results.length === 0) {
    return [
      '## :shield: AI Agent Governance Report',
      '',
      '**No AI agent framework usage detected.** No Python files importing known agent frameworks (LangChain, CrewAI, OpenAI, Anthropic, AutoGen, etc.) were found in the scanned path.',
      '',
      '---',
      '*Powered by [Asqav](https://asqav.com) - AI agent governance made simple.*',
    ].join('\n');
  }

  const totals: Record<CategoryKey, CategoryTotal> = {
    auditTrail: { pass: 0, gap: 0, files: [] },
    policyEnforcement: { pass: 0, gap: 0, files: [] },
    revocation: { pass: 0, gap: 0, files: [] },
    humanOversight: { pass: 0, gap: 0, files: [] },
    errorHandling: { pass: 0, gap: 0, files: [] },
  };

  const categories: CategoryDef[] = GOVERNANCE_CATEGORIES;

  for (const result of results) {
    for (const { key } of categories) {
      if (result[key].pass) {
        totals[key].pass += 1;
      } else {
        totals[key].gap += 1;
        totals[key].files.push(result.filePath);
      }
    }
  }

  const score: number = computeScore(results);

  let badge: string;
  if (score >= 80) {
    badge = ':white_check_mark:';
  } else if (score >= 50) {
    badge = ':warning:';
  } else {
    badge = ':x:';
  }

  const lines: string[] = [];
  lines.push(`## :shield: AI Agent Governance Report`);
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| **Compliance Score** | ${badge} **${score}/100** |`);
  lines.push(`| **Agent files scanned** | ${results.length} |`);
  lines.push(`| **Frameworks detected** | ${[...new Set(results.flatMap((r: AnalysisResult) => r.frameworks))].join(', ') || 'N/A'} |`);
  lines.push('');

  lines.push('### Governance Checks');
  lines.push('');
  lines.push('| Category | Status | Details |');
  lines.push('|----------|--------|---------|');

  const recommendations: Record<CategoryKey, string> = {
    auditTrail:
      'Add `import asqav` and use `asqav.sign()` to create tamper-proof audit trails for agent actions. [Learn more](https://asqav.com/docs/sessions)',
    policyEnforcement:
      'Implement rate limits, scope restrictions, or action gating to control agent behavior. [Learn more](https://asqav.com/docs/agents)',
    revocation:
      'Add a kill switch or revocation mechanism so agents can be disabled in an emergency. [Learn more](https://asqav.com/docs/agents)',
    humanOversight:
      'Add human-in-the-loop approval flows for high-risk agent actions. [Learn more](https://asqav.com/docs/signing-groups)',
    errorHandling:
      'Wrap agent calls in try/except blocks with proper error handling and fallback behavior. [Learn more](https://asqav.com/docs/)',
  };

  for (const { key, label } of categories) {
    const t: CategoryTotal = totals[key];
    const total: number = t.pass + t.gap;
    if (t.gap === 0) {
      lines.push(`| ${label} | :white_check_mark: PASS | ${t.pass}/${total} files covered |`);
    } else {
      lines.push(`| ${label} | :x: GAP | ${t.gap}/${total} files missing coverage |`);
    }
  }

  lines.push('');

  const gapCategories: CategoryDef[] = categories.filter(({ key }: CategoryDef) => totals[key].gap > 0);
  if (gapCategories.length > 0) {
    lines.push('### Recommendations');
    lines.push('');
    for (const { key, label } of gapCategories) {
      lines.push(`- **${label}**: ${recommendations[key]}`);
    }
    lines.push('');
  }

  lines.push('<details>');
  lines.push('<summary>Per-file breakdown</summary>');
  lines.push('');

  for (const result of results) {
    const checks: string[] = categories.map(({ key, label }: CategoryDef) => {
      const status: string = result[key].pass ? ':white_check_mark:' : ':x:';
      return `${status} ${label}`;
    });
    lines.push(`**\`${result.filePath}\`**`);
    lines.push(`- Frameworks: ${result.frameworks.join(', ')}`);
    lines.push(`- ${checks.join(' | ')}`);
    lines.push('');
  }

  lines.push('</details>');
  lines.push('');
  lines.push('---');
  lines.push('*Powered by [Asqav](https://asqav.com) - AI agent governance made simple. Get the full platform for automated compliance, audit trails, and policy enforcement.*');

  return lines.join('\n');
}
