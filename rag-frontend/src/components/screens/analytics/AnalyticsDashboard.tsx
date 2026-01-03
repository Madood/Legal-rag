import { useState } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  MessageSquare, 
  FileText, 
  Activity, 
  Users,
  Download,
  Calendar,
  PieChart as PieChartIcon,
  History
} from 'lucide-react';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { ScrollArea } from '../../ui/scroll-area';
import { Button } from '../../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from 'recharts';
import './AnalyticsDashboard.css';

interface QueryVolumeData {
  date: string;
  queries: number;
  documents: number;
}

interface ResponseTimeData {
  date: string;
  time: number;
  target: number;
}

interface CategoryData {
  name: string;
  value: number;
  color: string;
}

interface QueryHistoryItem {
  id: string;
  query: string;
  timestamp: Date;
  responseTime: string;
  documentsUsed: number;
  confidence: number;
  category: string;
}

interface Metric {
  label: string;
  value: string | number;
  change: string;
  icon: React.ComponentType<any>;
  color: string;
}

const queryVolumeData: QueryVolumeData[] = [
  { date: '04.12', queries: 45, documents: 8 },
  { date: '05.12', queries: 52, documents: 12 },
  { date: '06.12', queries: 38, documents: 6 },
  { date: '07.12', queries: 61, documents: 15 },
  { date: '08.12', queries: 73, documents: 18 },
  { date: '09.12', queries: 69, documents: 14 },
  { date: '10.12', queries: 58, documents: 11 },
];

const responseTimeData: ResponseTimeData[] = [
  { date: '04.12', time: 1.2, target: 1.5 },
  { date: '05.12', time: 1.4, target: 1.5 },
  { date: '06.12', time: 1.1, target: 1.5 },
  { date: '07.12', time: 1.5, target: 1.5 },
  { date: '08.12', time: 1.3, target: 1.5 },
  { date: '09.12', time: 1.2, target: 1.5 },
  { date: '10.12', time: 1.4, target: 1.5 },
];

const categoryData: CategoryData[] = [
  { name: 'Mietrecht', value: 145, color: '#3498DB' },
  { name: 'Arbeitsrecht', value: 98, color: '#27AE60' },
  { name: 'Vertragsrecht', value: 67, color: '#F39C12' },
  { name: 'Familienrecht', value: 43, color: '#E74C3C' },
  { name: 'Strafrecht', value: 32, color: '#9B59B6' },
  { name: 'Sonstiges', value: 38, color: '#95A5A6' },
];

const queryHistory: QueryHistoryItem[] = [
  {
    id: '1',
    query: 'Was sind die Hauptpflichten eines Mieters nach § 535 BGB?',
    timestamp: new Date(2024, 11, 4, 10, 30),
    responseTime: '1.2s',
    documentsUsed: 3,
    confidence: 0.95,
    category: 'Mietrecht'
  },
  {
    id: '2',
    query: 'Kündigungsfrist bei unbefristetem Mietvertrag?',
    timestamp: new Date(2024, 11, 4, 11, 15),
    responseTime: '1.4s',
    documentsUsed: 2,
    confidence: 0.88,
    category: 'Mietrecht'
  },
  {
    id: '3',
    query: 'Welche Rechte hat ein Arbeitnehmer bei Krankheit?',
    timestamp: new Date(2024, 11, 4, 14, 22),
    responseTime: '1.1s',
    documentsUsed: 4,
    confidence: 0.92,
    category: 'Arbeitsrecht'
  },
  {
    id: '4',
    query: 'Verjährungsfristen im Vertragsrecht',
    timestamp: new Date(2024, 11, 4, 15, 45),
    responseTime: '1.5s',
    documentsUsed: 5,
    confidence: 0.79,
    category: 'Vertragsrecht'
  },
  {
    id: '5',
    query: 'Unterhaltsansprüche nach Scheidung',
    timestamp: new Date(2024, 11, 4, 16, 10),
    responseTime: '1.3s',
    documentsUsed: 3,
    confidence: 0.86,
    category: 'Familienrecht'
  },
  {
    id: '6',
    query: 'Haftung bei Urheberrechtsverletzung',
    timestamp: new Date(2024, 11, 4, 17, 30),
    responseTime: '1.6s',
    documentsUsed: 4,
    confidence: 0.81,
    category: 'Sonstiges'
  },
];

