// Tells a CTA Train Tracker outage apart from a station with no trains.
// The Red and Blue lines run 24 hours, so when the feed shows no train on
// either one, the feed is down (CTA maintenance or outage), not the trains.

const CTA_API_KEY = process.env.CTA_TRAIN_API_KEY;
const CHECK_TTL_MS = 60_000;
const TIMEOUT_MS = 5_000;

export const TRAIN_FEED_DOWN_MESSAGE = "CTA's live arrival data is unavailable right now.";

let lastCheck: { at: number; down: boolean } | null = null;

export async function isTrainFeedDown(): Promise<boolean> {
  if (lastCheck && Date.now() - lastCheck.at < CHECK_TTL_MS) return lastCheck.down;

  let down = true;
  try {
    const response = await fetch(
      `https://lapi.transitchicago.com/api/1.0/ttpositions.aspx?key=${CTA_API_KEY}&rt=red,blue&outputType=JSON`,
      { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) }
    );
    const data = await response.json();
    const routes: { train?: unknown }[] = [].concat(data?.ctatt?.route ?? []);
    down = data?.ctatt?.errCd !== "0" || !routes.some((route) => route.train);
  } catch (error) {
    console.error("CTA train feed check failed:", error);
  }

  lastCheck = { at: Date.now(), down };
  return down;
}
