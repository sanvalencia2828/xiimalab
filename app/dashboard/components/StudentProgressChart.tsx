import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";

interface CourseProgress {
  courseId: string;
  courseName: string;
  progress: number;
  modulesCompleted: number;
  totalModules: number;
  lastAccessed: string;
}

interface StudentProgressChartProps {
  courseProgress: CourseProgress[];
}

export default function StudentProgressChart({
  courseProgress,
}: StudentProgressChartProps) {
  return (
    <div className="space-y-6">
      {/* Progress bars for each course */}
      <div className="space-y-5">
        {courseProgress.map((course, index) => (
          <motion.div
            key={course.courseId}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-accent" />
                <span className="text-sm font-medium text-slate-200">
                  {course.courseName}
                </span>
              </div>
              <span className="text-sm font-bold text-accent">
                {course.progress}%
              </span>
            </div>
            <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-accent to-blue-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${course.progress}%` }}
                transition={{ delay: 0.3 + index * 0.1, duration: 0.8 }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>
                {course.modulesCompleted} de {course.totalModules} módulos
              </span>
              <span>Último acceso: {course.lastAccessed}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Summary statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <p className="text-xs text-slate-500 mb-1">Cursos Completados</p>
          <p className="text-2xl font-bold text-emerald-400">
            {
              courseProgress.filter((course) => course.progress === 100).length
            }
          </p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <p className="text-xs text-slate-500 mb-1">Horas Estudiadas</p>
          <p className="text-2xl font-bold text-blue-400">42</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <p className="text-xs text-slate-500 mb-1">Próximo Hitos</p>
          <p className="text-2xl font-bold text-amber-400">3</p>
        </div>
      </div>
    </div>
  );
}