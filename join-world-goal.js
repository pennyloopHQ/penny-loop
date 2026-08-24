/* join-world-goal.js — add your game to the Penny Loop world goal.
 *
 * The world goal is one shared daily target. Every player of every joined game adds their
 * net worth to it. When the total reaches the target, every player of every joined game
 * earns more for the rest of the UTC day.
 *
 * No key, no account, no server of yours. Copy this file into your game, call
 * joinWorldGoal() with your game name and your players' total, and read the number back.
 *
 * MIT. Written by PENNY (@pennyloopHQ). Questions: reply to me on X.
 */

const WG_ROOM = "wss://pennyloop.games.bu.app/ws/pennyloop-hall-1";
const WG_KEY = "day";
const utcDay = () => new Date().toISOString().slice(0, 10);

/**
 * @param {string} game  your game name, 16 characters or less, e.g. "Mint Empire"
 * @param {number} total the sum of your players' net worth today, as you know it
 * @returns {Promise<{ total:number, target:number, games:Record<string,number> }>}
 *          total  = every game plus every Penny Loop player
 *          target = today's goal, $200B to $500B, seeded from the UTC date
 *          games  = the number each game published today
 */
export function joinWorldGoal(game, total) {
  return new Promise((resolve, reject) => {
    const s = new WebSocket(WG_ROOM);
    const stop = () => { try { s.close(); } catch (e) {} };
    const fail = e => { stop(); reject(e || new Error("world goal room is not answering")); };
    const guard = setTimeout(fail, 9000);
    s.onerror = fail;
    s.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.type !== "welcome") return;
      clearTimeout(guard);
      const d = utcDay();
      const prev = (m.state || {})[WG_KEY] || {};
      /* keep the day fresh: a new UTC day starts the count again */
      const day = prev.d === d ? { d, p: prev.p || {}, g: { ...(prev.g || {}) } } : { d, p: {}, g: {} };
      /* write your own number only, and only upward, so no client can lower another */
      if (total > (day.g[game] || 0)) {
        day.g[game] = Math.round(total * 100) / 100;
        s.send(JSON.stringify({ type: "set", key: WG_KEY, value: day }));
      }
      const players = Object.values(day.p).reduce((a, b) => a + b, 0);
      const games = Object.values(day.g).reduce((a, b) => a + b, 0);
      setTimeout(stop, 300);
      resolve({ total: players + games, target: wgTarget(d), games: day.g });
    };
  });
}

/** today's target, the same number for everybody, no request needed */
export function wgTarget(d = utcDay()) {
  let h = 2166136261;
  for (const c of d + "world") h = (h ^ c.charCodeAt(0)) * 16777619 >>> 0;
  return 2e11 + (h % 4) * 1e11;
}

/* Example:
 *   const { total, target } = await joinWorldGoal("Mint Empire", myPlayersTotal);
 *   if (total >= target) incomeMultiplier *= 1.25;
 *
 * Fair play: publish the sum of your players' net worth today, nothing more. Penny Loop drops
 * any number above $1e16 and keeps only the eight largest games, so an inflated number helps
 * nobody and is easy to spot.
 */
