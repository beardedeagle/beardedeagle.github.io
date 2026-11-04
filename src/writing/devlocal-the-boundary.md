---
title: "devlocal, Part 1: The Boundary"
summary: "Trust zones, one way in, encryption on every hop, and rule sets that each deny on their own. The devlocal network, built to contain north/south and east/west threats alike."
description: "devlocal Part 1: the network boundary. Trust zones, zero-inbound access, layered rule sets, named encryption exceptions, a CI enclave, encrypted storage, and in-host visibility for the sensor."
date: 2026-11-02
series: devlocal
part: 1
project: /projects/devlocal/
topics:
  - OPNsense
  - 802.1Q
  - WireGuard
  - mTLS
  - NTS
  - DNS-over-TLS
  - MACsec
  - Security Onion
---

## The Problem

A perimeter is one control. Behind it, most networks are flat: every host can reach every other host, the root of trust shares a kernel with the applications, and the security sensor sees only what crosses a cable. Defend north/south and ignore east/west, and the first compromised service becomes a staging point for everything else.

The devlocal network is built so that no single compromise, at the edge, in a service, in CI or in an agent, can reach the root of trust or move sideways without crossing a filter that logs it.

## Threat Model

Every control on this page exists because of at least one of these adversaries.

| Adversary | What they want | What stops them |
| --- | --- | --- |
| Internet attacker | A way in | Zero inbound. The only path in is a tailnet the lab dials out to, followed by SSO. |
| Compromised edge host | A route to backends or secrets | The edge holds no secrets and reaches exactly one listener, over mTLS, through one firewall rule. |
| Compromised tailnet coordinator | A rogue node, or impersonation of the edge | SSO doesn't depend on the coordinator, and clients verify the edge's certificate. A rogue node gets a login page, not a service. |
| Malicious CI job | Lateral movement, exfiltration, persistence | Three independent filters, hosts that only jail, and HTTPS-only egress with private ranges denied first. |
| Compromised agent | Credentials, other agents, the root of trust | [Part 2](/writing/devlocal-agents-as-tenants/). Nothing to steal, nowhere to go, and evidence of every attempt. |
| Compromised service | An east/west pivot toward Vault | One VM and VLAN per service group, every hop through the firewall, certificates that name only their holder. |

Two risks are accepted deliberately. Root on a single host is game over *for that host*, and the design's job is to keep it from spreading, not to pretend it can't happen. Copies a host produces for the sensor are trusted only as far as that host, which is why switch mirrors remain the independent record of traffic between hosts.

## Five Enforcement Layers

Each layer answers a different question. A flow passes every layer it touches.

| Layer | Question | Enforced by |
| --- | --- | --- |
| Zone | Which host may reach which host, and how | The lab firewall (OPNsense): default deny, every denial logged. A second, independent firewall wraps CI. |
| VLAN | Which layer-2 segment a port belongs to | 802.1Q on switches that never route. Tagged-only trunks, an unused native VLAN, ingress filtering. |
| Host | What a host accepts and forwards | nftables and host firewalls. Forwarding between interfaces stays off; hypervisors pin every VM's MAC and IP. |
| Container | Which workloads inside a host can talk | Directional Docker networks: per-service ingress networks, internal-only core networks, narrow metrics networks. |
| Identity | Who is calling, and what they may do | Vault PKI for mTLS on every persistent hop, AppRole for secrets, Authentik for SSO and authorization. |

## Physical Shape and Trust Zones

