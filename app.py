import os
from dotenv import load_dotenv
from gevent import monkey
monkey.patch_all()

# Load environment variables from .env file
load_dotenv()

import pandas as pd
import gspread
from google.oauth2.service_account import Credentials
from flask import Flask, render_template, request, redirect, session, url_for, jsonify
from flask_socketio import SocketIO, emit
import json
from threading import Thread, Event
import numpy as np
from datetime import timedelta

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'd6216c369373cf88f08e443b5071575acb4a7d5e1e1c2739e1cd0c313f9fefca')
socketio = SocketIO(app, async_mode='threading', cors_allowed_origins="*")

# --- Google Sheets Configuration ---
SERVICE_ACCOUNT_FILE = 'credentials.json'
SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
]
SHEET_NAME = os.environ.get('SHEET_NAME', 'patient_reminder')
USERS_TAB = os.environ.get('USERS_TAB', 'pharmacyonboarding')
REMINDER_TAB = os.environ.get('REMINDER_TAB', 'ReminderData')

# --- Background Thread for Polling ---
thread = Thread()
thread_stop_event = Event()

def get_google_sheet_data(tab_name):
    """Fetches all records from a specific tab in the Google Sheet."""
    try:
        # Use environment variables for credentials
        if os.environ.get('GOOGLE_CREDENTIALS'):
            # For production (Vercel)
            import json
            creds_dict = json.loads(os.environ.get('GOOGLE_CREDENTIALS'))
            creds = Credentials.from_service_account_info(creds_dict, scopes=SCOPES)
        else:
            # For local development
            creds = Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE, scopes=SCOPES)
        client = gspread.authorize(creds)
        sheet = client.open(SHEET_NAME).worksheet(tab_name)
        records = sheet.get_all_records()
        return pd.DataFrame(records)
    except Exception as e:
        print(f"Error accessing Google Sheet '{tab_name}': {e}")
        return pd.DataFrame()

def apply_filters(pharmacy_df, filters):
    """Apply filters to the pharmacy dataframe."""
    filtered_df = pharmacy_df.copy()
    
    print(f"DEBUG: Starting with {len(filtered_df)} rows")
    print(f"DEBUG: Filters received: {filters}")
    
    # Date Range Filter
    if filters.get('dateRange') and filters['dateRange'] != 'all':
        try:
            days = int(filters['dateRange'])
            cutoff_date = pd.Timestamp.now() - timedelta(days=days)
            filtered_df = filtered_df[filtered_df['time_stamp'] >= cutoff_date]
            print(f"DEBUG: After date filter ({days} days): {len(filtered_df)} rows")
        except Exception as e:
            print(f"DEBUG: Date filter error: {e}")
    
    # Status Filter - FIXED
    if filters.get('status'):
        status_list = filters['status']
        print(f"DEBUG: Status filter value: {status_list}")
        
        if isinstance(status_list, str):
            status_list = [status_list]
        
        if status_list and 'all' not in status_list:
            # Convert to lowercase for comparison
            status_list_lower = [s.lower() for s in status_list]
            print(f"DEBUG: Filtering for statuses: {status_list_lower}")
            print(f"DEBUG: Unique statuses in data: {filtered_df['status'].unique()}")
            
            filtered_df = filtered_df[filtered_df['status'].isin(status_list_lower)]
            print(f"DEBUG: After status filter: {len(filtered_df)} rows")
    
    # Medication Filter
    if filters.get('medication') and filters['medication'] != 'all':
        filtered_df = filtered_df[filtered_df['medication_name'] == filters['medication']]
        print(f"DEBUG: After medication filter: {len(filtered_df)} rows")
    
    # Patient Search Filter
    if filters.get('patientSearch') and filters['patientSearch'].strip():
        search_term = filters['patientSearch'].lower().strip()
        filtered_df = filtered_df[
            filtered_df['patient_identifier'].astype(str).str.lower().str.contains(search_term, na=False)
        ]
        print(f"DEBUG: After patient search filter: {len(filtered_df)} rows")
    
    # Check-in Filter
    if filters.get('checkin') and filters['checkin'] != 'all':
        filtered_df = filtered_df[filtered_df['should_check_in'] == filters['checkin']]
        print(f"DEBUG: After check-in filter: {len(filtered_df)} rows")
    
    # Time of Day Filter
    if filters.get('timeOfDay') and filters['timeOfDay'] != 'all':
        time_filter = filters['timeOfDay'].capitalize()
        filtered_df = filtered_df[filtered_df['time_category'] == time_filter]
        print(f"DEBUG: After time filter: {len(filtered_df)} rows")
    
    # Frequency Filter
    if filters.get('frequency') and filters['frequency'] != 'all':
        filtered_df = filtered_df[filtered_df['frequency'] == filters['frequency']]
        print(f"DEBUG: After frequency filter: {len(filtered_df)} rows")
    
    print(f"DEBUG: Final filtered count: {len(filtered_df)} rows")
    return filtered_df

