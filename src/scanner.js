const fs = require('fs');
const path = require('path');

// --- Pattern Definitions ---

const AGENT_FRAMEWORK_PATTERNS = [
  /^\s*(?:import\s+(?:langchain|crewai|openai|anthropic|autogen|google\.generativeai|smolagents|llama_index|haystack|semantic_kernel))/m,
  /^\s*(?:from\s+(?:langchain|crewai|openai|anthropic|autogen|google\.generativeai|smolagents|llama_index|haystack|semantic_kernel)\s+import)/m,
];

const AUDIT_TRAIL_PATTERNS = [
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

const POLICY_PATTERNS = [
  /rate_limit/i,
  /ratelimit/i,
  /policy/i,
  /scope/i,
  /allowed_actions/i,
  /action_gate/i,
  /guard/i,
  /permission/i,
  /restrict/i,
  /whitelist/i,
  /allowlist/i,
  /max_iterations/i,
  /max_steps/i,
  /timeout/i,
];

const REVOCATION_PATTERNS = [
  /revoke/i,
  /disable/i,
  /kill_switch/i,
  /killswitch/i,
  /suspend/i,
  /shutdown/i,
  /terminate/i,
  /emergency_stop/i,
  /circuit_breaker/i,
];

const HUMAN_OVERSIGHT_PATTERNS = [
  /human_in_the_loop/i,
  /human_in_loop/i,
  /hitl/i,
  /approval/i,
  /approve/i,
  /multi_party/i,
  /require_approval/i,
  /manual_review/i,
  /human_review/i,
  /confirm_action/i,
  /await_confirmation/i,
  /human_oversight/i,
];

const ERROR_HANDLING_PATTERN = /try\s*:/;

// We also look for except blocks that follow try blocks to validate real try/except usage
const EXCEPT_PATTERN = /except\s*(?:\w|[:(])/;

// --- Core Functions ---

/**
 * Recursively scan a directory for Python files that use AI agent frameworks.
 * Returns an array of { filePath, content } objects.
 */
function scanDirectory(dirPath) {
  const results = [];

  function walk(currentPath) {
    let entries;
    try {
      entries = fs.readdirSync(currentPath, { withFileTypes: true });
    } catch (err) {
      // Skip directories we cannot read
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      // Skip common non-essential directories
      if (entry.isDirectory()) {
        const skip = [
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

      let content;
      try {
        content = fs.readFileSync(fullPath, 'utf-8');
      } catch (err) {
        continue;
      }

      // Check if this file imports any agent framework
      const usesAgent = AGENT_FRAMEWORK_PATTERNS.some((pat) => pat.test(content));
      if (usesAgent) {
        results.push({ filePath: fullPath, content });
      }
    }
  }

  walk(dirPath);
  return results;
}

/**
 * Analyse a single file's content for governance patterns.
 * Returns an object describing which checks pass.
 */
function analyzeFile(filePath, content) {
  const detectedFrameworks = [];
  for (const pat of AGENT_FRAMEWORK_PATTERNS) {
    const match = content.match(pat);
    if (match) {
      // Extract the framework name from the import line
      const line = match[0].trim();
      const fwMatch = line.match(/(?:import|from)\s+([\w.]+)/);
      if (fwMatch && !detectedFrameworks.includes(fwMatch[1])) {
        detectedFrameworks.push(fwMatch[1]);
      }
    }
  }

  const auditTrail = {
    pass: AUDIT_TRAIL_PATTERNS.some((p) => p.test(content)),
    matches: AUDIT_TRAIL_PATTERNS
      .filter((p) => p.test(content))
      .map((p) => {
        const m = content.match(p);
        return m ? m[0].trim() : null;
      })
      .filter(Boolean),
  };

  const policyEnforcement = {
    pass: POLICY_PATTERNS.some((p) => p.test(content)),
    matches: POLICY_PATTERNS
      .filter((p) => p.test(content))
      .map((p) => {
        const m = content.match(p);
        return m ? m[0].trim() : null;
      })
      .filter(Boolean),
  };

  const revocation = {
    pass: REVOCATION_PATTERNS.some((p) => p.test(content)),
    matches: REVOCATION_PATTERNS
      .filter((p) => p.test(content))
      .map((p) => {
        const m = content.match(p);
        return m ? m[0].trim() : null;
      })
      .filter(Boolean),
  };

  const humanOversight = {
    pass: HUMAN_OVERSIGHT_PATTERNS.some((p) => p.test(content)),
    matches: HUMAN_OVERSIGHT_PATTERNS
      .filter((p) => p.test(content))
      .map((p) => {
        const m = content.match(p);
        return m ? m[0].trim() : null;
      })
      .filter(Boolean),
  };

  const hasTry = ERROR_HANDLING_PATTERN.test(content);
  const hasExcept = EXCEPT_PATTERN.test(content);
  const errorHandling = {
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

/**
 * Generate a Markdown compliance report from analysis results.
 */
function generateReport(results) {
  if (results.length === 0) {
    return [
      '## :shield: AI Agent Governance Report',
      '',
      '**No AI agent framework usage detected.** No Python files importing known agent frameworks (LangChain, CrewAI, OpenAI, Anthropic, AutoGen, etc.) were found in the scanned path.',
      '',
      '---',
      '*Powered by [asqav](https://asqav.com) — AI agent governance made simple.*',
    ].join('\n');
  }

  // Aggregate across all files
  const totals = {
    auditTrail: { pass: 0, gap: 0, files: [] },
    policyEnforcement: { pass: 0, gap: 0, files: [] },
    revocation: { pass: 0, gap: 0, files: [] },
    humanOversight: { pass: 0, gap: 0, files: [] },
    errorHandling: { pass: 0, gap: 0, files: [] },
  };

  const categories = [
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
  let score = 0;
  for (const { key } of categories) {
    const total = totals[key].pass + totals[key].gap;
    if (total > 0) {
      score += (totals[key].pass / total) * 20;
    } else {
      score += 20; // No files = no gaps for this category
    }
  }
  score = Math.round(score);

  // Determine badge
  let badge;
  if (score >= 80) {
    badge = ':white_check_mark:';
  } else if (score >= 50) {
    badge = ':warning:';
  } else {
    badge = ':x:';
  }

  const lines = [];
  lines.push(`## :shield: AI Agent Governance Report`);
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| **Compliance Score** | ${badge} **${score}/100** |`);
  lines.push(`| **Agent files scanned** | ${results.length} |`);
  lines.push(`| **Frameworks detected** | ${[...new Set(results.flatMap((r) => r.frameworks))].join(', ') || 'N/A'} |`);
  lines.push('');

  // Category breakdown
  lines.push('### Governance Checks');
  lines.push('');
  lines.push('| Category | Status | Details |');
  lines.push('|----------|--------|---------|');

  const recommendations = {
    auditTrail:
      'Add `import asqav` and use `asqav.sign()` to create tamper-proof audit trails for agent actions. [Learn more](https://asqav.com/docs/audit-trails)',
    policyEnforcement:
      'Implement rate limits, scope restrictions, or action gating to control agent behavior. [Learn more](https://asqav.com/docs/policies)',
    revocation:
      'Add a kill switch or revocation mechanism so agents can be disabled in an emergency. [Learn more](https://asqav.com/docs/revocation)',
    humanOversight:
      'Add human-in-the-loop approval flows for high-risk agent actions. [Learn more](https://asqav.com/docs/human-oversight)',
    errorHandling:
      'Wrap agent calls in try/except blocks with proper error handling and fallback behavior. [Learn more](https://asqav.com/docs/error-handling)',
  };

  for (const { key, label } of categories) {
    const t = totals[key];
    const total = t.pass + t.gap;
    if (t.gap === 0) {
      lines.push(`| ${label} | :white_check_mark: PASS | ${t.pass}/${total} files covered |`);
    } else {
      const gapFiles = t.files.map((f) => `\`${f}\``).join(', ');
      lines.push(`| ${label} | :x: GAP | ${t.gap}/${total} files missing coverage |`);
    }
  }

  lines.push('');

  // Recommendations section (only for gaps)
  const gapCategories = categories.filter(({ key }) => totals[key].gap > 0);
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
    const checks = categories.map(({ key, label }) => {
      const status = result[key].pass ? ':white_check_mark:' : ':x:';
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
  lines.push('*Powered by [asqav](https://asqav.com) — AI agent governance made simple. Get the full platform for automated compliance, audit trails, and policy enforcement.*');

  return lines.join('\n');
}

module.exports = { scanDirectory, analyzeFile, generateReport };
