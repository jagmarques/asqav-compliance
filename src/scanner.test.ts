import * as assert from 'assert';
import { analyzeFile, generateReport } from './scanner';

// --- Test Helpers ---

let passed: number = 0;
let failed: number = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err: unknown) {
    const message: string = err instanceof Error ? err.message : String(err);
    console.log(`  FAIL  ${name}`);
    console.log(`        ${message}`);
    failed++;
  }
}

// --- Tests ---

console.log('\nRunning scanner tests...\n');

// -------------------------------------------------------------------------
// analyzeFile: detect agent framework imports
// -------------------------------------------------------------------------

test('detects langchain import', () => {
  const content: string = `import langchain\nfrom langchain.agents import AgentExecutor\n`;
  const result = analyzeFile('test.py', content);
  assert.ok(result.frameworks.includes('langchain'), 'Should detect langchain');
});

test('detects crewai from-import', () => {
  const content: string = `from crewai import Agent, Task, Crew\n`;
  const result = analyzeFile('test.py', content);
  assert.ok(result.frameworks.includes('crewai'), 'Should detect crewai');
});

test('detects openai import', () => {
  const content: string = `import openai\nclient = openai.OpenAI()\n`;
  const result = analyzeFile('test.py', content);
  assert.ok(result.frameworks.includes('openai'), 'Should detect openai');
});

test('detects anthropic import', () => {
  const content: string = `from anthropic import Anthropic\n`;
  const result = analyzeFile('test.py', content);
  assert.ok(result.frameworks.includes('anthropic'), 'Should detect anthropic');
});

test('detects autogen import', () => {
  const content: string = `import autogen\nassistant = autogen.AssistantAgent("assistant")\n`;
  const result = analyzeFile('test.py', content);
  assert.ok(result.frameworks.includes('autogen'), 'Should detect autogen');
});

test('detects google.generativeai import', () => {
  const content: string = `import google.generativeai as genai\nmodel = genai.GenerativeModel("gemini-pro")\n`;
  const result = analyzeFile('test.py', content);
  assert.ok(result.frameworks.includes('google.generativeai'), 'Should detect google.generativeai');
});

// -------------------------------------------------------------------------
// analyzeFile: audit trail detection
// -------------------------------------------------------------------------

test('detects asqav audit trail', () => {
  const content: string = `import openai\nimport asqav\nasqav.sign(action)\n`;
  const result = analyzeFile('test.py', content);
  assert.ok(result.auditTrail.pass, 'Should detect asqav audit trail');
});

test('detects logging as audit trail', () => {
  const content: string = `import openai\nimport logging\nlogger = logging.getLogger(__name__)\nlogger.info("action taken")\n`;
  const result = analyzeFile('test.py', content);
  assert.ok(result.auditTrail.pass, 'Should detect logging as audit trail');
});

test('detects action_log as audit trail', () => {
  const content: string = `import openai\naction_log.append({"action": "search"})\n`;
  const result = analyzeFile('test.py', content);
  assert.ok(result.auditTrail.pass, 'Should detect action_log');
});

test('flags missing audit trail', () => {
  const content: string = `import openai\nclient = openai.OpenAI()\nresult = client.chat.completions.create()\n`;
  const result = analyzeFile('test.py', content);
  assert.ok(!result.auditTrail.pass, 'Should flag missing audit trail');
});

// -------------------------------------------------------------------------
// analyzeFile: policy enforcement detection
// -------------------------------------------------------------------------

test('detects rate_limit policy', () => {
  const content: string = `import openai\nrate_limit = 10\n`;
  const result = analyzeFile('test.py', content);
  assert.ok(result.policyEnforcement.pass, 'Should detect rate_limit');
});

test('detects allowed_actions policy', () => {
  const content: string = `import openai\nallowed_actions = ["search", "email"]\n`;
  const result = analyzeFile('test.py', content);
  assert.ok(result.policyEnforcement.pass, 'Should detect allowed_actions');
});

test('detects max_iterations policy', () => {
  const content: string = `from langchain import agents\nagent = agents.create(max_iterations=5)\n`;
  const result = analyzeFile('test.py', content);
  assert.ok(result.policyEnforcement.pass, 'Should detect max_iterations');
});

test('flags missing policy enforcement', () => {
  const content: string = `import openai\nclient = openai.OpenAI()\nresult = client.chat.completions.create()\n`;
  const result = analyzeFile('test.py', content);
  assert.ok(!result.policyEnforcement.pass, 'Should flag missing policy enforcement');
});

// -------------------------------------------------------------------------
// analyzeFile: revocation detection
// -------------------------------------------------------------------------

test('detects kill_switch', () => {
  const content: string = `import openai\nif kill_switch:\n    sys.exit(1)\n`;
  const result = analyzeFile('test.py', content);
  assert.ok(result.revocation.pass, 'Should detect kill_switch');
});

test('detects revoke pattern', () => {
  const content: string = `import openai\ndef revoke_agent(agent_id):\n    pass\n`;
  const result = analyzeFile('test.py', content);
  assert.ok(result.revocation.pass, 'Should detect revoke');
});

test('flags missing revocation', () => {
  const content: string = `import openai\nclient = openai.OpenAI()\nresult = client.chat.completions.create()\n`;
  const result = analyzeFile('test.py', content);
  assert.ok(!result.revocation.pass, 'Should flag missing revocation');
});