def get_dashboard_data(phone_no, df, filters=None):
    """Processes the DataFrame to generate all data needed for the dashboard."""
    
    # --- Robust primary filter with whitespace stripping ---
    df['pharmacy_id'] = df['pharmacy_id'].astype(str).str.strip()
    pharmacy_df = df[df['pharmacy_id'] == str(phone_no).strip()].copy()

    if pharmacy_df.empty:
        return {}

    # --- Robust Data Cleaning and Preparation ---
    pharmacy_df['status'] = pharmacy_df['status'].astype(str).str.strip().str.lower()
    # time_stamp is already UTC-aware because source data has 'Z'
    pharmacy_df['time_stamp'] = pd.to_datetime(pharmacy_df['time_stamp'], errors='coerce')
    pharmacy_df['reminderTimeObj'] = pd.to_datetime(pharmacy_df['reminderTime'], format='%H:%M', errors='coerce').dt.time
    # Make next_reminder_time UTC-aware to allow comparison
    pharmacy_df['next_reminder_time'] = pd.to_datetime(pharmacy_df['next_reminder_time'], errors='coerce').dt.tz_localize('UTC', ambiguous='infer', nonexistent='NaT')
    pharmacy_df['should_check_in'] = pharmacy_df['should_check_in'].fillna('').astype(str).str.lower()
    
    # Categorize time before filtering
    def categorize_time(t):
        if pd.notnull(t):
            if t.hour < 12: return 'Morning'
            if 12 <= t.hour < 17: return 'Afternoon'
            return 'Evening'
        return 'Unknown'
    pharmacy_df['time_category'] = pharmacy_df['reminderTimeObj'].apply(categorize_time)
    
    # Apply filters if provided
    if filters:
        pharmacy_df = apply_filters(pharmacy_df, filters)
        
        if pharmacy_df.empty:
            return get_empty_dashboard_data()
    
    # --- Adherence Calculation ---
    now = pd.Timestamp.utcnow() # Use timezone-aware UTC timestamp
    missed_mask = (pharmacy_df['status'] != 'completed') & (pharmacy_df['next_reminder_time'] < now)
    
    completed_reminders = (pharmacy_df['status'] == 'completed').sum()
    missed_reminders = missed_mask.sum()
    
    total_relevant_reminders = completed_reminders + missed_reminders
    adherence_rate = (completed_reminders / total_relevant_reminders) * 100 if total_relevant_reminders > 0 else 0

    # Apply adherence level filter if needed
    if filters and filters.get('adherence') and filters['adherence'] != 'all':
        adherence_level = filters['adherence']
        # This logic returns an empty dashboard if the adherence rate doesn't match the filter
        patient_adherence = pharmacy_df.groupby('patient_identifier').apply(
            lambda x: (x['status'] == 'completed').sum() / ((x['status'] == 'completed').sum() + ((x['status'] != 'completed') & (x['next_reminder_time'] < now)).sum()) * 100
        ).fillna(0)
        
        high_adherence_patients = patient_adherence[patient_adherence > 80].index
        medium_adherence_patients = patient_adherence[(patient_adherence >= 60) & (patient_adherence <= 80)].index
        low_adherence_patients = patient_adherence[patient_adherence < 60].index

        if adherence_level == 'high':
            pharmacy_df = pharmacy_df[pharmacy_df['patient_identifier'].isin(high_adherence_patients)]
        elif adherence_level == 'medium':
            pharmacy_df = pharmacy_df[pharmacy_df['patient_identifier'].isin(medium_adherence_patients)]
        elif adherence_level == 'low':
            pharmacy_df = pharmacy_df[pharmacy_df['patient_identifier'].isin(low_adherence_patients)]
        
        if pharmacy_df.empty:
            return get_empty_dashboard_data()


    # --- KPI Cards ---
    total_patients = pharmacy_df['patient_identifier'].nunique()
    status_counts = pharmacy_df['status'].value_counts()
    pending_reminders = status_counts.get('pending', 0) + status_counts.get('upcoming', 0)

    # --- Adherence Trend (Line Chart) ---
    adherence_df = pharmacy_df[pharmacy_df['status'].isin(['completed']) | missed_mask].copy()
    # Group by the reminder's due date for a more intuitive trend
    adherence_df['date'] = adherence_df['next_reminder_time'].dt.date
    adherence_by_day = adherence_df.groupby('date')['status'].apply(
        lambda x: (x == 'completed').sum() / len(x) * 100 if len(x) > 0 else 0
    ).reset_index()
    adherence_by_day = adherence_by_day.sort_values('date')

    # --- Top Medications / Dosages ---
    top_meds = pharmacy_df['medication_name'].value_counts().nlargest(5)
    dosage_dist = pharmacy_df['dosage'].value_counts().nlargest(5)

    # --- Reminders by Time of Day ---
    reminders_by_time = pharmacy_df['time_category'].value_counts()
    
    # --- Upcoming vs Completed ---
    upcoming_vs_completed = status_counts

    # --- Patients Needing Check-In (Table) ---
    check_in_patients = pharmacy_df[pharmacy_df['should_check_in'] == 'yes']
    check_in_table = check_in_patients[['patient_identifier', 'phone_number', 'medication_name', 'status', 'check_in_message']].to_dict('records')

    # --- Final Data Structure ---
    dashboard_data = {
        "kpi_cards": {
            "total_patients": int(total_patients),
            "adherence_rate": f"{adherence_rate:.1f}",
            "reminders_sent": int(total_relevant_reminders),
            "pending_reminders": int(pending_reminders)
        },
        "adherence_trend": {
            "labels": [d.strftime('%Y-%m-%d') for d in adherence_by_day['date']],
            "data": list(adherence_by_day['status'])
        },
        "reminder_status": {
            "labels": list(status_counts.index),
            "data": [int(v) for v in status_counts.values]
        },
        "top_medications": {
            "labels": list(top_meds.index),
            "data": [int(v) for v in top_meds.values]
        },
        "dosage_distribution": {
            "labels": list(dosage_dist.index),
            "data": [int(v) for v in dosage_dist.values]
        },
        "reminders_by_time": {
            "labels": ['Morning', 'Afternoon', 'Evening', 'Unknown'],
            "data": [int(reminders_by_time.get(c, 0)) for c in ['Morning', 'Afternoon', 'Evening', 'Unknown']]
        },
        "upcoming_vs_completed": {
            "labels": ['Upcoming', 'Completed'],
            "data": [int(upcoming_vs_completed.get('pending', 0) + upcoming_vs_completed.get('upcoming', 0)), 
                     int(upcoming_vs_completed.get('completed', 0))]
        },
        "check_in_table": check_in_table
    }
    return dashboard_data

