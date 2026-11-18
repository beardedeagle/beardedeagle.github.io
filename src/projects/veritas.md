---
layout: layouts/project.njk
title: veritas
tagline: "Self-hosted ITSM, ITIL and CMDB in one binary. The CMDB is the spine and everything else is a query over it: tickets, workflows, AI steps behind human approval, and a hash-chained audit trail."
description: "veritas: a self-hosted ITSM/ITIL/CMDB service built on Elixir, Phoenix LiveView and SurrealDB, where the CMDB is the system of record and every other capability is a query over it."
status: available
order: 1.5
stack:
  - Elixir
  - Phoenix LiveView
  - OTP
  - SurrealDB
  - GraphQL
repo: https://github.com/beardedeagle/veritas
---

## The Problem

I needed an ITSM and CMDB for [devlocal](/projects/devlocal/), so I evaluated the open-source field, GLPI and iTop included. None of them fit. The CMDB was a module bolted beside the ticket queue instead of the thing the tickets are about. Identity, audit and approvals were afterthoughts.

So I wrote my own. veritas is a self-hosted, agentic IT operations and service-management platform, a service rather than a tool. It owns the system of record for configuration items, the ticket lifecycle, the service catalog and SLA obligations, knowledge, and the audit trail, and it grows through plugins rather than a hardcoded feature list.

## Approach

**The CMDB is the spine. Everything else is a query over it.** Incident, Change, Problem, Vulnerability, SLA and Knowledge are queries and workflows over configuration data. A ticket is about something, and that something is a record in the CMDB with typed relations to everything that depends on it.

**One discipline, three altitudes.** ITSM is the discipline, ITIL 4 is the guidance for it, and configuration management supplies the facts. They ship together because each is hollow without the others: a CMDB without practices is a spreadsheet, practices without a CMDB are a queue, and ITIL without ITSM is a document library.

**Two audiences, one binary.** A home-lab operator gets one binary, dense CLI-first tooling, and something that runs on a laptop. Enterprise IT gets SSO, role-based access, append-only audit, SLA obligations, approval workflows and high availability. What an enterprise still has to *supply*, an identity provider or a second datacenter, stays dormant until it's there, never absent.

## Architecture

{% mermaid %}
flowchart TB
    UI["LiveView UI"] --> SVC
    GQL["GraphQL API"] --> SVC
    CLI["CLI"] --> SVC
    SVC["One service layer"] --> POL["Policy<br/>one deny-by-default check"]
    POL --> DOM["Domain<br/>CMDB · tickets · workflows · knowledge"]
    DOM --> AG["Agentic runner<br/>proposals behind human approval"]
    DOM --> AUD["Audit log<br/>keyed hash chain"]
    DOM --> STP["Store port"]
    STP --> DB["SurrealDB<br/>supervised child process"]
    AG --> MP["Model provider port"]
    DOM --> DIR["Directory port<br/>the company's identity provider"]
    HOST["Plugin host API"] --> SVC
    HOST <-->|"JSON-RPC · capability-checked"| PL["Plugins<br/>each in its own OS process"]
    style UI fill:#1a2332,stroke:#475569,color:#e2e8f0
    style GQL fill:#1a2332,stroke:#475569,color:#e2e8f0
    style CLI fill:#1a2332,stroke:#475569,color:#e2e8f0
    style SVC fill:#1e3a5f,stroke:#22d3ee,color:#e2e8f0
    style POL fill:#1e3a5f,stroke:#10b981,color:#e2e8f0
    style DOM fill:#1e3a5f,stroke:#22d3ee,color:#e2e8f0
    style AG fill:#1e3a5f,stroke:#f59e0b,color:#e2e8f0
    style AUD fill:#1e3a5f,stroke:#10b981,color:#e2e8f0
    style STP fill:#1e3a5f,stroke:#22d3ee,color:#e2e8f0
    style DB fill:#1a2332,stroke:#475569,color:#e2e8f0
    style MP fill:#1e3a5f,stroke:#22d3ee,color:#e2e8f0
    style DIR fill:#1e3a5f,stroke:#22d3ee,color:#e2e8f0
    style PL fill:#1e3a5f,stroke:#f59e0b,color:#e2e8f0
    style HOST fill:#1e3a5f,stroke:#22d3ee,color:#e2e8f0
{% endmermaid %}

