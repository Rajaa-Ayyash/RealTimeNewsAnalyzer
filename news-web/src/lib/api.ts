export async function apiGet<T>(path: string): Promise<T> {
  const r = await fetch(path, { cache: "no-store" });

  if (!r.ok) {
    throw new Error(`Request failed: ${r.status}`);
  }

  return (await r.json()) as T;
}
