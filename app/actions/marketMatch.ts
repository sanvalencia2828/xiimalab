"use server";

import { createClient } from "@supabase/supabase-js";

// Ensure Supabase environment variables are present
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

export async function getRecommendedHackathons(studentAddress: string | null) {
    try {
        // Fetch base active hackathons from the database
        const { data, error } = await supabase
            .from("active_hackathons")
            .select("*")
            .order("deadline", { ascending: true })
            .limit(20);

        if (error) {
            console.error("Supabase Error fetching hackathons:", error);
            return [];
        }

        if (!data) return [];

        // Simulate Market Match Engine processing with random matchScores between 75 and 98
        // OpenClaw will eventually connect this to a real pgvector RPC function
        const simulatedMatches = data.map((hackathon) => {
            let mockScore: number | undefined = undefined;
            
            // If the user has a connected wallet, we provide a match score
            if (studentAddress) {
                mockScore = Math.floor(Math.random() * (98 - 75 + 1)) + 75;
            }

            return {
                id: hackathon.id,
                title: hackathon.title,
                description: hackathon.description,
                date: new Date(hackathon.deadline).toLocaleDateString(),
                location: hackathon.location || "Global (Online)",
                tags: hackathon.tags || [],
                gradient: "border-white/10", // Default simple gradient
                url: hackathon.url,
                matchScore: mockScore,
                deadline: hackathon.deadline // Retaining raw deadline for sorting later if needed
            };
        });

        // Sort by MatchScore (highest first) if available
        simulatedMatches.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

        return simulatedMatches;
    } catch (e) {
        console.error("Failure fetching recommended hackathons:", e);
        return [];
    }
}
