/**
 * app/ecommerce/loading.tsx
 * Skeleton automatico — Next.js lo activa en navegacion a /ecommerce.
 * Debe tener la misma estructura visual que page.tsx para evitar layout shift.
 */
export default function EcommerceLoading() {
    return (
        <div className="p-6 min-h-screen">
            {/* Header skeleton */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-2 h-2 rounded-full skeleton" />
                    <div className="h-3 w-32 rounded skeleton" />
                </div>
                <div className="h-8 w-64 rounded-lg skeleton mb-2" />
                <div className="h-4 w-80 rounded skeleton" />
            </div>

            {/* Stats bar skeleton */}
            <div className="grid grid-cols-3 gap-4 mb-8">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="card-premium rounded-xl p-4 flex items-center gap-4">
                        <div className="w-9 h-9 rounded-lg skeleton shrink-0" />
                        <div className="space-y-2 flex-1">
                            <div className="h-5 w-16 rounded skeleton" />
                            <div className="h-3 w-24 rounded skeleton" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Main 2-col skeleton */}
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
                {/* Left — courses */}
                <div className="space-y-4">
                    <div className="h-5 w-40 rounded skeleton mb-4" />
                    {[1, 2].map((i) => (
                        <div key={i} className="card-premium rounded-2xl p-6">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex-1 space-y-2">
                                    <div className="h-5 w-3/4 rounded skeleton" />
                                    <div className="h-3 w-full rounded skeleton" />
                                    <div className="h-3 w-2/3 rounded skeleton" />
                                </div>
                                <div className="w-20 h-6 rounded-full skeleton ml-4" />
                            </div>
                            {/* Progress bar */}
                            <div className="mb-4">
                                <div className="flex justify-between mb-2">
                                    <div className="h-3 w-28 rounded skeleton" />
                                    <div className="h-3 w-10 rounded skeleton" />
                                </div>
                                <div className="h-2 w-full rounded-full skeleton" />
                            </div>
                            {/* Metrics */}
                            <div className="pt-4 border-t border-border grid grid-cols-3 gap-2">
                                {[1, 2, 3].map((j) => (
                                    <div key={j} className="text-center space-y-1">
                                        <div className="h-5 w-12 rounded skeleton mx-auto" />
                                        <div className="h-3 w-16 rounded skeleton mx-auto" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Right — escrow panel */}
                <div className="space-y-4">
                    <div className="h-5 w-36 rounded skeleton mb-4" />
                    {/* Wallet block */}
                    <div className="card-premium rounded-2xl p-5">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-9 h-9 rounded-xl skeleton" />
                            <div className="space-y-1.5 flex-1">
                                <div className="h-4 w-32 rounded skeleton" />
                                <div className="h-3 w-20 rounded skeleton" />
                            </div>
                        </div>
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="mb-4">
                                <div className="flex justify-between mb-2">
                                    <div className="h-3 w-24 rounded skeleton" />
                                    <div className="h-3 w-16 rounded skeleton" />
                                </div>
                                <div className="h-2 w-full rounded-full skeleton" />
                            </div>
                        ))}
                        <div className="h-10 w-full rounded-xl skeleton mt-4" />
                    </div>
                </div>
            </div>
        </div>
    );
}
