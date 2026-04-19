import React from 'react';

interface GradientColors {
  primary: string;
  secondary: string;
  accent: string;
  dark: string;
}

interface RoomSceneProps {
  children: React.ReactNode;
  gradientColors?: GradientColors;
}

const RoomScene: React.FC<RoomSceneProps> = ({ children, gradientColors }) => {
  const bgStyle = gradientColors
    ? {
        background: `linear-gradient(160deg, ${gradientColors.dark} 0%, ${gradientColors.primary} 30%, ${gradientColors.secondary} 60%, ${gradientColors.accent} 100%)`,
      }
    : undefined;

  return (
    <div className="room-scene">
      <div className="room-background" style={bgStyle} />

      <div className="room-content">
        {children}
      </div>
    </div>
  );
};

export default RoomScene;
