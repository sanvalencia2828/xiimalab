/**
 * app/roadmap/[track]/page.tsx — SERVER COMPONENT
 * Un track: fases como timeline vertical con hitos marcables. En el servidor
 * se cruza cada fase con las hackatones abiertas (agregador en vivo) y con
 * los proyectos del portafolio; si el agregador falla, la fase se muestra sin ellas.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { ResourceList } from "@/components/learning/ResourceList";
import { type PhaseExtras, TrackTimeline } from "@/components/learning/TrackTimeline";
import { getLiveHackathons } from "@/lib/hackathons/live";
import { hackathonsForPhase, projectsForPhase } from "@/lib/learning/connect";
import { ecosystemNote, providersForTrack, resourcesForPhase, trackWideResources } from "@/lib/learning/resources";
import { TRACKS, getTrack } from "@/lib/learning/tracks";
import { PROJECTS } from "@/lib/projects/data";
import type { AggregatedHackathon } from "@/lib/types";

export const dynamic = "force-dynamic";

interface PageProps {
    params: { track: string };
}

export function generateMetadata({ params }: PageProps): Metadata {
    const track = getTrack(params.track);
    if (!track) return { title: "Track no encontrado | Xiimalab" };
    return { title: `${track.title} · Roadmap | Xiimalab`, description: track.description };
}

async function fetchOpenHackathons(): Promise<AggregatedHackathon[]> {
    try {
        return (await getLiveHackathons()).hackathons;
    } catch (err) {
        console.warn("[roadmap/track] live sources error:", err);
        return [];
    }
}

export default async function TrackPage({ params }: PageProps) {
    const track = getTrack(params.track);
    if (!track) notFound();

    const hackathons = await fetchOpenHackathons();
    const extras: Record<string, PhaseExtras> = Object.fromEntries(
        track.phases.map((phase) => [
            phase.id,
            {
                hackathons: hackathonsForPhase(phase, hackathons),
                projects: projectsForPhase(phase, PROJECTS),
                resources: resourcesForPhase(track.id, phase.id).map((r) => ({ ...r, note: ecosystemNote(r, track.ecosystem) })),
            },
        ]),
    );
    const position = TRACKS.findIndex((t) => t.id === track.id) + 1;
    const certifications = trackWideResources(track.id).map((r) => ({ ...r, note: ecosystemNote(r, track.ecosystem) }));

    return (
        <div className="p-6 min-h-screen max-w-4xl">
            <Link href="/roadmap" className="inline-flex items-center gap-1.5 text-xs text-muted-text hover:text-accent mb-4">
                <ArrowLeft className="w-3.5 h-3.5" />
                Todos los tracks
            </Link>

            <div className="mb-8">
                <span className="text-xs font-medium text-accent uppercase tracking-widest">
                    Track {position} de {TRACKS.length}
                </span>
                <h1 className="text-3xl font-bold text-white mt-1 mb-2">{track.title}</h1>
                <p className="text-slate-400 text-sm max-w-2xl mb-4">{track.description}</p>
                <div className="flex flex-wrap items-center gap-2">
                    <a href={track.referenceUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost inline-flex items-center gap-1.5 text-xs">
                        Ver referencia en roadmap.sh
                        <ExternalLink className="w-3 h-3" />
                    </a>
                    {providersForTrack(track.id).map((provider) => (
                        <a key={provider.id} href={provider.url} target="_blank" rel="noopener noreferrer" className="btn-ghost inline-flex items-center gap-1.5 text-xs">
                            Recursos de {provider.name}
                            <ExternalLink className="w-3 h-3" />
                        </a>
                    ))}
                    {track.secondaryReferences?.map((ref) => (
                        <a
                            key={ref.url}
                            href={ref.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-300 rounded-md border border-slate-600/30 bg-slate-700/30 hover:border-accent/50"
                        >
                            {ref.label}
                            <ExternalLink className="w-3 h-3" />
                        </a>
                    ))}
                </div>
            </div>

            <TrackTimeline track={track} extras={extras} />

            {certifications.length > 0 && (
                <section className="card-premium p-5 mb-6">
                    <h2 className="text-base font-semibold text-slate-200 mb-1">Certificaciones reconocidas</h2>
                    <p className="text-xs text-muted-text mb-3">
                        Si obtienes una, añádela en Mi Perfil: cuenta como la evidencia más fuerte de sus skills.
                    </p>
                    <ResourceList resources={certifications} />
                </section>
            )}

            <footer className="mt-6 pt-4 border-t border-border text-xs text-muted-text">
                Referencias:{" "}
                <a href="https://roadmap.sh" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                    roadmap.sh
                </a>
                . El contenido de las fases es propio de Xiimalab.
            </footer>
        </div>
    );
}
