import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

import pandas as pd
import gspread
from google.oauth2.service_account import Credentials
from flask import Flask, render_template, request, redirect, session, url_for, jsonify
import json
import numpy as np
from datetime import timedelta

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'ee3e0441e14feb14cfb6290a30bc92e9babc20ffb44c6bea6e7d068eb20f2abb')

# --- Configuration ---
SERVICE_ACCOUNT_FILE = 'credentials.json'
SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
]
SHEET_NAME = os.environ.get('SHEET_NAME', 'patient_reminder')
USERS_TAB = os.environ.get('USERS_TAB', 'pharmacyonboarding')
REMINDER_TAB = os.environ.get('REMINDER_TAB', 'ReminderData')

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

# Import the rest of your functions here (apply_filters, get_dashboard_data, etc.)
# ... (copy from your original app.py)

@app.route('/')
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

@app.route('/dashboard')
def dashboard():
    if 'phone_no' not in session:
        return redirect(url_for('home'))
        
    phone_no = session.get('phone_no')
    # Simplified dashboard without real-time features
    return render_template('dashboard_simple.html', phone_no=phone_no, pharm_name=session.get('pharm_name', phone_no))

# Export for Vercel
handler = app
