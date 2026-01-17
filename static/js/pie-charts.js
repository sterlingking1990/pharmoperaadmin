// Pie and Doughnut Charts
class PieCharts {
    static updateReminderStatus(data) {
        if (!data) return;
        
        const config = {
            type: 'pie',
            data: {
                labels: data.labels,
                datasets: [{
                    data: data.data,
                    backgroundColor: ['#667eea', '#f5576c', '#fee140', '#4facfe', '#6c757d'],
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: {
                ...ChartUtils.getDefaultConfig(),
                plugins: {
                    legend: { 
                        position: 'bottom', 
                        labels: { 
                            padding: 20, 
                            font: { size: 12 } 
                        } 
                    }
                },
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const statusName = data.labels[index];
                        if (window.detailsModal) {
                            window.detailsModal.show(`status_${statusName}`, `${statusName} Reminders - Patient Details`);
                        }
                    }
                }
            }
        };
        
        ChartUtils.createOrUpdateChart('reminderStatusChart', config);
    }

    static updateUpcomingVsCompleted(data) {
        if (!data) return;
        
        const config = {
            type: 'doughnut',
            data: {
                labels: data.labels,
                datasets: [{
                    data: data.data,
                    backgroundColor: ['#fee140', '#f5576c'],
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: {
                ...ChartUtils.getDefaultConfig(),
                plugins: {
                    legend: { 
                        position: 'bottom', 
                        labels: { 
                            padding: 20, 
                            font: { size: 12 } 
                        } 
                    }
                },
                cutout: '70%'
            }
        };
        
        ChartUtils.createOrUpdateChart('upcomingVsCompletedChart', config);
    }
}

window.PieCharts = PieCharts;
