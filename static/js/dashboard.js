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

// Chat Widget Controller
class ChatWidget {
    constructor() {
        this.container = document.getElementById('chat-widget-container');
        this.header = this.container.querySelector('.chat-widget-header');
        this.body = document.getElementById('chat-widget-body');
        this.messages = document.getElementById('chat-messages');
        this.input = document.getElementById('chat-input');
        this.submitBtn = document.getElementById('chat-submit-btn');
        this.toggleBtn = document.getElementById('chat-toggle-btn');

        this.isDragging = false;
        this.isMinimized = false;
    }

    init() {
        this.addEventListeners();
    }

    addEventListeners() {
        this.submitBtn.addEventListener('click', () => this.sendMessage());
        this.input.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });

        this.toggleBtn.addEventListener('click', () => this.toggleMinimize());

        // Dragging logic
        this.header.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.container.style.transition = 'none'; // Disable transition while dragging
            let offsetX = e.clientX - this.container.getBoundingClientRect().left;
            let offsetY = e.clientY - this.container.getBoundingClientRect().top;

            const onMouseMove = (e) => {
                if (!this.isDragging) return;
                let newX = e.clientX - offsetX;
                let newY = e.clientY - offsetY;
                this.container.style.left = `${newX}px`;
                this.container.style.top = `${newY}px`;
            };

            const onMouseUp = () => {
                this.isDragging = false;
                this.container.style.transition = 'all 0.3s ease-in-out'; // Re-enable transition
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }

    toggleMinimize() {
        this.isMinimized = !this.isMinimized;
        if (this.isMinimized) {
            this.body.style.display = 'none';
            this.toggleBtn.textContent = '+';
        } else {
            this.body.style.display = 'flex';
            this.toggleBtn.textContent = '-';
        }
    }

    addMessage(text, type = 'bot') {
        const messageEl = document.createElement('div');
        messageEl.className = `chat-message ${type}`;
        if (type === 'bot' && text === 'loading') {
            messageEl.classList.add('loading');
        } else {
            messageEl.textContent = text;
        }
        this.messages.appendChild(messageEl);
        this.messages.scrollTop = this.messages.scrollHeight;
        return messageEl;
    }

    async sendMessage() {
        const question = this.input.value.trim();
        if (!question) return;

        this.addMessage(question, 'user');
        this.input.value = '';

        const loadingIndicator = this.addMessage('loading', 'bot');

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: question }),
            });

            const data = await response.json();
            loadingIndicator.remove(); // Remove loading indicator
            this.addMessage(data.answer, 'bot');

        } catch (error) {
            console.error('Chat API error:', error);
            loadingIndicator.remove();
            this.addMessage("Sorry, I'm having trouble connecting to the server.", 'bot');
        }
    }
}


// Initialize dashboard when DOM is loaded
window.addEventListener('DOMContentLoaded', (event) => {
    const initialDashboardData = JSON.parse(document.getElementById('dashboard-data').textContent);
    const dashboard = new Dashboard();
    dashboard.init(initialDashboardData);
    
    // Make dashboard globally available
    window.dashboard = dashboard;

    // Initialize the chat widget
    const chatWidget = new ChatWidget();
    chatWidget.init();
});