def get_empty_dashboard_data():
    """Returns empty dashboard structure when filters result in no data."""
    return {
        "kpi_cards": { "total_patients": 0, "adherence_rate": "0.0", "reminders_sent": 0, "pending_reminders": 0 },
        "adherence_trend": {"labels": [], "data": []},
        "reminder_status": {"labels": [], "data": []},
        "top_medications": {"labels": [], "data": []},
        "dosage_distribution": {"labels": [], "data": []},
        "reminders_by_time": {"labels": ['Morning', 'Afternoon', 'Evening', 'Unknown'], "data": [0, 0, 0, 0]},
        "upcoming_vs_completed": {"labels": ['Upcoming', 'Completed'], "data": [0, 0]},
        "check_in_table": []
    }

def poll_google_sheet():
    """Background thread to poll Google Sheet for changes and notify clients."""
    last_data_hash = None
    while not thread_stop_event.isSet():
        df = get_google_sheet_data(REMINDER_TAB)
        if not df.empty:
            current_data_hash = pd.util.hash_pandas_object(df, index=True).sum()
            if last_data_hash is None or current_data_hash != last_data_hash:
                last_data_hash = current_data_hash
                
                print("Data change detected, emitting 'data_changed' to all clients.")
                # Emit a simple notification. The client will trigger a filter refresh.
                socketio.emit('data_changed')
        socketio.sleep(10)

