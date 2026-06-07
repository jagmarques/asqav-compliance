<p align="center">
  <a href="https://asqav.com">
    <img src="https://asqav.com/logo-text-white.png" alt="Asqav" width="200">
  </a>
</p>
<p align="center">
  Governance for AI agents. Audit trails, policy enforcement, and compliance.
</p>
<p align="center">
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square&logo=opensourceinitiative&logoColor=white" alt="License: MIT"></a>
  <a href="https://github.com/jagmarques/asqav-compliance"><img src="https://img.shields.io/badge/GitHub%20Action-AI%20Agent%20Governance-blue.svg?style=flat-square" alt="GitHub Action"></a>
  <a href="https://github.com/jagmarques/asqav-compliance"><img src="https://img.shields.io/github/stars/jagmarques/asqav-compliance?style=social" alt="GitHub stars"></a>
</p>
<p align="center">
  <a href="https://asqav.com">Website</a> |
  <a href="https://asqav.com/docs">Docs</a> |
  <a href="https://asqav.com/docs/sdk">SDK Guide</a> |
  <a href="https://asqav.com/docs">Compliance</a>
</p>

# Compliance Scanner

**CI/CD compliance scanner for AI agents.** Catches governance gaps in your AI agent code on every pull request - audit trails, policy enforcement, human oversight, and more. Maps to EU AI Act, DORA, and ISO 42001 requirements.

Think of it as "Dependabot but for AI compliance."

---

## Quick Start

Add this to `.github/workflows/ai-governance.yml` and you're done:

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

The action scans every PR for AI agent framework usage and posts a compliance report as a comment.

---

## Data handling

This GitHub Action runs entirely inside your repository's CI runner. It reads the changed files in the pull request diff, performs static pattern matching, and posts the resulting Markdown report as a PR comment via the GitHub API. The Action does not transmit your code, prompts, or agent context to the Asqav cloud or any third-party service.

If you separately use the `asqav` Python SDK or `@asqav/sdk` at runtime, those have their own data handling. By default, both SDKs auto-detect the Asqav cloud (`*.asqav.com`) and apply hash-only mode for GDPR-aware data minimization, sending only a hash plus a small metadata bag (action_type, agent_id, session_id, model_name, tool_name). For self-hosted deployments, the SDKs send the full context to the server you control. You can override per call:

```typescript
import { init } from '@asqav/sdk';

await init({ apiKey: 'sk_...', baseUrl: 'https://api.asqav.com', mode: 'hash-only' });
```

See [docs/fingerprint-spec.md](https://github.com/jagmarques/asqav-sdk/blob/main/docs/fingerprint-spec.md) in the SDK repo for the fingerprint spec and conformance vectors.

---

## Sample Output

When the action runs, it posts a report like this directly on your PR:

```
## AI Agent Governance Report

| Metric                  | Value                          |
|-------------------------|--------------------------------|
| Compliance Score        | 60/100                         |
| Agent files scanned     | 3                              |
| Frameworks detected     | langchain, openai, crewai      |

### Governance Checks

| Category             | Status | Details                      |
|----------------------|--------|------------------------------|
| Audit Trail          | PASS   | 3/3 files covered            |
| Policy Enforcement   | PASS   | 3/3 files covered            |
| Revocation Capability| GAP    | 2/3 files missing coverage   |
| Human Oversight      | GAP    | 3/3 files missing coverage   |
| Error Handling       | PASS   | 3/3 files covered            |

### Recommendations

- Revocation Capability: Add a kill switch or revocation mechanism
  so agents can be disabled in an emergency.
- Human Oversight: Add human-in-the-loop approval flows for
  high-risk agent actions.
```

Each gap includes actionable recommendations with links to documentation.

---

## What It Checks

The scanner evaluates five governance categories for every Python file that imports an AI agent framework:

* Audit Trail: logging, `asqav.sign()`, audit logs, and action logging.
* Policy Enforcement: rate limits, scope restrictions, action gating, and timeouts.
* Revocation Capability: kill switches, circuit breakers, and emergency stop mechanisms.
* Human Oversight: human-in-the-loop flows, approval gates, and manual review steps.
* Error Handling: try/except blocks around agent calls.

### Regulatory Mapping

These checks align with requirements from:

- **EU AI Act** - Article 14 (human oversight), Article 15 (accuracy/robustness)
- **DORA** - ICT risk management, incident response, operational resilience
- **ISO 42001** - AI management system controls and governance

---

## Inputs

* `github-token`: GitHub token for posting PR comments. Required, defaults to `${{ github.token }}`.
* `scan-path`: path to scan, relative to the repo root. Optional, defaults to `.` (the entire repo).
* `fail-on-gaps`: fail the check if governance gaps are found. Optional, defaults to `false`.

## Outputs

* `score`: compliance score (0-100).
* `agent-files`: number of agent files found.
* `gaps`: total number of governance gaps.
* `report`: full Markdown report.

---

## Advanced Usage

### Block PRs that fail compliance

```yaml
- uses: jagmarques/asqav-compliance@v1
  id: scan
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    scan-path: 'src/agents'
    fail-on-gaps: 'true'

- name: Print score
  run: echo "Compliance score: ${{ steps.scan.outputs.score }}/100"
```

### Use in a matrix with other checks

```yaml
jobs:
  compliance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: jagmarques/asqav-compliance@v1
        id: governance
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          fail-on-gaps: 'true'

  tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pytest
```

---

## Scoring

Each of the 5 categories contributes up to 20 points. Points are proportional to the percentage of agent files that pass each check.

* 80-100: strong governance posture.
* 50-79: some gaps to address.
* 0-49: significant governance gaps.

---

## Supported Frameworks

Works out of the box with 12 AI agent frameworks:

- [LangChain](https://langchain.com/) / [LlamaIndex](https://www.llamaindex.ai/) / [Haystack](https://haystack.deepset.ai/)
- [CrewAI](https://crewai.com/) / [AutoGen](https://microsoft.github.io/autogen/) / [Smol Agents](https://huggingface.co/docs/smolagents/)
- [OpenAI](https://platform.openai.com/) / [Anthropic](https://anthropic.com/) / [Google Generative AI](https://ai.google.dev/)
- [Semantic Kernel](https://learn.microsoft.com/semantic-kernel/) / [DSPy](https://dspy.ai/) / [PydanticAI](https://ai.pydantic.dev/)

---

## Related Projects

* [asqav-sdk](https://github.com/jagmarques/asqav-sdk): Python SDK for AI agent governance, covering audit trails, policy enforcement, and signing.
* [asqav-mcp](https://github.com/jagmarques/asqav-mcp): MCP server for AI agent governance, with policy checks and compliance over the Model Context Protocol.

Use the SDK for runtime governance, this action for CI/CD compliance checks, and the MCP server for AI-native tool integration.

---

## Contributing

Contributions are welcome. Check the [open issues](https://github.com/jagmarques/asqav-compliance/issues) for good starting points.

The scanner is built with TypeScript and runs as a GitHub Action using Node 20. To develop locally:

```bash
git clone https://github.com/jagmarques/asqav-compliance.git
cd asqav-compliance
npm install
npm run build
npm test
```

## License

[MIT](LICENSE)
