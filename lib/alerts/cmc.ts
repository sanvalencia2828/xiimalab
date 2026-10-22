/**
 * lib/alerts/cmc.ts
 * Precios de CoinMarketCap con una sola llamada a v2/cryptocurrency/quotes/latest
 * para todas las monedas, por ID. El coste son 1 crédito por cada 250
 * criptomonedas devueltas (23 monedas = 1 crédito por llamada).
 */

export interface Quote {
    id: number;
    symbol: string;
    price: number;
}

const DEFAULT_BASE_URL = "https://pro-api.coinmarketcap.com";

interface RawCoin {
    id?: unknown;
    symbol?: unknown;
    quote?: { USD?: { price?: unknown } };
}

/**
 * Acepta las formas que usa CMC según la versión y el parámetro: un objeto
 * indexado por ID o símbolo (cuyo valor es una moneda o una lista) o un array.
 */
export function parseQuotes(body: unknown): Quote[] {
    const data = (body as { data?: unknown } | null)?.data;
    const coins: RawCoin[] = [];
    const values = Array.isArray(data) ? data : data && typeof data === "object" ? Object.values(data) : [];
    for (const value of values) {
        if (Array.isArray(value)) coins.push(...(value as RawCoin[]));
        else if (value && typeof value === "object") coins.push(value as RawCoin);
    }

    const quotes: Quote[] = [];
    for (const coin of coins) {
        const price = coin.quote?.USD?.price;
        if (typeof coin.id === "number" && typeof coin.symbol === "string" && typeof price === "number" && price > 0) {
            quotes.push({ id: coin.id, symbol: coin.symbol, price });
        }
    }
    return quotes;
}

export async function fetchQuotes(ids: readonly number[], apiKey: string, fetchImpl: typeof fetch = fetch): Promise<Quote[]> {
    const base = process.env.CMC_BASE_URL || DEFAULT_BASE_URL;
    const url = `${base}/v2/cryptocurrency/quotes/latest?id=${ids.join(",")}&convert=USD`;
    const res = await fetchImpl(url, {
        headers: { "X-CMC_PRO_API_KEY": apiKey, Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`CoinMarketCap respondió ${res.status}`);
    return parseQuotes(await res.json());
}
