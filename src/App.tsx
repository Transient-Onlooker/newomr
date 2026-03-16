import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Settings, Check, FileText, Play, Plus, Trash2, ArrowRight, HelpCircle, Save, FolderOpen, Grid, MousePointer2, Edit2, RotateCcw, RotateCw, X, FileDown, FileUp, SlidersHorizontal, Hash, KeyRound, Layers, Download, ChevronLeft, Loader2, ScanEye, Crop, AlertTriangle } from 'lucide-react';
import MappingCanvas from './components/MappingCanvas';
import ResultsView from './components/ResultsView';
import { AlignmentEditor } from './components/AlignmentEditor';
import { OmrTemplate, BubbleGroup, Bubble, GradingResult } from './types';
import { OmrEngine } from './utils/omrEngine';

// Initial Empty Template
const initialTemplate: OmrTemplate = {
  imageUrl: '',
  bubbleRadius: 0.012,
  threshold: 0.6,
  groups: [],
};

export default function App() {
  // Application State
  const [step, setStep] = useState<'upload_template' | 'mapping' | 'upload_filled' | 'grading' | 'results'>('upload_template');
  const [template, setTemplate] = useState<OmrTemplate>(initialTemplate);

  const [filledImage, setFilledImage] = useState<string | null>(null);
  const [originalFilledImage, setOriginalFilledImage] = useState<string | null>(null);
  const [filledFileName, setFilledFileName] = useState<string | undefined>(undefined);
  const [result, setResult] = useState<GradingResult | null>(null);
  const [isGrading, setIsGrading] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [detectedMarkers, setDetectedMarkers] = useState<{tl?: Point, tr?: Point, br?: Point, bl?: Point} | null>(null);

  // Alignment State
  const [rawImageForAlignment, setRawImageForAlignment] = useState<string | null>(null);
  const [isAlignmentEditorOpen, setIsAlignmentEditorOpen] = useState(false);

  // Mapping State
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [activeValue, setActiveValue] = useState<string | null>(null);
  const [newGroupLabel, setNewGroupLabel] = useState('');
  const [newGroupType, setNewGroupType] = useState<'identity' | 'question'>('question');
  const [newGroupPoints, setNewGroupPoints] = useState(1);
  const [newGroupCorrect, setNewGroupCorrect] = useState('');

  // Edit Mode State
  const [editingGroup, setEditingGroup] = useState<BubbleGroup | null>(null);
  const [isEditingRadius, setIsEditingRadius] = useState(false);
  const [isEditingThreshold, setIsEditingThreshold] = useState(false);

  // History State for Undo/Redo
  const [undoStack, setUndoStack] = useState<BubbleGroup[][]>([]);
  const [redoStack, setRedoStack] = useState<BubbleGroup[][]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);

  // --- History Management ---
  const saveHistory = useCallback(() => {
    setUndoStack(prev => [...prev, JSON.parse(JSON.stringify(template.groups))]);
    setRedoStack([]); // New action clears redo stack
  }, [template.groups]);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    const current = JSON.parse(JSON.stringify(template.groups));
    
    setRedoStack(prev => [...prev, current]);
    setUndoStack(prev => prev.slice(0, -1));
    setTemplate(prev => ({ ...prev, groups: previous }));
  }, [undoStack, template.groups]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    const current = JSON.parse(JSON.stringify(template.groups));

    setUndoStack(prev => [...prev, current]);
    setRedoStack(prev => prev.slice(0, -1));
    setTemplate(prev => ({ ...prev, groups: next }));
  }, [redoStack, template.groups]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          e.preventDefault();
          undo();
        } else if (e.key === 'y') {
          e.preventDefault();
          redo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // Grid Generator State
  const [isGridMode, setIsGridMode] = useState(false);
  const [gridPoints, setGridPoints] = useState<{x:number, y:number}[]>([]);
  const [gridStartNo, setGridStartNo] = useState(1);
  const [gridRows, setGridRows] = useState(20);
  const [gridCols, setGridCols] = useState(1);
  const [gridOptions, setGridOptions] = useState("1,2,3,4,5");
  const [gridDirection, setGridDirection] = useState<'horizontal' | 'vertical'>('vertical');
  const [gridType, setGridType] = useState<'question' | 'identity'>('question');

  // Batch Edit Mode State
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchSelectedBubbles, setBatchSelectedBubbles] = useState<{groupId: string, index: number}[]>([]);
  const [batchActiveValue, setBatchActiveValue] = useState<string | null>(null);

  // --- Handlers ---
  const handleTemplateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const imageUrl = event.target?.result as string;
        setIsGrading(true); // 로딩 표시 활용
        try {
          const engine = new OmrEngine();
          // 정렬된 이미지를 가져옴 (gradeSheet 대신 내부 정렬 로직 활용을 위해 
          // 임시로 빈 템플릿으로 gradeSheet 호출하여 정렬된 이미지만 추출)
          const result = await engine.gradeSheet(imageUrl, { ...initialTemplate, groups: [] });
          setTemplate(prev => ({ ...prev, imageUrl: result.imageUrl }));
          setStep('mapping');
        } catch (error) {
          console.error("Template alignment failed:", error);
          setTemplate(prev => ({ ...prev, imageUrl }));
          setStep('mapping');
        } finally {
          setIsGrading(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFilledUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFilledFileName(file.name);
      const reader = new FileReader();
      reader.onload = async (event) => {
        const url = event.target?.result as string;
        setIsGrading(true); // 정렬 중 로딩 표시
        try {
          const engine = new OmrEngine();
          // 채점 로직의 정렬 부분만 활용하기 위해 빈 템플릿으로 호출
          const aligned = await engine.gradeSheet(url, { ...initialTemplate, groups: [] });
          setFilledImage(aligned.imageUrl);
          setOriginalFilledImage(aligned.imageUrl); // 잘린 상태를 원본으로 간주
          setStep('grading');
          setIsDebugMode(false);
        } catch (error) {
          console.error("Filled sheet alignment failed:", error);
          setFilledImage(url);
          setOriginalFilledImage(url);
          setStep('grading');
        } finally {
          setIsGrading(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleManualAlignment = (corners: any) => {
    if (!rawImageForAlignment) return;
    setIsAlignmentEditorOpen(false);
    // Manual alignment logic can be added here if needed
    if (step === 'mapping') {
      setTemplate(prev => ({ ...prev, imageUrl: rawImageForAlignment }));
    } else if (step === 'grading' || step === 'upload_filled') {
      setFilledImage(rawImageForAlignment);
      setStep('grading');
    }
  };

  const addGroup = () => {
    if (!newGroupLabel) return;
    saveHistory();
    const newGroup: BubbleGroup = {
      id: crypto.randomUUID(),
      label: newGroupLabel,
      type: newGroupType,
      bubbles: [],
      points: newGroupType === 'question' ? newGroupPoints : undefined,
      correctAnswer: newGroupType === 'question' ? (newGroupCorrect ? newGroupCorrect.split(',').map(s => s.trim()) : []) : undefined
    };
    setTemplate(prev => ({
      ...prev,
      groups: [...prev.groups, newGroup]
    }));
    setNewGroupLabel('');
    setActiveGroupId(newGroup.id);
    setActiveValue(newGroupType === 'identity' ? '0' : '1');
  };

  const saveGroupEdit = () => {
      if (!editingGroup) return;
      setTemplate(prev => ({
          ...prev,
          groups: prev.groups.map(g => g.id === editingGroup.id ? editingGroup : g)
      }));
      setEditingGroup(null);
  };

  const deleteGroup = (id: string) => {
      saveHistory();
      setTemplate(prev => ({
          ...prev,
          groups: prev.groups.filter(g => g.id !== id)
      }));
      if (activeGroupId === id) setActiveGroupId(null);
  };

  const handleClearAll = () => {
    if (template.groups.length === 0) return;
    saveHistory();
    setTemplate(prev => ({ ...prev, groups: [] }));
    setActiveGroupId(null);
    setEditingGroup(null);
  };

  const handleAddBubble = (groupId: string, bubble: Bubble) => {
    saveHistory();
    const groupIndex = template.groups.findIndex(g => g.id === groupId);
    if (groupIndex === -1) return;
    const group = template.groups[groupIndex];
    const existingIndex = group.bubbles.findIndex(b => b.value === bubble.value);
    let newBubbles = [...group.bubbles];
    if (existingIndex !== -1) {
        newBubbles[existingIndex] = bubble;
    } else {
        newBubbles.push(bubble);
    }
    const newGroups = [...template.groups];
    newGroups[groupIndex] = { ...group, bubbles: newBubbles };
    setTemplate({ ...template, groups: newGroups });
  };

  const handleUpdateBubble = (groupId: string, bubbleIndex: number, newBubble: Bubble) => {
      saveHistory();
      const groupIndex = template.groups.findIndex(g => g.id === groupId);
      if (groupIndex === -1) return;
      const group = template.groups[groupIndex];
      const newBubbles = [...group.bubbles];
      newBubbles[bubbleIndex] = newBubble;
      const newGroups = [...template.groups];
      newGroups[groupIndex] = { ...group, bubbles: newBubbles };
      setTemplate({ ...template, groups: newGroups });
  };

  const handleDeleteBubble = (groupId: string, bubbleIndex: number) => {
    saveHistory();
    const groupIndex = template.groups.findIndex(g => g.id === groupId);
    if (groupIndex === -1) return;
    const group = template.groups[groupIndex];
    const newBubbles = [...group.bubbles];
    newBubbles.splice(bubbleIndex, 1);
    const newGroups = [...template.groups];
    newGroups[groupIndex] = { ...group, bubbles: newBubbles };
    setTemplate({ ...template, groups: newGroups });
  };

  const startGridTool = () => {
    if (isGridMode) {
      setIsGridMode(false);
      setGridPoints([]);
    } else {
      setIsGridMode(true);
      setGridPoints([]);
      setActiveGroupId(null);
      // 일괄 수정 모드 해제
      if (isBatchMode) {
        setIsBatchMode(false);
        setBatchSelectedBubbles([]);
        setBatchActiveValue(null);
      }
    }
  };

  const toggleBatchMode = () => {
    if (isBatchMode) {
      setIsBatchMode(false);
      setBatchSelectedBubbles([]);
      setBatchActiveValue(null);
      setActiveGroupId(null);
    } else {
      setIsBatchMode(true);
      setIsGridMode(false);
      setGridPoints([]);
      setActiveGroupId(null);
      setBatchSelectedBubbles([]);
      setBatchActiveValue(null);
    }
  };

  const handleBatchValueChange = (value: string) => {
    if (!batchActiveValue) {
      setBatchActiveValue(value);
    }
    if (batchSelectedBubbles.length === 0) return;

    saveHistory();
    const newGroups = template.groups.map(group => {
      const relevantIndices = batchSelectedBubbles
        .filter(b => b.groupId === group.id)
        .map(b => b.index);

      if (relevantIndices.length === 0) return group;

      const newBubbles = group.bubbles.map((bubble, idx) => {
        if (relevantIndices.includes(idx)) {
          return { ...bubble, value };
        }
        return bubble;
      });

      return { ...group, bubbles: newBubbles };
    });

    setTemplate({ ...template, groups: newGroups });
    // 일괄 수정 완료 후 선택 초기화
    setBatchSelectedBubbles([]);
    setBatchActiveValue(null);
  };

  const handleBatchRadiusChange = (delta: number) => {
    if (batchSelectedBubbles.length === 0) return;

    saveHistory();
    const newGroups = template.groups.map(group => {
      const relevantIndices = batchSelectedBubbles
        .filter(b => b.groupId === group.id)
        .map(b => b.index);

      if (relevantIndices.length === 0) return group;

      const newBubbles = group.bubbles.map((bubble, idx) => {
        if (relevantIndices.includes(idx)) {
          return { ...bubble, y: bubble.y + delta };
        }
        return bubble;
      });

      return { ...group, bubbles: newBubbles };
    });

    setTemplate({ ...template, groups: newGroups });
    // 선택 상태는 유지하여 연속 조절 가능
  };

  const handleBatchSizeChange = (delta: number) => {
    if (batchSelectedBubbles.length === 0) return;

    saveHistory();
    const newRadius = Math.max(0.005, Math.min(0.1, template.bubbleRadius + delta));

    setTemplate({ ...template, bubbleRadius: newRadius });
    // 선택 상태는 유지하여 연속 조절 가능
  };

  const handleGridClick = (x: number, y: number) => {
    setGridPoints(prev => {
      const next = [...prev, { x, y }];
      if (next.length === 2) {
        // 상태 업데이트 후 실행되도록 setTimeout 사용
        setTimeout(() => {
          generateGrid(next[0], next[1]);
          setIsGridMode(false);
          setGridPoints([]);
        }, 0);
      }
      return next;
    });
  };

  const generateGrid = (p1: {x:number, y:number}, p2: {x:number, y:number}) => {
    const options = gridOptions.split(',').map(s => s.trim()).filter(s => s);
    if (options.length === 0) return;
    saveHistory();
    
    const newGroups: BubbleGroup[] = [];
    const numRows = gridRows;
    const numCols = gridCols;
    const numBubblesPerGroup = options.length;

    const minX = Math.min(p1.x, p2.x);
    const maxX = Math.max(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y);
    const maxY = Math.max(p1.y, p2.y);

    const totalW = maxX - minX;
    const totalH = maxY - minY;

    // 열(Column) 하나의 너비
    const colWidth = numCols > 1 ? totalW / (numCols - 1 + 0.5) : totalW;
    // 행(Row) 하나의 높이
    const rowStep = numRows > 1 ? totalH / (numRows - 1) : 0;
    const colStep = numCols > 1 ? totalW / (numCols - 1) : 0;

    // 문항 내 버블 간격 (문항 너비의 90%를 사용)
    const bubbleAreaW = numCols > 1 ? (colWidth * 0.8) : totalW;
    const bubbleStepX = numBubblesPerGroup > 1 ? bubbleAreaW / (numBubblesPerGroup - 1) : 0;

    let count = 0;
    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
        const groupBubbles: Bubble[] = [];
        const currentLabel = (gridStartNo + count).toString();
        
        // 문항의 시작점 (좌측 상단 버블 위치)
        const gx = minX + (c * colStep);
        const gy = minY + (r * rowStep);

        for (let b = 0; b < numBubblesPerGroup; b++) {
          groupBubbles.push({
            value: options[b],
            x: gx + (b * bubbleStepX),
            y: gy
          });
        }

        newGroups.push({
          id: crypto.randomUUID(),
          label: currentLabel,
          type: gridType,
          bubbles: groupBubbles,
          points: gridType === 'question' ? newGroupPoints : undefined,
          correctAnswer: gridType === 'question' ? [] : undefined
        });
        count++;
      }
    }

    setTemplate(prev => ({
      ...prev,
      groups: [...prev.groups, ...newGroups]
    }));
    setGridStartNo(prev => prev + (numRows * numCols));
  };

  const saveTemplate = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(template));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "omr_template.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const loadTemplate = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
        try {
            const loaded = JSON.parse(evt.target?.result as string);
            if (loaded.groups && Array.isArray(loaded.groups)) {
                setTemplate(loaded);
                setActiveGroupId(null);
                setStep('mapping');
            } else {
                alert("Invalid template file format.");
            }
        } catch(err) {
            alert("Failed to parse JSON.");
        }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const exportAnswerKey = () => {
      const questions = template.groups.filter(g => g.type === 'question');
      questions.sort((a, b) => {
         const na = parseInt(a.label);
         const nb = parseInt(b.label);
         if (!isNaN(na) && !isNaN(nb)) return na - nb;
         return a.label.localeCompare(b.label);
      });
      let content = "Label | Points | Answer\n";
      content += "-----------------------\n";
      questions.forEach(q => {
          const pts = (q.points !== undefined && q.points !== null) ? q.points : '-';
          let ans = '-';
          if (q.correctAnswer && q.correctAnswer.length > 0) {
              const joined = q.correctAnswer.join(',').trim();
              if (joined !== '') ans = joined;
          }
          content += `${q.label} | ${pts} | ${ans}\n`;
      });
      const dataStr = "data:text/plain;charset=utf-8," + encodeURIComponent(content);
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", "answer_key.txt");
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
  };

  const importAnswerKey = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
          const text = evt.target?.result as string;
          const lines = text.split('\n');
          let newGroups = [...template.groups];
          let updatedCount = 0;
          lines.forEach(line => {
              line = line.trim();
              if (!line || line.startsWith('Label') || line.startsWith('--')) return;
              const parts = line.split('|').map(p => p.trim());
              if (parts.length >= 3) {
                  const label = parts[0];
                  const pointsStr = parts[1];
                  const ansStr = parts[2];
                  const gIndex = newGroups.findIndex(g => g.label === label && g.type === 'question');
                  if (gIndex !== -1) {
                      const group = { ...newGroups[gIndex] };
                      if (pointsStr === '-') {
                          group.points = undefined;
                      } else {
                          const pts = parseFloat(pointsStr);
                          if (!isNaN(pts)) group.points = pts;
                      }
                      if (ansStr === '-') {
                          group.correctAnswer = undefined;
                      } else {
                          const parsedAns = ansStr.split(',').map(s => s.trim()).filter(s => s);
                          if (parsedAns.length > 0) {
                             group.correctAnswer = parsedAns;
                          } else {
                             group.correctAnswer = undefined;
                          }
                      }
                      newGroups[gIndex] = group;
                      updatedCount++;
                  }
              }
          });
          if (updatedCount > 0) {
              setTemplate({ ...template, groups: newGroups });
              alert(`Updated ${updatedCount} questions from file.`);
          } else {
              alert("No matching labels found or invalid file format.");
          }
      };
      reader.readAsText(file);
      e.target.value = '';
  };

  // Debug: Auto-detect markers when image changes or debug mode is enabled
  useEffect(() => {
    const detect = async () => {
      if (isDebugMode && originalFilledImage && step === 'grading') {
        try {
          const engine = new OmrEngine();
          const res = await engine.gradeSheet(originalFilledImage, { ...initialTemplate, groups: [] }, undefined, true);
          if (res.imageUrl) {
             setFilledImage(res.imageUrl);
          }
        } catch (e) { console.error(e); }
      } else if (!isDebugMode && originalFilledImage && step === 'grading') {
         setFilledImage(originalFilledImage); // 복구
      }
    };
    detect();
  }, [isDebugMode, originalFilledImage, step]);

  const runGrading = async () => {
    if (!originalFilledImage) return;
    setIsGrading(true);
    try {
      const engine = new OmrEngine();
      const gradingResult = await engine.gradeSheet(originalFilledImage, template, filledFileName, false);
      
      const newUrl = gradingResult.imageUrl;
      setFilledImage(newUrl);
      setOriginalFilledImage(newUrl); // 크롭된 상태를 유지
      setResult(gradingResult);
      setStep('results');
    } catch (error) {
      console.error("Grading failed:", error);
      alert("채점 중 오류가 발생했습니다.");
    } finally {
      setIsGrading(false);
    }
  };

  // --- Render Steps ---

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white">
              <ScanEye size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">스마트 OMR 채점기</h1>
              <p className="text-xs text-gray-500">오픈 소스 채점 도구</p>
            </div>
          </div>
          
          {/* Step Indicator */}
          <div className="flex items-center gap-2">
            {['upload_template', 'mapping', 'upload_filled', 'grading', 'results'].map((s, i) => {
              const steps = ['upload_template', 'mapping', 'upload_filled', 'grading', 'results'];
              const stepLabels: Record<string, string> = {
                'upload_template': '템플릿 업로드',
                'mapping': '마킹 영역 설정',
                'upload_filled': '답안지 업로드',
                'grading': '채점 진행',
                'results': '결과 확인'
              };
              const currentIndex = steps.indexOf(step);
              const stepIndex = steps.indexOf(s);
              const isActive = step === s;
              const isCompleted = stepIndex < currentIndex;
              
              return (
                <React.Fragment key={s}>
                  <div 
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      isActive ? 'bg-blue-600 text-white' : 
                      isCompleted ? 'bg-green-500 text-white' : 
                      'bg-gray-200 text-gray-500'
                    }`}
                    title={stepLabels[s]}
                  >
                    {isCompleted ? <Check size={16} /> : i + 1}
                  </div>
                  {i < 4 && <ArrowRight size={16} className="text-gray-300" />}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {step === 'upload_template' && (
          <div className="max-w-md mx-auto">
            <div className="bg-white p-8 rounded-2xl shadow-xl text-center space-y-6">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto text-blue-600">
                <Upload size={32} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">템플릿 업로드</h2>
                <p className="text-gray-500">매핑을 시작하려면 빈 OMR 시트를 업로드하세요.</p>
              </div>
              <label className="block w-full cursor-pointer">
                <div className="w-full h-40 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center hover:border-blue-500 transition-colors">
                  <span className="text-gray-400 font-medium hover:text-blue-500">이미지 파일 선택</span>
                </div>
                <input type="file" accept="image/*" onChange={handleTemplateUpload} className="hidden" />
              </label>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
              >
                파일 선택
              </button>
            </div>
          </div>
        )}

        {step === 'mapping' && template.imageUrl && (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="bg-white rounded-xl shadow p-4 flex flex-wrap gap-2 items-center justify-between">
              <div className="flex gap-2 flex-wrap items-center">
                <button
                  onClick={() => setStep('upload_template')}
                  className="p-2 mr-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1"
                  title="템플릿 업로드로 돌아가기"
                >
                  <ChevronLeft size={20} />
                  <span className="text-sm font-medium">뒤로</span>
                </button>
                <div className="h-8 w-px bg-gray-200 mr-2"></div>
                <input
                  type="text"
                  placeholder="그룹 라벨 (예: Q1, ID)"
                  value={newGroupLabel}
                  onChange={(e) => setNewGroupLabel(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-40"
                />
                <select
                  value={newGroupType}
                  onChange={(e) => setNewGroupType(e.target.value as 'identity' | 'question')}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="question">문항</option>
                  <option value="identity">수험번호/성명</option>
                </select>
                {newGroupType === 'question' && (
                  <>
                    <input
                      type="number"
                      placeholder="배점"
                      value={newGroupPoints}
                      onChange={(e) => setNewGroupPoints(parseInt(e.target.value) || 1)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-20"
                    />
                    <input
                      type="text"
                      placeholder="정답 (예: A,B,C)"
                      value={newGroupCorrect}
                      onChange={(e) => setNewGroupCorrect(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-36"
                    />
                  </>
                )}
                <button onClick={addGroup} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1">
                  <Plus size={16} /> 그룹 추가
                </button>
              </div>
              <div className="flex gap-2">
                <button onClick={toggleBatchMode} className={`px-4 py-2 rounded-lg border flex items-center gap-1 ${isBatchMode ? 'bg-purple-50 border-purple-300 text-purple-600' : 'bg-white border-gray-300'}`}>
                  <MousePointer2 size={16} /> 일괄 수정 모드
                </button>
                <button onClick={startGridTool} className={`px-4 py-2 rounded-lg border flex items-center gap-1 ${isGridMode ? 'bg-red-50 border-red-300 text-red-600' : 'bg-white border-gray-300'}`}>
                  <Grid size={16} /> 그리드 모드
                </button>
                <button onClick={saveTemplate} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1">
                  <Save size={16} /> 저장
                </button>
                <label className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-1 cursor-pointer">
                  <FolderOpen size={16} /> 불러오기
                  <input type="file" accept=".json" onChange={loadTemplate} className="hidden" />
                </label>
                <button onClick={handleClearAll} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 flex items-center gap-1">
                  <Trash2 size={16} /> 모두 삭제
                </button>
              </div>
            </div>

            {/* Groups List */}
            <div className="bg-white rounded-xl shadow p-4">
              <h3 className="font-semibold text-gray-700 mb-3">그룹 ({template.groups.length})</h3>
              <div className="flex flex-wrap gap-2">
                {template.groups.map(group => (
                  <div
                    key={group.id}
                    className={`px-3 py-2 rounded-lg border cursor-pointer flex items-center gap-2 ${
                      activeGroupId === group.id ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-200'
                    }`}
                    onClick={() => {
                      setActiveGroupId(group.id);
                      setEditingGroup(group);
                    }}
                  >
                    <span className="font-medium text-sm">{group.label}</span>
                    <span className="text-xs text-gray-500">({group.bubbles.length})</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteGroup(group.id); }}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Value Selector */}
            {activeGroupId && !isBatchMode && (
              <div className="bg-white rounded-xl shadow p-4">
                <h3 className="font-semibold text-gray-700 mb-3">매핑할 값 선택</h3>
                <div className="flex gap-2 flex-wrap">
                  {['0','1','2','3','4','5','6','7','8','9','A','B','C','D','E'].map(val => (
                    <button
                      key={val}
                      onClick={() => setActiveValue(val)}
                      className={`w-10 h-10 rounded-lg font-semibold transition-colors ${
                        activeValue === val ? 'bg-green-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
                <p className="text-sm text-gray-500 mt-2">캔버스를 클릭하여 마킹 영역을 배치하세요. 우클릭 시 삭제됩니다.</p>
              </div>
            )}

            {/* Batch Mode Value Selector */}
            {isBatchMode && batchSelectedBubbles.length > 0 && (
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                <h3 className="font-semibold text-purple-700 mb-3">선택된 버블 일괄 수정</h3>
                <div className="flex gap-2 flex-wrap mb-3">
                  {['0','1','2','3','4','5','6','7','8','9','A','B','C','D','E'].map(val => (
                    <button
                      key={val}
                      onClick={() => handleBatchValueChange(val)}
                      className={`w-10 h-10 rounded-lg font-semibold transition-colors ${
                        batchActiveValue === val ? 'bg-purple-500 text-white' : 'bg-white hover:bg-purple-100 border border-purple-200'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 items-center flex-wrap">
                  <span className="text-sm font-medium text-purple-700">위치 조절:</span>
                  <button
                    onClick={() => handleBatchRadiusChange(-0.005)}
                    className="px-3 py-1 bg-white border border-purple-200 rounded hover:bg-purple-100 text-purple-700 text-sm"
                  >
                    ↑ 위로
                  </button>
                  <button
                    onClick={() => handleBatchRadiusChange(0.005)}
                    className="px-3 py-1 bg-white border border-purple-200 rounded hover:bg-purple-100 text-purple-700 text-sm"
                  >
                    ↓ 아래로
                  </button>
                  <span className="text-xs text-purple-600 ml-2">* Y 위치</span>
                </div>
                <div className="flex gap-2 items-center flex-wrap mt-2">
                  <span className="text-sm font-medium text-purple-700">크기 조절:</span>
                  <button
                    onClick={() => handleBatchSizeChange(-0.002)}
                    className="px-3 py-1 bg-white border border-purple-200 rounded hover:bg-purple-100 text-purple-700 text-sm"
                  >
                    - 작게
                  </button>
                  <button
                    onClick={() => handleBatchSizeChange(0.002)}
                    className="px-3 py-1 bg-white border border-purple-200 rounded hover:bg-purple-100 text-purple-700 text-sm"
                  >
                    + 크게
                  </button>
                  <span className="text-xs text-purple-600 ml-2">* 반지름</span>
                </div>
              </div>
            )}

            {/* 그리드 도구 설정 */}
            {isGridMode && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-wrap gap-4 items-center animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-2">
                  <Grid className="text-blue-600" size={20} />
                  <span className="font-bold text-blue-900 text-sm">그리드 설정:</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-blue-700">시작 번호:</label>
                  <input
                    type="number"
                    value={gridStartNo}
                    onChange={(e) => setGridStartNo(parseInt(e.target.value) || 1)}
                    className="w-16 px-2 py-1 border border-blue-300 rounded text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-blue-700">행(Rows):</label>
                  <input
                    type="number"
                    value={gridRows}
                    onChange={(e) => setGridRows(parseInt(e.target.value) || 1)}
                    className="w-16 px-2 py-1 border border-blue-300 rounded text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-blue-700">열(Cols):</label>
                  <input
                    type="number"
                    value={gridCols}
                    onChange={(e) => setGridCols(parseInt(e.target.value) || 1)}
                    className="w-16 px-2 py-1 border border-blue-300 rounded text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-blue-700">반지름:</label>
                  <input
                    type="number"
                    value={template.bubbleRadius}
                    onChange={(e) => setTemplate({ ...template, bubbleRadius: parseFloat(e.target.value) || 0.02 })}
                    step="0.01"
                    min="0.01"
                    max="0.1"
                    className="w-16 px-2 py-1 border border-blue-300 rounded text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-blue-700">선택지:</label>
                  <input
                    type="text"
                    value={gridOptions}
                    onChange={(e) => setGridOptions(e.target.value)}
                    placeholder="1,2,3,4,5"
                    className="w-32 px-2 py-1 border border-blue-300 rounded text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-blue-700">유형:</label>
                  <select
                    value={gridType}
                    onChange={(e) => setGridType(e.target.value as 'question' | 'identity')}
                    className="px-2 py-1 border border-blue-300 rounded text-sm bg-white"
                  >
                    <option value="question">문제</option>
                    <option value="identity">수험번호</option>
                  </select>
                </div>
                <div className="text-blue-600 text-xs italic ml-auto">
                  * 캔버스에서 시작 모서리와 끝 모서리 두 곳을 클릭하세요.
                </div>
              </div>
            )}

            {/* Canvas */}
            <div className="h-[600px]">
              <MappingCanvas
                imageSrc={template.imageUrl}
                groups={template.groups}
                activeValue={activeValue}
                activeGroupId={activeGroupId}
                bubbleRadiusPct={template.bubbleRadius}
                onAddBubble={handleAddBubble}
                onUpdateBubble={handleUpdateBubble}
                onDeleteBubble={handleDeleteBubble}
                isGridMode={isGridMode}
                onGridClick={handleGridClick}
                gridPoints={gridPoints}
                isBatchMode={isBatchMode}
                batchSelectedBubbles={batchSelectedBubbles}
                onBatchSelect={setBatchSelectedBubbles}
              />
            </div>

            {/* Next Step */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setStep('upload_filled')}
                className="px-6 py-3 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 font-semibold"
              >
                마킹 건너뛰기
              </button>
              <button
                onClick={() => setStep('upload_filled')}
                disabled={template.groups.length === 0}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                다음: 답안지 업로드 <ArrowRight size={20} />
              </button>
            </div>
          </div>
        )}

        {step === 'upload_filled' && (
          <div className="max-w-md mx-auto">
            <div className="bg-white p-8 rounded-2xl shadow-xl text-center space-y-6">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600">
                <FileText size={32} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">답안지 업로드</h2>
                <p className="text-gray-500">채점할 답안지 이미지를 업로드하세요.</p>
              </div>
              <label className="block w-full cursor-pointer">
                <div className="w-full h-40 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center hover:border-green-500 transition-colors">
                  <span className="text-gray-400 font-medium hover:text-green-500">이미지 파일 선택</span>
                </div>
                <input type="file" accept="image/*" onChange={handleFilledUpload} className="hidden" />
              </label>
              <button
                onClick={() => setStep('mapping')}
                className="w-full py-3 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 flex items-center justify-center gap-2"
              >
                <ChevronLeft size={20} /> 영역 설정으로 돌아가기
              </button>
            </div>
          </div>
        )}

        {step === 'grading' && filledImage && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setStep('upload_filled')}
                  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1"
                  title="답안지 업로드로 돌아가기"
                >
                  <ChevronLeft size={20} />
                  <span className="text-sm font-medium">뒤로</span>
                </button>
                <div className="h-8 w-px bg-gray-200 mr-2"></div>
                <div>
                  <h2 className="font-semibold text-gray-700">채점 준비 완료</h2>
                  <p className="text-sm text-gray-500">{filledFileName || '업로드된 시트'}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsDebugMode(!isDebugMode)}
                  className={`px-4 py-2 border rounded-lg flex items-center gap-2 transition-colors ${isDebugMode ? 'bg-red-100 border-red-300 text-red-600' : 'bg-white border-gray-300 text-gray-600'}`}
                >
                  <AlertTriangle size={18} /> 디버그 모드 {isDebugMode ? '끄기' : '활성화'}
                </button>
                <button
                  onClick={() => {
                    setRawImageForAlignment(filledImage);
                    setIsAlignmentEditorOpen(true);
                  }}
                  className="px-4 py-2 border border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 flex items-center gap-2"
                >
                  <Crop size={18} /> 영역 보정 및 자르기
                </button>
                <button
                  onClick={() => setStep('upload_filled')}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  이미지 변경
                </button>
                <button
                  onClick={runGrading}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <Play size={18} /> 채점 시작
                </button>
              </div>
            </div>
            <div className="h-[75vh] max-h-[800px] bg-gray-200 rounded-xl shadow-inner p-4 flex items-center justify-center overflow-hidden relative group">
              <div className="relative h-full w-full flex items-center justify-center">
                <img 
                  src={filledImage} 
                  alt="Filled OMR" 
                  className="max-w-full max-h-full object-contain shadow-2xl border border-gray-300" 
                />
              </div>
            </div>
          </div>
        )}

        {step === 'results' && result && (
          <ResultsView result={result} onReset={() => {
            setFilledImage(null);
            setResult(null);
            setStep('upload_filled'); // 1단계가 아닌 3단계로 이동
          }} />
        )}
      </main>

      {/* Loading Overlay */}
      {isGrading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
            <div className="text-center">
              <h3 className="font-bold text-lg text-gray-900">채점 진행 중...</h3>
              <p className="text-sm text-gray-500">이미지를 분석하고 있습니다. 잠시만 기다려 주세요.</p>
            </div>
          </div>
        </div>
      )}

      {/* Alignment Editor Overlay */}
      {isAlignmentEditorOpen && rawImageForAlignment && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[60] p-4">
          <div className="bg-white w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Crop size={20} className="text-blue-600" />
                이미지 영역 보정 및 자르기
              </h3>
              <button 
                onClick={() => setIsAlignmentEditorOpen(false)}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <AlignmentEditor 
                imageUrl={rawImageForAlignment} 
                onComplete={(processedUrl) => {
                  if (step === 'mapping') {
                    setTemplate(prev => ({ ...prev, imageUrl: processedUrl }));
                  } else {
                    setFilledImage(processedUrl);
                  }
                  setIsAlignmentEditorOpen(false);
                }}
                onCancel={() => setIsAlignmentEditorOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
