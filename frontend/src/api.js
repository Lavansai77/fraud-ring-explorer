// api.js
// Every backend call lives here so components stay focused on rendering.

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path) {
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`);
  } catch {
    throw new ApiError("Could not reach the API. Is the backend running?", 0);
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* not JSON */
    }
    throw new ApiError(message, res.status);
  }

  return res.json();
}

export const api = {
  health: () => request("/health"),
  getApplications: () => request("/applications"),
  getApplication: (id) => request(`/applications/${encodeURIComponent(id)}`),
  getRing: (applicationId, maxHops) =>
    request(`/ring?applicationId=${encodeURIComponent(applicationId)}${maxHops ? `&maxHops=${maxHops}` : ""}`),
  getSuspiciousIdentifiers: () => request("/suspicious-identifiers"),
};

export { ApiError };
