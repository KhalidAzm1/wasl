import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bankContactSchema = z.object({
  name: z.string(),
  title: z.string().nullish(),
  phone: z.string().nullish(),
  email: z.string().nullish(),
});
export type BankContact = z.infer<typeof bankContactSchema>;

export const banksTable = pgTable("banks", {
  id: text("id").primaryKey(),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  category: text("category").notNull(),
  status: text("status").notNull(),
  logoUrl: text("logo_url"),
  heroImageUrl: text("hero_image_url"),
  referenceLink: text("reference_link"),
  contacts: jsonb("contacts").$type<BankContact[]>().notNull().default([]),
  riskLevel: text("risk_level").notNull(),
  priorityImpact: text("priority_impact").notNull(),
  responsiblePerson: text("responsible_person"),
  relationshipManager: text("relationship_manager"),
  email: text("email"),
  website: text("website"),
  lastMeetingDate: text("last_meeting_date"),
  lastMeetingSummary: text("last_meeting_summary"),
  nextMeetingDate: text("next_meeting_date"),
  nextMeetingTopic: text("next_meeting_topic"),
  nextAction: text("next_action"),
  executiveSummary: text("executive_summary"),
  descriptionNotes: text("description_notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertBankSchema = createInsertSchema(banksTable, {
  contacts: z.array(bankContactSchema).default([]),
}).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertBank = z.infer<typeof insertBankSchema>;
export type Bank = typeof banksTable.$inferSelect;
