# Deployment Architecture

## Deployment Diagram

```mermaid
graph TB
    subgraph Internet
        Browser[Internal User Browser]
    end

    subgraph "Replit Platform"
        Proxy[Replit Path-Based Router / mTLS Proxy]
        subgraph "Autoscale Deployment"
            FEProc[wasl-platform static build served]
            BEProc[api-server Express process]
        end
        PG[(Replit-managed PostgreSQL)]
    end

    subgraph "External Managed Services"
        SB[Supabase Auth]
        MSGraph[Microsoft Graph API / OneDrive]
    end

    Browser -->|HTTPS| Proxy
    Proxy -->|/ path| FEProc
    Proxy -->|/api path| BEProc
    BEProc --> PG
    BEProc --> SB
    BEProc --> MSGraph
    FEProc -.direct auth calls.-> SB
```

## Environments

| Environment | Purpose | Notes |
|---|---|---|
| **Development** | Live-editing workspace | Vite dev servers with HMR; workflows auto-restart on config changes |
| **Production** | Deployed, user-facing instance | Built artifacts served via Replit Autoscale; separate production database/session context |

## Build Pipeline

```mermaid
flowchart LR
    A[pnpm install] --> B[tsc --build across project references]
    B --> C[vite build - wasl-platform]
    B --> D[server build - api-server]
    C --> E[Static assets bundled]
    D --> F[Compiled server bundle]
    E --> G[pnpm store prune]
    F --> G
    G --> H[Replit Autoscale Deployment]
```

## Deployment Characteristics

- **Stateless API server**: no in-memory session state beyond short-lived PIN tokens (HMAC-verifiable, not server-memory-dependent) — safe to scale horizontally.
- **Path-based routing**: Replit's proxy maps `/` to the frontend artifact and `/api` to the backend artifact; frontend code must always use its base-path-aware URL helper rather than hardcoded root-relative paths.
- **Zero-downtime expectation**: Autoscale deployments replace instances; the app must not depend on local disk state (none currently does — all persistent state is in PostgreSQL or OneDrive).

## Rollback Strategy

- Replit checkpoints (codebase + database snapshots) provide a rollback path for both code and data if a deployment introduces a regression.
- Database schema changes should be additive and backward-compatible where possible to avoid requiring coordinated rollback of both code and schema.
