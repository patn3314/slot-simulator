/* simulator.js
 * 軽量化・ログ出力間引き対応
 * 2025-06-22
 */

/* ---------- PRNG ---------- */
class PRNG {
  constructor(seed) {
    this.x = seed >>> 0;
    if (this.x === 0) this.x = 0x6d2b79f5;
  }
  next() {
    let x = this.x;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.x = x >>> 0;
    return this.x;
  }
  random() {
    return this.next() / 0x100000000;
  }
}

/* ---------- CSV ---------- */
function parseCSV(txt) {
  const [h, ...ls] = txt.trim().split(/\r?\n/);
  const cols = h.split(",");
  return ls.map(l =>
    l.split(",").reduce((o, v, i) => ((o[cols[i]] = v), o), {})
  );
}
async function loadRoles(path = "data/roles.csv") {
  const t = await (await fetch(path)).text();
  return parseCSV(t);
}

/* ---------- 1 シミュレーション ---------- */
async function runSingleSim({
  simNo,
  games,
  setting,
  coinsPer1000,
  exchangeRate,
  roleTable,
  rng,
  onGame,
  yieldEveryGame = 50,
  logEveryGame = 100,
}) {
  let coins = 0;
  let invest = 0;
  let big = 0;
  let reg = 0;

  const probs = roleTable
    .filter(r => Number(r["設定"]) === setting)
    .map(r => ({
      name: r["役名"],
      prob: Number(r["出現率"]) / 65536,
      payout: Number(r["獲得枚数"]),
      isBIG: r["役名"].includes("BIG"),
      isREG: r["役名"].includes("REG"),
    }));

  const cum = [];
  probs.reduce((a, c) => {
    const n = a + c.prob;
    cum.push(n);
    return n;
  }, 0);

  for (let g = 0; g < games; g++) {
    if (coins < 3) {
      invest += 1000;
      coins += coinsPer1000;
    }
    coins -= 3;

    const r = rng.random();
    let idx = cum.findIndex(c => r < c);
    if (idx === -1) idx = cum.length - 1;
    const role = probs[idx];
    coins += role.payout;

    if (role.isBIG) big++;
    if (role.isREG) reg++;

    if (
      onGame &&
      ((g + 1) % logEveryGame === 0 || g === games - 1)
    ) {
      onGame({
        simNo,
        game: g + 1,
        role: role.name,
        payout: role.payout,
        coins,
        invest,
      });
    }

    if ((g + 1) % yieldEveryGame === 0) {
      await new Promise(requestAnimationFrame);
    }
  }

  const finalCoins = coins;
  const diffCoins = finalCoins - (invest / 1000) * coinsPer1000;
  const profitYen = Math.round(finalCoins - (invest / 1000) * exchangeRate);

  return { big, reg, finalCoins, invest, diffCoins, profitYen };
}

/* ---------- 複数シミュレーション ---------- */
export async function runSimulations({
  simulations,
  gamesPerSim,
  setting,
  coinsPer1000,
  exchangeRate,
  onProgress,
  onGame,
  roleFile = "data/roles.csv",
  logEveryGame = 100,
}) {
  const roleTable = await loadRoles(roleFile);
  const rng = new PRNG(Date.now());

  const results = [];
  const yieldEverySim = Math.max(1, Math.floor(simulations / 100));

  for (let i = 0; i < simulations; i++) {
    results.push(
      await runSingleSim({
        simNo: i + 1,
        games: gamesPerSim,
        setting,
        coinsPer1000,
        exchangeRate,
        roleTable,
        rng,
        onGame,
        logEveryGame,
      })
    );
    if (onProgress) onProgress(i + 1, simulations);
    if ((i + 1) % yieldEverySim === 0) {
      await new Promise(requestAnimationFrame);
    }
  }
  return results;
}