# --- Flask Routes ---
@app.route('/', methods=['GET'])
def home():
    if 'phone_no' in session:
        return redirect(url_for('dashboard'))
    return render_template('login.html')

@app.route('/login', methods=['POST'])
def login():
    phone_no = request.form['phone_no'].strip()
    unique_code = request.form['unique_code']
    
    users_df = get_google_sheet_data(USERS_TAB)
    if users_df.empty:
        return render_template('login.html', error="Could not verify users at this time.")

    users_df['phone_no'] = users_df['phone_no'].astype(str).str.strip()
    users_df['unique_code'] = users_df['unique_code'].astype(str)

    matches = users_df[(users_df['phone_no'] == phone_no) & (users_df['unique_code'] == unique_code)]
    
    if not matches.empty:
        session['phone_no'] = phone_no
        session['pharm_name'] = matches.iloc[0]['pharm_name']
        return redirect(url_for('dashboard'))
        
    return render_template('login.html', error="Invalid credentials. Please try again.")

@app.route('/dashboard', methods=['GET'])
def dashboard():
    if 'phone_no' not in session:
        return redirect(url_for('home'))
        
    phone_no = session.get('phone_no')
    df = get_google_sheet_data(REMINDER_TAB)
    # Load initial data with default filters (or no filters)
    dashboard_data = get_dashboard_data(phone_no, df, {"dateRange":"all"}) # Default to All Time

    # For the initial load, we also need to get the unique filter options from the *unfiltered* data
    if not df.empty:
        pharmacy_df = df[df['pharmacy_id'].astype(str).str.strip() == str(phone_no).strip()].copy()
        if not pharmacy_df.empty:
            filters = {
                "medications": sorted(pharmacy_df['medication_name'].unique().tolist()),
                "statuses": sorted(pharmacy_df['status'].str.strip().str.lower().unique().tolist()),
                "frequencies": sorted(pharmacy_df['frequency'].unique().tolist())
            }
        else:
            filters = {"medications": [], "statuses": [], "frequencies": []}
    else:
        filters = {"medications": [], "statuses": [], "frequencies": []}

    return render_template('dashboard_modular.html', phone_no=phone_no, pharm_name=session.get('pharm_name', phone_no), dashboard_data=json.dumps(dashboard_data, default=str), filters=json.dumps(filters))

@app.route('/api/filter', methods=['POST'])
def filter_data():
    """API endpoint to handle filter requests."""
    if 'phone_no' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    phone_no = session.get('phone_no')
    filters = request.json
    
    df = get_google_sheet_data(REMINDER_TAB)
    dashboard_data = get_dashboard_data(phone_no, df, filters)
    
    return jsonify(dashboard_data)

