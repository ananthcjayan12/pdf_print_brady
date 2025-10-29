"""
Services for PDF processing and text extraction
"""
import os
import logging
import re
from typing import List, Dict, Optional, Any, Union
import io

logger = logging.getLogger(__name__)


class PDFProcessingService:
    """Service for processing PDF files and extracting text"""
    
    def __init__(self):
        self.text_service = TextExtractionService()
    
    def process_pdf(self, pdf_document) -> bool:
        """
        Process a PDF document to extract text and find serial numbers
        
        Args:
            pdf_document: PDFDocument instance
            
        Returns:
            bool: True if processing was successful
        """
        try:
            # Import here to avoid import errors if packages aren't installed
            try:
                import pypdf
            except ImportError as e:
                logger.error(f"pypdf not installed: {e}")
                return False
            
            pdf_path = pdf_document.file.path
            
            # Extract text from PDF pages
            with open(pdf_path, 'rb') as file:
                pdf_reader = pypdf.PdfReader(file)
                total_pages = len(pdf_reader.pages)
                
                pdf_document.total_pages = total_pages
                pdf_document.save()
                
                logger.info(f"PDF has {total_pages} pages")
            
            # Process each page for serial numbers
            serial_numbers_found = 0
            
            with open(pdf_path, 'rb') as file:
                pdf_reader = pypdf.PdfReader(file)
                
                for page_num in range(total_pages):
                    logger.info(f"Processing page {page_num + 1} for serial numbers...")
                    
                    # Extract text from page
                    page = pdf_reader.pages[page_num]
                    text = page.extract_text()
                    
                    logger.debug(f"Page {page_num + 1} text extract sample: {text[:200]}...")
                    
                    # Find serial numbers in the text
                    serial_numbers = self.text_service.extract_serial_numbers(text)
                    
                    logger.info(f"Found {len(serial_numbers)} serial numbers on page {page_num + 1}")
                    
                    for serial_data in serial_numbers:
                        # Create mapping (using serial number as "barcode")
                        from .models import BarcodePageMapping
                        mapping, created = BarcodePageMapping.objects.get_or_create(
                            pdf_document=pdf_document,
                            barcode_text=serial_data['text'],
                            page_number=page_num + 1,  # 1-based page numbering
                            defaults={
                                'barcode_type': serial_data.get('type', 'SERIAL'),
                                'confidence': serial_data.get('confidence', 1.0),
                            }
                        )
                        if created:
                            serial_numbers_found += 1
                            logger.info(f"Found serial number: '{serial_data['text']}' on page {page_num + 1}")
                        else:
                            logger.info(f"Duplicate serial number: '{serial_data['text']}' on page {page_num + 1}")
            
            # Mark as processed
            pdf_document.processed = True
            pdf_document.save()
            
            logger.info(f"Successfully processed PDF {pdf_document.id}. Found {serial_numbers_found} serial numbers.")
            return True
            
        except Exception as e:
            logger.error(f"Error processing PDF {pdf_document.id}: {str(e)}")
            return False
    
    def extract_page(self, pdf_document, page_number: int) -> Optional[bytes]:
        """
        Extract a specific page from PDF as bytes
        
        Args:
            pdf_document: PDFDocument instance
            page_number: Page number to extract (1-based)
            
        Returns:
            bytes: PDF page as bytes, or None if error
        """
        try:
            import pypdf
            
            pdf_path = pdf_document.file.path
            
            with open(pdf_path, 'rb') as file:
                pdf_reader = pypdf.PdfReader(file)
                
                if page_number < 1 or page_number > len(pdf_reader.pages):
                    return None
                
                # Create new PDF with just the requested page
                pdf_writer = pypdf.PdfWriter()
                pdf_writer.add_page(pdf_reader.pages[page_number - 1])
                
                # Write to bytes
                output_buffer = io.BytesIO()
                pdf_writer.write(output_buffer)
                output_buffer.seek(0)
                
                return output_buffer.getvalue()
                
        except Exception as e:
            logger.error(f"Error extracting page {page_number} from PDF {pdf_document.id}: {str(e)}")
            return None


