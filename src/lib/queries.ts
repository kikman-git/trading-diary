import "server-only";
import {
  and,
  desc,
  eq,
  gte,
  inArray,
  like,
  lte,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { db } from "@/db";
import {
  mistakes,
  screenshots,
  tags,
  trades,
  tradeMistakes,
  tradeTags,
} from "@/db/schema";
import type { Trade } from "@/db/schema";

export type TradeFilters = {
  status?: "open" | "closed";
  symbol?: string;
  setup?: string;
  tag?: string;
  mistake?: string;
  grade?: string;
  q?: string;
  from?: Date;
  to?: Date;
};

export type TradeWithMeta = Trade & {
  tags: string[];
  mistakes: string[];
  thumb: string | null;
};

async function resolveWhere(f: TradeFilters): Promise<SQL | undefined> {
  const conds: SQL[] = [];
  if (f.status) conds.push(eq(trades.status, f.status));
  if (f.symbol)
    conds.push(like(trades.symbol, `%${f.symbol.toUpperCase()}%`));
  if (f.setup) conds.push(eq(trades.setup, f.setup));
  if (f.grade)
    conds.push(eq(trades.grade, f.grade as "a" | "b" | "c" | "d" | "f"));
  if (f.from) conds.push(gte(trades.entryAt, f.from));
  if (f.to) conds.push(lte(trades.entryAt, f.to));
  if (f.q) {
    const term = `%${f.q}%`;
    const symTerm = `%${f.q.toUpperCase()}%`;
    conds.push(
      or(
        like(trades.notes, term),
        like(trades.symbol, symTerm),
        like(trades.setup, term),
      ) as SQL,
    );
  }
  if (f.tag) {
    const rows = await db
      .select({ id: tradeTags.tradeId })
      .from(tradeTags)
      .innerJoin(tags, eq(tradeTags.tagId, tags.id))
      .where(eq(tags.name, f.tag.toLowerCase()));
    const ids = rows.map((r) => r.id);
    conds.push(ids.length ? inArray(trades.id, ids) : sql`0 = 1`);
  }
  if (f.mistake) {
    const rows = await db
      .select({ id: tradeMistakes.tradeId })
      .from(tradeMistakes)
      .innerJoin(mistakes, eq(tradeMistakes.mistakeId, mistakes.id))
      .where(eq(mistakes.name, f.mistake.toLowerCase()));
    const ids = rows.map((r) => r.id);
    conds.push(ids.length ? inArray(trades.id, ids) : sql`0 = 1`);
  }
  return conds.length ? and(...conds) : undefined;
}

async function tagsForTrades(ids: number[]): Promise<Map<number, string[]>> {
  const map = new Map<number, string[]>();
  if (!ids.length) return map;
  const rows = await db
    .select({ tradeId: tradeTags.tradeId, name: tags.name })
    .from(tradeTags)
    .innerJoin(tags, eq(tradeTags.tagId, tags.id))
    .where(inArray(tradeTags.tradeId, ids));
  for (const r of rows) {
    const arr = map.get(r.tradeId) ?? [];
    arr.push(r.name);
    map.set(r.tradeId, arr);
  }
  return map;
}

async function mistakesForTrades(
  ids: number[],
): Promise<Map<number, string[]>> {
  const map = new Map<number, string[]>();
  if (!ids.length) return map;
  const rows = await db
    .select({ tradeId: tradeMistakes.tradeId, name: mistakes.name })
    .from(tradeMistakes)
    .innerJoin(mistakes, eq(tradeMistakes.mistakeId, mistakes.id))
    .where(inArray(tradeMistakes.tradeId, ids));
  for (const r of rows) {
    const arr = map.get(r.tradeId) ?? [];
    arr.push(r.name);
    map.set(r.tradeId, arr);
  }
  return map;
}

async function firstThumbForTrades(
  ids: number[],
): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (!ids.length) return map;
  const rows = await db
    .select({
      tradeId: screenshots.tradeId,
      thumbPath: screenshots.thumbPath,
      sortOrder: screenshots.sortOrder,
      id: screenshots.id,
    })
    .from(screenshots)
    .where(inArray(screenshots.tradeId, ids))
    .orderBy(screenshots.sortOrder, screenshots.id);
  for (const r of rows) {
    if (!map.has(r.tradeId)) map.set(r.tradeId, r.thumbPath);
  }
  return map;
}

