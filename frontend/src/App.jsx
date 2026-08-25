import { useState } from "react";
import StatusBanner from "./components/StatusBanner";
import ApplicationsExplorer from "./components/ApplicationsExplorer";
import RingExplorer from "./components/RingExplorer";
import SuspiciousIdentifiers from "./components/SuspiciousIdentifiers";

const TABS = [
  { id: "applications", label: "Applications" },
  { id: "ring", label: "Fraud Ring Tracer" },
  { id: "identifiers", label: "Suspicious Identifiers" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("applications");
  const [investigateId, setInvestigateId] = useState(null);

  function investigate(applicationId) {
    setInvestigateId(applicationId);
    setActiveTab("ring");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <StatusBanner />

      <header className="border-b border-white/5 px-6 py-5">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-lg font-semibold text-white">Loan Fraud Ring Explorer</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Surface hidden fraud rings in loan applications via shared identifiers — backed by CognoDB.
          </p>
        </div>
      </header>

      <nav className="px-6 border-b border-white/5">
        <div className="max-w-5xl mx-auto flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
                activeTab === t.id
                  ? "border-graph-500 text-white"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="flex-1 px-6 py-8">
        <div className="max-w-5xl mx-auto">
          {activeTab === "applications" && <ApplicationsExplorer onInvestigate={investigate} />}
          {activeTab === "ring" && <RingExplorer applicationId={investigateId} />}
          {activeTab === "identifiers" && <SuspiciousIdentifiers />}
        </div>
      </main>

      <footer className="px-6 py-4 text-center text-xs text-slate-600 border-t border-white/5">
        Data layer: CognoDB (openCypher / Bolt) · Built with React + Express
      </footer>
    </div>
  );
}
