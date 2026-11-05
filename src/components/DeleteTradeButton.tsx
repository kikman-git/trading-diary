"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteTrade } from "@/app/actions";

export default function DeleteTradeButton({ tradeId }: { tradeId: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function onDelete() {
    if (
      !confirm("Delete this trade and its screenshots? This cannot be undone.")
    )
      return;
    const fd = new FormData();
    fd.set("tradeId", String(tradeId));
    start(async () => {
      await deleteTrade(fd);
      router.push("/");
    });
  }
  return (
    <button className="btn sm danger" onClick={onDelete} disabled={pending}>
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
