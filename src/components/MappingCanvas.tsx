
import React, { useRef, useEffect, useState, MouseEvent, useCallback } from 'react';
import { BubbleGroup, Bubble } from '../types';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';

interface MappingCanvasProps {
  imageSrc: string;
  groups: BubbleGroup[];
  activeValue: string | null;
  activeGroupId: string | null;
  bubbleRadiusPct: number;
  onAddBubble: (groupId: string, bubble: Bubble) => void;
  onUpdateBubble: (groupId: string, bubbleIndex: number, newBubble: Bubble) => void;
  onDeleteBubble: (groupId: string, bubbleIndex: number) => void;
  isGridMode?: boolean;
  onGridClick?: (xPct: number, yPct: number) => void;
  gridPoints?: { x: number; y: number }[];
}

const MappingCanvas: React.FC<MappingCanvasProps> = ({
  imageSrc,
  groups,
  activeValue,
  activeGroupId,
  bubbleRadiusPct,
  onAddBubble,
  onUpdateBubble,
  onDeleteBubble,
  isGridMode = false,
  onGridClick,
  gridPoints = []
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [draggingBubble, setDraggingBubble] = useState<{ groupId: string, index: number } | null>(null);
  const [magPosition, setMagPosition] = useState<'top' | 'bottom'>('top');
  const [, setForceUpdate] = useState(0);

  useEffect(() => {
    const handleResize = () => setForceUpdate(n => n + 1);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!imageSrc) return;
    const image = new Image();
    image.src = imageSrc;
    image.onload = () => {
        setImg(image);
        if (containerRef.current) {
             const cw = containerRef.current.clientWidth;
             const ch = containerRef.current.clientHeight;
             if (cw && ch && image.naturalWidth && image.naturalHeight) {
                 const scaleW = (cw - 40) / image.naturalWidth;
                 const scaleH = (ch - 40) / image.naturalHeight;
                 setScale(Math.min(scaleW, scaleH));
             }
        }
    };
  }, [imageSrc]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    const drawWidth = img.naturalWidth;
    const drawHeight = img.naturalHeight;
    const lineWidth = 2 / scale;
    const textSize = Math.max(12, bubbleRadiusPct * drawWidth);

    groups.forEach((group) => {
      const isGroupActive = group.id === activeGroupId && !isGridMode;
      group.bubbles.forEach((bubble) => {
        const cx = bubble.x * drawWidth;
        const cy = bubble.y * drawHeight;
        const r = bubbleRadiusPct * drawWidth;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 2 * Math.PI);
        ctx.fillStyle = isGroupActive ? 'rgba(59, 130, 246, 0.4)' : 'rgba(100, 116, 139, 0.3)';
        if (isGroupActive && bubble.value === activeValue) ctx.fillStyle = 'rgba(34, 197, 94, 0.7)';
        ctx.fill();
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = isGroupActive ? '#2563EB' : '#64748B';
        ctx.stroke();
        ctx.fillStyle = '#1e293b';
        ctx.font = `bold ${textSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(bubble.value, cx, cy);
      });
    });

    if (isGridMode && gridPoints.length > 0) {
      gridPoints.forEach((p, i) => {
        const px = p.x * drawWidth;
        const py = p.y * drawHeight;
        ctx.beginPath();
        ctx.arc(px, py, 10 / scale, 0, 2 * Math.PI);
        ctx.fillStyle = '#EF4444';
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2 / scale;
        ctx.stroke();
      });
    }
  }, [img, groups, scale, activeGroupId, activeValue, bubbleRadiusPct, isGridMode, gridPoints]);

  const getMousePosInImage = (e: MouseEvent) => {
    if (!canvasRef.current || !img) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (img.naturalWidth / rect.width);
    const y = (e.clientY - rect.top) * (img.naturalHeight / rect.height);
    return { x, y };
  };

  const handleMouseDown = (e: MouseEvent) => {
    if (!img) return;
    const { x, y } = getMousePosInImage(e);
    const drawWidth = img.naturalWidth;
    const drawHeight = img.naturalHeight;

    if (isGridMode && onGridClick) {
      onGridClick(x / drawWidth, y / drawHeight);
      return;
    }

    if (!activeGroupId || !activeValue) return;

    const hitThresholdSq = Math.pow(bubbleRadiusPct * drawWidth * 1.5, 2);
    for (const group of groups) {
      for (let i = 0; i < group.bubbles.length; i++) {
        const b = group.bubbles[i];
        const distSq = Math.pow(x - b.x * drawWidth, 2) + Math.pow(y - b.y * drawHeight, 2);
        if (distSq <= hitThresholdSq) {
          if (e.button === 2) {
            e.preventDefault();
            onDeleteBubble(group.id, i);
            return;
          }
          setDraggingBubble({ groupId: group.id, index: i });
          return;
        }
      }
    }

    if (e.button === 0) {
      onAddBubble(activeGroupId, { value: activeValue, x: x / drawWidth, y: y / drawHeight });
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!img) return;
    const { x, y } = getMousePosInImage(e);
    setMousePos({ x, y });

    if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const inDangerZone = (e.clientX - rect.left) > (rect.width - 250) && (e.clientY - rect.top) < 250;
        setMagPosition(inDangerZone ? 'bottom' : 'top');
    }

    if (draggingBubble) {
        onUpdateBubble(draggingBubble.groupId, draggingBubble.index, {
          ...groups.find(g => g.id === draggingBubble.groupId)!.bubbles[draggingBubble.index],
          x: Math.max(0, Math.min(1, x / img.naturalWidth)),
          y: Math.max(0, Math.min(1, y / img.naturalHeight))
        });
    }
  };

  const handleMouseUp = () => setDraggingBubble(null);

  const renderMagnifier = () => {
      if (!img || isGridMode || draggingBubble) return null;
      const magSize = 250;
      const zoomLevel = 3;
      const drawWidth = img.naturalWidth;
      const drawHeight = img.naturalHeight;
      const bgPos = `${-mousePos.x * zoomLevel + magSize / 2}px ${-mousePos.y * zoomLevel + magSize / 2}px`;
      const bgSize = `${drawWidth * zoomLevel}px ${drawHeight * zoomLevel}px`;

      // Find bubbles visible in the magnifier range
      const visibleBubbles: { bx: number, by: number, br: number, val: string, color: string }[] = [];
      const halfRange = (magSize / 2) / zoomLevel;

      groups.forEach(group => {
        const isGroupActive = group.id === activeGroupId;
        group.bubbles.forEach(bubble => {
          const bx = bubble.x * drawWidth;
          const by = bubble.y * drawHeight;
          const br = bubbleRadiusPct * drawWidth;

          if (Math.abs(bx - mousePos.x) < halfRange + br && Math.abs(by - mousePos.y) < halfRange + br) {
            visibleBubbles.push({
              bx: (bx - mousePos.x) * zoomLevel + magSize / 2,
              by: (by - mousePos.y) * zoomLevel + magSize / 2,
              br: br * zoomLevel,
              val: bubble.value,
              color: isGroupActive ? (bubble.value === activeValue ? 'rgba(34, 197, 94, 0.7)' : 'rgba(59, 130, 246, 0.4)') : 'rgba(100, 116, 139, 0.3)'
            });
          }
        });
      });

      return (
          <div className={`absolute right-4 ${magPosition === 'top' ? 'top-4' : 'bottom-4'} border-2 border-slate-800 bg-white rounded shadow-2xl z-50 overflow-hidden pointer-events-none transition-all duration-300`} style={{ width: magSize, height: magSize }}>
              <div style={{ width: '100%', height: '100%', backgroundImage: `url(${imageSrc})`, backgroundPosition: bgPos, backgroundSize: bgSize, backgroundRepeat: 'no-repeat' }} />
              
              {/* Overlay Bubbles in Magnifier */}
              <div className="absolute inset-0 overflow-hidden">
                {visibleBubbles.map((b, i) => (
                  <div key={i} style={{ 
                    position: 'absolute',
                    left: b.bx - b.br,
                    top: b.by - b.br,
                    width: b.br * 2,
                    height: b.br * 2,
                    borderRadius: '50%',
                    backgroundColor: b.color,
                    border: '1px solid rgba(0,0,0,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: `${b.br * 0.8}px`,
                    fontWeight: 'bold',
                    color: '#1e293b'
                  }}>
                    {b.val}
                  </div>
                ))}
              </div>

              <div className="absolute inset-0 flex items-center justify-center opacity-50">
                  <div className="w-full h-px bg-red-500"></div>
                  <div className="h-full w-px bg-red-500 absolute"></div>
              </div>
          </div>
      );
  };

  return (
    <div className="relative w-full h-full shadow-lg rounded-lg bg-slate-200 border border-slate-300 select-none flex flex-col overflow-hidden" ref={containerRef}>
      <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
          <div className="bg-white rounded-lg shadow-md border border-slate-200 flex flex-col overflow-hidden">
            <button onClick={() => setScale(s => s * 1.25)} className="p-2 hover:bg-slate-100" title="확대"><ZoomIn size={20} /></button>
            <button onClick={() => setScale(s => Math.max(s / 1.25, 0.05))} className="p-2 hover:bg-slate-100 border-t border-b" title="축소"><ZoomOut size={20} /></button>
            <button onClick={() => { if(img && containerRef.current) setScale(Math.min((containerRef.current.clientWidth-40)/img.naturalWidth, (containerRef.current.clientHeight-40)/img.naturalHeight)) }} className="p-2 hover:bg-slate-100" title="화면에 맞추기"><Maximize size={20} /></button>
          </div>
          <div className="bg-black/70 text-white text-xs px-2 py-1 rounded text-center">{(scale * 100).toFixed(0)}%</div>
      </div>
      {renderMagnifier()}
      <div className="flex-1 overflow-auto relative w-full h-full bg-slate-100">
        {img ? (
            <div style={{ width: img.naturalWidth * scale, height: img.naturalHeight * scale, margin: 'auto' }} className="relative shadow-2xl bg-white">
                <canvas ref={canvasRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onContextMenu={(e) => e.preventDefault()} style={{ width: '100%', height: '100%', display: 'block' }} className={isGridMode ? 'cursor-crosshair' : 'cursor-default'} />
            </div>
        ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500">이미지 불러오는 중...</div>
        )}
      </div>
      {isGridMode && (
         <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded-full shadow-lg text-sm font-bold animate-pulse z-20">
            {gridPoints.length === 0 ? "좌측 상단 모서리를 클릭하세요" : "우측 하단 모서리를 클릭하세요"}
         </div>
      )}
    </div>
  );
};

export default MappingCanvas;
