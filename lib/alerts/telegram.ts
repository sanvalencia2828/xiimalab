/**
 * lib/alerts/telegram.ts
 * Aviso por Telegram si hay credenciales; si no, por consola.
 */

export type NotifyChannel = "telegram" | "consola";

export function hasTelegram(): boolean {
    return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

/** Envía el mensaje. Lanza error si Telegram lo rechaza, para no dar la alerta por enviada. */
export async function notify(text: string, fetchImpl: typeof fetch = fetch): Promise<NotifyChannel> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) {
        console.log(`[alerta] ${text}`);
        return "consola";
    }

    const res = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
        signal: AbortSignal.timeout(8000),
    });
    // Sin el cuerpo ni la URL en el error: la URL lleva el token
    if (!res.ok) throw new Error(`Telegram respondió ${res.status}`);
    return "telegram";
}
