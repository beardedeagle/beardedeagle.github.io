---
layout: layouts/project.njk
title: devlocal
tagline: "Self-hosted, zero-inbound dev-services lab where AI agents are first-class users. Trust-tiered network, encryption on every hop, ephemeral contained agents, and a paired deny test for every permit."
description: "devlocal: a security-first dev-services lab where AI agents work as first-class users, built on trust zones, mTLS everywhere, and contained ephemeral agents."
status: upcoming
order: 1.5
stack:
  - OPNsense
  - Vault PKI
  - Authentik
  - Kubernetes
  - gVisor
  - Security Onion
  - ZFS
---

## The Problem

Most homelabs and most agent platforms make the same mistake: they trust the inside. Once something is past the edge it can talk to everything, read whatever credentials are lying around, and leave nothing behind that anyone would notice.

That posture collapses the moment agents become real users. An agent that clones repositories, sends mail, files tickets and spends money on model calls is running code nobody here wrote, under an identity with real rights. Prompt discipline is not a security boundary. Lateral movement matters as much as the front door, and so does what an agent can carry out of it.

devlocal exists because a dev environment for agents has to assume compromise everywhere, the agents included, and still keep the root of trust out of reach.

## Approach

devlocal is a self-hosted stack of developer services: source control, gists, a package registry, mail, long-term agent memory, ticketing and full observability. AI agents are first-class tenants of it. Every agent has its own SSO identity, mailbox, forge account and certificates, and does its work in ephemeral, sandboxed runs.

The whole lab is built on a handful of rules that hold everywhere, not just at the perimeter:

- **Zero inbound.** Remote access rides a self-hosted WireGuard tailnet coordinated off-site. Nothing on the internet can open a connection into the lab.
- **Encryption on every hop.** Mutual TLS between services, DNS over TLS, NTS for time, NFS over RPC-with-TLS, LUKS2 under ZFS native encryption at rest. Anything that cannot be encrypted is a *named exception* with written containment, never a silent plaintext fallback.
- **Trust tiers, not a flat LAN.** The root of trust lives alone on its own host. Every service group gets its own VM and VLAN, and groups meet only through the firewall.
- **Independent denial.** Code nobody here wrote, CI jobs and agents alike, passes through several filters that each deny on their own.
- **Evidence over assertion.** Every permit rule has a paired deny test written as an exact command, and every guarantee that depends on hardware or client behavior is held to an acceptance gate on the live system.

## Architecture

{% mermaid %}
flowchart TB
    DEV["My devices<br/>tailnet clients"] -->|"WireGuard"| EDGE["Edge box · DMZ<br/>edge proxy only, no secrets"]
    CTRL["Off-site tailnet<br/>coordinator + relay"] -.->|"edge dials out"| EDGE
    EDGE -->|"mTLS · one firewall rule"| FW["Lab firewall · OPNsense<br/>zones · default deny · logged"]
    FW --> ING["Ingress VM<br/>SSO gate · route per group"]
    ING --> SVC["Service-group VMs<br/>forge · memory · mail · ITSM · observability"]
    ING --> GW["Model gateway VM<br/>only path to any model"]
    AUTH["Authority host<br/>Vault · PKI · SSO · DNS-over-TLS"] -.->|"certs and policy"| ING
    AG["Agents VM<br/>ephemeral sandboxed pods"] -->|"agent listener · mTLS"| ING
    AG -->|"allowlisted egress"| BRK["Egress broker VM<br/>Citadel"]
    GW -->|"mTLS"| GPU["GPU nodes<br/>inference only"]
    GPU --- STO["Primary + backup storage<br/>encrypted at rest and in flight"]
    CI["CI enclave<br/>behind its own firewall"] -->|"mTLS"| FW
    FW -.->|"mirror copies"| SO["Network sensor<br/>Zeek · Suricata · packet capture"]
    style DEV fill:#1a2332,stroke:#475569,color:#e2e8f0
    style CTRL fill:#1a2332,stroke:#475569,color:#e2e8f0
    style EDGE fill:#1e3a5f,stroke:#f59e0b,color:#e2e8f0
    style FW fill:#1e3a5f,stroke:#22d3ee,color:#e2e8f0
    style ING fill:#1e3a5f,stroke:#22d3ee,color:#e2e8f0
    style SVC fill:#1e3a5f,stroke:#22d3ee,color:#e2e8f0
    style GW fill:#1e3a5f,stroke:#22d3ee,color:#e2e8f0
    style AUTH fill:#1e3a5f,stroke:#10b981,color:#e2e8f0
    style AG fill:#1e3a5f,stroke:#f59e0b,color:#e2e8f0
    style BRK fill:#1e3a5f,stroke:#f59e0b,color:#e2e8f0
    style GPU fill:#1a2332,stroke:#475569,color:#e2e8f0
    style STO fill:#1a2332,stroke:#475569,color:#e2e8f0
    style CI fill:#1e3a5f,stroke:#f59e0b,color:#e2e8f0
    style SO fill:#1a2332,stroke:#475569,color:#e2e8f0
{% endmermaid %}

