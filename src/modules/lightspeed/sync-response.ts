// Platform errors can be HTML/plain text. Never replace the HTTP error with a JSON parser error.
export async function readSyncResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      payload?.error ??
        `Sync request failed (HTTP ${response.status}). Refresh the saved run status for details.`,
    );
  if (!payload || typeof payload !== "object")
    throw new Error(
      "Could not read the sync response. Refresh the saved run status before retrying.",
    );
  return payload as T;
}
