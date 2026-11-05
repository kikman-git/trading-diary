import { notFound } from "next/navigation";
import TradeForm from "@/components/TradeForm";
import {
  getAllMistakes,
  getAllTags,
  getDistinctSetups,
  getTradeById,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function EditTradePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tid = Number(id);
  const t = Number.isFinite(tid) ? await getTradeById(tid) : null;
  if (!t) notFound();

  const [setups, allTags, allMistakes] = await Promise.all([
    getDistinctSetups(),
    getAllTags(),
    getAllMistakes(),
  ]);

  return (
    <>
      <div className="page-head">
        <h1>
          Edit {t.symbol} <span className="muted">#{t.id}</span>
        </h1>
      </div>
      <TradeForm
        setups={setups}
        allTags={allTags}
        allMistakes={allMistakes}
        trade={t}
      />
    </>
  );
}
