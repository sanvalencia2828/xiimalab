/**
 * lib/alerts/config.ts
 * Monedas vigiladas, agrupadas por las categorías de Activos, y sus rangos.
 *
 * Cada moneda se consulta por ID de CoinMarketCap, no por símbolo: los símbolos
 * no son únicos y cambian con los rebrands (FET ahora es la Artificial
 * Superintelligence Alliance). El símbolo queda solo para mostrarlo y para
 * comprobar que la API devuelve la moneda esperada.
 */

export type AlertCategory = "AI" | "DEV CLOUD" | "BLOCKCHAIN";

export interface WatchedAsset {
    /** ID de CoinMarketCap */
    id: number;
    symbol: string;
    name: string;
    category: AlertCategory;
}

export interface PriceRange {
    min: number;
    max: number;
}

export const WATCHED_ASSETS: readonly WatchedAsset[] = [
    // AI
    { id: 6535, symbol: "NEAR", name: "NEAR Protocol", category: "AI" },
    { id: 22974, symbol: "TAO", name: "Bittensor", category: "AI" },
    { id: 8916, symbol: "ICP", name: "Internet Computer", category: "AI" },
    { id: 35509, symbol: "VVV", name: "Venice Token", category: "AI" },
    { id: 5690, symbol: "RENDER", name: "Render", category: "AI" },
    { id: 29420, symbol: "VIRTUAL", name: "Virtuals Protocol", category: "AI" },
    { id: 3773, symbol: "FET", name: "Artificial Superintelligence Alliance", category: "AI" },
    { id: 32956, symbol: "GRASS", name: "Grass", category: "AI" },
    // DEV CLOUD
    { id: 7431, symbol: "AKT", name: "Akash Network", category: "DEV CLOUD" },
    { id: 2280, symbol: "FIL", name: "Filecoin", category: "DEV CLOUD" },
    { id: 29835, symbol: "IO", name: "io.net", category: "DEV CLOUD" },
    { id: 30083, symbol: "ATH", name: "Aethir", category: "DEV CLOUD" },
    { id: 16612, symbol: "NOS", name: "Nosana", category: "DEV CLOUD" },
    { id: 3029, symbol: "FLUX", name: "Flux", category: "DEV CLOUD" },
    { id: 5632, symbol: "AR", name: "Arweave", category: "DEV CLOUD" },
    { id: 1772, symbol: "STORJ", name: "Storj", category: "DEV CLOUD" },
    // BLOCKCHAIN
    { id: 1975, symbol: "LINK", name: "Chainlink", category: "BLOCKCHAIN" },
    { id: 28177, symbol: "PYTH", name: "Pyth Network", category: "BLOCKCHAIN" },
    { id: 21707, symbol: "RED", name: "RedStone", category: "BLOCKCHAIN" },
    { id: 7737, symbol: "API3", name: "API3", category: "BLOCKCHAIN" },
    { id: 1027, symbol: "ETH", name: "Ethereum", category: "BLOCKCHAIN" },
    { id: 5426, symbol: "SOL", name: "Solana", category: "BLOCKCHAIN" },
    { id: 20947, symbol: "SUI", name: "Sui", category: "BLOCKCHAIN" },
];

/**
 * Rangos propios por símbolo, en USD. Si falta uno se usa el rango automático.
 * Ejemplo: SOL: { min: 120, max: 220 }
 */
export const RANGOS: Readonly<Record<string, PriceRange>> = {};

/** Margen del rango automático sobre el primer precio leído: ±10 %. */
export const AUTO_RANGE_PCT = 0.1;
