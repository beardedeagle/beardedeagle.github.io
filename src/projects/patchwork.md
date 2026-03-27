---
layout: layouts/project.njk
title: Patchwork
tagline: "Context-preparation engine for code and rich documents. Semantic compression, OCR-aware ingestion, and prompt-ready output for downstream models."
status: upcoming
order: 9
stack:
  - Rust
  - ONNX Runtime
  - MiniLM
  - SQLite
---

## The Problem

Most LLM tooling treats context preparation like an afterthought: concatenate files, trim a little, hope the model sorts it out. That wastes window budget, destroys structure in rich documents, and forces downstream agents to spend tokens on boilerplate, duplication, and extraction noise instead of the parts that actually matter.

## Approach

Patchwork is a Rust context-preparation engine for codebases and rich documents. It collects files, normalizes them through a document-conversion pipeline, applies deterministic and semantic compression, and emits prompt-ready output in formats downstream models and tools can actually consume.

It is built as both a CLI and a library because the point is not just manual prompt prep. The point is to give agents, coders, and other systems a reusable layer that can shape context before it ever reaches the model. When the semantic feature is enabled, Patchwork brings MiniLM and ONNX Runtime into that pipeline directly instead of treating semantic compression as an external dependency.

## Direction

Patchwork is headed toward a world where context packing is treated like a real systems problem: format-aware ingestion, query-aware pruning, cross-run learning, defensible caching, and output that preserves structure when it matters and strips it when it does not. The goal is to spend model context on signal instead of scaffolding.

## Key Design Decisions

**Context preparation is the product.** Patchwork treats collection, conversion, compression, and formatting as one pipeline instead of a handful of disconnected helper steps bolted onto prompt assembly.

**Rich-document ingestion is first-class.** Code is only part of the problem. PDFs, DOCX, and other heavier formats need structured extraction, chunk budgeting, and OCR fallback so they can be used without flattening everything into garbage text.

**Compression is composable.** Deterministic cleanup, query-focused pruning, clustering, semantic deduplication, and cross-file reduction can be combined or preset depending on whether the goal is speed, fidelity, or maximal compression.

**Heavier semantics stay optional, but self-contained.** The default build stays lean, while the semantic build folds MiniLM and ONNX Runtime directly into Patchwork for higher-quality pruning and deduplication without pushing that work out to a separate service.

**CLI and library share the same core.** Patchwork is meant to be embedded in other systems, not just run by hand in a shell. The same pipeline powers both so downstream tooling does not need to reimplement collection, compression, and formatting logic.

**Caching is correctness-aware.** Memoization is opt-in and keyed against both inputs and configuration so repeat work can be skipped without pretending two different runs are interchangeable.
