import { useState } from 'react';
import BarcodeInput from '../components/BarcodeInput';
import LabelPreview from '../components/LabelPreview';
import { api } from '../api';

function ScanPage() {
    const [barcode, setBarcode] = useState('');
    const [scanResult, setScanResult] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);
    const [error, setError] = useState(null);

    const handleLookup = async (code) => {
        if (!code) return;

        setIsLoading(true);
        setError(null);
        setScanResult(null);

        try {
            const result = await api.scanBarcode(code);

            if (result.success && result.found) {
                setScanResult(result.mapping);
                // Optional: Sound effect for success?
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
        if (!scanResult) return;

        setIsPrinting(true);
        try {
            const result = await api.printLabel(
                scanResult.file_id,
                scanResult.page_num
            );

            if (result.success) {
                alert('Sent to printer!'); // Or use a nice toast
                // Clear after print? Maybe keep it for reference.
                // setBarcode('');
                // setScanResult(null);
            } else {
                alert('Print failed: ' + result.error);
            }
        } catch (err) {
            alert('Print error: ' + err.message);
        } finally {
            setIsPrinting(false);
        }
    };

    return (
        <div style={{ maxWidth: '480px', margin: '60px auto' }}>
            <div className="text-center" style={{ marginBottom: '32px' }}>
                <h1 style={{ marginBottom: '8px' }}>Scan to Print</h1>
                <p>Scan a barcode to instantly find and print its label.</p>
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
                <LabelPreview
                    mapping={scanResult}
                    previewUrl={api.getPreviewUrl(scanResult.file_id, scanResult.page_num)}
                    onPrint={handlePrint}
                    onCancel={() => {
                        setScanResult(null);
                        setBarcode('');
                    }}
                    isPrinting={isPrinting}
                />
            )}
        </div>
    );
}

export default ScanPage;
