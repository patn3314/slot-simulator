/* main.js
 * ログ負荷低減 + 自動クローズ + 集計オーバーレイ
 * 2025-06-22
 */
import { runSimulations } from "./simulator.js";
import { drawHistogram } from "./chart-setup.js";

document.addEventListener("DOMContentLoaded", () => {
  /* ---------- DOM ---------- */
  const form = document.getElementById("configForm");
  const progress = document.getElementById("progress");
  const progressBar = document.getElementById("progressBar");
  const progressText = document.getElementById("progressText");
  const progressCount = document.getElementById("progressCount");
  const processing = document.getElementById("processing");

  const statsSec = document.getElementById("stats");
  const statsTxt = document.getElementById("statsText");
  const charts = document.getElementById("charts");
  const download = document.getElementById("download");
  const csvBtn = document.getElementById("csvBtn");

  /* ---------- 状態 ---------- */
  let lastResults = [];
  let logWin = null;
  let logElem = null;
  const LOG_FLUSH_INTERVAL = 300; // ms

  // Chart instances
  let investChart = null;
  let coinsChart = null;
  let profitChart = null;

  /* ---------- ログウインドウ ---------- */
  function openLogWindow() {
    if (!logWin || logWin.closed) {
      logWin = window.open(
        "",
        "simLog",
        "width=640,height=800,scrollbars=yes"
      );
      logWin.document.write(`
<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8" />
<title>シミュレーション進行ログ</title>
<style>body{font-family:monospace;white-space:pre;line-height:1.3;margin:0;padding:1rem;}</style>
</head><body><h2>シミュレーションログ</h2><pre id="log"></pre></body></html>`);
      logWin.document.close();
      logElem = logWin.document.getElementById("log");
    }
  }
  function safeAppend(str) {
    if (!logElem) return;
    logElem.textContent += str;
    logWin.scrollTo(0, logWin.document.body.scrollHeight);
  }

  /* ---------- フォーム送信 ---------- */
  form.addEventListener("submit", async e => {
    e.preventDefault();

    const fd = new FormData(form);
    const sim      = +fd.get("simulations");
    const games    = +fd.get("gamesPerSim");
    const setting  = +fd.get("setting");
    const lend     = +fd.get("coinsPer1000");
    const exchRate = +fd.get("exchangeRate");

    openLogWindow();
    safeAppend(`=== START ${new Date().toLocaleString()} ===\n`);
    safeAppend(`条件: 回=${sim} G/回=${games} 設定=${setting}\n\n`);

    progress.hidden = false;
    progressBar.value = 0;
    progressText.textContent = "0 %";
    progressCount.textContent = `0 / ${sim}`;
    statsSec.hidden = charts.hidden = download.hidden = true;

    let logBuffer = "";
    let lastFlush = performance.now();

    lastResults = await runSimulations({
      simulations: sim,
      gamesPerSim: games,
      setting,
      coinsPer1000: lend,
      exchangeRate: exchRate,
      logEveryGame: 100,
      onProgress: (done, total) => {
        const pct = (done / total) * 100;
        progressBar.value = pct;
        progressText.textContent = `${pct.toFixed(1)} %`;
        progressCount.textContent = `${done} / ${total}`;
      },
      onGame: ({ simNo, game, role, payout, coins, invest }) => {
        logBuffer +=
          `S${simNo} G${String(game).padStart(4,"0")} ` +
          `${role.padEnd(12)} +${String(payout).padStart(3)}枚 ` +
          `持=${String(coins).padStart(5)} 投=${invest}\n`;

        const now = performance.now();
        if (now - lastFlush > LOG_FLUSH_INTERVAL) {
          safeAppend(logBuffer);
          logBuffer = "";
          lastFlush = now;
        }
      },
    });

    safeAppend(logBuffer);
    safeAppend("\n=== FINISH ===\n");

    setTimeout(() => {
      if (logWin && !logWin.closed) logWin.close();
    }, 500);

    processing.hidden = false;
    await new Promise(requestAnimationFrame);
    renderResults({ setting });
    statsSec.scrollIntoView({ behavior: "smooth" });
    processing.hidden = true;
  });

  /* ---------- 結果描画 ---------- */
  function renderResults({ setting }) {
    const invested = lastResults.map(r => r.invest);
    const coins    = lastResults.map(r => r.finalCoins);
    const profit   = lastResults.map(r => r.profitYen);

    const summary = arr => ({
      avg: (arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(1),
      med: arr.slice().sort((a,b)=>a-b)[Math.floor(arr.length/2)],
      min: Math.min(...arr),
      max: Math.max(...arr),
    });

    const sInv = summary(invested);
    const sCoin= summary(coins);
    const sPro = summary(profit);

    statsTxt.textContent = `
▶ 使用設定：${setting}

[投資額]      平均:${sInv.avg} 中央:${sInv.med} 最小:${sInv.min} 最大:${sInv.max}
[最終メダル]  平均:${sCoin.avg} 中央:${sCoin.med} 最小:${sCoin.min} 最大:${sCoin.max}
[収支]        平均:${sPro.avg} 中央:${sPro.med} 最小:${sPro.min} 最大:${sPro.max}
`.trim();

    investChart = drawHistogram(investChart, "investChart", invested, "投資額 (円)");
    coinsChart  = drawHistogram(coinsChart, "coinsChart",  coins,    "最終所持メダル (枚)");
    profitChart = drawHistogram(profitChart, "profitChart", profit,   "収支 (円)");

    statsSec.hidden = charts.hidden = download.hidden = false;
  }

  /* ---------- CSV ダウンロード ---------- */
  csvBtn.addEventListener("click", () => {
    if (!lastResults.length) return;
    const head = "シムNo,ゲーム数,BIG,REG,差枚,最終メダル,投資\n";
    const rows = lastResults.map(r =>
      [r.simNo, form.gamesPerSim.value, r.big, r.reg,
       r.diffCoins, r.finalCoins, r.invest].join(",")
    ).join("\n");
    const blob = new Blob([head + rows], { type:"text/csv" });
    const url  = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), {
      href:url, download:"simulation_results.csv"
    }).click();
    URL.revokeObjectURL(url);
  });
});