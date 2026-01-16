import os
from flask import Flask, request, jsonify, send_from_directory, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename
import logging
import io

# Import services (we'll create this next)
from services import PDFProcessingService, PrintService

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
# Enable CORS for all domains (essential for Cloudflare hosted frontend)
CORS(app, resources={r"/*": {"origins": "*"}})

# Configuration
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB limit

# Initialize services
pdf_service = PDFProcessingService(upload_folder=UPLOAD_FOLDER)
print_service = PrintService(pdf_service)

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok', 'message': 'Print Server is running'})

@app.route('/api/printers', methods=['GET'])
def list_printers():
    """List available system printers"""
    try:
        import subprocess
        import platform
        
        printers = []
        default_printer = None
        system = platform.system()
        
        if system == 'Darwin':  # macOS
            # Get list of printers
            result = subprocess.run(['lpstat', '-p'], capture_output=True, text=True)
            if result.returncode == 0:
                for line in result.stdout.strip().split('\n'):
                    if line.startswith('printer'):
                        parts = line.split()
                        if len(parts) >= 2:
                            printers.append(parts[1])
            
            # Get default printer
            result = subprocess.run(['lpstat', '-d'], capture_output=True, text=True)
            if result.returncode == 0 and 'system default destination:' in result.stdout:
                default_printer = result.stdout.split(':')[-1].strip()
                
        elif system == 'Windows':
            try:
                import win32print
                for p in win32print.EnumPrinters(win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS):
                    printers.append(p[2])
                default_printer = win32print.GetDefaultPrinter()
            except ImportError:
                # Fallback to PowerShell
                result = subprocess.run(
                    ['powershell', '-Command', 'Get-Printer | Select-Object -ExpandProperty Name'],
                    capture_output=True, text=True
                )
                if result.returncode == 0:
                    printers = [p.strip() for p in result.stdout.strip().split('\n') if p.strip()]
        else:  # Linux
            result = subprocess.run(['lpstat', '-p'], capture_output=True, text=True)
            if result.returncode == 0:
                for line in result.stdout.strip().split('\n'):
                    if line.startswith('printer'):
                        parts = line.split()
                        if len(parts) >= 2:
                            printers.append(parts[1])
        
        return jsonify({
            'success': True,
            'printers': printers,
            'default_printer': default_printer
        })
    except Exception as e:
        logger.error(f"Failed to list printers: {e}")
        return jsonify({'success': False, 'error': str(e), 'printers': []})

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file and file.filename.lower().endswith('.pdf'):
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        # Process PDF
        try:
            result = pdf_service.process_pdf(filepath, filename)
            
            if result.get('is_duplicate'):
                pass # You can decide to treat as error or success with warning
                # For now returning success but with existing ID
                
            return jsonify({
                'success': True,
                'message': 'File uploaded and processed' if not result.get('is_duplicate') else 'File already exists',
                'file_id': result['id'],
                'stats': result['stats'],
                'is_duplicate': result.get('is_duplicate', False)
            })
        except Exception as e:
            logger.error(f"Processing error: {e}")
            return jsonify({'error': str(e)}), 500
            
    return jsonify({'error': 'Invalid file type'}), 400

@app.route('/api/documents', methods=['GET'])
def get_documents():
    docs = pdf_service.get_all_documents()
    return jsonify({'success': True, 'documents': docs})

@app.route('/api/documents/<file_id>', methods=['GET', 'DELETE'])
def document_operations(file_id):
    if request.method == 'GET':
        details = pdf_service.get_document_details(file_id)
        if details:
            return jsonify({'success': True, 'details': details})
        return jsonify({'error': 'Document not found'}), 404
        
    elif request.method == 'DELETE':
        success = pdf_service.delete_document(file_id)
        if success:
            return jsonify({'success': True, 'message': 'Document deleted'})
        return jsonify({'error': 'Document not found'}), 404

