/* main-worker.js
 * Web Worker版のメインスクリプト
 * 2025-06-23
 */
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
  const logBtn = document.getElementById("logBtn");

  /* ---------- 状態 ---------- */
  let lastResults = [];
  let worker = null;
  let isSimulationRunning = false;

  // Chart instances
  let investChart = null;
  let coinsChart = null;
  let diffChart = null;
  let profitChart = null;

  /* ---------- Worker初期化 ---------- */
  function initWorker() {
    if (window.Worker) {
      worker = new Worker(new URL("slot-worker.js", import.meta.url));
      
      worker.onmessage = (e) => {
        const { type, data } = e.data;
        
        if (type === 'PROGRESS') {
          const { completed, total, percentage } = data;
          progressBar.value = percentage;
          progressText.textContent = `${percentage.toFixed(1)} %`;
          progressCount.textContent = `${completed} / ${total}`;
        } else if (type === 'COMPLETED') {
          lastResults = data;
          onSimulationComplete();
        }
      };

      worker.onerror = (error) => {
        console.error('Worker error:', error);
        alert('シミュレーション中にエラーが発生しました。');
        isSimulationRunning = false;
      };
    } else {
      alert('お使いのブラウザはWeb Workerをサポートしていません。');
    }
  }

  /* ---------- シミュレーション完了処理 ---------- */
  async function onSimulationComplete() {
    isSimulationRunning = false;
    
    processing.hidden = false;
    await new Promise(requestAnimationFrame);
    
    const fd = new FormData(form);
    const setting = +fd.get("setting");
    
    renderResults({ setting });
    statsSec.scrollIntoView({ behavior: "smooth" });
    processing.hidden = true;
    
    // フォームを再度有効化
    Array.from(form.elements).forEach(element => {
      element.disabled = false;
    });
  }

  /* ---------- フォーム送信 ---------- */
  form.addEventListener("submit", async e => {
    e.preventDefault();

    if (isSimulationRunning) {
      alert('シミュレーションが実行中です。');
      return;
    }

    if (!worker) {
      initWorker();
    }

    const fd = new FormData(form);
    const sim = +fd.get("simulations");
    const games = +fd.get("gamesPerSim");
    const setting = +fd.get("setting");
    const lend = +fd.get("coinsPer1000");
    const exchRate = +fd.get("exchangeRate");

    // フォームを無効化
    Array.from(form.elements).forEach(element => {
      element.disabled = true;
    });

    isSimulationRunning = true;

    progress.hidden = false;
    progressBar.value = 0;
    progressText.textContent = "0 %";
    progressCount.textContent = `0 / ${sim}`;
    statsSec.hidden = charts.hidden = download.hidden = true;

    try {
      // 役データを読み込み
      const roleResponse = await fetch("data/roles.csv");
      const roleTableCsv = await roleResponse.text();

      // ワーカーにシミュレーション開始を指示
      worker.postMessage({
        type: 'START_SIMULATION',
        data: {
          simulations: sim,
          gamesPerSim: games,
          setting,
          coinsPer1000: lend,
          exchangeRate: exchRate,
          roleTableCsv
        }
      });
    } catch (error) {
      console.error('シミュレーション開始エラー:', error);
      alert('シミュレーションの開始に失敗しました。');
      isSimulationRunning = false;
      
      // フォームを再度有効化
      Array.from(form.elements).forEach(element => {
        element.disabled = false;
      });
    }
  });

  /* ---------- 結果描画 ---------- */
  function renderResults({ setting }) {
    const invested = lastResults.map(r => r.invest);
    const coins = lastResults.map(r => r.finalCoins);
    const diff = lastResults.map(r => r.diffCoins);
    const profit = lastResults.map(r => r.profitYen);

    const summary = arr => ({
      avg: (arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(1),
      med: arr.slice().sort((a,b)=>a-b)[Math.floor(arr.length/2)],
      min: Math.min(...arr),
      max: Math.max(...arr),
    });

    const sInv = summary(invested);
    const sCoin = summary(coins);
    const sDiff = summary(diff);
    const sPro = summary(profit);

    statsTxt.textContent = `
▶ 使用設定：${setting}

[投資額]      平均:${sInv.avg} 中央:${sInv.med} 最小:${sInv.min} 最大:${sInv.max}
[最終メダル]  平均:${sCoin.avg} 中央:${sCoin.med} 最小:${sCoin.min} 最大:${sCoin.max}
[差枚数]      平均:${sDiff.avg} 中央:${sDiff.med} 最小:${sDiff.min} 最大:${sDiff.max}
[収支]        平均:${sPro.avg} 中央:${sPro.med} 最小:${sPro.min} 最大:${sPro.max}
`.trim();

    investChart = drawHistogram(investChart, "investChart", invested, "投資額 (円)");
    coinsChart = drawHistogram(coinsChart, "coinsChart", coins, "最終所持メダル (枚)");
    diffChart = drawHistogram(diffChart, "diffChart", diff, "差枚数 (枚)");
    profitChart = drawHistogram(profitChart, "profitChart", profit, "収支 (円)");

    statsSec.hidden = charts.hidden = download.hidden = false;
  }

  /* ---------- CSV ダウンロード ---------- */
  csvBtn.addEventListener("click", () => {
    if (!lastResults.length) return;
    
    const fd = new FormData(form);
    const games = +fd.get("gamesPerSim");
    
    const head = "シムNo,ゲーム数,BIG,REG,差枚,最終メダル,投資\n";
    const rows = lastResults.map(r =>
      [r.simNo, games, r.big, r.reg,
       r.diffCoins, r.finalCoins, r.invest].join(",")
    ).join("\n");
    const blob = new Blob([head + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), {
      href: url, download: "simulation_results.csv"
    }).click();
    URL.revokeObjectURL(url);
  });

  /* ---------- ログボタン（Web Worker版では無効化） ---------- */
  logBtn.addEventListener("click", () => {
    alert('Web Worker版ではリアルタイムログ機能は利用できません。');
  });

  // 初期化
  initWorker();
});

