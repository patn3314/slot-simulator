/* main.js
 * UI 制御 + 別ウインドウのリアルタイムログ
 * 2025-06-22  (ページ内結果可視化＋自動スクロール対応)
 */
import { runSimulations } from "./simulator.js";
import { drawHistogram } from "./chart-setup.js";

document.addEventListener("DOMContentLoaded", () => {
  /* -------------------- DOM 取得 -------------------- */
  const form = document.getElementById("configForm");

  // 進行状況
  const progress = document.getElementById("progress");
  const progressBar = document.getElementById("progressBar");
  const progressText = document.getElementById("progressText");
  const progressCount = document.getElementById("progressCount");

  // 結果セクション
  const statsSection = document.getElementById("stats");
  const statsText = document.getElementById("statsText");
  const charts = document.getElementById("charts");
  const download = document.getElementById("download");
  const csvBtn = document.getElementById("csvBtn");

  /* -------------------- 変数 -------------------- */
  let lastResults = [];
  let logWin = null;
  let logElem = null;

  /* -------------------- ログウインドウ -------------------- */
  function openLogWindow() {
    if (!logWin || logWin.closed) {
      logWin = window.open(
        "",
        "simLog",
        "width=640,height=800,scrollbars=yes"
      );
      logWin.document.write(`
        <!DOCTYPE html><html lang="ja"><head>
          <meta charset="UTF-8" />
          <title>シミュレーション進行ログ</title>
          <style>
            body{font-family:monospace;white-space:pre;line-height:1.4;margin:0;padding:1rem;}
          </style>
        </head><body>
          <h2>シミュレーションログ</h2>
          <pre id="log"></pre>
        </body></html>
      `);
      logWin.document.close();
      logElem = logWin.document.getElementById("log");
    }
  }
  function appendLog(msg) {
    if (!logElem) return;
    logElem.textContent += msg + "\n";
    logWin.scrollTo(0, logWin.document.body.scrollHeight);
  }

  /* -------------------- フォーム送信 -------------------- */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    /* === 入力値取得 === */
    const fd = new FormData(form);
    const simulations   = Number(fd.get("simulations"));
    const gamesPerSim   = Number(fd.get("gamesPerSim"));
    const setting       = Number(fd.get("setting"));
    const coinsPer1000  = Number(fd.get("coinsPer1000"));
    const exchangeRate  = Number(fd.get("exchangeRate"));

    /* === ログウインドウ === */
    openLogWindow();
    appendLog(
      `=== シミュレーション開始 (${new Date().toLocaleString()}) ===`
    );
    appendLog(
      `条件：回=${simulations}, G/回=${gamesPerSim}, 設定=${setting}, ` +
      `貸出=${coinsPer1000}, 交換率=${exchangeRate}`
    );
    appendLog("");

    /* === 進捗リセット === */
    progress.hidden = false;
    progressBar.value = 0;
    progressText.textContent = "0 %";
    progressCount.textContent = `0 / ${simulations}`;

    /* === 結果エリアを一旦隠す === */
    statsSection.hidden = charts.hidden = download.hidden = true;

    /* === シミュレーション実行 === */
    lastResults = await runSimulations({
      simulations,
      gamesPerSim,
      setting,
      coinsPer1000,
      exchangeRate,
      onProgress: (done, total) => {
        const pct = (done / total) * 100;
        progressBar.value = pct;
        progressText.textContent = `${pct.toFixed(1)} %`;
        progressCount.textContent = `${done} / ${total}`;
      },
      onGame: ({ simNo, game, role, payout, coins, invest }) => {
        appendLog(
          `Sim${simNo} G${game.toString().padStart(4,"0")}: ` +
          `${role.padEnd(12)} +${payout
            .toString()
            .padStart(3)}枚 | 所持=${coins
            .toString()
            .padStart(5)}枚 投資=${invest}円`
        );
      },
    });

    appendLog("\n=== シミュレーション完了 ===\n");

    /* === 数値まとめ === */
    const invested = lastResults.map(r => r.invest);
    const coins    = lastResults.map(r => r.finalCoins);
    const profit   = lastResults.map(r => r.profitYen);

    const summary = arr => ({
      avg: (arr.reduce((a,b)=>a+b,0) / arr.length).toFixed(1),
      med: arr.slice().sort((a,b)=>a-b)[Math.floor(arr.length/2)],
      min: Math.min(...arr),
      max: Math.max(...arr),
    });

    const sInvest = summary(invested);
    const sCoins  = summary(coins);
    const sProfit = summary(profit);

    statsText.textContent = `
▶ 使用設定：${setting}

[投資額]
  平均：${sInvest.avg} 円
  中央：${sInvest.med} 円
  最小：${sInvest.min} 円
  最大：${sInvest.max} 円

[最終所持メダル]
  平均：${sCoins.avg} 枚
  中央：${sCoins.med} 枚
  最小：${sCoins.min} 枚
  最大：${sCoins.max} 枚

[収支]
  平均：${sProfit.avg} 円
  中央：${sProfit.med} 円
  最小：${sProfit.min} 円
  最大：${sProfit.max} 円
`.trim();

    /* === ヒストグラム描画 === */
    drawHistogram("investChart", invested, "投資額 (円)");
    drawHistogram("coinsChart",  coins,    "最終所持メダル (枚)");
    drawHistogram("profitChart", profit,   "収支 (円)");

    /* === 結果セクションを表示 === */
    statsSection.hidden = charts.hidden = download.hidden = false;

    /* === 結果へスクロール === */
    statsSection.scrollIntoView({ behavior: "smooth" });
  });

  /* -------------------- CSV ダウンロード -------------------- */
  csvBtn.addEventListener("click", () => {
    if (lastResults.length === 0) return;

    const header =
      "シミュレーションNo,ゲーム数,BIG回数,REG回数,差枚数,最終所持メダル,投資金額\n";

    const rows = lastResults.map(r => [
      r.simNo,
      form.gamesPerSim.value,
      r.big,
      r.reg,
      r.diffCoins,
      r.finalCoins,
      r.invest,
    ].join(",")).join("\n");

    const blob = new Blob([header + rows], { type:"text/csv" });
    const url  = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "simulation_results.csv";
    a.click();
    URL.revokeObjectURL(url);
  });
});