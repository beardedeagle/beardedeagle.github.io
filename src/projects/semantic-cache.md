---
layout: layouts/project.njk
title: Semantic Cache
tagline: "Tiered semantic/object cache with vector and object storage. Custom L0 hot path, LanceDB warm tier, adaptive thresholds, and diversity-aware retrieval."
status: upcoming
order: 7
stack:
  - Rust
  - LanceDB
  - ANN
  - TinyLFU
  - C FFI
---

## The Problem

Exact-match caches break down in semantic workloads. Queries that mean the same thing rarely share the same key, and once you move beyond toy in-memory demos the hard part stops being nearest-neighbor lookup and becomes cache policy: reuse, coverage, freshness, promotion, eviction, and cost control across vector and object storage tiers.

## Approach

Semantic Cache is a tiered semantic/object caching system with vector and object storage, built for workloads where semantic reuse has to behave like a real cache instead of an ANN demo. The design centers on three operating modes: similarity for direct reuse, dissimilarity for coverage and anti-clustering, and a hybrid mode that balances both.

The long-term architecture is a custom L0 hot path, a LanceDB-backed warm tier, and colder distributed persistence behind a single policy layer. The goal is simple: reduce origin calls for semantically equivalent requests without letting the cache collapse into a pile of near-duplicate answers.

## Direction

The project is headed toward a semantic cache that can scale by tier instead of pretending one storage engine should do every job. Threshold selection, invalidation, admission, eviction, and observability are all treated as first-class problems, because that is where semantic caching either becomes operationally credible or falls apart.

## Key Design Decisions

**Three operating modes.** Similarity-only, dissimilarity-only, and hybrid retrieval serve different goals: hit rate, semantic coverage, or both. The system is designed to make that tradeoff explicit instead of forcing every workload through one retrieval strategy.

**Tiered persistence instead of a single vector store.** The design target is a custom L0 for the hot set, LanceDB for the warm tier, and pluggable colder backends for longer-lived or distributed persistence. That keeps the fast path tight without capping the total cacheable space.

**Adaptive thresholds and category-aware policy.** A single global similarity threshold is a good way to either miss useful reuse or serve garbage. Thresholds, TTLs, and quota behavior should move with query category and observed traffic patterns instead of staying fixed forever.

**Freshness is proactive.** TTL remains a safety net, but mutable knowledge bases need source-aware invalidation and coordinated purge behavior across tiers. Freshness cannot depend entirely on waiting for entries to age out.

**Cache semantics matter as much as vector search.** Admission, eviction, anti-clustering, warming, observability, and bindings are part of the product surface. A semantic cache that only does retrieval is still missing the operational half of the problem.
