import { motion } from "framer-motion";
import { Trophy, Lock } from "lucide-react";

interface Achievement {
  id: string;
  title: string;
  description: string;
  earnedDate?: string;
  isUnlocked: boolean;
}

interface AchievementBadgeProps {
  achievement: Achievement;
}

export default function AchievementBadge({ achievement }: AchievementBadgeProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`relative aspect-square rounded-xl flex flex-col items-center justify-center p-2 ${
        achievement.isUnlocked
          ? "bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30"
          : "bg-slate-800/50 border border-slate-700/50"
      }`}
    >
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 overflow-hidden ${
          achievement.isUnlocked
            ? "bg-amber-500/20 border border-amber-500/30 p-0"
            : "bg-slate-700/50 border border-slate-600/50 p-2"
        }`}
      >
        {achievement.isUnlocked ? (
          <img src="/assets/achievement-medal.png" alt="Unlocked Medal" className="w-full h-full object-cover" />
        ) : (
          <Lock className="w-4 h-4 text-slate-500" />
        )}
      </div>
      <span
        className={`text-xs font-medium text-center ${
          achievement.isUnlocked ? "text-amber-400" : "text-slate-500"
        }`}
      >
        {achievement.title}
      </span>
      {achievement.earnedDate && (
        <span className="text-[8px] text-slate-500 mt-1">
          {new Date(achievement.earnedDate).toLocaleDateString("es-ES", {
            day: "numeric",
            month: "short",
          })}
        </span>
      )}
    </motion.div>
  );
}