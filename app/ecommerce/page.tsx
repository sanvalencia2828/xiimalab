// app/ecommerce/page.tsx
import { ShoppingBag, ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

export default function EcommercePage() {
    return (
        <div className="p-6 min-h-screen flex items-center justify-center">
            <div className="text-center max-w-md">
                <div className="w-16 h-16 rounded-2xl bg-warning/10 border border-warning/20 flex items-center justify-center mx-auto mb-6">
                    <ShoppingBag className="w-8 h-8 text-warning" />
                </div>
                <div className="inline-flex items-center gap-2 bg-warning/10 border border-warning/20 rounded-full px-3 py-1 text-xs font-semibold text-warning mb-4">
                    <Sparkles className="w-3 h-3" />
                    Próximamente
                </div>
                <h1 className="text-2xl font-bold text-white mb-3">
                    Xiima Ecommerce
                </h1>
                <p className="text-slate-400 text-sm leading-relaxed mb-8">
                    Puente de comercio electrónico con integración Stellar y
                    pagos on-chain. En desarrollo activo.
                </p>
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:text-accent-bright transition-colors"
                >
                    Volver al Dashboard
                    <ArrowRight className="w-4 h-4" />
                </Link>
            </div>
        </div>
    );
}
