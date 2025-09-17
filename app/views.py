from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse, HttpResponse, Http404
from django.views.generic import TemplateView
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.views.decorators.http import require_http_methods
from django.contrib import messages
from django.core.files.storage import default_storage
from django.conf import settings
import json
import os
import logging

from .models import PDFDocument, BarcodePageMapping, PrintJob
from .services import PDFProcessingService, TextExtractionService

logger = logging.getLogger(__name__)


class HomeView(TemplateView):
    """Home page view"""
    template_name = 'app/home.html'
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        # Get recent documents
        context['recent_documents'] = PDFDocument.objects.all()[:5]
        return context


class UploadView(TemplateView):
    """PDF upload page view"""
    template_name = 'app/upload.html'


class SearchView(TemplateView):
    """Barcode search page view"""
    template_name = 'app/search.html'


@require_http_methods(["POST"])
def upload_pdf_ajax(request):
    """Handle PDF file upload via AJAX"""
    try:
        if 'pdf_file' not in request.FILES:
            return JsonResponse({
                'success': False,
                'error': 'No PDF file provided'
            })
        
        pdf_file = request.FILES['pdf_file']
        
        # Validate file type
        if not pdf_file.name.lower().endswith('.pdf'):
            return JsonResponse({
                'success': False,
                'error': 'Please upload a PDF file'
            })
        
        # Validate file size (50MB limit)
        max_size = 50 * 1024 * 1024  # 50MB
        if pdf_file.size > max_size:
            return JsonResponse({
                'success': False,
                'error': 'File size must be less than 50MB'
            })
        
        # Create PDF document record
        pdf_document = PDFDocument.objects.create(
            name=pdf_file.name,
            file=pdf_file,
            file_size=pdf_file.size
        )
        
        # Start processing in background (for now, we'll process synchronously)
        try:
            # Check if required packages are available
            try:
                import pypdf
            except ImportError as import_error:
                pdf_document.delete()  # Clean up
                return JsonResponse({
                    'success': False,
                    'error': f'Required packages not installed: {str(import_error)}. Please install: pip install pypdf'
                })
            
            processing_service = PDFProcessingService()
            success = processing_service.process_pdf(pdf_document)
            
            if success:
                return JsonResponse({
                    'success': True,
                    'document_id': pdf_document.id,
                    'message': 'PDF uploaded and processing started'
                })
            else:
                pdf_document.delete()  # Clean up if processing failed
                return JsonResponse({
                    'success': False,
                    'error': 'Failed to process PDF file - no serial numbers detected'
                })
                
        except Exception as e:
            logger.error(f"Error processing PDF {pdf_document.id}: {str(e)}")
            pdf_document.delete()  # Clean up if processing failed
            return JsonResponse({
                'success': False,
                'error': 'Failed to process PDF file'
            })
    
    except Exception as e:
        logger.error(f"Error in upload_pdf_ajax: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': 'Upload failed due to server error'
        })


def upload_progress(request, document_id):
    """Get upload/processing progress for a document"""
    try:
        document = get_object_or_404(PDFDocument, id=document_id)
        
        if document.processed:
            barcode_count = document.barcode_mappings.count()
            return JsonResponse({
                'progress': 100,
                'completed': True,
                'success': True,
                'pages_found': barcode_count,
                'message': f'Processing complete. Found {barcode_count} pages with barcodes.'
            })
        else:
            # For simplicity, we'll return a progress estimate
            # In a real implementation, you'd track actual progress
            return JsonResponse({
                'progress': 50,
                'completed': False,
                'message': 'Processing PDF and detecting barcodes...'
            })
    
    except Exception as e:
        logger.error(f"Error getting upload progress for document {document_id}: {str(e)}")
        return JsonResponse({
            'progress': 0,
            'completed': True,
            'success': False,
            'error': 'Failed to get processing status'
        })


@require_http_methods(["POST"])
def search_barcode_ajax(request):
    """Search for a barcode in uploaded PDFs"""
    try:
        data = json.loads(request.body)
        barcode = data.get('barcode', '').strip()
        
        if not barcode:
            return JsonResponse({
                'success': False,
                'error': 'Please enter a barcode'
            })
        
        # Search for barcode in mappings
        try:
            mapping = BarcodePageMapping.objects.select_related('pdf_document').get(
                barcode_text__iexact=barcode
            )
            
            return JsonResponse({
                'success': True,
                'mapping': {
                    'id': mapping.id,
                    'barcode_text': mapping.barcode_text,
                    'page_number': mapping.page_number,
                    'barcode_type': mapping.barcode_type,
                    'document_name': mapping.pdf_document.name,
                    'total_pages': mapping.pdf_document.total_pages,
                    'confidence': mapping.confidence
                }
            })
            
        except BarcodePageMapping.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': f'Barcode "{barcode}" not found in any uploaded documents'
            })
    
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Invalid request data'
        })
    except Exception as e:
        logger.error(f"Error searching barcode: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': 'Search failed due to server error'
        })


@require_http_methods(["POST"])
def print_page_ajax(request):
    """Handle print page request - simplified to just return the page URL"""
    try:
        data = json.loads(request.body)
        mapping_id = data.get('mapping_id')
        
        if not mapping_id:
            return JsonResponse({
                'success': False,
                'error': 'No page specified for printing'
            })
        
        # Get the barcode mapping
        try:
            mapping = BarcodePageMapping.objects.get(id=mapping_id)
        except BarcodePageMapping.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'Page not found'
            })
        
        # Create print job record for tracking purposes
        print_job = PrintJob.objects.create(
            barcode_mapping=mapping,
            status='completed'  # Mark as completed immediately
        )
        
        # Generate the URL to the PDF page that can be opened in a new window for printing
        from django.urls import reverse
        pdf_url = request.build_absolute_uri(reverse('app:serve_pdf_page', args=[mapping_id]))
        
        return JsonResponse({
            'success': True,
            'job_id': print_job.id,
            'pdf_url': pdf_url,
            'message': f'Page {mapping.page_number} ready for printing'
        })
    
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Invalid request data'
        })
    except Exception as e:
        logger.error(f"Error creating print job: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': 'Print job failed due to server error'
        })


def serve_pdf_page(request, mapping_id):
    """Serve a specific PDF page for preview"""
    try:
        mapping = get_object_or_404(BarcodePageMapping, id=mapping_id)
        
        # Use the PDFProcessingService to extract just the requested page
        processing_service = PDFProcessingService()
        page_bytes = processing_service.extract_page(
            mapping.pdf_document,
            mapping.page_number
        )
        
        if not page_bytes:
            logger.error(f"Failed to extract page {mapping.page_number} from PDF {mapping.pdf_document.id}")
            raise Http404("PDF page could not be extracted")
        
        # Return the extracted page
        response = HttpResponse(page_bytes, content_type='application/pdf')
        filename = f"{mapping.pdf_document.name.split('.')[0]}_page_{mapping.page_number}.pdf"
        response['Content-Disposition'] = f'inline; filename="{filename}"'
        return response
    
    except Exception as e:
        logger.error(f"Error serving PDF page {mapping_id}: {str(e)}")
        raise Http404("PDF page not found")
