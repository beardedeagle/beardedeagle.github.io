---
layout: layouts/project.njk
title: MonkeyClaw
tagline: "Secure-by-default BEAM-native AI workspace. LiveView dashboard, multi-backend chat, plug extensions, and BeamAgent-backed sessions."
status: available
order: 1
stack:
  - Elixir
  - Phoenix
  - OTP
  - LiveView
  - SQLite3
repo: https://github.com/beardedeagle/MonkeyClaw
---

## The Problem

The AI assistant product category is proven, but the security postures of existing solutions are catastrophic. Credentials in plaintext config, no process isolation between agents, no audit trails, no governance over what an agent can do on your system. MonkeyClaw exists because these problems are architectural — you can't patch them on after the fact.

## Current Product

MonkeyClaw is still young, but the shape of it is already clear: a personal AI assistant built on the BEAM, where fault tolerance and process isolation are not afterthoughts - they are part of the runtime model. Every agent session runs as a supervised OTP process, so crashes are isolated, recovered, and audited by default. Distribution is built in as well, making it a stronger foundation for a secure long-lived assistant than the usual pile of opaque local state, ambient trust, and ad hoc recovery logic.

Underneath that UI, workspaces map 1:1 to BeamAgent sessions, channels map to threads, and assistants render into session configuration. MonkeyClaw stays the product layer — [BeamAgent](/projects/beam-agent/) handles the generic runtime machinery.

## Architecture

The architecture separates cleanly into layers:

{% mermaid %}
graph TB
    W["Workflow Layer<br/>Conversation recipes"] --> P["Product Layer<br/>Assistants · Workspaces · Channels"]
    P --> E["Extension Layer<br/>Plug pipelines · Hooks · Contexts"]
    E --> B["Agent Bridge<br/>Backend behaviour · Session · Telemetry"]
    B --> API["Elixir API<br/>beam_agent_ex"]
    API --> R["Runtime Substrate<br/>BeamAgent — orchestration · audit · transports"]
    style W fill:#1e3a5f,stroke:#22d3ee,color:#e2e8f0
    style P fill:#1e3a5f,stroke:#22d3ee,color:#e2e8f0
    style E fill:#1e3a5f,stroke:#22d3ee,color:#e2e8f0
    style B fill:#1e3a5f,stroke:#22d3ee,color:#e2e8f0
    style API fill:#1a2332,stroke:#475569,color:#e2e8f0
    style R fill:#1a2332,stroke:#475569,color:#e2e8f0
{% endmermaid %}

MonkeyClaw is the product layer. [BeamAgent](/projects/beam-agent/) is the runtime substrate. Clean separation — connected through a public Elixir API.

## Direction

The ambition is broader than cloning any single *Claw. The goal is to absorb the useful features from that ecosystem and adjacent agent or research tools, then rebuild them the idiomatic Elixir and Erlang way: supervised processes instead of hidden mutable state, explicit policy boundaries instead of ambient trust, and product features that inherit BeamAgent's orchestration, audit, and transport machinery instead of reimplementing it badly.

Longer term, that includes folding in more autonomous research and self-improvement loops, but as governed workflows with safety rails rather than unconstrained magic.

## Key Design Decisions

**Multiple product surfaces.** The LiveView dashboard and chat UI are the first interface, not the boundary of the product. MonkeyClaw is being shaped so the same assistant, workspace, and session model can drive browser UI, CLI and TUI clients, a headless OpenAI-compatible API, and service integrations such as WhatsApp, Signal, Telegram, Slack, Discord, and email.

**Plug-based extension system.** Extensions use the `init/1` + `call/2` contract — the same pattern as `Plug.Conn`, applied to MonkeyClaw lifecycle events instead of HTTP requests. This layer is additive, not a replacement for backend-native plugins, skills, commands, prompts, MCP servers, or hooks. It is the Elixir and Erlang-native place to enforce policy, add guardrails, inject product behavior, and keep cross-cutting concerns in the application instead of scattering them across providers.

**Backend and provider abstraction.** Five agentic-coder backends are wired in today through BeamAgent, but that is the starting point, not the ceiling. The design target is broader: support both agentic-coder runtimes and direct inference-provider APIs behind a consistent product surface, so capability growth does not require rewriting MonkeyClaw every time a new backend or provider matters.

**Workflows as pure functions.** Workflows orchestrate domain entities, agent sessions, and extension hooks into user-facing operations. No processes — they compose existing APIs. The canonical "talk to an agent" flow loads the workspace, ensures a session, fires pre/post hooks, and returns the result.

**mTLS certificate generation.** Pure Elixir, no external dependencies. Self-signed CA, server certs with SANs, client certs, and PKCS#12 bundles for browser import.

**Pluggable persistence path.** SQLite3 plus ETS are the right fit for the current phase, but the persistence boundary is being kept generic enough to support more than one storage model. Longer term, the plan is to bring `mnesiac`, `amalgamate`, `exodus`, and `mnesiaex` into the picture to land a stable, reliable, self-healing distributed Mnesia foundation inside MonkeyClaw.
