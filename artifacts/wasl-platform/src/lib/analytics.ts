/**
 * Wasl Analytics Service
 * ──────────────────────
 * Central analytics layer — every event in the app goes through here.
 *
 * Architecture:
 *  - trackEvent()         base capture; auto-enriches every event with
 *                         timestamp, browser, device, currentPage
 *  - identifyUser()       posthog.identify wrapper (person properties persist
 *                         across all subsequent events automatically)
 *  - resetUser()          posthog.reset on sign-out
 *  - trackBankEvent()     shorthand for bank-scoped events
 *  - trackMeetingEvent()  shorthand for meeting-scoped events
 *  - trackDocumentEvent() shorthand for document-scoped events
 *  - trackTaskEvent()     shorthand for task/action-scoped events
 *
 * Dev mode: every event is console.logged with coloured prefix so you can
 * trace the full event stream without opening PostHog.
 */
import { posthog } from './posthog';

// ── Environment helpers (duplicated from PostHogProvider so analytics.ts is
//    self-contained and importable without the React tree) ──────────────────

function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop';
  const w = window.innerWidth;
  if (w < 768) return 'mobile';
  if (w < 1280) return 'tablet';
  return 'desktop';
}

function getBrowser(): string {
  if (typeof navigator === 'undefined') return 'Unknown';
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\/|Opera/.test(ua)) return 'Opera';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'Other';
}

function currentPath(): string {
  return typeof window !== 'undefined' ? window.location.pathname : '';
}

// ── Core service ─────────────────────────────────────────────────────────────