@app.route('/api/details')
def get_details():
    """API endpoint to get detailed data for drill-downs."""
    if 'phone_no' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    phone_no = session.get('phone_no')
    metric = request.args.get('metric')
    
    df = get_google_sheet_data(REMINDER_TAB)
    if df.empty:
        return jsonify([])

    # Basic cleaning
    df['pharmacy_id'] = df['pharmacy_id'].astype(str).str.strip()
    df['status'] = df['status'].astype(str).str.strip().str.lower()
    df['next_reminder_time'] = pd.to_datetime(df['next_reminder_time'], errors='coerce')

    pharmacy_df = df[df['pharmacy_id'] == str(phone_no).strip()].copy()

    details_df = pd.DataFrame()

    if metric == 'pending_reminders':
        details_df = pharmacy_df[pharmacy_df['status'].isin(['pending', 'upcoming'])]
        # Select and rename columns for clarity in the modal
        details_df = details_df[[
            'patient_identifier', 'phone_number', 'medication_name', 'next_reminder_time'
        ]].rename(columns={
            'patient_identifier': 'Patient Name',
            'phone_number': 'Phone Number',
            'medication_name': 'Medication',
            'next_reminder_time': 'Next Reminder'
        })
        # Format date for better readability
        details_df['Next Reminder'] = details_df['Next Reminder'].dt.strftime('%Y-%m-%d %I:%M %p')

    elif metric == 'total_patients':
        try:
            # Simple patient list with basic info
            patient_list = []
            for patient_id in pharmacy_df['patient_identifier'].unique():
                patient_data = pharmacy_df[pharmacy_df['patient_identifier'] == patient_id]
                
                patient_list.append({
                    'Patient Name': patient_id,
                    'Phone Number': patient_data['phone_number'].iloc[0] if len(patient_data) > 0 else 'N/A',
                    'Primary Medication': patient_data['medication_name'].iloc[0] if len(patient_data) > 0 else 'N/A',
                    'Total Reminders': len(patient_data)
                })
            
            details_df = pd.DataFrame(patient_list)
        except Exception as e:
            print(f"Error in total_patients: {e}")
            details_df = pd.DataFrame([{'Error': str(e)}])

    elif metric == 'adherence_rate':
        try:
            now = pd.Timestamp.now()
            patient_adherence = []
            
            for patient_id in pharmacy_df['patient_identifier'].unique():
                patient_data = pharmacy_df[pharmacy_df['patient_identifier'] == patient_id]
                
                completed = (patient_data['status'] == 'completed').sum()
                # Convert to datetime and compare
                reminder_times = pd.to_datetime(patient_data['next_reminder_time'], errors='coerce')
                missed = ((reminder_times < now) & (patient_data['status'] != 'completed')).sum()
                total_due = completed + missed
                adherence_rate = (completed / total_due * 100) if total_due > 0 else 0
                
                # Categorize adherence
                if adherence_rate > 80:
                    category = "High (>80%)"
                elif adherence_rate >= 60:
                    category = "Medium (60-80%)"
                else:
                    category = "Low (<60%)"
                
                patient_adherence.append({
                    'Patient Name': patient_id,
                    'Completed': completed,
                    'Missed': missed,
                    'Adherence Rate (%)': round(adherence_rate, 1),
                    'Category': category
                })
            
            details_df = pd.DataFrame(patient_adherence).sort_values('Adherence Rate (%)', ascending=False)
        except Exception as e:
            print(f"Error in adherence_rate: {e}")
            details_df = pd.DataFrame([{'Error': str(e)}])

    elif metric == 'reminders_sent':
        try:
            patient_reminders = []
            
            for patient_id in pharmacy_df['patient_identifier'].unique():
                patient_data = pharmacy_df[pharmacy_df['patient_identifier'] == patient_id]
                
                total_reminders = len(patient_data)
                latest_status = patient_data.iloc[-1]['status'] if len(patient_data) > 0 else 'N/A'
                frequency = patient_data.iloc[0]['frequency'] if len(patient_data) > 0 else 'N/A'
                last_reminder = pd.to_datetime(patient_data['time_stamp']).max().strftime('%Y-%m-%d %H:%M') if len(patient_data) > 0 else 'N/A'
                
                patient_reminders.append({
                    'Patient Name': patient_id,
                    'Total Reminders': total_reminders,
                    'Latest Status': latest_status,
                    'Frequency': frequency,
                    'Last Reminder': last_reminder
                })
            
            details_df = pd.DataFrame(patient_reminders).sort_values('Total Reminders', ascending=False)
        except Exception as e:
            print(f"Error in reminders_sent: {e}")
            details_df = pd.DataFrame([{'Error': str(e)}])

    elif metric.startswith('medication_'):
        try:
            medication_name = metric.replace('medication_', '')
            med_patients = pharmacy_df[pharmacy_df['medication_name'] == medication_name]
            
            patient_med_details = []
            for patient_id in med_patients['patient_identifier'].unique():
                patient_data = med_patients[med_patients['patient_identifier'] == patient_id]
                
                completed = (patient_data['status'] == 'completed').sum()
                total = len(patient_data)
                adherence_rate = (completed / total * 100) if total > 0 else 0
                
                patient_med_details.append({
                    'Patient Name': patient_id,
                    'Dosage': patient_data.iloc[0]['dosage'],
                    'Frequency': patient_data.iloc[0]['frequency'],
                    'Adherence Rate (%)': round(adherence_rate, 1),
                    'Current Status': patient_data.iloc[-1]['status']
                })
            
            details_df = pd.DataFrame(patient_med_details).sort_values('Adherence Rate (%)', ascending=False)
        except Exception as e:
            print(f"Error in medication details: {e}")
            details_df = pd.DataFrame([{'Error': str(e)}])

    elif metric.startswith('status_'):
        try:
            status_name = metric.replace('status_', '').lower()
            status_patients = pharmacy_df[pharmacy_df['status'] == status_name]
            
            status_details = []
            for _, row in status_patients.iterrows():
                # Calculate days in status
                reminder_time = pd.to_datetime(row['next_reminder_time'], errors='coerce')
                now = pd.Timestamp.now()
                days_in_status = (now - reminder_time).days if pd.notna(reminder_time) else 0
                
                status_details.append({
                    'Patient Name': row['patient_identifier'],
                    'Medication': row['medication_name'],
                    'Due Time': reminder_time.strftime('%Y-%m-%d %H:%M') if pd.notna(reminder_time) else 'N/A',
                    'Days in Status': max(0, days_in_status),
                    'Phone Number': row['phone_number']
                })
            
            details_df = pd.DataFrame(status_details).sort_values('Days in Status', ascending=False)
        except Exception as e:
            print(f"Error in status details: {e}")
            details_df = pd.DataFrame([{'Error': str(e)}])

    elif metric.startswith('time_'):
        try:
            time_slot = metric.replace('time_', '')
            
            # Create time category from reminderTime
            def categorize_time(time_str):
                try:
                    hour = int(time_str.split(':')[0])
                    if hour < 12: return 'Morning'
                    elif 12 <= hour < 17: return 'Afternoon'
                    else: return 'Evening'
                except:
                    return 'Unknown'
            
            pharmacy_df['temp_time_category'] = pharmacy_df['reminderTime'].apply(categorize_time)
            time_patients = pharmacy_df[pharmacy_df['temp_time_category'] == time_slot]
            
            time_details = []
            for patient_id in time_patients['patient_identifier'].unique():
                patient_data = time_patients[time_patients['patient_identifier'] == patient_id]
                
                # Calculate adherence for this time slot
                completed = (patient_data['status'] == 'completed').sum()
                total = len(patient_data)
                adherence_rate = (completed / total * 100) if total > 0 else 0
                
                time_details.append({
                    'Patient Name': patient_id,
                    'Medication': patient_data.iloc[0]['medication_name'],
                    'Exact Time': patient_data.iloc[0]['reminderTime'],
                    'Adherence Rate (%)': round(adherence_rate, 1),
                    'Total Reminders': total
                })
            
            details_df = pd.DataFrame(time_details).sort_values('Adherence Rate (%)', ascending=False)
        except Exception as e:
            print(f"Error in time details: {e}")
            details_df = pd.DataFrame([{'Error': str(e)}])

    elif metric.startswith('completion_'):
        try:
            completion_type = metric.replace('completion_', '')
            now = pd.Timestamp.now()
            
            if completion_type.lower() == 'upcoming':
                # Show pending/upcoming reminders
                upcoming_data = pharmacy_df[pharmacy_df['status'].isin(['pending', 'upcoming'])]
                
                completion_details = []
                for _, row in upcoming_data.iterrows():
                    due_time = pd.to_datetime(row['next_reminder_time'], errors='coerce')
                    days_until = (due_time - now).days if pd.notna(due_time) else 0
                    
                    completion_details.append({
                        'Patient Name': row['patient_identifier'],
                        'Medication': row['medication_name'],
                        'Due Time': due_time.strftime('%Y-%m-%d %H:%M') if pd.notna(due_time) else 'N/A',
                        'Days Until Due': max(0, days_until),
                        'Frequency': row['frequency']
                    })
                
                details_df = pd.DataFrame(completion_details).sort_values('Days Until Due')
                
            elif completion_type.lower() == 'completed':
                # Show completed reminders
                completed_data = pharmacy_df[pharmacy_df['status'] == 'completed']
                
                completion_details = []
                for _, row in completed_data.iterrows():
                    completion_time = pd.to_datetime(row['time_stamp'], errors='coerce')
                    
                    completion_details.append({
                        'Patient Name': row['patient_identifier'],
                        'Medication': row['medication_name'],
                        'Completion Time': completion_time.strftime('%Y-%m-%d %H:%M') if pd.notna(completion_time) else 'N/A',
                        'Frequency': row['frequency'],
                        'Phone Number': row['phone_number']
                    })
                
                details_df = pd.DataFrame(completion_details).sort_values('Completion Time', ascending=False)
                
        except Exception as e:
            print(f"Error in completion details: {e}")
            details_df = pd.DataFrame([{'Error': str(e)}])

    # Future metrics can be added here
    # elif metric == 'total_patients':
    #     ...

    return jsonify(details_df.to_dict('records'))

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('home'))

