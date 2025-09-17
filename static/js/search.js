// Search page functionality

document.addEventListener('DOMContentLoaded', function() {
    const searchForm = document.getElementById('searchForm');
    const barcodeInput = document.getElementById('barcodeInput');
    const printBtn = document.getElementById('printBtn');
    const searchResults = document.getElementById('searchResults');
    const resultInfo = document.getElementById('resultInfo');
    const pagePreview = document.getElementById('pagePreview');
    const loading = document.getElementById('loading');

    let currentMappingId = null;

    // Auto-focus on barcode input
    barcodeInput.focus();

    // Real-time search as user types (debounced)
    const debouncedSearch = debounce(function(barcode) {
        if (barcode.length >= 3) {
            searchBarcode(barcode);
        } else {
            hideResults();
        }
    }, 500);

    barcodeInput.addEventListener('input', function(e) {
        const barcode = e.target.value.trim();
        debouncedSearch(barcode);
    });

    // Form submission for printing
    searchForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        if (currentMappingId) {
            printPage();
        } else {
            const barcode = barcodeInput.value.trim();
            if (barcode) {
                searchBarcode(barcode, true);
            }
        }
    });

    function searchBarcode(barcode, shouldPrint = false) {
        showLoading();
        
        fetch('/api/search-barcode/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrftoken
            },
            body: JSON.stringify({
                barcode: barcode
            })
        })
        .then(response => response.json())
        .then(data => {
            hideLoading();
            
            if (data.success) {
                showResults(data.mapping);
                currentMappingId = data.mapping.id;
                
                if (shouldPrint) {
                    printPage();
                }
            } else {
                showNoResults(data.error || 'Barcode not found');
                currentMappingId = null;
            }
        })
        .catch(error => {
            hideLoading();
            console.error('Search error:', error);
            showNoResults('Search failed due to network error');
            currentMappingId = null;
        });
    }

    function printPage() {
        if (!currentMappingId) {
            showNotification('Please search for a barcode first', 'error');
            return;
        }

        setLoading(printBtn, true);

        const printData = {
            mapping_id: currentMappingId
        };

        fetch('/api/print-page/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrftoken
            },
            body: JSON.stringify(printData)
        })
        .then(response => response.json())
        .then(data => {
            setLoading(printBtn, false);
            
            if (data.success) {
                showNotification(`Page ready for printing!`, 'success');
                
                // Open the PDF in a new window/tab for printing
                window.open(data.pdf_url, '_blank');
                
                // Reset form after successful print
                setTimeout(() => {
                    barcodeInput.value = '';
                    hideResults();
                    currentMappingId = null;
                    barcodeInput.focus();
                }, 2000);
            } else {
                showNotification(data.error || 'Print preparation failed', 'error');
            }
        })
        .catch(error => {
            setLoading(printBtn, false);
            console.error('Print error:', error);
            showNotification('Print failed due to network error', 'error');
        });
    }

    function showResults(mapping) {
        resultInfo.innerHTML = `
            <h4>✅ Barcode Found!</h4>
            <p><strong>Barcode:</strong> ${mapping.barcode_text}</p>
            <p><strong>Document:</strong> ${mapping.document_name}</p>
            <p><strong>Page:</strong> ${mapping.page_number} of ${mapping.total_pages}</p>
            <p><strong>Type:</strong> ${mapping.barcode_type || 'Unknown'}</p>
        `;

        // Show page preview link
        pagePreview.innerHTML = `
            <p>Click to preview the page:</p>
            <a href="/pdf/page/${mapping.id}/" target="_blank" class="preview-link">
                📄 View Page ${mapping.page_number}
            </a>
        `;

        searchResults.style.display = 'block';
        printBtn.disabled = false;
    }

    function showNoResults(message) {
        hideResults();
        showNotification(message, 'warning');
        printBtn.disabled = true;
    }

    function hideResults() {
        searchResults.style.display = 'none';
        printBtn.disabled = true;
    }

    function showLoading() {
        loading.style.display = 'block';
        hideResults();
    }

    function hideLoading() {
        loading.style.display = 'none';
    }

    // Validate copies input
    copiesInput.addEventListener('input', function(e) {
        const value = parseInt(e.target.value);
        if (value < 1) {
            e.target.value = 1;
        } else if (value > 100) {
            e.target.value = 100;
        }
    });

    // Enter key in barcode input should trigger search/print
    barcodeInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchForm.dispatchEvent(new Event('submit'));
        }
    });
});
