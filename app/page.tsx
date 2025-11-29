import React from 'react';
import { Download, Shield, Zap, Terminal, ArrowRight, Github } from 'lucide-react';
import Image from 'next/image';

export default function Home() {
    const changelog = [
        { version: "v0.1.0", date: "2025-11-29", changes: ["Pierwsze stabilne, publiczne wydanie", "Pełne szyfrowanie plików i haseł", "Pełna obsługa kluczy kryptofraficznych GPG"] },
        { version: "v0.0.1", date: "2025-10-30", changes: ["Pierwsza działająca kompilacja", "Częściowa funkcjonalność", "Brak obsługi kluczy GPG"] },
    ];

    const logoPath = "/logo-full.svg";

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-blue-500/30">

            <nav className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="font-bold text-2xl text-white tracking-tight pt-1">
                            ssVault
                        </span>
                    </div>
                    <div className="flex gap-4">
                        <a href="https://github.com/mromasze/ssVault" target="_blank" rel="noreferrer"
                           className="flex items-center gap-2 text-sm font-medium hover:text-white transition-colors">
                            <Github size={18} />
                            GitHub
                        </a>
                    </div>
                </div>
            </nav>

            <header className="pt-20 pb-16 px-4 text-center">
                <div className="max-w-4xl mx-auto flex flex-col items-center">

                    <div className="mb-8 drop-shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                        <Image
                            src={logoPath}
                            alt="ssVault Main Logo"
                            width={400}
                            height={400}
                            className="h-40 w-auto object-contain"
                            priority
                        />
                    </div>

                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-sm font-medium mb-6 border border-blue-500/20">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                        </span>
                        Nowa wersja v0.1.0 już dostępna
                    </div>
                    <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight">
                        Twoje dane.<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                            Bezpieczne i uporządkowane.
                        </span>
                    </h1>
                    <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
                        ssVault to lekkie narzędzie open-source do szyfrowania danych.
                        Stworzone z myślą o prywatności i szybkości działania.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                        <a href="https://github.com/mromasze/ssVault/releases"
                           className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold flex items-center gap-2 transition-all hover:scale-105 shadow-lg shadow-blue-900/20">
                            <Download size={20} />
                            Pobierz ssVault
                        </a>
                        <a href="#features" className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold transition-all">
                            Zobacz funkcje
                        </a>
                    </div>
                </div>
            </header>

            <section id="features" className="py-20 bg-slate-900/50">
                <div className="max-w-6xl mx-auto px-4">
                    <h2 className="text-3xl font-bold text-white mb-12 text-center">Dlaczego ssVault?</h2>
                    <div className="grid md:grid-cols-3 gap-8">
                        <FeatureCard
                            icon={<Shield className="text-emerald-400" />}
                            title="Prywatność First"
                            desc="Twoje dane nie opuszczają urządzenia bez Twojej zgody. Pełna kontrola nad lokalizacją zapisu."
                        />
                        <FeatureCard
                            icon={<Zap className="text-yellow-400" />}
                            title="Błyskawiczne działanie"
                            desc="Napisany w wydajnych technologiach, ssVault uruchamia się w ułamku sekundy i nie obciąża systemu."
                        />
                        <FeatureCard
                            icon={<Terminal className="text-purple-400" />}
                            title="Open Source"
                            desc="Pełna przejrzystość kodu. Możesz audytować, modyfikować i ulepszać ssVault razem z nami."
                        />
                    </div>
                </div>
            </section>

            <section className="py-20 px-4">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-3xl font-bold text-white mb-8 flex items-center gap-3">
                        <Terminal size={32} /> Changelog
                    </h2>
                    <div className="border-l-2 border-slate-800 ml-4 space-y-12">
                        {changelog.map((log, index) => (
                            <div key={index} className="relative pl-8">
                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-slate-950 border-2 border-blue-500"></div>
                                <div className="flex items-baseline gap-4 mb-2">
                                    <h3 className="text-xl font-bold text-white">{log.version}</h3>
                                    <span className="text-sm text-slate-500 font-mono">{log.date}</span>
                                </div>
                                <ul className="space-y-2">
                                    {log.changes.map((change, i) => (
                                        <li key={i} className="text-slate-400 flex items-start gap-2">
                                            <ArrowRight size={16} className="mt-1 text-slate-600 shrink-0" />
                                            {change}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <footer className="border-t border-slate-800 bg-slate-950 py-12 text-center">
                <div className="max-w-4xl mx-auto px-4">
                    <p className="text-slate-500 mb-4">
                        Projekt udostępniany na licencji <span className="text-slate-300 font-semibold">MIT License</span>.
                        <br />Możesz go używać za darmo, komercyjnie i prywatnie.
                    </p>
                    <p className="text-slate-600 text-sm">
                        © {new Date().getFullYear()} mromasze. Built with Next.js & Tailwind.
                    </p>
                </div>
            </footer>
        </div>
    );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
    return (
        <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 hover:border-blue-500/50 transition-colors group">
            <div className="mb-4 p-3 bg-slate-900 w-fit rounded-lg group-hover:scale-110 transition-transform">
                {icon}
            </div>
            <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
            <p className="text-slate-400">{desc}</p>
        </div>
    );
}