# --- Socket.IO Handlers ---
@socketio.on('connect')
def on_connect(auth=None):
    if 'phone_no' in session:
        phone_no = session.get('phone_no')
        socketio.join_room(phone_no)
        print(f"Client connected and joined room: {phone_no}")
        global thread
        if not thread.is_alive():
            print("Starting background thread...")
            thread = socketio.start_background_task(poll_google_sheet)

@socketio.on('disconnect')
def on_disconnect():
    if 'phone_no' in session:
        phone_no = session.get('phone_no')
        socketio.leave_room(phone_no)
        print(f"Client disconnected and left room: {phone_no}")

@socketio.on('apply_filters')
def handle_filters(data):
    """Handle real-time filter updates via Socket.IO."""
    if 'phone_no' not in session:
        return
    
    phone_no = session.get('phone_no')
    filters = data.get('filters', {})
    
    df = get_google_sheet_data(REMINDER_TAB)
    dashboard_data = get_dashboard_data(phone_no, df, filters)
    
    emit('filtered_data', {'data': json.dumps(dashboard_data, default=str)})

if __name__ == '__main__':
    print("Starting PharmOpera Admin server...")
    socketio.run(app, host='0.0.0.0', port=int(os.environ.get('PORT', 5000)), debug=False, allow_unsafe_werkzeug=True)

# Export for Vercel
handler = app