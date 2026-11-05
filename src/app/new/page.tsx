import TradeForm from "@/components/TradeForm";
import { getAllMistakes, getAllTags, getDistinctSetups } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function NewTradePage() {
  const [setups, allTags, allMistakes] = await Promise.all([
    getDistinctSetups(),
    getAllTags(),
    getAllMistakes(),
  ]);
  return (
    <>
      <div className="page-head">
        <h1>New Trade</h1>
      </div>
      <TradeForm setups={setups} allTags={allTags} allMistakes={allMistakes} />
    </>
  );
}
