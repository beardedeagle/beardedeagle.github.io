---
title: "devlocal, Part 2: Agents as Tenants"
summary: "Persistent identity, ephemeral execution. AI agents as first-class users without trusting them: sandboxed runs, credentials that die with the task, one model gateway, and evidence for every action."
description: "devlocal Part 2: the agent runtime. Ephemeral sandboxed agent runs with persistent identities, per-run credentials, a provider- and harness-agnostic model gateway, layered containment, and end-to-end observability."
date: 2026-11-02
series: devlocal
part: 2
project: /projects/devlocal/
topics:
  - Kubernetes
  - kagent
  - gVisor
  - LiteLLM
  - Citadel
  - OpenTelemetry
  - Vault PKI
---

## The Problem

In devlocal, agents are engineers. They're hired through a custom Elixir front office, onboarded across the lab's services, and handed issues to work through, exactly like anyone else on the team. They commit code, send mail, file tickets and spend money on model calls, under identities with real rights.

They also run code nobody here wrote, steered by input nobody here fully controls. Trust them like employees and the first prompt injection owns the environment. Treat them like stateless functions and they lose everything that makes an engineer useful: history, context, ownership.

devlocal splits the two. **The agent's identity persists. Its runtime doesn't.** Every agent has a durable SSO account, mailbox, forge account and home directory. Every task runs in a fresh, sandboxed pod with a fresh certificate and a fresh model key, and all three are gone when the task ends.

## Where Agents Run

Agents run as ephemeral pods in a single-node Kubernetes cluster inside their own VM on the workload hypervisor described in [Part 1](/musings/devlocal-the-boundary/). Every part of that placement is deliberate.

- **Not on the GPU nodes.** The GPU nodes hold model weights and inference engines and nothing else. Their memory belongs to models, and a sandbox escape lands nowhere near the hardware that serves every model.
- **Not near the root of trust.** Vault, the PKI and SSO live on a different physical machine. An escape that defeats every layer below still lands on a box without Vault.
- **Behind the firewall like everything else.** The agents VM, the model gateway, the dispatcher and the egress broker each sit on their own VLAN. Every call an agent makes crosses the firewall, gets logged, and is copied to the network sensor.
- **One node, not three.** No quorum, no pod traffic between nodes crossing a wire, and an x86 runtime where image availability and sandbox-runtime support are settled questions.

## Architecture

{% mermaid %}
flowchart TB
    ME["Front office · Elixir<br/>hires engineers · assigns issues"] --> DSP["Dispatcher VM<br/>mints run credentials · drives the cluster"]
    DSP -->|"namespaced role · mTLS"| K8S["Agents VM · single-node cluster"]
    DSP -->|"sign run cert under the agent's own role"| VLT["Vault PKI<br/>authority host"]
    DSP -->|"mint and revoke run key"| GW["Model gateway VM<br/>aliases · budgets · spend · provider keys"]
    subgraph POD["Agent container · gVisor sandbox"]
        H["Harness<br/>runs inside Citadel · no secrets"] -->|"every outbound call"| CIT["Citadel<br/>holds run cert + run key"]
    end
    K8S --> POD
    CIT -->|"agent listener · mTLS + SSO match"| ING["Ingress VM"]
    ING -->|"inference routes only"| GW
    ING --> SVC["Forge · mail · memory · ITSM"]
    CIT -->|"allowlisted domains only"| BRK["Egress broker VM · Citadel"]
    BRK -->|"HTTPS"| NET["Internet"]
    GW -->|"mTLS"| GPU["GPU inference gateways"]
    GW -->|"HTTPS · opt-in"| CLOUD["Cloud providers"]
    style ME fill:#1a2332,stroke:#475569,color:#e2e8f0
    style DSP fill:#1e3a5f,stroke:#22d3ee,color:#e2e8f0
    style K8S fill:#1e3a5f,stroke:#f59e0b,color:#e2e8f0
    style VLT fill:#1e3a5f,stroke:#10b981,color:#e2e8f0
    style GW fill:#1e3a5f,stroke:#22d3ee,color:#e2e8f0
    style H fill:#1e3a5f,stroke:#f59e0b,color:#e2e8f0
    style CIT fill:#1e3a5f,stroke:#10b981,color:#e2e8f0
    style ING fill:#1e3a5f,stroke:#22d3ee,color:#e2e8f0
    style SVC fill:#1a2332,stroke:#475569,color:#e2e8f0
    style BRK fill:#1e3a5f,stroke:#f59e0b,color:#e2e8f0
    style NET fill:#1a2332,stroke:#475569,color:#e2e8f0
    style GPU fill:#1a2332,stroke:#475569,color:#e2e8f0
    style CLOUD fill:#1a2332,stroke:#475569,color:#e2e8f0
{% endmermaid %}

Each layer has one job, and none of them is trusted to enforce the boundary on its own:

