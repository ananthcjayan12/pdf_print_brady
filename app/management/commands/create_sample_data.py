"""
Management command to create sample data for testing the admin report
"""
import os
import random
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from app.models import PDFDocument, BarcodePageMapping, PrintJob


class Command(BaseCommand):
    help = 'Create sample data for testing the admin report'
    
    def add_arguments(self, parser):
        parser.add_argument('--pdfs', type=int, default=5, help='Number of sample PDFs to create')
        parser.add_argument('--pages-per-pdf', type=int, default=10, help='Average pages per PDF')
    
    def handle(self, *args, **options):
        num_pdfs = options['pdfs']
        avg_pages = options['pages_per_pdf']
        
        self.stdout.write(f"Creating {num_pdfs} sample PDFs with ~{avg_pages} pages each...")
        
        sample_names = [
            "Nokia_Labels_Batch_001.pdf",
            "Product_Labels_Set_A.pdf",
            "Serial_Numbers_Export.pdf",
            "Manufacturing_Labels_Q1.pdf",
            "Device_Barcodes_2024.pdf",
            "Component_Labels_Rev2.pdf",
            "Quality_Control_Tags.pdf",
            "Shipping_Labels_Batch.pdf"
        ]
        
        for i in range(num_pdfs):
            # Create PDF document
            name = sample_names[i % len(sample_names)]
            if i >= len(sample_names):
                name = f"Sample_PDF_{i+1}.pdf"
            
            pdf_doc = PDFDocument.objects.create(
                name=name,
                file_size=random.randint(1024*1024, 50*1024*1024),  # 1MB to 50MB
                total_pages=random.randint(avg_pages-5, avg_pages+5),
                processed=True,
                uploaded_at=timezone.now() - timedelta(days=random.randint(0, 30))
            )
            
            # Create barcode mappings for this PDF
            num_pages_with_barcodes = random.randint(max(1, avg_pages-3), avg_pages+2)
            
            for page in range(1, num_pages_with_barcodes + 1):
                # Generate realistic serial number
                serial_patterns = [
                    f"{random.randint(1,9)}{random.choice('ABCDEFGHIJKLMNOPQRSTUVWXYZ')}{random.randint(100000000, 999999999)}",
                    f"EA{random.randint(1000000000, 9999999999)}",
                    f"SN{random.randint(10000000, 99999999)}",
                    f"{random.choice('ABCDEF')}{random.randint(1000000000, 9999999999)}"
                ]
                
                serial_number = random.choice(serial_patterns)
                
                mapping = BarcodePageMapping.objects.create(
                    pdf_document=pdf_doc,
                    barcode_text=serial_number,
                    page_number=page,
                    barcode_type=random.choice(['BARCODE_ID', 'GENERIC_SN', 'SN', 'ALPHANUMERIC_ID']),
                    confidence=random.uniform(0.8, 1.0),
                    created_at=pdf_doc.uploaded_at + timedelta(minutes=random.randint(1, 30))
                )
                
                # Randomly create print jobs for some mappings
                if random.random() < 0.7:  # 70% chance of being printed
                    num_prints = random.randint(1, 3)  # Some pages printed multiple times
                    
                    for _ in range(num_prints):
                        PrintJob.objects.create(
                            barcode_mapping=mapping,
                            status='completed',
                            created_at=mapping.created_at + timedelta(
                                days=random.randint(0, 15),
                                hours=random.randint(0, 23),
                                minutes=random.randint(0, 59)
                            )
                        )
            
            total_mappings = pdf_doc.barcode_mappings.count()
            printed_mappings = pdf_doc.barcode_mappings.filter(print_jobs__status='completed').distinct().count()
            
            self.stdout.write(
                self.style.SUCCESS(
                    f"Created {pdf_doc.name}: {total_mappings} pages with barcodes, "
                    f"{printed_mappings} printed ({round((printed_mappings/total_mappings)*100, 1)}%)"
                )
            )
        
        # Summary
        total_pdfs = PDFDocument.objects.count()
        total_mappings = BarcodePageMapping.objects.count()
        total_print_jobs = PrintJob.objects.filter(status='completed').count()
        
        self.stdout.write(
            self.style.SUCCESS(
                f"\nSample data created successfully!\n"
                f"Total PDFs: {total_pdfs}\n"
                f"Total pages with barcodes: {total_mappings}\n"
                f"Total print jobs: {total_print_jobs}\n"
                f"\nYou can now view the admin report at: /admin-report/"
            )
        )