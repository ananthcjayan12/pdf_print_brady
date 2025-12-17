import { useState, useEffect } from 'react';
import { Server, RefreshCw, CheckCircle, XCircle, Crop, Clock, Eye } from 'lucide-react';
import { api } from '../api';

function SettingsPage() {
    // Server settings
    const [serverUrl, setServerUrl] = useState('http://localhost:5001');
    const [status, setStatus] = useState('idle');
    const [message, setMessage] = useState('');

    // Label settings - default 100x38mm = ~3.94x1.5 inches
    const [labelSettings, setLabelSettings] = useState({
        width: 3.94,      // inches (100mm)
        height: 1.5,      // inches (38mm)
        offsetX: 0,       // inches from left
        offsetY: 0,       // inches from top
        scale: 100,       // percentage (50-200)
        dpi: 300
    });

    // Auto-print settings
    const [autoPrintDelay, setAutoPrintDelay] = useState(3);

    // Preview state
    const [documents, setDocuments] = useState([]);
    const [selectedDoc, setSelectedDoc] = useState(null);
    const [selectedPage, setSelectedPage] = useState(1);
    const [previewKey, setPreviewKey] = useState(0);

    useEffect(() => {
        // Load server URL
        const storedUrl = localStorage.getItem('api_url');
        if (storedUrl) setServerUrl(storedUrl);

        // Load label settings
        const storedLabel = localStorage.getItem('label_settings');
        if (storedLabel) {
            try {
                setLabelSettings(JSON.parse(storedLabel));
            } catch (e) { }
        }

        // Load auto-print delay
        const storedDelay = localStorage.getItem('auto_print_delay');
        if (storedDelay) setAutoPrintDelay(parseInt(storedDelay, 10));

        // Load documents for preview
        loadDocuments();
    }, []);

    const loadDocuments = async () => {
        try {
            const result = await api.getDocuments();
            if (result.documents) {
                setDocuments(result.documents);
                if (result.documents.length > 0) {
                    setSelectedDoc(result.documents[0]);
                }
            }
        } catch (e) {
            console.error('Failed to load documents:', e);
        }
    };

    const handleSaveServer = async () => {
        setStatus('testing');
        setMessage('Testing connection...');

        let url = serverUrl.replace(/\/$/, "");

        try {
            const res = await fetch(`${url}/health`);
            if (res.ok) {
                const data = await res.json();
                if (data.status === 'ok') {
                    localStorage.setItem('api_url', url);
                    setStatus('success');
                    setMessage('Connected successfully!');
                    loadDocuments();
                } else {
                    throw new Error('Invalid response');
                }
            } else {
                throw new Error('Server error');
            }
        } catch (error) {
            setStatus('error');
            setMessage(`Connection failed: ${error.message}`);
        }
    };

    const handleSaveLabelSettings = () => {
        localStorage.setItem('label_settings', JSON.stringify(labelSettings));
        localStorage.setItem('auto_print_delay', autoPrintDelay.toString());
        // Refresh preview
        setPreviewKey(prev => prev + 1);
    };

    const updateLabelSetting = (key, value) => {
        setLabelSettings(prev => ({ ...prev, [key]: parseFloat(value) || 0 }));
    };

    // Generate preview URL with label settings as query params
    const getPreviewUrlWithSettings = () => {
        if (!selectedDoc) return null;
        const base = api.getPreviewUrl(selectedDoc.id, selectedPage);
        // Add settings as query params for server to use
        const params = new URLSearchParams({
            width: labelSettings.width,
            height: labelSettings.height,
            offsetX: labelSettings.offsetX,
            offsetY: labelSettings.offsetY,
            scale: labelSettings.scale,
            _t: previewKey // cache buster
        });
        return `${base}?${params.toString()}`;
    };

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <h1 style={{ marginBottom: '24px' }}>Settings</h1>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                {/* Left Column - Settings */}
                <div>
                    {/* Server Connection */}
                    <div className="card" style={{ marginBottom: '24px' }}>
                        <div className="flex items-center" style={{ marginBottom: '16px' }}>
                            <Server size={20} color="var(--primary)" style={{ marginRight: '10px' }} />
                            <h3 style={{ fontSize: '16px', margin: 0 }}>Server Connection</h3>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontWeight: 500, marginBottom: '8px', fontSize: '14px' }}>
                                Local Server URL
                            </label>
                            <input
                                type="text"
                                className="input"
                                value={serverUrl}
                                onChange={(e) => setServerUrl(e.target.value)}
                                placeholder="http://localhost:5001"
                                style={{ width: '100%' }}
                            />
                        </div>

                        {status !== 'idle' && (
                            <div style={{
                                padding: '10px',
                                borderRadius: '6px',
                                marginBottom: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: status === 'success' ? '#dcfce7' : status === 'error' ? '#fee2e2' : '#f3f4f6',
                                color: status === 'success' ? '#166534' : status === 'error' ? '#dc2626' : '#374151',
                                fontSize: '13px'
                            }}>
                                {status === 'success' && <CheckCircle size={16} />}
                                {status === 'error' && <XCircle size={16} />}
                                {status === 'testing' && <RefreshCw size={16} />}
                                {message}
                            </div>
                        )}

                        <button className="btn btn-primary" onClick={handleSaveServer} disabled={status === 'testing'}>
                            {status === 'testing' ? 'Testing...' : 'Test & Save'}
                        </button>
                    </div>

                    {/* Label Settings */}
                    <div className="card" style={{ marginBottom: '24px' }}>
                        <div className="flex items-center" style={{ marginBottom: '16px' }}>
                            <Crop size={20} color="var(--primary)" style={{ marginRight: '10px' }} />
                            <h3 style={{ fontSize: '16px', margin: 0 }}>Label Dimensions</h3>
                        </div>

                        <p className="text-muted" style={{ fontSize: '13px', marginBottom: '16px' }}>
                            Configure the label crop area. Default is 100x38mm.
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 500 }}>Width (in)</label>
                                <input
                                    type="number"
                                    className="input"
                                    value={labelSettings.width}
                                    onChange={(e) => updateLabelSetting('width', e.target.value)}
                                    step="0.1"
                                    min="0.5"
                                    max="12"
                                    style={{ width: '100%', marginTop: '4px' }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 500 }}>Height (in)</label>
                                <input
                                    type="number"
                                    className="input"
                                    value={labelSettings.height}
                                    onChange={(e) => updateLabelSetting('height', e.target.value)}
                                    step="0.1"
                                    min="0.5"
                                    max="12"
                                    style={{ width: '100%', marginTop: '4px' }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 500 }}>Offset X (in)</label>
                                <input
                                    type="number"
                                    className="input"
                                    value={labelSettings.offsetX}
                                    onChange={(e) => updateLabelSetting('offsetX', e.target.value)}
                                    step="0.1"
                                    min="0"
                                    max="6"
                                    style={{ width: '100%', marginTop: '4px' }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 500 }}>Offset Y (in)</label>
                                <input
                                    type="number"
                                    className="input"
                                    value={labelSettings.offsetY}
                                    onChange={(e) => updateLabelSetting('offsetY', e.target.value)}
                                    step="0.1"
                                    min="0"
                                    max="6"
                                    style={{ width: '100%', marginTop: '4px' }}
                                />
                            </div>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 500 }}>Print DPI</label>
                            <select
                                className="input"
                                value={labelSettings.dpi}
                                onChange={(e) => updateLabelSetting('dpi', e.target.value)}
                                style={{ width: '100%', marginTop: '4px' }}
                            >
                                <option value="150">150 DPI (Fast)</option>
                                <option value="300">300 DPI (Standard)</option>
                                <option value="600">600 DPI (High Quality)</option>
                            </select>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 500 }}>
                                Content Scale: {labelSettings.scale}%
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>50%</span>
                                <input
                                    type="range"
                                    min="50"
                                    max="200"
                                    step="5"
                                    value={labelSettings.scale}
                                    onChange={(e) => updateLabelSetting('scale', e.target.value)}
                                    style={{ flex: 1 }}
                                />
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>200%</span>
                            </div>
                            <p className="text-muted" style={{ fontSize: '11px', marginTop: '4px' }}>
                                Shrink (&lt;100%) or expand (&gt;100%) the content to fit your label.
                            </p>
                        </div>
                    </div>

                    {/* Auto-Print Settings */}
                    <div className="card" style={{ marginBottom: '24px' }}>
                        <div className="flex items-center" style={{ marginBottom: '16px' }}>
                            <Clock size={20} color="var(--primary)" style={{ marginRight: '10px' }} />
                            <h3 style={{ fontSize: '16px', margin: 0 }}>Auto-Print</h3>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 500 }}>Delay (seconds)</label>
                            <input
                                type="number"
                                className="input"
                                value={autoPrintDelay}
                                onChange={(e) => setAutoPrintDelay(parseInt(e.target.value, 10) || 3)}
                                min="1"
                                max="10"
                                style={{ width: '100%', marginTop: '4px' }}
                            />
                        </div>

                        <button className="btn btn-primary" onClick={handleSaveLabelSettings}>
                            Save Settings & Update Preview
                        </button>
                    </div>
                </div>

                {/* Right Column - Live Preview */}
                <div>
                    <div className="card" style={{ height: '100%' }}>
                        <div className="flex items-center" style={{ marginBottom: '16px' }}>
                            <Eye size={20} color="var(--primary)" style={{ marginRight: '10px' }} />
                            <h3 style={{ fontSize: '16px', margin: 0 }}>Live Preview</h3>
                        </div>

                        {documents.length > 0 ? (
                            <>
                                <div style={{ marginBottom: '12px' }}>
                                    <label style={{ fontSize: '12px', fontWeight: 500 }}>Select Document</label>
                                    <select
                                        className="input"
                                        value={selectedDoc?.id || ''}
                                        onChange={(e) => {
                                            const doc = documents.find(d => d.id === e.target.value);
                                            setSelectedDoc(doc);
                                            setSelectedPage(1);
                                            setPreviewKey(prev => prev + 1);
                                        }}
                                        style={{ width: '100%', marginTop: '4px' }}
                                    >
                                        {documents.map(doc => (
                                            <option key={doc.id} value={doc.id}>{doc.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {selectedDoc && (
                                    <div style={{ marginBottom: '12px' }}>
                                        <label style={{ fontSize: '12px', fontWeight: 500 }}>Page</label>
                                        <input
                                            type="number"
                                            className="input"
                                            value={selectedPage}
                                            onChange={(e) => {
                                                setSelectedPage(parseInt(e.target.value, 10) || 1);
                                                setPreviewKey(prev => prev + 1);
                                            }}
                                            min="1"
                                            max={selectedDoc.pages || 100}
                                            style={{ width: '100%', marginTop: '4px' }}
                                        />
                                    </div>
                                )}

                                <div style={{
                                    border: '2px solid var(--border)',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    background: '#f8f9fa',
                                    minHeight: '200px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    {getPreviewUrlWithSettings() ? (
                                        <iframe
                                            key={previewKey}
                                            src={getPreviewUrlWithSettings()}
                                            style={{
                                                width: '100%',
                                                height: '300px',
                                                border: 'none'
                                            }}
                                            title="Label Preview"
                                        />
                                    ) : (
                                        <div className="text-muted" style={{ padding: '40px', textAlign: 'center' }}>
                                            Select a document to preview
                                        </div>
                                    )}
                                </div>

                                <p className="text-muted" style={{ fontSize: '11px', marginTop: '8px', textAlign: 'center' }}>
                                    Preview shows cropped area: {labelSettings.width}" × {labelSettings.height}"
                                </p>
                            </>
                        ) : (
                            <div style={{
                                padding: '60px 20px',
                                textAlign: 'center',
                                color: 'var(--text-muted)',
                                background: '#f8f9fa',
                                borderRadius: '8px'
                            }}>
                                <p style={{ marginBottom: '8px' }}>No documents uploaded yet.</p>
                                <p style={{ fontSize: '13px' }}>Upload a PDF first to see the preview.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default SettingsPage;