- **kagent** decides *when* an agent exists and what it may touch. Agents are custom resources, sandboxed agents run under agent-sandbox's lifecycle with warm pools, agents speak A2A, and any tool call can require a person's approval before it runs.
- **A harness profile** decides *how* the agent thinks. LiteAgents puts one API over several agent loops: the Claude Agent SDK, Codex, OpenCode, Deep Agents and Pydantic AI.
- **The model gateway** (LiteLLM) decides *which model* answers and who pays.
- **The sandbox, admission policy, node rules, firewall and Citadel** enforce the boundary.

## The Layers Around an Agent Run

A flow passes every layer it touches. No single layer is the boundary, because agent code is code nobody here wrote.

| Layer | Control | What it stops |
| --- | --- | --- |
| Process | kagent's in-pod sandbox | Writes outside the workdir and scratch space; egress to unlisted domains |
| Kernel | gVisor RuntimeClass | Agent code reaching the host kernel directly. A user-space kernel sits in between. |
| Pod | Hardened spec | No service-account token, read-only root, non-root, every capability dropped, no secret reachable from the harness |
| Admission | Cluster-wide validating policy | Host networking, host PID or IPC, host paths, privileged pods, a missing sandbox RuntimeClass, images from outside the lab registry, provider URLs or keys in the spec |
| Node | K rules, below | Pods reaching the node, the control plane, the hypervisor or the storage network |
| Network | Firewall, per pod | Anything except the agent listener and the egress broker. The pod network is routed, not masqueraded, so the firewall sees every pod's own address. |
| Boundary | Citadel's Linux backend, in the container and on the node | The harness touching a credential, runs starting while Citadel is unhealthy, egress outside the agent's allowlist, and blind spots inside the node |

| Rule | What the agents node enforces |
| --- | --- |
| K01 | Pod traffic forwards only out the node's own VLAN, toward the firewall, with one in-node exception: the cluster DNS service. Pods never reach the node's management listeners (kubelet, API server, etcd, SSH) or the hypervisor. |
| K02 | Each pod veth's source address is pinned to that pod. Anything else is dropped. |
| K03 | No masquerade for the pod network. The firewall writes rules per pod, not per node. |
| K04 | Admission denies host networking, host PID and IPC, host paths and privileged pods cluster-wide, with one pinned exception for the network plugin. Agent pods must name the gVisor RuntimeClass. |
| K05 | No pod starts unless Citadel is running and answering. Its admission hook fails closed. |

The cluster's control plane gets the same treatment. kagent's tool server runs with read-only RBAC instead of the cluster-admin binding its chart defaults to, and nothing outside cluster bootstrap holds cluster-admin. A service mesh supplies mTLS and deny-by-default between pods, because several in-cluster hops are plain HTTP out of the box.

## Credentials That Live as Long as the Task

Agents are credential-less. Citadel runs inside each agent's container and the harness runs inside Citadel, so secrets never make it past Citadel. No long-lived secret ever enters the container, and the run's short-lived ones live only in Citadel, below the harness.

- **Per-run model keys.** The dispatcher mints a model-gateway key for each run, scoped to the aliases that agent may use, with a budget, an expiry, and the agent and task IDs as metadata. Teardown deletes it. Expiry is the backstop.
- **Per-run certificates.** Citadel generates the key and CSR inside the container, and its node component records the CSR as a request object in the agent's namespace under its own narrowly scoped service account. The agent pod still has no token and no route out. The dispatcher, which only ever initiates connections, collects the request over the cluster API, has Vault sign it under that agent's own PKI role, which can issue that agent's name and nothing else, with a lifetime no longer than the run, and writes the certificate back the same way. The private key never leaves the container, and no CA key ever sits in the cluster beside agent code.
- **Two checks at the door.** The agent listener requires the run's client certificate *and* an SSO session, and the certificate's agent name must equal the user SSO returns. A stolen session is useless with another agent's certificate, and the reverse.
- **Secrets never make it past Citadel.** The run's key and certificate exist only inside Citadel. The harness has no path to them, no volume that holds them and no service-account token. Every outbound call the harness makes passes through Citadel, which attaches the run's identity on the way out (exception E11). The harness gets the access, never the credential.
- **The dispatcher stands apart from the gateway.** The dispatcher holds gateway admin rights, Vault signing rights and a namespaced cluster role. It lives in its own VM, so a compromised model gateway doesn't hand over the power to mint runs.
- **Admin routes are closed to agents.** Agent model calls reach the gateway only through the ingress listener's model route, which exposes inference endpoints and nothing else. Key management, spend and admin routes return not-found. There is no direct path from agents to the gateway.

## Provider- and Harness-Agnostic

Agents name a model **alias**, never a provider. They name a harness in a **profile**, never in code. Both indirections live outside the agent's trust boundary, so swapping either one is a config change, not a rebuild, and it never moves the security boundary.

