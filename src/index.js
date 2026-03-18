const core = require('@actions/core');
const github = require('@actions/github');
const path = require('path');
const { scanDirectory, analyzeFile, generateReport } = require('./scanner');

async function run() {
  try {
    // Read inputs
    const token = core.getInput('github-token', { required: true });
    const scanPath = core.getInput('scan-path') || '.';
    const failOnGaps = core.getInput('fail-on-gaps') === 'true';

    // Resolve the scan path relative to the workspace
    const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
    const fullScanPath = path.resolve(workspace, scanPath);

    core.info(`Scanning for AI agent governance gaps in: ${fullScanPath}`);

    // Step 1: Find all Python files with agent framework imports
    const agentFiles = scanDirectory(fullScanPath);
    core.info(`Found ${agentFiles.length} Python file(s) using AI agent frameworks`);

    // Step 2: Analyse each file for governance patterns
    const results = agentFiles.map(({ filePath, content }) => {
      // Make the path relative to the workspace for cleaner reporting
      const relativePath = path.relative(workspace, filePath);
      const analysis = analyzeFile(relativePath, content);
      return analysis;
    });

    // Step 3: Generate the compliance report
    const report = generateReport(results);
    core.info('Compliance report generated');

    // Step 4: Post as a PR comment (if running in a PR context)
    const context = github.context;

    if (context.payload.pull_request) {
      const octokit = github.getOctokit(token);
      const prNumber = context.payload.pull_request.number;

      // Check for an existing comment from this action to update instead of creating a new one
      const { data: comments } = await octokit.rest.issues.listComments({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: prNumber,
      });

      const botComment = comments.find(
        (comment) =>
          comment.user.type === 'Bot' &&
          comment.body.includes('AI Agent Governance Report')
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
      core.info('Not running in a PR context — printing report to output');
      core.info(report);
    }

    // Step 5: Set outputs
    const totalFiles = results.length;
    const gapCount = results.reduce((sum, r) => {
      let gaps = 0;
      if (!r.auditTrail.pass) gaps++;
      if (!r.policyEnforcement.pass) gaps++;
      if (!r.revocation.pass) gaps++;
      if (!r.humanOversight.pass) gaps++;
      if (!r.errorHandling.pass) gaps++;
      return sum + gaps;
    }, 0);

    // Recalculate score for output
    let score = 0;
    const categories = ['auditTrail', 'policyEnforcement', 'revocation', 'humanOversight', 'errorHandling'];
    for (const key of categories) {
      const passCount = results.filter((r) => r[key].pass).length;
      const total = results.length;
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
  } catch (error) {
    core.setFailed(`Action failed: ${error.message}`);
  }
}

run();
