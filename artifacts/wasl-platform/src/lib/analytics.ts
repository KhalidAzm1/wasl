/**
 * Typed analytics helpers — thin wrappers around posthog.capture so every
 * call site gets autocomplete and we never mis-spell an event name.
 */
import { posthog } from './posthog';

export const analytics = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  userLogin(props: { email: string }) {
    posthog.capture('User Login', props);
  },

  userLogout() {
    posthog.capture('User Logout');
  },

  // ── Banks ─────────────────────────────────────────────────────────────────
  bankCreated(props: { bank_id: string; bank_name_en: string; bank_name_ar: string; category: string }) {
    posthog.capture('Bank Created', props);
  },

  bankUpdated(props: { bank_id: string; bank_name_en: string }) {
    posthog.capture('Bank Updated', props);
  },

  bankArchived(props: { bank_id: string; bank_name_en: string }) {
    posthog.capture('Bank Archived', props);
  },

  bankRestored(props: { bank_id: string; bank_name_ar: string }) {
    posthog.capture('Bank Restored', props);
  },

  // ── Products ──────────────────────────────────────────────────────────────
  productCreated(props: { bank_id: string; product_code: string; category_stage: string }) {
    posthog.capture('Product Created', props);
  },

  productUpdated(props: { bank_id: string; product_id: number; product_code: string }) {
    posthog.capture('Product Updated', props);
  },

  productDeleted(props: { bank_id: string; product_id: number; product_code: string }) {
    posthog.capture('Product Deleted', props);
  },

  // ── Meetings ──────────────────────────────────────────────────────────────
  meetingCreated(props: { bank_id: string; topic: string; date: string }) {
    posthog.capture('Meeting Created', props);
  },

  meetingUpdated(props: { bank_id: string; meeting_id: number }) {
    posthog.capture('Meeting Updated', props);
  },

  // ── Documents ─────────────────────────────────────────────────────────────
  documentUploaded(props: { bank_id?: string; entity_type?: string; entity_id?: string; file_name: string; doc_type: string }) {
    posthog.capture('Document Uploaded', props);
  },

  documentDeleted(props: { doc_id: number; bank_id?: string }) {
    posthog.capture('Document Deleted', props);
  },

  documentRestored(props: { doc_id: number }) {
    posthog.capture('Document Restored', props);
  },

  // ── Users (Admin) ──────────────────────────────────────────────────────────
  userCreated(props: { target_email: string; target_role: string }) {
    posthog.capture('User Created', props);
  },

  userUpdated(props: { target_user_id: string; target_name: string }) {
    posthog.capture('User Updated', props);
  },

  userRoleChanged(props: { target_user_id: string; old_role: string; new_role: string }) {
    posthog.capture('User Role Changed', props);
  },

  userDeleted(props: { target_user_id: string; target_name: string }) {
    posthog.capture('User Deleted', props);
  },
};