export async function getTrades(
  f: TradeFilters = {},
): Promise<TradeWithMeta[]> {
  const where = await resolveWhere(f);
  const rows = await db
    .select()
    .from(trades)
    .where(where)
    .orderBy(desc(trades.entryAt))
    .limit(500);
  const ids = rows.map((r) => r.id);
  const [tagMap, mistakeMap, thumbMap] = await Promise.all([
    tagsForTrades(ids),
    mistakesForTrades(ids),
    firstThumbForTrades(ids),
  ]);
  return rows.map((t) => ({
    ...t,
    tags: tagMap.get(t.id) ?? [],
    mistakes: mistakeMap.get(t.id) ?? [],
    thumb: thumbMap.get(t.id) ?? null,
  }));
}

export type Stats = {
  net: number;
  winRate: number | null;
  count: number;
  avgR: number | null;
  profitFactor: number | null;
  expectancy: number | null;
  avgWin: number | null;
  avgLoss: number | null;
  openCount: number;
};

export async function getStats(f: TradeFilters = {}): Promise<Stats> {
  const where = await resolveWhere({ ...f, status: "closed" });
  const rows = await db
    .select({ pnl: trades.pnl, r: trades.rMultiple })
    .from(trades)
    .where(where);

  const pnls = rows.map((r) => r.pnl ?? 0);
  const wins = pnls.filter((p) => p > 0);
  const losses = pnls.filter((p) => p < 0);
  const net = pnls.reduce((a, b) => a + b, 0);
  const grossWin = wins.reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));
  const rs = rows
    .map((r) => r.r)
    .filter((r): r is number => r != null);

  const openWhere = await resolveWhere({ ...f, status: "open" });
  const openRows = await db
    .select({ id: trades.id })
    .from(trades)
    .where(openWhere);

  return {
    net,
    winRate: pnls.length ? (wins.length / pnls.length) * 100 : null,
    count: pnls.length,
    avgR: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null,
    profitFactor:
      grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? null : null,
    expectancy: pnls.length ? net / pnls.length : null,
    avgWin: wins.length ? grossWin / wins.length : null,
    avgLoss: losses.length ? -grossLoss / losses.length : null,
    openCount: openRows.length,
  };
}

export async function getTradeById(id: number) {
  const trade = await db.query.trades.findFirst({
    where: eq(trades.id, id),
    with: {
      screenshots: true,
      tradeTags: { with: { tag: true } },
      tradeMistakes: { with: { mistake: true } },
    },
  });
  if (!trade) return null;
  const shots = [...trade.screenshots].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.id - b.id,
  );
  return {
    ...trade,
    screenshots: shots,
    tags: trade.tradeTags.map((tt) => tt.tag.name),
    mistakes: trade.tradeMistakes.map((tm) => tm.mistake.name),
  };
}

export async function getDistinctSetups(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ setup: trades.setup })
    .from(trades)
    .where(sql`${trades.setup} is not null and ${trades.setup} != ''`)
    .orderBy(trades.setup);
  return rows.map((r) => r.setup!).filter(Boolean);
}

export async function getAllTags(): Promise<string[]> {
  const rows = await db.select({ name: tags.name }).from(tags).orderBy(tags.name);
  return rows.map((r) => r.name);
}

export async function getAllMistakes(): Promise<string[]> {
  const rows = await db
    .select({ name: mistakes.name })
    .from(mistakes)
    .orderBy(mistakes.name);
  return rows.map((r) => r.name);
}
