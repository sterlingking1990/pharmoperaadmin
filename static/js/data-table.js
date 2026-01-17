// Table management
class DataTable {
    static updateCheckInTable(data) {
        const tableBody = document.getElementById('check-in-table-body');
        tableBody.innerHTML = '';
        
        if (!data || data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No patients currently need a check-in.</td></tr>';
            return;
        }
        
        data.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${row.patient_identifier}</strong></td>
                <td>${row.medication_name}</td>
                <td><span class="badge bg-warning text-dark">${row.status}</span></td>
                <td>${row.check_in_message || 'N/A'}</td>
            `;
            tableBody.appendChild(tr);
        });
    }
}

window.DataTable = DataTable;
