// KPI Cards management
class KPICards {
    static update(data) {
        if (!data || !data.kpi_cards) return;
        
        const kpiData = data.kpi_cards;
        
        document.getElementById('kpi-total-patients').innerText = kpiData.total_patients || 0;
        document.getElementById('kpi-adherence-rate').innerText = kpiData.adherence_rate || '0.0';
        document.getElementById('kpi-reminders-sent').innerText = kpiData.reminders_sent || 0;
        document.getElementById('kpi-pending-reminders').innerText = kpiData.pending_reminders || 0;
    }

    static setupClickHandlers() {
        // Add click listener for the pending reminders card
        document.getElementById('pending-reminders-card').addEventListener('click', () => {
            if (window.detailsModal) {
                window.detailsModal.show('pending_reminders', 'Pending Reminders - Details');
            }
        });

        // Add click listener for the total patients card
        document.getElementById('total-patients-card').addEventListener('click', () => {
            if (window.detailsModal) {
                window.detailsModal.show('total_patients', 'Total Patients - Details');
            }
        });
    }
}

window.KPICards = KPICards;
