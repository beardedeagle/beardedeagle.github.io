---
layout: layouts/project.njk
title: CourtKit
tagline: "Desktop-first legal evidence workspace. Airgapped by design, sealed at rest, semantic search, and citation-backed research without a localhost service stack."
status: upcoming
order: 6
stack:
  - Rust
  - Dioxus
  - Candle
  - LanceDB
  - age
---

## The Problem

Legal professionals working with sensitive case material face a bad trade: modern AI workflows assume cloud services and operational sprawl, while the work itself demands tight control over evidence, provenance, and where data is allowed to go. CourtKit treats isolation as a product requirement, not a deployment inconvenience.

## Approach

CourtKit is a desktop-first legal evidence workspace built to ingest, search, review, and cite material inside one local runtime. The goal is to keep evidence handling, semantic retrieval, and chat-assisted research inside CourtKit instead of spreading the workflow across browser tabs, localhost services, cloud APIs, or sidecar model installs.

It is designed to feel like a serious operator tool, not a demo shell around an API. That means local-first execution, strong at-rest boundaries, evidence-oriented workflows, and a product shape that favors reliability and chain-of-custody over convenience shortcuts.

## Key Design Decisions

**Desktop-first secure runtime.** CourtKit is built as a local application, not a browser app served from a hidden local stack. The product boundary is the workstation, not a cluster of helper services.

**Airgapped-by-design evidence handling.** Sensitive evidence may be staged locally for ingestion, but once committed the staged copy is removed and the working set stays inside CourtKit. Sealing, provisioning, staging, and storage all exist to support that operating model rather than to bolt security on afterward.

**Evidence-first workflows.** Search, document review, and chat are meant to stay grounded in source material. The value is not just "talk to a model," but work against evidence in a way that preserves traceability and citation discipline.

**Single-runtime product shape.** CourtKit deliberately avoids the usual service decomposition for this class of tool. Fewer moving parts means less operational drag, fewer local failure modes, and a more credible offline story.

**Embedded local AI with explicit boundaries.** Inference assets are intended to ship with the application artifact and stream into memory at runtime rather than landing on disk as a separate model footprint. Remote integrations remain separate and explicit instead of quietly becoming the default path for sensitive work.

## Intended Users

Solo practitioners and small firms handling sensitive litigation, regulatory investigations, or compliance work where data sovereignty is non-negotiable.
