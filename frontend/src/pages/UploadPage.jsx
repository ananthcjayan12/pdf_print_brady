import { useEffect, useRef, useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Trash2, Files, RefreshCw, Barcode, Clock } from 'lucide-react';
import { api } from '../api';
import { getTodayUploadActivityIds, mergeDocumentsWithTodayActivity, recordUploadActivity, sortByTodayActivityThenUploadTime } from '../uploadActivity';

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
    const fileInputRef = useRef(null);
    const todayActivityIds = getTodayUploadActivityIds();

    useEffect(() => {
        loadDocuments();
    }, []);

    const loadDocuments = async () => {
        setDocumentsStatus('loading');
        setDocumentsMessage('');

        try {
            const result = await api.getDocuments();
            if (result.success) {
                setDocuments(result.documents || []);
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
                        recordUploadActivity({
                            fileId: result.file_id,
                            name: file.name,
                            duplicate: result.is_duplicate
                        });

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
            await loadDocuments();
        } catch {
            setStatus('error');
            setMessage('Upload failed');
        }
    };

    const formatDateTime = (value) => {
        if (!value) return 'Unknown';

        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
            return 'Unknown';
        }

        return parsed.toLocaleString();
    };

    const documentsWithActivity = sortByTodayActivityThenUploadTime(mergeDocumentsWithTodayActivity(documents));
    const todayDocuments = documentsWithActivity.filter((document) => todayActivityIds.includes(document.id));

    return (
        <div style={{ maxWidth: '1120px', margin: '0 auto' }}>
            <div className="text-center" style={{ marginBottom: '40px' }}>
                <h1 style={{ marginBottom: '12px' }}>Upload Document</h1>
                <p>Upload a PDF containing multiple labels. Existing uploaded PDFs are shown below by default so old files can be reviewed or deleted here.</p>
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
                                        <div className="text-muted" style={{ fontSize: '13px', fontWeight: '500', textTransform: 'uppercase' }}>Pages Processed</div>
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
                            <p style={{ fontSize: '14px' }}>Old uploads are visible here by default. Today&apos;s upload activity also includes duplicate re-uploads so operators can keep working from the same file.</p>
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

                    {documentsMessage && (
                        <div className="status-badge status-error" style={{ marginBottom: '16px', padding: '8px 12px' }}>
                            <AlertCircle size={14} />
                            <span>{documentsMessage}</span>
                        </div>
                    )}

                    {todayDocuments.length > 0 && (
                        <div style={{ marginBottom: '18px', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', background: 'rgba(99,91,255,0.03)' }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Today&apos;s Upload Activity
                            </div>
                            <div style={{ display: 'grid', gap: '10px' }}>
                                {todayDocuments.map((document) => (
                                    <div key={`today-${document.id}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', padding: '10px 12px', borderRadius: '10px', background: 'white', border: '1px solid var(--border)' }}>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontWeight: 600, color: 'var(--text-main)', wordBreak: 'break-word' }}>{document.name}</div>
                                            <div className="text-muted" style={{ fontSize: '12px', marginTop: '4px' }}>
                                                {document.wasDuplicateUploadToday ? 'Re-used today from existing uploads' : 'Uploaded today'}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{document.pages || 0} pages</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{document.barcodes_found || 0} barcodes</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
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
                            {documentsWithActivity.map((document) => (
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
                                            {document.wasDuplicateUploadToday && (
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(99,91,255,0.12)', color: 'var(--primary)', borderRadius: '999px', padding: '4px 8px', fontSize: '11px', fontWeight: 700, marginBottom: '8px' }}>
                                                    Re-used today
                                                </div>
                                            )}
                                            <div className="text-muted" style={{ fontSize: '12px' }}>Uploaded {formatDateTime(document.uploaded_at)}</div>
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
                                                Pages
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
                                                Left
                                            </div>
                                            <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{document.left_pages || 0}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default UploadPage;