class TextExtractionService:
    """Service for extracting text and finding serial numbers in PDF content"""
    
    def extract_serial_numbers(self, text: str) -> List[Dict]:
        """
        Extract serial numbers from text
        
        Args:
            text: Text extracted from PDF
            
        Returns:
            List of dictionaries with identified serial numbers
        """
        serial_numbers = []
        
        if not text:
            return serial_numbers
        
        logger.debug(f"Extracting serial numbers from text: {len(text)} chars")
        
        # Regex patterns for serial numbers based on your specific format
        # Looking for patterns like: [)>061P475444A.101S1M21181173718VLENSN4LCN
        # And extracting parts like: 1M211811737
        patterns = {
            # Pattern to extract the specific serial number from your format
            'BARCODE_PATTERN': r'\[\)>.*?([0-9][A-Z][0-9]{9,12})',  # Extract 1M211811737 from [)>061P475444A.101S1M21181173718VLENSN4LCN
            
            # Additional patterns for flexibility
            'SN_PATTERN': r'S/N[:\s]*(E[A-Z0-9]{10,12})',  # S/N: EA1234567890
            'EAN_PATTERN': r'EAN[:\s]*(\d{10,15})',  # EAN: 1234567890123
            'PN_PATTERN': r'\(P\)\s*PN[:\s]*([0-9A-Z]{5,15})',  # (P) PN: 4729382A
        }
        
        # Find all instances of each pattern
        for pattern_name, pattern in patterns.items():
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                if pattern_name == 'QR_PATTERN' and len(match.groups()) >= 2:
                    # Special case for QR pattern which has two groups
                    qty = match.group(1)
                    sn = match.group(2)
                    serial_text = f"{sn} (QTY:{qty})"
                    serial_type = "SN_QTY"
                else:
                    # For other patterns, use the first capture group
                    serial_text = match.group(1)
                    serial_type = pattern_name.replace('_PATTERN', '')
                
                logger.debug(f"Found {serial_type}: {serial_text}")
                
                serial_numbers.append({
                    'text': serial_text,
                    'type': serial_type,
                    'confidence': 1.0,
                })
        
        # Additional patterns to catch various formats
        generic_patterns = [
            # Pattern for your specific barcode format - more flexible version
            (r'([0-9][A-Z][0-9]{9,12})', 'BARCODE_ID'),  # Extract 1M211811737 from anywhere in text
            
            # Standard S/N format with various separators
            (r'S/?N[:\s;\.\-]+([A-Z0-9]{8,15})', 'GENERIC_SN'),
            
            # Serial number with SN prefix
            (r'SN[:\s;\.\-]+([A-Z0-9]{8,15})', 'GENERIC_SN'),
            
            # Standalone alphanumeric patterns
            (r'\b([A-Z]{1,2}[0-9]{8,12})\b', 'ALPHANUMERIC_ID'),
        ]
        
        for pattern, label_type in generic_patterns:
            # Extract the serial from the pattern
            matches = re.finditer(pattern, text, re.IGNORECASE | re.MULTILINE)
            for match in matches:
                serial_text = match.group(1)
                # Skip if too short
                if len(serial_text) < 6:
                    continue
                
                serial_numbers.append({
                    'text': serial_text,
                    'type': label_type,
                    'confidence': 1.0,
                })
                logger.debug(f"Found {label_type} serial: {serial_text}")
        
        return serial_numbers


class PrintService:
    """Service for handling print jobs"""
    
    def __init__(self):
        self.pdf_service = PDFProcessingService()
    
    def print_page(self, print_job) -> bool:
        """
        Execute a print job
        
        Args:
            print_job: PrintJob instance
            
        Returns:
            bool: True if printing was successful
        """
        try:
            # Extract the specific page
            page_bytes = self.pdf_service.extract_page(
                print_job.barcode_mapping.pdf_document,
                print_job.barcode_mapping.page_number
            )
            
            if not page_bytes:
                print_job.error_message = "Failed to extract page from PDF"
                print_job.status = 'failed'
                print_job.save()
                return False
            
            # TODO: Implement actual printing logic here
            # This would depend on your printing setup (CUPS, Windows printing, etc.)
            # For now, we'll just simulate successful printing
            
            print_job.status = 'completed'
            print_job.save()
            
            logger.info(f"Print job {print_job.id} completed successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error executing print job {print_job.id}: {str(e)}")
            print_job.error_message = str(e)
            print_job.status = 'failed'
            print_job.save()
            return False
