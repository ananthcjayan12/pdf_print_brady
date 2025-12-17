# Brady Print Station (Cloudflare + Local Bridge)

A modern scanning and printing application decoupled into a **Cloudflare Hosted Frontend** and a **Local Print Bridge**.

## Architecture
1.  **Frontend (Cloud)**: React + Vite app hosted on Cloudflare Pages.
2.  **Backend (Local)**: Python Flask app running on the user's machine to handle printers.

## 🚀 Deployment (Cloudflare Pages)

This repository includes a GitHub Action to automatically deploy the frontend to Cloudflare Pages.

### Prerequisites
1.  **Cloudflare Account**: Create an account at [dash.cloudflare.com](https://dash.cloudflare.com).
2.  **Pages Project**: Create a new Pages project or let the action create one.
3.  **GitHub Secrets**: Add the following secrets to your GitHub Repository (**Settings > Secrets and variables > Actions**):
    *   `CLOUDFLARE_ACCOUNT_ID`: Find this on the right side of your Cloudflare Dashboard.
    *   `CLOUDFLARE_API_TOKEN`: Create a token with **Cloudflare Pages: Edit** permissions.

### Automatic Deployment
Push to `main` or `master` to trigger the build and deployment. The action builds the `frontend` directory and uploads the `dist` folder.

---

## 💻 Local Developer Setup

### 1. Start Local Bridge (Backend)
The backend must run locally to access your USB/Network printers.
```bash
cd print-server
./run_server.sh   # Mac/Linux
# OR
python app.py     # Windows
```
*   Runs on: `http://localhost:5001`

### 2. Start Frontend
```bash
cd frontend
npm install
npm run dev
```
*   Runs on: `http://localhost:5173`

### 3. Connect
Open the frontend, go to **Settings**, and enter your Local Bridge URL (default: `http://localhost:5001`).

---

## 🛠 Tech Stack
*   **Frontend**: React, Vite, Lucide Icons, Stripe Design System
*   **Backend**: Flask, PyPDF, ReportLab
*   **Deployment**: Cloudflare Pages (Frontend), Localhost (Backend)
