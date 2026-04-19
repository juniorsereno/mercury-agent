# Mercury — Decisions

> Architecture Decision Records. New ones appended as we go.

## ADR-001: TypeScript + Node.js

- **Context**: Need a runtime for 24/7 headless agent with future GUI, mobile, and chat integrations.
- **Decision**: TypeScript on Node.js.
- **Consequence**: Best AI SDK ecosystem (Vercel AI SDK), Ink for TUI, grammY for Telegram, easiest path to every future channel.

## ADR-002: Ink for TUI

- **Context**: CLI needs to feel alive — animations, progress, typewriter effects.
- **Decision**: Ink + React for terminal UI.
- **Consequence**: Steeper learning curve than Commander, but legendary UX. Initial CLI uses readline; Ink added in Phase 2.

## ADR-003: Flat-file memory

- **Context**: Memory needs to be simple, inspectable, git-friendly.
- **Decision**: JSONL for long-term/episodic, JSON for short-term.
- **Consequence**: Easy to debug, no DB dependency. May need SQLite later for semantic search.

## ADR-004: grammY for Telegram

- **Context**: Need Telegram integration with streaming and typing.
- **Decision**: grammY + @grammyjs/stream + @grammyjs/auto-retry.
- **Consequence**: Best TypeScript Telegram framework. Built-in streaming support. Active community.

## ADR-005: Vercel AI SDK for LLM

- **Context**: Multiple providers (OpenAI, Anthropic, DeepSeek) with streaming.
- **Decision**: Vercel AI SDK (`ai` package) with provider-specific adapters.
- **Consequence**: Unified API, built-in streaming, tool calling. Provider swaps are one-line changes.

## ADR-006: Soul as separate markdown files

- **Context**: Agent personality needs to be editable, versionable, and token-efficient.
- **Decision**: Four separate markdown files: soul.md, persona.md, taste.md, heartbeat.md. Only soul + persona injected every request; taste + heartbeat selectively.
- **Consequence**: ~350 token baseline for identity. Owner can edit personality without code changes.

## ADR-007: Agent Skills specification

- **Context**: Skills need to be modular, installable at runtime, and token-efficient.
- **Decision**: Adopt the Agent Skills spec (agentskills.io). Skills use `SKILL.md` with YAML frontmatter + markdown instructions. Stored in `~/.mercury/skills/`. Progressive disclosure: only name+description loaded at startup; full instructions loaded on invocation.
- **Consequence**: Skills are human-readable markdown, no code required. Token budget stays low. Install by pasting content or URL.

## ADR-008: Scheduler with YAML persistence

- **Context**: Mercury needs to set reminders, run periodic tasks, and trigger skills on a schedule.
- **Decision**: Expose `schedule_task`, `list_scheduled_tasks`, `cancel_scheduled_task` as AI-callable tools. Persist scheduled tasks to `~/.mercury/schedules.yaml`. Restore on startup. Tasks fire as internal (non-channel) messages through the agent loop.
- **Consequence**: Mercury can autonomously schedule work. Tasks survive restarts. Internal execution keeps scheduled tasks invisible to channels unless the agent explicitly sends output.