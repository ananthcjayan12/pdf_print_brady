import axios from 'axios';

const API_URL = 'http://localhost:5001/api';

export const api = {
    // Check backend health
    checkHealth: async () => {
        try {
            const res = await axios.get('http://localhost:5001/health');
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
        const res = await axios.post(`${API_URL}/upload`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return res.data;
    },

    // Scan Barcode
    scanBarcode: async (barcode) => {
        const res = await axios.get(`${API_URL}/scan/${encodeURIComponent(barcode)}`);
        return res.data;
    },

    // Print Label
    printLabel: async (fileId, pageNum, printerName = null) => {
        const res = await axios.post(`${API_URL}/print`, {
            file_id: fileId,
            page_num: pageNum,
            printer_name: printerName
        });
        return res.data;
    },

    // Dashboard APIs
    getDocuments: async () => {
        const res = await axios.get(`${API_URL}/documents`);
        return res.data;
    },

    getDocumentDetails: async (fileId) => {
        const res = await axios.get(`${API_URL}/documents/${fileId}`);
        return res.data;
    },

    deleteDocument: async (fileId) => {
        const res = await axios.delete(`${API_URL}/documents/${fileId}`);
        return res.data;
    },

    getPrintHistory: async () => {
        const res = await axios.get(`${API_URL}/history`);
        return res.data;
    },

    // Get Preview URL
    getPreviewUrl: (fileId, pageNum) => {
        return `${API_URL}/preview/${fileId}/${pageNum}`;
    }
};
