import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Conectar Wallet — Xiimalab",
    description: "Vincula tu identidad Stellar para acceder a Xiimalab.",
};

/** Layout vacío para /login — no hereda el sidebar del layout raíz */
export default function LoginLayout({ children }: { children: React.ReactNode }) {
    return children;
}
