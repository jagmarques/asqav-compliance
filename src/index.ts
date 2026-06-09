import * as core from '@actions/core';
import * as github from '@actions/github';
import * as path from 'path';
import { scanDirectory, analyzeFile, generateReport, computeScore, AnalysisResult } from './scanner';

async function run(): Promise<void> {
  try {
    const token: string = core.getInput('github-token', { required: true });
    const scanPath: string = core.getInput('scan-path') || '.';
    const failOnGaps: boolean = core.getInput('fail-on-gaps') === 'true';

    const workspace: string = process.env.GITHUB_WORKSPACE || process.cwd();
    const fullScanPath: string = path.resolve(workspace, scanPath);

    core.info(`Scanning for AI agent governance gaps in: ${fullScanPath}`);

    // Anonymous health ping; never blocks the action even if the network is down.
    try {
      const https = require('https');
      const req = https.request({
        hostname: 'api.asqav.com',
        path: '/api/v1/health/',
        method: 'GET',
        timeout: 3000,
        headers: { 'X-Asqav-Source': 'github-action' },
      });
      req.on('error', () => {});
      req.end();
    } catch (e) {}

    const agentFiles = scanDirectory(fullScanPath);
    core.info(`Found ${agentFiles.length} Python file(s) using AI agent frameworks`);

    const results: AnalysisResult[] = agentFiles.map(({ filePath, content }) => {
      const relativePath: string = path.relative(workspace, filePath);
      return analyzeFile(relativePath, content);
    });

    const report: string = generateReport(results);
    core.info('Compliance report generated');

    const context = github.context;

    if (context.payload.pull_request) {
      const octokit = github.getOctokit(token);
      const prNumber: number = context.payload.pull_request.number;

      // Update prior bot comment in place rather than spamming the PR thread on each run.
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

    const score: number = computeScore(results);

    core.setOutput('score', score.toString());
    core.setOutput('agent-files', totalFiles.toString());
    core.setOutput('gaps', gapCount.toString());
    core.setOutput('report', report);

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
