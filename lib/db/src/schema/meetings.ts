import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { banksTable } from "./banks";

export const meetingsTable = pgTable("meetings", {
  id: serial("id").primaryKey(),
  bankId: text("bank_id")
    .notNull()
    .references(() => banksTable.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  topic: text("topic").notNull(),
  summary: text("summary"),
  attendees: text("attendees"),
  status: text("status"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertMeetingSchema = createInsertSchema(meetingsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertMeeting = z.infer<typeof insertMeetingSchema>;
export type Meeting = typeof meetingsTable.$inferSelect;