@app.route('/api/history', methods=['GET'])
def get_history():
    history = pdf_service.get_print_history()
    return jsonify({'success': True, 'history': history})

@app.route('/api/scan/<barcode>', methods=['GET'])
def scan_barcode(barcode):
    try:
        # Search for barcode
        result = pdf_service.find_barcode(barcode)
        if result:
            # Check if this barcode was printed before
            print_count = pdf_service.get_barcode_print_count(barcode)
            last_print = pdf_service.get_last_print_for_barcode(barcode)
            
            return jsonify({
                'success': True,
                'found': True,
                'mapping': result,
                'print_count': print_count,
                'last_print': last_print
            })
        else:
            return jsonify({
                'success': True,
                'found': False,
                'message': 'Barcode not found'
            })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get dashboard statistics"""
    try:
        stats = pdf_service.get_dashboard_stats()
        return jsonify({'success': True, 'stats': stats})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/documents/<file_id>/print-stats', methods=['GET'])
def get_document_print_stats(file_id):
    """Get print statistics for a specific document"""
    try:
        stats = pdf_service.get_document_print_stats(file_id)
        if stats:
            return jsonify({'success': True, 'stats': stats})
        return jsonify({'error': 'Document not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/preview/<file_id>/<int:page_num>', methods=['GET'])
def preview_page(file_id, page_num):
    try:
        # Get label settings from query params (for live preview)
        label_settings = {
            'width': float(request.args.get('width', 3.94)),
            'height': float(request.args.get('height', 1.5)),
            'offsetX': float(request.args.get('offsetX', 0)),
            'offsetY': float(request.args.get('offsetY', 0)),
            'scale': float(request.args.get('scale', 100))
        }
        
        # Get processed and/or cropped page image/pdf
        image_bytes = pdf_service.get_page_image(file_id, page_num, label_settings)
        return send_file(
            io.BytesIO(image_bytes),
            mimetype='application/pdf',
            as_attachment=False,
            download_name=f'preview_{page_num}.pdf'
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 404

@app.route('/api/print', methods=['POST'])
def print_label():
    data = request.json
    file_id = data.get('file_id')
    page_num = data.get('page_num')
    printer_name = data.get('printer_name')
    label_settings = data.get('label_settings', {})
    username = data.get('username', 'Unknown') # Get username
    
    if not file_id or not page_num:
        return jsonify({'error': 'Missing file_id or page_num'}), 400
        
    try:
        # Pass username to print service
        success, message = print_service.print_page(file_id, page_num, printer_name, label_settings, username)
        if success:
            return jsonify({'success': True, 'message': message})
        else:
            return jsonify({'success': False, 'error': message}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/reports/download', methods=['GET'])
def download_report():
    """Generate and download CSV report of print history"""
    try:
        import csv
        
        # Create CSV in memory
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header
        writer.writerow(['Date', 'Time', 'Document', 'Barcode', 'Page', 'User', 'Printer', 'Status', 'Message'])
        
        # Data
        history = pdf_service.get_print_history()
        for job in history:
            timestamp = job.get('timestamp', '')
            date_str = ''
            time_str = ''
            if 'T' in timestamp:
                parts = timestamp.split('T')
                date_str = parts[0]
                time_str = parts[1].split('.')[0]
                
            writer.writerow([
                date_str,
                time_str,
                job.get('filename', 'Unknown'),
                job.get('barcode', 'N/A'),
                job.get('page_num', ''),
                job.get('username', 'Unknown'), # Include username
                job.get('printer', 'Default'),
                job.get('status', ''),
                job.get('message', '')
            ])
            
        output.seek(0)
        
        # Convert string to bytes for send_file
        mem = io.BytesIO()
        mem.write(output.getvalue().encode('utf-8'))
        mem.seek(0)
        
        return send_file(
            mem,
            mimetype='text/csv',
            as_attachment=True,
            download_name='print_history_report.csv'
        )
    except Exception as e:
        logger.error(f"Report generation failed: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
