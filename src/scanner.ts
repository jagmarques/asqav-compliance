import * as fs from 'fs';
import * as path from 'path';

// --- Type Definitions ---

export interface FileResult {
  filePath: string;
  content: string;
}

export interface GovCheck {
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

// --- Pattern Definitions ---

const AGENT_FRAMEWORK_PATTERNS: RegExp[] = [
  /^\s*(?:import\s+(?:langchain|crewai|openai|anthropic|autogen|google\.generativeai|smolagents|llama_index|haystack|semantic_kernel))/m,
  /^\s*(?:from\s+(?:langchain|crewai|openai|anthropic|autogen|google\.generativeai|smolagents|llama_index|haystack|semantic_kernel)[\s.])/m,
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

// We also look for except blocks that follow try blocks to validate real try/except usage
const EXCEPT_PATTERN: RegExp = /except\s*(?:\w|[:(])/;

// --- Core Functions ---

/**
 * Recursively scan a directory for Python files that use AI agent frameworks.
 * Returns an array of FileResult objects.
 */
export function scanDirectory(dirPath: string): FileResult[] {
  const results: FileResult[] = [];

  function walk(currentPath: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentPath, { withFileTypes: true });
    } catch (err) {
      // Skip directories we cannot read
      return;
    }

    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const fullPath: string = path.join(currentPath, entry.name);

      // Skip common non-essential directories
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

      // Only process Python files
      if (!entry.name.endsWith('.py')) continue;

      const stat: fs.Stats = fs.statSync(fullPath);
      if (stat.size > 1024 * 1024) continue; // skip files > 1MB

      let content: string;
      try {
        content = fs.readFileSync(fullPath, 'utf-8');
      } catch (err) {
        continue;
      }

      // Check if this file imports any agent framework
      const usesAgent: boolean = AGENT_FRAMEWORK_PATTERNS.some((pat: RegExp) => pat.test(content));
      if (usesAgent) {
        results.push({ filePath: fullPath, content });
      }
    }
  }

  walk(dirPath);
  return results;
}

/**
 * Helper to check patterns against content and return a GovCheck.
 */
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

/**
 * Analyse a single file's content for governance patterns.
 * Returns an AnalysisResult describing which checks pass.
 */
export function analyzeFile(filePath: string, content: string): AnalysisResult {
  const detectedFrameworks: string[] = [];
  for (const pat of AGENT_FRAMEWORK_PATTERNS) {
    const match: RegExpMatchArray | null = content.match(pat);
    if (match) {
      // Extract the framework name from the import line
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

// Type for the category keys used in generateReport
type CategoryKey = 'auditTrail' | 'policyEnforcement' | 'revocation' | 'humanOversight' | 'errorHandling';

interface CategoryDef {
  key: CategoryKey;
  label: string;
}

interface CategoryTotal {
  pass: number;
  gap: number;
  files: string[];
}

/**
 * Generate a Markdown compliance report from analysis results.
 */
export function generateReport(results: AnalysisResult[]): string {
  if (results.length === 0) {
    return [
      '## :shield: AI Agent Governance Report',
      '',
      '**No AI agent framework usage detected.** No Python files importing known agent frameworks (LangChain, CrewAI, OpenAI, Anthropic, AutoGen, etc.) were found in the scanned path.',
      '',
      '---',
      '*Powered by [asqav](https://asqav.com) - AI agent governance made simple.*',
    ].join('\n');
  }

  // Aggregate across all files
  const totals: Record<CategoryKey, CategoryTotal> = {
    auditTrail: { pass: 0, gap: 0, files: [] },
    policyEnforcement: { pass: 0, gap: 0, files: [] },
    revocation: { pass: 0, gap: 0, files: [] },
    humanOversight: { pass: 0, gap: 0, files: [] },
    errorHandling: { pass: 0, gap: 0, files: [] },
  };

  const categories: CategoryDef[] = [
    { key: 'auditTrail', label: 'Audit Trail' },
    { key: 'policyEnforcement', label: 'Policy Enforcement' },
    { key: 'revocation', label: 'Revocation Capability' },
    { key: 'humanOversight', label: 'Human Oversight' },
    { key: 'errorHandling', label: 'Error Handling' },
  ];

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

  // Calculate score: each category contributes 20 points, weighted by file pass rate
  let score: number = 0;
  for (const { key } of categories) {
    const total: number = totals[key].pass + totals[key].gap;
    if (total > 0) {
      score += (totals[key].pass / total) * 20;
    } else {
      score += 20; // No files = no gaps for this category
    }
  }
  score = Math.round(score);

  // Determine badge
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

  // Category breakdown
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
      const gapFiles: string = t.files.map((f: string) => `\`${f}\``).join(', ');
      lines.push(`| ${label} | :x: GAP | ${t.gap}/${total} files missing coverage |`);
    }
  }

  lines.push('');

  // Recommendations section (only for gaps)
  const gapCategories: CategoryDef[] = categories.filter(({ key }: CategoryDef) => totals[key].gap > 0);
  if (gapCategories.length > 0) {
    lines.push('### Recommendations');
    lines.push('');
    for (const { key, label } of gapCategories) {
      lines.push(`- **${label}**: ${recommendations[key]}`);
    }
    lines.push('');
  }

  // Per-file breakdown
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
  lines.push('*Powered by [asqav](https://asqav.com) - AI agent governance made simple. Get the full platform for automated compliance, audit trails, and policy enforcement.*');

  return lines.join('\n');
}
