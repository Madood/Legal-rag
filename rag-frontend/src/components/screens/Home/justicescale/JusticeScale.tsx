import { useState, useEffect, useRef } from 'react';
import './JusticeScale.css';

interface JusticeScaleProps {
  /** Width of the scale image */
  width?: number;
  /** Height of the scale image */
  height?: number;
  /** Control the animation state */
  isPlaying?: boolean;
  /** Custom CSS class */
  className?: string;
  /** Animation speed in seconds */
  speed?: number;
  /** Enable/disable vertical movement */
  enableVertical?: boolean;
  /** Enable/disable horizontal swing */
  enableSwing?: boolean;
}

export function JusticeScale({
  width = 280,
  height = 280,
  isPlaying = true,
  className = '',
  speed = 4.5,
  enableVertical = true,
  enableSwing = true,
}: JusticeScaleProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Handle image load
  const handleImageLoad = () => {
    setIsLoaded(true);
  };

  // Generate dynamic animation based on props
  const getAnimationStyle = () => {
    const animations = [];

    if (enableSwing) {
      animations.push(`justiceSwing ${speed}s ease-in-out infinite`);
    }

    if (enableVertical) {
      animations.push(`floatUpDown ${speed * 0.8}s ease-in-out infinite`);
    }

    return animations.join(', ');
  };

  // Get transform origin based on enabled animations
  const getTransformOrigin = () => {
    if (enableSwing && !enableVertical) {
      return '50% 18%'; // Top center for swinging
    }
    if (enableVertical && !enableSwing) {
      return '50% 50%'; // Center for floating
    }
    return '50% 18%'; // Default for combined animation
  };

  return (
    <div
      ref={containerRef}
      className={`justice-scale-container ${className}`}
      style={{
        '--scale-width': `${width}px`,
        '--scale-height': `${height}px`,
        '--animation-speed': `${speed}s`,
      } as React.CSSProperties}
    >
      {/* Main scale image with combined animations */}
      <div className="justice-scale-wrapper">
        <img
          ref={imageRef}
          src="/justice-scale.png"
          alt="Animated Justice Scale - Symbol of balance and fairness"
          className={`justice-scale-image ${
            isPlaying && isLoaded ? 'animate' : ''
          }`}
          style={{
            animation: isPlaying ? getAnimationStyle() : 'none',
            transformOrigin: getTransformOrigin(),
            width: `${width}px`,
            height: `${height}px`,
          }}
          onLoad={handleImageLoad}
          loading="lazy"
        />

        {/* Shadow effect */}
        <div 
          className="justice-scale-shadow" 
          style={{
            animation: isPlaying ? `shadowPulse ${speed}s ease-in-out infinite` : 'none',
          }}
        />

        {/* Glow effect */}
        <div 
          className="justice-scale-glow" 
          style={{
            animation: isPlaying ? `glowPulse ${speed}s ease-in-out infinite` : 'none',
          }}
        />

        {/* Secondary decorative elements */}
        <div className="justice-scale-dots">
          {[1, 2, 3, 4].map((dot) => (
            <div
              key={dot}
              className="justice-scale-dot"
              style={{
                animation: isPlaying 
                  ? `floatUpDown ${speed * 0.6 + dot * 0.2}s ease-in-out infinite` 
                  : 'none',
                animationDelay: `${dot * 0.1}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Loading placeholder */}
      {!isLoaded && (
        <div className="justice-scale-placeholder">
          <div className="justice-scale-skeleton" />
        </div>
      )}

      {/* Animation controls overlay */}
      <div className="justice-scale-controls">
        <div className="justice-scale-status">
          {isPlaying ? '⚖️ Animiert' : '⏸️ Pausiert'}
        </div>
        <div className="justice-scale-stats">
          <span className="justice-scale-stat">Horizontal: {enableSwing ? '✅' : '❌'}</span>
          <span className="justice-scale-stat">Vertikal: {enableVertical ? '✅' : '❌'}</span>
        </div>
      </div>
    </div>
  );
}

// Separate component for advanced control
interface ControlledJusticeScaleProps extends JusticeScaleProps {
  /** Show controls UI */
  showControls?: boolean;
  /** Initial vertical offset in pixels */
  verticalOffset?: number;
  /** Max swing angle in degrees */
  maxSwingAngle?: number;
}

export function ControlledJusticeScale({
  showControls = true,
  verticalOffset = 20,
  maxSwingAngle = 16,
  ...props
}: ControlledJusticeScaleProps) {
  const [isPlaying, setIsPlaying] = useState<boolean>(props.isPlaying ?? true);
  const [enableVertical, setEnableVertical] = useState<boolean>(props.enableVertical ?? true);
  const [enableSwing, setEnableSwing] = useState<boolean>(props.enableSwing ?? true);
  const [speed, setSpeed] = useState<number>(props.speed ?? 4.5);

  return (
    <div className="controlled-justice-scale">
      <JusticeScale
        {...props}
        isPlaying={isPlaying}
        enableVertical={enableVertical}
        enableSwing={enableSwing}
        speed={speed}
      />

      {showControls && (
        <div className="justice-scale-control-panel">
          <div className="control-group">
            <button
              type="button"
              className="control-button"
              onClick={() => setIsPlaying(prev => !prev)}
              title={isPlaying ? 'Animation pausieren' : 'Animation starten'}
            >
              {isPlaying ? '⏸️ Pause' : '▶️ Play'}
            </button>
            <button
              type="button"
              className="control-button"
              onClick={() => {
                setIsPlaying(true);
                setEnableVertical(prev => !prev);
              }}
              title="Vertikale Bewegung umschalten"
            >
              {enableVertical ? '📉 Vertikal aus' : '📈 Vertikal an'}
            </button>
            <button
              type="button"
              className="control-button"
              onClick={() => {
                setIsPlaying(true);
                setEnableSwing(prev => !prev);
              }}
              title="Horizontale Bewegung umschalten"
            >
              {enableSwing ? '↔️ Horizontal aus' : '↔️ Horizontal an'}
            </button>
          </div>

          <div className="control-group">
            <label className="control-label">
              Geschwindigkeit: {speed.toFixed(1)}s
              <input
                type="range"
                min="1"
                max="10"
                step="0.5"
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="control-slider"
              />
            </label>
          </div>

          <div className="animation-presets">
            <button
              type="button"
              className="preset-button"
              onClick={() => {
                setSpeed(2);
                setEnableSwing(true);
                setEnableVertical(false);
                setIsPlaying(true);
              }}
            >
              Schnell schwingen
            </button>
            <button
              type="button"
              className="preset-button"
              onClick={() => {
                setSpeed(6);
                setEnableSwing(true);
                setEnableVertical(true);
                setIsPlaying(true);
              }}
            >
              Langsam balancieren
            </button>
            <button
              type="button"
              className="preset-button"
              onClick={() => {
                setSpeed(3);
                setEnableSwing(false);
                setEnableVertical(true);
                setIsPlaying(true);
              }}
            >
              Nur vertikal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Hook for using the justice scale animation
export function useJusticeScaleAnimation() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    return () => setIsVisible(false);
  }, []);

  return { isVisible };
}

export default JusticeScale;