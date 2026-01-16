from gevent import monkey
monkey.patch_all()

import pandas as pd
import gspread
from google.oauth2.service_account import Credentials
from flask import Flask, render_template, request, redirect, session, url_for
from flask_socketio import SocketIO
import json
from threading import Thread, Event
import numpy as np

app = Flask(__name__)
app.secret_key = 'ee3e0441e14feb14cfb6290a30bc92e9babc20ffb44c6bea6e7d068eb20f2abb'
socketio = SocketIO(app, async_mode='gevent')

# --- Google Sheets Configuration ---
SERVICE_ACCOUNT_FILE = 'credentials.json'
SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
]
SHEET_NAME = 'patient_reminder'
USERS_TAB = 'pharmacyonboarding'
REMINDER_TAB = 'ReminderData'

# --- Background Thread for Polling ---
thread = Thread()
thread_stop_event = Event()

def get_google_sheet_data(tab_name):
    """Fetches all records from a specific tab in the Google Sheet."""
    try:
        creds = Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE, scopes=SCOPES)
        client = gspread.authorize(creds)
        sheet = client.open(SHEET_NAME).worksheet(tab_name)
        records = sheet.get_all_records()
        return pd.DataFrame(records)
    except Exception as e:
        print(f"Error accessing Google Sheet '{tab_name}': {e}")
        return pd.DataFrame()

def get_dashboard_data(phone_no, df):
    """Processes the DataFrame to generate all data needed for the dashboard."""
    
    df['pharmacy_id'] = df['pharmacy_id'].astype(str)
    pharmacy_df = df[df['pharmacy_id'] == phone_no].copy()

    if pharmacy_df.empty:
        return {}

    # --- Robust Data Cleaning and Preparation ---
    pharmacy_df['status'] = pharmacy_df['status'].astype(str).str.strip().str.lower()
    pharmacy_df['time_stamp'] = pd.to_datetime(pharmacy_df['time_stamp'], errors='coerce')
    pharmacy_df['reminderTimeObj'] = pd.to_datetime(pharmacy_df['reminderTime'], format='%H:%M', errors='coerce').dt.time
    pharmacy_df['next_reminder_time'] = pd.to_datetime(pharmacy_df['next_reminder_time'], errors='coerce')
    pharmacy_df['should_check_in'] = pharmacy_df['should_check_in'].fillna('').astype(str).str.lower()
    
    # --- Adherence Calculation ---
    now = pd.Timestamp.now() # Use pandas native, timezone-naive timestamp for comparison
    
    # Define 'missed' status for calculation
    # A reminder is missed if its status is not 'completed' and its next reminder time is in the past.
    missed_mask = (pharmacy_df['status'] != 'completed') & (pharmacy_df['next_reminder_time'] < now)
    
    completed_reminders = (pharmacy_df['status'] == 'completed').sum()
    missed_reminders = missed_mask.sum()
    
    total_relevant_reminders = completed_reminders + missed_reminders
    adherence_rate = (completed_reminders / total_relevant_reminders) * 100 if total_relevant_reminders > 0 else 0

    # --- KPI Cards ---
    total_patients = pharmacy_df['patient_identifier'].nunique()
    status_counts = pharmacy_df['status'].value_counts()
    pending_reminders = status_counts.get('pending', 0) + status_counts.get('upcoming', 0)

    # --- Adherence Trend (Line Chart) ---
    # Note: Using 'time_stamp' for the date axis of the trend.
    adherence_df = pharmacy_df[pharmacy_df['status'].isin(['completed']) | missed_mask].copy()
    adherence_df['date'] = adherence_df['time_stamp'].dt.date
    adherence_by_day = adherence_df.groupby('date')['status'].apply(lambda x: (x == 'completed').sum() / len(x) * 100 if len(x) > 0 else 0).reset_index()
    adherence_by_day = adherence_by_day.sort_values('date')

    # --- Top Medications / Dosages ---
    top_meds = pharmacy_df['medication_name'].value_counts().nlargest(5)
    dosage_dist = pharmacy_df['dosage'].value_counts().nlargest(5)

    # --- Reminders by Time of Day ---
    def categorize_time(t):
        if pd.notnull(t):
            if t.hour < 12: return 'Morning'
            if 12 <= t.hour < 17: return 'Afternoon'
            return 'Evening'
        return 'Unknown'
    pharmacy_df['time_category'] = pharmacy_df['reminderTimeObj'].apply(categorize_time)
    reminders_by_time = pharmacy_df['time_category'].value_counts()
    
    # --- Upcoming vs Completed ---
    upcoming_vs_completed = status_counts

    # --- Patients Needing Check-In (Table) ---
    check_in_patients = pharmacy_df[pharmacy_df['should_check_in'] == 'yes']
    check_in_table = check_in_patients[['patient_identifier', 'medication_name', 'status', 'check_in_message']].to_dict('records')

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
            "data": [int(upcoming_vs_completed.get('pending', 0) + upcoming_vs_completed.get('upcoming', 0)), int(upcoming_vs_completed.get('completed', 0))]
        },
        "check_in_table": check_in_table
    }
    return dashboard_data


def poll_google_sheet():
    """Background thread to poll Google Sheet for changes and push updates."""
    last_data_hash = None
    while not thread_stop_event.isSet():
        df = get_google_sheet_data(REMINDER_TAB)
        if not df.empty:
            current_data_hash = pd.util.hash_pandas_object(df, index=True).sum()
            if last_data_hash is None or current_data_hash != last_data_hash:
                last_data_hash = current_data_hash
                
                all_pharmacy_ids = df['pharmacy_id'].astype(str).unique()
                for phone_no in all_pharmacy_ids:
                    dashboard_data = get_dashboard_data(phone_no, df)
                    if dashboard_data:
                         socketio.emit('update_data', {'data': json.dumps(dashboard_data, default=str)}, room=phone_no)
        socketio.sleep(10)

# --- Flask Routes ---
@app.route('/', methods=['GET'])
def home():
    if 'phone_no' in session:
        return redirect(url_for('dashboard'))
    return render_template('login.html')

@app.route('/login', methods=['POST'])
def login():
    phone_no = request.form['phone_no']
    unique_code = request.form['unique_code']
    
    users_df = get_google_sheet_data(USERS_TAB)
    if users_df.empty:
        return render_template('login.html', error="Could not verify users at this time.")

    users_df['phone_no'] = users_df['phone_no'].astype(str)
    users_df['unique_code'] = users_df['unique_code'].astype(str)

    matches = users_df[(users_df['phone_no'] == phone_no) & (users_df['unique_code'] == unique_code)]
    
    if not matches.empty:
        session['phone_no'] = phone_no
        return redirect(url_for('dashboard'))
        
    return render_template('login.html', error="Invalid credentials. Please try again.")

@app.route('/dashboard', methods=['GET'])
def dashboard():
    if 'phone_no' not in session:
        return redirect(url_for('home'))
        
    phone_no = session.get('phone_no')
    df = get_google_sheet_data(REMINDER_TAB)
    dashboard_data = get_dashboard_data(phone_no, df)

    return render_template('dashboard.html', phone_no=phone_no, dashboard_data=json.dumps(dashboard_data, default=str))

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('home'))

# --- Socket.IO Handlers ---
@socketio.on('connect')
def on_connect():
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

if __name__ == '__main__':
    print("Starting PharmOpera Admin server...")
    socketio.run(app, debug=True)