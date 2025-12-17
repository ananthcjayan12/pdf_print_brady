import { useState, useEffect, useRef } from 'react';
import BarcodeInput from '../components/BarcodeInput';
import LabelPreview from '../components/LabelPreview';
import { api } from '../api';

function ScanPage() {
    const [barcode, setBarcode] = useState('');
    const [scanResult, setScanResult] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);
    const [error, setError] = useState(null);
    const [countdown, setCountdown] = useState(null);
    const autoPrintTimerRef = useRef(null);

    // Get auto-print delay from settings (default 3 seconds)
    const getAutoPrintDelay = () => {
        const saved = localStorage.getItem('auto_print_delay');
        return saved ? parseInt(saved, 10) : 3;
    };

    // Auto-print effect: triggers print after countdown
    useEffect(() => {
        if (scanResult && !isPrinting) {
            const delay = getAutoPrintDelay();
            setCountdown(delay);

            // Start countdown
            const countdownInterval = setInterval(() => {
                setCountdown(prev => {
                    if (prev <= 1) {
                        clearInterval(countdownInterval);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

            // Auto-print timer
            autoPrintTimerRef.current = setTimeout(() => {
                handlePrint();
            }, delay * 1000);

            return () => {
                clearTimeout(autoPrintTimerRef.current);
                clearInterval(countdownInterval);
            };
        }
    }, [scanResult]);

    const handleLookup = async (code) => {
        if (!code) return;

        // Cancel any pending auto-print
        if (autoPrintTimerRef.current) {
            clearTimeout(autoPrintTimerRef.current);
        }

        setIsLoading(true);
        setError(null);
        setScanResult(null);
        setCountdown(null);

        try {
            const result = await api.scanBarcode(code);

            if (result.success && result.found) {
                setScanResult(result.mapping);
            } else {
                setError('Barcode not found in any uploaded document.');
            }
        } catch (err) {
            setError('Error searching for barcode. Is the server running?');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePrint = async () => {
        if (!scanResult || isPrinting) return;

        // Cancel countdown
        if (autoPrintTimerRef.current) {
            clearTimeout(autoPrintTimerRef.current);
        }
        setCountdown(null);

        setIsPrinting(true);
        try {
            // Get label settings from localStorage
            const labelSettings = JSON.parse(localStorage.getItem('label_settings') || '{}');

            await api.printLabel(
                scanResult.file_id,
                scanResult.page_num,
                null, // printer_name
                labelSettings // Pass crop settings
            );

            // Silent success: just reset for next scan after brief display
            setTimeout(() => {
                setBarcode('');
                setScanResult(null);
            }, 500);

        } catch (err) {
            console.error('Print error:', err);
            // Optionally show brief error indicator
        } finally {
            setIsPrinting(false);
        }
    };

    const cancelAutoPrint = () => {
        if (autoPrintTimerRef.current) {
            clearTimeout(autoPrintTimerRef.current);
        }
        setCountdown(null);
        setScanResult(null);
        setBarcode('');
    };

    return (
        <div style={{ maxWidth: '480px', margin: '60px auto' }}>
            <div className="text-center" style={{ marginBottom: '32px' }}>
                <h1 style={{ marginBottom: '8px' }}>Scan to Print</h1>
                <p>Scan a barcode. Label prints automatically.</p>
            </div>

            <BarcodeInput
                value={barcode}
                onChange={setBarcode}
                onLookup={handleLookup}
                isLoading={isLoading}
            />

            {error && (
                <div className="card status-error" style={{
                    marginTop: '24px',
                    padding: '16px',
                    borderRadius: '8px',
                    textAlign: 'center',
                    border: '1px solid var(--error)'
                }}>
                    <span style={{ fontWeight: 500 }}>Error:</span> {error}
                </div>
            )}

            {scanResult && (
                <div className="card animate-in" style={{ marginTop: '24px', textAlign: 'center' }}>
                    <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                            Found: <strong>{scanResult.doc_name}</strong> - Page {scanResult.page_num}
                        </div>

                        {/* Preview */}
                        <iframe
                            src={api.getPreviewUrl(scanResult.file_id, scanResult.page_num)}
                            style={{
                                width: '100%',
                                height: '180px',
                                border: '1px solid var(--border)',
                                borderRadius: '8px',
                                marginBottom: '16px'
                            }}
                            title="Label Preview"
                        />
                    </div>

                    {countdown !== null && countdown > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                            <div style={{
                                fontSize: '32px',
                                fontWeight: '700',
                                color: 'var(--primary)',
                                marginBottom: '4px'
                            }}>
                                {countdown}
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                Printing automatically...
                            </div>
                        </div>
                    )}

                    {isPrinting && (
                        <div style={{ color: 'var(--primary)', fontWeight: 500 }}>
                            Sending to printer...
                        </div>
                    )}

                    <button
                        className="btn btn-secondary"
                        onClick={cancelAutoPrint}
                        style={{ marginTop: '12px' }}
                    >
                        Cancel
                    </button>
                </div>
            )}
        </div>
    );
}

export default ScanPage;