export const analytics = {

  // ── Core service functions ──────────────────────────────────────────────

  /**
   * Base event capture. Auto-enriches every event with:
   *  - timestamp (ISO 8601)
   *  - browser
   *  - device  (mobile | tablet | desktop)
   *  - currentPage (URL pathname)
   *
   * In development: logs to console with colour-coded prefix.
   */
  trackEvent(event: string, props?: Record<string, unknown>): void {
    const enriched: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      browser: getBrowser(),
      device: getDeviceType(),
      currentPage: currentPath(),
      ...props,
    };
    if (import.meta.env.DEV) {
      console.log(
        `%c[Analytics] %c${event}`,
        'color:#7c3aed;font-weight:bold;',
        'color:#0ea5e9;font-weight:bold;',
        enriched,
      );
    }
    posthog.capture(event, enriched);
  },

  /**
   * Identify the current user so PostHog attaches person properties
   * (userId, userName, userRole, email) to ALL subsequent events automatically.
   */
  identifyUser(userId: string, props: {
    name?: string;
    role?: string;
    email?: string;
  }): void {
    posthog.identify(userId, {
      user_id: userId,
      user_name: props.name,
      user_role: props.role,
      email: props.email,
      device: getDeviceType(),
      browser: getBrowser(),
      company: 'Wasl',
    });
    if (import.meta.env.DEV) {
      console.log(
        '%c[Analytics] %cidentify',
        'color:#7c3aed;font-weight:bold;',
        'color:#059669;font-weight:bold;',
        { userId, ...props },
      );
    }
  },

  /** Reset person identity on sign-out. */
  resetUser(): void {
    posthog.reset();
    if (import.meta.env.DEV) {
      console.log(
        '%c[Analytics] %creset (user signed out)',
        'color:#7c3aed;font-weight:bold;',
        'color:#dc2626;font-weight:bold;',
      );
    }
  },

  // ── Group-scoped helpers ────────────────────────────────────────────────

  trackBankEvent(
    event: string,
    bank: { bank_id: string; bank_name_en?: string; bank_name_ar?: string },
    extra?: Record<string, unknown>,
  ): void {
    this.trackEvent(event, {
      bank_id: bank.bank_id,
      bank_name: bank.bank_name_en ?? bank.bank_name_ar,
      bank_name_en: bank.bank_name_en,
      bank_name_ar: bank.bank_name_ar,
      ...extra,
    });
  },

  trackMeetingEvent(
    event: string,
    meeting: { meeting_id?: number; bank_id?: string; topic?: string },
    extra?: Record<string, unknown>,
  ): void {
    this.trackEvent(event, {
      meeting_id: meeting.meeting_id,
      bank_id: meeting.bank_id,
      meeting_topic: meeting.topic,
      ...extra,
    });
  },

  trackDocumentEvent(
    event: string,
    doc: { doc_id?: number; bank_id?: string; file_name?: string; doc_type?: string },
    extra?: Record<string, unknown>,
  ): void {
    this.trackEvent(event, {
      doc_id: doc.doc_id,
      bank_id: doc.bank_id,
      file_name: doc.file_name,
      doc_type: doc.doc_type,
      ...extra,
    });
  },

  trackTaskEvent(
    event: string,
    task: { task_id?: number; bank_id?: string; description?: string; status?: string; owner?: string },
    extra?: Record<string, unknown>,
  ): void {
    this.trackEvent(event, {
      task_id: task.task_id,
      bank_id: task.bank_id,
      task_description: task.description,
      task_status: task.status,
      task_owner: task.owner,
      ...extra,
    });
  },

  // ── Auth ────────────────────────────────────────────────────────────────

  userLogin(props: { email: string }): void {
    this.trackEvent('User Login', props);
  },

  userLogout(): void {
    this.trackEvent('User Logout');
  },

  // ── User Management ─────────────────────────────────────────────────────

  userCreated(props: { target_email: string; target_role: string }): void {
    this.trackEvent('User Created', props);
  },

  userUpdated(props: { target_user_id: string; target_name: string }): void {
    this.trackEvent('User Updated', props);
  },

  userDeleted(props: { target_user_id: string; target_name: string }): void {
    this.trackEvent('User Deleted', props);
  },

  userRoleChanged(props: { target_user_id: string; old_role: string; new_role: string }): void {
    this.trackEvent('User Role Changed', props);
  },

  // ── Bank Management ─────────────────────────────────────────────────────

  bankCreated(props: { bank_id: string; bank_name_en: string; bank_name_ar: string; category: string }): void {
    this.trackEvent('Bank Created', props);
  },

  bankUpdated(props: { bank_id: string; bank_name_en: string; changed_fields?: string[] }): void {
    this.trackEvent('Bank Updated', props);
  },

  /** Fired once per visit when the bank detail page loads. */
  bankOpened(props: { bank_id: string; bank_name_en: string; bank_name_ar: string; risk_level: string; priority_impact: string }): void {
    this.trackEvent('Bank Opened', props);
  },

  /** Fired when the user actively views a specific tab in bank detail. */
  bankDetailsViewed(props: { bank_id: string; bank_name_en: string; tab: string }): void {
    this.trackEvent('Bank Details Viewed', props);
  },

  bankArchived(props: { bank_id: string; bank_name_en: string }): void {
    this.trackEvent('Bank Archived', props);
  },

  bankDeleted(props: { bank_id: string; bank_name_en: string }): void {
    this.trackEvent('Bank Deleted', props);
  },

  bankRestored(props: { bank_id: string; bank_name_ar: string }): void {
    this.trackEvent('Bank Restored', props);
  },

  bankStatusChanged(props: { bank_id: string; bank_name_en: string; old_status: string; new_status: string }): void {
    this.trackEvent('Bank Status Changed', props);
  },

  // ── Products ────────────────────────────────────────────────────────────

  productCreated(props: { bank_id: string; product_code: string; category_stage: string }): void {
    this.trackEvent('Product Created', props);
  },

  productUpdated(props: { bank_id: string; product_id: number; product_code: string }): void {
    this.trackEvent('Product Updated', props);
  },

  productDeleted(props: { bank_id: string; product_id: number; product_code: string }): void {
    this.trackEvent('Product Deleted', props);
  },

  /** Fired when the user opens the edit/detail dialog for a product. */
  productOpened(props: { bank_id: string; product_id: number; product_code: string; category_stage: string }): void {
    this.trackEvent('Product Opened', props);
  },

  /** Fired when the user clicks into an associated product card. */
  associatedProductViewed(props: { bank_id: string; product_id: number; product_code: string; category_stage: string }): void {
    this.trackEvent('Associated Product Viewed', props);
  },

  // ── Meetings ────────────────────────────────────────────────────────────

  meetingCreated(props: { bank_id: string; topic: string; date: string }): void {
    this.trackEvent('Meeting Created', props);
  },

  meetingUpdated(props: { bank_id: string; meeting_id: number }): void {
    this.trackEvent('Meeting Updated', props);
  },

  meetingDeleted(props: { bank_id: string; meeting_id: number; topic?: string }): void {
    this.trackEvent('Meeting Deleted', props);
  },

  meetingOpened(props: { bank_id: string; meeting_id: number; topic?: string; date?: string }): void {
    this.trackEvent('Meeting Opened', props);
  },

  // ── Documents ───────────────────────────────────────────────────────────

  documentUploaded(props: { bank_id?: string; entity_type?: string; entity_id?: string; file_name: string; doc_type: string }): void {
    this.trackEvent('Document Uploaded', props);
  },

  documentDownloaded(props: { doc_id?: number; bank_id?: string; file_name?: string; doc_type?: string; source?: string }): void {
    this.trackEvent('Document Downloaded', props);
  },

  documentDeleted(props: { doc_id: number; bank_id?: string }): void {
    this.trackEvent('Document Deleted', props);
  },

  documentRestored(props: { doc_id: number }): void {
    this.trackEvent('Document Restored', props);
  },

  // ── Tasks (Action Items) ────────────────────────────────────────────────

  taskCreated(props: { bank_id: string; description?: string; owner?: string; due_date?: string }): void {
    this.trackEvent('Task Created', props);
  },

  taskUpdated(props: { bank_id: string; task_id: number; status?: string; description?: string }): void {
    this.trackEvent('Task Updated', props);
  },

  taskCompleted(props: { bank_id: string; task_id: number; description?: string; owner?: string }): void {
    this.trackEvent('Task Completed', props);
  },

  taskDeleted(props: { bank_id: string; task_id: number }): void {
    this.trackEvent('Task Deleted', props);
  },

  // ── Search ──────────────────────────────────────────────────────────────

  searchUsed(props: { query: string; results_count: number; filters_active?: boolean }): void {
    this.trackEvent('Search Used', props);
  },

  searchResultClicked(props: { query: string; bank_id: string; bank_name: string; result_position: number }): void {
    this.trackEvent('Search Result Clicked', props);
  },

  // ── Dashboard ───────────────────────────────────────────────────────────

  dashboardLoaded(props: { total_banks: number; in_progress: number; completed: number; delayed: number; high_risk: number }): void {
    this.trackEvent('Dashboard Loaded', props);
  },

  // ── Executive ───────────────────────────────────────────────────────────

  executivePresentationModeEnabled(props: { bank_id?: string; bank_name?: string }): void {
    this.trackEvent('Executive Presentation Mode Enabled', props);
  },

  // ── Implementation Progress ─────────────────────────────────────────────

  implementationStageStarted(props: {
    bank_id: string;
    stage: string;
    stage_name: string;
    stage_index: number;
  }): void {
    this.trackEvent('Implementation Stage Started', props);
  },

  implementationStageCompleted(props: {
    bank_id: string;
    stage: string;
    stage_name: string;
    stage_index: number;
    days_in_stage?: number | null;
  }): void {
    this.trackEvent('Implementation Stage Completed', props);
  },

  implementationStageBlocked(props: {
    bank_id: string;
    stage: string;
    stage_name: string;
    stage_index: number;
  }): void {
    this.trackEvent('Implementation Stage Blocked', props);
  },

  implementationProgressUpdated(props: {
    bank_id: string;
    stage: string;
    stage_name: string;
    new_status?: string;
    completion_percentage?: number;
  }): void {
    this.trackEvent('Implementation Progress Updated', props);
  },

  implementationStageUpdated(props: {
    bank_id: string;
    stage: string;
    update_duration_ms: number;
  }): void {
    this.trackEvent('Implementation Stage Updated', props);
  },

  updateDuration(props: {
    bank_id: string;
    stage: string;
    duration_ms: number;
    endpoint: string;
  }): void {
    this.trackEvent('Update Duration', props);
  },

  slowUpdateWarning(props: {
    bank_id: string;
    stage: string;
    duration_ms: number;
  }): void {
    this.trackEvent('Slow Update Warning', props);
  },
};
