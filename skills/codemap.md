# src/skills/

## Responsibility

- Own metadata-driven OpenCode custom skills shipped with this package.
- Maintain the skill contract artifacts (`SKILL.md`, `README.md`, per-skill helper files) that are copied into
  `${configDir}/skills` at install time.
- Preserve a canonical registry boundary: runtime code consumes skill definitions as data, not as executable
  plugin dependencies.

## Design

- `CUSTOM_SKILLS` in `src/cli/custom-skills.ts` is the authoritative skill manifest for bundled
  skills; each entry maps folder name + `sourcePath` to an install-time consumer.
- `install.ts` runs `installCustomSkill()` which recursively copies bundled skill
  directories into the OpenCode skills directory.
- This directory is partitioned by skill:
  - `src/skills/codemap/` (command-style repository mapping skill)
  - `src/skills/clonedeps/` (workflow skill for dependency source mirroring)
  - `src/skills/simplify/` (readability/refactor guidance skill)
  - `src/skills/reflect/` (orchestrator-only workflow for learning from repeated work and suggesting reusable improvements)
  - `src/skills/oh-my-opencode-slim/` (orchestrator-only plugin configuration and self-improvement guidance)
- The upstream 2.0.3 package also ships `src/skills/deepwork/` and `src/skills/worktrees/`, but this local config intentionally does not vendor them to keep OpenSpec and Git workflow ownership explicit.
- Files are considered static runtime payload. No plugin TS module in `src/` imports these files directly; they
  are loaded by OpenCode via filesystem installation.

## Flow

- `bun run install` delegates to `src/cli/install.ts`, where `installCustomSkills` gates copying of
  each `CUSTOM_SKILLS` entry.
- `installCustomSkill()` computes `packageRoot`, validates `sourcePath`, then performs a recursive
  directory copy via `copyDirRecursive()`.
- During plugin release, the `files` whitelist in `package.json` must include `src/skills` so
  `src/skills/**` survive `npm pack`.
- OpenCode plugin startup discovers these installed folders and reads each `SKILL.md` as a prompt-level contract.

## Integration

- `src/cli/custom-skills.ts`: source-of-truth registry consumed by installer and permission helpers.
- `src/cli/skills.ts:getSkillPermissionsForAgent()` auto-populates permission rules for
  bundled skills when agent policy is derived from built-in recommendations.
- `verify-release-artifact.ts` in upstream enforces artifact completeness for the full npm tarball. This local vendored subset intentionally differs by omitting `deepwork/` and `worktrees/`.
- `package.json` scripts (`verify:release`, `build`) rely on these assets to ensure install-time skill availability.