Amber marks every place untrusted code or untrusted networks meet the lab: the edge, the agents, the egress broker and CI. Green marks the root of trust. Every arrow is an authenticated, encrypted hop, and every hop between VLANs passes through the firewall.

## Key Design Decisions

**The root of trust runs nothing else.** Vault, the PKI and SSO share a host with no applications, no log receivers, no container socket next to Vault, and no leg on the storage network. It runs no in-host span either, so its switch port stays an untagged access port. The most sensitive host in the lab cannot put a tagged frame on the wire.

**Agents are credential-less.** Citadel runs inside each agent's container and the harness runs inside Citadel, so secrets never make it past Citadel. Each run gets a fresh pod, a certificate signed for that agent alone and a model key with its own budget. Citadel holds them, the harness never sees them, and all of them are revoked at teardown and expire on their own if teardown never happens.

**One model gateway. GPUs do inference and nothing else.** The GPU nodes hold model weights and inference engines, never agent code. Agents and services reach models only through a single gateway that owns provider keys, routing, budgets and spend. Local models never silently fall back to a cloud provider.

**East/west is visible, not assumed.** Switch mirrors cover everything that crosses a wire. A span component inside every VM copies container-to-container traffic to the sensor, with every known plaintext exception filtered out before anything leaves the host.

**Recovery never depends on what it recovers.** A break-glass path reaches every management interface without DNS, SSO, Vault or the tailnet. The keys and LUKS headers that unlock storage live in offline escrow, because Vault's own backups live on that storage.

**Every guarantee has a gate.** MACsec offload on the GPU interconnect, capture-port isolation, encrypted DNS and time on every client, and a full restore from escrow are each defined as an acceptance gate with paired permit and deny tests, run on the live system rather than argued on paper.

## The Write-ups

- **[Part 1 · The Boundary](/projects/devlocal/boundary/)**: the network. Trust zones, the single way in, layered rule sets, encryption on every hop and its named exceptions, the CI enclave, storage that treats its own backup host as hostile, and visibility inside hosts.
- **[Part 2 · Agents as Tenants](/projects/devlocal/agents/)**: the agent runtime. Persistent identity with ephemeral execution, the layers around every agent run, credentials that live only as long as the task, a provider- and harness-agnostic model gateway, and the evidence every run leaves behind.

## Role in the Stack

[Citadel](/projects/citadel/) is devlocal's containment boundary for agents. Its Linux backend wraps the harness inside every agent container and holds the run's credentials so the harness never touches them, decides what an agent run can reach, refuses to start a run when it isn't healthy, brokers each run's internet egress against that agent's own allowlist, and supplies the span component that makes in-host traffic visible to the sensor. devlocal is where Citadel's model of execution-layer enforcement meets a real multi-tenant agent environment.
