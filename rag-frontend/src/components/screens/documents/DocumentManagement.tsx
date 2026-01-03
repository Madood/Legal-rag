import { useState } from 'react';
import { FileText, Upload, Eye, CheckCircle, XCircle, Clock, Trash2, Download } from 'lucide-react';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Progress } from '../../ui/progress';
import './DocumentManagement.css';

interface Document {
  id: string;
  name: string;
  uploadDate: Date;
  pages: number;
  chunks: number;
  processingTime: string;
  status: 'completed' | 'processing' | 'error';
  size: string;
  type: string;
}

const mockDocuments: Document[] = [
  {
    id: '1',
    name: 'BGB_§535_Mietvertrag.pdf',
    uploadDate: new Date(2024, 11, 1),
    pages: 8,
    chunks: 24,
    processingTime: '2.3s',
    status: 'completed',
    size: '1.2 MB',
    type: 'Gesetz',
  },
  {
    id: '2',
    name: 'Kommentar_Mietrecht_2024.pdf',
    uploadDate: new Date(2024, 11, 2),
    pages: 342,
    chunks: 1024,
    processingTime: '45.7s',
    status: 'completed',
    size: '15.8 MB',
    type: 'Kommentar',
  },
  {
    id: '3',
    name: 'BGH_Urteil_VIII_ZR_123_23.pdf',
    uploadDate: new Date(2024, 11, 3),
    pages: 15,
    chunks: 45,
    processingTime: '4.1s',
    status: 'completed',
    size: '2.3 MB',
    type: 'Urteil',
  },
  {
    id: '4',
    name: 'Arbeitsrecht_Grundlagen.pdf',
    uploadDate: new Date(2024, 11, 4),
    pages: 0,
    chunks: 0,
    processingTime: '-',
    status: 'processing',
    size: '8.5 MB',
    type: 'Lehrbuch',
  },
];

export function DocumentManagement() {
  const [documents, setDocuments] = useState<Document[]>(mockDocuments);

  const handleDelete = (id: string) => {
    setDocuments(documents.filter((doc) => doc.id !== id));
  };

  const getStatusIcon = (status: Document['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="status-icon status-icon-completed" />;
      case 'processing':
        return <Clock className="status-icon status-icon-processing" />;
      case 'error':
        return <XCircle className="status-icon status-icon-error" />;
    }
  };

  const getStatusBadge = (status: Document['status']) => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="status-badge status-badge-completed">Verarbeitet</Badge>
        );
      case 'processing':
        return (
          <Badge className="status-badge status-badge-processing">In Bearbeitung</Badge>
        );
      case 'error':
        return <Badge className="status-badge status-badge-error">Fehler</Badge>;
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const totalPages = documents.reduce((acc, doc) => acc + doc.pages, 0);
  const totalChunks = documents.reduce((acc, doc) => acc + doc.chunks, 0);
  const completedDocuments = documents.filter((d) => d.status === 'completed').length;

  return (
    <div className="document-management">
      <div className="management-container">
        {/* Header */}
        <div className="management-header">
          <div className="header-content">
            <h1 className="management-title">
              Dokumentenverwaltung
            </h1>
            <p className="management-subtitle">
              Laden Sie Rechtsdokumente hoch und verwalten Sie Ihre Wissensdatenbank
            </p>
          </div>
          <Button className="upload-button">
            <Upload className="upload-icon" />
            Dokument hochladen
          </Button>
        </div>

        {/* Stats */}
        <div className="stats-grid">
          <Card className="stat-card">
            <div className="stat-card-content">
              <div>
                <p className="stat-label">Dokumente</p>
                <p className="stat-value">
                  {documents.length}
                </p>
              </div>
              <FileText className="stat-icon stat-icon-blue" />
            </div>
          </Card>

          <Card className="stat-card">
            <div className="stat-card-content">
              <div>
                <p className="stat-label">Gesamtseiten</p>
                <p className="stat-value">
                  {totalPages}
                </p>
              </div>
              <FileText className="stat-icon stat-icon-green" />
            </div>
          </Card>

          <Card className="stat-card">
            <div className="stat-card-content">
              <div>
                <p className="stat-label">Chunks</p>
                <p className="stat-value">
                  {totalChunks}
                </p>
              </div>
              <FileText className="stat-icon stat-icon-orange" />
            </div>
          </Card>

          <Card className="stat-card">
            <div className="stat-card-content">
              <div>
                <p className="stat-label">Verarbeitet</p>
                <p className="stat-value">
                  {completedDocuments}
                </p>
              </div>
              <CheckCircle className="stat-icon stat-icon-green" />
            </div>
          </Card>
        </div>

        {/* Document Grid */}
        <div className="documents-grid">
          {documents.map((doc) => (
            <Card
              key={doc.id}
              className="document-card"
            >
              {/* Document Thumbnail */}
              <div className="document-thumbnail">
                <FileText className="thumbnail-icon" />
              </div>

              {/* Document Info */}
              <div className="document-content">
                <div className="document-header">
                  <div className="document-info">
                    <h3 className="document-name">
                      {doc.name}
                    </h3>
                    <p className="document-date">
                      {formatDate(doc.uploadDate)}
                    </p>
                  </div>
                  {getStatusIcon(doc.status)}
                </div>

                <div className="document-badges">
                  <Badge variant="secondary" className="type-badge">
                    {doc.type}
                  </Badge>
                  {getStatusBadge(doc.status)}
                </div>

                {doc.status === 'processing' && (
                  <div className="processing-section">
                    <Progress value={65} className="processing-progress" />
                    <p className="processing-text">
                      Verarbeite Chunks...
                    </p>
                  </div>
                )}

                {doc.status === 'completed' && (
                  <div className="document-metrics">
                    <div className="metric-item">
                      <p className="metric-label">Seiten</p>
                      <p className="metric-value">{doc.pages}</p>
                    </div>
                    <div className="metric-item">
                      <p className="metric-label">Chunks</p>
                      <p className="metric-value">{doc.chunks}</p>
                    </div>
                    <div className="metric-item">
                      <p className="metric-label">Zeit</p>
                      <p className="metric-value">{doc.processingTime}</p>
                    </div>
                  </div>
                )}

                <p className="document-size">
                  Größe: {doc.size}
                </p>

                {/* Actions */}
                <div className="document-actions">
                  <Button
                    variant="outline"
                    size="sm"
                    className="view-button"
                    disabled={doc.status !== 'completed'}
                  >
                    <Eye className="view-icon" />
                    Öffnen
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="delete-button"
                    onClick={() => handleDelete(doc.id)}
                  >
                    <Trash2 className="delete-icon" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}

          {/* Upload Card */}
          <Card className="upload-prompt-card">
            <div className="upload-prompt-content">
              <div className="upload-prompt-icon">
                <Upload className="upload-prompt-icon-inner" />
              </div>
              <h3 className="upload-prompt-title">
                Neues Dokument hochladen
              </h3>
              <p className="upload-prompt-subtitle">
                PDF, DOCX oder TXT
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}