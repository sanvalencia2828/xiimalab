/**
 * lib/profile/markdown.ts
 * Perfil exportado a Markdown: datos personales, proyectos del portafolio,
 * skills demostradas y tracks con su avance. Función pura: recibe los datos
 * ya calculados.
 */
import { PROFILE_LINKS, type Profile } from "./data";

export interface ExportProject {
    title: string;
    description: string;
    stack: string[];
    liveUrl?: string;
    githubUrl?: string;
}

export interface ExportSkill {
    label: string;
    projects: string[];
}

export interface ExportTrack {
    title: string;
    done: number;
    total: number;
    percent: number;
}

export interface ProfileExport {
    profile: Profile;
    stellarAddress: string | null;
    solanaAddress: string | null;
    projects: ExportProject[];
    /** null si no se pudieron calcular */
    skills: ExportSkill[] | null;
    tracks: ExportTrack[];
    date: Date;
}

export function buildProfileMarkdown({ profile, stellarAddress, solanaAddress, projects, skills, tracks, date }: ProfileExport): string {
    const lines: string[] = [`# ${profile.name || "Mi perfil"}`, ""];
    if (profile.bio) lines.push(profile.bio, "");

    const links = PROFILE_LINKS.filter(({ key }) => profile.links[key]);
    if (links.length > 0) {
        lines.push("## Enlaces", "");
        for (const { key, label } of links) lines.push(`- ${label}: ${profile.links[key]}`);
        lines.push("");
    }

    if (stellarAddress || solanaAddress) {
        lines.push("## Wallets", "");
        if (stellarAddress) lines.push(`- Stellar: \`${stellarAddress}\``);
        if (solanaAddress) lines.push(`- Solana: \`${solanaAddress}\``);
        lines.push("");
    }

    lines.push("## Proyectos", "");
    for (const project of projects) {
        lines.push(`### ${project.title}`, "", project.description, "", `- Stack: ${project.stack.join(", ")}`);
        if (project.liveUrl) lines.push(`- Demo: ${project.liveUrl}`);
        if (project.githubUrl) lines.push(`- Repositorio: ${project.githubUrl}`);
        lines.push("");
    }

    lines.push("## Skills demostradas", "");
    if (skills === null) lines.push("No se pudieron calcular al exportar.");
    else if (skills.length === 0) lines.push("Ninguna todavía.");
    else for (const skill of skills) lines.push(`- ${skill.label} — ${skill.projects.join(", ")}`);
    lines.push("");

    lines.push("## Tracks de aprendizaje", "");
    if (tracks.length === 0) lines.push("Ningún track activo.");
    else for (const track of tracks) lines.push(`- ${track.title}: ${track.done} de ${track.total} hitos (${track.percent} %)`);
    lines.push("");

    const day = date.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
    lines.push("---", "", `Generado en Xiimalab el ${day}.`, "");
    return lines.join("\n");
}
