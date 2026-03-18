"use server";

import { createClient } from "@supabase/supabase-js";
import { HackathonData } from "@/components/OpportunityCard";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function getSmartMatchHackathons(studentAddress?: string | null): Promise<HackathonData[]> {
    try {
        let rawData: any[] = [];

        if (studentAddress) {
            // Invoca la nueva función RPC de pgvector
            const { data, error } = await supabase.rpc('match_hackathons', { 
                p_student_address: studentAddress, 
                match_threshold: 0.5,
                match_count: 20
            });
            
            if (error) {
                console.error("Error from RPC match_hackathons:", error);
                // Fallback to normal fetch in case RPC fails (e.g. still deploying DB)
            } else {
                rawData = data || [];
            }
        }
        
        // Si no hay studentAddress (o falló el RPC)
        if (!rawData || rawData.length === 0) {
            const { data, error } = await supabase
                .from('active_hackathons')
                .select('*')
                .order('deadline', { ascending: true })
                .limit(10);
                
            if (error) {
                console.error("Supabase Error fetching hackathons:", error);
                return [];
            }
            rawData = data || [];
        }

        // Mapeo seguro a la interfaz
        return rawData.map((hackathon) => {
            return {
                id: hackathon.id || String(Math.random()),
                title: hackathon.title || "Hackathon no identificada",
                description: hackathon.description || "Sin descripción disponible.",
                date: hackathon.deadline ? new Date(hackathon.deadline).toLocaleDateString() : "TBD",
                location: hackathon.location || "Global (Online)",
                tags: hackathon.tags || [],
                gradient: "border-white/10",
                url: hackathon.url || hackathon.source_url,
                source_url: hackathon.source_url,
                source: hackathon.source,
                prize_pool: hackathon.prize_pool,
                deadline: hackathon.deadline,
                last_seen_at: hackathon.last_seen_at,
                match_score: hackathon.match_score || undefined,
                missing_skills: hackathon.missing_skills || [],
                project_highlight: hackathon.project_highlight || undefined,
            };
        });

    } catch (e) {
        console.error("Failure processing smart match:", e);
        return [];
    }
}
