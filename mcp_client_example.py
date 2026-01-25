import json
from mcp_client import MCPClient

def main():
    """
    Example usage of the MCPClient.
    """
    # Instantiate the MCPClient
    client = MCPClient()

    # Define the phone number and filters
    phone_no = "2348060456301"  # Updated to a more realistic Nigerian phone number example
    filters = {
        "dateRange": "all"  # Example filter: all time
    }

    # Call the get_dashboard_data method
    response = client.get_dashboard_data(phone_no, filters)

    # Print the returned dashboard data
    if response:
        print(f"HTTP Status Code: {response.status_code}")
        print(f"Response Headers: {response.headers}")
        try:
            dashboard_data = response.json()
            print("Dashboard Data (JSON):")
            print(json.dumps(dashboard_data, indent=2))
        except json.JSONDecodeError:
            print("Response Body (Raw Text):")
            print(response.text)
    else:
        print("No response received from MCP server.")

if __name__ == '__main__':
    main()
