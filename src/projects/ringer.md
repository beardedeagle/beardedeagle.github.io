---
layout: layouts/project.njk
title: ringer
tagline: "Telephony validation harness for concurrent multi-target calling. Fair source rotation, backend-aware routing, rate limiting, and live TUI metrics."
status: available
order: 4
stack:
  - Python
  - Typer
  - Pydantic
  - Textual
repo: https://github.com/beardedeagle/ringer
---

## The Problem

Validating telephony infrastructure at scale is harder than just placing calls. You need to exercise multiple targets concurrently, rotate source numbers carefully enough to avoid pattern detection, respect provider rate limits, and keep enough visibility to tell whether a failure came from carrier behavior, backend integration, or your own pacing logic.

## Approach

ringer treats telephony validation as an orchestration problem. Each target runs independently, sources come from a shared thread-safe pool with spacing enforcement, and calls are routed through backend adapters while one tracker records target, source, backend, outcome, and runtime metrics.

That gives you a repeatable way to drive ring cycles, failover checks, and backend validation without turning the test harness itself into the source of noise. The same orchestration model can run against real providers or in simulation mode, with the same reporting and control surfaces.

## Key Design Decisions

**Target-thread concurrency over batch loops.** One worker per target keeps timing and failure state isolated, so a stalled or noisy target does not distort the rest of the run.

**Fair source rotation with spacing enforcement.** Source numbers are treated as a constrained pool, not disposable inputs. Rotation, reuse tracking, and minimum spacing are first-class so the tool can stress infrastructure without immediately looking like spam.

**Backend-aware routing and fault controls.** Providers are abstracted behind a common interface, source numbers can map to different backends, and rate limiting plus circuit breaker logic keeps backend failures or 429 storms from cascading across the whole run.

**Thread-safe tracking with live operational visibility.** Metrics are recorded centrally and exposed through both periodic reports and a live Textual dashboard, so you can see target behavior, backend distribution, source reuse, and active-call timing while the run is still in flight.

**Configuration as an interface, not a file format.** CLI arguments, environment variables, and YAML or JSON config all feed the same validated model, which makes the tool easier to automate and harder to misconfigure halfway through an exercise.
