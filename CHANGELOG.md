# Changelog

All notable changes to `asqav-compliance` are listed here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions follow [SemVer](https://semver.org/) and track the `package.json` version.

## [Unreleased]

## [1.0.1] - 2026-05-18

### Changed
- Comment hygiene sweep across compliance scanner sources (#46).
- Capitalised `Asqav` author field in `package.json` and `action.yml` (#45).
- Dropped generated `.d.ts` artifacts and gitignored declaration output (#44).
- AI-navigation gold-standard comment sweep (#42).
- `support@asqav.com` rolled into `info@asqav.com` on the SECURITY contact; unused `GovCheck` export removed (#43).
- Public email consolidation; `security@` alias replaced with the live `support@` (later `info@`) channel (#33).

### Fixed
- `TS7006` on the `find` callback in the policy scanner (#30).

### CI
- Added a test job and `ci-ok` gate to the GitHub Actions workflow (#41).
- `undici` override plus Dependabot configuration (#23).

### Documentation
- README badges (#7).
- `CONTRIBUTING.md` (#6).
- `alt="Asqav"` on the logo banner (#39).
- Replaced canonicalization jargon with a pointer to the [SDK fingerprint spec](https://github.com/jagmarques/asqav-sdk/blob/main/docs/fingerprint-spec.md) (#35).
- Documented SDK hash-only / full-payload data-handling modes (#34).
- Pre-commit hook configuration for local compliance checks (#14).

### Dependencies
- Bumped `@types/node` to 25.8.0 (#48), 25.6.1 (#40), and 25.6.0 (#27).
- Bumped `tsx` to 4.22.0 (#47).
- Bumped `@actions/github` to 8.0.1 (#36).
- Bumped `actions/checkout` to v6 (#25) and `actions/setup-node` to v6 (#24).

## [1.0.0] - Initial release

Initial GitHub Action for AI agent governance scanning across 10 frameworks (LangChain, LlamaIndex, Haystack, CrewAI, AutoGen, SmolAgents, OpenAI, Anthropic, Google GenAI, Semantic Kernel) with five governance checks (audit trail, policy enforcement, revocation, human oversight, error handling) mapped to EU AI Act, DORA, and ISO 42001.
