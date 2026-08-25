import { useEffect, useState } from "react";
import { api } from "../api";
import { Loading, EmptyState, ErrorState } from "./States";

const STATUS_STYLES = {
  approved: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  pending: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  rejected: "bg-rose-500/10 text-rose-300 border-rose-500/20",
};

export default function ApplicationsExplorer({ onInvestigate }) {
  const [applications, setApplications] = useState(null);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    load();
  }, []);

  function load() {
    setError(null);
    setApplications(null);
    api
      .getApplications()
      .then(setApplications)
      .catch((err) => setError(err.message));
  }

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!applications) return <Loading label="Loading applications..." />;
  if (applications.length === 0)
    return <EmptyState title="No applications yet" subtitle="Run the seed script to load sample data." />;

  return (
    <div className="grid lg:grid-cols-[420px_1fr] gap-6">
      <div className="space-y-1.5 max-h-[70vh] overflow-y-auto pr-1">
        {applications.map((a) => (
          <button
            key={a.id}
            onClick={() => setSelectedId(a.id)}
            className={`w-full text-left px-4 py-3 rounded-xl border transition ${
              selectedId === a.id
                ? "bg-graph-500/15 border-graph-500/40"
                : "bg-white/[0.03] border-white/5 hover:bg-white/[0.06]"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-sm text-slate-100">{a.applicantName}</span>
              {a.sharedWithCount > 0 && (
                <span className="shrink-0 px-2 py-0.5 text-[11px] rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/25">
                  {a.sharedWithCount} shared
                </span>
              )}
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-slate-500">
                {a.id} · ₹{a.amount.toLocaleString("en-IN")}
              </span>
              <span
                className={`text-[11px] px-1.5 py-0.5 rounded border capitalize ${STATUS_STYLES[a.status] || ""}`}
              >
                {a.status}
              </span>
            </div>
          </button>
        ))}
      </div>

      <div>
        {selectedId ? (
          <ApplicationDetail id={selectedId} onInvestigate={onInvestigate} />
        ) : (
          <EmptyState
            title="Select an application"
            subtitle="Applications flagged with a 'shared' badge reuse an identifier with at least one other application - a strong fraud signal."
          />
        )}
      </div>
    </div>
  );
}

function ApplicationDetail({ id, onInvestigate }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setData(null);
    setError(null);
    api
      .getApplication(id)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [id]);

  if (error) return <ErrorState message={error} />;
  if (!data) return <Loading label="Loading application..." />;

  const idRows = [
    ["Phone", data.identifiers.phone],
    ["Email", data.identifiers.email],
    ["Address", data.identifiers.address],
    ["Device", data.identifiers.device],
    ["Bank account", data.identifiers.bankAccount],
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">{data.applicantName}</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {data.id} · ₹{data.amount.toLocaleString("en-IN")} · submitted {data.submittedDate}
          </p>
        </div>
        <span className={`text-xs px-2 py-1 rounded border capitalize ${STATUS_STYLES[data.status] || ""}`}>
          {data.status}
        </span>
      </div>

      <div>
        <h3 className="text-sm font-medium text-slate-300 mb-2">Identifiers used</h3>
        <div className="border border-white/5 rounded-xl divide-y divide-white/5 overflow-hidden font-mono text-xs">
          {idRows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-slate-500 font-sans">{label}</span>
              <span className="text-slate-200">{value || "—"}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-slate-300">
            Directly shares an identifier with ({data.directMatches.length})
          </h3>
          {data.directMatches.length > 0 && (
            <button
              onClick={() => onInvestigate(data.id)}
              className="text-xs px-3 py-1.5 rounded-lg bg-graph-500 hover:bg-graph-600 text-white font-medium transition"
            >
              Investigate full ring →
            </button>
          )}
        </div>
        {data.directMatches.length === 0 ? (
          <EmptyState title="No direct matches" subtitle="This application doesn't share any identifier with another one." />
        ) : (
          <div className="border border-white/5 rounded-xl divide-y divide-white/5 overflow-hidden">
            {data.directMatches.map((m, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-slate-200">{m.applicantName}</span>
                <span className="text-slate-500 text-xs">
                  shared {m.identifierType.toLowerCase()} · {m.applicationId}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
