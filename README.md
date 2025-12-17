# Brady Print Station (Cloudflare + Local Bridge)

A modern scanning and printing application decoupled into a **Cloudflare Hosted Frontend** and a **Local Print Bridge**.

## Architecture
1.  **Frontend (Cloud)**: React + Vite app hosted on Cloudflare Pages.
2.  **Backend (Local)**: Python Flask app running on the user's machine to handle printers.

## 🚀 Deployment (Cloudflare Pages)

This repository includes a GitHub Action to automatically deploy the frontend to Cloudflare Pages.

### Prerequisites
1.  **Cloudflare Account**: Create an account at [dash.cloudflare.com](https://dash.cloudflare.com).
2.  **GitHub Secrets**: Go to your repo **Settings > Secrets and variables > Actions > New repository secret** and add:
    *   `CLOUDFLARE_ACCOUNT_ID`:
        *   Log in to Cloudflare Dashboard.
        *   Click **Workers & Pages** in the sidebar.
        *   Copy **Account ID** from the "Account details" panel on the right.
    *   **Create the Project**:
        1.  Click **Workers & Pages** > **Create Application** > **Pages**.
        2.  Click **"Get started"** under **"Drag and drop your files"**.
        3.  Name the project: `brady-print-station`.
        4.  Click **Create project**. (You can skip the actual file upload, the GitHub Action will do it).
    *   `CLOUDFLARE_API_TOKEN`:
        *   Go to [User Profile > API Tokens](https://dash.cloudflare.com/profile/api-tokens).
        *   Create Token > Use template "Edit Cloudflare Workers" (works for Pages).
        *   Or Custom Token: Permissions `Account` > `Cloudflare Pages` > `Edit`.

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