// -------------------------------------------------------------------------
// analyzeFile: human oversight detection
// -------------------------------------------------------------------------

test('detects human_in_the_loop', () => {
  const content: string = `import openai\nhuman_in_the_loop = True\n`;
  const result = analyzeFile('test.py', content);
  assert.ok(result.humanOversight.pass, 'Should detect human_in_the_loop');
});

test('detects require_approval', () => {
  const content: string = `import openai\n@require_approval\ndef dangerous_action():\n    pass\n`;
  const result = analyzeFile('test.py', content);
  assert.ok(result.humanOversight.pass, 'Should detect require_approval');
});

test('detects hitl abbreviation', () => {
  const content: string = `import openai\nhitl_enabled = True\n`;
  const result = analyzeFile('test.py', content);
  assert.ok(result.humanOversight.pass, 'Should detect hitl');
});

test('flags missing human oversight', () => {
  const content: string = `import openai\nclient = openai.OpenAI()\nresult = client.chat.completions.create()\n`;
  const result = analyzeFile('test.py', content);
  assert.ok(!result.humanOversight.pass, 'Should flag missing human oversight');
});

// -------------------------------------------------------------------------
// analyzeFile: error handling detection
// -------------------------------------------------------------------------

test('detects try/except error handling', () => {
  const content: string = `import openai\ntry:\n    result = openai.chat()\nexcept Exception as e:\n    handle(e)\n`;
  const result = analyzeFile('test.py', content);
  assert.ok(result.errorHandling.pass, 'Should detect try/except');
});

test('flags missing error handling', () => {
  const content: string = `import openai\nresult = openai.chat()\n`;
  const result = analyzeFile('test.py', content);
  assert.ok(!result.errorHandling.pass, 'Should flag missing error handling');
});

// -------------------------------------------------------------------------
// analyzeFile: fully compliant file
// -------------------------------------------------------------------------

test('fully compliant file scores all PASS', () => {
  const content: string = `
import openai
import asqav
import logging

logger = logging.getLogger(__name__)

rate_limit = 10
allowed_actions = ["search"]
kill_switch = False
human_in_the_loop = True

try:
    client = openai.OpenAI()
    asqav.sign(result)
    logger.info("Agent action completed")
except Exception as e:
    logger.error(f"Agent error: {e}")
`;
  const result = analyzeFile('compliant.py', content);
  assert.ok(result.auditTrail.pass, 'Audit trail should pass');
  assert.ok(result.policyEnforcement.pass, 'Policy enforcement should pass');
  assert.ok(result.revocation.pass, 'Revocation should pass');
  assert.ok(result.humanOversight.pass, 'Human oversight should pass');
  assert.ok(result.errorHandling.pass, 'Error handling should pass');
});

// -------------------------------------------------------------------------
// generateReport: empty results
// -------------------------------------------------------------------------

test('generates report for no agent files', () => {
  const report: string = generateReport([]);
  assert.ok(report.includes('No AI agent framework usage detected'), 'Should mention no agent files');
  assert.ok(report.includes('asqav'), 'Should mention asqav');
});

// -------------------------------------------------------------------------
// generateReport: report with gaps
// -------------------------------------------------------------------------

test('generates report with gaps', () => {
  const results = [
    analyzeFile('agent.py', `import openai\nclient = openai.OpenAI()\n`),
  ];
  const report: string = generateReport(results);
  assert.ok(report.includes('Compliance Score'), 'Should include compliance score');
  assert.ok(report.includes('GAP'), 'Should include GAP markers');
  assert.ok(report.includes('Recommendations'), 'Should include recommendations');
  assert.ok(report.includes('agent.py'), 'Should reference the file');
});

// -------------------------------------------------------------------------
// generateReport: report for compliant file
// -------------------------------------------------------------------------

test('generates report with all PASS for compliant file', () => {
  const content: string = `
import openai
import asqav
rate_limit = 10
kill_switch = False
human_in_the_loop = True
try:
    openai.chat()
    asqav.sign(result)
except Exception as e:
    pass
`;
  const results = [analyzeFile('good.py', content)];
  const report: string = generateReport(results);
  assert.ok(report.includes('100'), 'Score should be 100');
  assert.ok(report.includes('PASS'), 'Should include PASS markers');
  assert.ok(!report.includes('Recommendations'), 'Should not include recommendations');
});

// -------------------------------------------------------------------------
// generateReport: score calculation
// -------------------------------------------------------------------------

test('score is 0 when all checks fail', () => {
  const results = [
    analyzeFile('bad.py', `import openai\nclient = openai.OpenAI()\n`),
  ];
  const report: string = generateReport(results);
  assert.ok(report.includes('0/100'), 'Score should be 0/100');
});

test('score is partial when some checks pass', () => {
  const content: string = `import openai\nimport asqav\nasqav.sign(x)\nrate_limit = 5\n`;
  const results = [analyzeFile('partial.py', content)];
  const report: string = generateReport(results);
  // Audit trail (pass) + policy (pass) = 40 points, rest are gaps
  assert.ok(report.includes('40/100'), 'Score should be 40/100');
});

// --- Summary ---

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
