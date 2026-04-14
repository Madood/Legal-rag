import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, Mail, Building2, Briefcase, 
  Shield, Calendar, Save, Lock, 
  Edit2, X, Key, Smartphone 
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Avatar, AvatarFallback } from '../../ui/avatar';
import './ProfilePage.css';

interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  title: string;
  organization: string;
  department: string;
  role: string;
  memberSince: string;
}

export function ProfilePage() {
  const navigate = useNavigate();
  const [isGuest, setIsGuest] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [profileData, setProfileData] = useState<ProfileData>({
    firstName: 'Max',
    lastName: 'Schmidt',
    email: 'm.schmidt@legal.de',
    title: 'Dr. jur.',
    organization: 'Bundesgerichtshof',
    department: 'Zivilrecht',
    role: 'Richter',
    memberSince: '2022-03-15',
  });

  useEffect(() => {
    const userType = localStorage.getItem('userType');
    if (userType === 'guest') {
      setIsGuest(true);
      setProfileData({
        firstName: 'Gast',
        lastName: 'Benutzer',
        email: 'guest@example.com',
        title: '-',
        organization: '-',
        department: '-',
        role: 'Gast',
        memberSince: new Date().toISOString().split('T')[0],
      });
    } else {
      const savedProfile = localStorage.getItem('userProfile');
      if (savedProfile) {
        setProfileData(JSON.parse(savedProfile));
      }
    }
  }, []);

  const showToast = (message: string, type: 'success' | 'info' = 'info') => {
    // In a real app, use a proper toast library
    console.log(`${type === 'success' ? '✓' : 'ℹ️'} ${message}`);
  };

  const handleSave = async () => {
    if (isGuest) return;
    
    setIsSaving(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 800));
    
    localStorage.setItem('userProfile', JSON.stringify(profileData));
    showToast('Profil erfolgreich aktualisiert', 'success');
    setIsEditing(false);
    setIsSaving(false);
  };

  const handleInputChange = (field: keyof ProfileData, value: string) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
  };

  const getInitials = () => {
    return `${profileData.firstName.charAt(0)}${profileData.lastName.charAt(0)}`.toUpperCase();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getFullName = () => {
    const name = `${profileData.firstName} ${profileData.lastName}`.trim();
    return profileData.title ? `${profileData.title} ${name}` : name;
  };

  const handleCancel = () => {
    setIsEditing(false);
    // Reset to saved data
    const savedProfile = localStorage.getItem('userProfile');
    if (savedProfile) {
      setProfileData(JSON.parse(savedProfile));
    }
  };

  return (
    <div className="profile-page-wrapper">
      <div className="profile-page">
        <div className="profile-container">
          {/* Header */}
          <div className="profile-header">
            <h1 className="profile-title">Mein Profil</h1>
            <p className="profile-subtitle">
              Verwalten Sie Ihre persönlichen Informationen und Kontoeinstellungen
            </p>
          </div>

          {isGuest && (
            <Card className="guest-warning-card">
              <CardContent className="guest-warning-content">
                <div className="guest-warning-inner">
                  <Shield className="guest-warning-icon" />
                  <div className="guest-warning-text-container">
                    <p className="guest-warning-title">Gast-Modus aktiv</p>
                    <p className="guest-warning-text">
                      Sie verwenden Jurisma AI im Gast-Modus mit eingeschränkten Funktionen.
                      Melden Sie sich an, um Ihr Profil zu bearbeiten und auf alle Features zuzugreifen.
                    </p>
                    <Button
                      onClick={() => navigate('/login')}
                      className="guest-login-button"
                      size="lg"
                    >
                      Jetzt anmelden
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Profile Overview Card */}
          <Card className="profile-overview-card">
            <CardContent className="overview-content">
              <div className="profile-header-container">
                <div className="profile-avatar-container">
                  <Avatar className="profile-avatar">
                    <AvatarFallback className="avatar-fallback">
                      {getInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="avatar-decoration"></div>
                </div>
                <div className="profile-info">
                  <div className="profile-header-main">
                    <div className="profile-name-role">
                      <h2 className="profile-fullname">
                        {getFullName()}
                      </h2>
                      <p className="profile-role-org">
                        {profileData.role} • {profileData.organization}
                        {profileData.department && ` • ${profileData.department}`}
                      </p>
                    </div>
                    {!isGuest && (
                      <Button
                        onClick={() => isEditing ? handleCancel() : setIsEditing(true)}
                        variant={isEditing ? 'outline' : 'default'}
                        className={isEditing ? 'edit-cancel-button' : 'edit-button'}
                        size="lg"
                      >
                        {isEditing ? (
                          <>
                            <X size={16} className="button-icon" />
                            Abbrechen
                          </>
                        ) : (
                          <>
                            <Edit2 size={16} className="button-icon" />
                            Bearbeiten
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                  <div className="profile-meta">
                    <div className="member-since">
                      <Calendar className="calendar-icon" size={16} />
                      <span>Mitglied seit {formatDate(profileData.memberSince)}</span>
                    </div>
                    <div className="profile-email">
                      <Mail className="email-icon" size={16} />
                      <span>{profileData.email}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Personal Information Card */}
          <Card className="info-card">
            <CardHeader>
              <CardTitle className="card-title">
                <User className="card-title-icon" size={20} />
                Persönliche Informationen
              </CardTitle>
              <CardDescription className="card-description">
                Ihre grundlegenden Kontoinformationen
              </CardDescription>
            </CardHeader>
            <CardContent className="card-content">
              <div className="input-grid">
                <div className="input-group">
                  <Label htmlFor="title" className="input-label">
                    Titel
                  </Label>
                  <Input
                    id="title"
                    value={profileData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    disabled={!isEditing || isGuest}
                    className="profile-input"
                    placeholder="z.B. Dr. jur."
                  />
                </div>
                <div className="input-group">
                  <Label htmlFor="email" className="input-label">
                    E-Mail-Adresse
                  </Label>
                  <div className="input-with-icon">
                    <Mail className="input-icon" size={18} />
                    <Input
                      id="email"
                      type="email"
                      value={profileData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      disabled={!isEditing || isGuest}
                      className="profile-input icon-input"
                      placeholder="ihre.email@beispiel.de"
                    />
                  </div>
                </div>
                <div className="input-group">
                  <Label htmlFor="firstName" className="input-label">
                    Vorname
                  </Label>
                  <Input
                    id="firstName"
                    value={profileData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    disabled={!isEditing || isGuest}
                    className="profile-input"
                    placeholder="Max"
                  />
                </div>
                <div className="input-group">
                  <Label htmlFor="lastName" className="input-label">
                    Nachname
                  </Label>
                  <Input
                    id="lastName"
                    value={profileData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    disabled={!isEditing || isGuest}
                    className="profile-input"
                    placeholder="Schmidt"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Professional Information Card */}
          <Card className="info-card">
            <CardHeader>
              <CardTitle className="card-title">
                <Briefcase className="card-title-icon" size={20} />
                Berufliche Informationen
              </CardTitle>
              <CardDescription className="card-description">
                Details zu Ihrer Organisation und Position
              </CardDescription>
            </CardHeader>
            <CardContent className="card-content">
              <div className="input-grid">
                <div className="input-group">
                  <Label htmlFor="organization" className="input-label">
                    Organisation
                  </Label>
                  <div className="input-with-icon">
                    <Building2 className="input-icon" size={18} />
                    <Input
                      id="organization"
                      value={profileData.organization}
                      onChange={(e) => handleInputChange('organization', e.target.value)}
                      disabled={!isEditing || isGuest}
                      className="profile-input icon-input"
                      placeholder="Bundesgerichtshof"
                    />
                  </div>
                </div>
                <div className="input-group">
                  <Label htmlFor="department" className="input-label">
                    Abteilung
                  </Label>
                  <Input
                    id="department"
                    value={profileData.department}
                    onChange={(e) => handleInputChange('department', e.target.value)}
                    disabled={!isEditing || isGuest}
                    className="profile-input"
                    placeholder="Zivilrecht"
                  />
                </div>
                <div className="input-group full-width-input">
                  <Label htmlFor="role" className="input-label">
                    Rolle/Position
                  </Label>
                  <Input
                    id="role"
                    value={profileData.role}
                    onChange={(e) => handleInputChange('role', e.target.value)}
                    disabled={!isEditing || isGuest}
                    className="profile-input"
                    placeholder="Richter"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security Card */}
          <Card className="info-card">
            <CardHeader>
              <CardTitle className="card-title">
                <Lock className="card-title-icon" size={20} />
                Sicherheit
              </CardTitle>
              <CardDescription className="card-description">
                Verwalten Sie Ihr Passwort und Sicherheitseinstellungen
              </CardDescription>
            </CardHeader>
            <CardContent className="security-content">
              <div className="security-options">
                <div className="security-option">
                  <div className="security-option-icon">
                    <Key size={20} />
                  </div>
                  <div className="security-option-info">
                    <p className="security-option-title">Passwort ändern</p>
                    <p className="security-option-description">
                      Zuletzt geändert vor 45 Tagen
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="lg"
                    disabled={isGuest}
                    onClick={() => showToast('Passwort-Änderung wird implementiert')}
                    className="security-button"
                  >
                    Ändern
                  </Button>
                </div>
                
                <div className="security-divider"></div>
                
                <div className="security-option">
                  <div className="security-option-icon">
                    <Smartphone size={20} />
                  </div>
                  <div className="security-option-info">
                    <p className="security-option-title">Zwei-Faktor-Authentifizierung</p>
                    <p className="security-option-description">
                      Erhöhen Sie die Sicherheit Ihres Kontos
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="lg"
                    disabled={isGuest}
                    onClick={() => showToast('2FA wird implementiert')}
                    className="security-button"
                  >
                    Aktivieren
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Actions */}
          {isEditing && !isGuest && (
            <div className="save-actions-container">
              <div className="save-actions">
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  className="cancel-button"
                  size="lg"
                  disabled={isSaving}
                >
                  <X size={18} className="button-icon" />
                  Abbrechen
                </Button>
                <Button
                  onClick={handleSave}
                  className="save-button"
                  size="lg"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <div className="spinner"></div>
                      Speichern...
                    </>
                  ) : (
                    <>
                      <Save size={18} className="button-icon" />
                      Änderungen speichern
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}