import axios from 'axios';

// Dynamic base URL: reads from localStorage (set by Settings page)
// Defaults to localhost if not configured
const getBaseUrl = () => {
    const storedUrl = localStorage.getItem('api_url');
    return storedUrl || 'http://localhost:5001';
};

export const api = {
    // Check backend health
    checkHealth: async () => {
        try {
            const res = await axios.get(`${getBaseUrl()}/health`);
            return res.data;
        } catch (error) {
            console.error('Health check failed', error);
            throw error;
        }
    },

    // Upload PDF
    uploadFile: async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        const res = await axios.post(`${getBaseUrl()}/api/upload`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return res.data;
    },

    // Auth
    login: async (username, password) => {
        const res = await axios.post(`${getBaseUrl()}/api/auth/login`, {
            username,
            password
        });
        return res.data;
    },

    // Scan Barcode - now returns print_count and last_print info
    scanBarcode: async (barcode) => {
        const res = await axios.get(`${getBaseUrl()}/api/scan/${encodeURIComponent(barcode)}`);
        return res.data;
    },

    // Print Label
    printLabel: async (fileId, pageNum, printerName = null, labelSettings = {}, username = 'Unknown') => {
        const res = await axios.post(`${getBaseUrl()}/api/print`, {
            file_id: fileId,
            page_num: pageNum,
            printer_name: printerName,
            label_settings: labelSettings,
            username: username
        });
        return res.data;
    },

    // Download Report
    downloadReport: () => {
        window.open(`${getBaseUrl()}/api/reports/download`, '_blank');
    },

    // Dashboard APIs
    getDocuments: async () => {
        const res = await axios.get(`${getBaseUrl()}/api/documents`);
        return res.data;
    },

    getDocumentDetails: async (fileId) => {
        const res = await axios.get(`${getBaseUrl()}/api/documents/${fileId}`);
        return res.data;
    },

    deleteDocument: async (fileId) => {
        const res = await axios.delete(`${getBaseUrl()}/api/documents/${fileId}`);
        return res.data;
    },

    getPrintHistory: async () => {
        const res = await axios.get(`${getBaseUrl()}/api/history`);
        return res.data;
    },

    // Get Dashboard Stats
    getStats: async () => {
        const res = await axios.get(`${getBaseUrl()}/api/stats`);
        return res.data;
    },

    // Get Document Print Stats
    getDocumentPrintStats: async (fileId) => {
        const res = await axios.get(`${getBaseUrl()}/api/documents/${fileId}/print-stats`);
        return res.data;
    },

    // Get available printers
    getPrinters: async () => {
        const res = await axios.get(`${getBaseUrl()}/api/printers`);
        return res.data;
    },

    // User management
    getUsers: async () => {
        const res = await axios.get(`${getBaseUrl()}/api/users`);
        return res.data;
    },

    addUser: async (username, password, role) => {
        const res = await axios.post(`${getBaseUrl()}/api/users`, {
            username,
            password,
            role
        });
        return res.data;
    },

    deleteUser: async (username) => {
        const res = await axios.delete(`${getBaseUrl()}/api/users/${encodeURIComponent(username)}`);
        return res.data;
    },

    resetUserPassword: async (username, newPassword) => {
        const res = await axios.put(`${getBaseUrl()}/api/users/${encodeURIComponent(username)}/password`, {
            new_password: newPassword
        });
        return res.data;
    },

    changeUserPassword: async (username, currentPassword, newPassword) => {
        const res = await axios.put(`${getBaseUrl()}/api/users/${encodeURIComponent(username)}/change-password`, {
            current_password: currentPassword,
            new_password: newPassword
        });
        return res.data;
    },

    // Get Preview URL
    getPreviewUrl: (fileId, pageNum) => {
        return `${getBaseUrl()}/api/preview/${fileId}/${pageNum}`;
    }
};

