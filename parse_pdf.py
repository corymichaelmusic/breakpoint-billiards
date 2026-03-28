import sys
try:
    from pypdf import PdfReader
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pypdf"])
    from pypdf import PdfReader

def extract(path):
    reader = PdfReader(path)
    text = ""
    for page in reader.pages:
        text += page.extract_text() + "\n"
    print(f"--- {path} ---")
    print(text[:1000])
    with open(path.replace('.pdf', '.txt'), 'w', encoding='utf-8') as f:
        f.write(text)
    print(f"Saved to {path.replace('.pdf', '.txt')}")

extract('documents/OFFICIAL BY LAWS_ BREAKPOINT BILLIARDS LEAGUE.pdf')
extract('documents/Breakpoint International Standard (BIS).pdf')