| Alias | Backed by | Fallback | Data |
| --- | --- | --- | --- |
| `local-general` | General model on all three GPU nodes | The other GPU nodes | Stays in the lab |
| `local-coder` | Coding model on all three GPU nodes | The other GPU nodes | Stays in the lab |
| `embed-local` | Local embedding model | None | Stays in the lab |
| `cloud-frontier` | A cloud provider | A second provider | Leaves the lab, opt-in per key |

**No silent local-to-cloud fallback.** It's the same rule as "no silent plaintext fallback," applied to data residency. No local alias lists a cloud fallback, and an agent reaches a cloud model only when its run key names that alias. Load balancing, retries and cooldowns run across the three local engines, and the gateway reaches each one through an egress sidecar that presents its client certificate to that node's mTLS inference gateway.

Every agent image, whatever its harness, honors a six-point contract, and admission checks it before a pod runs:

1. Serve A2A on the port the controller expects, and nothing else inbound.
2. Send model calls only to the local endpoint Citadel serves. Never hold a provider URL or key.
3. Export OpenTelemetry, propagate trace context, and tag every span with agent, task and harness.
4. Write only to the workdir, scratch space and the agent's own home.
5. Hold no secret in environment, files or logs.
6. Exit cleanly on SIGTERM within the grace period.

That leaves three ways to define an agent. A declarative kagent agent needs no image. A LiteAgents image gets harness choice. Any image that speaks A2A and honors the contract is the escape hatch for a harness nothing else covers.

## The Life of a Run

{% mermaid %}
sequenceDiagram
    participant R as Front office
    participant D as Dispatcher
    participant G as Model gateway
    participant V as Vault
    participant K as kagent + sandbox
    participant P as Agent pod
    participant M as Me
    R->>D: Issue assigned to an engineer
    D->>G: Mint run key (aliases, budget, expiry)
    D->>K: Create SandboxAgent (harness profile, allowlist)
    K->>P: Claim warm pod under gVisor
    P->>K: Citadel records the CSR as a request object
    D->>K: Collect the CSR over the cluster API
    D->>V: Sign under this agent's role, TTL ≤ run
    D->>K: Write the certificate back for Citadel
    K->>P: Task over A2A
    P->>G: Model calls via Citadel and ingress
    P-->>M: Tool needs approval
    M-->>P: Approve or reject
    P->>P: Save outputs to forge, mail or memory
    D->>K: Delete SandboxAgent
    D->>G: Revoke run key
{% endmermaid %}

Only the task itself and saving its outputs run agent code. Everything a task produces lands in the forge, mail or memory before teardown, because the controller's session state is disposable by design. If the dispatcher dies mid-run, two backstops still end the run: the sandbox is deleted at its scheduled time, and the run key expires on its own. A failed run is retried from its original request, never resumed from a half-trusted state.

Agent homes are per-agent encrypted volumes, each its own persistent volume. Admission rejects any pod that names another agent's claim, and the hypervisor backs the volumes up to primary storage over the encrypted backup path.

## Egress

Agents have no direct internet. Neither does the agents node.

- Agent pods reach the internet only through **Citadel's egress broker**, in its own VM outside the agents VM. The broker authenticates the run's certificate, applies *that agent's* domain allowlist, and only then goes out over HTTPS.
- The allowlist is enforced outside the sandbox. A pod whose in-pod allowlist is opened to everything is still refused by the broker for an unlisted domain.
- The agents node uses the same broker under its own node certificate, with a mirror-only policy for distro updates, and pulls images only from the lab registry. The node never reaches the agent listener.
- Pods resolve names through cluster DNS, which forwards upstream over TLS only. Those host-local plaintext lookups are a named exception (E03) and are never copied to the sensor.

## Observability

**The task ID is the join key.** It rides in the A2A request, every span's resource attributes, the run key's metadata and the gateway's spend rows. One query by task ID returns the run's trace, logs, token counts and cost.

| Signal | Producer | Store |
| --- | --- | --- |
| Agent-run spans | kagent | Trace store (Tempo) |
| Harness spans | A thin A2A shim around every harness call and tool call | Trace store |
| Model-call spans | The gateway's OpenTelemetry output: model, provider, tokens, cost, finish reason | Trace store |
| Token and cost ledger | The model gateway | Its database, the authoritative bill, read through a read-only role |
| Metrics | Gateway, collectors, kubelet, node exporters | Prometheus |
| Logs | Pods, kagent, the gateway | Loki, labelled by agent, task and harness |
| Approvals and task states | kagent's task store | Every decision recorded with its task |

**Prompt content stays out by default.** Message capture is off. A single run key can opt in for debugging, into a short-retention tenant, by explicit operator choice. Agents never hold secrets, so content can't carry one, but it can carry source code and mail, which is why capture is opt-in.

