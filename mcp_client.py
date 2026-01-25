import requests
import json

class MCPClient:
    def __init__(self, host='localhost', port=5001):
        self.base_url = f"http://{host}:{port}"

    def get_dashboard_data(self, phone_no, filters=None):
        """
        Calls the get_dashboard_data endpoint on the MCP server.

        :param phone_no: The phone number of the pharmacy.
        :param filters: A dictionary of filters to apply to the data.
        :return: A dictionary containing the dashboard data.
        """
        url = f"{self.base_url}/mcp/get_dashboard_data"
        payload = {
            'phone_no': phone_no,
            'filters': filters
        }
        headers = {'Content-Type': 'application/json'}

        try:
            response = requests.post(url, data=json.dumps(payload), headers=headers)
            response.raise_for_status()  # Raise an exception for bad status codes
            return response
        except requests.exceptions.RequestException as e:
            print(f"An error occurred: {e}")
            return None