Three surfaces sit on one service layer, and every operation in one is available in the other two. Plugins come in through the host API, a fourth door onto the same layer. Every request, from any of them, passes the same Policy check before it reaches the domain. Amber marks the two places code or output that veritas didn't write enters the system: plugins and AI. Green marks what decides and what remembers.

## What Runs Today

- **The CMDB.** Configuration items with a type registry, seven typed relation kinds, and a blast-radius view that walks the dependency graph to answer the question a CMDB exists for: what breaks if this does.
- **Incident, end to end.** Impact-and-urgency priority with approved overrides, response and resolution SLA clocks on business calendars with hold accounting, and revisioned incident policies. Change, Problem, Vulnerability and Service Request can all be opened, transitioned and audited; their type-specific machinery comes next.
- **Workflows.** Draft, edit and publish ticket workflows with intake fields, manual steps, AI proposals, approvals and after-action work. Publishing checks the ticket lifecycle, and each run keeps the definition it started with, so later edits never change a run in flight.
- **AI that proposes, never decides.** An AI step produces a proposal, and an authorized human approves it before anything moves. Every accepted output keeps its model, provider and approver. Workflow definitions can be drafted from a prompt, and the draft is checked, corrected once if needed, and still has to be reviewed and published by a human.
- **Identity and authorization.** Local accounts with Argon2id and server-side sessions, role-based authorization on every surface, Workspaces that nothing crosses between, and a directory port for the company's own people.
- **A plugin runtime.** Each plugin runs as its own OS process over JSON-RPC, and the host checks every call against the capabilities its manifest declared.
- **A release path** that carries the datastore binary it was verified against, checked by digest at install, with service definitions for systemd, launchd and Windows.

Everything above is **Veritas Core**. The product is four parts, and the other three come next:

- **Veritas Discovery** *(working name)*. Endpoint management. Enrolled collectors report what each machine actually runs, with where and when it was observed, and Core reconciles that into the CMDB, so the CMDB is fed by the estate rather than by whoever remembered to update it. Seeing a machine never grants the right to act on it: management actions are authorized separately.
- **Veritas KB.** Documentation and knowledge management as a first-class part of the product, not a wiki bolted on beside it.
- **Veritas Vault.** Native custody for secrets and protected data. It's built in the same codebase but deployed in isolation: nothing else in veritas has a direct path to its implementation, its storage or its keys, and applications reach it only through an authorized GraphQL API. An optional privileged UI plugin brings it into Core, and Vault still authorizes every operation itself, because a page being visible isn't permission.
- **Single sign-on and the rest of identity.** OIDC and SAML, LDAP and SCIM, MFA and API tokens are specified and land as adapters behind ports that already exist, not as changes to the domain.

## Key Design Decisions

**One rulebook.** Authorization is one deny-by-default check, `(principal, action, resource, context)`, and every surface calls it. A surface that answered "may this person do that?" anywhere else would be a second rulebook.

**The host owns the agent loop.** The agentic framework sits behind a narrow port. The agent loop, the tool registry and the approval state belong to veritas, because an approval gate that lives in a framework callback can't outlive a process restart.

**The audit trail can't be quietly edited.** The audit log is append-only and hash-chained with a key, so a removed or altered record is detectable.

**The datastore is a supervised child, not a dependency to install.** veritas starts SurrealDB as a child process, waits for it to answer before serving anything, and stops it on the way down. It speaks to it through its own thin HTTP client, because the official client embeds a native library that breaks the Alpine, Windows and Nix builds.

**Secrets never touch a command line.** The bootstrap token for the first account is written to an owner-only file and never printed, because a terminal is one of the places secrets end up. Operator passwords come from the environment or a prompt, never from arguments, which every process on the machine can read.

**No number it hasn't measured.** The design sets budgets, and budgets aren't measurements, so veritas publishes no recovery or availability figures until they're measured and reproducible. The benchmark harness reads the query plan the store actually chose, so a query that regresses from an index scan to a table scan fails the build.

## Role in the Stack

veritas is [devlocal](/projects/devlocal/)'s ITSM and CMDB. The lab's AI engineers file and work tickets in it like anyone else, and its CMDB is the record of what the lab runs and what depends on what. Its plugin runtime makes the same bet [Citadel](/projects/citadel/) makes about agents: code veritas didn't write gets a declared capability set, its own process, and a check on every call.