{% mermaid %}
flowchart TB
    UP["Uplink · one 6 GHz wireless bridge<br/>treated as untrusted WAN"] --> FW["Lab firewall · OPNsense<br/>routes and filters every zone"]
    FW --> DMZSW["DMZ switch<br/>physically separate"]
    DMZSW --> EDGE["Edge box<br/>bonded 2.5G pair · edge proxy"]
    FW --> PSW["Private switch · 2.5G<br/>tagged trunks, per-port isolation"]
    PSW --> AUTH["Authority host<br/>Vault · PKI · SSO · DNS front"]
    PSW --> WL["Workload host · KVM<br/>one VM per service group"]
    PSW --> CIFW["CI firewall · OPNsense<br/>second, independent filter"]
    CIFW --> CIX["x86 CI host<br/>Linux + Windows runner VMs"]
    CIFW --> CIM["Apple Silicon CI host<br/>ephemeral macOS VMs"]
    PSW --> MGMT["Management plane<br/>BMCs · switch UIs · KVM console"]
    PSW -->|"10G uplink"| CSW["Cluster switch · 10G"]
    CSW --> GPU["3 GPU nodes<br/>inference only"]
    GPU ---|"200G ring · RDMA over MACsec"| GPU
    CSW --> PRI["Primary storage<br/>encrypted pool"]
    CSW --> BAK["Backup storage<br/>pulls ciphertext only"]
    DMZSW -.->|"mirror"| SO["Sensor · Security Onion<br/>receive-only capture links"]
    PSW -.->|"mirror"| SO
    CSW -.->|"mirror"| SO
    style UP fill:#1a2332,stroke:#475569,color:#e2e8f0
    style FW fill:#1e3a5f,stroke:#22d3ee,color:#e2e8f0
    style CIFW fill:#1e3a5f,stroke:#22d3ee,color:#e2e8f0
    style DMZSW fill:#1e3a5f,stroke:#f59e0b,color:#e2e8f0
    style EDGE fill:#1e3a5f,stroke:#f59e0b,color:#e2e8f0
    style PSW fill:#1a2332,stroke:#475569,color:#e2e8f0
    style CSW fill:#1a2332,stroke:#475569,color:#e2e8f0
    style AUTH fill:#1e3a5f,stroke:#10b981,color:#e2e8f0
    style WL fill:#1e3a5f,stroke:#22d3ee,color:#e2e8f0
    style CIX fill:#1e3a5f,stroke:#f59e0b,color:#e2e8f0
    style CIM fill:#1e3a5f,stroke:#f59e0b,color:#e2e8f0
    style MGMT fill:#1a2332,stroke:#475569,color:#e2e8f0
    style GPU fill:#1a2332,stroke:#475569,color:#e2e8f0
    style PRI fill:#1a2332,stroke:#475569,color:#e2e8f0
    style BAK fill:#1a2332,stroke:#475569,color:#e2e8f0
    style SO fill:#1a2332,stroke:#475569,color:#e2e8f0
{% endmermaid %}

The DMZ and the private side never share a switch; they meet only inside the firewall. The cluster tier hangs off the private switch on a single 10G uplink, so bulk traffic between GPU nodes and storage never touches the firewall. Every lab host is wired-only. A GPU node or server left on house Wi-Fi would bridge the house into its zone around the firewall, so built-in radios are off and stay off across reboots.

| Zone | Who lives there | What may come in |
| --- | --- | --- |
| DMZ | The edge box and its switch's management | Nothing. The edge only dials out. |
| Authority | Vault, PKI and certificate push, Authentik, the DNS-over-TLS front | SSO checks from ingress, secret fetches from named VMs, DNS from the firewall, break-glass SSH. Nothing else. |
| Ingress | The private reverse proxy, the agent listener and the agent egress broker | The edge proxy and agent pods; the agents node reaches the broker only, for distro mirrors, and never the agent listener. |
| Service groups | Forge (git, gists, package registry), memory, mail, ITSM, observability, one VLAN each | Ingress only, plus named scrapes, log pushes, and CI runners to the forge. |
| Model gateway | The model gateway and its database | Ingress, the memory service and the dispatcher. |
| Agent control | The agent dispatcher | Nothing. It only starts connections. |
| Agents | The agents VM node and a routed pod network behind it | The cluster API from the dispatcher alone, the UI through ingress. Pods accept nothing. |
| Workload management | The hypervisor itself | Break-glass SSH, certificate push, metrics scrapes. |
| Cluster | GPU nodes and storage | Nothing from the DMZ. Bulk traffic stays on layer 2. |
| Management | BMCs, switch UIs, the KVM console, the sensor's UI | The break-glass path only. No internet in either direction. |
| CI link and enclave | The CI firewall and the CI hosts behind it | Nothing. Runners only dial out. |
| GPU ring | Point-to-point GPU interconnect | Not routed at all. RDMA and collectives only, over MACsec. |

IPv6 is disabled across the lab zones. The firewall sends no router advertisements there, hosts disable it, and container runtimes run without it. The tailnet's own IPv6 lives inside WireGuard and is unaffected.

## The Only Way In

{% mermaid %}
sequenceDiagram
    participant D as My device
    participant C as Tailnet coordinator (off-site)
    participant E as Edge proxy (DMZ)
    participant F as Lab firewall
    participant I as Private proxy (ingress VM)
    participant A as Authentik
    participant S as Service gateway
    E->>C: Dials out for keys (TLS)
    D->>C: Gets keys and ACLs (TLS)
    D->>E: WireGuard, direct or via relay
    E->>F: mTLS with edge client cert
    F->>I: One permitted rule (X03)
    I->>A: forward_auth over mTLS
    A-->>I: Allowed user identity
    I->>S: mTLS on that group's route
{% endmermaid %}

