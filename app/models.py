from django.db import models
from django.core.validators import FileExtensionValidator
import os


def pdf_upload_path(instance, filename):
    """Generate upload path for PDF files"""
    return f'pdfs/{filename}'


class PDFDocument(models.Model):
    """Model to store uploaded PDF documents"""
    name = models.CharField(max_length=255, help_text="Document name")
    file = models.FileField(
        upload_to=pdf_upload_path,
        validators=[FileExtensionValidator(allowed_extensions=['pdf'])],
        help_text="PDF file to upload"
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    processed = models.BooleanField(default=False, help_text="Whether PDF has been processed for barcodes")
    total_pages = models.PositiveIntegerField(default=0, help_text="Total number of pages in PDF")
    file_size = models.PositiveIntegerField(default=0, help_text="File size in bytes")
    
    class Meta:
        ordering = ['-uploaded_at']
    
    def __str__(self):
        return self.name
    
    @property
    def file_size_mb(self):
        """Return file size in MB"""
        return round(self.file_size / (1024 * 1024), 2)


class BarcodePageMapping(models.Model):
    """Model to map barcodes to specific pages in PDF documents"""
    pdf_document = models.ForeignKey(
        PDFDocument, 
        on_delete=models.CASCADE, 
        related_name='barcode_mappings'
    )
    barcode_text = models.CharField(
        max_length=500, 
        help_text="Text content of the barcode",
        db_index=True
    )
    page_number = models.PositiveIntegerField(help_text="Page number (1-based)")
    barcode_type = models.CharField(
        max_length=50, 
        help_text="Type of barcode detected (e.g., CODE128, QR, etc.)",
        blank=True
    )
    confidence = models.FloatField(
        default=1.0, 
        help_text="Confidence level of barcode detection (0-1)"
    )
    x_position = models.FloatField(null=True, blank=True, help_text="X coordinate of barcode")
    y_position = models.FloatField(null=True, blank=True, help_text="Y coordinate of barcode")
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['pdf_document', 'barcode_text', 'page_number']
        ordering = ['pdf_document', 'page_number']
    
    def __str__(self):
        return f"{self.barcode_text} - Page {self.page_number}"


class PrintJob(models.Model):
    """Model to track print jobs"""
    STATUS_CHOICES = [
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    
    barcode_mapping = models.ForeignKey(
        BarcodePageMapping, 
        on_delete=models.CASCADE,
        help_text="The barcode mapping that was viewed/printed"
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='completed')
    created_at = models.DateTimeField(auto_now_add=True)
    error_message = models.TextField(blank=True, help_text="Error message if any issue occurred")
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Print Job - {self.barcode_mapping.barcode_text} ({self.status})"
