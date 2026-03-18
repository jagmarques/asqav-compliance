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
 * Recursively scan a directory for Python files that use AI agent frameworks.
 * Returns an array of FileResult objects.
 */
export declare function scanDirectory(dirPath: string): FileResult[];
/**
 * Analyse a single file's content for governance patterns.
 * Returns an AnalysisResult describing which checks pass.
 */
export declare function analyzeFile(filePath: string, content: string): AnalysisResult;
/**
 * Generate a Markdown compliance report from analysis results.
 */
export declare function generateReport(results: AnalysisResult[]): string;
