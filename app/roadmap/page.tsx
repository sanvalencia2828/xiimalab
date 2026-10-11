/**
 * app/roadmap/page.tsx — SERVER COMPONENT
 * Roadmap de aprendizaje: lista de tracks con su avance.
 */
import type { Metadata } from "next";
import { Map } from "lucide-react";
import { TrackList } from "@/components/learning/TrackList";
import { TRACKS, countMilestones } from "@/lib/learning/tracks";

export const metadata: Metadata = {
    title: "Roadmap de aprendizaje | Xiimalab",
    description:
        "Tracks de aprendizaje de IA, agentes, blockchain, full stack y MLOps, con hitos verificables y hackatones abiertas para practicar cada fase.",
};

export default function RoadmapPage() {
    const totalMilestones = TRACKS.reduce((sum, track) => sum + countMilestones(track), 0);

    return (
        <div className="p-6 min-h-screen">
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-2 h-2 rounded-full bg-accent" />
                    <span className="text-xs font-medium text-accent uppercase tracking-widest">Aprendizaje</span>
                </div>
                <div className="flex items-start justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-1">Roadmap de aprendizaje</h1>
                        <p className="text-slate-400 text-sm max-w-2xl">
                            Cada track se divide en fases con hitos que puedes demostrar con un repo, una demo o un despliegue.
                        </p>
                    </div>
                    <span className="badge-accent flex items-center gap-1.5">
                        <Map className="w-3 h-3" />
                        {TRACKS.length} tracks · {totalMilestones} hitos
                    </span>
                </div>
            </div>

            <TrackList tracks={TRACKS} />

            <footer className="mt-10 pt-4 border-t border-border text-xs text-muted-text">
                Referencias:{" "}
                <a href="https://roadmap.sh" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                    roadmap.sh
                </a>
                . El contenido de los tracks es propio de Xiimalab; roadmap.sh se enlaza solo como referencia externa.
            </footer>
        </div>
    );
}
