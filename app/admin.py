from django.contrib import admin
from django.urls import reverse
from django.utils.html import format_html
from .models import PDFDocument, BarcodePageMapping, PrintJob


@admin.register(PDFDocument)
class PDFDocumentAdmin(admin.ModelAdmin):
    list_display = ['name', 'total_pages', 'file_size_mb', 'processed', 'print_status', 'uploaded_at']
    list_filter = ['processed', 'uploaded_at']
    search_fields = ['name']
    readonly_fields = ['uploaded_at', 'file_size', 'total_pages']
    
    def file_size_mb(self, obj):
        return f"{obj.file_size_mb} MB"
    file_size_mb.short_description = "File Size"
    
    def print_status(self, obj):
        """Show printing status for this PDF"""
        total_mappings = obj.barcode_mappings.count()
        if total_mappings == 0:
            return "No barcodes detected"
        
        printed_count = obj.barcode_mappings.filter(print_jobs__status='completed').distinct().count()
        percentage = (printed_count / total_mappings) * 100 if total_mappings > 0 else 0
        
        color = 'green' if percentage == 100 else 'orange' if percentage > 0 else 'red'
        return format_html(
            '<span style="color: {};">{}/{} printed ({}%)</span>',
            color, printed_count, total_mappings, round(percentage, 1)
        )
    print_status.short_description = "Print Status"
    
    def changelist_view(self, request, extra_context=None):
        """Add link to detailed report in admin changelist"""
        extra_context = extra_context or {}
        extra_context['detailed_report_url'] = reverse('app:admin_report')
        return super().changelist_view(request, extra_context)


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
