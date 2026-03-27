---
layout: layouts/project.njk
title: SmolCoder
tagline: "Terminal-first multi-agent coding assistant. In-TUI editor, rich chat rendering, MCP and plugin extensibility, persistent memory, and built-in governance."
status: upcoming
order: 8
stack:
  - Python
  - smolagents
  - Textual
  - MCP
  - SQLite
---

## The Problem

Most coding assistants are still dressed-up chat windows. That model works for short prompts, but it starts to fall apart once engineering work needs delegation, parallel exploration, persistent context, extension points, or meaningful operational boundaries.

## Approach

SmolCoder is a terminal-first agentic coding environment built around the idea that orchestration, context, security, and extensibility are not side features. They are the product. It is designed to support everything from direct pair-programming to delegated specialists, parallel agent runs, team-shaped workflows, and adversarial review inside one runtime.

The Textual UI is not just a shell around chat. It includes an in-TUI code editor and chat surfaces that can carry code and, where the terminal graphics stack supports it, Mermaid diagrams and images inline, alongside persistent memory, MCP support, plugins, skills, hooks, and governance. The goal is not just a better chat surface, but a controllable environment for real engineering work.

## Direction

SmolCoder is headed toward a programmable runtime for coding agents rather than a single-interface app. The terminal matters, but the deeper value is that the same system can host different orchestration styles, carry durable memory, integrate outside tools, and enforce policy around what agents are allowed to do.

## Key Design Decisions

**Orchestration is a first-class surface.** SmolCoder is built to switch between direct pair programming, delegated specialists, isolated parallel work, and more team-shaped or adversarial workflows depending on the task, instead of forcing everything through a single chat loop.

**The terminal is the control plane.** The TUI, context indexing, mentions, and persistent conversation state are there to keep the system usable during real engineering sessions, not just to make demos look polished.

**The interface has to be useful, not decorative.** Editing files inside the TUI and rendering code, diagrams, and other visual context in chat, when the terminal supports it, keeps more of the engineering loop inside one place instead of forcing constant context switches out to separate tools.

**Extensibility is built in.** MCP servers, plugins, skills, hooks, and slash commands expand the runtime without forcing a fork of the core application. The system is meant to grow by composition, not by hardcoding every capability into the base app.

**Governance is part of the runtime.** Permissions, sandboxing, content inspection, rule-based command control, and audit trails are part of the core design because coding agents need operational boundaries, not just prompt discipline.

**Memory and conversation structure are durable.** SQLite-backed persistence and conversation-graph tracking give the system long-lived context without turning multi-agent workflows into an untraceable mess.
