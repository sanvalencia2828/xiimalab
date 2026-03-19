/**
 * app/aggregated/page.tsx — SERVER COMPONENT
 *
 * Multi-source hackathon discovery page.
 * Displays aggregated hackathons from Devfolio, DoraHacks, and Devpost
 * with intelligent deduplication and personalized scoring.
 */
import type { Metadata } from "next";
import { AggregatedHackathonsClient } from "@/components/AggregatedHackathonsClient";
import WalletOnboardingModal from "@/components/WalletOnboardingModal";

export const metadata: Metadata = {
  title: "Aggregated Hackathons | Xiimalab",
  description:
    "Discover hackathons from multiple platforms with intelligent deduplication and personalized scoring.",
};

export const dynamic = "force-dynamic";

export default function AggregatedPage() {
  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        <AggregatedHackathonsClient />
      </div>
      <WalletOnboardingModal />
    </div>
  );
}
