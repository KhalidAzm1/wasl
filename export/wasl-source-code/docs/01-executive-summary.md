# Executive Summary — WASL AI Banking Dashboard (وصل)

## Overview

**WASL** ("وصل" — Arabic for *"connection"*) is an internal **AI Banking Intelligence Platform** built to give an organization's leadership and relationship teams a single, real-time view of every partner bank relationship, product integration, meeting, and compliance document under management. It replaces fragmented spreadsheets and email threads with one governed system of record.

## What the Product Does

- Tracks the full lifecycle of banking partnerships — from onboarding through active integration to completion — across **30+ partner banks**.
- Monitors bank-specific **products and product-type catalog** with progress, risk, and status.
- Centralizes **meetings** (with summaries, attendees, topics) and **documents** (contracts, compliance files) per bank, backed by Microsoft OneDrive.
- Provides an **audit trail** ("Activity Timeline") of every create/update/archive/restore action for compliance and accountability.
- Enforces **role-based, permission-based access control** with a secondary PIN gate for the most sensitive administrative actions.

## Why It Matters

| Business Problem | WASL Solution |
|---|---|
| Bank relationship data scattered across spreadsheets and inboxes | Single dashboard with live KPIs (total banks, in progress, completed, delayed, high risk) |
| No audit trail for who changed what | System-wide, immutable Activity Timeline |
| Uncontrolled access to sensitive partner data | Granular per-user permissions + PIN-gated admin actions |
| Documents living in disconnected drives/email | OneDrive-backed document management wired directly to each bank/product/meeting |
| No visibility into product rollout risk | Kanban and grid views of product status, risk level, and progress percentage |

## Current State

The platform is live and operating as a single-tenant internal tool, deployed on Replit, with:
- A **React 19 + Vite** frontend ("Arctic Glass" dark/light design system, bilingual Arabic/English support).
- An **Express 5** API server with **PostgreSQL** (Drizzle ORM) as the system of record.
- **Supabase** used purely for authentication (JWT sessions, user profiles, roles).
- **Microsoft OneDrive** as the document storage backend via the Microsoft Graph API.

## Strategic Value

WASL turns bank-partnership management from an ad-hoc, person-dependent process into an auditable, governed, permission-controlled system — directly supporting regulatory/compliance obligations around partner oversight and reducing operational risk from knowledge silos.

## Document Map

This executive summary is the entry point to a full documentation package (see `/docs`) covering business context, architecture, data model, security, and roadmap — intended for both executive stakeholders and engineering teams inheriting the codebase.
