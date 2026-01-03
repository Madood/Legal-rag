import { useState } from 'react';
import { Settings, Cpu, Sliders, Database, FileCode, Save, RotateCcw, Zap, Sparkles, Shield, ChevronRight } from 'lucide-react';
import { Card } from '../../ui/card';
import { Label } from '../../ui/label';
import { Slider } from '../../ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Switch } from '../../ui/switch';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import './SettingsPanel.css';

export function SettingsPanel() {
  const [temperature, setTemperature] = useState([0.3]);
  const [topK, setTopK] = useState([5]);
  const [chunkSize, setChunkSize] = useState([512]);
  const [chunkOverlap, setChunkOverlap] = useState([50]);
  const [hybridSearch, setHybridSearch] = useState(true);
  const [reranking, setReranking] = useState(true);
  const [citationMode, setCitationMode] = useState(true);
  const [confidenceThreshold, setConfidenceThreshold] = useState(true);
  const [queryLogging, setQueryLogging] = useState(true);
  const [preserveStructure, setPreserveStructure] = useState(true);

  const handleReset = () => {
    setTemperature([0.3]);
    setTopK([5]);
    setChunkSize([512]);
    setChunkOverlap([50]);
    setHybridSearch(true);
    setReranking(true);
    setCitationMode(true);
    setConfidenceThreshold(true);
    setQueryLogging(true);
    setPreserveStructure(true);
  };

  const handleSave = () => {
    const settings = {
      temperature: temperature[0],
      topK: topK[0],
      chunkSize: chunkSize[0],
      chunkOverlap: chunkOverlap[0],
      hybridSearch,
      reranking,
      citationMode,
      confidenceThreshold,
      queryLogging,
      preserveStructure
    };
    
    localStorage.setItem('rag-settings', JSON.stringify(settings));
    alert('Einstellungen wurden gespeichert!');
  };

  const handleQuickPreset = (preset: 'balanced' | 'accurate' | 'creative') => {
    switch(preset) {
      case 'balanced':
        setTemperature([0.3]);
        setTopK([5]);
        break;
      case 'accurate':
        setTemperature([0.1]);
        setTopK([3]);
        break;
      case 'creative':
        setTemperature([0.7]);
        setTopK([8]);
        break;
    }
  };

  return (
    <div className="settings-panel">
      <div className="settings-container">
        {/* Enhanced Header */}
        <div className="settings-header">
          <div className="header-content">
            <div className="header-title-section">
              <div className="title-icon-container">
                <Settings className="title-icon" />
              </div>
              <div>
                <h1 className="settings-title">
                  System Einstellungen
                </h1>
                <p className="settings-subtitle">
                  Konfigurieren Sie das RAG-System für optimale Performance
                </p>
              </div>
            </div>
            <Badge variant="outline" className="settings-badge">
              <Zap className="w-3 h-3 mr-1" />
              Live Preview
            </Badge>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="presets-section">
          <div className="presets-header">
            <h3 className="presets-title">Schnelle Voreinstellungen</h3>
            <p className="presets-subtitle">Wählen Sie eine vorkonfigurierte Option für Ihre Anwendung</p>
          </div>
          <div className="presets-grid">
            <button 
              className="preset-card balanced"
              onClick={() => handleQuickPreset('balanced')}
            >
              <div className="preset-icon">
                <Sparkles className="w-4 h-4" />
              </div>
              <h4 className="preset-name">Ausgeglichen</h4>
              <p className="preset-description">Optimale Balance für allgemeine Anfragen</p>
              <ChevronRight className="preset-arrow" />
            </button>
            
            <button 
              className="preset-card accurate"
              onClick={() => handleQuickPreset('accurate')}
            >
              <div className="preset-icon">
                <Shield className="w-4 h-4" />
              </div>
              <h4 className="preset-name">Präzise</h4>
              <p className="preset-description">Höchste Genauigkeit und Faktenüberprüfung</p>
              <ChevronRight className="preset-arrow" />
            </button>
            
            <button 
              className="preset-card creative"
              onClick={() => handleQuickPreset('creative')}
            >
              <div className="preset-icon">
                <Sparkles className="w-4 h-4" />
              </div>
              <h4 className="preset-name">Kreativ</h4>
              <p className="preset-description">Für Brainstorming und ideenreiche Antworten</p>
              <ChevronRight className="preset-arrow" />
            </button>
          </div>
        </div>

        {/* Settings Content */}
        <div className="settings-content">
          {/* Model Configuration */}
          <Card className="settings-card enhanced">
            <div className="card-header-gradient">
              <div className="settings-card-header">
                <div className="settings-icon-container model-icon">
                  <Cpu className="settings-icon model-icon-inner" />
                </div>
                <div>
                  <h2 className="settings-card-title">Modellkonfiguration</h2>
                  <p className="settings-card-subtitle">
                    LLM und Embedding Einstellungen
                  </p>
                </div>
              </div>
            </div>

            <div className="settings-fields">
              <div className="setting-field-group">
                <div className="setting-field">
                  <Label htmlFor="llm-model" className="field-label">
                    <span>Sprachmodell</span>
                    <Badge variant="secondary" className="ml-2">Empfohlen</Badge>
                  </Label>
                  <Select defaultValue="gpt-4">
                    <SelectTrigger id="llm-model" className="settings-select enhanced">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="select-content enhanced">
                      <SelectItem value="gpt-4">
                        <div className="select-item-content">
                          <span>GPT-4</span>
                          <Badge variant="outline" className="ml-2">Premium</Badge>
                        </div>
                      </SelectItem>
                      <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                      <SelectItem value="gpt-3.5">GPT-3.5 Turbo</SelectItem>
                      <SelectItem value="claude-3">Claude 3 Opus</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="setting-field">
                  <Label htmlFor="embedding-model" className="field-label">
                    Embedding Modell
                  </Label>
                  <Select defaultValue="e5-large">
                    <SelectTrigger id="embedding-model" className="settings-select enhanced">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="select-content enhanced">
                      <SelectItem value="e5-large">
                        <div className="select-item-content">
                          <span>multilingual-e5-large</span>
                          <Badge variant="outline" className="ml-2">Multilingual</Badge>
                        </div>
                      </SelectItem>
                      <SelectItem value="e5-base">multilingual-e5-base</SelectItem>
                      <SelectItem value="text-embedding-3">text-embedding-3-large</SelectItem>
                      <SelectItem value="german-bert">German BERT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="setting-field">
                <div className="slider-header">
                  <Label htmlFor="temperature" className="field-label">
                    Temperatur
                  </Label>
                  <div className="slider-value-container">
                    <span className="slider-value">
                      {temperature[0].toFixed(1)}
                    </span>
                    <div className="slider-labels">
                      <span className="slider-label-min">Präzise</span>
                      <span className="slider-label-max">Kreativ</span>
                    </div>
                  </div>
                </div>
                <Slider
                  id="temperature"
                  value={temperature}
                  onValueChange={setTemperature}
                  min={0}
                  max={1}
                  step={0.1}
                  className="settings-slider enhanced"
                />
              </div>
            </div>
          </Card>

          {/* Retrieval Configuration */}
          <Card className="settings-card enhanced">
            <div className="card-header-gradient">
              <div className="settings-card-header">
                <div className="settings-icon-container retrieval-icon">
                  <Database className="settings-icon retrieval-icon-inner" />
                </div>
                <div>
                  <h2 className="settings-card-title">Retrieval Konfiguration</h2>
                  <p className="settings-card-subtitle">
                    Vektordatenbank und Suchparameter
                  </p>
                </div>
              </div>
            </div>

            <div className="settings-fields">
              <div className="setting-field">
                <Label htmlFor="vector-db" className="field-label">
                  Vektordatenbank
                </Label>
                <Select defaultValue="pinecone">
                  <SelectTrigger id="vector-db" className="settings-select enhanced">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="select-content enhanced">
                    <SelectItem value="pinecone">Pinecone</SelectItem>
                    <SelectItem value="weaviate">Weaviate</SelectItem>
                    <SelectItem value="qdrant">Qdrant</SelectItem>
                    <SelectItem value="chroma">ChromaDB</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="setting-field">
                <div className="slider-header">
                  <Label htmlFor="top-k" className="field-label">
                    Top-K Ergebnisse
                  </Label>
                  <span className="slider-value">
                    {topK[0]}
                  </span>
                </div>
                <Slider
                  id="top-k"
                  value={topK}
                  onValueChange={setTopK}
                  min={1}
                  max={20}
                  step={1}
                  className="settings-slider enhanced"
                />
              </div>

              <div className="setting-field">
                <Label htmlFor="similarity-metric" className="field-label">
                  Ähnlichkeitsmetrik
                </Label>
                <Select defaultValue="cosine">
                  <SelectTrigger id="similarity-metric" className="settings-select enhanced">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="select-content enhanced">
                    <SelectItem value="cosine">Cosine Similarity</SelectItem>
                    <SelectItem value="euclidean">Euclidean Distance</SelectItem>
                    <SelectItem value="dot-product">Dot Product</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="setting-switch-group">
                <div className="setting-switch enhanced">
                  <div className="switch-label">
                    <Label htmlFor="hybrid-search" className="field-label">
                      Hybrid Search
                    </Label>
                    <p className="switch-description">
                      Kombiniert semantische und Keyword-Suche für bessere Ergebnisse
                    </p>
                  </div>
                  <Switch 
                    id="hybrid-search" 
                    checked={hybridSearch}
                    onCheckedChange={setHybridSearch}
                    className="switch-control enhanced"
                  />
                </div>

                <div className="setting-switch enhanced">
                  <div className="switch-label">
                    <Label htmlFor="reranking" className="field-label">
                      Re-Ranking aktivieren
                    </Label>
                    <p className="switch-description">
                      Verbessert Relevanz durch Cross-Encoder
                    </p>
                  </div>
                  <Switch 
                    id="reranking" 
                    checked={reranking}
                    onCheckedChange={setReranking}
                    className="switch-control enhanced"
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Chunking Strategy */}
          <Card className="settings-card enhanced">
            <div className="card-header-gradient">
              <div className="settings-card-header">
                <div className="settings-icon-container chunking-icon">
                  <FileCode className="settings-icon chunking-icon-inner" />
                </div>
                <div>
                  <h2 className="settings-card-title">Chunking Strategie</h2>
                  <p className="settings-card-subtitle">
                    Textaufteilung und Verarbeitung
                  </p>
                </div>
              </div>
            </div>

            <div className="settings-fields">
              <div className="setting-field">
                <Label htmlFor="chunking-method" className="field-label">
                  Chunking Methode
                </Label>
                <Select defaultValue="semantic">
                  <SelectTrigger id="chunking-method" className="settings-select enhanced">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="select-content enhanced">
                    <SelectItem value="semantic">Semantische Trennung</SelectItem>
                    <SelectItem value="fixed-size">Feste Größe</SelectItem>
                    <SelectItem value="sentence">Satzbasiert</SelectItem>
                    <SelectItem value="paragraph">Absatzbasiert</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="setting-field">
                <Label htmlFor="chunk-size" className="field-label">
                  Chunk Größe
                </Label>
                <div className="slider-header">
                  <span className="slider-value-large">
                    {chunkSize[0]} Tokens
                  </span>
                </div>
                <Slider
                  id="chunk-size"
                  value={chunkSize}
                  onValueChange={setChunkSize}
                  min={128}
                  max={2048}
                  step={128}
                  className="settings-slider enhanced"
                />
                <div className="slider-marks">
                  <span>Klein</span>
                  <span>Mittel</span>
                  <span>Groß</span>
                </div>
              </div>

              <div className="setting-field">
                <Label htmlFor="chunk-overlap" className="field-label">
                  Chunk Überlappung
                </Label>
                <div className="slider-header">
                  <span className="slider-value-large">
                    {chunkOverlap[0]}%
                  </span>
                </div>
                <Slider
                  id="chunk-overlap"
                  value={chunkOverlap}
                  onValueChange={setChunkOverlap}
                  min={0}
                  max={50}
                  step={5}
                  className="settings-slider enhanced"
                />
              </div>

              <div className="setting-switch-group">
                <div className="setting-switch enhanced">
                  <div className="switch-label">
                    <Label htmlFor="preserve-structure" className="field-label">
                      Strukturerhaltung
                    </Label>
                    <p className="switch-description">
                      Respektiert Paragraphen und Absätze
                    </p>
                  </div>
                  <Switch 
                    id="preserve-structure" 
                    checked={preserveStructure}
                    onCheckedChange={setPreserveStructure}
                    className="switch-control enhanced"
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Advanced Settings */}
          <Card className="settings-card enhanced">
            <div className="card-header-gradient">
              <div className="settings-card-header">
                <div className="settings-icon-container advanced-icon">
                  <Sliders className="settings-icon advanced-icon-inner" />
                </div>
                <div>
                  <h2 className="settings-card-title">Erweiterte Einstellungen</h2>
                  <p className="settings-card-subtitle">
                    Zusätzliche Optionen für Experten
                  </p>
                </div>
              </div>
            </div>

            <div className="settings-fields">
              <div className="setting-switch-group">
                <div className="setting-switch enhanced">
                  <div className="switch-label">
                    <Label htmlFor="citation-mode" className="field-label">
                      Zitationsmodus
                    </Label>
                    <p className="switch-description">
                      Zeigt Quellen für jede Antwort mit Konfidenzscores
                    </p>
                  </div>
                  <Switch 
                    id="citation-mode" 
                    checked={citationMode}
                    onCheckedChange={setCitationMode}
                    className="switch-control enhanced" 
                  />
                </div>

                <div className="setting-switch enhanced">
                  <div className="switch-label">
                    <Label htmlFor="confidence-threshold" className="field-label">
                      Konfidenz-Schwellenwert
                    </Label>
                    <p className="switch-description">
                      Filtert Ergebnisse mit niedriger Konfidenz (&lt; 0.8)
                    </p>
                  </div>
                  <Switch 
                    id="confidence-threshold" 
                    checked={confidenceThreshold}
                    onCheckedChange={setConfidenceThreshold}
                    className="switch-control enhanced" 
                  />
                </div>

                <div className="setting-switch enhanced">
                  <div className="switch-label">
                    <Label htmlFor="query-logging" className="field-label">
                      Query Logging
                    </Label>
                    <p className="switch-description">
                      Speichert Anfragen für Analytics und Verbesserungen
                    </p>
                  </div>
                  <Switch 
                    id="query-logging" 
                    checked={queryLogging}
                    onCheckedChange={setQueryLogging}
                    className="switch-control enhanced" 
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Enhanced Actions */}
          <div className="settings-actions enhanced">
            <Button 
              variant="outline" 
              onClick={handleReset} 
              className="reset-button enhanced"
              size="lg"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Alle zurücksetzen
            </Button>
            <Button 
              onClick={handleSave} 
              className="save-settings-button enhanced"
              size="lg"
            >
              <Save className="w-4 h-4 mr-2" />
              Änderungen speichern
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}