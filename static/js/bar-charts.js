// Bar Charts
class BarCharts {
    static updateTopMedications(data) {
        if (!data) return;
        
        const config = {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Count',
                    data: data.data,
                    backgroundColor: '#4facfe',
                    borderRadius: 8,
                    barThickness: 30
                }]
            },
            options: {
                ...ChartUtils.getDefaultConfig(),
                indexAxis: 'y',
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: 'rgba(0, 0, 0, 0.05)' } },
                    y: { grid: { display: false } }
                }
            }
        };
        
        ChartUtils.createOrUpdateChart('topMedicationsChart', config);
    }

    static updateDosageDistribution(data) {
        if (!data) return;
        
        const config = {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Count',
                    data: data.data,
                    backgroundColor: '#764ba2',
                    borderRadius: 8,
                    barThickness: 30
                }]
            },
            options: {
                ...ChartUtils.getDefaultConfig(),
                indexAxis: 'y',
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: 'rgba(0, 0, 0, 0.05)' } },
                    y: { grid: { display: false } }
                }
            }
        };
        
        ChartUtils.createOrUpdateChart('dosageDistributionChart', config);
    }

    static updateRemindersByTime(data) {
        if (!data) return;
        
        const config = {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Reminders',
                    data: data.data,
                    backgroundColor: ['#fd7e14', '#ffc107', '#667eea', '#6c757d'],
                    borderRadius: 8
                }]
            },
            options: {
                ...ChartUtils.getDefaultConfig(),
                plugins: { legend: { display: false } },
                scales: {
                    y: { grid: { color: 'rgba(0, 0, 0, 0.05)' } },
                    x: { grid: { display: false } }
                }
            }
        };
        
        ChartUtils.createOrUpdateChart('remindersByTimeChart', config);
    }
}

window.BarCharts = BarCharts;
