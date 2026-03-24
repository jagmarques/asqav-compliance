<p align="center">
  <img src="https://asqav.com/logo-text.svg" alt="asqav" width="200">
</p>
<p align="center">
  <em>Scan your AI agent code for governance gaps</em>
</p>

# asqav-compliance

[![MIT License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![GitHub Action](https://img.shields.io/badge/GitHub%20Action-AI%20Agent%20Governance-blue.svg)](https://github.com/jagmarques/asqav-compliance)
[![GitHub stars](https://img.shields.io/github/stars/jagmarques/asqav-compliance.svg?style=social&label=Star)](https://github.com/jagmarques/asqav-compliance)
[![Supported Standards](https://img.shields.io/badge/standards-SOC2%20%7C%20ISO%2027001-purple.svg)](https://asqav.com)

**Scan your AI agent code for governance gaps.** Think "Dependabot but for AI agent compliance."

This free GitHub Action automatically scans your repository for AI agent framework usage (LangChain, CrewAI, OpenAI, Anthropic, AutoGen, and more) and checks whether each agent file follows governance best practices. It posts a compliance report directly as a PR comment on every pull request.

---

## What It Does

On every pull request, asqav-compliance will:

1. **Find** all Python files that import AI agent frameworks
2. **Analyse** each file for five governance categories
3. **Score** your repository's compliance (0-100)
4. **Post** a detailed report as a PR comment with pass/gap status and recommendations

### Example PR Comment

The action posts a formatted comment on your PR that includes:

- An overall compliance score with a visual badge
- A summary table showing how many agent files were scanned and which frameworks were detected
- A per-category breakdown (PASS or GAP) with details
- Actionable recommendations for each gap, linking to documentation
- A collapsible per-file breakdown so you can see exactly which files need attention

---

## Quick Start

Add this workflow file to your repository at `.github/workflows/ai-governance.yml`:

```yaml
name: AI Agent Governance
on: [pull_request]

jobs:
  compliance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: jagmarques/asqav-compliance@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

That's it. The action will now run on every pull request and post a governance report.

### Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `github-token` | GitHub token for posting PR comments | Yes | `${{ github.token }}` |
| `scan-path` | Path to scan (relative to repo root) | No | `.` (entire repo) |
| `fail-on-gaps` | Fail the check if governance gaps are found | No | `false` |

### Outputs

| Output | Description |
|--------|-------------|
| `score` | Compliance score (0-100) |
| `agent-files` | Number of agent files found |
| `gaps` | Total number of governance gaps |
| `report` | Full Markdown report |

### Advanced Example

```yaml
name: AI Agent Governance
on: [pull_request]

jobs:
  compliance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: jagmarques/asqav-compliance@v1
        id: scan
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          scan-path: 'src/agents'
          fail-on-gaps: 'true'

      - name: Print score
        run: echo "Compliance score: ${{ steps.scan.outputs.score }}/100"
```

---

## What It Checks

The scanner evaluates five governance categories for every Python file that imports an AI agent framework:

### 1. Audit Trail
Are agent actions being logged or cryptographically signed?

Looks for: `import asqav`, `asqav.sign()`, `logging.getLogger`, `audit_trail`, `log_action`, `action_log`

### 2. Policy Enforcement
Are there constraints on what agents can do?

Looks for: `rate_limit`, `policy`, `scope`, `allowed_actions`, `action_gate`, `guard`, `max_iterations`, `timeout`

### 3. Revocation Capability
Can agents be disabled or shut down in an emergency?

Looks for: `revoke`, `disable`, `kill_switch`, `suspend`, `terminate`, `emergency_stop`, `circuit_breaker`

### 4. Human Oversight
Is there a human-in-the-loop for high-risk actions?

Looks for: `human_in_the_loop`, `hitl`, `approval`, `require_approval`, `multi_party`, `manual_review`

### 5. Error Handling
Are agent calls wrapped in proper error handling?

Looks for: `try/except` blocks around agent code

---

## Scoring

The compliance score ranges from **0 to 100**:

- Each of the 5 categories contributes up to **20 points**
- Points are proportional to the percentage of agent files that pass each check
- If all agent files pass all checks, the score is **100**

| Score Range | Meaning |
|-------------|---------|
| 80-100 | Strong governance posture |
| 50-79 | Some gaps to address |
| 0-49 | Significant governance gaps |

---

## Supported Frameworks

The scanner currently detects these AI agent frameworks:

- [LangChain](https://langchain.com/)
- [CrewAI](https://crewai.com/)
- [OpenAI](https://platform.openai.com/)
- [Anthropic](https://anthropic.com/)
- [AutoGen](https://microsoft.github.io/autogen/)
- [Google Generative AI (Gemini)](https://ai.google.dev/)
- [Smol Agents](https://huggingface.co/docs/smolagents/)
- [LlamaIndex](https://www.llamaindex.ai/)
- [Haystack](https://haystack.deepset.ai/)
- [Semantic Kernel](https://learn.microsoft.com/semantic-kernel/)

---

## Full Governance Platform

This GitHub Action provides a free, lightweight compliance scan. For the full governance platform with:

- Cryptographic audit trails with `asqav.sign()`
- Automated policy enforcement
- Real-time agent monitoring
- Compliance dashboards and reporting
- SOC 2 and ISO 27001 evidence generation

Visit **[asqav.com](https://asqav.com)** to learn more.

---

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

[MIT](LICENSE)