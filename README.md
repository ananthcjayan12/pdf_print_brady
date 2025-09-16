# PDF Label Serial Number Extractor

A Django web application that allows users to upload a PDF containing label pages, extract and map serial numbers (S/N) from the text of each page, and enable users to search for a serial number to find and print the corresponding page.

## Key Features

- Upload PDF files containing product labels
- Automatically extract serial numbers (S/N) from label text using regex patterns
- Search for specific serial numbers to find the corresponding page
- Preview and print individual pages based on serial number search
- Minimal dependencies - only requires pypdf for text extraction

## Setup and Installation

1. Clone the repository
2. Create a virtual environment and activate it:
```bash
python -m venv env
source env/bin/activate  # On Windows: env\Scripts\activate
```
3. Install requirements:
```bash
pip install -r requirements.txt
```
4. Apply migrations:
```bash
python manage.py migrate
```
5. Create a superuser (optional):
```bash
python manage.py createsuperuser
```
6. Run the development server:
```bash
python manage.py runserver
```

## How It Works

1. **Upload PDF**: Users upload a PDF file containing label pages with serial numbers
2. **Text Extraction**: The system uses pypdf to extract text from each page
3. **Serial Number Detection**: Regular expressions are used to identify serial numbers (S/N) in the extracted text
4. **Mapping**: Each identified serial number is mapped to its corresponding page number
5. **Search**: Users can search for a specific serial number
6. **Print**: The system can extract and print the specific page containing the searched serial number

## Dependencies

- Django: Web framework
- pypdf: PDF text extraction
- Pillow: Image processing (for potential future enhancements)
- reportlab: PDF generation (for potential future enhancements)

## Implementation Details

The system uses a text-based approach to extract serial numbers:

1. `PDFProcessingService`: Handles the PDF document processing and page extraction
2. `TextExtractionService`: Uses regex patterns to extract serial numbers from text
3. `PrintService`: Manages the extraction and printing of specific pages

The system focuses on finding serial numbers using text patterns rather than barcode/image detection, avoiding complex dependencies like poppler or zbar.

## Regex Patterns

The following patterns are used to extract serial numbers:

- Standard S/N format: `S/N: EA1234567890`
- EAN format: `EAN: 1234567890123`
- Quantity with S/N: `QTY (01) ... S/N: EA12345...`
- Part Number: `(P) PN: 4729382A`
- Revision Number: `REV/123` or `REV:A12`
- Generic S/N patterns for maximum compatibility

Additional patterns can be added to the `TextExtractionService` class to support different label formats.
