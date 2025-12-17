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

    // Global Filter for Scanner Noise (prevents redirects/shortcuts)
    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            // Block modifiers (Shift, Alt, Control) if standalone
            if (e.key === 'Shift' || e.key === 'Alt' || e.key === 'Control' || e.key === 'Meta') {
                // Don't preventDefault on modifiers alone usually, unless we want to strip them
                // But preventing 'Alt' prevents the menu bar focus in Windows
                // e.preventDefault(); // Optional: careful blocking modifiers globally
            }

            // Block Insert
            if (e.key === 'Insert') {
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            // Block Alt+Navigations (Browser Back/Forward etc) - CRITICAL
            if (e.altKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(e.key)) {
                console.log('Blocked Scanner Navigation:', e.key);
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            // Block Page Navigation (often sent by scanners)
            if (['PageUp', 'PageDown', 'End'].includes(e.key)) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            // Block Home (but allow text input navigation if needed - scanners usually send it at start/end)
            if (e.key === 'Home') {
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            // Block F12 (DevTools)
            if (e.key === 'F12') {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
        };

        document.addEventListener('keydown', handleGlobalKeyDown, true); // true = capture phase (intervene early)
        return () => {
            document.removeEventListener('keydown', handleGlobalKeyDown, true);
        };
    }, []);

    const handleKeyDown = (e) => {
        // --- SUBMISSION LOGIC ---
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
