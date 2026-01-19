document.addEventListener('DOMContentLoaded', () => {
    const addButton = document.getElementById('add-medication');
    const form = document.getElementById('prescription-form');

    // Add initial medication field with all inputs
    addMedicationField();

    addButton.addEventListener('click', addMedicationField);
    form.addEventListener('submit', handleFormSubmit);
});

function updateMedicationNumbers() {
    const medicationsContainer = document.getElementById('medications-container');
    const medications = medicationsContainer.querySelectorAll('.medication');
    
    medications.forEach((med, index) => {
        // Update number
        const numberElement = med.querySelector('.medication-number');
        if (numberElement) {
            numberElement.textContent = index + 1;
        }
        
        // Show/hide remove buttons
        const removeBtn = med.querySelector('.remove-medication');
        if (removeBtn) {
            removeBtn.style.display = medications.length > 1 ? 'flex' : 'none';
        }
    });
}

function addMedicationField() {
    const medicationsContainer = document.getElementById('medications-container');
    const medicationCount = medicationsContainer.children.length + 1;
    
    const newMedication = document.createElement('div');
    newMedication.classList.add('medication', 'medication-entry');
    newMedication.innerHTML = `
        <div class="medication-number">${medicationCount}</div>
        <button type="button" class="remove-medication" style="display:none;">×</button>
        
        <div class="row g-3 mb-3">
            <div class="col-md-8">
                <label class="form-label">Medication Name</label>
                <input type="text" class="form-control medication-name" placeholder="e.g., Amoxicillin" required>
            </div>
            <div class="col-md-4">
                <label class="form-label">Dosage</label>
                <input type="text" class="form-control dosage" placeholder="e.g., 1 tablet 500mg" required>
            </div>
        </div>
        
        <div class="frequency-duration-grid mb-3">
            <div>
                <label class="form-label">Frequency</label>
                <select class="form-select frequency" required>
                    <option value="once daily" selected>Once Daily</option>
                    <option value="twice daily">Twice Daily</option>
                    <option value="three times daily">Three Times Daily</option>
                    <option value="four times daily">Four Times Daily</option>
                    <option value="every 6 hours">Every 6 Hours</option>
                    <option value="every 8 hours">Every 8 Hours</option>
                    <option value="every 12 hours">Every 12 Hours</option>
                    <option value="as needed">As Needed</option>
                    <option value="once weekly">Once Weekly</option>
                    <option value="once monthly">Once Monthly</option>
                </select>
            </div>
            <div>
                <label class="form-label">Duration</label>
                <input type="text" class="form-control duration" placeholder="e.g., 7 days">
            </div>
            <div>
                <label class="form-label">Start Date</label>
                <input type="date" class="form-control start-date" min="${new Date().toISOString().split('T')[0]}">
            </div>
        </div>
        
        <div class="mb-3">
            <label class="form-label">Reminder Time(s)</label>
            <input type="text" class="form-control reminder-time" placeholder="e.g., 09:00 AM, 05:00 PM (or leave blank for auto)">
            <small class="text-muted">Leave blank to auto-calculate based on frequency</small>
        </div>
        
        <div>
            <label class="form-label">Special Instructions</label>
            <input type="text" class="form-control instructions" placeholder="e.g., Take with food, avoid alcohol">
        </div>
    `;
    medicationsContainer.appendChild(newMedication);

    // Update medication numbers and visibility of remove buttons
    updateMedicationNumbers();

    // Attach event listener for the new remove button
    newMedication.querySelector('.remove-medication').addEventListener('click', () => {
        newMedication.remove();
        updateMedicationNumbers();
    });
}

function isValidReminderTimeFormat(timeInput) {
    if (!timeInput) return true; // Empty is valid, will be auto-calculated

    // Regex for HH:MM AM/PM format (e.g., "09:00 AM", "5:30 PM")
    // Allows for single or multiple times separated by commas
    const timeRegex = /^(\d{1,2}:\d{2}\s*(AM|PM))(,\s*\d{1,2}:\d{2}\s*(AM|PM))*$/i;
    return timeRegex.test(timeInput.trim());
}

/**
 * Main handler for the form submission.
 */
