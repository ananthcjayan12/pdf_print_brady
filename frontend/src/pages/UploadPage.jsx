import { useEffect, useRef, useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Trash2, Files, RefreshCw, Barcode, Clock } from 'lucide-react';
import { api } from '../api';

const getLocalDate = () => {
    const now = new Date();
    return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, '0')}-${`${now.getDate()}`.padStart(2, '0')}`;
};

function UploadPage() {
    const [files, setFiles] = useState([]);
    const [status, setStatus] = useState('idle'); // idle, uploading, success, error
    const [message, setMessage] = useState('');
    const [stats, setStats] = useState(null);
    const [results, setResults] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [documentsStatus, setDocumentsStatus] = useState('loading');
    const [documentsMessage, setDocumentsMessage] = useState('');
    const [deletingId, setDeletingId] = useState('');
    const [documentScope, setDocumentScope] = useState('today');
    const [customFrom, setCustomFrom] = useState(getLocalDate());
    const [customTo, setCustomTo] = useState(getLocalDate());
    const [documentPage, setDocumentPage] = useState(1);
    const [documentPagination, setDocumentPagination] = useState({ page: 1, pages: 1, total: 0 });
    const fileInputRef = useRef(null);

    useEffect(() => {
        loadDocuments();
    }, [documentScope, customFrom, customTo, documentPage]);

    const loadDocuments = async () => {
        setDocumentsStatus('loading');
        setDocumentsMessage('');

        try {
            const params = { scope: documentScope, page: documentPage, pageSize: 50 };
            if (documentScope === 'custom') {
                delete params.scope;
                params.from = customFrom;
                params.to = customTo;
            }
            const result = await api.getDocuments(params);
            if (result.success) {
                setDocuments(result.documents || []);
                setDocumentPagination(result.pagination || { page: 1, pages: 1, total: result.documents?.length || 0 });
                setDocumentsStatus('success');
                return;
            }

            setDocuments([]);
            setDocumentsStatus('error');
            setDocumentsMessage(result.error || 'Failed to load uploaded PDFs.');
        } catch (err) {
            setDocuments([]);
            setDocumentsStatus('error');
            setDocumentsMessage(err.message || 'Failed to load uploaded PDFs.');
        }
    };

    const handleFilesSelected = (fileList) => {
        const selectedFiles = Array.from(fileList || []).filter(
            (selectedFile) => selectedFile.name.toLowerCase().endsWith('.pdf')
        );

        if (selectedFiles.length > 0) {
            setFiles(selectedFiles);
            setStatus('idle');
            setMessage('');
            setStats(null);
            setResults([]);
        }
    };

    const handleFileChange = (e) => {
        handleFilesSelected(e.target.files);
        e.target.value = '';
    };

    const handleDeleteDocument = async (documentId, documentName) => {
        if (!window.confirm(`Delete "${documentName}" from uploaded PDFs?`)) {
            return;
        }

        setDeletingId(documentId);
        setDocumentsMessage('');

        try {
            const result = await api.deleteDocument(documentId);
            if (!result.success) {
                throw new Error(result.error || 'Delete failed');
            }

            setDocuments((currentDocuments) => currentDocuments.filter((document) => document.id !== documentId));
        } catch (err) {
            setDocumentsMessage(err.message || 'Failed to delete uploaded PDF.');
        } finally {
            setDeletingId('');
        }
    };

    const handleUpload = async () => {
        if (!files.length) return;

        setStatus('uploading');
        setMessage('');
        setStats(null);
        setResults([]);

        let uploadedCount = 0;
        let duplicateCount = 0;
        let failedCount = 0;
        let totalPages = 0;
        let totalBarcodes = 0;
        const uploadResults = [];

        try {
            for (const file of files) {
                try {
                    const result = await api.uploadFile(file);

                    if (result.success) {
                        uploadedCount += 1;
                        if (result.is_duplicate) {
                            duplicateCount += 1;
                        }
                        totalPages += result.stats?.pages || 0;
                        totalBarcodes += result.stats?.barcodes || 0;

                        uploadResults.push({
                            name: file.name,
                            success: true,
                            duplicate: !!result.is_duplicate,
                            pages: result.stats?.pages || 0,
                            barcodes: result.stats?.barcodes || 0,
                            message: result.message || ''
                        });
                    } else {
                        failedCount += 1;
                        uploadResults.push({
                            name: file.name,
                            success: false,
                            duplicate: false,
                            pages: 0,
                            barcodes: 0,
                            message: result.error || 'Upload failed'
                        });
                    }
                } catch (err) {
                    failedCount += 1;
                    uploadResults.push({
                        name: file.name,
                        success: false,
                        duplicate: false,
                        pages: 0,
                        barcodes: 0,
                        message: err.message || 'Upload failed'
                    });
                }
            }

            if (uploadedCount > 0) {
                setStatus('success');
                setMessage(
                    failedCount > 0
                        ? `${uploadedCount}/${files.length} files processed successfully (${failedCount} failed).`
                        : duplicateCount > 0
                            ? `${uploadedCount} file${uploadedCount > 1 ? 's' : ''} processed. ${duplicateCount} already existed in uploads.`
                            : `${uploadedCount} file${uploadedCount > 1 ? 's' : ''} uploaded and processed successfully!`
                );
                setStats({
                    uploaded: uploadedCount,
                    duplicates: duplicateCount,
                    failed: failedCount,
                    total: files.length,
                    pages: totalPages,
                    barcodes: totalBarcodes
                });
                setFiles([]);
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            } else {
                setStatus('error');
                setMessage('All selected files failed to upload.');
                setStats({
                    uploaded: 0,
                    duplicates: 0,
                    failed: failedCount,
                    total: files.length,
                    pages: 0,
                    barcodes: 0
                });
            }

            setResults(uploadResults);
            if (documentScope === 'today' && documentPage === 1) {
                await loadDocuments();
            } else {
                setDocumentScope('today');
                setDocumentPage(1);
            }
        } catch {
            setStatus('error');
            setMessage('Upload failed');
        }
    };

    const formatDate = (value) => {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? 'Unknown' : parsed.toLocaleDateString();
    };

    const formatTime = (value) => {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime())
            ? 'Unknown'
            : parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    return (
        <div style={{ maxWidth: '1120px', margin: '0 auto' }}>
            <div className="text-center" style={{ marginBottom: '40px' }}>
                <h1 style={{ marginBottom: '12px' }}>Upload Document</h1>
                <p>Upload one or more label PDFs, then browse today, yesterday, or any custom date range.</p>
            </div>

            <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.1fr) minmax(320px, 0.9fr)', alignItems: 'start' }}>
                <div className="card">
                    <div
                        style={{
                            border: '2px dashed var(--border)',
                            borderRadius: '12px',
                            padding: '60px 40px',
                            textAlign: 'center',
                            cursor: 'pointer',
                            background: files.length > 0 ? 'rgba(99,91,255,0.02)' : 'transparent',
                            borderColor: files.length > 0 ? 'var(--primary)' : 'var(--border)',
                            transition: 'all 0.2s ease'
                        }}
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => {
                            e.preventDefault();
                            e.currentTarget.style.borderColor = 'var(--primary)';
                            e.currentTarget.style.background = 'rgba(99,91,255,0.02)';
                        }}
                        onDragLeave={(e) => {
                            if (files.length === 0) {
                                e.currentTarget.style.borderColor = 'var(--border)';
                                e.currentTarget.style.background = 'transparent';
                            }
                        }}
                        onDrop={(e) => {
                            e.preventDefault();
                            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                                handleFilesSelected(e.dataTransfer.files);
                            }
                        }}
                    >
                        <input
                            id="pdf-upload"
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf"
                            multiple
                            style={{ display: 'none' }}
                            onChange={handleFileChange}
                        />

                        <div className="flex flex-col items-center" style={{ gap: '16px' }}>
                            <div style={{
                                background: 'white',
                                padding: '16px',
                                borderRadius: '50%',
                                boxShadow: 'var(--shadow-md)',
                                color: 'var(--primary)'
                            }}>
                                <Upload size={32} />
                            </div>

                            {files.length > 0 ? (
                                <div>
                                    <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '4px' }}>
                                        {files.length} PDF{files.length > 1 ? 's' : ''} selected
                                    </div>
                                    <div className="text-muted">
                                        {(files.reduce((sum, selectedFile) => sum + selectedFile.size, 0) / 1024 / 1024).toFixed(2)} MB • Ready to process
                                    </div>
                                    <div style={{ marginTop: '10px', maxHeight: '96px', overflowY: 'auto', textAlign: 'left' }}>
                                        {files.slice(0, 5).map((selectedFile) => (
                                            <div key={selectedFile.name} className="text-muted" style={{ fontSize: '12px', marginBottom: '4px' }}>
                                                <FileText size={12} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                                                {selectedFile.name}
                                            </div>
                                        ))}
                                        {files.length > 5 && (
                                            <div className="text-muted" style={{ fontSize: '12px' }}>+ {files.length - 5} more file(s)</div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--primary)', marginBottom: '4px' }}>Click to upload PDF(s)</div>
                                    <div className="text-muted" style={{ fontSize: '14px' }}>or drag and drop one or multiple PDFs here</div>
                                </div>
                            )}
                        </div>
                    </div>

                    {files.length > 0 && status !== 'success' && (
                        <div style={{ marginTop: '24px' }}>
                            <button
                                className="btn btn-primary"
                                style={{ width: '100%', height: '48px', fontSize: '15px' }}
                                onClick={handleUpload}
                                disabled={status === 'uploading'}
                            >
                                {status === 'uploading' ? (
                                    <span className="flex items-center">Processing...</span>
                                ) : `Start Processing (${files.length})`}
                            </button>
                        </div>
                    )}

                    {status === 'success' && (
                        <div style={{ marginTop: '32px', textAlign: 'center' }} className="animate-in">
                            <div className="status-badge status-success" style={{ padding: '8px 16px', fontSize: '14px', marginBottom: '24px' }}>
                                <CheckCircle size={16} />
                                <span style={{ marginLeft: '8px' }}>Upload Complete</span>
                            </div>

                            <p style={{ marginBottom: '24px', color: 'var(--text-secondary)' }}>{message}</p>

                            {stats && (
                                <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                    <div style={{ background: 'var(--bg-body)', padding: '20px', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-main)' }}>{stats.uploaded}</div>
                                        <div className="text-muted" style={{ fontSize: '13px', fontWeight: '500', textTransform: 'uppercase' }}>Files Processed</div>
                                    </div>
                                    <div style={{ background: 'var(--bg-body)', padding: '20px', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-main)' }}>{stats.pages}</div>
                                        <div className="text-muted" style={{ fontSize: '13px', fontWeight: '500', textTransform: 'uppercase' }}>Units Processed</div>
                                    </div>
                                    <div style={{ background: 'var(--bg-body)', padding: '20px', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--primary)' }}>{stats.barcodes}</div>
                                        <div className="text-muted" style={{ fontSize: '13px', fontWeight: '500', textTransform: 'uppercase' }}>Barcodes Found</div>
                                    </div>
                                    <div style={{ background: 'var(--bg-body)', padding: '20px', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '24px', fontWeight: '700', color: stats.duplicates > 0 ? 'var(--primary)' : stats.failed > 0 ? 'var(--error)' : 'var(--text-main)' }}>
                                            {stats.duplicates > 0 ? stats.duplicates : stats.failed}
                                        </div>
                                        <div className="text-muted" style={{ fontSize: '13px', fontWeight: '500', textTransform: 'uppercase' }}>
                                            {stats.duplicates > 0 ? 'Already Uploaded' : 'Failed Uploads'}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {results.length > 0 && (
                                <div style={{ textAlign: 'left', marginBottom: '16px', maxHeight: '220px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px' }}>
                                    {results.map((result, idx) => (
                                        <div key={`${result.name}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '6px 0', borderBottom: idx < results.length - 1 ? '1px solid var(--divider)' : 'none' }}>
                                            <span style={{ fontSize: '13px', color: 'var(--text-main)' }}>{result.name}</span>
                                            <span style={{ fontSize: '12px', color: result.success ? 'var(--success)' : 'var(--error)' }}>
                                                {result.success ? (result.duplicate ? 'Already Exists' : 'Uploaded') : 'Failed'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div style={{ marginTop: '24px' }}>
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => { setFiles([]); setStatus('idle'); setStats(null); setResults([]); setMessage(''); }}
                                >
                                    Upload Another
                                </button>
                            </div>
                        </div>
                    )}

                    {status === 'error' && (
                        <div style={{ marginTop: '24px', textAlign: 'center' }} className="animate-in">
                            <div className="status-badge status-error" style={{ padding: '8px 16px' }}>
                                <AlertCircle size={16} />
                                <span style={{ marginLeft: '8px' }}>{message}</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="card" style={{ minHeight: '100%' }}>
                    <div className="flex justify-between items-center" style={{ marginBottom: '20px' }}>
                        <div>
                            <div className="flex items-center" style={{ gap: '10px', marginBottom: '6px' }}>
                                <Files size={18} color="var(--primary)" />
                                <h2 style={{ marginBottom: 0 }}>Uploaded PDFs</h2>
                            </div>
                            <p style={{ fontSize: '14px' }}>Browse upload activity without loading the full PDF library.</p>
                        </div>

                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={loadDocuments}
                            disabled={documentsStatus === 'loading'}
                        >
                            <RefreshCw size={14} />
                            Refresh
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                        {[
                            ['today', 'Today'],
                            ['yesterday', 'Yesterday'],
                            ['custom', 'Custom date']
                        ].map(([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                className={documentScope === value ? 'btn btn-primary' : 'btn btn-secondary'}
                                onClick={() => {
                                    setDocumentScope(value);
                                    setDocumentPage(1);
                                }}
                                style={{ height: '34px', padding: '0 12px' }}
                            >
                                {label}
                            </button>
                        ))}
                        {documentScope === 'custom' && (
                            <>
                                <input
                                    type="date"
                                    className="input"
                                    value={customFrom}
                                    onChange={(event) => {
                                        setCustomFrom(event.target.value);
                                        setDocumentPage(1);
                                    }}
                                    aria-label="Upload date from"
                                    style={{ width: '150px' }}
                                />
                                <input
                                    type="date"
                                    className="input"
                                    value={customTo}
                                    min={customFrom}
                                    onChange={(event) => {
                                        setCustomTo(event.target.value);
                                        setDocumentPage(1);
                                    }}
                                    aria-label="Upload date to"
                                    style={{ width: '150px' }}
                                />
                            </>
                        )}
                        <span className="status-badge" style={{ marginLeft: 'auto', background: '#f1f5f9', color: '#334155' }}>
                            {documentPagination.total} PDF{documentPagination.total === 1 ? '' : 's'}
                        </span>
                    </div>

                    {documentsMessage && (
                        <div className="status-badge status-error" style={{ marginBottom: '16px', padding: '8px 12px' }}>
                            <AlertCircle size={14} />
                            <span>{documentsMessage}</span>
                        </div>
                    )}

                    {documentsStatus === 'loading' ? (
                        <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading uploaded PDFs...</div>
                    ) : documents.length === 0 ? (
                        <div style={{ padding: '28px 0', textAlign: 'center' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>No PDFs uploaded yet</div>
                            <div className="text-muted" style={{ fontSize: '14px' }}>Uploaded files will appear here automatically.</div>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: '12px', maxHeight: '780px', overflowY: 'auto', paddingRight: '4px' }}>
                            {documents.map((document) => (
                                <div
                                    key={document.id}
                                    style={{
                                        border: '1px solid var(--border)',
                                        borderRadius: '12px',
                                        padding: '16px',
                                        background: 'var(--bg-surface)',
                                        boxShadow: 'var(--shadow-sm)'
                                    }}
                                >
                                    <div className="flex justify-between" style={{ alignItems: 'flex-start', gap: '12px', marginBottom: '10px' }}>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                                <FileText size={16} color="var(--primary)" />
                                                <div style={{ fontWeight: 600, color: 'var(--text-main)', wordBreak: 'break-word' }}>{document.name}</div>
                                            </div>
                                            {document.was_duplicate_in_range && (
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(99,91,255,0.12)', color: 'var(--primary)', borderRadius: '999px', padding: '4px 8px', fontSize: '11px', fontWeight: 700, marginBottom: '8px' }}>
                                                    Re-uploaded in this period
                                                </div>
                                            )}
                                            <div className="text-muted" style={{ fontSize: '12px' }}>
                                                Upload date: {formatDate(document.activity_at || document.uploaded_at)}
                                            </div>
                                            <div className="text-muted" style={{ fontSize: '12px', marginTop: '3px' }}>
                                                Upload time: {formatTime(document.activity_at || document.uploaded_at)}
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            className="btn btn-secondary"
                                            onClick={() => handleDeleteDocument(document.id, document.name)}
                                            disabled={deletingId === document.id}
                                            style={{ color: 'var(--error)', borderColor: 'rgba(237,95,116,0.25)', minWidth: '96px' }}
                                        >
                                            <Trash2 size={14} />
                                            {deletingId === document.id ? 'Deleting' : 'Delete'}
                                        </button>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
                                        <div style={{ background: 'var(--bg-body)', borderRadius: '8px', padding: '10px 12px' }}>
                                            <div className="text-muted" style={{ fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px' }}>
                                                <Clock size={12} style={{ verticalAlign: 'text-bottom', marginRight: '4px' }} />
                                                Units
                                            </div>
                                            <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{document.pages || 0}</div>
                                        </div>
                                        <div style={{ background: 'var(--bg-body)', borderRadius: '8px', padding: '10px 12px' }}>
                                            <div className="text-muted" style={{ fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px' }}>
                                                <Barcode size={12} style={{ verticalAlign: 'text-bottom', marginRight: '4px' }} />
                                                Barcodes
                                            </div>
                                            <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{document.barcodes_found || 0}</div>
                                        </div>
                                        <div style={{ background: 'var(--bg-body)', borderRadius: '8px', padding: '10px 12px' }}>
                                            <div className="text-muted" style={{ fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px' }}>
                                                <Files size={12} style={{ verticalAlign: 'text-bottom', marginRight: '4px' }} />
                                                Units Left
                                            </div>
                                            <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{document.left_pages || 0}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {documentsStatus !== 'loading' && documentPagination.pages > 1 && (
                        <div className="flex items-center justify-between" style={{ marginTop: '14px' }}>
                            <span className="text-muted" style={{ fontSize: '12px' }}>
                                Page {documentPagination.page} of {documentPagination.pages}
                            </span>
                            <div className="flex" style={{ gap: '8px' }}>
                                <button
                                    className="btn btn-secondary"
                                    disabled={documentPagination.page <= 1}
                                    onClick={() => setDocumentPage((page) => Math.max(page - 1, 1))}
                                >
                                    Previous
                                </button>
                                <button
                                    className="btn btn-secondary"
                                    disabled={documentPagination.page >= documentPagination.pages}
                                    onClick={() => setDocumentPage((page) => page + 1)}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default UploadPage;
