import os
import sys
import time
import math
import requests
from pypdf import PdfReader
from supabase import create_client

# ============================================================
# BioBridge - One-time Master PDF Indexer
# ============================================================
# Put BioBridge_Client_Master_Knowledge.pdf in this same folder.
#
# Install once:
#   pip install pypdf supabase requests
#
# Then set these in your terminal before running:
#   set SUPABASE_URL=https://zizkizjifziszakrvnac.supabase.co
#   set SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
#   set HF_API_KEY=YOUR_HUGGINGFACE_TOKEN
#
# Run:
#   python index_master.py
#
# IMPORTANT:
# Use the Supabase SERVICE ROLE key here ONLY on your own PC.
# Never put it in the React .env or commit this script with the key.
# ============================================================

PDF_FILE = "BioBridge_Client_Master_Knowledge.pdf"
EMBEDDING_MODEL = "BAAI/bge-base-en-v1.5"
CHUNK_SIZE = 1800
CHUNK_OVERLAP = 250
BATCH_SIZE = 8

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip()
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
HF_API_KEY = os.environ.get("HF_API_KEY", "").strip()

if not SUPABASE_URL or not SERVICE_KEY or not HF_API_KEY:
    print("\nMissing environment variables.")
    print("Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and HF_API_KEY first.\n")
    sys.exit(1)

if not os.path.exists(PDF_FILE):
    print(f"\nCannot find: {PDF_FILE}")
    print("Put the PDF in the same folder as this script.\n")
    sys.exit(1)

sb = create_client(SUPABASE_URL, SERVICE_KEY)

def extract_pdf():
    print("1/4 Reading PDF...")
    reader = PdfReader(PDF_FILE)
    pages = []
    for i, page in enumerate(reader.pages, 1):
        try:
            text = page.extract_text() or ""
        except Exception:
            text = ""
        if text.strip():
            pages.append(f"\n[PDF PAGE {i}]\n{text}")
        if i % 50 == 0:
            print(f"   Read {i}/{len(reader.pages)} pages...")
    text = "\n".join(pages).strip()
    if not text:
        raise RuntimeError("No readable text was extracted from the PDF.")
    print(f"   Extracted {len(text):,} characters from {len(reader.pages)} pages.")
    return text

def chunk_text(text):
    print("2/4 Creating chunks...")
    text = text.replace("\r\n", "\n").replace("\x00", "").strip()
    chunks = []
    start = 0

    while start < len(text):
        end = min(start + CHUNK_SIZE, len(text))

        if end < len(text):
            candidates = [
                text.rfind("\n\n", start, end),
                text.rfind(". ", start, end),
                text.rfind(" ", start, end),
            ]
            boundary = max(candidates)
            if boundary > start + int(CHUNK_SIZE * 0.60):
                end = boundary + 1

        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)

        if end >= len(text):
            break

        start = max(end - CHUNK_OVERLAP, start + 1)

    print(f"   Created {len(chunks):,} chunks.")
    return chunks

def normalize_vectors(result):
    # HF may return:
    # 1) [dim]
    # 2) [[dim]]
    # 3) [[token_dim], [token_dim], ...] for token embeddings
    if not isinstance(result, list):
        raise RuntimeError(f"Unexpected embedding response: {type(result)}")

    if len(result) == 768 and all(isinstance(x, (int, float)) for x in result):
        return [float(x) for x in result]

    if len(result) == 1 and isinstance(result[0], list):
        inner = result[0]
        if len(inner) == 768 and all(isinstance(x, (int, float)) for x in inner):
            return [float(x) for x in inner]

    if result and isinstance(result[0], list):
        token_vectors = result
        dim = len(token_vectors[0])
        if dim != 768:
            raise RuntimeError(f"HF returned token vectors with dimension {dim}, expected 768.")
        pooled = [0.0] * dim
        count = 0
        for token in token_vectors:
            if len(token) != dim:
                continue
            for j, value in enumerate(token):
                pooled[j] += float(value)
            count += 1
        if count == 0:
            raise RuntimeError("No valid token vectors returned.")
        pooled = [x / count for x in pooled]
        magnitude = math.sqrt(sum(x * x for x in pooled))
        if magnitude:
            pooled = [x / magnitude for x in pooled]
        return pooled

    raise RuntimeError("Could not convert Hugging Face response to a 768-dimensional vector.")

def embed_batch(texts):
    url = f"https://router.huggingface.co/hf-inference/models/{EMBEDDING_MODEL}"
    response = requests.post(
        url,
        headers={
            "Authorization": f"Bearer {HF_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "inputs": texts,
            "options": {"wait_for_model": True},
        },
        timeout=180,
    )

    if not response.ok:
        raise RuntimeError(
            f"Hugging Face error {response.status_code}: {response.text[:1000]}"
        )

    result = response.json()

    # Batched response should be a list of embeddings.
    if isinstance(result, list) and result and isinstance(result[0], list):
        # If each item is a 768-vector, use directly.
        if len(result[0]) == 768 and all(isinstance(x, (int, float)) for x in result[0]):
            return [[float(x) for x in v] for v in result]

        # If each item contains token vectors, normalize individually.
        return [normalize_vectors(item) for item in result]

    # Fallback for a single-item response.
    return [normalize_vectors(result)]

def main():
    text = extract_pdf()
    chunks = chunk_text(text)

    print("3/4 Creating embeddings and uploading to Supabase...")
    print(f"   Batch size: {BATCH_SIZE}")

    # Create one document record.
    doc_result = (
        sb.table("documents")
        .insert({
            "filename": PDF_FILE,
            "file_type": "pdf",
            "content": text,
            "char_count": len(text),
        })
        .execute()
    )

    if not doc_result.data:
        raise RuntimeError(f"Could not create document record: {doc_result}")

    document_id = doc_result.data[0]["id"]
    print(f"   Document ID: {document_id}")

    total = len(chunks)

    try:
        for start in range(0, total, BATCH_SIZE):
            batch = chunks[start:start + BATCH_SIZE]
            vectors = embed_batch(batch)

            if len(vectors) != len(batch):
                raise RuntimeError(
                    f"Expected {len(batch)} embeddings, got {len(vectors)}."
                )

            rows = []
            for offset, (chunk, vector) in enumerate(zip(batch, vectors)):
                if len(vector) != 768:
                    raise RuntimeError(
                        f"Chunk {start + offset} has {len(vector)} dimensions, expected 768."
                    )
                rows.append({
                    "document_id": document_id,
                    "chunk_index": start + offset,
                    "content": chunk,
                    "embedding": vector,
                })

            sb.table("document_chunks").insert(rows).execute()

            done = min(start + len(batch), total)
            percent = done / total * 100
            print(f"   {done}/{total} chunks ({percent:.1f}%)")

    except Exception:
        print("\nIndexing failed. Removing the partially-created document...")
        try:
            sb.table("documents").delete().eq("id", document_id).execute()
        except Exception:
            pass
        raise

    print("\n4/4 COMPLETE!")
    print(f"Indexed {total:,} chunks into Supabase.")
    print(f"Document ID: {document_id}")
    print("\nNow the web app does NOT need to upload this PDF.")
    print("It only needs to query the existing knowledge base.")

if __name__ == "__main__":
    main()