async function handleFormSubmit(event) {
    event.preventDefault();

    // 1. Gather Raw Data from Form
    const patientIdentifier = document.getElementById('patient-name').value;
    let patientContact = document.getElementById('patient-contact').value;
    const contactMethod = document.getElementById('contact-method').value;
    const checkInDaysAfter = document.getElementById('check-in').value;
    const pharmacistNotes = document.getElementById('pharmacist-notes').value;
    
    // 2. Validate and format phone number (Nigerian numbers only)
    patientContact = formatPhoneNumber(patientContact);
    if (!patientContact) {
        showMessage('Invalid phone number. Please enter a valid Nigerian phone number (e.g., 08012345678 or +2348012345678). Only Nigerian numbers are supported at this time.', 'danger');
        return;
    }

    const medicationElements = document.querySelectorAll('.medication');
    let items = [];
    let allEndDates = [];
    let formIsValid = true;

    // 3. Process each medication item
    medicationElements.forEach((medElement, index) => {
        const med = {
            patient_identifier: patientIdentifier,
            contact_method: 'WhatsApp', // Always WhatsApp for now
            phone_number: patientContact,
            email_address: null, // Email not supported currently
            medication_name: medElement.querySelector('.medication-name').value,
            dosage: medElement.querySelector('.dosage').value,
            frequency: medElement.querySelector('.frequency').value,
            duration: medElement.querySelector('.duration').value || null,
            special_instructions: medElement.querySelector('.instructions').value || null,
            reminder_time_input: medElement.querySelector('.reminder-time').value,
            start_date_input: medElement.querySelector('.start-date').value
        };

        // Basic Validation
        if (!med.medication_name || !med.dosage || !med.frequency) {
            showMessage(`Error in Medication ${index + 1}: Medication Name, Dosage, and Frequency are required.`, 'danger');
            formIsValid = false;
            return;
        }

        // Validate start date is not in the past
        if (med.start_date_input) {
            const today = new Date().toISOString().split('T')[0];
            if (med.start_date_input < today) {
                showMessage(`Error in Medication ${index + 1}: Start date cannot be in the past. Please select today or a future date.`, 'danger');
                formIsValid = false;
                return;
            }
        }

        // Validate Reminder Time Format
        if (!isValidReminderTimeFormat(med.reminder_time_input)) {
            showMessage(`Error in Medication ${index + 1}: Reminder Time(s) must be in HH:MM AM/PM format, separated by commas (e.g., '09:00 AM, 05:30 PM').`, 'danger');
            formIsValid = false;
            return;
        }

        // Calculate start_date (YYYY-MM-DD)
        med.start_date = med.start_date_input || new Date().toISOString().split('T')[0];

        // Calculate reminder_time (HH:MM AM/PM, ...)
        med.reminder_time = calculateReminderTimes(med.frequency, med.reminder_time_input);

        // Calculate end_date
        const endDate = calculateEndDate(med.start_date, med.duration);
        if (endDate) {
            allEndDates.push({ date: endDate, item: med });
        }
        
        // Default check-in fields for every item
        med.should_check_in = "no";
        med.check_in_date = null;

        items.push(med);
    });

    if (!formIsValid) {
        return; // Stop submission if any medication failed validation
    }


    // 4. Handle Check-in Logic
    if (checkInDaysAfter && items.length > 0) {
        // Find the medication that ends last
        if (allEndDates.length > 0) {
            allEndDates.sort((a, b) => b.date - a.date); // Sort descending
            const lastEndingItem = allEndDates[0].item;
            const lastEndDate = allEndDates[0].date;

            // Assign check-in to only that item
            lastEndingItem.should_check_in = "yes";
            lastEndingItem.check_in_days_after = parseInt(checkInDaysAfter, 10);
            lastEndingItem.check_in_message = "How are you feeling after completing your medications?";
            
            const checkInDate = new Date(lastEndDate);
            checkInDate.setDate(checkInDate.getDate() + lastEndingItem.check_in_days_after);
            lastEndingItem.check_in_date = checkInDate.toISOString().split('T')[0];
        }
    }
    
    // 5. Clean up temporary fields before creating the final payload
    items.forEach(item => {
        delete item.reminder_time_input;
        delete item.start_date_input;
    });

    // 6. Construct Final JSON Payload
    const finalPayload = {
        action_type: "medication_reminder",
        items: items,
        metadata: {
            timestamp: new Date().toISOString(),
            pharmacist_notes: pharmacistNotes || null
        }
    };

    // 7. Validate and Send
    if (validatePayload(finalPayload)) {
        sendToWebhook(finalPayload);
    }
}

/**
 * Validates and formats a Nigerian phone number.
 * Converts 08012345678 to 2348012345678, but keeps 234... or +234... as-is.
 * @param {string} phone - The phone number to validate
 * @returns {string|null} - The formatted phone number, or null if invalid
 */
