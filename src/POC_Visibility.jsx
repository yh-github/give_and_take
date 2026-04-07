import React, { useState, useMemo, useEffect, useRef } from 'react';
import { getVisibilityPolygon } from './logic/visibility.js';

const POC_Visibility = () => {
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [radius, setRadius] = useState(30);
  const [blur, setBlur] = useState(2);
  const [screens, setScreens] = useState(1);
  const [isInverted, setIsInverted] = useState(true);
  const containerRef = useRef(null);

  const mockNodes = useMemo(() => [
    { id: 'rock1', x: 30, y: 30, isGatekeeper: true },
    { id: 'rock2', x: 70, y: 60, isGatekeeper: true },
    { id: 'rock3', x: 50, y: 80, isExtraRock: true },
  ], []);

  const mockWalls = useMemo(() => ({
    leftWall: [
      { x: 0, y: 0 }, { x: 10, y: 20 }, { x: 5, y: 50 }, { x: 15, y: 80 }, { x: 0, y: 100 }
    ],
    rightWall: [
      { x: 100, y: 0 }, { x: 90, y: 30 }, { x: 95, y: 60 }, { x: 85, y: 90 }, { x: 100, y: 100 }
    ],
    centralPillar: [
      { x: 45, y: 40 }, { x: 55, y: 40 }, { x: 55, y: 50 }, { x: 45, y: 50 }
    ]
  }), []);

  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * (100 * screens);
    setMousePos({ x, y });
  };

  const polygon = useMemo(() => {
    return getVisibilityPolygon(mousePos, mockNodes, mockWalls, [], [], radius, screens);
  }, [mousePos, mockNodes, mockWalls, radius, screens]);

  return (
    <div className="min-h-screen bg-stone-900 text-white p-8 flex flex-col items-center">
      <h1 className="text-3xl font-black mb-4 uppercase tracking-tighter text-amber-500">Lighting Tech POC</h1>
      
      <div className="flex gap-8 mb-8 bg-stone-800 p-4 rounded-xl border border-stone-700 shadow-xl">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase opacity-50">Radius</span>
          <input type="range" min="10" max="100" value={radius} onChange={(e) => setRadius(Number(e.target.value))} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase opacity-50">Blur</span>
          <input type="range" min="0" max="10" step="0.5" value={blur} onChange={(e) => setBlur(Number(e.target.value))} />
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={isInverted} onChange={(e) => setIsInverted(e.target.checked)} />
          <span className="text-xs font-bold uppercase opacity-50">Spread Light</span>
        </label>
      </div>

      <div 
        ref={containerRef}
        onMouseMove={handleMouseMove}
        className="relative w-[600px] bg-stone-700 rounded-lg overflow-hidden cursor-crosshair shadow-2xl border-4 border-stone-600"
        style={{ aspectRatio: `1 / ${screens}`, height: '600px' }}
      >
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox={`0 0 100 ${100 * screens}`} preserveAspectRatio="none">
           <path d={"M " + mockWalls.leftWall.map(p => `${p.x} ${p.y * screens}`).join(" L ") + " Z"} fill="#3d3832" stroke="#1a1815" />
           <path d={"M " + mockWalls.rightWall.map(p => `${p.x} ${p.y * screens}`).join(" L ") + " Z"} fill="#3d3832" stroke="#1a1815" />
           <path d={"M " + mockWalls.centralPillar.map(p => `${p.x} ${p.y * screens}`).join(" L ") + " Z"} fill="#3d3832" stroke="#1a1815" />
           {mockNodes.map(n => (
               <rect key={n.id} x={n.x-2} y={n.y-1} width="4" height="2" fill="#555" stroke="#222" />
           ))}
        </svg>

        <svg className="absolute inset-0 w-full h-full pointer-events-none z-20" viewBox={`0 0 100 ${100 * screens}`} preserveAspectRatio="none">
          <defs>
            <filter id="f">
              <feGaussianBlur stdDeviation={blur} />
            </filter>
            <mask id="m">
              <rect width="100" height={100 * screens} fill={isInverted ? "white" : "black"} />
              <polygon points={polygon} fill={isInverted ? "black" : "white"} filter="url(#f)" />
            </mask>
          </defs>
          <rect width="100" height={100 * screens} fill="black" opacity="0.95" mask="url(#m)" />
        </svg>

        <div 
          className="absolute w-4 h-4 bg-amber-500 rounded-full shadow-[0_0_20px_white] z-30 pointer-events-none -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${mousePos.x}%`, top: `${mousePos.y}%` }}
        />
      </div>

      <p className="mt-4 text-stone-500 text-sm italic">Move your mouse over the box to test the occlusion.</p>
    </div>
  );
};

export default POC_Visibility;
