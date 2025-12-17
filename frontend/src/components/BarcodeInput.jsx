import { useRef, useEffect, useState } from 'react';

function BarcodeInput({ value, onChange, onLookup, isLoading }) {
    const inputRef = useRef(null);
    const debounceTimerRef = useRef(null);

    useEffect(() => {
        // Auto-focus input on mount
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    // Keep focus on input (optional, good for dedicated scanning station)
    useEffect(() => {
        const handleBlur = () => {
            // setTimeout(() => inputRef.current?.focus(), 100);
        };
        const input = inputRef.current;
        if (input) input.addEventListener('blur', handleBlur);
        return () => input?.removeEventListener('blur', handleBlur);
    }, []);

    // Debounced Auto-Submit logic
    useEffect(() => {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

        if (value && value.trim().length >= 5) {
            debounceTimerRef.current = setTimeout(() => {
                onLookup(value);
            }, 500); // 500ms delay for snappier feel
        }
        return () => clearTimeout(debounceTimerRef.current);
    }, [value]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            onLookup(value);
        }
    };

    return (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ marginBottom: '20px', fontSize: '1.2rem', color: 'var(--text-muted)' }}>
                Scan Barcode to Print
            </div>

            <input
                ref={inputRef}
                type="text"
                className="input"
                style={{
                    fontSize: '2rem',
                    textAlign: 'center',
                    letterSpacing: '2px',
                    height: '80px',
                    marginBottom: '20px'
                }}
                placeholder="Scan or Type..."
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
            />

            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                {isLoading ? 'Searching...' : 'Ready to scan'}
            </div>
        </div>
    );
}

export default BarcodeInput;