**Two records, two jobs.** Every hop is mTLS, so the network sensor sees metadata only. The telemetry pipeline is the record of what an agent *did*. The sensor, fed in-node copies by Citadel's span component, is the record that *nothing else talked*.

## Supply Chain

The agent ecosystem moves fast, so everything at its core is pinned: images by digest, the harness library by commit, and every Python dependency from a hash-locked file. Admission accepts images from the lab registry only.

That discipline caught a real trap: **the harness library's package name on PyPI belongs to an unrelated project** with the same top-level module name, while the upstream docs say to `pip install` it by that name. Follow the docs, and you run someone else's code. Images install it only from a pinned git commit, and a test fails the build if the lock file ever refers to it by bare name:

```sh
# Permit (agent image): the installed package came from the pinned upstream commit
python -I -c "import importlib.metadata as m, json; \
  print(json.loads(m.distribution('liteagents').read_text('direct_url.json'))['vcs_info']['commit_id'])"
# expect the pinned commit

# Deny (repo): no bare-name requirement exists
grep -nE '^liteagents([=<>~ ]|$)' requirements.lock
# expect no output
```

## Gate 5 · Agent Containment

The agent runtime is held to this gate on the live system. Every permit has a matching deny.

| Check | Permit | Deny |
| --- | --- | --- |
| The firewall tells pods from the node | Citadel in a pod reaches the agent listener | The node itself is blocked at the listener |
| Egress only through the broker | A listed domain answers normally | An unlisted domain is refused by the broker even with the in-pod allowlist wide open; direct-to-IP egress fails from the pod and from the node |
| Models only through the listener | The inference route answers | Admin routes return not-found; a pod can't open a connection to the gateway VM |
| Certificates name only their holder | Vault signs an agent's CSR under its own role | That role refuses another agent's name; a matching certificate with another agent's session gets a 403 |
| The harness holds nothing | The harness's calls leave through Citadel with the run's identity attached | No run key or certificate is readable from the harness, no service-account token exists, and no environment variable name looks like a credential |
| The node is out of reach | The dispatcher may create sandboxed agents | Pods can't reach the kubelet, API server, etcd, the hypervisor or the storage network |
| Admission holds | A conforming pod is admitted | Host networking, host paths, privilege, a missing RuntimeClass and outside images are all rejected |
| Citadel fails closed | Pods start with Citadel running | With Citadel stopped, a new pod never becomes ready |
| Runs are ephemeral | After a run, no pod, sandbox or key for that task remains | With the dispatcher stopped mid-run, the sandbox is still reaped on schedule and the key stops working at expiry |
| No prompt content in traces | One trace per task holds controller, harness and gateway spans | A search for message-content attributes returns nothing |

Citadel's own Linux test suite covers the rest: an escape corpus run against the pinned sandbox and kernel leaves no canary on the node, resource bombs stay inside pod limits, a pod can't silence its own span feed, and teardown leaves no process, veth, mount or key behind.

## Key Design Decisions

**Credential-less agents.** Citadel sits between the harness and everything it talks to, inside the same container. Secrets never make it past Citadel, so a fully compromised harness has nothing to exfiltrate but access that ends with the run.

**Identity is durable, execution is disposable.** What an agent *is* lives in SSO, mail, the forge and its home volume. What an agent *runs* lives in a pod that exists for one task and is gone afterward, credentials included.

**Defense in depth around code nobody here wrote.** A process sandbox, a user-space kernel, a hardened pod spec, admission policy, node rules, per-pod firewall rules and Citadel each stop something the others don't. No single layer is trusted to be the boundary.

**One gateway between agents and every model.** Provider keys, routing, budgets and spend live in one place that agents can call but never administer. Swapping a provider or a harness is configuration, never a security change.

**The firewall knows which agent is talking.** A routed pod network with pinned source addresses gives every agent run its own address on the wire, so firewall rules, logs and sensor data name the run, not the node.

**Egress is brokered outside the sandbox.** The allowlist that matters is enforced by Citadel on a different VM, where nothing inside the agent's pod can reach it.

**Every run leaves evidence.** Traces, logs, spend and approvals join on the task ID, and the sensor independently records everything that crossed a wire.

## Accepted Trade-offs

- **One box, one blast radius.** Services and agents share a hypervisor, separated by VMs, VLANs and the firewall. An escape through gVisor, the VM's kernel and the hypervisor reaches the service VMs, though never Vault. In return, the design needs no new hardware.
- **Memory is the binding limit.** Pods hold memory only while a task runs, and warm pools trade a little idle memory for fast starts. The agents VM's CPU and memory are capped so an agent's build can't starve the forge or the log store.
- **gVisor costs speed on file-heavy builds.** That's the price of a user-space kernel between agent code and the host, and the right price for code nobody here wrote.

