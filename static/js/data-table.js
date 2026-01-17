// Table management
class DataTable {
    static updateCheckInTable(data) {
        const tableBody = document.getElementById('check-in-table-body');
        tableBody.innerHTML = '';
        
        if (!data || data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No patients currently need a post-completion check-in.</td></tr>';
            return;
        }
        
        data.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${row.patient_identifier}</strong></td>
                <td>${row.medication_name}</td>
                <td><span class="badge bg-success text-white">Treatment Completed</span></td>
                <td>${row.check_in_due_date || 'N/A'}</td>
                <td>${row.check_in_message || 'Post-treatment follow-up'}</td>
            `;
            tableBody.appendChild(tr);
        });
    }
}

window.DataTable = DataTable;