Nothing enters the house unsolicited. The edge box dials out to an off-site coordinator (Headscale, with its own relay) for keys and NAT-traverses for WireGuard, falling back to the relay, which only ever carries ciphertext. House devices take the same path. There is no LAN shortcut.

The edge holds no Vault credential and never opens a connection to Vault. Its short-lived certificates are issued on the private side and pushed to it over SSH with a forced command. Its single upstream is the private proxy, which requires the edge's client certificate, strips any identity headers a client supplies, and trusts only what SSO answers.

**A compromised coordinator isn't enough.** A rogue coordinator can add a node to the tailnet, and the edge will forward that node's requests, because the edge's certificate proves a request came *through the edge*, not *which device* sent it. Coordinator ACLs don't count against this threat; a compromised coordinator writes them. SSO does, because it doesn't depend on the coordinator. And when a rogue coordinator tries to stand in for the edge, the device's TLS check of the edge's certificate keeps it from ever becoming a readable interception.

## Trust Tiers Inside the Private Zone

The private side is not one flat network. It is split by trust tier across two identical hosts, so a compromised application never shares a kernel with the root of trust.

**The authority host** runs Vault, Authentik and its database, the PKI with its CSR collector and certificate push, the DNS-over-TLS front, and its own encrypted backups. Nothing else. One interface, one access port. These mini PCs have no ECC memory, so a unit holds the root of trust only after it passes a fitness gate: repeated memory tests and a multi-day soak with zero kernel memory faults. Its database runs with data checksums on, and every retained Vault snapshot generation is restore-tested, not just the newest.

**The workload host** is a KVM hypervisor that only jails. Each service group gets its own VM, VLAN and bridge. No bridge has an address, forwarding is off, and the host's only address lives on its own management VLAN. Two VMs on the same box meet only through the firewall, which logs the hop, and the switch mirror copies it to the sensor.

| Rule | What the hypervisor enforces, below anything a guest can change |
| --- | --- |
| W01 | Each VM tap's source MAC and IP are pinned. Anything else is dropped and logged. |
| W02 | Every tap is an isolated bridge port, and tap-to-tap frames are dropped as well. No VM reaches another at layer 2. |
| W03 | On the cluster bridge, only the model gateway's egress network may send, and only to the GPU nodes' mTLS inference gateways. |
| W04 | On the copy bridge, each VM may only *send* encapsulated span copies from its pinned span MAC. Nothing is ever delivered *to* a VM there. |
| W05 | VMs cannot reach the host. No bridge has an address, and IPv6 is off, so there is no link-local address for a guest to find. |
| W06 | Host SSH answers only the break-glass path and the certificate push. |
| W07 | The host's own traffic leaves only toward the firewall: DNS over TLS, NTS, logs, backups and package updates. |

VMs are cloned from a template, so first boot regenerates SSH host keys and the machine ID. No two VMs share a key.

## The Rule Sets

Rules come in families, and each family is enforced by a different device. A flow that several families deny stays blocked when any single device turns permissive. Everything not listed is denied, and every denial is logged.

| Family | Enforced by | Covers |
| --- | --- | --- |
| X | The lab firewall | Forwarded traffic between zones |
| B | The lab firewall | Traffic to and from the firewall itself |
| C | The CI firewall | Everything entering or leaving the CI enclave |
| H | The x86 CI host | What its runner VMs may reach. The macOS CI host enforces the same with its own packet filter. |
| W | The workload hypervisor | Layer-2 isolation between VMs, above |
| K | The agents VM node | What agent pods may reach, in [Part 2](/writing/devlocal-agents-as-tenants/) |
| I | Layer 2 inside one zone | Flows that never touch the firewall, each tested to stay on layer 2 |

### Between zones (X)

