
import { OmrTemplate, GradingResult, GradedGroup, GradedBubble, Point } from '../types';

export class OmrEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    const context = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('캔버스 컨텍스트 에러');
    this.ctx = context;
  }

  async gradeSheet(imageUrl: string, template: OmrTemplate, fileName?: string, isDebug: boolean = false): Promise<GradingResult> {
    const rawImg = await this.loadImage(imageUrl);
    const { alignedCanvas, debugImage } = await this.processAlignment(rawImg, isDebug);
    
    if (isDebug && debugImage) {
        return {
            totalScore: 0, maxScore: 0, groups: [],
            imageUrl: debugImage,
            fileName,
            debugMarkers: {} 
        };
    }

    this.canvas.width = alignedCanvas.width;
    this.canvas.height = alignedCanvas.height;
    this.ctx.fillStyle = 'white';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(alignedCanvas, 0, 0);

    const width = this.canvas.width;
    const height = this.canvas.height;
    const imageData = this.ctx.getImageData(0, 0, width, height);
    const binaryData = this.applyThreshold(imageData, 150); 

    const gradedGroups: GradedGroup[] = [];
    let totalScore = 0;
    let maxScore = 0;

    for (const group of template.groups) {
      const gradedBubbles: GradedBubble[] = [];
      const markedValues: string[] = [];
      for (const bubble of group.bubbles) {
        const px = bubble.x * width;
        const py = bubble.y * height;
        const radius = template.bubbleRadius * width;
        const fillPercentage = this.calculateFillPercentage(binaryData, px, py, radius, width);
        const isMarked = fillPercentage >= (template.threshold || 0.6);
        gradedBubbles.push({ ...bubble, fillPercentage, isMarked });
        if (isMarked) markedValues.push(bubble.value);
      }
      let isCorrect = false;
      let score = 0;
      if (group.type === 'question' && group.correctAnswer) {
        maxScore += group.points || 0;
        isCorrect = this.arraysEqual(markedValues, group.correctAnswer);
        if (isCorrect) { score = group.points || 0; totalScore += score; }
      }
      gradedGroups.push({ ...group, bubbles: gradedBubbles, markedValues, isCorrect, score });
    }

    return {
      totalScore, maxScore, groups: gradedGroups,
      imageUrl: this.canvas.toDataURL('image/jpeg', 0.9),
      fileName
    };
  }

  private async processAlignment(img: HTMLImageElement, isDebug: boolean): Promise<{ alignedCanvas: HTMLCanvasElement, debugImage?: string }> {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w; tempCanvas.height = h;
    const ctx = tempCanvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);
    
    const binary = this.applyThreshold(ctx.getImageData(0, 0, w, h), 110);
    const sW = Math.round(w * 0.20); // 20%로 영역 축소
    const sH = Math.round(h * 0.20);
    
    const candidates = [
      { id: 'TL', pos: this.findMarkerBlock(binary, 0, 0, sW, sH, w, 'TL') },
      { id: 'TR', pos: this.findMarkerBlock(binary, w - sW, 0, sW, sH, w, 'TR') },
      { id: 'BR', pos: this.findMarkerBlock(binary, w - sW, h - sH, sW, sH, w, 'BR') },
      { id: 'BL', pos: this.findMarkerBlock(binary, 0, h - sH, sW, sH, w, 'BL') }
    ];

    let predictedBL: Point | null = null;
    if (candidates[0].pos && candidates[1].pos && candidates[2].pos) {
        predictedBL = {
            x: candidates[0].pos.x + (candidates[2].pos.x - candidates[1].pos.x),
            y: candidates[0].pos.y + (candidates[2].pos.y - candidates[1].pos.y)
        };
    }

    if (isDebug) {
        ctx.lineWidth = 5;
        ctx.font = "bold 40px Arial";
        candidates.forEach(c => {
            if (c.pos && c.id !== 'BL') {
                ctx.strokeStyle = "red"; ctx.fillStyle = "red";
                ctx.beginPath(); ctx.arc(c.pos.x, c.pos.y, 25, 0, Math.PI * 2); ctx.stroke();
                ctx.fillText(c.id, c.pos.x + 35, c.pos.y);
            }
        });
        if (predictedBL) {
            ctx.strokeStyle = "#3b82f6"; ctx.fillStyle = "#3b82f6";
            ctx.setLineDash([10, 10]);
            ctx.beginPath(); ctx.arc(predictedBL.x, predictedBL.y, 25, 0, Math.PI * 2); ctx.stroke();
            ctx.fillText("BL (Predicted)", predictedBL.x + 35, predictedBL.y);
            ctx.setLineDash([]);
        }
        return { alignedCanvas: tempCanvas, debugImage: tempCanvas.toDataURL('image/jpeg', 0.8) };
    }

    if (candidates[0].pos && candidates[1].pos && candidates[2].pos) {
      const tl = candidates[0].pos!, tr = candidates[1].pos!, br = candidates[2].pos!;
      return { alignedCanvas: this.warpImage(img, tl, tr, br) };
    }
    
    const found = candidates.filter(c => c.pos !== null);
    if (found.length === 3) {
        const missing = candidates.find(c => c.pos === null)!.id;
        let rotation = 0;
        if (missing === 'TL') rotation = 90;
        else if (missing === 'TR') rotation = 180;
        else if (missing === 'BR') rotation = 270;

        if (rotation !== 0) {
            const rotated = this.rotateCanvas(img, rotation);
            return this.processAlignment(await this.canvasToImage(rotated), false);
        }
    }

    return { alignedCanvas: tempCanvas };
  }

  private warpImage(img: HTMLImageElement, tl: Point, tr: Point, br: Point): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    const targetW = 1414; const targetH = 1000;
    canvas.width = targetW; canvas.height = targetH;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, targetW, targetH);

    const dx = tr.x - tl.x; const dy = tr.y - tl.y;
    const angle = Math.atan2(dy, dx);
    const distH = Math.sqrt(dx * dx + dy * dy);
    const dxV = br.x - tr.x; const dyV = br.y - tr.y;
    const distV = Math.sqrt(dxV * dxV + dyV * dyV);

    ctx.save();
    ctx.scale(targetW / distH, targetH / distV);
    ctx.rotate(-angle);
    ctx.translate(-tl.x, -tl.y);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
    return canvas;
  }

  private findMarkerBlock(binary: Uint8Array, sx: number, sy: number, sw: number, sh: number, imgWidth: number, id: string): Point | null {
    const visited = new Uint8Array(sw * sh);
    let bestScore = -1;
    let bestPoint: Point | null = null;

    for (let y = 0; y < sh; y += 4) { 
      for (let x = 0; x < sw; x += 4) {
        if (binary[(sy + y) * imgWidth + (sx + x)] === 0 && visited[y * sw + x] === 0) {
            const blob = this.bfs(binary, visited, sx, sy, sw, sh, x, y, imgWidth);
            
            const bW = blob.maxX - blob.minX;
            const bH = blob.maxY - blob.minY;
            const area = bW * bH;
            const solidity = blob.size / area; // 밀도 (0.0 ~ 1.0)
            const aspectRatio = bW / bH;

            // --- 마커 필터링 로직 ---
            // 1. 크기: 최소 150픽셀 이상
            // 2. 밀도: 0.7 이상 (글씨는 보통 0.5 미만)
            // 3. 형태: 가로세로 비율이 0.5 ~ 2.0 사이 (정사각형에 가까워야 함)
            if (blob.size > 150 && solidity > 0.7 && aspectRatio > 0.5 && aspectRatio < 2.0) {
                // 마커다움(Score) = 크기 * 밀도
                const score = blob.size * solidity;
                if (score > bestScore) {
                    bestScore = score;
                    if (id === 'TL') bestPoint = { x: blob.minX, y: blob.minY };
                    else if (id === 'TR') bestPoint = { x: blob.maxX, y: blob.minY };
                    else if (id === 'BR') bestPoint = { x: blob.maxX, y: blob.maxY };
                    else if (id === 'BL') bestPoint = { x: blob.minX, y: blob.maxY };
                }
            }
        }
      }
    }
    return bestPoint;
  }

  private bfs(binary: Uint8Array, visited: Uint8Array, sx: number, sy: number, sw: number, sh: number, startX: number, startY: number, imgWidth: number) {
      const queue = [startX, startY];
      visited[startY * sw + startX] = 1;
      let size = 0;
      let minX = sx + startX, maxX = sx + startX, minY = sy + startY, maxY = sy + startY;
      let head = 0;
      while(head < queue.length) {
          const cx = queue[head++]; const cy = queue[head++];
          const gx = sx + cx; const gy = sy + cy;
          size++;
          if (gx < minX) minX = gx; if (gx > maxX) maxX = gx;
          if (gy < minY) minY = gy; if (gy > maxY) maxY = gy;
          const neighbors = [cx + 1, cy, cx - 1, cy, cx, cy + 1, cx, cy - 1];
          for (let i = 0; i < neighbors.length; i += 2) {
              const nx = neighbors[i], ny = neighbors[i+1];
              if (nx >= 0 && nx < sw && ny >= 0 && ny < sh) {
                  const nIdx = ny * sw + nx;
                  if (visited[nIdx] === 0 && binary[(sy + ny) * imgWidth + (sx + nx)] === 0) {
                      visited[nIdx] = 1;
                      queue.push(nx, ny);
                  }
              }
          }
      }
      return { size, minX, maxX, minY, maxY };
  }

  private rotateCanvas(img: HTMLImageElement, degrees: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const w = img.naturalWidth, h = img.naturalHeight;
    if (degrees === 90 || degrees === 270) { canvas.width = h; canvas.height = w; }
    else { canvas.width = w; canvas.height = h; }
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((degrees * Math.PI) / 180);
    ctx.drawImage(img, -w / 2, -h / 2);
    return canvas;
  }

  private async canvasToImage(canvas: HTMLCanvasElement): Promise<HTMLImageElement> {
    return this.loadImage(canvas.toDataURL('image/jpeg', 0.9));
  }

  private calculateFillPercentage(binaryData: Uint8Array, cx: number, cy: number, radius: number, imgWidth: number): number {
    let black = 0, total = 0;
    const r = Math.round(radius);
    for (let y = Math.round(cy - r); y <= Math.round(cy + r); y++) {
      for (let x = Math.round(cx - r); x <= Math.round(cx + r); x++) {
        const idx = y * imgWidth + x;
        if (idx < 0 || idx >= binaryData.length) continue;
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy <= r * r) { if (binaryData[idx] === 0) black++; total++; }
      }
    }
    return total === 0 ? 0 : black / total;
  }

  private applyThreshold(imageData: ImageData, threshold: number): Uint8Array {
    const data = imageData.data;
    const binary = new Uint8Array(imageData.width * imageData.height);
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
      binary[i / 4] = avg < threshold ? 0 : 255;
    }
    return binary;
  }

  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('이미지 로드 실패'));
      img.src = url;
    });
  }

  private arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const sA = [...a].sort(), sB = [...b].sort();
    return sA.every((v, i) => v === sB[i]);
  }
}
