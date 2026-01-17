// Filter management
class FilterManager {
    constructor() {
        this.filterState = {
            dateRange: 'all',
            status: ['all'],
            medication: 'all',
            adherence: 'all',
            patientSearch: '',
            checkin: 'all',
            timeOfDay: 'all',
            frequency: 'all'
        };
        this.socket = null;
    }

    init(socket) {
        this.socket = socket;
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.getElementById('filter-date-range').addEventListener('change', (e) => {
            this.filterState.dateRange = e.target.value;
            this.applyFilters();
        });

        document.getElementById('filter-status').addEventListener('change', (e) => {
            const selectedValue = e.target.value;
            this.filterState.status = selectedValue === 'all' ? ['all'] : [selectedValue];
            this.applyFilters();
        });

        document.getElementById('filter-medication').addEventListener('change', (e) => {
            this.filterState.medication = e.target.value;
            this.applyFilters();
        });

        document.getElementById('filter-adherence').addEventListener('change', (e) => {
            this.filterState.adherence = e.target.value;
            this.applyFilters();
        });

        document.getElementById('filter-patient-search').addEventListener('input', (e) => {
            this.filterState.patientSearch = e.target.value.trim();
            this.applyFilters();
        });

        document.getElementById('filter-checkin').addEventListener('change', (e) => {
            this.filterState.checkin = e.target.value;
            this.applyFilters();
        });

        document.getElementById('filter-time-of-day').addEventListener('change', (e) => {
            this.filterState.timeOfDay = e.target.value;
            this.applyFilters();
        });

        document.getElementById('filter-frequency').addEventListener('change', (e) => {
            this.filterState.frequency = e.target.value;
            this.applyFilters();
        });

        document.getElementById('clear-filters').addEventListener('click', () => {
            this.clearAllFilters();
        });
    }

    initializeFilters(data) {
        if (!data || Object.keys(data).length === 0) return;
        
        if (data.top_medications && data.top_medications.labels) {
            const medSelect = document.getElementById('filter-medication');
            
            while (medSelect.options.length > 1) {
                medSelect.remove(1);
            }
            
            data.top_medications.labels.forEach(med => {
                const option = document.createElement('option');
                option.value = med;
                option.textContent = med;
                medSelect.appendChild(option);
            });
        }
    }

    updateFilterChips() {
        const chipsContainer = document.getElementById('filter-chips');
        const activeFiltersDiv = document.getElementById('active-filters');
        chipsContainer.innerHTML = '';
        
        let hasActiveFilters = false;
        
        if (this.filterState.dateRange !== 'all') {
            hasActiveFilters = true;
            const chip = this.createFilterChip(`Date: Last ${this.filterState.dateRange} days`, 'dateRange');
            chipsContainer.appendChild(chip);
        }
        
        if (!this.filterState.status.includes('all') && this.filterState.status.length > 0) {
            hasActiveFilters = true;
            const chip = this.createFilterChip(`Status: ${this.filterState.status.join(', ')}`, 'status');
            chipsContainer.appendChild(chip);
        }
        
        if (this.filterState.medication !== 'all') {
            hasActiveFilters = true;
            const chip = this.createFilterChip(`Medication: ${this.filterState.medication}`, 'medication');
            chipsContainer.appendChild(chip);
        }
        
        if (this.filterState.adherence !== 'all') {
            hasActiveFilters = true;
            const labels = { high: 'High (>80%)', medium: 'Medium (60-80%)', low: 'Low (<60%)' };
            const chip = this.createFilterChip(`Adherence: ${labels[this.filterState.adherence]}`, 'adherence');
            chipsContainer.appendChild(chip);
        }
        
        if (this.filterState.patientSearch) {
            hasActiveFilters = true;
            const chip = this.createFilterChip(`Patient: ${this.filterState.patientSearch}`, 'patientSearch');
            chipsContainer.appendChild(chip);
        }
        
        if (this.filterState.checkin !== 'all') {
            hasActiveFilters = true;
            const chip = this.createFilterChip(`Check-in: ${this.filterState.checkin}`, 'checkin');
            chipsContainer.appendChild(chip);
        }
        
        if (this.filterState.timeOfDay !== 'all') {
            hasActiveFilters = true;
            const chip = this.createFilterChip(`Time: ${this.filterState.timeOfDay}`, 'timeOfDay');
            chipsContainer.appendChild(chip);
        }
        
        activeFiltersDiv.style.display = hasActiveFilters ? 'block' : 'none';
    }

    createFilterChip(text, filterKey) {
        const chip = document.createElement('span');
        chip.className = 'filter-chip';
        chip.innerHTML = `
            ${text}
            <span class="remove" data-filter="${filterKey}">✕</span>
        `;
        
        chip.querySelector('.remove').addEventListener('click', (e) => {
            this.removeFilter(e.target.dataset.filter);
        });
        
        return chip;
    }

    removeFilter(filterKey) {
        switch(filterKey) {
            case 'dateRange':
                this.filterState.dateRange = 'all';
                document.getElementById('filter-date-range').value = 'all';
                break;
            case 'status':
                this.filterState.status = ['all'];
                document.getElementById('filter-status').value = 'all';
                break;
            case 'medication':
                this.filterState.medication = 'all';
                document.getElementById('filter-medication').value = 'all';
                break;
            case 'adherence':
                this.filterState.adherence = 'all';
                document.getElementById('filter-adherence').value = 'all';
                break;
            case 'patientSearch':
                this.filterState.patientSearch = '';
                document.getElementById('filter-patient-search').value = '';
                break;
            case 'checkin':
                this.filterState.checkin = 'all';
                document.getElementById('filter-checkin').value = 'all';
                break;
            case 'timeOfDay':
                this.filterState.timeOfDay = 'all';
                document.getElementById('filter-time-of-day').value = 'all';
                break;
        }
        
        this.applyFilters();
    }

    clearAllFilters() {
        this.filterState = {
            dateRange: 'all',
            status: ['all'],
            medication: 'all',
            adherence: 'all',
            patientSearch: '',
            checkin: 'all',
            timeOfDay: 'all',
            frequency: 'all'
        };
        
        document.getElementById('filter-date-range').value = 'all';
        document.getElementById('filter-status').value = 'all';
        document.getElementById('filter-medication').value = 'all';
        document.getElementById('filter-adherence').value = 'all';
        document.getElementById('filter-patient-search').value = '';
        document.getElementById('filter-checkin').value = 'all';
        document.getElementById('filter-time-of-day').value = 'all';
        document.getElementById('filter-frequency').value = 'all';
        
        this.applyFilters();
    }

    applyFilters() {
        this.updateFilterChips();
        
        console.log('Applying filters:', JSON.stringify(this.filterState, null, 2));
        
        if (this.socket && this.socket.connected) {
            this.socket.emit('apply_filters', { filters: this.filterState });
        } else {
            // Fallback to HTTP request if socket not connected
            fetch('/api/filter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.filterState)
            })
            .then(response => response.json())
            .then(data => {
                if (window.dashboard) {
                    window.dashboard.updateDashboard(data);
                }
            })
            .catch(error => console.error('Filter error:', error));
        }
    }
}

window.FilterManager = FilterManager;
