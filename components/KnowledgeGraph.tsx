"use client";

import { useState, useEffect } from "react";
import { Radar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
} from "chart.js";

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

type KnowledgeItem = { skill: string; strength: number };
type KnowledgeMapData = { knowledge_map: KnowledgeItem[] };

export default function KnowledgeGraph() {
  const [knowledgeData, setKnowledgeData] = useState<KnowledgeMapData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/profile/knowledge-map");
        const data = await response.json();
        setKnowledgeData(data);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching knowledge map:", error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (!knowledgeData || knowledgeData.knowledge_map.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 text-center">
        <p className="text-muted-text">No hay datos de conocimiento disponibles aún.</p>
      </div>
    );
  }

  // Prepare data for radar chart
  const labels = knowledgeData.knowledge_map.map((item: KnowledgeItem) => item.skill);
  const dataPoints = knowledgeData.knowledge_map.map((item: KnowledgeItem) => item.strength);

  // Ensure we have at least 3 points for the radar chart
  let chartLabels = labels;
  let chartData = dataPoints;
  if (labels.length < 3) {
    chartLabels = [...labels, ...Array(3 - labels.length).fill("N/A")];
    chartData = [...dataPoints, ...Array(3 - dataPoints.length).fill(0)];
  }

  const chartDataConfig = {
    labels: chartLabels,
    datasets: [
      {
        label: "Fortaleza de Habilidades",
        data: chartData,
        backgroundColor: "rgba(59, 130, 246, 0.2)",
        borderColor: "rgba(59, 130, 246, 1)",
        borderWidth: 2,
        pointBackgroundColor: "rgba(59, 130, 246, 1)",
        pointBorderColor: "#fff",
        pointHoverBackgroundColor: "#fff",
        pointHoverBorderColor: "rgba(59, 130, 246, 1)",
      },
    ],
  };

  const options = {
    scales: {
      r: {
        angleLines: {
          color: "rgba(255, 255, 255, 0.1)",
        },
        grid: {
          color: "rgba(255, 255, 255, 0.1)",
        },
        pointLabels: {
          color: "rgba(255, 255, 255, 0.7)",
          font: {
            size: 12,
          },
        },
        ticks: {
          backdropColor: "transparent",
          color: "rgba(255, 255, 255, 0.5)",
          stepSize: 20,
        },
      },
    },
    plugins: {
      legend: {
        labels: {
          color: "rgba(255, 255, 255, 0.7)",
        },
      },
    },
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 1,
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h2 className="text-xl font-bold text-slate-100 mb-6">Mapa de Conocimiento</h2>
      <div className="aspect-square max-w-lg mx-auto">
        <Radar data={chartDataConfig} options={options} />
      </div>
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">Desglose de Habilidades</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {knowledgeData.knowledge_map.map((item: KnowledgeItem, index: number) => (
            <div key={index} className="bg-background/50 border border-border rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-slate-100">{item.skill}</span>
                <span className="text-accent font-bold">{item.strength.toFixed(2)}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-accent h-2 rounded-full"
                  style={{ width: `${item.strength}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}