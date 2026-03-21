import { motion } from "framer-motion";
import { BookOpen, Coins, Target, TrendingUp } from "lucide-react";

interface CourseProgress {
  courseId: string;
  courseName: string;
  progress: number;
  modulesCompleted: number;
  totalModules: number;
  lastAccessed: string;
}

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

interface StudentMetricsProps {
  courseProgress: CourseProgress[];
  tokenBalance: TokenBalance | null;
}

export default function StudentMetrics({
  courseProgress,
  tokenBalance,
}: StudentMetricsProps) {
  // Calculate overall progress
  const totalModules = courseProgress.reduce(
    (sum, course) => sum + course.totalModules,
    0
  );
  const completedModules = courseProgress.reduce(
    (sum, course) => sum + course.modulesCompleted,
    0
  );
  const overallProgress =
    totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

  const metrics = [
    {
      title: "Progreso del Curso",
      value: `${overallProgress}%`,
      icon: BookOpen,
      color: "text-blue-400",
      description: `${completedModules} de ${totalModules} módulos completados`,
    },
    {
      title: "Tokens Acumulados",
      value: tokenBalance?.totalEarned.toString() || "0",
      icon: Coins,
      color: "text-amber-400",
      description: `${tokenBalance?.availableBalance || 0} disponibles`,
    },
    {
      title: "Cursos Activos",
      value: courseProgress.length.toString(),
      icon: Target,
      color: "text-emerald-400",
      description: "En progreso",
    },
    {
      title: "Racha de Estudio",
      value: "7 días",
      icon: TrendingUp,
      color: "text-purple-400",
      description: "Mantén la consistencia",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric, index) => {
        const Icon = metric.icon;
        return (
          <motion.div
            key={metric.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-card border border-border rounded-2xl p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2 rounded-lg bg-${metric.color.split("-")[1]}-500/10`}>
                <Icon className={`w-5 h-5 ${metric.color}`} />
              </div>
              <span className="text-xs text-slate-500 font-medium">
                {metric.title}
              </span>
            </div>
            <p className={`text-2xl font-bold ${metric.color}`}>{metric.value}</p>
            <p className="text-xs text-slate-500 mt-1">{metric.description}</p>
          </motion.div>
        );
      })}
    </div>
  );
}