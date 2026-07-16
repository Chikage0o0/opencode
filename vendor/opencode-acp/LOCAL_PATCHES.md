# Local ACP patches

This directory is derived from `ranxianglei/opencode-acp` tag `v1.12.6`, commit
`f1a33d9f4ce55af808eb4e050717c914ed16084b`.

The local integration adds only persistence lifecycle hardening needed by concurrent OpenCode
parent and background sessions:

- serialize state writes by final session file path while keeping different sessions concurrent;
- capture JSON at call time so queued snapshots cannot observe later state mutation;
- replace state files atomically through a same-directory temporary file;
- retain a terminal write failure until the matching session drain reports it;
- initialize storage before both reads and writes, and stage legacy DCP migration in a unique
  directory, never overwriting an ACP directory created concurrently or marking a transient
  failure as complete;
- expose a plugin `dispose` hook that drains only the active session's pending writes before
  shutdown;
- require `@opencode-ai/plugin >=1.16.0`, the first line that exposes the `dispose` hook used here.

Cross-session in-memory isolation remains in the parent repository's
`lib/acp-session-isolation.ts`. Upgrade by diffing these changes against a new upstream release,
rebuilding the checked-in `dist/`, then rerunning both upstream and parent regression suites.
