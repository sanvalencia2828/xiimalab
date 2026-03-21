import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const FALLBACK_ROADMAPS: Record<string, { roadmap: Array<{title: string; duration: string; type: string; description: string}>; estimated_total: string }> = {
    "AI": {
        roadmap: [
            { title: "Fundamentos de Machine Learning", duration: "4h", type: "Doc", description: "Aprende los conceptos básicos: regresión, clasificación, clustering" },
            { title: "Deep Learning Essentials", duration: "6h", type: "Video", description: "Redes neuronales, backpropagation, optimizadores" },
            { title: "LLM Fundamentals", duration: "5h", type: "Doc", description: "Transformers, attention mechanism, fine-tuning básico" },
            { title: "Proyecto: Clasificador de Imágenes", duration: "8h", type: "Project", description: "Construye un modelo de clasificación con PyTorch o TensorFlow" },
            { title: "API con OpenAI/Anthropic", duration: "3h", type: "Doc", description: "Integración de modelos en aplicaciones reales" },
        ],
        estimated_total: "26h"
    },
    "BLOCKCHAIN": {
        roadmap: [
            { title: "Conceptos de Blockchain", duration: "3h", type: "Doc", description: "Descentralización, consenso, criptografía básica" },
            { title: "Ethereum y Smart Contracts", duration: "5h", type: "Video", description: "EVM, Solidity, estructuras de datos en blockchain" },
            { title: "Desarrollo con Hardhat", duration: "6h", type: "Project", description: "Setup, testing y deployment de contratos" },
            { title: "Tokens ERC-20 y ERC-721", duration: "4h", type: "Doc", description: "Estándares de tokens y mejores prácticas" },
            { title: "Proyecto: Token y NFT", duration: "10h", type: "Project", description: "Crea tu propio token y colección NFT" },
        ],
        estimated_total: "28h"
    },
    "DEFI": {
        roadmap: [
            { title: "Fundamentos DeFi", duration: "3h", type: "Doc", description: "AMMs, liquidity pools, yield farming" },
            { title: "Solidity Intermedio", duration: "5h", type: "Video", description: "Mappings, modifiers, eventos, gas optimization" },
            { title: "Protocolos: Uniswap, Aave", duration: "4h", type: "Doc", description: "Cómo funcionan los protocolos DeFi principales" },
            { title: "Security en DeFi", duration: "4h", type: "Doc", description: "Reentrancy, flash loans, auditorías" },
            { title: "Proyecto: DEX básico", duration: "12h", type: "Project", description: "Construye un exchange descentralizado simplificado" },
        ],
        estimated_total: "28h"
    },
    "WEB3": {
        roadmap: [
            { title: "Introducción a Web3", duration: "2h", type: "Doc", description: "Wallets, dApps, blockchain networks" },
            { title: "Web3.js / Ethers.js", duration: "4h", type: "Video", description: "Conexión a blockchain desde JavaScript" },
            { title: "IPFS y Almacenamiento", duration: "3h", type: "Doc", description: "Almacenamiento descentralizado de archivos" },
            { title: "Autenticación con Wallet", duration: "3h", type: "Project", description: "Login con MetaMask u otras wallets" },
            { title: "Proyecto: dApp Completa", duration: "10h", type: "Project", description: "Construye una dApp con frontend y smart contracts" },
        ],
        estimated_total: "22h"
    },
    "PYTHON": {
        roadmap: [
            { title: "Sintaxis y Estructuras", duration: "3h", type: "Doc", description: "Variables, funciones, listas, diccionarios" },
            { title: "POO en Python", duration: "3h", type: "Doc", description: "Clases, herencia, polimorfismo" },
            { title: "Módulos y Paquetes", duration: "2h", type: "Doc", description: "pip, virtualenv, imports" },
            { title: "FastAPI o Flask", duration: "5h", type: "Video", description: "Crear APIs REST con Python" },
            { title: "Proyecto: API REST", duration: "8h", type: "Project", description: "Construye una API completa con base de datos" },
        ],
        estimated_total: "21h"
    },
    "REACT": {
        roadmap: [
            { title: "Fundamentos de React", duration: "4h", type: "Video", description: "Componentes, JSX, props, estado" },
            { title: "Hooks Essenciales", duration: "4h", type: "Doc", description: "useState, useEffect, useContext" },
            { title: "React Router", duration: "2h", type: "Doc", description: "Navegación SPA" },
            { title: "State Management", duration: "3h", type: "Doc", description: "Context API, Zustand, o Redux basics" },
            { title: "Proyecto: App Completa", duration: "12h", type: "Project", description: "Construye una app con API y routing" },
        ],
        estimated_total: "25h"
    },
    "SOLIDITY": {
        roadmap: [
            { title: "Sintaxis de Solidity", duration: "4h", type: "Doc", description: "Tipos, funciones, visibilidad" },
            { title: "Estructuras de Datos", duration: "3h", type: "Doc", description: "Mappings, structs, arrays" },
            { title: "Smart Contract Patterns", duration: "4h", type: "Doc", description: "Modifiers, events, error handling" },
            { title: "Testing con Hardhat", duration: "5h", type: "Project", description: "Unit tests y integration tests" },
            { title: "Proyecto: Token ERC-20", duration: "6h", type: "Project", description: "Despliega tu propio token en testnet" },
        ],
        estimated_total: "22h"
    },
};

function getFallbackRoadmap(skill: string, targetLevel: number) {
    const skillUpper = skill.toUpperCase();
    
    for (const [key, value] of Object.entries(FALLBACK_ROADMAPS)) {
        if (skillUpper.includes(key) || key.includes(skillUpper)) {
            return {
                skill,
                target_level: targetLevel,
                roadmap: value.roadmap,
                estimated_total: value.estimated_total,
                source: "fallback",
            };
        }
    }
    
    return {
        skill,
        target_level: targetLevel,
        roadmap: [
            { title: `Fundamentos de ${skill}`, duration: "4h", type: "Doc", description: "Aprende los conceptos básicos y la teoría" },
            { title: `Primeros Pasos en ${skill}`, duration: "6h", type: "Video", description: "Tutoriales prácticos y ejercicios guiados" },
            { title: `Proyecto Introductorio`, duration: "8h", type: "Project", description: "Aplica lo aprendido en un proyecto pequeño" },
            { title: `Avanzando en ${skill}`, duration: "8h", type: "Doc", description: "Temas intermedios y patrones comunes" },
            { title: `Proyecto Intermedio`, duration: "12h", type: "Project", description: "Construye algo más complejo" },
        ],
        estimated_total: "38h",
        source: "default",
    };
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const skill = searchParams.get("skill") || "Python";
    const target = parseInt(searchParams.get("target") || "60", 10);

    const fastapiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    
    try {
        const res = await fetch(`${fastapiUrl}/learning/roadmap?skill=${encodeURIComponent(skill)}&target=${target}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            next: { revalidate: 3600 },
        });

        if (res.ok) {
            const data = await res.json();
            return NextResponse.json(data);
        }
    } catch {
        // Fall through to fallback
    }

    const fallback = getFallbackRoadmap(skill, target);
    return NextResponse.json(fallback);
}
