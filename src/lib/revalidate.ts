/**
 * revalidateLiveSite
 * 
 * Calls the live site's /api/revalidate endpoint to instantly flush
 * the Next.js ISR cache after any admin CRUD operation.
 * 
 * This ensures that changes to volumes, issues, and papers are
 * immediately visible on www.njlrii.com without waiting for the
 * 1-hour ISR window to expire.
 */
export async function revalidateLiveSite(): Promise<void> {
  const liveSiteUrl = process.env.NEXT_PUBLIC_LIVE_SITE_URL;
  const secret = process.env.REVALIDATE_SECRET;

  if (!liveSiteUrl || !secret) {
    console.warn('[revalidateLiveSite] Missing NEXT_PUBLIC_LIVE_SITE_URL or REVALIDATE_SECRET env var.');
    return;
  }

  try {
    const response = await fetch(`${liveSiteUrl}/api/revalidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[revalidateLiveSite] Failed (${response.status}):`, text);
    } else {
      const json = await response.json();
      console.log('[revalidateLiveSite] Cache flushed:', json);
    }
  } catch (err) {
    // Non-blocking — don't crash the admin panel if live site is unreachable
    console.error('[revalidateLiveSite] Network error:', err);
  }
}
