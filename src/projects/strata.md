---
layout: layouts/project.njk
title: Strata
tagline: "Source-first programming language and runtime contract. Explicit effects, capability-typed authority, supervised actors, post-quantum-aware policy, and runtime evidence — by design."
status: available
order: 1
stack:
  - Rust
  - Capability Types
  - Actor Model
  - Effect System
  - Post-Quantum
repo: https://github.com/beardedeagle/strata
---

## The Problem

Most software treats security properties as external convention: a SAST run, a code review checklist, a runbook, an audit log bolted on after the fact. The language does not know what authority a program is allowed to exercise. The runtime does not validate what artifact it is about to admit. "Deterministic" and "post-quantum-aware" remain phrases in design documents rather than properties the system actually enforces.

Every gap between intent and enforcement is exploitable. Ambient authority leaks through library calls. Undeclared side effects ship to production. Cryptographic policy fragments across whichever libraries got linked — algorithm selection, key handling, and trust roots decided by transitive defaults rather than a stated contract. The execution path that actually ran is rarely the one the design described.

Strata exists to close those gaps inside the language and runtime contract itself, not on top of it.

## Approach

Strata is a source-first programming language. Mantle is the matching runtime contract. A Strata source file (`.str`) declares its effects, capabilities, determinism class, and protocol regimes. The checker rejects anything that violates those declarations before a build is allowed. Lowering produces a language-neutral Mantle Target Artifact (`.mta`). Mantle validates that artifact, admits it under explicit policy, and executes only the behavior it was authorized to perform.

The split is intentional. Strata owns syntax, type meaning, ownership, effects, capabilities, authority semantics, and the artifact schema. Mantle owns process scheduling, mailbox storage, capability validation at every boundary, effect-driver dispatch, supervised execution, distributed delivery, observability, and the wire formats that carry artifacts and messages between nodes. Neither side is allowed to widen the contract the other defined.

The shape that produces is a system where the security properties — no ambient authority, no undeclared effects, no silent cryptographic downgrade, no execution outside the policy and provenance model — are part of what the language and runtime enforce, not what reviewers remember to check.

## Architecture

The pipeline is source → checked IR → artifact → admitted process → observed execution.

{% mermaid %}
graph TB
    SRC["Strata Source<br/>.str — author surface"] --> CHK["Checker<br/>Effects · Capabilities · Determinism"]
    CHK --> LOW["Lowering<br/>Typed IR → Artifact"]
    LOW --> ART["Mantle Target Artifact<br/>.mta — language-neutral"]
    ART --> ADM["Mantle Admission<br/>Validate · Capability check · Policy"]
    ADM --> RUN["Mantle Runtime<br/>Processes · Mailboxes · Effect drivers · Observability"]
    style SRC fill:#1e3a5f,stroke:#22d3ee,color:#e2e8f0
    style CHK fill:#1e3a5f,stroke:#22d3ee,color:#e2e8f0
    style LOW fill:#1e3a5f,stroke:#22d3ee,color:#e2e8f0
    style ART fill:#1a2332,stroke:#475569,color:#e2e8f0
    style ADM fill:#1a2332,stroke:#475569,color:#e2e8f0
    style RUN fill:#1a2332,stroke:#475569,color:#e2e8f0
{% endmermaid %}

The artifact is the trust boundary. Anything Mantle agrees to execute has been parsed, semantically checked, lowered into typed identifiers, and validated against the runtime's capability and policy model before a single instruction runs. Anything that fails validation is rejected, not silently widened.

## Key Design Decisions

**Explicit effects.** A function that touches the outside world declares what kind of touching it does. Undeclared side effects fail the checker rather than producing a working binary that surprises someone in production.

**Capability-typed authority.** Authority is not an ambient runtime convention. It is a type — transferred and attenuated explicitly, validated at every runtime boundary, and revocable through the runtime rather than after the fact through configuration sweeps.

**Immutable state, supervised actor processes.** State changes are whole-value transitions through explicit return forms. Processes are isolated, supervised, and communicate through typed mailboxes. Nothing escapes a per-process boundary by accident, and supervision is part of the program — not a wrapper script.

**Language-neutral runtime artifacts.** `.mta` is not "the Strata format". It is a self-identifying runtime contract that other frontends can target. Strata happens to be the first; the runtime stays portable, and the artifact carries its own format identity, version, and source-language tag.

**Post-quantum-aware cryptographic policy.** Algorithm choice, key material, signing roots, attestation chains, and transport authentication are governed by the policy artifact — not by whichever crypto, signing, or transport libraries happened to be linked. Silent downgrades and unapproved substitutions are rejected at the runtime boundary rather than logged after the fact.

**Runtime evidence, not just runtime execution.** Process spawn, message send, state transition, capability use, and termination produce structured observability output. Execution is something you can inspect after the fact, not something you trust on faith.

## Direction

The source-to-runtime slice runs end-to-end today: a `.str` program checks, builds into a `.mta`, and executes inside Mantle with structured runtime traces. Actor processes spawn, accept and handle messages, advance through whole-value state transitions, and terminate normally. Multiple actor instances of the same process definition run side by side under distinct runtime identifiers.

The roadmap expands the language surface — richer parsing and diagnostics, broader effect kinds, typed mailboxes, supervision strategies, refinement and descriptor algebra, protocol contracts — and the runtime surface — artifact validation, cluster membership, mutually authenticated cross-node transport, repository-mediated code distribution, upgrade orchestration with migration obligations, and post-quantum and hybrid cryptographic profiles.

Longer term, Strata and Mantle are designed for typed distribution, capability-aware runtime behavior, attestation-aware build outputs, and reproducible publication. The operational primitives that have to exist if security is going to be part of the language and runtime contract instead of something teams reinvent every project.
