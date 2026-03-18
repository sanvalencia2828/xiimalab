"use client";

import { useState, useEffect } from "react";
import KnowledgeGraph from "@/components/KnowledgeGraph";

export default function ProfilePage() {
  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-100 mb-2">Perfil de Usuario</h1>
          <p className="text-muted-text">
            Visualiza tu mapa de conocimiento y progreso en la plataforma.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <KnowledgeGraph />
          </div>

          <div className="space-y-8">
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-xl font-bold text-slate-100 mb-4">Estadísticas</h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-text">Hackathones Completados</span>
                  <span className="font-bold text-accent">12</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-text">Habilidades Desarrolladas</span>
                  <span className="font-bold text-accent">24</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-text">Proyectos Publicados</span>
                  <span className="font-bold text-accent">8</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-text">Puntaje de Engagement AURA</span>
                  <span className="font-bold text-accent">92%</span>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-xl font-bold text-slate-100 mb-4">Logros Recientes</h2>
              <ul className="space-y-3">
                <li className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-accent mr-3"></div>
                  <span className="text-slate-100">Maestría en Smart Contracts</span>
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-accent mr-3"></div>
                  <span className="text-slate-100">Participación en EthGlobal</span>
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-accent mr-3"></div>
                  <span className="text-slate-100">Completado Roadmap AI/ML</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}