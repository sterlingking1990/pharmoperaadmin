// Line and Area Charts
class LineCharts {
    static updateAdherenceTrend(data) {
        if (!data) return;
        
        const ctx = document.getElementById('adherenceTrendChart').getContext('2d');
        const config = {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Adherence Rate',
                    data: data.data,
                    borderColor: '#667eea',
                    backgroundColor: ChartUtils.createGradient(ctx, 'rgba(102, 126, 234, 0.2)', 'rgba(118, 75, 162, 0.05)'),
                    fill: true,
                    tension: 0.4,
                    borderWidth: 3,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    pointBackgroundColor: '#667eea',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                ...ChartUtils.getDefaultConfig(),
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        grid: { color: 'rgba(0, 0, 0, 0.05)' }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        };
        
        ChartUtils.createOrUpdateChart('adherenceTrendChart', config);
    }
}

window.LineCharts = LineCharts;
