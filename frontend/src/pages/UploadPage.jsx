import { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { api } from '../api';

function UploadPage() {
    const [file, setFile] = useState(null);
    const [status, setStatus] = useState('idle'); // idle, uploading, success, error
    const [message, setMessage] = useState('');
    const [stats, setStats] = useState(null);

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setStatus('idle');
            setMessage('');
            setStats(null);
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setStatus('uploading');
        try {
            const result = await api.uploadFile(file);
            if (result.success) {
                setStatus('success');
                setMessage('File uploaded and processed successfully!');
                setStats(result.stats);
            } else {
                setStatus('error');
                setMessage(result.error || 'Upload failed');
            }
        } catch (err) {
            setStatus('error');
            setMessage(err.message || 'Upload failed');
        }
    };

    return (
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
            <div className="text-center" style={{ marginBottom: '40px' }}>
                <h1 style={{ marginBottom: '12px' }}>Upload Document</h1>
                <p>Upload a PDF containing multiple labels. We'll automatically detect barcodes.</p>
            </div>

            <div className="card">
                <div
                    style={{
                        border: '2px dashed var(--border)',
                        borderRadius: '12px',
                        padding: '60px 40px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: file ? 'rgba(99,91,255,0.02)' : 'transparent',
                        borderColor: file ? 'var(--primary)' : 'var(--border)',
                        transition: 'all 0.2s ease'
                    }}
                    onClick={() => document.getElementById('pdf-upload').click()}
                    onDragOver={(e) => {
                        e.preventDefault();
                        e.currentTarget.style.borderColor = 'var(--primary)';
                        e.currentTarget.style.background = 'rgba(99,91,255,0.02)';
                    }}
                    onDragLeave={(e) => {
                        if (!file) {
                            e.currentTarget.style.borderColor = 'var(--border)';
                            e.currentTarget.style.background = 'transparent';
                        }
                    }}
                    onDrop={(e) => {
                        e.preventDefault();
                        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                            handleFileChange({ target: { files: e.dataTransfer.files } });
                        }
                    }}
                >
                    <input
                        id="pdf-upload"
                        type="file"
                        accept=".pdf"
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

                        {file ? (
                            <div>
                                <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '4px' }}>{file.name}</div>
                                <div className="text-muted">
                                    {(file.size / 1024 / 1024).toFixed(2)} MB • Ready to process
                                </div>
                            </div>
                        ) : (
                            <div>
                                <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--primary)', marginBottom: '4px' }}>Click to upload PDF</div>
                                <div className="text-muted" style={{ fontSize: '14px' }}>or drag and drop here</div>
                            </div>
                        )}
                    </div>
                </div>

                {file && status !== 'success' && (
                    <div style={{ marginTop: '24px' }}>
                        <button
                            className="btn btn-primary"
                            style={{ width: '100%', height: '48px', fontSize: '15px' }}
                            onClick={handleUpload}
                            disabled={status === 'uploading'}
                        >
                            {status === 'uploading' ? (
                                <span className="flex items-center">Processing...</span>
                            ) : 'Start Processing'}
                        </button>
                    </div>
                )}

                {status === 'success' && (
                    <div style={{ marginTop: '32px', textAlign: 'center' }} className="animate-in">
                        {message.includes('already exists') ? (
                            <div className="status-badge status-info" style={{ padding: '8px 16px', fontSize: '14px', marginBottom: '24px' }}>
                                <CheckCircle size={16} />
                                <span style={{ marginLeft: '8px' }}>File Already Exists (Skipped)</span>
                            </div>
                        ) : (
                            <div className="status-badge status-success" style={{ padding: '8px 16px', fontSize: '14px', marginBottom: '24px' }}>
                                <CheckCircle size={16} />
                                <span style={{ marginLeft: '8px' }}>Upload Successful</span>
                            </div>
                        )}

                        <p style={{ marginBottom: '24px', color: 'var(--text-secondary)' }}>{message}</p>

                        {stats && (
                            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div style={{ background: 'var(--bg-body)', padding: '20px', borderRadius: '8px' }}>
                                    <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-main)' }}>{stats.pages}</div>
                                    <div className="text-muted" style={{ fontSize: '13px', fontWeight: '500', textTransform: 'uppercase' }}>Pages Processed</div>
                                </div>
                                <div style={{ background: 'var(--bg-body)', padding: '20px', borderRadius: '8px' }}>
                                    <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--primary)' }}>{stats.barcodes}</div>
                                    <div className="text-muted" style={{ fontSize: '13px', fontWeight: '500', textTransform: 'uppercase' }}>Barcodes Found</div>
                                </div>
                            </div>
                        )}

                        <div style={{ marginTop: '24px' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={() => { setFile(null); setStatus('idle'); setStats(null); }}
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
        </div>
    );
}

export default UploadPage;