| ID | Flow | Protocol and identity | Verdict |
| --- | --- | --- | --- |
| X01 | Edge → tailnet coordinator | TLS; node key | permit, outbound only |
| X02 | Edge ↔ tailnet peers and relay | WireGuard, matched on the client's source port, since peers' NATs choose the destination | permit, outbound only |
| X03 | Edge proxy → private proxy on the ingress VM | mTLS, edge client certificate | permit |
| X04 | Private side → edge, certificate push | SSH, pinned key, forced command | permit |
| X05, X06 | Edge logs out; edge metrics scraped from the private side | mTLS | permit |
| X08 | Any DNS that bypasses the firewall | — | deny, logged. A host that tries is misconfigured or compromised, and the log says which. |
| X09 | CI runners → internet | HTTPS only, after private, link-local, CGNAT, multicast and external DNS are denied | permit |
| X10 | Any zone → SMTP on the internet | — | deny. No external relay. |
| X11 | Break-glass → management interfaces | SSH keys, HTTPS-only UIs, IPMI restricted to its strongest cipher suite | permit, break-glass only |
| X12 | Management plane → internet | — | deny |
| X13 | Service tiers → internet for updates, image pulls and model providers | HTTPS only, from HTTPS mirrors | permit, logged. Never from agents, the agents node or the dispatcher. |
| X14 | DMZ → anything not above | — | deny, logged |
| X15 | House LAN → lab services | — | deny, logged. House devices use the tailnet like everything else. |
| X16 | CI runners → the forge's CI listener | mTLS, one certificate per runner | permit |
| X17 | Break-glass → authority host | SSH key | permit, break-glass only. Recovery while the tailnet is down. |
| X18 | CI firewall's logs → syslog receiver | Syslog over TLS, client certificate | permit |
| X19 | Ingress → Authentik, for forward_auth and the SSO UI | mTLS, proxy client certificate | permit |
| X20 | Ingress → each group's gateway, including the model gateway and the agent UI | mTLS, proxy client certificate | permit |
| X21 | Named VMs → Vault for secrets | mTLS plus AppRole, secret IDs bound to that VM's address | permit |
| X22 | Named senders → log and trace ingest | mTLS, pinned sender certificates | permit |
| X23 | Metrics → named exporters on every tier | mTLS, the scraper's certificate | permit |
| X24 | Memory service → model gateway | mTLS, egress certificate | permit |
| X25 | Agent pods → the ingress agent listener | mTLS with the run's certificate, which must match the SSO user | permit |
| X26 | SSO and alerting → mail submission | Implicit-TLS SMTP, per-service account | permit |
| X27 | Authority host → every host, certificate push | SSH, pinned push key, forced command | permit |
| X28 | Authority and workload hosts → backup target on primary storage | SFTP, per-source key, chroot; archives encrypted before they leave | permit |
| X29 | Dispatcher → the agents cluster's API | mTLS, namespaced role | permit |
| X30 | Dispatcher → model gateway, to mint and revoke run keys | mTLS, admin routes only | permit |
| X31 | Dispatcher → Vault, to sign run certificates | mTLS plus AppRole bound to the dispatcher | permit |
| X32 | Agent pods → the egress broker; the agents node → the egress broker for distro mirrors | mTLS: the run's certificate for pods (that agent's allowlist), the node certificate for the node (mirror-only policy) | permit |
| X33 | Egress broker → internet, per agent allowlist | HTTPS | permit |
| X34 | Mail → Authentik, to check users | mTLS | permit |
| X35 | Agents node → the lab registry | mTLS, node certificate | permit |

### The firewall itself (B)

| ID | Flow | Protocol and identity | Verdict |
| --- | --- | --- | --- |
| B01 | Every zone → firewall, DNS | DNS over TLS with a Vault-issued certificate. Plain DNS to the firewall is dropped and logged, so a client that falls back to plaintext fails loudly instead of quietly working. | permit |
| B02 | Every zone → firewall, time | NTS: a TLS 1.3 key exchange, then authenticated NTP | permit |
| B03, B04 | Firewall → upstream resolvers and time servers | DNS over TLS and NTS to named servers, pinned by address and name so reaching them needs no DNS | named hosts only |
| B05 | Firewall → the lab's own DNS front | DNS over TLS, Vault-issued certificate | permit |
| B06 | Firewall's logs → syslog receiver | Syslog over TLS, client certificate | permit |
| B07 | Break-glass → firewall UI and SSH | SSH keys, HTTPS | break-glass only. They answer on no other address. |
| B08 | Firewall → its update mirrors | HTTPS; packages still signature-checked | permit, logged |
| B09 | Firewall's WAN lease | DHCP (a named exception) | permit |
| B10 | Anything else to or from the firewall | — | deny, logged |
| B11 | Metrics → the firewall's exporter | mTLS | permit |

### Inside a zone, never through the firewall (I)

