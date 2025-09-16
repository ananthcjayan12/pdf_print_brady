"""
Management command to test PDF text extraction
"""
import os
import logging
from django.core.management.base import BaseCommand
from app.models import PDFDocument
from app.services import PDFProcessingService, TextExtractionService
import pypdf

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Test PDF text extraction from a sample PDF'
    
    def add_arguments(self, parser):
        parser.add_argument('pdf_path', type=str, help='Path to a sample PDF file')
    
    def handle(self, *args, **options):
        pdf_path = options['pdf_path']
        
        if not os.path.exists(pdf_path):
            self.stderr.write(self.style.ERROR(f"File not found: {pdf_path}"))
            return
        
        self.stdout.write(self.style.SUCCESS(f"Testing PDF text extraction from: {pdf_path}"))
        
        # Extract text from PDF pages
        try:
            with open(pdf_path, 'rb') as file:
                pdf_reader = pypdf.PdfReader(file)
                total_pages = len(pdf_reader.pages)
                
                self.stdout.write(f"PDF has {total_pages} pages")
                
                text_service = TextExtractionService()
                
                for page_num in range(total_pages):
                    self.stdout.write(f"\nProcessing page {page_num + 1}:")
                    
                    # Extract text from page
                    page = pdf_reader.pages[page_num]
                    text = page.extract_text()
                    
                    self.stdout.write(f"Text sample: {text[:200]}...")
                    
                    # Find serial numbers in the text
                    serial_numbers = text_service.extract_serial_numbers(text)
                    
                    self.stdout.write(f"Found {len(serial_numbers)} serial numbers:")
                    
                    for i, serial_data in enumerate(serial_numbers, 1):
                        self.stdout.write(
                            self.style.SUCCESS(
                                f"  {i}. {serial_data['text']} (Type: {serial_data['type']})"
                            )
                        )
                
                self.stdout.write(self.style.SUCCESS("Text extraction test completed successfully"))
                
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Error processing PDF: {str(e)}"))
