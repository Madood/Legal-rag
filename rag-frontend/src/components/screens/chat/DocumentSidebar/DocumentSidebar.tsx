// src/components/DocumentSidebar/DocumentSidebar.tsx - UPDATED
import { useState } from 'react';
import { FileText, ChevronRight, ChevronDown, MapPin, Loader2 } from 'lucide-react';
import { ScrollArea } from '../../../ui/scroll-area';
import { Badge } from '../../../ui/badge';
import { Document } from '../../../../services/api';
import { useTranslation } from '../../../../i18n';
import './DocumentSidebar.css';

interface Section {
  id: string;
  title: string;
  page: number;
  chunks: number[];
}

interface DocumentSidebarProps {
  onCitationClick: (citation: any) => void;
  documents: Document[];
  isLoading: boolean;
}

export function DocumentSidebar({ onCitationClick, documents, isLoading }: DocumentSidebarProps) {
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const { t } = useTranslation();

  const toggleDocument = (docId: string) => {
    const newExpanded = new Set(expandedDocs);
    if (newExpanded.has(docId)) {
      newExpanded.delete(docId);
    } else {
      newExpanded.add(docId);
    }
    setExpandedDocs(newExpanded);
  };

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const handleChunkClick = (chunkNum: number, documentName: string) => {
    onCitationClick({ 
      chunkId: `chunk-${chunkNum}`,
      documentName: documentName
    });
  };

  // Transform documents to include sections (simplified for now)
  const getDocumentSections = (doc: Document): Section[] => {
    // This is a simplified version - you'll need to map actual sections
    return [
      { id: 's1', title: doc.title, page: 1, chunks: [1, 2, 3] },
      { id: 's2', title: 'Relevant Sections', page: 2, chunks: [4, 5, 6] },
    ];
  };

  if (isLoading) {
    return (
      <div className="document-sidebar">
        <div className="sidebar-header">
          <h2 className="sidebar-title">{t('sidebar.documents')}</h2>
        </div>
        <div className="loading-container">
          <Loader2 className="animate-spin" />
          <p>{t('sidebar.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="document-sidebar">
      <div className="sidebar-header">
        <h2 className="sidebar-title">{t('sidebar.documents')}</h2>
        <p className="sidebar-subtitle">
          {documents.length} {t('sidebar.loaded')}
        </p>
      </div>

      <ScrollArea className="sidebar-scroll-area">
        <div className="documents-list">
          {documents.map((doc) => {
            const sections = getDocumentSections(doc);
            
            return (
              <div key={doc.id} className="document-card">
                {/* Document Header */}
                <button
                  onClick={() => toggleDocument(doc.id)}
                  className="document-header-button"
                >
                  {expandedDocs.has(doc.id) ? (
                    <ChevronDown className="chevron-icon" />
                  ) : (
                    <ChevronRight className="chevron-icon" />
                  )}
                  <FileText className="document-icon" />
                  <div className="document-info">
                    <p className="document-name">
                      {doc.title || doc.filename}
                    </p>
                    <div className="document-badges">
                      <Badge variant="secondary" className="document-badge">
                        {doc.pages} {t('sidebar.pages')}
                      </Badge>
                      <Badge 
                        variant={doc.type === 'civil_code' ? 'default' : 'outline'}
                        className="document-badge"
                      >
                        {doc.type}
                      </Badge>
                    </div>
                  </div>
                </button>

                {/* Table of Contents */}
                {expandedDocs.has(doc.id) && sections.length > 0 && (
                  <div className="document-sections">
                    {sections.map((section) => (
                      <div key={section.id} className="section-container">
                        <button
                          onClick={() => toggleSection(section.id)}
                          className="section-button"
                        >
                          {expandedSections.has(section.id) ? (
                            <ChevronDown className="section-chevron" />
                          ) : (
                            <ChevronRight className="section-chevron" />
                          )}
                          <div className="section-info">
                            <p className="section-title">
                              {section.title}
                            </p>
                            <p className="section-page">{t('sidebar.page')} {section.page}</p>
                          </div>
                        </button>

                        {/* Chunk Markers */}
                        {expandedSections.has(section.id) && (
                          <div className="chunk-markers-container">
                            <div className="chunk-markers">
                              {section.chunks.map((chunkNum) => (
                                <button
                                  key={chunkNum}
                                  onClick={() => handleChunkClick(chunkNum, doc.filename)}
                                  className="chunk-button"
                                  title={`Chunk ${chunkNum}`}
                                >
                                  {chunkNum}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {documents.length === 0 && (
            <div className="empty-documents">
              <p>{t('sidebar.noDocuments')}</p>
              <p className="empty-documents-hint">
                {t('sidebar.uploadHint')}
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}