import os
import logging
import re
import io
import json
import uuid
import pypdf
import platform
import subprocess
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from PIL import Image
import threading
import datetime
import hashlib

# Windows-specific imports for native printing
WINDOWS_PRINT_AVAILABLE = False
if platform.system() == 'Windows':
    try:
        import win32print
        import win32ui
        import win32con
        from PIL import ImageWin
        WINDOWS_PRINT_AVAILABLE = True
    except ImportError:
        logging.warning("win32print not available. Install pywin32 for native Windows printing.")

logger = logging.getLogger(__name__)

class PDFProcessingService:
    def __init__(self, upload_folder):
        self.upload_folder = upload_folder
        self.documents = {}  # In-memory store for now, or load from JSON
        self.mappings = {}   # Map barcode -> {file_id, page_num, etc}
        self.hashes = {}     # Map hash -> file_id
        self.print_jobs = [] # List of print jobs
        self.db_path = os.path.join(upload_folder, 'db.json')
        self.load_db()

    def load_db(self):
        if os.path.exists(self.db_path):
            try:
                with open(self.db_path, 'r') as f:
                    data = json.load(f)
                    self.documents = data.get('documents', {})
                    self.mappings = data.get('mappings', {})
                    self.print_jobs = data.get('print_jobs', [])
                    # Rebuild hash map
                    self.hashes = {doc['hash']: doc_id for doc_id, doc in self.documents.items() if 'hash' in doc}
            except Exception as e:
                logger.error(f"Failed to load DB: {e}")

    def save_db(self):
        try:
            with open(self.db_path, 'w') as f:
                json.dump({
                    'documents': self.documents,
                    'mappings': self.mappings,
                    'print_jobs': self.print_jobs
                }, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save DB: {e}")

    def log_print_job(self, job_data):
        self.print_jobs.append(job_data)
        self.save_db()

    def get_print_history(self):
        # Return sorted by timestamp desc
        return sorted(self.print_jobs, key=lambda x: x['timestamp'], reverse=True)

    def calculate_file_hash(self, file_path):
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()

    def process_pdf(self, file_path, original_filename):
        # Calculate Hash
        file_hash = self.calculate_file_hash(file_path)
        
        # Check for duplicates
        if file_hash in self.hashes:
            existing_id = self.hashes[file_hash]
            logger.info(f"Duplicate file uploaded. Returning existing ID: {existing_id}")
            return {
                'id': existing_id,
                'stats': {
                    'pages': self.documents[existing_id]['pages'],
                    'barcodes': self.documents[existing_id]['barcodes_found']
                },
                'is_duplicate': True
            }

        file_id = str(uuid.uuid4())
        
        doc_info = {
            'id': file_id,
            'name': original_filename,
            'path': file_path,
            'uploaded_at': datetime.datetime.now().isoformat(),
            'pages': 0,
            'barcodes_found': 0,
            'hash': file_hash
        }

        # Process PDF
        reader = pypdf.PdfReader(file_path)
        doc_info['pages'] = len(reader.pages)
        
        # Text Extraction Service Logic Integrated here
        text_service = TextExtractionService()
        
        for i, page in enumerate(reader.pages):
            page_num = i + 1
            text = page.extract_text()
            serials = text_service.extract_serial_numbers(text)
            
            for serial in serials:
                barcode = serial['text']
                # Store mapping (normalize barcode logic if needed)
                self.mappings[barcode] = {
                    'file_id': file_id,
                    'page_num': page_num,
                    'type': serial['type'],
                    'confidence': serial['confidence'],
                    'doc_name': original_filename
                }
                doc_info['barcodes_found'] += 1
                logger.info(f"Found {barcode} on page {page_num}")

        self.documents[file_id] = doc_info
        self.hashes[file_hash] = file_id  # Store hash
        self.save_db()
        
        return {
            'id': file_id, 
            'stats': {
                'pages': doc_info['pages'], 
                'barcodes': doc_info['barcodes_found']
            },
            'is_duplicate': False
        }

    def delete_document(self, file_id):
        if file_id in self.documents:
            doc = self.documents[file_id]
            # Remove from mappings
            self.mappings = {k: v for k, v in self.mappings.items() if v['file_id'] != file_id}
            # Remove from hashes
            if 'hash' in doc and doc['hash'] in self.hashes:
                del self.hashes[doc['hash']]
            
            # Try to remove file
            try:
                if os.path.exists(doc['path']):
                    os.remove(doc['path'])
            except Exception as e:
                logger.error(f"Error removing file: {e}")
                
            del self.documents[file_id]
            self.save_db()
            return True
        return False

    def get_all_documents(self):
        # Convert dict to sorted list
        docs_list = list(self.documents.values())
        return sorted(docs_list, key=lambda x: x['uploaded_at'], reverse=True)

    def get_document_details(self, file_id):
        if file_id not in self.documents:
            return None
        
        doc = self.documents[file_id]
        # Get all mappings for this doc
        doc_mappings = [
            {'barcode': k, **v} 
            for k, v in self.mappings.items() 
            if v['file_id'] == file_id
        ]
        
        # Sort mappings by page number
        doc_mappings.sort(key=lambda x: x['page_num'])
        
        return {
            'document': doc,
            'mappings': doc_mappings
        }

    def find_barcode(self, barcode):
        # Exact match
        if barcode in self.mappings:
            return self.mappings[barcode]
        
        # Check for partial matches or complex logic (like in original app)
        # For example, if input has prefix/suffix
        for known_barcode in self.mappings:
            if barcode in known_barcode or known_barcode in barcode:
                return self.mappings[known_barcode]
        
        return None

    def get_page_image(self, file_id, page_num):
        # In a real implementation, we render PDF page to image for preview
        # simplified here to return specific page bytes as PDF for browser
        # But user wants IMAGE preview in React usually
        
        # NOTE: For true image preview, we need pdf2image (poppler)
        # For now, we will extract the page as a single-page PDF and return that bytes
        # Frontend can use an iframe or pdf.js to show it, or we try to convert 
        
        # Fallback: Extraction logic from original service
        doc = self.documents.get(file_id)
        if not doc:
            raise Exception("Document not found")
            
        return self._extract_page_bytes(doc['path'], page_num)

    def _extract_page_bytes(self, pdf_path, page_num):
        # Cropping Logic from original app
        with open(pdf_path, 'rb') as file:
            pdf_reader = pypdf.PdfReader(file)
            if page_num < 1 or page_num > len(pdf_reader.pages):
                raise Exception("Invalid page number")
            
            original_page = pdf_reader.pages[page_num - 1]
            orig_height = float(original_page.mediabox.height)
            
            # Label dimensions (Brady label approx 4" x 2")
            label_width = 4 * inch
            label_height = 2 * inch
            
            # Crop top-left (0,0 in PDF is bottom-left usually, original logic cropped from top)
            original_page.mediabox.upper_right = (label_width, orig_height)
            original_page.mediabox.lower_left = (0, orig_height - label_height)
            
            pdf_writer = pypdf.PdfWriter()
            pdf_writer.add_page(original_page)
            
            output_buffer = io.BytesIO()
            pdf_writer.write(output_buffer)
            output_buffer.seek(0)
            return output_buffer.getvalue()

class TextExtractionService:
    def extract_serial_numbers(self, text):
        if not text: return []
        
        serial_numbers = []
        # PORTED REGEX PATTERNS
        patterns = [
            (r'\[\)>.*?S([A-Z][0-9]{10})[0-9]*[A-Z]', 'BARCODE_K'),
            (r'\[\)>.*?S([0-9][A-Z][0-9]{9,12})[0-9]*[A-Z]', 'BARCODE_NUM'),
            (r'S/?N[:\s;\.\-]+([A-Z0-9]{8,15})', 'GENERIC_SN'),
            (r'SN[:\s;\.\-]+([A-Z0-9]{8,15})', 'GENERIC_SN'),
            (r'\b([A-Z]{1,2}[0-9]{8,12})\b', 'ALPHANUMERIC_ID')
        ]
        
        for pattern, label_type in patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                # Logic to use group 1
                try:
                    val = match.group(1)
                    if len(val) >= 6:
                        serial_numbers.append({'text': val, 'type': label_type, 'confidence': 1.0})
                except: pass
                
        return serial_numbers

class PrintService:
    def __init__(self, pdf_service):
        self.pdf_service = pdf_service
        
    def print_page(self, file_id, page_num, printer_name=None):
        job_id = str(uuid.uuid4())
        timestamp = datetime.datetime.now().isoformat()
        status = "failed"
        message = ""
        
        try:
            # Get document name for logs
            doc = self.pdf_service.documents.get(file_id, {})
            doc_name = doc.get('name', 'Unknown Document')
            
            # 1. Get cropped PDF bytes
            pdf_bytes = self.pdf_service.get_page_image(file_id, page_num)
            
            # 2. Save to temp file
            temp_filename = f"print_job_{job_id}.pdf"
            with open(temp_filename, 'wb') as f:
                f.write(pdf_bytes)
                
            # 3. Send to printer (platform specific)
            system = platform.system()
            
            if system == 'Windows':
                if WINDOWS_PRINT_AVAILABLE:
                    # Use native win32print for reliable Windows printing
                    success, message = self._print_windows_native(temp_filename, printer_name)
                else:
                    # Fallback to Powershell
                    success, message = self._print_windows_powershell(temp_filename, printer_name)
                
                if success:
                    status = "success"
                else:
                    raise Exception(message)
            else:
                # Mac/Linux LPR
                cmd = ['lpr']
                if printer_name:
                    cmd.extend(['-P', printer_name])
                cmd.append(temp_filename)
                
                logger.info(f"Executing Unix Print: {' '.join(cmd)}")
                result = subprocess.run(cmd, capture_output=True, text=True)
                
                if result.returncode != 0:
                     raise Exception(f"LPR failed: {result.stderr}")
                
                status = "success"
                message = "Printed successfully"
            
            # Cleanup temp file
            try:
                os.remove(temp_filename)
            except: pass

            self._log_job(job_id, file_id, doc_name, page_num, printer_name, status, timestamp)
            return True, message
                
        except Exception as e:
            logger.error(f"Print error: {e}")
            message = str(e)
            self._log_job(job_id, file_id, doc_name if 'doc_name' in locals() else 'Unknown', page_num, printer_name, status, timestamp, message)
            return False, message

    def _print_windows_native(self, pdf_path, printer_name=None):
        """Print using win32print (native GDI) - Most Reliable Method"""
        try:
            # Convert PDF to Image first
            image = self._pdf_to_image(pdf_path)
            if image is None:
                # Fallback to Powershell if conversion fails
                logger.warning("PDF to Image conversion failed, falling back to Powershell")
                return self._print_windows_powershell(pdf_path, printer_name)
            
            # Get printer
            if not printer_name:
                printer_name = win32print.GetDefaultPrinter()
            
            # GDI Printing (from working project)
            hDC = win32ui.CreateDC()
            hDC.CreatePrinterDC(printer_name)
            
            printable_area = (hDC.GetDeviceCaps(win32con.HORZRES), hDC.GetDeviceCaps(win32con.VERTRES))
            ratio = min(printable_area[0] / image.size[0], printable_area[1] / image.size[1])
            scaled_size = (int(image.size[0] * ratio), int(image.size[1] * ratio))
            
            bmp = image.resize(scaled_size)
            dib = ImageWin.Dib(bmp)
            
            hDC.StartDoc("Barcode Label")
            hDC.StartPage()
            x = (printable_area[0] - scaled_size[0]) // 2
            y = (printable_area[1] - scaled_size[1]) // 2
            dib.draw(hDC.GetHandleOutput(), (x, y, x + scaled_size[0], y + scaled_size[1]))
            hDC.EndPage()
            hDC.EndDoc()
            hDC.DeleteDC()
            
            return True, f"Printed to {printer_name}"
            
        except Exception as e:
            logger.error(f"Native Windows print failed: {e}")
            # Fallback to Powershell
            return self._print_windows_powershell(pdf_path, printer_name)

    def _pdf_to_image(self, pdf_path):
        """Convert first page of PDF to PIL Image"""
        try:
            from pdf2image import convert_from_path
            images = convert_from_path(pdf_path, dpi=300, first_page=1, last_page=1)
            if images:
                img = images[0]
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                return img
        except ImportError:
            logger.warning("pdf2image not installed. Install it for native Windows printing.")
        except Exception as e:
            logger.error(f"PDF to image conversion error: {e}")
        return None

    def _print_windows_powershell(self, file_path, printer_name=None):
        """Fallback Windows printing using Powershell Start-Process"""
        try:
            if printer_name:
                cmd = ['powershell', '-Command', f'Start-Process -FilePath "{file_path}" -Verb PrintTo -ArgumentList "{printer_name}" -PassThru -Wait']
            else:
                cmd = ['powershell', '-Command', f'Start-Process -FilePath "{file_path}" -Verb Print -PassThru']
            
            logger.info(f"Executing Windows Print: {cmd}")
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                return True, "Sent to Windows print queue"
            else:
                return False, f"Powershell print failed: {result.stderr}"
        except subprocess.TimeoutExpired:
            return False, "Print operation timed out"
        except Exception as e:
            return False, str(e)

    def _log_job(self, job_id, file_id, doc_name, page_num, printer_name, status, timestamp, error=None):
        job_data = {
            'id': job_id,
            'file_id': file_id,
            'doc_name': doc_name,
            'page_num': page_num,
            'printer': printer_name or 'Default',
            'status': status,
            'timestamp': timestamp,
            'error': error
        }
        self.pdf_service.log_print_job(job_data)
