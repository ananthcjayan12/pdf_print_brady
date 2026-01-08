import { useState, useEffect } from 'react';
import { Trash2, FileText, Calendar, Barcode, Printer, Clock, CheckCircle, XCircle, Files, TrendingUp, AlertCircle, User, Key } from 'lucide-react';
import { api } from '../api';

function DashboardPage() {
    const [activeTab, setActiveTab] = useState('documents'); // 'documents', 'history', or 'credentials'
    const [documents, setDocuments] = useState([]);
    const [history, setHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedDoc, setSelectedDoc] = useState(null);
    const [stats, setStats] = useState(null);
    const [credentials, setCredentials] = useState({
        username: '',
        password: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [credentialsSaved, setCredentialsSaved] = useState(false);

    useEffect(() => {
        loadStats();
        loadCredentials();
    }, []);

    useEffect(() => {
        loadData();
    }, [activeTab]);

    const loadStats = async () => {
        try {
            const data = await api.getStats();
            if (data.success) setStats(data.stats);
        } catch (error) {
            console.error('Failed to load stats', error);
        }
    };

    const loadCredentials = () => {
        const saved = localStorage.getItem('user_credentials');
        if (saved) {
            try {
                setCredentials(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to load credentials', e);
            }
        }
    };

    const saveCredentials = () => {
        localStorage.setItem('user_credentials', JSON.stringify(credentials));
        setCredentialsSaved(true);
        setTimeout(() => setCredentialsSaved(false), 2000);
    };

    const loadData = async () => {
        setIsLoading(true);
        try {
            if (activeTab === 'documents') {
                const data = await api.getDocuments();
                if (data.success) setDocuments(data.documents);
            } else if (activeTab === 'history') {
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
                loadStats();
                if (selectedDoc?.document.id === id) setSelectedDoc(null);
            } catch (error) {
                alert('Failed to delete');
            }
        }
    };

    const handleRowClick = async (docId) => {
        try {
            const data = await api.getDocumentPrintStats(docId);
            if (data.success) setSelectedDoc(data.stats);
        } catch (error) {
            console.error("Failed to load details", error);
        }
    };

    // Calculate pending prints for each document
    const getDocPendingCount = (docId) => {
        // We'll show this from the selected document stats
        return null;
    };

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            {/* Stats Cards Section */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '16px',
                marginBottom: '32px'
            }}>
                <div className="card" style={{
                    padding: '20px',
                    background: 'linear-gradient(135deg, #635bff 0%, #8b7aff 100%)',
                    color: 'white',
                    border: 'none'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <Files size={22} strokeWidth={1.5} />
                        <span style={{ fontSize: '11px', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total PDFs</span>
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 700 }}>{stats?.total_documents ?? '-'}</div>
                    <div style={{ fontSize: '12px', opacity: 0.85, marginTop: '4px' }}>
                        {stats?.total_pages ?? 0} pages total
                    </div>
                </div>

                <div className="card" style={{
                    padding: '20px',
                    background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
                    color: 'white',
                    border: 'none'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <CheckCircle size={22} strokeWidth={1.5} />
                        <span style={{ fontSize: '11px', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Prints Done</span>
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 700 }}>{stats?.total_prints ?? '-'}</div>
                    <div style={{ fontSize: '12px', opacity: 0.85, marginTop: '4px' }}>
                        {stats?.total_barcodes ?? 0} barcodes found
                    </div>
                </div>

                <div className="card" style={{
                    padding: '20px',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
                    color: 'white',
                    border: 'none'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <Clock size={22} strokeWidth={1.5} />
                        <span style={{ fontSize: '11px', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pending</span>
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 700 }}>{stats?.pending_prints ?? '-'}</div>
                    <div style={{ fontSize: '12px', opacity: 0.85, marginTop: '4px' }}>
                        awaiting print
                    </div>
                </div>

                <div className="card" style={{
                    padding: '20px',
                    background: stats?.failed_prints > 0
                        ? 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)'
                        : 'linear-gradient(135deg, #64748b 0%, #94a3b8 100%)',
                    color: 'white',
                    border: 'none'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <AlertCircle size={22} strokeWidth={1.5} />
                        <span style={{ fontSize: '11px', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Failed</span>
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 700 }}>{stats?.failed_prints ?? 0}</div>
                    <div style={{ fontSize: '12px', opacity: 0.85, marginTop: '4px' }}>
                        print failures
                    </div>
                </div>
            </div>

            {/* Header Section */}
            <div className="flex justify-between items-center" style={{ marginBottom: '32px' }}>
                <div>
                    <h1>Dashboard</h1>
                    <p>Manage your documents, view print history, and configure credentials.</p>
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
                    <button
                        onClick={() => setActiveTab('credentials')}
                        style={{
                            padding: '6px 16px',
                            background: activeTab === 'credentials' ? 'white' : 'transparent',
                            borderRadius: '6px',
                            boxShadow: activeTab === 'credentials' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                            border: 'none',
                            fontWeight: 500,
                            color: activeTab === 'credentials' ? 'var(--text-main)' : 'var(--text-secondary)',
                            fontSize: '13px',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        Credentials
                    </button>
                </div>
            </div>

            {/* Credentials Tab */}
            {activeTab === 'credentials' && (
                <div className="card" style={{ maxWidth: '500px' }}>
                    <div style={{ marginBottom: '24px' }}>
                        <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>User Credentials</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                            Store your credentials locally for quick access. These are saved only in your browser.
                        </p>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                            <User size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: '-2px' }} />
                            Username
                        </label>
                        <input
                            type="text"
                            className="input"
                            value={credentials.username}
                            onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                            placeholder="Enter username"
                            style={{ width: '100%' }}
                        />
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                            <Key size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: '-2px' }} />
                            Password
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                className="input"
                                value={credentials.password}
                                onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                                placeholder="Enter password"
                                style={{ width: '100%', paddingRight: '80px' }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute',
                                    right: '12px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--primary)',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: 500
                                }}
                            >
                                {showPassword ? 'Hide' : 'Show'}
                            </button>
                        </div>
                    </div>

                    <button
                        className="btn btn-primary"
                        onClick={saveCredentials}
                        style={{ width: '100%' }}
                    >
                        {credentialsSaved ? '✓ Saved!' : 'Save Credentials'}
                    </button>

                    <div style={{
                        marginTop: '16px',
                        padding: '12px',
                        background: 'rgba(99, 91, 255, 0.05)',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: 'var(--text-secondary)'
                    }}>
                        <strong>Note:</strong> Credentials are stored locally in your browser and never sent to any server.
                    </div>
                </div>
            )}

            {/* Documents and History Tabs */}
            {activeTab !== 'credentials' && (
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

                            {/* Print Stats Summary */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '12px',
                                marginBottom: '20px'
                            }}>
                                <div style={{
                                    padding: '12px',
                                    background: '#f0fdf4',
                                    borderRadius: '8px',
                                    textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#16a34a' }}>
                                        {selectedDoc.printed_count}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#15803d', textTransform: 'uppercase' }}>
                                        Printed
                                    </div>
                                </div>
                                <div style={{
                                    padding: '12px',
                                    background: '#fef3c7',
                                    borderRadius: '8px',
                                    textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#d97706' }}>
                                        {selectedDoc.pending_count}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#b45309', textTransform: 'uppercase' }}>
                                        Pending
                                    </div>
                                </div>
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
                                        {selectedDoc.mappings.map((mapping, idx) => {
                                            const printCount = selectedDoc.page_print_counts[mapping.page_num] || 0;
                                            const isPrinted = printCount > 0;

                                            return (
                                                <div key={idx} style={{
                                                    padding: '12px',
                                                    border: `1px solid ${isPrinted ? '#86efac' : 'var(--border)'}`,
                                                    borderRadius: '8px',
                                                    background: isPrinted ? '#f0fdf4' : 'white',
                                                    transition: 'border-color 0.2s'
                                                }} className="hover:border-primary">
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex items-start" style={{ gap: '10px' }}>
                                                            <Barcode size={18} color={isPrinted ? '#16a34a' : 'var(--primary)'} style={{ marginTop: '2px' }} />
                                                            <div>
                                                                <div style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '13px', color: 'var(--text-main)' }}>
                                                                    {mapping.barcode}
                                                                </div>
                                                                <div className="text-muted" style={{ fontSize: '12px', marginTop: '2px' }}>
                                                                    {mapping.type}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                                            <span style={{ fontSize: '11px', fontWeight: 600, background: '#e0e0e0', padding: '2px 6px', borderRadius: '4px' }}>
                                                                PG {mapping.page_num}
                                                            </span>
                                                            {isPrinted && (
                                                                <span style={{
                                                                    fontSize: '10px',
                                                                    fontWeight: 500,
                                                                    background: '#dcfce7',
                                                                    color: '#166534',
                                                                    padding: '2px 6px',
                                                                    borderRadius: '4px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '3px'
                                                                }}>
                                                                    <CheckCircle size={10} />
                                                                    {printCount}x printed
                                                                </span>
                                                            )}
                                                        </div>
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
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default DashboardPage;
