import React from 'react';

export function LevelEditorOverlay({
  isLevelEditor,
  editorNodes,
  setEditorNodes,
  level,
  innerMapRef
}) {
  if (!isLevelEditor) return null;

  const handleSave = () => {
    fetch('/api/save-level', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mapNodes: editorNodes })
    })
      .then(res => res.json())
      .then(res => {
        if (res.success) alert('Level Saved Successfully!');
        else alert('Error saving: ' + res.error);
      })
      .catch(e => alert('Error saving: ' + e));
  };

  return (
    <>
      <button 
        onClick={handleSave}
        className="absolute top-4 right-4 z-[2000] bg-green-600 text-white font-bold py-2 px-4 rounded shadow-lg hover:bg-green-500 active:translate-y-1 pointer-events-auto"
      >
        💾 Save Level
      </button>

      <div className="absolute inset-0 z-[1000] bg-black/40 pointer-events-auto">
        {editorNodes.map((node, i) => {
          const isRock = (node.isGatekeeper || node.isExtraRock) && level.mechanics?.hasPickaxe && node.id !== 'final_gate';
          const emoji = node.emoji || (node.isPreset === 'pickaxe' ? '⛏️' : node.isPreset === 'mushroom' ? '🍄' : node.isTreasure ? '💎' : '❓');
          
          return (
            <div 
              key={node.id || i}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing hover:scale-110 pointer-events-auto bg-white/10 rounded-full flex items-center justify-center shadow-2xl border border-white/30"
              style={{ 
                left: `${node.x}%`, 
                top: `${node.y}%`, 
                fontSize: isRock ? '2rem' : node.isGatekeeper ? '3rem' : '2rem', 
                width: isRock ? 'max-content' : node.isGatekeeper ? '4.5rem' : '3.5rem', 
                height: isRock ? 'max-content' : node.isGatekeeper ? '4.5rem' : '3.5rem' 
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.target.setPointerCapture(e.pointerId);
                const handleMove = (eMove) => {
                  if (!innerMapRef.current) return;
                  const rect = innerMapRef.current.getBoundingClientRect();
                  const newX = ((eMove.clientX - rect.left) / rect.width) * 100;
                  const newY = ((eMove.clientY - rect.top) / rect.height) * 100;
                  setEditorNodes(prev => {
                    const copy = [...prev];
                    copy[i] = { ...copy[i], x: Math.round(newX * 10) / 10, y: Math.round(newY * 10) / 10 };
                    return copy;
                  });
                };
                const handleUp = (eUp) => {
                  eUp.target.releasePointerCapture(eUp.pointerId);
                  eUp.target.removeEventListener('pointermove', handleMove);
                  eUp.target.removeEventListener('pointerup', handleUp);
                };
                e.target.addEventListener('pointermove', handleMove);
                e.target.addEventListener('pointerup', handleUp);
              }}
            >
              {isRock && level.RockComponent ? (
                <div className={`${(node.size || (node.isGatekeeper ? 'large' : 'small')) === 'small' ? 'w-[20cqw]' : (node.size || (node.isGatekeeper ? 'large' : 'small')) === 'medium' ? 'w-[28cqw]' : 'w-[36cqw]'} flex justify-center items-center pointer-events-none`}>
                  <level.RockComponent isDefeated={false} seed={node.id} size={node.size || (node.isGatekeeper ? 'large' : 'small')} yNode={node.y} nodeX={node.x} />
                </div>
              ) : (
                <span className="drop-shadow-md pointer-events-none">{emoji}</span>
              )}
              <div className="absolute -bottom-6 bg-black text-white text-xs px-1 rounded opacity-70 whitespace-nowrap pointer-events-none">
                {node.x}, {node.y}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export default LevelEditorOverlay;
