
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { ScanEye, Check, X } from 'lucide-react';

interface Point {
  x: number;
  y: number;
}

interface AlignmentEditorProps {
  imageUrl: string;
  onComplete: (processedUrl: string) => void;
  onCancel: () => void;
}

export const AlignmentEditor: React.FC<AlignmentEditorProps> = ({ imageUrl, onComplete, onCancel }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  
  // OMR 구조에 따라 TL, TR, BR 세 점만 관리
  const [corners, setCorners] = useState<{ tl: Point, tr: Point, br: Point }>({
    tl: { x: 0.1, y: 0.1 },
    tr: { x: 0.9, y: 0.1 },
    br: { x: 0.9, y: 0.9 }
  });
  
  // BL(좌측 하단)은 TL, TR, BR을 기반으로 자동 계산 (평행사변형 원리)
  const bl = useMemo(() => ({
    x: corners.tl.x + (corners.br.x - corners.tr.x),
    y: corners.tl.y + (corners.br.y - corners.tr.y)
  }), [corners]);

  const [dragging, setDragging] = useState<keyof typeof corners | null>(null);

  useEffect(() => {
    const image = new Image();
    image.src = imageUrl;
    image.onload = () => setImg(image);
  }, [imageUrl]);

  const handleDragStart = (key: keyof typeof corners) => (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setDragging(key);
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!dragging || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

      let x = (clientX - rect.left) / rect.width;
      let y = (clientY - rect.top) / rect.height;

      x = Math.max(0, Math.min(1, x));
      y = Math.max(0, Math.min(1, y));

      setCorners(prev => ({ ...prev, [dragging]: { x, y } }));
    };

    const handleUp = () => setDragging(null);

    if (dragging) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('touchmove', handleMove);
      window.addEventListener('mouseup', handleUp);
      window.addEventListener('touchend', handleUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchend', handleUp);
    };
  }, [dragging]);

  const applyWarp = () => {
    if (!img) return;

    const canvas = document.createElement('canvas');
    const targetW = 1000;
    const targetH = 1414;
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, targetW, targetH);

    // 실제 픽셀 좌표로 변환
    const src = {
      tl: { x: corners.tl.x * img.naturalWidth, y: corners.tl.y * img.naturalHeight },
      tr: { x: corners.tr.x * img.naturalWidth, y: corners.tr.y * img.naturalHeight },
      br: { x: corners.br.x * img.naturalWidth, y: corners.br.y * img.naturalHeight }
    };

    // 마커 기준 Crop & Stretch
    ctx.drawImage(img, 
      src.tl.x, src.tl.y, (src.tr.x - src.tl.x), (src.br.y - src.tr.y), 
      0, 0, targetW, targetH
    );

    onComplete(canvas.toDataURL('image/jpeg', 0.9));
  };

  return (
    <div className="w-full h-full bg-slate-900 flex flex-col items-center p-6 overflow-hidden">
      <div className="w-full max-w-4xl flex-1 flex flex-col min-h-0">
        <div className="bg-slate-800 p-4 rounded-t-xl border-x border-t border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold flex items-center gap-2">
              <ScanEye size={20} className="text-blue-400" />
              수동 영역 보정 (3점 기준)
            </h2>
            <p className="text-xs text-slate-400">좌측 상단, 우측 상단, 우측 하단의 마커에 맞춰 파란 점을 드래그하세요.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={onCancel} className="px-4 py-2 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-600 transition-colors">취소</button>
            <button onClick={applyWarp} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 flex items-center gap-2 shadow-lg shadow-blue-900/20">
              <Check size={16} /> 보정 적용
            </button>
          </div>
        </div>

        <div className="flex-1 bg-slate-950 border border-slate-700 relative overflow-hidden flex items-center justify-center">
          {img ? (
            <div ref={containerRef} className="relative shadow-2xl" style={{ 
              width: '100%', 
              height: '100%', 
              maxHeight: 'calc(90vh - 200px)',
              aspectRatio: `${img.naturalWidth} / ${img.naturalHeight}` 
            }}>
              <img src={imageUrl} className="w-full h-full object-contain pointer-events-none select-none" alt="Preview" />
              
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                <polygon
                  points={`
                    ${corners.tl.x * 100}% ${corners.tl.y * 100}%,
                    ${corners.tr.x * 100}% ${corners.tr.y * 100}%,
                    ${corners.br.x * 100}% ${corners.br.y * 100}%,
                    ${bl.x * 100}% ${bl.y * 100}%
                  `}
                  fill="rgba(59, 130, 246, 0.2)"
                  stroke="#3b82f6"
                  strokeWidth="2"
                  strokeDasharray="4"
                />
              </svg>

              {/* TL, TR, BR 핸들만 렌더링 */}
              {(Object.keys(corners) as Array<keyof typeof corners>).map((key) => (
                <div
                  key={key}
                  onMouseDown={handleDragStart(key)}
                  onTouchStart={handleDragStart(key)}
                  className="absolute w-10 h-10 -ml-5 -mt-5 bg-blue-500 border-4 border-white rounded-full shadow-2xl cursor-move flex items-center justify-center z-20 hover:scale-125 transition-transform"
                  style={{ left: `${corners[key].x * 100}%`, top: `${corners[key].y * 100}%` }}
                >
                  <div className="w-2 h-2 bg-white rounded-full" />
                  <span className="absolute -top-6 bg-blue-600 text-white text-[10px] px-1 rounded">{key.toUpperCase()}</span>
                </div>
              ))}

              {/* BL은 핸들 없이 위치만 표시 (자동 계산됨) */}
              <div
                className="absolute w-6 h-6 -ml-3 -mt-3 border-2 border-blue-400 border-dashed rounded-full flex items-center justify-center opacity-50"
                style={{ left: `${bl.x * 100}%`, top: `${bl.y * 100}%` }}
              >
                <span className="text-[8px] text-blue-400 font-bold">BL</span>
              </div>
            </div>
          ) : (
            <div className="text-slate-500 flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              이미지 로드 중...
            </div>
          )}
        </div>
        <div className="bg-slate-800 p-3 rounded-b-xl border-x border-b border-slate-700 text-center text-slate-500 text-[10px]">
           * 마커가 없는 좌측 하단(BL)은 자동으로 계산됩니다.
        </div>
      </div>
    </div>
  );
};
