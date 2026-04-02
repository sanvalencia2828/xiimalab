import { Sparkles, LayoutGrid } from "lucide-react";

export default function LoadingHackatones() {
    return (
        <div className="min-h-screen p-6 lg:p-10 max-w-7xl mx-auto space-y-10">
            {/* Header Skeleton */}
            <header className="relative card-premium rounded-3xl p-8 overflow-hidden">
                <div className="relative z-10 max-w-3xl">
                    <div className="w-40 h-7 skeleton rounded-full mb-4"></div>
                    <div className="w-3/4 h-10 skeleton rounded-lg mb-4"></div>
                    <div className="w-full max-w-lg h-16 skeleton rounded-lg mb-6"></div>
                    <div className="flex gap-2">
                        <div className="w-24 h-6 skeleton rounded"></div>
                        <div className="w-24 h-6 skeleton rounded"></div>
                        <div className="w-24 h-6 skeleton rounded"></div>
                    </div>
                </div>
            </header>

            {/* Grid Skeleton */}
            <section>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-slate-400 flex items-center gap-2">
                        <LayoutGrid className="w-5 h-5 opacity-50" />
                        Alineando Nodos (IA)...
                    </h2>
                    <div className="w-16 h-5 skeleton rounded"></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="flex flex-col h-64 card-premium p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-12 h-12 skeleton rounded-xl"></div>
                                <div className="w-16 h-6 skeleton rounded-full"></div>
                            </div>
                            <div className="w-3/4 h-6 skeleton rounded mb-2"></div>
                            <div className="w-full h-10 skeleton rounded mb-4"></div>
                            <div className="flex gap-2 mt-auto">
                                <div className="w-12 h-4 skeleton rounded"></div>
                                <div className="w-16 h-4 skeleton rounded"></div>
                            </div>
                            <div className="w-full h-12 skeleton rounded-xl mt-6"></div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
