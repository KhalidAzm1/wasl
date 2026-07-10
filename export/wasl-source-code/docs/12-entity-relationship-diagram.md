# Entity Relationship Diagram

```mermaid
erDiagram
    BANKS ||--o{ PRODUCTS : "has"
    BANKS ||--o{ MEETINGS : "has"
    BANKS ||--o{ ACTION_ITEMS : "has"
    BANKS ||--o{ RISKS : "has"
    BANKS ||--o{ BANK_PRODUCT_TYPES : "associates"
    PRODUCT_TYPES ||--o{ BANK_PRODUCT_TYPES : "associates"
    BANKS ||--o{ FILES : "attaches (entityType=bank)"
    PRODUCTS ||--o{ FILES : "attaches (entityType=product)"
    MEETINGS ||--o{ FILES : "attaches (entityType=meeting)"
    PROFILES ||--o{ AUDIT_LOGS : "performs"
    BANKS ||--o{ AUDIT_LOGS : "tracked in"
    PRODUCTS ||--o{ AUDIT_LOGS : "tracked in"
    MEETINGS ||--o{ AUDIT_LOGS : "tracked in"
    FILES ||--o{ AUDIT_LOGS : "tracked in"

    BANKS {
        text id PK
        text nameEn
        text nameAr
        text category
        text status
        text riskLevel
        text priorityImpact
        jsonb contacts
        boolean isArchived
        timestamp archivedAt
        text archivedBy
    }
    PRODUCTS {
        text id PK
        text bankId FK
        text productCode
        text categoryStage
        text status
        real progressPercent
        text riskLevel
        boolean isArchived
    }
    PRODUCT_TYPES {
        text id PK
        text name
        boolean isActive
    }
    BANK_PRODUCT_TYPES {
        text bankId FK
        text productTypeId FK
    }
    MEETINGS {
        text id PK
        text bankId FK
        timestamp date
        text topic
        text summary
        text attendees
        text status
        boolean isArchived
    }
    FILES {
        text id PK
        text entityType
        text entityId
        text onedriveFileId
        text onedriveUrl
        text title
        text docType
        boolean isArchived
    }
    ACTION_ITEMS {
        text id PK
        text bankId FK
        text description
        timestamp dueDate
        text owner
        text status
    }
    RISKS {
        text id PK
        text bankId FK
        text description
        text level
        text status
    }
    AUDIT_LOGS {
        text id PK
        text userId
        text userName
        text action
        text entityType
        text entityId
        jsonb details
        timestamp createdAt
    }
    PROFILES {
        uuid id PK
        text email
        text role
        jsonb permissions
        timestamp deleted_at
    }
```

## Relationship Summary

- **One-to-Many**: `BANKS → PRODUCTS`, `BANKS → MEETINGS`, `BANKS → ACTION_ITEMS`, `BANKS → RISKS`.
- **Many-to-Many**: `BANKS ↔ PRODUCT_TYPES` via `BANK_PRODUCT_TYPES`.
- **Polymorphic One-to-Many**: `FILES` attaches to exactly one of `BANKS`, `PRODUCTS`, or `MEETINGS`, disambiguated by `entityType`.
- **Audit fan-in**: `AUDIT_LOGS` references any domain entity plus the acting `PROFILES` user, forming a many-to-one relationship for traceability rather than a foreign-key-enforced structural relationship.
