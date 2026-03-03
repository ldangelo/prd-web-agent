/**
 * Client-side API helpers for PRD resources.
 *
 * These functions are safe to call from client components ("use client").
 */

/**
 * Deletes a PRD by ID.
 *
 * @param prdId - The ID of the PRD to delete.
 * @throws Error with message if the server returns a non-2xx response.
 */
export async function deletePrd(prdId: string): Promise<void> {
  const response = await fetch(`/api/prds/${prdId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    let message = `Failed to delete PRD (${response.status})`;
    try {
      const body = await response.json();
      if (body?.error) {
        message = body.error;
      }
    } catch {
      // ignore JSON parse errors; use the default message
    }
    throw new Error(message);
  }
}
