/* slot-worker.js
 * スロットシミュレーション用ワーカー
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

/* ---------- 1 シミュレーション ---------- */
function runSingleSim({
  simNo,
  games,
  setting,
  coinsPer1000,
  exchangeRate,
  roleTable,
  rng,
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
  }

  const finalCoins = coins;
  const diffCoins = finalCoins - (invest / 1000) * coinsPer1000;
  const profitYen = Math.round((finalCoins * 1000) / exchangeRate - invest);

  return { simNo, big, reg, finalCoins, invest, diffCoins, profitYen };
}

/* ---------- メッセージハンドラー ---------- */
onmessage = async (e) => {
  const { type, data } = e.data;

  if (type === 'START_SIMULATION') {
    const {
      simulations,
      gamesPerSim,
      setting,
      coinsPer1000,
      exchangeRate,
      roleTableCsv
    } = data;

    // CSVデータをパース
    const roleTable = parseCSV(roleTableCsv);
    const rng = new PRNG(Date.now());

    const results = [];

    for (let i = 0; i < simulations; i++) {
      const result = runSingleSim({
        simNo: i + 1,
        games: gamesPerSim,
        setting,
        coinsPer1000,
        exchangeRate,
        roleTable,
        rng,
      });
      
      results.push(result);

      // 進行状況を定期的に報告
      if ((i + 1) % 100 === 0 || i === simulations - 1) {
        postMessage({
          type: 'PROGRESS',
          data: {
            completed: i + 1,
            total: simulations,
            percentage: ((i + 1) / simulations) * 100
          }
        });
      }
    }

    // 結果を送信
    postMessage({
      type: 'COMPLETED',
      data: results
    });
  }
};

