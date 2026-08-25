import { useEffect, useState } from "react";
import { api } from "../api";
import { Loading, EmptyState, ErrorState } from "./States";

export default function SuspiciousIdentifiers() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    load();
  }, []);

  function load() {
    setError(null);
    setRows(null);
    api
      .getSuspiciousIdentifiers()
      .then(setRows)
      .catch((err) => setError(err.message));
  }

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!rows) return <Loading label="Scanning identifiers for reuse..." />;
  if (rows.length === 0)
    return <EmptyState title="No reused identifiers" subtitle="Every phone, email, address, device, and bank account in the data is unique to one application." />;

  return (
    <div className="max-w-3xl">
      <p className="text-sm text-slate-400 mb-6">
        Any phone number, email, address, device fingerprint, or bank account reused across
        two or more applications, ranked by how many applications reuse it. High reuse is the
        strongest single fraud signal — legitimate applicants don't normally share a device
        fingerprint with a stranger.
      </p>

      <div className="border border-white/5 rounded-xl divide-y divide-white/5 overflow-hidden">
        {rows.map((r, i) => (
          <div key={i} className="px-4 py-3 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-400">
                  {r.identifierType}
                </span>
                <span className="text-sm text-slate-200 font-mono truncate">{r.value}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1 truncate">
                {r.applicantNames.join(", ")}
              </p>
            </div>
            <span className="shrink-0 px-2.5 py-1 text-xs rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/25">
              {r.applicationCount} apps
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
