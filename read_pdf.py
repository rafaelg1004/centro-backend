import PyPDF2

pdf_path = "Resolución No 2275 de 2023.pdf"
try:
    with open(pdf_path, 'rb') as file:
        reader = PyPDF2.PdfReader(file)
        text = ""
        for i in range(min(10, len(reader.pages))): # Read first 10 pages
            text += reader.pages[i].extract_text()
        print(text[:2000]) # Print first 2000 chars to see what it's about
except Exception as e:
    print("Error:", e)
