import os
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from app import get_dashboard_data, get_google_sheet_data, REMINDER_TAB

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)

@app.route('/mcp/get_dashboard_data', methods=['POST'])
def mcp_get_dashboard_data():
    """
    MCP endpoint to get dashboard data.
    """
    data = request.get_json()
    phone_no = data.get('phone_no')
    filters = data.get('filters')

    if not phone_no:
        return jsonify({'error': 'phone_no is required'}), 400

    df = get_google_sheet_data(REMINDER_TAB)
    dashboard_data = get_dashboard_data(phone_no, df, filters)

    return jsonify(dashboard_data)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5001)), debug=False)
