"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Trophy,
  Coins,
  Target,
  BookOpen,
  Calendar,
  TrendingUp,
  Brain,
  Award,
  Zap,
  BarChart3,
  Wallet,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import StudentMetrics from "./components/StudentMetrics";
import StudentProgressChart from "./components/StudentProgressChart";
import StakingPanel from "./components/StakingPanel";
import AchievementBadge from "./components/AchievementBadge";
import SkillRadarChart from "./components/SkillRadarChart";

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

interface Achievement {
  id: string;
  title: string;
  description: string;
  earnedDate?: string;
  isUnlocked: boolean;
}

export default function StudentDashboard() {
  const [courseProgress, setCourseProgress] = useState<CourseProgress[]>([]);
  const [tokenBalance, setTokenBalance] = useState<TokenBalance | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [userProfile, setUserProfile] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch User Skills from new API
    const fetchUserSkills = async () => {
      try {
          const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
          // Replace with real auth user ID when Context is ready
          const res = await fetch(`${API_URL}/api/v1/user/test_user_id/skills`);
          if (res.ok) {
              const data = await res.json();
              setUserProfile(data);
          } else {
              // Fallback
              setUserProfile({"AI / LLM": 70, "Data Analytics": 82, "Web3 / DeFi": 65});
          }
      } catch (e) {
          console.error("Failed to load user skills", e);
          setUserProfile({"AI / LLM": 70, "Data Analytics": 82, "Web3 / DeFi": 65});
      }
    };

    fetchUserSkills();

    // Simulate loading internal data
    setTimeout(() => {
      // Mock course progress data
      setCourseProgress([
        {
          courseId: "1",
          courseName: "Introducción a Blockchain",
          progress: 75,
          modulesCompleted: 6,
          totalModules: 8,
          lastAccessed: "2026-03-20",
        },
        {
          courseId: "2",
          courseName: "Desarrollo de Smart Contracts",
          progress: 45,
          modulesCompleted: 4,
          totalModules: 9,
          lastAccessed: "2026-03-19",
        },
        {
          courseId: "3",
          courseName: "Análisis de Datos con Python",
          progress: 90,
          modulesCompleted: 9,
          totalModules: 10,
          lastAccessed: "2026-03-21",
        },
      ]);

      // Mock token balance data
      setTokenBalance({
        totalEarned: 1250,
        stakedAmount: 750,
        availableBalance: 500,
        recentTransactions: [
          {
            id: "1",
            amount: 150,
            type: "earned",
            timestamp: "2026-03-21T10:30:00Z",
            description: "Completar módulo de Blockchain",
          },
          {
            id: "2",
            amount: 500,
            type: "staked",
            timestamp: "2026-03-20T14:15:00Z",
            description: "Staking educativo iniciado",
          },
          {
            id: "3",
            amount: 75,
            type: "earned",
            timestamp: "2026-03-19T09:45:00Z",
            description: "Quiz de Python superado",
          },
        ],
      });

      // Mock achievements
      setAchievements([
        {
          id: "1",
          title: "Primer Paso",
          description: "Completa tu primer curso",
          isUnlocked: true,
          earnedDate: "2026-03-15",
        },
        {
          id: "2",
          title: "Explorador",
          description: "Completa 3 cursos",
          isUnlocked: false,
        },
        {
          id: "3",
          title: "Maestro del Código",
          description: "Obtén 100% en 5 quizzes",
          isUnlocked: true,
          earnedDate: "2026-03-18",
        },
        {
          id: "4",
          title: "Staker Pro",
          description: "Stakea más de 500 tokens",
          isUnlocked: true,
          earnedDate: "2026-03-20",
        },
      ]);

      setLoading(false);
    }, 800);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-accent animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Cargando dashboard del estudiante...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">
                Dashboard del Estudiante
              </h1>
              <p className="text-slate-400">
                Tu progreso académico y financiero en tiempo real
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-2 bg-accent/10 border border-accent/20 rounded-xl">
                <Calendar className="w-4 h-4 text-accent" />
                <span className="text-sm text-slate-300">
                  {new Date().toLocaleDateString("es-ES", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Metrics and Chart Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Metrics Cards */}
            <StudentMetrics
              courseProgress={courseProgress}
              tokenBalance={tokenBalance}
            />

            {/* Progress Chart */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-accent" />
                  Progreso Académico
                </h2>
              </div>
              <StudentProgressChart courseProgress={courseProgress} />
            </div>

            {/* Radar Spider Chart (Market vs User) */}
            <div className="mt-6">
                {userProfile ? (
                    <SkillRadarChart userProfile={userProfile} />
                ) : (
                    <div className="w-full h-80 flex flex-col items-center justify-center bg-card/40 border border-white/5 rounded-3xl backdrop-blur-md">
                        <Loader2 className="w-8 h-8 text-accent animate-spin mb-3" />
                        <p className="text-xs text-slate-400 animate-pulse">Sincronizando perfil neurocognitivo...</p>
                    </div>
                )}
            </div>
          </div>

          {/* Staking Panel */}
          <StakingPanel
            tokenBalance={tokenBalance}
            achievements={achievements}
          />
        </div>
      </div>
    </div>
  );
}