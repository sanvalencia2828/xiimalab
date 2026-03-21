import { motion } from "framer-motion";
import { Coins, Wallet, TrendingUp, Lock, CheckCircle } from "lucide-react";
import AchievementBadge from "./AchievementBadge";

interface TokenBalance {
  totalEarned: number;
  stakedAmount: number;
  availableBalance: number;
  recentTransactions: {
    id: string;
    amount: number;
    type: "earned" | "staked" | "released";
    timestamp: string;
    description: string;
  }[];
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  earnedDate?: string;
  isUnlocked: boolean;
}

interface StakingPanelProps {
  tokenBalance: TokenBalance | null;
  achievements: Achievement[];
}

export default function StakingPanel({
  tokenBalance,
  achievements,
}: StakingPanelProps) {
  // Get unlocked achievements
  const unlockedAchievements = achievements.filter(
    (achievement) => achievement.isUnlocked
  );

  return (
    <div className="space-y-6">
      {/* Wallet Balance Card */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="relative bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/20 rounded-2xl p-6 overflow-hidden"
      >
        {/* Background Image */}
        <div 
          className="absolute inset-0 opacity-20 pointer-events-none mix-blend-overlay"
          style={{ backgroundImage: 'url(/assets/blockchain-bg.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}
        />
        <div className="relative z-10 w-full h-full">
          <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Wallet className="w-4 h-4 text-amber-400" />
            Balance de Tokens
          </h3>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-xs text-slate-500">Balance Disponible</p>
              <p className="text-2xl font-bold text-amber-400">
                {tokenBalance?.availableBalance || 0} XLM
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Total Ganado</p>
              <p className="text-lg font-bold text-slate-200">
                {tokenBalance?.totalEarned || 0} XLM
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-amber-500/10">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">Staked</span>
              <span className="text-sm font-bold text-amber-400">
                {tokenBalance?.stakedAmount || 0} XLM
              </span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden mt-2">
              <motion.div
                className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full"
                initial={{ width: 0 }}
                animate={{
                  width: tokenBalance
                    ? `${Math.min(100, (tokenBalance.stakedAmount / tokenBalance.totalEarned) * 100)}%`
                    : "0%",
                }}
                transition={{ duration: 1 }}
              />
            </div>
          </div>
        </div>

        {/* Staking Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full mt-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl font-medium text-white flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
        >
          <Lock className="w-4 h-4" />
          Hacer Staking de Tokens
        </motion.button>
        </div>
      </motion.div>

      {/* Recent Transactions */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card border border-border rounded-2xl p-6"
      >
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-accent" />
          Transacciones Recientes
        </h3>

        <div className="space-y-3">
          {tokenBalance?.recentTransactions.slice(0, 3).map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between p-3 bg-slate-800/40 rounded-lg border border-slate-700/40"
            >
              <div>
                <p className="text-sm text-slate-200">{tx.description}</p>
                <p className="text-xs text-slate-500">
                  {new Date(tx.timestamp).toLocaleDateString("es-ES", {
                    day: "numeric",
                    month: "short",
                  })}
                </p>
              </div>
              <div className="text-right">
                <p
                  className={`text-sm font-bold ${
                    tx.type === "earned"
                      ? "text-emerald-400"
                      : tx.type === "staked"
                      ? "text-amber-400"
                      : "text-slate-400"
                  }`}
                >
                  {tx.type === "earned" ? "+" : ""}
                  {tx.amount} XLM
                </p>
                <p className="text-xs text-slate-500 capitalize">{tx.type}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Achievements Section */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card border border-border rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-accent" />
            Logros Desbloqueados
          </h3>
          <span className="text-xs text-slate-500">
            {unlockedAchievements.length} de {achievements.length}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {unlockedAchievements.slice(0, 4).map((achievement) => (
            <AchievementBadge
              key={achievement.id}
              achievement={achievement}
            />
          ))}
          {unlockedAchievements.length < 4 &&
            Array(4 - unlockedAchievements.length)
              .fill(null)
              .map((_, i) => (
                <div
                  key={`locked-${i}`}
                  className="aspect-square bg-slate-800/50 border border-dashed border-slate-700 rounded-xl flex items-center justify-center"
                >
                  <Lock className="w-5 h-5 text-slate-600" />
                </div>
              ))}
        </div>
      </motion.div>
    </div>
  );
}