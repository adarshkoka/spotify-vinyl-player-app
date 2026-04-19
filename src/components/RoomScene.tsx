import React from 'react';

interface RoomSceneProps {
  children: React.ReactNode;
}

const RoomScene: React.FC<RoomSceneProps> = ({ children }) => {
  return (
    <div className="room-scene">
      {/* Background layer — simple gradient for now, slot for future illustrated backgrounds */}
      <div className="room-background" />

      {/* Foreground content (record player assembly) */}
      <div className="room-content">
        {children}
      </div>
    </div>
  );
};

export default RoomScene;
