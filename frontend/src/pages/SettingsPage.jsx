import { useState, useEffect } from 'react';
import { Save, Server, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { api } from '../api';

function SettingsPage() {
    const [serverUrl, setServerUrl] = useState('http://localhost:5001');
    const [status, setStatus] = useState('idle'); // idle, testing, success, error
    const [message, setMessage] = useState('');

    useEffect(() => {
        const storedUrl = localStorage.getItem('api_url');
        if (storedUrl) {
            setServerUrl(storedUrl);
        }
    }, []);

    const handleSave = async () => {
        setStatus('testing');
        setMessage('Testing connection...');

        // Clean up URL
        let url = serverUrl.replace(/\/$/, ""); // Remove trailing slash

        try {
            // Attempt to hit the health endpoint
            // We use a temporary modified API call here or just fetch directly
            const res = await fetch(`${url}/health`);
            if (res.ok) {
                const data = await res.json();
                if (data.status === 'ok') {
                    // Success
                    localStorage.setItem('api_url', url);
                    api.setBaseUrl(url); // We need to implement this in api.js
                    setStatus('success');
                    setMessage('Connected successfully! Configuration saved.');
                } else {
                    throw new Error('Invalid response from server');
                }
            } else {
                throw new Error('Server returned error');
            }
        } catch (error) {
            setStatus('error');
            setMessage(`Connection failed: ${error.message}. Ensure the Local Bridge server is running.`);
        }
    };

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div className="flex items-center" style={{ marginBottom: '24px' }}>
                <div style={{
                    background: 'white',
                    padding: '10px',
                    borderRadius: '8px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    marginRight: '16px'
                }}>
                    <Server size={24} color="var(--primary)" />
                </div>
                <div>
                    <h1 style={{ fontSize: '24px' }}>Settings</h1>
                    <p>Configure your Local Print Bridge connection.</p>
                </div>
            </div>

            <div className="card">
                <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontWeight: 500, marginBottom: '8px', fontSize: '14px' }}>
                        Local Server URL
                    </label>
                    <div className="flex">
                        <input
                            type="text"
                            className="input"
                            value={serverUrl}
                            onChange={(e) => setServerUrl(e.target.value)}
                            placeholder="http://localhost:5001"
                            style={{ flex: 1 }}
                        />
                    </div>
                    <p className="text-muted" style={{ fontSize: '12px', marginTop: '8px' }}>
                        Default is <code>http://localhost:5001</code>. Change this only if your local server is running on a different port or machine.
                    </p>
                </div>

                {status !== 'idle' && (
                    <div style={{
                        padding: '12px',
                        borderRadius: '6px',
                        marginBottom: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        background: status === 'success' ? 'var(--success-bg)' : status === 'error' ? 'var(--error-bg)' : '#f3f4f6',
                        color: status === 'success' ? 'var(--success)' : status === 'error' ? 'var(--error)' : 'var(--text-main)'
                    }} className="animate-in">
                        {status === 'success' && <CheckCircle size={18} />}
                        {status === 'error' && <XCircle size={18} />}
                        {status === 'testing' && <RefreshCw size={18} className="spin" />}
                        <span style={{ fontSize: '13px', fontWeight: 500 }}>{message}</span>
                    </div>
                )}

                <div className="flex" style={{ justifyContent: 'flex-end' }}>
                    <button
                        className="btn btn-primary"
                        onClick={handleSave}
                        disabled={status === 'testing'}
                    >
                        {status === 'testing' ? 'Testing...' : 'Test & Save Connection'}
                    </button>
                </div>
            </div>

            <div style={{ marginTop: '32px' }}>
                <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>Troubleshooting</h3>
                <div className="card" style={{ background: '#f8f9fa' }}>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6' }}>
                        <li>Ensure the <strong>Run Server</strong> script is running on your machine.</li>
                        <li>Check that no firewall is blocking port <strong>5001</strong>.</li>
                        <li>If you are using HTTPS on Cloudflare, some browsers might block requests to HTTP (Localhost). You may need to allow "Insecure Content" for localhost.</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}

export default SettingsPage;
