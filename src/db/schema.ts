import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

/**
 * One row per trade (round-trip). Options/futures use net pricing — a spread is a
 * single row at its net debit/credit. P&L is stored denormalized for fast stats.
 */
export const trades = sqliteTable(
  "trades",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    status: text("status", { enum: ["open", "closed"] })
      .notNull()
      .default("open"),
    instrumentType: text("instrument_type", {
      enum: ["stock", "option", "future"],
    }).notNull(),
    symbol: text("symbol").notNull(),
    // Optional exchange prefix, used only to build the TradingView deep-link.
    exchange: text("exchange"),
    direction: text("direction", { enum: ["long", "short"] }).notNull(),
    quantity: real("quantity").notNull(),
    multiplier: real("multiplier").notNull().default(1),
    entryPrice: real("entry_price").notNull(),
    exitPrice: real("exit_price"),
    stopPrice: real("stop_price"),
    targetPrice: real("target_price"),
    fees: real("fees").notNull().default(0),
    // Option / future metadata (all optional).
    strike: real("strike"),
    expiry: text("expiry"), // 'YYYY-MM-DD'
    right: text("right", { enum: ["call", "put"] }),
    setup: text("setup"),
    notes: text("notes").notNull().default(""),
    // Review fields — graded process (independent of P&L) + the one-line takeaway.
    grade: text("grade", { enum: ["a", "b", "c", "d", "f"] }),
    lesson: text("lesson"),
    // Computed + stored on close (recomputed on edit).
    pnl: real("pnl"),
    rMultiple: real("r_multiple"),
    entryAt: integer("entry_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    exitAt: integer("exit_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("trades_status_idx").on(t.status),
    index("trades_symbol_idx").on(t.symbol),
    index("trades_entry_at_idx").on(t.entryAt),
  ],
);

export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
});

export const tradeTags = sqliteTable(
  "trade_tags",
  {
    tradeId: integer("trade_id")
      .notNull()
      .references(() => trades.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.tradeId, t.tagId] })],
);

// Mistakes are a first-class, queryable dimension (separate from tags) so you can ask
// "how do my clean trades compare to the ones where I moved my stop?".
export const mistakes = sqliteTable("mistakes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
});

export const tradeMistakes = sqliteTable(
  "trade_mistakes",
  {
    tradeId: integer("trade_id")
      .notNull()
      .references(() => trades.id, { onDelete: "cascade" }),
    mistakeId: integer("mistake_id")
      .notNull()
      .references(() => mistakes.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.tradeId, t.mistakeId] })],
);

export const screenshots = sqliteTable(
  "screenshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tradeId: integer("trade_id")
      .notNull()
      .references(() => trades.id, { onDelete: "cascade" }),
    // Paths relative to data/screenshots, e.g. "12/abc.png".
    filePath: text("file_path").notNull(),
    thumbPath: text("thumb_path").notNull(),
    width: integer("width"),
    height: integer("height"),
    caption: text("caption"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("screenshots_trade_idx").on(t.tradeId)],
);

export const tradesRelations = relations(trades, ({ many }) => ({
  screenshots: many(screenshots),
  tradeTags: many(tradeTags),
  tradeMistakes: many(tradeMistakes),
}));

export const screenshotsRelations = relations(screenshots, ({ one }) => ({
  trade: one(trades, {
    fields: [screenshots.tradeId],
    references: [trades.id],
  }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  tradeTags: many(tradeTags),
}));

export const tradeTagsRelations = relations(tradeTags, ({ one }) => ({
  trade: one(trades, { fields: [tradeTags.tradeId], references: [trades.id] }),
  tag: one(tags, { fields: [tradeTags.tagId], references: [tags.id] }),
}));

export const mistakesRelations = relations(mistakes, ({ many }) => ({
  tradeMistakes: many(tradeMistakes),
}));

export const tradeMistakesRelations = relations(tradeMistakes, ({ one }) => ({
  trade: one(trades, {
    fields: [tradeMistakes.tradeId],
    references: [trades.id],
  }),
  mistake: one(mistakes, {
    fields: [tradeMistakes.mistakeId],
    references: [mistakes.id],
  }),
}));

export type Trade = typeof trades.$inferSelect;
export type NewTrade = typeof trades.$inferInsert;
export type Screenshot = typeof screenshots.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type Mistake = typeof mistakes.$inferSelect;
