// Main dashboard controller
class Dashboard {
    constructor() {
        this.socket = null;
        this.filterManager = new FilterManager();
        this.detailsModal = new DetailsModal();
    }

    init(initialData) {
        // Initialize Chart.js global configuration
        Chart.defaults.font.family = "'Inter', sans-serif";
        Chart.defaults.responsive = true;
        Chart.defaults.maintainAspectRatio = false;
        Chart.defaults.plugins.legend.labels.usePointStyle = true;
        Chart.defaults.plugins.legend.labels.padding = 15;

        // Initialize components
        this.detailsModal.init();
        window.detailsModal = this.detailsModal; // Make modal globally available
        this.setupSocketConnection();
        this.filterManager.init(this.socket);
        
        // Setup KPI click handlers
        KPICards.setupClickHandlers();
        
        // Initial data load
        this.updateDashboard(initialData);
        this.filterManager.initializeFilters(initialData);
    }

    setupSocketConnection() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('Connected to real-time server.');
        });
        
        this.socket.on('update_data', (msg) => {
            console.log('Received real-time data update.');
            const newData = JSON.parse(msg.data);
            this.updateDashboard(newData);
            this.filterManager.initializeFilters(newData);
        });
        
        this.socket.on('filtered_data', (msg) => {
            console.log('Received filtered data.');
            const filteredData = JSON.parse(msg.data);
            this.updateDashboard(filteredData);
        });
        
        this.socket.on('disconnect', () => {
            console.log('Disconnected from real-time server.');
        });
    }

    updateDashboard(data) {
        // Check if data is empty
        if (!data || Object.keys(data).length === 0) {
            document.getElementById('no-data-message').style.display = 'block';
            document.getElementById('main-dashboard').classList.remove('visible');
            return;
        }
        
        document.getElementById('no-data-message').style.display = 'none';
        document.getElementById('main-dashboard').classList.add('visible');

        // Update all components
        KPICards.update(data);
        
        if (data.adherence_trend) LineCharts.updateAdherenceTrend(data.adherence_trend);
        if (data.reminder_status) PieCharts.updateReminderStatus(data.reminder_status);
        if (data.top_medications) BarCharts.updateTopMedications(data.top_medications);
        if (data.dosage_distribution) BarCharts.updateDosageDistribution(data.dosage_distribution);
        if (data.reminders_by_time) BarCharts.updateRemindersByTime(data.reminders_by_time);
        if (data.upcoming_vs_completed) PieCharts.updateUpcomingVsCompleted(data.upcoming_vs_completed);
        if (data.check_in_table) DataTable.updateCheckInTable(data.check_in_table);

        // Update last updated timestamp
        document.getElementById('last-updated').innerText = new Date().toLocaleTimeString();
    }
}

// Initialize dashboard when DOM is loaded
window.addEventListener('DOMContentLoaded', (event) => {
    const initialDashboardData = JSON.parse(document.getElementById('dashboard-data').textContent);
    const dashboard = new Dashboard();
    dashboard.init(initialDashboardData);
    
    // Make dashboard globally available
    window.dashboard = dashboard;
});
