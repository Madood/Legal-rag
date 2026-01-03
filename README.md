# Legal RAG System

A sophisticated Retrieval-Augmented Generation system for German legal documents with authority-based classification.

## 🏛️ Features

- **Statute-First Architecture**: Automatically detects and locks to specific German statutes
- **Authority Classification**: Classifies legal documents by authority level and source type
- **Multi-Service Integration**: 
  - Node.js backend for document processing and RAG
  - Python FastAPI service for authoritative search
  - TF-IDF and embedding-based retrieval
- **Safety and Validation**: Judicial validation and safety checks for legal accuracy
- **Professional Legal Responses**: Structured answers with proper citations and authority context

## 📁 Project Structure

\\\
Legal-Rag/
├── Backend/              # Node.js backend
│   ├── services/        # Core services (RAG, PDF processing, chat)
│   ├── New/            # Authority classification modules
│   ├── documents/      # PDF legal documents
│   └── index.js        # Main server
├── Python/             # FastAPI Python service
│   ├── app/
│   │   ├── api/       # API endpoints
│   │   └── services/  # Embedding and retrieval services
│   └── requirements.txt
└── Frontend/          # React frontend (if applicable)
\\\

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ 
- Python 3.8+
- npm/yarn
- Git

### Installation

1. **Clone the repository:**
   \\\ash
   git clone https://github.com/Madood/Legal-rag.git
   cd Legal-rag
   \\\

2. **Backend Setup:**
   \\\ash
   cd Backend
   npm install
   # Copy environment variables
   cp .env.example .env
   \\\

3. **Python Service Setup:**
   \\\ash
   cd Python
   pip install -r requirements.txt
   \\\

4. **Add Legal Documents:**
   - Place German legal PDFs in \Backend/documents/\
   - Supported statutes: StGB, BGB, HGB, GG, EU-GDPR

### Running the System

1. **Start Node.js Backend:**
   \\\ash
   cd Backend
   npm start
   \\\

2. **Start Python Service:**
   \\\ash
   cd Python
   python -m uvicorn main:app --reload --port 5000
   \\\

3. **Access the API:**
   - Backend: \http://localhost:3001\
   - Python Service: \http://localhost:5000\
   - API Documentation: \http://localhost:3001/api-docs\

## 📚 Supported Legal Areas

- **Criminal Law**: Strafgesetzbuch (StGB)
- **Civil Law**: Bürgerliches Gesetzbuch (BGB)
- **Commercial Law**: Handelsgesetzbuch (HGB)
- **Constitutional Law**: Grundgesetz (GG)
- **Data Protection**: EU-GDPR/DSGVO
- **Legal Doctrines**: Schuldprinzip, Verhältnismäßigkeitsprinzip, etc.

## 🔧 Configuration

### Authority Classification
The system classifies documents by:
- **Authority Rank**: 1-10 scale (1 = highest authority)
- **Source Type**: PRIMARY_LEGISLATION, CONSTITUTION, EU_REGULATION, etc.
- **Normative Content**: Whether content contains legal norms

### RAG Settings
- Chunk size: 600-800 characters
- Similarity threshold: 0.15-0.25
- Max results: 5-30 depending on query type
- Authority weighting: Official texts prioritized

## 🛡️ Safety Features

- Judicial validation of answers
- Statute-specific requirement checking
- Clarification requests for ambiguous questions
- Safety scoring (0-100 scale)
- Logging for all processed questions

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- German legal text processing
- Authority classification algorithms
- Multi-service RAG architecture
