// Chart utilities and common functions
class ChartUtils {
    static createGradient(ctx, color1, color2) {
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, color1);
        gradient.addColorStop(1, color2);
        return gradient;
    }

    static getDefaultConfig() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        usePointStyle: true,
                        padding: 15
                    }
                }
            }
        };
    }

    static createOrUpdateChart(chartId, config) {
        const ctx = document.getElementById(chartId).getContext('2d');
        if (window.charts[chartId]) {
            window.charts[chartId].data = config.data;
            window.charts[chartId].update();
        } else {
            window.charts[chartId] = new Chart(ctx, config);
        }
    }
}

// Initialize global charts object
window.charts = window.charts || {};

// Export for use in other modules
window.ChartUtils = ChartUtils;
