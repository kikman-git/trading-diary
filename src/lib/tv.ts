/** Build a TradingView chart deep-link. Options link the underlying's chart. */
export function tradingViewUrl(
  symbol: string,
  exchange?: string | null,
): string {
  const clean = symbol.toUpperCase().replace(/\s+/g, "");
  const sym = exchange ? `${exchange.toUpperCase()}:${clean}` : clean;
  return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(sym)}`;
}
