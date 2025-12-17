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
            return jsonify({
                'success': True,
                'found': True,
                'mapping': result
            })
        else:
            return jsonify({
                'success': True,
                'found': False,
                'message': 'Barcode not found'
            })
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
    
    if not file_id or not page_num:
        return jsonify({'error': 'Missing file_id or page_num'}), 400
        
    try:
        success, message = print_service.print_page(file_id, page_num, printer_name, label_settings)
        if success:
            return jsonify({'success': True, 'message': message})
        else:
            return jsonify({'success': False, 'error': message}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
