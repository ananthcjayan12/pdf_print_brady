from django.urls import path
from . import views

app_name = 'app'

urlpatterns = [
    # Main pages
    path('', views.HomeView.as_view(), name='home'),
    path('upload/', views.UploadView.as_view(), name='upload'),
    path('search/', views.SearchView.as_view(), name='search'),
    
    # AJAX endpoints
    path('api/upload-pdf/', views.upload_pdf_ajax, name='upload_pdf_ajax'),
    path('api/search-barcode/', views.search_barcode_ajax, name='search_barcode_ajax'),
    path('api/print-page/', views.print_page_ajax, name='print_page_ajax'),
    path('api/upload-progress/<int:document_id>/', views.upload_progress, name='upload_progress'),
    
    # PDF serving
    path('pdf/page/<int:mapping_id>/', views.serve_pdf_page, name='serve_pdf_page'),
    
    # Admin reports
    path('admin-report/', views.admin_report_view, name='admin_report'),
]