| ID | Flow | Transport |
| --- | --- | --- |
| I01 | Model gateway's egress sidecar → GPU inference gateways | mTLS |
| I02 | GPU nodes ↔ primary storage | NFS over RPC-with-TLS, mutual TLS required. Plaintext mounts are refused. |
| I03 | Backup storage pulls from primary | Replication over mTLS, raw encrypted sends |
| I05 | GPU ↔ GPU collectives | RDMA over MACsec |

## Encryption on Every Hop

Where an encrypted form exists, it is used: mTLS between services, HTTPS for all internet egress, DNS over TLS, NTS for time, NFS over RPC-with-TLS, syslog over TLS, HTTPS-only management UIs, IPMI restricted to its strongest cipher suite, LUKS2 under ZFS on every pool disk, and MACsec on the GPU ring. NTS authenticates time rather than hiding it. Time isn't secret. Forged time is the threat, because every certificate check downstream depends on it.

Anything that can't meet the rule gets an E-number, a reason and its containment. There is no silent fallback anywhere.

| ID | Traffic | Why it can't be encrypted | Containment |
| --- | --- | --- | --- |
| E01 | ARP, LLDP, STP, LACP, and the firewall's WAN DHCP lease | No encrypted form exists | One layer-2 segment each, carrying no secrets. Lab hosts use static addresses, so lab zones run no DHCP. |
| E02 | Plain NTP to management appliances with no NTS client | The appliance can't do better | Served only from the firewall's management address. Port isolation keeps everything else from reaching them. |
| E03 | Host-local DNS: containers and pods → the host's TLS stub | The container runtime's resolver and the cluster DNS speak only plain DNS | Never leaves the host or VM. The stub listens only on loopback and the bridge gateway, and the span never copies it. |
| E04 | NTS bootstrap on a box with no battery-backed clock | With no trustworthy date at cold start, a certificate check fails on a stale clock | Only certificate *dates* are skipped, and only until the first clock update. Chain and name checks stay on, and trust is pinned to the intended servers' CAs. |
| E05 | Windows runner VM → the vendor's update CDN | The vendor delivers update files over plain HTTP by design; discovery stays on pinned HTTPS and every file is signature- and hash-checked | Allowed from that one VM, to the vendor's update hosts only, on three separate filters. |
| E06 | Windows runner VM time | Its time service sends plain NTP outside a domain | The VM syncs from its host over a virtual network that never reaches a cable. The host itself uses NTS. |
| E07 | Gateway → app over loopback inside one network namespace | The app speaks plain HTTP | Loopback never reaches a veth, so it never leaves the namespace and is never copied. |
| E09 | Vault and SSO bootstrap on one-member host bridges | The bootstrap runs before TLS material exists | On the authority host, which runs no span. |
| E11 | Agent harness → Citadel inside one container | Harness runtimes call a plain base URL; handing them a client key would break the secret boundary | Process-local inside the container. Citadel attaches the run's identity before anything leaves it. See [Part 2](/writing/devlocal-agents-as-tenants/). |
| E12 | Kubelet health probes to pods on the same node | Probes are plain HTTP from the node's namespace | Never leaves the agents VM, hits only health paths, never copied. |

Mirror links carry copies of traffic, not a hop of their own. Every plaintext exception is filtered out before anything is copied, so the capture fabric carries only ciphertext and metadata.

## The CI Enclave

CI runs code nobody here wrote, so it lives in its own enclave behind a second, independent OPNsense firewall with its own rule set, credentials and update schedule.

- **Three filters, each denying alone.** A job's traffic passes its host's own filter, then the CI firewall's C rules, then the lab firewall's X rules. The C rules restate the CI policy instead of trusting the lab firewall's.
- **Hosts that only jail.** The x86 CI host runs a hypervisor and nothing else: a Linux runner VM and a Windows runner VM on a routed virtual network with no NAT. The macOS CI host runs ephemeral macOS VMs cloned per job from golden images and deleted afterward. Neither host ever runs a job itself, and guests get no shared folders, clipboard or host sockets.
- **Lanes can't reach each other.** Each CI host has its own firewall port and subnet, so the two meet only through the CI firewall, which denies and logs anything between them. A job that escapes onto one host can't pivot to the other lane.
- **Egress is HTTPS only,** with private ranges, link-local, CGNAT, multicast and external DNS denied first, on all three filters.
- **CI can't administer its own jailer.** The CI firewall's admin port forwards nothing and stays reachable with the lab firewall powered off. The runner side answers no UI and no SSH.

**Independent denial is tested, not assumed.** Each filter is tested in isolation. One forbidden CI flow, a runner VM reaching the cluster zone for example, is temporarily permitted on the *other two* filters, and the filter under test has to deny and log it on its own. The rules are restored, and the test repeats for each of the three filters. Opening only one filter would leave two possible blockers and prove nothing about either. Two firewalls running the same software are only independent if their configs, credentials and updates are, and this test is the proof.

