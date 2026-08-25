import { useEffect, useState } from "react";
import { api } from "../api";
import { Loading, EmptyState, ErrorState } from "./States";

export default function RingExplorer({ applicationId: initialId }) {
  const [applications, setApplications] = useState(null);
  const [applicationId, setApplicationId] = useState(initialId || "");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .getApplications()
      .then((rows) => {
        setApplications(rows);
        if (!applicationId && rows.length) setApplicationId(rows[0].id);
      })
      .catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (initialId) {
      setApplicationId(initialId);
      runTraversal(initialId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialId]);

  async function runTraversal(id) {
    const target = id || applicationId;
    if (!target) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await api.getRing(target, 8);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (error && !applications) return <ErrorState message={error} />;
  if (!applications) return <Loading label="Loading applications..." />;

  return (
    <div>
      <p className="text-sm text-slate-400 mb-6 max-w-2xl">
        Pick an application and walk outward through every shared phone, email, address,
        device, or bank account — up to 4 links deep — to surface the full cluster of
        applications connected to it, even when no two of them share an identifier directly.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end max-w-2xl">
        <label className="flex-1 text-sm">
          <span className="block text-slate-400 mb-1.5">Application</span>
          <select
            value={applicationId}
            onChange={(e) => setApplicationId(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-graph-500"
          >
            {applications.map((a) => (
              <option key={a.id} value={a.id} className="bg-ink">
                {a.applicantName} ({a.id})
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={() => runTraversal()}
          disabled={loading || !applicationId}
          className="px-5 py-2.5 rounded-lg bg-graph-500 hover:bg-graph-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition h-fit"
        >
          {loading ? "Traversing..." : "Trace ring"}
        </button>
      </div>

      <div className="mt-8">
        {loading && <Loading label="Walking shared-identifier edges..." />}
        {error && !loading && <ErrorState message={error} onRetry={() => runTraversal()} />}
        {!loading && result && <RingResult result={result} />}
      </div>
    </div>
  );
}

function RingResult({ result }) {
  if (result.ringSize <= 1) {
    return (
      <EmptyState
        title="No connections found"
        subtitle="This application doesn't share any identifier with another application, directly or through a chain."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="border border-rose-500/20 bg-rose-500/[0.04] rounded-xl p-4">
        <p className="text-sm text-rose-200">
          <span className="font-semibold">{result.ringSize} applications</span> are connected
          in this cluster — {result.members.length} others reachable within{" "}
          {result.maxHops / 2} shared-identifier hops of the starting application.
        </p>
      </div>

      <div>
        <h3 className="text-sm font-medium text-slate-300 mb-2">Ring members</h3>
        <div className="border border-white/5 rounded-xl divide-y divide-white/5 overflow-hidden">
          {result.members.map((m) => (
            <div key={m.applicationId} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="text-slate-200">{m.applicantName}</span>
              <span className="text-slate-500 text-xs">
                {m.applicationId} · {m.hopDistance / 2} link{m.hopDistance / 2 === 1 ? "" : "s"} away
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-slate-300 mb-2">Connecting identifiers</h3>
        {result.links.length === 0 ? (
          <EmptyState title="No identifier detail available" />
        ) : (
          <div className="flex flex-wrap gap-2">
            {result.links.map((l, i) => (
              <span
                key={i}
                className="px-2.5 py-1 text-xs rounded-full bg-white/[0.04] border border-white/10 text-slate-300 font-mono"
              >
                {l.applicationId} → {l.identifierType.toLowerCase()}: {l.identifierValue}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
