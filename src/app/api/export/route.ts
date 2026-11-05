import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { mistakes, tags, trades, tradeMistakes, tradeTags } from "@/db/schema";

export const dynamic = "force-dynamic";

const COLS = [
  "id",
  "status",
  "instrumentType",
  "symbol",
  "exchange",
  "direction",
  "quantity",
  "multiplier",
  "entryPrice",
  "exitPrice",
  "stopPrice",
  "targetPrice",
  "fees",
  "strike",
  "expiry",
  "right",
  "setup",
  "grade",
  "lesson",
  "pnl",
  "rMultiple",
  "entryAt",
  "exitAt",
  "notes",
] as const;

function cell(v: unknown): string {
  if (v == null) return "";
  const s = v instanceof Date ? v.toISOString() : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function namesByTrade(rows: { tradeId: number; name: string }[]) {
  const map = new Map<number, string[]>();
  for (const r of rows) map.set(r.tradeId, [...(map.get(r.tradeId) ?? []), r.name]);
  return map;
}

export async function GET() {
  const rows = await db.select().from(trades).orderBy(desc(trades.entryAt));
  const tagMap = namesByTrade(
    await db
      .select({ tradeId: tradeTags.tradeId, name: tags.name })
      .from(tradeTags)
      .innerJoin(tags, eq(tradeTags.tagId, tags.id)),
  );
  const mistakeMap = namesByTrade(
    await db
      .select({ tradeId: tradeMistakes.tradeId, name: mistakes.name })
      .from(tradeMistakes)
      .innerJoin(mistakes, eq(tradeMistakes.mistakeId, mistakes.id)),
  );

  const header = [...COLS, "tags", "mistakes"].join(",");
  const lines = rows.map((r) =>
    [
      ...COLS.map((c) => cell((r as Record<string, unknown>)[c])),
      cell((tagMap.get(r.id) ?? []).join("; ")),
      cell((mistakeMap.get(r.id) ?? []).join("; ")),
    ].join(","),
  );
  const csv = [header, ...lines].join("\n");
  const filename = `trades-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