## Storage That Treats Its Own Backup Host as Hostile

- **Two hosts, two shelves, two power paths.** The primary server holds the main RAIDZ2 pool and serves it to the GPU nodes. A separate backup server holds the backup pool on its own disk shelf, behind its own HBA, with its own credentials.
- **Ciphertext below the filesystem.** Every pool disk is LUKS2, so the SAS paths carry only ciphertext. ZFS native encryption sits on top for per-dataset keys and raw sends.
- **Pull, never push.** The backup host *pulls* raw encrypted sends over mTLS with its own certificate and never loads the primary's ZFS keys. A compromised backup host can't read the data, and the primary holds no credentials that reach the backup.
- **Retention the primary can't touch.** The backup host keeps its own snapshot retention, so a wiped or encrypted primary can't age out the older copies. The backup shelf powers up for scheduled runs, then the pool is exported and the shelf powers down.
- **Escrow.** Vault unseal shares, LUKS keys, LUKS header backups, the disk-serial → LUKS UUID → pool map and the ZFS keys also live offline, because Vault's own backups sit on the storage those keys unlock. A key alone can't open a disk with a damaged header. Stale header backups are destroyed after every keyslot change, since an old header still opens with an old key.
- **Acceptance is a restore.** The storage tier's gate is a full restore from the backup pool to the primary, with the primary pool unavailable and every key and header taken from escrow, starting with opening the LUKS devices. A successful send proves nothing. Header restore is proven separately on a disposable disk image, never on real pool disks.

Reads pass through AES three times (LUKS, ZFS, TLS), so CPU headroom is part of the restore gate.

## DNS and Time That Fail Loudly

The firewall serves DNS over TLS and NTS to every zone, and resolves and keeps time upstream the same way. Serving it is half the job. Every client has to use it, and *fail* rather than fall back.

- Every Linux host runs chrony with NTS on every source and no plain sources, and resolves in strict DNS-over-TLS mode with the server's certificate name checked.
- The container runtime forwards container DNS straight to the host's upstream servers in plain DNS, skipping the host's TLS stub. Every container host therefore runs a TLS stub bound only to loopback and the bridge gateway, and the runtime points at it (E03).
- Appliances get no DNS server at all. They're configured by address, so they send no DNS.
- Fallback is tested from fresh state. With the DNS-over-TLS path blocked, an uncached random name fails to resolve. With chrony's saved NTS state cleared and its key exchange blocked, the source never becomes selectable.

## Seeing East/West Traffic

### What the sensor sees, and what it can't

The sensor runs Security Onion (Zeek, Suricata, full packet capture and the hunting UI) on three receive-only capture links: the private trunk, the cluster switch and the DMZ. Its capture interfaces have no address, and each mirror destination port forwards nothing.

- **It sees** everything entering or leaving the DMZ, everything the firewall routes for the private side, and east/west traffic on the cluster tier, with storage and replication filtered out at capture.
- **It doesn't see payloads.** Nearly every hop is mTLS, so the sensor works from SNI, JA4, timing and volume. Caller identity comes from the proxy's and Vault's audit logs.
- **Mirrors are best effort.** An oversubscribed mirror drops frames silently, so capture loss and kernel drops are alert signals in their own right.

### Copies from inside a host

Traffic between VMs crosses the trunk, so the switch mirror already has it. Traffic between containers in one VM, or between pods on the agents node, never touches a wire. Citadel's span component copies exactly that, and nothing else.

The obvious approach is wrong. Copies sent out the NIC with their original MAC addresses teach the switch that both endpoints live on the host's port, and from then on it filters later frames of the flow before the mirror ever sees them. Worse, a copy of a frame from the firewall can relearn the firewall's MAC on the wrong port and misroute real traffic.

