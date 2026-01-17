// Details Modal management
class DetailsModal {
    constructor() {
        this.modal = null;
    }

    init() {
        this.modal = new bootstrap.Modal(document.getElementById('detailsModal'));
    }

    show(metric, title) {
        const modalBody = document.getElementById('detailsModalBody');
        const modalTitle = document.getElementById('detailsModalLabel');

        modalTitle.textContent = title;
        modalBody.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div></div>';
        this.modal.show();

        fetch(`/api/details?metric=${metric}`)
            .then(response => response.json())
            .then(data => {
                if (data && data.length > 0) {
                    const headers = Object.keys(data[0]);
                    let table = '<table class="table table-striped table-hover">';
                    table += '<thead><tr>';
                    headers.forEach(h => table += `<th>${h}</th>`);
                    table += '</tr></thead>';
                    table += '<tbody>';
                    data.forEach(row => {
                        table += '<tr>';
                        headers.forEach(h => table += `<td>${row[h] || 'N/A'}</td>`);
                        table += '</tr>';
                    });
                    table += '</tbody></table>';
                    modalBody.innerHTML = table;
                } else {
                    modalBody.innerHTML = '<p class="text-center text-muted">No specific details to display.</p>';
                }
            })
            .catch(error => {
                console.error('Error fetching details:', error);
                modalBody.innerHTML = '<p class="text-center text-danger">Could not load details.</p>';
            });
    }
}

window.DetailsModal = DetailsModal;
