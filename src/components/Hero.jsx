import React from 'react';

export function Hero({
  playerVisualX,
  playerVisualY,
  playerRotation,
  playerScale,
  playerFilter,
  playerZ,
  playerTransition,
  isTransformed,
  isSubmerged,
  isDrowning,
  heroFace,
  level,
  isAnimatingLoot
}) {
  return (
    <div 
      className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all ${playerTransition} pointer-events-none flex items-center justify-center ${playerScale} ${playerFilter}`} 
      style={{ 
        left: `${playerVisualX}%`, 
        top: `${playerVisualY}%`, 
        zIndex: Math.max(playerZ, 160), 
        transform: `translate(-50%, -50%) rotate(${playerRotation}deg)` 
      }}
    >
      <div 
        className={`text-white w-[10cqw] h-[10cqw] rounded-full flex items-center justify-center shadow-[0_1cqw_2cqw_rgba(0,0,0,0.8)] text-[6cqw] relative ${
          isTransformed 
            ? 'bg-cyan-400 border-2 border-cyan-100 shadow-[0_0_15px_rgba(34,211,238,0.8)]' 
            : isSubmerged 
              ? 'bg-teal-700 border-2 border-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.9)]' 
              : level.mechanics.hasAir 
                ? 'bg-cyan-600 border-2 border-cyan-200' 
                : 'bg-blue-600 border-2 border-white'
        } ${level.mechanics.heroBobs && !isDrowning ? 'animate-bob' : ''}`}
      >
        {heroFace}
        {level.id === 'underwater' && !isTransformed && isAnimatingLoot && (
          <div className="absolute inset-0 pointer-events-none z-50">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="absolute text-sm sm:text-base animate-hero-air-bubble select-none"
                style={{
                  left: '50%',
                  top: '0%',
                  '--start-dx': `${(i - 1) * 8}px`,
                  '--end-dx': `${(i - 1) * 16}px`,
                  animationDelay: `${i * 150}ms`,
                  animationDuration: '1.0s',
                }}
              >
                🫧
              </div>
            ))}
          </div>
        )}
        {level.mechanics.darknessType === 'radial' && (
          <div className="absolute -right-3 -bottom-2 text-xl z-50 drop-shadow-[0_0_10px_rgba(251,191,36,1)]">
            🕯️
          </div>
        )}
      </div>
    </div>
  );
}

export default Hero;
