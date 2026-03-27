---
layout: layouts/project.njk
title: oLLM
tagline: "Optimization-driven local inference on tiny VRAM. Built to fit 120B to 160B-class models onto 8GB hardware without quantizing away fidelity."
status: available
order: 3
stack:
  - Python
  - PyTorch
  - Transformers
repo: https://github.com/beardedeagle/ollm
---

## The Problem

Most local inference stacks force a false choice: buy far more VRAM, or quantize the model so aggressively that quality, context, or behavior change in ways you can feel. The real problem is not just model size — it is how to sequence storage, memory, and execution optimizations so very large models can run on ordinary hardware without turning inference into a hand-tuned science project.

## Approach

oLLM is a local-first inference runtime built around that constraint. It is being shaped as both a library and an operator surface: CLI and TUI for interactive use, one-shot execution for scripts, and a headless server mode aimed at OpenAI-compatible soak and integration testing.

Underneath those surfaces is an optimization-driven runtime. Weight streaming, KV strategy selection, specialization passes, backend selection, and execution planning are all part of one system, so the runtime can explain or choose the path instead of forcing a separate handwritten implementation for every model family.

## Direction

The big question behind oLLM is simple: how do you fit 120B to 160B-class models into 8GB of VRAM, then keep pushing that ceiling higher without paying the full performance tax? The answer is not one silver bullet. It is the right sequence of optimizations, applied automatically, truthfully benchmarked, and chosen with enough context to preserve accuracy instead of quantizing the model to death.

That is why strategy work matters so much here. The longer path is not just "support more tricks," but build a runtime that can compose them responsibly: storage layout, KV handling, prompt ingestion, specialization selection, and future compression work such as [TurboQuant](https://arxiv.org/abs/2504.19874) when it can be integrated without lying about quality or performance.

## Key Design Decisions

**Multiple local execution surfaces.** The same core runtime is intended to power interactive terminal use, one-shot scripted prompting, and a local headless API. That keeps operator workflows, automation, and soak testing aligned instead of creating separate stacks for each mode.

**Optimization strategy engine over per-model one-offs.** The goal is not to write a bespoke module for every model. It is to compose the right loading, specialization, KV, and execution strategies automatically from the runtime plan.

**Quality-first VRAM reduction.** oLLM prefers strategies that preserve full-precision behavior as long as possible and only introduces more aggressive compression techniques when they can be justified by real accuracy and distortion tradeoffs.

**Truthful benchmarking and inspection.** The runtime should expose what plan it chose and why, so optimization work can be measured, compared, and debugged instead of guessed at.

**Local-first compatibility.** The headless server mode exists to maximize soak against familiar API contracts, especially OpenAI-compatible ones, without turning oLLM into a cloud dependency story.
