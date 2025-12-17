# Brady Local Print Bridge

This is the local companion app for the Brady Print Station cloud application. It allows the web app to communicate with your physical printer and local files.

## Installation

1.  **Install Python**: Ensure you have Python 3.8+ installed.
2.  **Run the Server**:
    *   **Mac/Linux**: Open Terminal, navigate to this folder, and run `./run_server.sh`
    *   **Windows**: Open PowerShell, navigate to this folder, and run `python app.py` (ensure you install requirements first: `pip install -r requirements_server.txt`)

## How it Works

*   This server runs on `http://localhost:5001`.
*   The cloud app (Scan & Print) sends requests to your local machine to process PDFs and send print commands.
*   Keep this terminal open while using the app.

## Troubleshooting

*   **Printer not found**: Ensure your printer is installed in your OS settings and you know its exact queue name.
*   **Connection failed**: Ensure no firewall is blocking port 5001.
