import * as core from '@actions/core';
import * as github from '@actions/github';
import * as path from 'path';
import { scanDirectory, analyzeFile, generateReport, AnalysisResult } from './scanner';

type CategoryKey = 'auditTrail' | 'policyEnforcement' | 'revocation' | 'humanOversight' | 'errorHandling';

async function run(): Promise<void> {
  try {
    // Read inputs
    const token: string = core.getInput('github-token', { required: true });
    const scanPath: string = core.getInput('scan-path') || '.';
    const failOnGaps: boolean = core.getInput('fail-on-gaps') === 'true';

    // Resolve the scan path relative to the workspace
    const workspace: string = process.env.GITHUB_WORKSPACE || process.cwd();
    const fullScanPath: string = path.resolve(workspace, scanPath);

    core.info(`Scanning for AI agent governance gaps in: ${fullScanPath}`);

    // Anonymous usage ping (no PII, no code, just counts)
    try {
      const https = require('https');
      const pingData: string = JSON.stringify({
        event: 'action_run',
        agent_files: 0, // updated after scan
        version: '1.0.0',
      });
      const req = https.request({
        hostname: 'api.asqav.com',
        path: '/api/v1/health/',
        method: 'GET',
        timeout: 3000,
        headers: { 'X-Asqav-Source': 'github-action' },
      });
      req.on('error', () => {}); // silent fail
      req.end();
    } catch (e) { /* never block the action */ }

    // Step 1: Find all Python files with agent framework imports
    const agentFiles = scanDirectory(fullScanPath);
    core.info(`Found ${agentFiles.length} Python file(s) using AI agent frameworks`);

    // Step 2: Analyse each file for governance patterns
    const results: AnalysisResult[] = agentFiles.map(({ filePath, content }) => {
      // Make the path relative to the workspace for cleaner reporting
      const relativePath: string = path.relative(workspace, filePath);
      const analysis: AnalysisResult = analyzeFile(relativePath, content);
      return analysis;
    });

    // Step 3: Generate the compliance report
    const report: string = generateReport(results);
    core.info('Compliance report generated');

    // Step 4: Post as a PR comment (if running in a PR context)
    const context = github.context;

    if (context.payload.pull_request) {
      const octokit = github.getOctokit(token);
      const prNumber: number = context.payload.pull_request.number;

      // Check for an existing comment from this action to update instead of creating a new one
      const { data: comments } = await octokit.rest.issues.listComments({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: prNumber,
      });

      const botComment = comments.find(
        (comment: { user?: { type?: string } | null; body?: string | null }) =>
          comment.user?.type === 'Bot' &&
          comment.body?.includes('AI Agent Governance Report')
      );

      if (botComment) {
        await octokit.rest.issues.updateComment({
          owner: context.repo.owner,
          repo: context.repo.repo,
          comment_id: botComment.id,
          body: report,
        });
        core.info(`Updated existing PR comment #${botComment.id}`);
      } else {
        await octokit.rest.issues.createComment({
          owner: context.repo.owner,
          repo: context.repo.repo,
          issue_number: prNumber,
          body: report,
        });
        core.info(`Posted compliance report as comment on PR #${prNumber}`);
      }
    } else {
      core.info('Not running in a PR context - printing report to output');
      core.info(report);
    }

    // Step 5: Set outputs
    const totalFiles: number = results.length;
    const gapCount: number = results.reduce((sum: number, r: AnalysisResult) => {
      let gaps: number = 0;
      if (!r.auditTrail.pass) gaps++;
      if (!r.policyEnforcement.pass) gaps++;
      if (!r.revocation.pass) gaps++;
      if (!r.humanOversight.pass) gaps++;
      if (!r.errorHandling.pass) gaps++;
      return sum + gaps;
    }, 0);

    // Recalculate score for output
    let score: number = 0;
    const categories: CategoryKey[] = ['auditTrail', 'policyEnforcement', 'revocation', 'humanOversight', 'errorHandling'];
    for (const key of categories) {
      const passCount: number = results.filter((r: AnalysisResult) => r[key].pass).length;
      const total: number = results.length;
      if (total > 0) {
        score += (passCount / total) * 20;
      } else {
        score += 20;
      }
    }
    score = Math.round(score);

    core.setOutput('score', score.toString());
    core.setOutput('agent-files', totalFiles.toString());
    core.setOutput('gaps', gapCount.toString());
    core.setOutput('report', report);

    // Step 6: Optionally fail the check
    if (failOnGaps && gapCount > 0) {
      core.setFailed(
        `AI agent governance scan found ${gapCount} gap(s) across ${totalFiles} file(s). Score: ${score}/100`
      );
    }
  } catch (error: unknown) {
    const message: string = error instanceof Error ? error.message : String(error);
    core.setFailed(`Action failed: ${message}`);
  }
}

run();