function formatPhoneNumber(phone) {
    if (!phone) return null;
    
    // Remove all spaces, dashes, and parentheses
    phone = phone.trim().replace(/[\s\-\(\)]/g, '');
    
    // Handle Nigerian numbers starting with 0 (e.g., 08012345678)
    if (phone.startsWith('0') && phone.length === 11) {
        // Validate it's a valid Nigerian mobile number
        // Valid prefixes: 0701-0709, 0802-0809, 0810-0819, 0901-0909, 0913-0918
        const firstDigit = phone.charAt(1);
        if (['7', '8', '9'].includes(firstDigit)) {
            return '234' + phone.substring(1); // Convert 0 to 234
        } else {
            return null; // Invalid Nigerian number
        }
    }
    
    // Handle numbers starting with 234 (e.g., 2348012345678)
    if (phone.startsWith('234') && phone.length === 13) {
        // Validate the mobile prefix (must start with 7, 8, or 9)
        const firstDigit = phone.charAt(3);
        if (['7', '8', '9'].includes(firstDigit)) {
            return phone; // Return as-is
        } else {
            return null;
        }
    }
    
    // Handle numbers already with +234 prefix (e.g., +2348012345678)
    if (phone.startsWith('+234') && phone.length === 14) {
        // Validate the mobile prefix (must start with 7, 8, or 9)
        const firstDigit = phone.charAt(4);
        if (['7', '8', '9'].includes(firstDigit)) {
            return phone; // Return as-is
        } else {
            return null;
        }
    }
    
    // Reject any other format (only Nigerian numbers are supported)
    return null;
}

/**
 * Calculates reminder times based on frequency text or explicit input.
 */
function calculateReminderTimes(frequency, reminderTimeInput) {
    if (reminderTimeInput) {
        // Return user-provided times, assuming they are correctly formatted
        return reminderTimeInput.split(',').map(t => t.trim()).join(', ');
    }

    const freqLower = frequency.toLowerCase();
    if (freqLower.includes('once daily') || freqLower.includes('24 hourly')) return "09:00 AM";
    if (freqLower.includes('twice daily') || freqLower.includes('12 hourly')) return "09:00 AM, 09:00 PM";
    if (freqLower.includes('three times daily') || freqLower.includes('8 hourly')) return "09:00 AM, 05:00 PM, 01:00 AM";
    if (freqLower.includes('four times daily') || freqLower.includes('6 hourly')) return "09:00 AM, 03:00 PM, 09:00 PM, 03:00 AM";
    
    // New defaults for less frequent reminders
    if (freqLower.includes('once weekly') || freqLower.includes('once monthly')) return "09:00 AM";

    // Default for unknown frequency
    return "09:00 AM";
}

/**
 * Calculates the end date based on a start date and a duration string (e.g., "7 days").
 */
function calculateEndDate(startDateStr, durationStr) {
    if (!startDateStr || !durationStr) return null;

    const startDate = new Date(startDateStr);
    const durationParts = durationStr.match(/(\d+)\s*(day|week|month)s?/i);
    if (!durationParts) return null;

    const quantity = parseInt(durationParts[1], 10);
    const unit = durationParts[2].toLowerCase();

    let endDate = new Date(startDate);
    if (unit === 'day') {
        endDate.setDate(startDate.getDate() + quantity);
    } else if (unit === 'week') {
        endDate.setDate(startDate.getDate() + quantity * 7);
    } else if (unit === 'month') {
        endDate.setMonth(startDate.getMonth() + quantity);
    } else {
        return null;
    }
    return endDate;
}

/**
 * Validates the final JSON payload against prompt requirements.
 */
function validatePayload(payload) {
    let isValid = true;
    if (!payload.items || payload.items.length === 0) {
        alert('Error: No medication items were provided.');
        return false;
    }

    payload.items.forEach((item, index) => {
        if (!item.patient_identifier || item.patient_identifier.length < 2) {
            alert(`Error in Medication ${index + 1}: Patient Name/ID is required (min 2 characters).`);
            isValid = false;
        }
        if (!item.medication_name || item.medication_name.length < 2) {
            alert(`Error in Medication ${index + 1}: Medication Name is required (min 2 characters).`);
            isValid = false;
        }
        if (item.should_check_in === "yes" && (!item.check_in_date || !item.check_in_days_after)) {
             alert(`Error in Medication ${index + 1}: Check-in is enabled but date or days after is missing.`);
            isValid = false;
        }
        if (item.should_check_in === "no" && item.check_in_date !== null) {
            alert(`Error in Medication ${index + 1}: Check-in is disabled but a check-in date is present.`);
            isValid = false;
        }
    });

    return isValid;
}