{% mermaid %}
flowchart LR
    V["Container or pod veth"] -->|"tc mirror · policed"| X["VXLAN device<br/>VNI = source group"]
    X --> CB["Copy bridge<br/>send-only, pinned MAC"]
    CB -->|"copy-only VLAN"| SW["Private switch<br/>floods: sink MAC never learned"]
    SW --> P1["Firewall trunk port<br/>only other member of the VLAN"]
    P1 -.->|"port mirror"| SO["Sensor<br/>decodes VXLAN"]
    P1 --> FW["Firewall<br/>no interface on that VLAN · drops it"]
    style V fill:#1e3a5f,stroke:#22d3ee,color:#e2e8f0
    style X fill:#1e3a5f,stroke:#22d3ee,color:#e2e8f0
    style CB fill:#1e3a5f,stroke:#f59e0b,color:#e2e8f0
    style SW fill:#1a2332,stroke:#475569,color:#e2e8f0
    style P1 fill:#1a2332,stroke:#475569,color:#e2e8f0
    style SO fill:#1e3a5f,stroke:#10b981,color:#e2e8f0
    style FW fill:#1a2332,stroke:#475569,color:#e2e8f0
{% endmermaid %}

So copies are wrapped in VXLAN and sent from a fixed, locally administered span MAC per VM to a sink MAC that nothing ever sends from. The switch never learns the sink, so it floods. The copy-only VLAN has exactly two member ports, the workload host and the firewall trunk, so "flood" means one port. The existing trunk mirror delivers the copy to the sensor, and the firewall, which has no interface on that VLAN, drops it. No new switch, no new ports.

Never copied:

- **Plaintext.** DNS and kubelet probes are excluded, and the span filter is generated from the exception table, so any future host-local plaintext exception is excluded by default. DNS visibility comes from the stubs' query logs instead.
- **Duplicates.** Traffic through VM taps is already on the switch mirror. Copying it twice would skew Zeek's counts and double the load.
- **Bulk.** Backups and image pulls.
- **The authority host.** It runs no span, so its port never carries a tagged frame.

Copies are policed per VM and per host and marked background priority, so a flood lands on the policer, not on production traffic. A canary flow in each VM alerts when its feed goes quiet. A rooted VM can forge or drop its own copies, which is exactly why the switch mirror remains the independent record of traffic between groups.

## Management and Recovery

The management plane holds the softest targets in the rack: BMC firmware and switch web UIs. It is reachable only from a labelled break-glass port and has no route to the internet in either direction. IPMI answers only that path, because its RAKP handshake hands a password hash to anyone who can reach it. Management devices share layer 2, so the firewall never sees traffic between them. The switch's per-port forwarding lists do that job: each manager forwards only to the uplink and the break-glass port, and each device's own allowlist admits only the firewall and the break-glass address.

**Recovery never depends on what it recovers.** A laptop on the break-glass port reaches every BMC, the KVM console and the sensor's UI at layer 2, and both firewalls through the uplink, with no tailnet, DNS, SSO or Vault involved. The one recovery-critical host without a BMC has an IP-KVM cabled to it. The CI firewall's local admin port works with the lab firewall powered off.

**Cold start runs in dependency order:** firewall → switches → Vault (unsealed with offline shares) → DNS, proxy and SSO → edge and tailnet → primary storage (LUKS opened, pool imported, keys loaded) → backup storage (imported *without* its keys) → GPU nodes → CI firewall → CI hosts → runner VMs → sensor. The firewall needs a sane clock before any of its own TLS works, so its first time sync is built to work cold.

## Acceptance Gates

A chosen policy is not a demonstrated capability. Every guarantee that depends on hardware or client behavior is held to a gate on the live system, each with paired permit and deny tests.

**Gate 1 · MACsec on the GPU ring.** Software MACsec can't carry RDMA at all, because RDMA bypasses the kernel. The ring requires hardware offload, and the gate requires that:

- NIC firmware and kernel meet the vendor's floor, with offload on;
- the cipher uses extended packet numbering;
- RDMA benchmarks and collective all-reduces move the security-association counters on both ends;
- a mismatched SA stops RDMA on every GID, not just the MACsec one;
- collectives are pinned so a broken RDMA path fails the job instead of falling back to plaintext TCP;
- keys come from MKA and hold through rotation under load.

Extended packet numbering isn't optional. At 200 Gb/s with 4 KB frames the link moves about 6.1 million frames a second, so a 32-bit packet number (about 4.3 billion) is exhausted in roughly 12 minutes, and in about 4 at a 1500-byte MTU. A ring that can't meet the gate carries nothing.

**Gate 2 · Capture isolation.** A compromised sensor must not be able to inject a frame into any production VLAN. A laptop standing in for the sensor on each capture port sends untagged, tagged and double-tagged frames plus ARP and HTTPS probes. Nothing appears on any VLAN, the switch never learns the laptop's MAC, and no switch UI answers. A switch that can't hold this loses that capture link to a network TAP.

**Gate 3 · DNS and time clients.** Every client uses DNS over TLS and NTS and fails rather than falls back. Physical links carry no plain DNS at all; host-local hops are checked on each host, where no mirror can see them.

