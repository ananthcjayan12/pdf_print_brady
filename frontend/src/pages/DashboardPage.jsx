import { useState, useEffect } from 'react';
import { Trash2, FileText, Calendar, Barcode, Printer, Clock, CheckCircle, XCircle } from 'lucide-react';
import { api } from '../api';

function DashboardPage() {
    const [activeTab, setActiveTab] = useState('documents'); // 'documents' or 'history'
    const [documents, setDocuments] = useState([]);
    const [history, setHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedDoc, setSelectedDoc] = useState(null);

    useEffect(() => {
        loadData();
    }, [activeTab]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            if (activeTab === 'documents') {
                const data = await api.getDocuments();
                if (data.success) setDocuments(data.documents);
            } else {
                const data = await api.getPrintHistory();
                if (data.success) setHistory(data.history);
            }
        } catch (error) {
            console.error('Failed to load data', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this document?')) {
            try {
                await api.deleteDocument(id);
                loadData();
                if (selectedDoc?.document.id === id) setSelectedDoc(null);
            } catch (error) {
                alert('Failed to delete');
            }
        }
    };

    const handleRowClick = async (docId) => {
        try {
            const data = await api.getDocumentDetails(docId);
            if (data.success) setSelectedDoc(data.details);
        } catch (error) {
            console.error("Failed to load details", error);
        }
    };

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header Section */}
            <div className="flex justify-between items-center" style={{ marginBottom: '32px' }}>
                <div>
                    <h1>Dashboard</h1>
                    <p>Manage your documents and view print history.</p>
                </div>

                {/* Stripe-style Segmented Control / Tabs */}
                <div style={{
                    background: 'rgba(0,0,0,0.04)',
                    padding: '4px',
                    borderRadius: '8px',
                    display: 'inline-flex'
                }}>
                    <button
                        onClick={() => setActiveTab('documents')}
                        style={{
                            padding: '6px 16px',
                            background: activeTab === 'documents' ? 'white' : 'transparent',
                            borderRadius: '6px',
                            boxShadow: activeTab === 'documents' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                            border: 'none',
                            fontWeight: 500,
                            color: activeTab === 'documents' ? 'var(--text-main)' : 'var(--text-secondary)',
                            fontSize: '13px',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        Documents
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        style={{
                            padding: '6px 16px',
                            background: activeTab === 'history' ? 'white' : 'transparent',
                            borderRadius: '6px',
                            boxShadow: activeTab === 'history' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                            border: 'none',
                            fontWeight: 500,
                            color: activeTab === 'history' ? 'var(--text-main)' : 'var(--text-secondary)',
                            fontSize: '13px',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        Print History
                    </button>
                </div>
            </div>

            <div className="grid" style={{ gridTemplateColumns: selectedDoc ? '1fr 380px' : '1fr', transition: 'grid-template-columns 0.3s ease' }}>

                {/* Main Content Card */}
                <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                    {isLoading ? (
                        <div className="text-center" style={{ padding: '60px' }}>
                            <div className="spinner"></div> {/* Add spinner CSS later or just text */}
                            <p>Loading data...</p>
                        </div>
                    ) : (
                        <table style={{ margin: 0 }}>
                            <thead style={{ background: '#fcfcfd', borderBottom: '1px solid var(--divide)' }}>
                                {activeTab === 'documents' ? (
                                    <tr>
                                        <th style={{ paddingLeft: '24px' }}>Name</th>
                                        <th>Date Uploaded</th>
                                        <th className="text-center">Pages</th>
                                        <th>Status</th>
                                        <th style={{ paddingRight: '24px', textAlign: 'right' }}>Actions</th>
                                    </tr>
                                ) : (
                                    <tr>
                                        <th style={{ paddingLeft: '24px' }}>Status</th>
                                        <th>Document</th>
                                        <th>Printer Details</th>
                                        <th style={{ paddingRight: '24px' }}>Time</th>
                                    </tr>
                                )}
                            </thead>
                            <tbody>
                                {activeTab === 'documents' ? (
                                    documents.map(doc => (
                                        <tr
                                            key={doc.id}
                                            onClick={() => handleRowClick(doc.id)}
                                            style={{
                                                cursor: 'pointer',
                                                background: selectedDoc?.document.id === doc.id ? 'rgba(99,91,255,0.03)' : 'transparent',
                                                borderLeft: selectedDoc?.document.id === doc.id ? '3px solid var(--primary)' : '3px solid transparent'
                                            }}
                                        >
                                            <td style={{ paddingLeft: '21px' }}> {/* Compensate for border */}
                                                <div className="flex items-center">
                                                    <div style={{
                                                        background: 'rgba(99,91,255,0.1)',
                                                        padding: '8px',
                                                        borderRadius: '6px',
                                                        marginRight: '12px'
                                                    }}>
                                                        <FileText size={18} color="var(--primary)" />
                                                    </div>
                                                    <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>{doc.name}</span>
                                                </div>
                                            </td>
                                            <td className="text-muted" style={{ fontSize: '13px' }}>
                                                {new Date(doc.uploaded_at).toLocaleDateString()}
                                            </td>
                                            <td className="text-center" style={{ fontFamily: 'monospaced' }}>{doc.pages}</td>
                                            <td>
                                                <span className="status-badge" style={{ background: '#e3f2fd', color: '#0d47a1' }}>
                                                    {doc.barcodes_found} Barcodes
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right', paddingRight: '24px' }}>
                                                <button
                                                    className="btn"
                                                    style={{
                                                        color: 'var(--text-secondary)',
                                                        padding: '6px',
                                                        height: 'auto',
                                                        background: 'transparent',
                                                        boxShadow: 'none'
                                                    }}
                                                    onClick={(e) => handleDelete(e, doc.id)}
                                                    title="Delete"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    history.map(job => (
                                        <tr key={job.id}>
                                            <td style={{ paddingLeft: '24px' }}>
                                                {job.status === 'success' ? (
                                                    <span className="status-badge status-success">
                                                        <CheckCircle size={12} style={{ marginRight: '4px' }} /> Succeeded
                                                    </span>
                                                ) : (
                                                    <span className="status-badge status-error">
                                                        <XCircle size={12} style={{ marginRight: '4px' }} /> Failed
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 500 }}>{job.doc_name}</div>
                                                <div className="text-muted" style={{ fontSize: '12px' }}>Page {job.page_num}</div>
                                            </td>
                                            <td>
                                                <div className="flex items-center text-muted" style={{ fontSize: '13px' }}>
                                                    <Printer size={12} />
                                                    <span>{job.printer}</span>
                                                </div>
                                                {job.error && (
                                                    <div style={{ color: 'var(--error)', fontSize: '11px', marginTop: '4px' }}>
                                                        {job.error}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="text-muted" style={{ fontSize: '13px', paddingRight: '24px' }}>
                                                {new Date(job.timestamp).toLocaleString(undefined, {
                                                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                                })}
                                            </td>
                                        </tr>
                                    ))
                                )}
                                {((activeTab === 'documents' && documents.length === 0) || (activeTab === 'history' && history.length === 0)) && (
                                    <tr>
                                        <td colSpan="5" className="text-center" style={{ padding: '60px' }}>
                                            <div style={{ color: 'var(--text-secondary)' }}>No items found.</div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Right Column: Details Drawer */}
                {activeTab === 'documents' && selectedDoc && (
                    <div className="card animate-in" style={{ height: 'calc(100vh - 140px)', position: 'sticky', top: '20px', display: 'flex', flexDirection: 'column' }}>
                        <div className="flex justify-between items-start" style={{ marginBottom: '20px', borderBottom: '1px solid var(--divider)', paddingBottom: '20px' }}>
                            <div>
                                <h3 style={{ fontSize: '15px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Document Details</h3>
                                <div style={{ fontWeight: 600, fontSize: '16px' }}>{selectedDoc.document.name}</div>
                            </div>
                            <button
                                className="btn"
                                onClick={() => setSelectedDoc(null)}
                                style={{ padding: '4px', background: 'transparent', boxShadow: 'none' }}
                            >
                                <XCircle size={20} color="var(--text-secondary)" />
                            </button>
                        </div>

                        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '8px' }}>
                            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Calendar size={14} color="var(--text-secondary)" />
                                <span className="text-muted" style={{ fontSize: '13px' }}>
                                    Uploaded on {new Date(selectedDoc.document.uploaded_at).toLocaleDateString()}
                                </span>
                            </div>

                            <h4 style={{ fontSize: '13px', margin: '24px 0 12px', color: 'var(--text-secondary)' }}>DETECTED BARCODES</h4>

                            {selectedDoc.mappings.length === 0 ? (
                                <div className="text-center text-muted" style={{ padding: '20px', background: '#f9fafb', borderRadius: '8px' }}>
                                    No barcodes found.
                                </div>
                            ) : (
                                <div className="flex-col" style={{ gap: '12px' }}>
                                    {selectedDoc.mappings.map((mapping, idx) => (
                                        <div key={idx} style={{
                                            padding: '12px',
                                            border: '1px solid var(--border)',
                                            borderRadius: '8px',
                                            background: 'white',
                                            transition: 'border-color 0.2s'
                                        }} className="hover:border-primary">
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-start" style={{ gap: '10px' }}>
                                                    <Barcode size={18} color="var(--primary)" style={{ marginTop: '2px' }} />
                                                    <div>
                                                        <div style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '13px', color: 'var(--text-main)' }}>
                                                            {mapping.barcode}
                                                        </div>
                                                        <div className="text-muted" style={{ fontSize: '12px', marginTop: '2px' }}>
                                                            {mapping.type}
                                                        </div>
                                                    </div>
                                                </div>
                                                <span style={{ fontSize: '11px', fontWeight: 600, background: '#e0e0e0', padding: '2px 6px', borderRadius: '4px' }}>
                                                    PG {mapping.page_num}
                                                </span>
                                            </div>

                                            <div style={{ marginTop: '12px' }}>
                                                <a
                                                    href={api.getPreviewUrl(selectedDoc.document.id, mapping.page_num)}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="btn btn-secondary"
                                                    style={{ width: '100%', height: '32px', fontSize: '13px' }}
                                                >
                                                    View Label
                                                </a>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default DashboardPage;
