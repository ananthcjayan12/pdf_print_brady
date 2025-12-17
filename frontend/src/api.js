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

    // Scan Barcode
    scanBarcode: async (barcode) => {
        const res = await axios.get(`${getBaseUrl()}/api/scan/${encodeURIComponent(barcode)}`);
        return res.data;
    },

    // Print Label
    printLabel: async (fileId, pageNum, printerName = null, labelSettings = {}) => {
        const res = await axios.post(`${getBaseUrl()}/api/print`, {
            file_id: fileId,
            page_num: pageNum,
            printer_name: printerName,
            label_settings: labelSettings
        });
        return res.data;
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

    // Get Preview URL
    getPreviewUrl: (fileId, pageNum) => {
        return `${getBaseUrl()}/api/preview/${fileId}/${pageNum}`;
    }
};
