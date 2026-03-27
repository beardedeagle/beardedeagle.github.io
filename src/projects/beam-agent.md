---
layout: layouts/project.njk
title: BeamAgent
tagline: "BEAM-native SDKs for multi-backend agents. Unified sessions, routing, policy, memory, audit, and capability parity across runtimes."
status: available
order: 2
stack:
  - Erlang/OTP
  - Elixir
repo: https://github.com/beardedeagle/beam-agent
---

## The Problem

Most agent SDKs make you bind your application to one backend's quirks, wire protocol, and capability gaps. Even when they claim to support multiple providers, the abstraction usually collapses as soon as you need anything non-trivial: threads work here, tools work there, review or realtime somewhere else, and the caller ends up writing the fallback logic. BeamAgent starts from the opposite premise: the backend matrix should be an implementation detail, not the architecture of the application.

## Current Product

BeamAgent is the runtime and SDK layer for building multi-backend agent systems on the BEAM. It gives applications one coherent surface for sessions, messages, tools, routing, and backend control, so the application can be written around stable capabilities instead of provider-specific quirks.

It is not just shared plumbing between wrappers. BeamAgent is the parity layer: native features pass through when they exist, and missing ones are adapted or synthesized so applications do not have to encode backend gaps into their own architecture.

## Architecture

At the center is a single session engine: SDK surface to `beam_agent_session_engine`, then per-backend session handlers, then the underlying transport. The engine owns lifecycle, queueing, telemetry, and recovery; handlers focus on backend-specific protocol logic; transports deal with ports, HTTP, WebSocket, and other byte-level concerns.

The session engine is the session process. BeamAgent avoids turning every convenience layer into another resident process and keeps the shared domain surfaces explicit instead of hiding behavior inside a thicket of mailboxes.

## Direction

The backend list is not the boundary. BeamAgent is being designed to absorb more agentic-coder runtimes and direct inference-provider API integrations behind the same interface, while preserving capability parity even when the underlying vendor APIs diverge.

The goal is that applications ask for threads, tools, memory, routing, review, realtime, policy, or audit once and let BeamAgent decide whether the capability is native, adapted, or synthesized.

## Key Design Decisions

**Unified Erlang and Elixir SDKs.** `beam_agent` and `BeamAgent` are the primary surfaces. Backend-specific wrappers still exist, but the architecture centers on one public API instead of a pile of disconnected adapters.

**Session engine plus handler plus transport split.** Shared orchestration lives in `beam_agent_session_engine`, backend-specific logic lives in handler callbacks, and transport details stay at the transport layer. That keeps new backend bring-up bounded and prevents protocol quirks from leaking upward.

**Capability parity as a design goal.** BeamAgent is designed around the idea that every backend should expose the same high-level capability families. Native implementations are used where available; adapted or synthesized behavior closes the gaps where they are not.

**Explicit process ownership, functional domain modules.** The resident session process owns lifecycle and I/O. Domain surfaces like routing, routines, policy, journal, audit, memory, and orchestration are exposed as shared modules instead of hidden process farms.

**Policy, routing, memory, and audit as first-class substrate.** These are not bolted on per backend. They are part of the shared layer so applications can reason about approvals, backend selection, context retention, and traceability consistently.

## Role in the Stack

BeamAgent is consumed by [MonkeyClaw](/projects/monkeyclaw/) through the public Elixir surface, but it is not MonkeyClaw-specific. MonkeyClaw handles the product layer — assistants, workspaces, UI, channels. BeamAgent handles the runtime substrate — sessions, transports, orchestration, routing, policy, memory, audit, and capability normalization across backends.
