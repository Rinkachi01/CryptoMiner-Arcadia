import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const gameStates = sqliteTable(
  "game_states",
  {
    accountId: text("account_id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    stateJson: text("state_json").notNull(),
    version: integer("version").notNull().default(1),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("game_states_email_unique").on(table.email),
    index("game_states_updated_at_idx").on(table.updatedAt),
  ],
);

export const ledgerEntries = sqliteTable(
  "ledger_entries",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    action: text("action").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    stateVersion: integer("state_version").notNull(),
    deltaCmaMicros: integer("delta_cma_micros").notNull().default(0),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("ledger_entries_idempotency_unique").on(
      table.accountId,
      table.idempotencyKey,
    ),
    index("ledger_entries_account_created_idx").on(
      table.accountId,
      table.createdAt,
    ),
  ],
);
