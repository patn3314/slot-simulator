/* simulator.js
 * シミュレーション本体 & 乱数ロジック
 * （1G ごとのコールバック onGame に対応）
 * 2025-06-22
 */

/** --- 乱数ジェネレータ -------------------------------------------------- */
class PRNG {
  constructor(seed) {
    this.x = seed >>> 0;
    if (this.x === 0) this.x = 0x6d2b79f5; // avoid zero seed
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

/** --- CSV ローダ -------------------------------------------------------- */
function parseCSV(text) {
  const [header, ...lines] = text.trim().split(/\r?\n/);
  const cols = header.split(",");
  return lines.map((l) =>
    l.split(",").reduce((o, v, i) => ((o[cols[i]] = v), o), {})
  );
}

async function loadRoleTable(path = "data/roles.csv") {
  const res = await fetch(path);
  return parseCSV(await res.text());
}

/** --- 単発シミュレーション --------------------------------------------- */
async function runSingleSim({
  simNo,
  games,
  setting,
  coinsPer1000,
  exchangeRate,
  roleTable,
  rng,
  onGame = null,
  yieldEveryGame = 50, // UI フリーズ回避
}) {
  let coins = 0;
  let invest = 0;
  let big = 0;
  let reg = 0;

  // 指定設定のみ抽出
  const probs = roleTable
    .filter((r) => Number(r["設定"]) === setting)
    .map((r) => ({
      name: r["役名"],
      prob: Number(r["出現率"]) / 65536,
      payout: Number(r["獲得枚数"]),
      isBIG: r["役名"].includes("BIG"),
      isREG: r["役名"].includes("REG"),
    }));

  // 累積確率テーブル
  const cum = [];
  probs.reduce((acc, cur) => {
    const n = acc + cur.prob;
    cum.push(n);
    return n;
  }, 0);

  for (let g = 0; g < games; g++) {
    // メダル不足なら追投
    if (coins < 3) {
      invest += 1000;
      coins += coinsPer1000;
    }
    coins -= 3;

    // 抽選
    const r = rng.random();
    let idx = cum.findIndex((c) => r < c);
    if (idx === -1) idx = cum.length - 1;
    const role = probs[idx];
    coins += role.payout;

    if (role.isBIG) big++;
    if (role.isREG) reg++;

    // 1G ログ出力
    if (onGame) {
      onGame({
        simNo,
        game: g + 1,
        role: role.name,
        payout: role.payout,
        coins,
        invest,
      });
    }

    // UI 更新のため適宜 yield
    if ((g + 1) % yieldEveryGame === 0) {
      await new Promise(requestAnimationFrame);
    }
  }

  const finalCoins = coins;
  const diffCoins = finalCoins - (invest / 1000) * coinsPer1000;
  const profitYen = Math.round(finalCoins - (invest / 1000) * exchangeRate);

  return { big, reg, finalCoins, invest, diffCoins, profitYen };
}

/** --- 複数シミュレーション --------------------------------------------- */
export async function runSimulations(opts) {
  const {
    simulations,
    gamesPerSim,
    setting,
    coinsPer1000,
    exchangeRate,
    onProgress = null,
    onGame = null,
    roleFile = "data/roles.csv",
  } = opts;

  const roleTable = await loadRoleTable(roleFile);
  const rng = new PRNG(Date.now());

  const results = [];
  const yieldEverySim = Math.max(1, Math.floor(simulations / 100)); // 1% 毎

  for (let i = 0; i < simulations; i++) {
    const res = await runSingleSim({
      simNo: i + 1,
      games: gamesPerSim,
      setting,
      coinsPer1000,
      exchangeRate,
      roleTable,
      rng,
      onGame,
    });
    results.push({ simNo: i + 1, ...res });

    if (onProgress) onProgress(i + 1, simulations);
    if ((i + 1) % yieldEverySim === 0) {
      await new Promise(requestAnimationFrame);
    }
  }

  return results;
}