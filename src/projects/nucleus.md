---
layout: layouts/project.njk
title: Nucleus
tagline: "TypeScript microkernel for agent systems. Sandboxed plugins, mediated host contexts, declarative security, and kernel-level observability."
status: upcoming
order: 10
stack:
  - TypeScript
  - Bun
  - TypeBox
  - Zod
  - OpenTelemetry
---

## The Problem

TypeScript agent frameworks tend to collapse everything into one trust boundary: tools, model adapters, memory, orchestration, and extensions all living in the same process with too much implicit coupling. That makes systems harder to swap, harder to secure, and far easier to destabilize when one extension misbehaves.

## Approach

Nucleus is a TypeScript microkernel for building agent systems where the core only owns the non-negotiable concerns: lifecycle, communication, security mediation, resources, state, validation, and observability. Tools, model adapters, executors, and other behaviors live outside that core as plugins.

The point is not just to make plugins load. It is to make them isolated, mediated, and replaceable. Plugins talk through schema-validated transports, reach privileged resources through kernel-owned host contexts, and can be reloaded, suspended, or denied without turning the entire system into a monolith.

## Direction

Nucleus is headed toward a Bun-native runtime where agent platforms can stay modular without giving up serious security, resource enforcement, or operational visibility. The kernel stays small and privileged; the ecosystem around it is where capabilities expand.

## Key Design Decisions

**The kernel is privileged, but intentionally small.** Nucleus keeps business logic out of the core and reserves the kernel for the things that should never be optional: mediation, policy enforcement, validation, state, and telemetry.

**Plugins are isolated by transport.** They do not get to live inside the kernel by default. Worker and process transports give Nucleus a clean boundary where plugins can be loaded, reloaded, or contained without sharing unrestricted state.

**Policy is declarative and enforced.** Permissions, hook allowlists, resource quotas, and suspension behavior flow from manifests into kernel-owned security and resource managers. Access to network, filesystem, model services, and inter-plugin messaging is mediated instead of trusted implicitly.

**Boundaries are schema-validated.** TypeBox, Zod, and runtime validation keep manifests, hook payloads, and responses honest at the kernel edge so one plugin cannot quietly poison another with malformed data.

**Security capabilities stay swappable, not hardcoded.** Prompt filtering and other kernel security features are defined behind interfaces so the enforcement point stays centralized even when the underlying implementation changes.

**Observability belongs to the platform.** Logging, tracing, metrics, reload telemetry, and security-denial signals are kernel concerns, not optional plugin add-ons. If the system is modular, the visibility has to be as well.