/**
 * Sends the final data to the webhook.
 */
function sendToWebhook(finalPayload) { // Renamed 'data' to 'finalPayload' for clarity
    const webhookUrl = 'https://hook.eu2.make.com/j774n525ml2qltav9ztr7iivrytkv58q';
    console.log("Original payload for extracted_json:", JSON.stringify(finalPayload, null, 2));

    const stringifiedExtractedJson = JSON.stringify(finalPayload);

    // Get patientContact and patientIdentifier from the first item (assuming all items have the same patient info)
    const patientIdentifier = finalPayload.items.length > 0 ? finalPayload.items[0].patient_identifier : "Unknown Patient";
    const patientContactPhone = finalPayload.items.length > 0 ? finalPayload.items[0].phone_number : null;
    const patientContactEmail = finalPayload.items.length > 0 ? finalPayload.items[0].email_address : null;

    const newWebhookPayload = [
        {
            "info": null,
            "service": "whatsapp",
            "title": "pharmreminderWH",
            "bot": {
                "url": "https://wa.me/2348068267509",
                "external_id": "2348068267509",
                "id": "694dc373946b6bd4c1052f83",
                "channel": "WHATSAPP",
                "name": "PharmOpera"
            },
            "contact": {
                "username": patientIdentifier,
                "name": patientIdentifier,
                "tags": [],
                "last_message": "Yes proceed with the setup",
                "photo": null,
                "variables": {
                    "extracted_json": stringifiedExtractedJson
                },
                "operator": null,
                "phone": patientContactPhone || patientContactEmail, // Use phone if available, else email
                "last_message_data": {
                    "message": {
                        "tracking_data": null,
                        "from": patientContactPhone ? parseInt(patientContactPhone.replace('+', ''), 10) : null,
                        "text": {
                            "body": "Yes proceed with the setup"
                        },
                        "to": null,
                        "errors": null,
                        "context": null,
                        "timestamp": Math.floor(Date.now() / 1000),
                        "referral": null,
                        "type": "text",
                        "id": "wamid.HBgNMjM0NzA2NjA2MTE2MBUCABIYFDNBQTc2RTJBNkI3ODdFQzEzMzlFAA==",
                        "identity": null
                    },
                    "message_id": "wamid.HBgNMjM0NzA2NjA2MTE2MBUCABIYFDNBQTc2RTJBNkI3ODdFQzEzMzlFAA=="
                },
                "country": "NG",
                "telegram_id": null,
                "id": "69517fb131aded02cc053f75"
            },
            "date": Math.floor(Date.now() / 1000)
        }
    ];

    console.log("Sending new webhook payload:", JSON.stringify(newWebhookPayload, null, 2));

    // Get submit button and add loading state
    const submitBtn = document.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    fetch(webhookUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(newWebhookPayload), // Send the new payload
    })
    .then(response => {
        // Remove loading state
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;

        if (response.ok) {
            // Show success message
            showMessage('Prescription scheduled successfully! 🎉', 'success');
            
            // Reset form
            document.getElementById('prescription-form').reset();
            
            // Clear all but one medication field
            const medicationsContainer = document.getElementById('medications-container');
            while (medicationsContainer.children.length > 1) {
                medicationsContainer.removeChild(medicationsContainer.lastChild);
            }
            
            // Ensure the remove button on the last one is hidden
            updateMedicationNumbers();
        } else {
            response.text().then(text => {
                showMessage(`Failed to schedule prescription: ${text}`, 'danger');
            });
        }
    })
    .catch((error) => {
        // Remove loading state
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
        
        console.error('Error:', error);
        showMessage('An error occurred while scheduling the prescription. Please try again.', 'danger');
    });
}

/**
 * Shows a styled message to the user
 */
function showMessage(message, type = 'info') {
    const statusMessageContainer = document.getElementById('form-status-message');
    if (!statusMessageContainer) {
        console.error("Error: form-status-message container not found.");
        return;
    }

    // Clear any existing messages in the container
    statusMessageContainer.innerHTML = '';

    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.innerHTML = message;
    alert.style.marginBottom = '0'; // Adjust margin as needed for the new placement

    statusMessageContainer.appendChild(alert);

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        alert.style.transition = 'opacity 0.5s ease';
        alert.style.opacity = '0';
        setTimeout(() => alert.remove(), 500);
    }, 5000);
}