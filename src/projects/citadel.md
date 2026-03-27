---
layout: layouts/project.njk
title: Citadel
tagline: "Host-local EDR/DLP with immediate enforcement. Governs actions, constrains execution, inspects risky content, and records what happened."
status: upcoming
order: 5
stack:
  - Rust
  - Tokio
  - JSON-RPC
  - Ed25519
  - WebExtensions
---

## The Problem

Once an autonomous system can execute code, touch the filesystem, or use the network, the question is no longer whether the prompt or integration was careful enough. The question is whether the host enforces policy strongly enough to treat that workload like any other risky operator.

Citadel exists because intent is not a security boundary. The boundary has to live where actions actually hit the machine.

## Approach

Citadel is a host-local EDR/DLP platform with an immediate-enforcement posture. It governs actions before they run, constrains execution at runtime, inspects risky content flows, outbound activity, browser mediated workflows, and leaves behind a usable audit trail.

The current focus includes agentic and autonomous workflows because that is where existing security products are especially weak, but the model is broader than that. Citadel is meant to do more than observe and alert: it is built to enforce, contain, and act locally when a workflow crosses a boundary, instead of only telling you after the damage is done.

## Key Design Decisions

**Execution-layer enforcement comes first.** Application-level filters can help, but for workloads with process, file, or network access they are not sufficient on their own.

**Coverage across the real operating surface.** The problem is not just shell execution. It includes risky content, outbound traffic, browser-mediated workflows, syscall inspection, and the provenance trail that tells you what actually happened.

**Layered enforcement, not one magic filter.** Governance, isolation, inspection, and audit each do different work. No single missed check should be enough to turn one bad model decision into a full host compromise.

**Local guarantees before central coordination.** A machine should be able to make, enforce, and explain its own security decisions before you ever add a broader management plane on top.

**Fail closed, least privilege, explicit elevation.** Safe defaults matter more than convenience defaults. If the system cannot justify an action or apply the right boundary, the correct behavior is denial, not optimism.

**Built for real workflows, not security theater.** The platform has to protect autonomous systems, local tools, browser-mediated workflows, and other host-active workloads without requiring users to constantly remember they are in a special mode.
