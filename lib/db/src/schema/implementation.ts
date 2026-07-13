import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { banksTable } from "./banks";

export const IMPLEMENTATION_STAGES = [
  'initial_engagement',
  'business_analysis',
  'technical_development',
  'integration_testing_stg',
  'user_acceptance_testing_uat',
  'penetration_testing_pt_av',
  'go_live_preparation',
  'production_go_live',
] as const;

export const IMPLEMENTATION_STAGE_LABELS: Record<string, string> = {
  initial_engagement: 'Initial Engagement',
  business_analysis: 'Business Analysis',
  technical_development: 'Technical Development',
  integration_testing_stg: 'Integration Testing (STG)',
  user_acceptance_testing_uat: 'User Acceptance Testing (UAT)',
  penetration_testing_pt_av: 'Penetration Testing & Vulnerability Assessment (PT-AV)',
  go_live_preparation: 'Go-Live Preparation',
  production_go_live: 'Production Go-Live',
};

export type ImplementationStage = typeof IMPLEMENTATION_STAGES[number];
export type ImplementationStatus = 'not_started' | 'in_progress' | 'completed' | 'blocked';

export const bankImplementationProgressTable = pgTable('bank_implementation_progress', {
  id: serial('id').primaryKey(),
  bankId: text('bank_id')
    .notNull()
    .references(() => banksTable.id, { onDelete: 'cascade' }),
  stage: text('stage').notNull(),
  status: text('status').notNull().default('not_started'),
  completed: boolean('completed').notNull().default(false),
  completedAt: text('completed_at'),
  notes: text('notes'),
  owner: text('owner'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type BankImplementationProgress = typeof bankImplementationProgressTable.$inferSelect;
