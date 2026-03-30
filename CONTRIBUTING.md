# Contributing to asqav-compliance

Thank you for your interest in contributing to asqav-compliance! This guide will help you add new compliance rules and standards to the AI agent governance scanner.

## How to Add New Compliance Rules

### Understanding the Rule Structure

Compliance rules are defined in `src/scanner.ts` as regex patterns. Each governance category has its own pattern array:

- `AUDIT_TRAIL_PATTERNS` - Checks for audit trail/logging
- `POLICY_PATTERNS` - Checks for policy enforcement
- `REVOCATION_PATTERNS` - Checks for revocation capability
- `HUMAN_OVERSIGHT_PATTERNS` - Checks for human-in-the-loop
- `ERROR_HANDLING_PATTERN` - Checks for error handling

### Adding a New Pattern

1. **Open `src/scanner.ts`**

2. **Find the relevant category** (or create a new one if needed)

3. **Add your regex pattern** to the array:
   ```typescript
   const YOUR_CATEGORY_PATTERNS: RegExp[] = [
     // Existing patterns...
     /your_new_pattern/i,  // Add your pattern here
   ];
   ```

4. **Pattern Tips**:
   - Use `/pattern/i` for case-insensitive matching
   - Use `\b` for word boundaries (e.g., `/\bapproval\b/i`)
   - Test your patterns against real agent code

### Adding a New Governance Category

To add an entirely new category:

1. **Define the pattern array** in `src/scanner.ts`:
   ```typescript
   const NEW_CATEGORY_PATTERNS: RegExp[] = [
     /pattern_one/i,
     /pattern_two/i,
   ];
   ```

2. **Add the check to `AnalysisResult` interface**:
   ```typescript
   export interface AnalysisResult {
     // ...existing fields...
     newCategory: GovCheck;
   }
   ```

3. **Add the check logic** in the `analyzeFile` function

4. **Update the scoring** in the `calculateScore` function (each category = 20 points)

5. **Update the report** generation to include your new category

### Testing Your Changes

1. **Run the test suite**:
   ```bash
   npm test
   ```

2. **Test against real agent code** in your own repositories

3. **Verify the PR comment output** looks correct

## Local Development with Pre-commit Hooks

To run compliance checks automatically before each commit:

1. **Install pre-commit** (requires Python):
   ```bash
   pip install pre-commit
   ```

2. **Install the hooks**:
   ```bash
   pre-commit install
   ```

3. **Run manually** (optional):
   ```bash
   pre-commit run --all-files
   ```

The pre-commit hook will run `npm test` to ensure your changes don't break existing functionality.

## Submitting Your Contribution

1. **Fork the repository**
2. **Create a branch**: `git checkout -b add-new-rule`
3. **Make your changes**
4. **Run tests**: `npm test`
5. **Commit**: `git commit -m "feat: add new compliance rule for X"`
6. **Push**: `git push origin add-new-rule`
7. **Open a Pull Request**

## Questions?

Feel free to open an issue if you have questions about adding new rules or need help with your contribution.

---

Thanks for helping make AI agent governance better! 🤖
