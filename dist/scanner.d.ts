/**
 * Static-pattern scanner for AI agent governance gaps. Walks a directory,
 * filters Python files that import a known agent framework, and tags each
 * file with pass/gap markers across audit-trail, policy, revocation,
 * human-oversight, and error-handling categories.
 */
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
/**
 * Recursively scan a directory for Python files that import a known AI agent framework.
 * Skips common build/venv directories and any file larger than 1 MiB.
 */
export declare function scanDirectory(dirPath: string): FileResult[];
/** Score a single file's contents against every governance category. */
export declare function analyzeFile(filePath: string, content: string): AnalysisResult;
/** Render the analysis results as a Markdown report suitable for a PR comment. */
export declare function generateReport(results: AnalysisResult[]): string;
