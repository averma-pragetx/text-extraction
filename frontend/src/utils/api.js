export const API_BASE = "http://localhost:8000";
export const USE_MOCK = false;

export async function api(path, opts = {}) {
  if (USE_MOCK) return null;
  const r = await fetch(API_BASE + path, {
    headers: { 
      "Content-Type": "application/json", 
      Authorization: "Bearer " + (localStorage.getItem("epcflow_token") || "") 
    },
    ...opts,
  });
  if (!r.ok) throw new Error(path + " " + r.status);
  return r.json();
}
