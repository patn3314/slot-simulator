/* chart-setup.js
 * Chart.js ヒストグラム描画
 * 2025-06-22  maintainAspectRatio=false を追加
 */

function makeBins(data, bins = 30) {
  if (data.length === 0) return { labels: [], counts: [] };
  const min = Math.min(...data);
  const max = Math.max(...data);
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

  if (chartInstance) {
    chartInstance.data.labels = labels;
    chartInstance.data.datasets[0].data = counts;
    chartInstance.options.plugins.title.text = title;
    chartInstance.update();
    return chartInstance;
  } else {
    return new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [{ label: title, data: counts }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,   // ★ 追加：CSS 高さを優先
        scales: {
          y: { beginAtZero: true },
        },
        plugins: {
          legend: { display: false },
          title:  { display: true, text: title },
        },
      },
    });
  }
}