/* chart-setup.js
 * Chart.js ヒストグラム描画（改善版）
 */
function makeBins(data, bins = 30) {
  if (data.length === 0) return { labels: [], counts: [] };
  const min = Math.min(...data);
  const max = Math.max(...data);
  
  // データが単一値の場合の処理
  if (min === max) {
    return { 
      labels: [min.toString()], 
      counts: [data.length] 
    };
  }
  
  const width = (max - min) / bins;

  const counts = Array(bins).fill(0);
  data.forEach(v => {
    const idx = Math.min(bins - 1, Math.floor((v - min) / width));
    counts[idx]++;
  });

  const labels = counts.map(
    (_, i) =>
      `${(min + i * width).toFixed(0)}–${(min + (i + 1) * width).toFixed(0)}`
  );

  return { labels, counts };
}

export function drawHistogram(chartInstance, canvasId, data, title, bins = 30) {
  const { labels, counts } = makeBins(data, bins);
  const ctx = document.getElementById(canvasId).getContext("2d");

  // Chart.jsのデフォルト設定を改善
  const chartConfig = {
    type: "bar",
    data: { 
      labels, 
      datasets: [{ 
        label: title, 
        data: counts,
        backgroundColor: 'rgba(52, 152, 219, 0.7)',
        borderColor: 'rgba(52, 152, 219, 1)',
        borderWidth: 1
      }] 
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { 
        y: { 
          beginAtZero: true,
          ticks: {
            precision: 0
          }
        },
        x: {
          ticks: {
            maxRotation: 45,
            minRotation: 0
          }
        }
      },
      plugins: {
        legend: { display: false },
        title: { 
          display: true, 
          text: title,
          font: {
            size: 14,
            weight: 'bold'
          }
        },
      },
      interaction: {
        intersect: false,
        mode: 'index'
      }
    },
  };

  if (chartInstance) {
    chartInstance.data.labels = labels;
    chartInstance.data.datasets[0].data = counts;
    chartInstance.options.plugins.title.text = title;
    chartInstance.update('none'); // アニメーションなしで更新
    return chartInstance;
  } else {
    return new Chart(ctx, chartConfig);
  }
}

