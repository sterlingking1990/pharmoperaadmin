// Table management
class DataTable {
    static updateCheckInTable(data) {
        const tableBody = document.getElementById('check-in-table-body');
        tableBody.innerHTML = '';
        
        if (!data || data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No patients currently need a post-completion check-in.</td></tr>';
            return;
        }
        
        data.forEach(row => {
            const tr = document.createElement('tr');
            // Determine badge color based on status (simple example)
            let statusBadgeClass = 'bg-secondary';
            if (row.status === 'completed') {
                statusBadgeClass = 'bg-success';
            } else if (row.status === 'pending' || row.status === 'upcoming') {
                statusBadgeClass = 'bg-warning text-dark';
            } else if (row.status === 'missed') {
                statusBadgeClass = 'bg-danger';
            }

            tr.innerHTML = `
                <td><strong>${row.patient_identifier}</strong></td>
                <td>${row.medication_name}</td>
                <td><span class="badge ${statusBadgeClass}">${row.status}</span></td>
                <td>${row.check_in_date || 'N/A'}</td>
                <td>${row.check_in_message || 'Post-treatment follow-up'}</td>
            `;
            tableBody.appendChild(tr);
        });
    }
}

window.DataTable = DataTable;
