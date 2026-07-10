# Business Process Flows

## 1. User Login & Access Flow

```mermaid
sequenceDiagram
    actor User
    participant FE as WASL Frontend
    participant Supabase
    participant API as API Server
    participant DB as PostgreSQL

    User->>FE: Enter email/password
    FE->>Supabase: signInWithPassword()
    Supabase-->>FE: JWT session
    alt must_change_password flag set
        FE->>User: Redirect to /change-password
    else
        FE->>API: GET /api/dashboard/summary (Bearer JWT)
        API->>Supabase: auth.getUser(token)
        Supabase-->>API: user identity
        API->>DB: fetch profile + permissions
        DB-->>API: role, permissions
        API-->>FE: 200 + data (if permitted) or 403
        FE->>User: Render Dashboard (Portfolio)
    end
```

## 2. Bank Onboarding Process

```mermaid
flowchart TD
    A[Relationship Manager identifies new bank] --> B[Create Bank record via Dashboard]
    B --> C[Set nameEn/nameAr, category, status = Not Started]
    C --> D[Assign relevant Product Types]
    D --> E[Create Product records per integration]
    E --> F[Schedule and log Meetings]
    F --> G[Upload supporting Documents to OneDrive]
    G --> H{Status changes tracked}
    H --> I[In Progress]
    I --> J[Completed or Delayed]
    J --> K[Audit Log entry created at every step]
```

## 3. Document Lifecycle (OneDrive-backed)

```mermaid
flowchart LR
    Upload[User uploads document] --> Meta[API creates files record]
    Meta --> Store[File bytes pushed to OneDrive folder for entity]
    Store --> Link[onedriveFileId + onedriveUrl stored]
    Link --> View[User requests to view/download]
    View --> Token[API mints short-lived signed token]
    Token --> Redirect[Redirect route fetches fresh Graph URL]
    Redirect --> Download[User's browser streams file]
    Meta --> Archive{Archive requested?}
    Archive -->|Yes| SoftDelete[isArchived = true, archivedAt/By set]
    SoftDelete --> Restore{Restore requested?}
    Restore -->|Yes| Active[isArchived = false]
```

## 4. Archive / Restore Governance Flow

```mermaid
flowchart TD
    Start[User requests archive of Bank/Meeting/Document] --> Check{Has archive permission per role config?}
    Check -->|No| Deny[403 Forbidden]
    Check -->|Yes| Do[Set isArchived=true, archivedAt, archivedBy]
    Do --> Log[Write audit_logs entry: action=ARCHIVE]
    Do --> Hide[Record hidden from default list views]
    Hide --> Later{Restore requested?}
    Later -->|Yes| CheckRestore{Has restore permission?}
    CheckRestore -->|No| Deny2[403 Forbidden]
    CheckRestore -->|Yes| Undo[Set isArchived=false]
    Undo --> Log2[Write audit_logs entry: action=RESTORE]
```

## 5. Admin User Management (with PIN Second Factor)

```mermaid
sequenceDiagram
    actor SuperAdmin
    participant FE as Frontend (AdminPinGate)
    participant API as API Server
    actor DB as Database

    SuperAdmin->>FE: Navigate to /admin/users
    FE->>FE: Check RequireAuth (role=super_admin, permission=user_management)
    FE->>SuperAdmin: Prompt for Admin PIN
    SuperAdmin->>FE: Enter PIN
    FE->>API: POST /api/admin/verify-pin
    API->>API: timingSafeEqual(pin, ADMIN_PANEL_PIN)
    API-->>FE: x-admin-pin-token (HMAC-signed, short-lived)
    FE->>API: POST /api/admin/users (with x-admin-pin-token header)
    API->>API: requirePinToken middleware validates token+userId
    API->>DB: Create/update user profile & permissions
    DB-->>API: OK
    API-->>FE: 200 + updated user
```

## 6. Meeting & Follow-Up Process

```mermaid
flowchart TD
    A[Meeting occurs with bank] --> B[RM logs Meeting: date, topic, attendees, summary]
    B --> C{Action items identified?}
    C -->|Yes| D[Create Action Item: description, owner, due date]
    D --> E[Track status: Open/In Progress/Done]
    C -->|No| F[Meeting closed as informational]
    B --> G[Optionally attach Documents to meeting]