**Gate 4 · East/west visibility.** A 60-second flow between two containers in one VM arrives at the sensor whole, with zero missed bytes. No plaintext reaches the sensor through the copies, a flood is absorbed by the policer, and every VM's canary is live.

**Gate 5 · Agent containment.** See [Part 2](/writing/devlocal-agents-as-tenants/).

**Gate 6 · Authority host fitness.** Memory tests and a multi-day soak with zero logged memory faults before a unit holds Vault, PKI and SSO. The deny half runs the same log query over a window where faults are known to exist, proving the check can fail.

## How the Tests Are Written

Every permit has a matching deny. Every test is an exact command run from a named host. No command prints a secret.

```sh
# Permit (ingress VM): reach the forge through the firewall with the proxy's cert
curl -sS -o /dev/null -w '%{http_code}\n' --cacert <lab-ca> \
  --cert <proxy.crt> --key <proxy.key> https://<forge-gateway>/api/healthz
# expect 200, and a firewall log entry under X20

# Deny (forge VM): reach mail directly
nc -vz -w3 <mail-vm> <smtp-submission>
# expect failure, and a logged deny
```

```sh
# Deny (workload host, as root): hop VLANs with a double-tagged frame
python3 -I -c "from scapy.all import *; sendp(Ether(dst='<fw-mac>')/Dot1Q(vlan=<native>)/Dot1Q(vlan=<mgmt>)/IP(src='<marker-src>',dst='<fw-mgmt>')/ICMP(), iface='<nic>', count=5)"
# on the firewall's management interface, tcpdump for <marker-src> captures nothing
```

## Key Design Decisions

**An x86 firewall, not a travel router.** The lab boundary is a dedicated OPNsense box: a real stateful firewall, TLS log shipping built in, and headroom for every zone and rule above.

**A second firewall for CI, running its own policy.** The CI enclave sits behind its own OPNsense box with separate config, credentials and updates. Each CI host gets its own port and subnet, so the lanes meet only through a filter that logs it.

**Visibility without new hardware.** In-host copies ride VXLAN to a never-learned MAC over the existing trunk mirror. No capture switch, no extra ports, no purchases.

**GPU nodes serve models and nothing else.** Agents run in their own VM on the workload host. Model memory belongs to models, and a sandbox escape lands nowhere near the hardware that serves every model.

**Two storage hosts with pull replication.** A backup host that pulls ciphertext and never holds the primary's keys leaves no shared-fate path between the copies.

**A small fanless box at the edge.** The edge does almost nothing by design, so it runs on hardware sized for that. The capacity it would have wasted runs the workload hypervisor instead.

## Hard-Won Details

The details that separate a design that looks right from one that holds:

- **FORWARD DROP proves nothing on a container host.** Docker inserts its own accept rules, so a dual-homed container host filters in `DOCKER-USER`, then gets tested for routing between interfaces, published ports and wildcard-bound listeners, again after a daemon restart and again after a reboot.
- **Container DNS skips the encrypted stub.** The runtime forwards container lookups to the host's upstream servers in plain DNS. A local TLS stub the runtime points at closes that hole.
- **Every Linux bridge grows an IPv6 link-local address.** Any host service listening on the IPv6 wildcard answers every guest on that bridge. Hypervisors that don't need IPv6 don't run it.
- **Pods hide behind their node by default.** Common CNIs SNAT pod traffic to the node's address, so the firewall can't tell an agent from the kubelet. A routed, unmasqueraded pod network fixes that.
- **Broad PKI roles are a lateral-movement tool.** A role that signs any subdomain of the internal zone lets a compromised VM obtain a certificate for Vault's name. Every host gets a role for its exact names.
- **6 GHz Wi-Fi mandates WPA3-SAE with protected management frames.** Putting the lab's only wireless hop on 6 GHz enforces both without forcing WPA3-only on everything else. Saving no fallback bands means a lost link fails closed instead of downgrading.
- **NTS has a chicken-and-egg problem** on boxes without a battery-backed clock: certificate validity can't be checked before the clock is set. Skip only the dates, only until the first sync, with trust pinned to the intended servers.
- **Some vendors ship updates over plain HTTP on purpose.** Signed, hashed files over a CDN are a chain-of-custody decision, not an oversight. It gets written down as an exception and contained, not papered over.
- **Postgres data checksums are not on by default in every release.** Verify, enable them with the cluster stopped, and prove they catch a flipped byte.

