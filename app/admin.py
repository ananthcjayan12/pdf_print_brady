from django.contrib import admin
from .models import PDFDocument, BarcodePageMapping, PrintJob


@admin.register(PDFDocument)
class PDFDocumentAdmin(admin.ModelAdmin):
    list_display = ['name', 'total_pages', 'file_size_mb', 'processed', 'uploaded_at']
    list_filter = ['processed', 'uploaded_at']
    search_fields = ['name']
    readonly_fields = ['uploaded_at', 'file_size', 'total_pages']
    
    def file_size_mb(self, obj):
        return f"{obj.file_size_mb} MB"
    file_size_mb.short_description = "File Size"


@admin.register(BarcodePageMapping)
class BarcodePageMappingAdmin(admin.ModelAdmin):
    list_display = ['barcode_text', 'pdf_document', 'page_number', 'barcode_type', 'confidence']
    list_filter = ['barcode_type', 'pdf_document', 'created_at']
    search_fields = ['barcode_text', 'pdf_document__name']
    readonly_fields = ['created_at']
    ordering = ['pdf_document', 'page_number']


@admin.register(PrintJob)
class PrintJobAdmin(admin.ModelAdmin):
    list_display = ['barcode_mapping', 'status', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['barcode_mapping__barcode_text', 'barcode_mapping__pdf_document__name']
    readonly_fields = ['created_at']
    
    def get_readonly_fields(self, request, obj=None):
        if obj and obj.status in ['completed', 'failed']:
            return self.readonly_fields + ['barcode_mapping']
        return self.readonly_fields
