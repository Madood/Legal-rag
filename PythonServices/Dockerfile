FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
# Use PyTorch CPU-only wheel index to avoid pulling ~1.5 GB of CUDA libraries
# (nvidia_cublas, nvidia_cuda_runtime, etc.) that serve no purpose in a container
RUN pip install --no-cache-dir -r requirements.txt \
    --extra-index-url https://download.pytorch.org/whl/cpu
# Pre-download the embedding model into the image layer so startup is fast.
# Without this, the model downloads (~420 MB) on every cold start.
RUN python -c "from sentence_transformers import SentenceTransformer; \
    SentenceTransformer('sentence-transformers/paraphrase-multilingual-mpnet-base-v2')"
COPY . .
EXPOSE 8000
CMD ["python", "main.py"]