const metrics: Metric[] = [
  {
    label: 'Anfragen (7 Tage)',
    value: 396,
    change: '+12%',
    icon: MessageSquare,
    color: 'blue'
  },
  {
    label: 'Ø Antwortzeit',
    value: '1.3s',
    change: '-8%',
    icon: Clock,
    color: 'green'
  },
  {
    label: 'Ø Konfidenz',
    value: '88%',
    change: '+3%',
    icon: Activity,
    color: 'orange'
  },
  {
    label: 'Dokumente genutzt',
    value: 12,
    change: '+5%',
    icon: FileText,
    color: 'red'
  },
  {
    label: 'Aktive Nutzer',
    value: 3,
    change: '+1',
    icon: Users,
    color: 'purple'
  },
  {
    label: 'Chunks gespeichert',
    value: '1.2k',
    change: '+15%',
    icon: BarChart3,
    color: 'teal'
  }
];

export function AnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState('7d');
  const [activeChart, setActiveChart] = useState<'volume' | 'time'>('volume');

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit'
    });
  };

  const getChangeBadgeClass = (change: string) => {
    if (change.startsWith('+')) return 'badge-success';
    if (change.startsWith('-')) return 'badge-error';
    return 'badge-info';
  };

  const getConfidenceBadgeClass = (confidence: number) => {
    if (confidence >= 0.9) return 'confidence-high';
    if (confidence >= 0.7) return 'confidence-medium';
    return 'confidence-low';
  };

  const handleExport = () => {
    // In a real app, this would export analytics data
    alert('Analytics-Daten werden exportiert...');
  };

  return (
    <div className="analytics-dashboard">
      <div className="dashboard-container">
        {/* Header */}
        <div className="dashboard-header">
          <div className="header-content">
            <h1 className="dashboard-title">
              <BarChart3 className="dashboard-title-icon" />
              Analytics Dashboard
            </h1>
            <p className="dashboard-subtitle">
              Überwachen Sie Nutzung, Performance und Qualität des RAG-Systems
            </p>
          </div>
          <div className="header-controls">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="time-select">
                <Calendar className="select-icon" />
                <SelectValue placeholder="Zeitraum wählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Letzte 7 Tage</SelectItem>
                <SelectItem value="30d">Letzte 30 Tage</SelectItem>
                <SelectItem value="90d">Letzte 90 Tage</SelectItem>
                <SelectItem value="1y">Letztes Jahr</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleExport} className="export-button">
              <Download className="export-icon" />
              Exportieren
            </Button>
          </div>
        </div>

        {/* Metric Tiles */}
        <div className="metrics-grid">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <Card key={metric.label} className="metric-card">
                <div className="metric-card-content">
                  <div className="metric-header">
                    <div className={`metric-icon-container metric-icon-${metric.color}`}>
                      <Icon className={`metric-icon metric-icon-${metric.color}-icon`} />
                    </div>
                    <Badge className={getChangeBadgeClass(metric.change)}>
                      {metric.change}
                    </Badge>
                  </div>
                  <div className="metric-body">
                    <p className="metric-value">{metric.value}</p>
                    <p className="metric-label">{metric.label}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Charts Section */}
        <div className="charts-section">
          {/* Query Volume Chart */}
          <Card className="chart-card large-card">
            <div className="chart-header">
              <div>
                <h3 className="chart-title">
                  <BarChart3 className="chart-title-icon" />
                  Anfragenvolumen
                </h3>
                <p className="chart-subtitle">Anzahl der Anfragen und genutzten Dokumente</p>
              </div>
              <div className="chart-controls">
                <Button
                  variant={activeChart === 'volume' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveChart('volume')}
                  className="chart-button"
                >
                  Volumen
                </Button>
                <Button
                  variant={activeChart === 'time' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveChart('time')}
                  className="chart-button"
                >
                  Zeit
                </Button>
              </div>
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={300}>
                {activeChart === 'volume' ? (
                  <BarChart data={queryVolumeData}>
                    <CartesianGrid strokeDasharray="3 3" className="chart-grid" />
                    <XAxis 
                      dataKey="date" 
                      className="chart-axis"
                      tick={{ fill: '#6b7280' }}
                    />
                    <YAxis 
                      className="chart-axis"
                      tick={{ fill: '#6b7280' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      }}
                      formatter={(value, name) => {
                        if (name === 'queries') return [`${value} Anfragen`, 'Anfragen'];
                        if (name === 'documents') return [`${value} Dokumente`, 'Dokumente'];
                        return [value, name];
                      }}
                    />
                    <Legend />
                    <Bar 
                      dataKey="queries" 
                      name="Anfragen"
                      fill="#3498DB" 
                      radius={[8, 8, 0, 0]}
                      opacity={0.8}
                    />
                    <Bar 
                      dataKey="documents" 
                      name="Dokumente"
                      fill="#27AE60" 
                      radius={[8, 8, 0, 0]}
                      opacity={0.8}
                    />
                  </BarChart>
                ) : (
                  <LineChart data={responseTimeData}>
                    <CartesianGrid strokeDasharray="3 3" className="chart-grid" />
                    <XAxis 
                      dataKey="date" 
                      className="chart-axis"
                      tick={{ fill: '#6b7280' }}
                    />
                    <YAxis 
                      className="chart-axis"
                      tick={{ fill: '#6b7280' }}
                      label={{ value: 'Sekunden', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      }}
                      formatter={(value, name) => {
                        if (name === 'time') return [`${value}s`, 'Antwortzeit'];
                        if (name === 'target') return [`${value}s`, 'Ziel'];
                        return [value, name];
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="time"
                      name="Antwortzeit"
                      stroke="#E74C3C"
                      strokeWidth={3}
                      dot={{ fill: '#E74C3C', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="target"
                      name="Zielzeit"
                      stroke="#95A5A6"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                    />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Category Distribution */}
          <Card className="chart-card">
            <div className="chart-header">
              <div>
                <h3 className="chart-title">
                  <PieChartIcon className="chart-title-icon" />
                  Rechtsgebiete
                </h3>
                <p className="chart-subtitle">Verteilung nach Kategorien</p>
              </div>
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    label={(entry) => entry.name}
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    }}
                    formatter={(value, name) => [`${value} Anfragen`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="category-legend">
                {categoryData.map((category) => (
                  <div key={category.name} className="category-item">
                    <div 
                      className="category-color" 
                      style={{ backgroundColor: category.color }} 
                    />
                    <span className="category-name">{category.name}</span>
                    <span className="category-value">{category.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Query History */}
        <Card className="history-card">
          <div className="chart-header">
            <div>
              <h3 className="chart-title">
                <History className="chart-title-icon" />
                Aktuelle Anfragen
              </h3>
              <p className="chart-subtitle">Letzte Anfragen und deren Metriken</p>
            </div>
          </div>
          <ScrollArea className="history-scroll-area">
            <div className="history-list">
              {queryHistory.map((item) => (
                <div key={item.id} className="history-item">
                  <div className="history-item-header">
                    <div className="query-info">
                      <p className="history-query">{item.query}</p>
                      <Badge variant="outline" className="category-badge">
                        {item.category}
                      </Badge>
                    </div>
                    <Badge className={getConfidenceBadgeClass(item.confidence)}>
                      {(item.confidence * 100).toFixed(0)}%
                    </Badge>
                  </div>
                  <div className="history-item-details">
                    <div className="detail-item">
                      <Clock className="detail-icon" />
                      <span>{formatTime(item.timestamp)}</span>
                    </div>
                    <div className="detail-separator">•</div>
                    <div className="detail-item">
                      <span>Antwort: {item.responseTime}</span>
                    </div>
                    <div className="detail-separator">•</div>
                    <div className="detail-item">
                      <FileText className="detail-icon" />
                      <span>{item.documentsUsed} Dokumente</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
}