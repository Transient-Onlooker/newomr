import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Settings, Check, FileText, Play, Plus, Trash2, ArrowRight, HelpCircle, Save, FolderOpen, Grid, MousePointer2, Edit2, RotateCcw, RotateCw, X, FileDown, FileUp, SlidersHorizontal, Hash, KeyRound, Layers, Download, ChevronLeft, Loader2, ScanEye, Crop, AlertTriangle } from 'lucide-react';
import MappingCanvas from './components/MappingCanvas';
import ResultsView from './components/ResultsView';
import { AlignmentEditor } from './components/AlignmentEditor';
import { OmrTemplate, BubbleGroup, Bubble, GradingResult } from './types';

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
  const [filledFileName, setFilledFileName] = useState<string | undefined>(undefined);
  const [result, setResult] = useState<GradingResult | null>(null);

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

  // Grid Generator State
  const [isGridMode, setIsGridMode] = useState(false);
  const [gridPoints, setGridPoints] = useState<{x:number, y:number}[]>([]);
  const [gridStartNo, setGridStartNo] = useState(1);
  const [gridCount, setGridCount] = useState(5);
  const [gridOptions, setGridOptions] = useState("1,2,3,4,5");
  const [gridDirection, setGridDirection] = useState<'horizontal' | 'vertical'>('horizontal');
  const [gridType, setGridType] = useState<'question' | 'identity'>('question');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);

  // --- Handlers ---
  const handleTemplateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageUrl = event.target?.result as string;
        setTemplate(prev => ({ ...prev, imageUrl }));
        setStep('mapping');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFilledUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFilledFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        setFilledImage(event.target?.result as string);
        setStep('grading');
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
      setTemplate(prev => ({
          ...prev,
          groups: prev.groups.filter(g => g.id !== id)
      }));
      if (activeGroupId === id) setActiveGroupId(null);
  };

  const handleClearAll = () => {
    if (template.groups.length === 0) return;
    setTemplate(prev => ({ ...prev, groups: [] }));
    setActiveGroupId(null);
    setEditingGroup(null);
  };

  const handleAddBubble = (groupId: string, bubble: Bubble) => {
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
    setIsGridMode(true);
    setGridPoints([]);
    setActiveGroupId(null);
  };

  const handleGridClick = (x: number, y: number) => {
    const newPoints = [...gridPoints, { x, y }];
    setGridPoints(newPoints);
    if (newPoints.length === 2) {
      generateGrid(newPoints[0], newPoints[1]);
      setIsGridMode(false);
      setGridPoints([]);
    }
  };

  const generateGrid = (p1: {x:number, y:number}, p2: {x:number, y:number}) => {
    const options = gridOptions.split(',').map(s => s.trim()).filter(s => s);
    if (options.length === 0) return;
    const newGroups: BubbleGroup[] = [];
    const isHorizontal = gridDirection === 'horizontal';
    const numGroups = gridCount;
    const numBubblesPerGroup = options.length;
    const minX = Math.min(p1.x, p2.x);
    const maxX = Math.max(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y);
    const maxY = Math.max(p1.y, p2.y);
    const groupStepX = isHorizontal ? 0 : (numGroups > 1 ? (maxX - minX) / (numGroups - 1) : 0);
    const groupStepY = isHorizontal ? (numGroups > 1 ? (maxY - minY) / (numGroups - 1) : 0) : 0;
    const bubbleStepX = isHorizontal ? (numBubblesPerGroup > 1 ? (maxX - minX) / (numBubblesPerGroup - 1) : 0) : 0;
    const bubbleStepY = isHorizontal ? 0 : (numBubblesPerGroup > 1 ? (maxY - minY) / (numBubblesPerGroup - 1) : 0);

    for (let g = 0; g < numGroups; g++) {
      const groupBubbles: Bubble[] = [];
      const currentLabel = (gridStartNo + g).toString();
      const groupOriginX = isHorizontal ? minX : minX + (g * groupStepX);
      const groupOriginY = isHorizontal ? minY + (g * groupStepY) : minY;
      for (let b = 0; b < numBubblesPerGroup; b++) {
        const bx = groupOriginX + (b * bubbleStepX);
        const by = groupOriginY + (b * bubbleStepY);
        groupBubbles.push({
          value: options[b],
          x: bx,
          y: by
        });
      }
      newGroups.push({
        id: crypto.randomUUID(),
        label: currentLabel,
        type: gridType,
        bubbles: groupBubbles,
        points: undefined,
        correctAnswer: gridType === 'question' ? [] : undefined
      });
    }
    setTemplate(prev => ({
      ...prev,
      groups: [...prev.groups, ...newGroups]
    }));
    setGridStartNo(prev => prev + numGroups);
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

  const runGrading = async () => {
    if (!filledImage) return;
    // TODO: Implement your backend grading logic here
    alert("Grading logic will be called here. Connect your backend engine.");
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
              <h1 className="text-xl font-bold text-gray-900">AutoOMR</h1>
              <p className="text-xs text-gray-500">Open Source Grader</p>
            </div>
          </div>
          
          {/* Step Indicator */}
          <div className="flex items-center gap-2">
            {['upload_template', 'mapping', 'upload_filled', 'grading', 'results'].map((s, i) => {
              const steps = ['upload_template', 'mapping', 'upload_filled', 'grading', 'results'];
              const currentIndex = steps.indexOf(step);
              const stepIndex = steps.indexOf(s);
              const isActive = step === s;
              const isCompleted = stepIndex < currentIndex;
              
              return (
                <React.Fragment key={s}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    isActive ? 'bg-blue-600 text-white' : 
                    isCompleted ? 'bg-green-500 text-white' : 
                    'bg-gray-200 text-gray-500'
                  }`}>
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
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload Template</h2>
                <p className="text-gray-500">Upload a blank OMR sheet to begin mapping.</p>
              </div>
              <label className="block w-full cursor-pointer">
                <div className="w-full h-40 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center hover:border-blue-500 transition-colors">
                  <span className="text-gray-400 font-medium hover:text-blue-500">Select Image File</span>
                </div>
                <input type="file" accept="image/*" onChange={handleTemplateUpload} className="hidden" />
              </label>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
              >
                Choose File
              </button>
            </div>
          </div>
        )}

        {step === 'mapping' && template.imageUrl && (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="bg-white rounded-xl shadow p-4 flex flex-wrap gap-2 items-center justify-between">
              <div className="flex gap-2 flex-wrap">
                <input
                  type="text"
                  placeholder="Group Label (e.g., Q1, ID)"
                  value={newGroupLabel}
                  onChange={(e) => setNewGroupLabel(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-40"
                />
                <select
                  value={newGroupType}
                  onChange={(e) => setNewGroupType(e.target.value as 'identity' | 'question')}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="question">Question</option>
                  <option value="identity">ID/Name</option>
                </select>
                {newGroupType === 'question' && (
                  <>
                    <input
                      type="number"
                      placeholder="Points"
                      value={newGroupPoints}
                      onChange={(e) => setNewGroupPoints(parseInt(e.target.value) || 1)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-20"
                    />
                    <input
                      type="text"
                      placeholder="Correct (e.g., A,B,C)"
                      value={newGroupCorrect}
                      onChange={(e) => setNewGroupCorrect(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-36"
                    />
                  </>
                )}
                <button onClick={addGroup} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1">
                  <Plus size={16} /> Add Group
                </button>
              </div>
              <div className="flex gap-2">
                <button onClick={startGridTool} className={`px-4 py-2 rounded-lg border flex items-center gap-1 ${isGridMode ? 'bg-red-50 border-red-300 text-red-600' : 'bg-white border-gray-300'}`}>
                  <Grid size={16} /> Grid Mode
                </button>
                <button onClick={saveTemplate} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1">
                  <Save size={16} /> Save
                </button>
                <label className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-1 cursor-pointer">
                  <FolderOpen size={16} /> Load
                  <input type="file" accept=".json" onChange={loadTemplate} className="hidden" />
                </label>
                <button onClick={handleClearAll} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 flex items-center gap-1">
                  <Trash2 size={16} /> Clear All
                </button>
              </div>
            </div>

            {/* Groups List */}
            <div className="bg-white rounded-xl shadow p-4">
              <h3 className="font-semibold text-gray-700 mb-3">Groups ({template.groups.length})</h3>
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
            {activeGroupId && (
              <div className="bg-white rounded-xl shadow p-4">
                <h3 className="font-semibold text-gray-700 mb-3">Select Value to Map</h3>
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
                <p className="text-sm text-gray-500 mt-2">Click on the canvas to place bubbles. Right-click to delete.</p>
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
              />
            </div>

            {/* Next Step */}
            <div className="flex justify-end">
              <button
                onClick={() => setStep('upload_filled')}
                disabled={template.groups.length === 0}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next: Upload Filled Sheet <ArrowRight size={20} />
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
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload Filled OMR</h2>
                <p className="text-gray-500">Upload the completed OMR sheet to grade.</p>
              </div>
              <label className="block w-full cursor-pointer">
                <div className="w-full h-40 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center hover:border-green-500 transition-colors">
                  <span className="text-gray-400 font-medium hover:text-green-500">Select Image File</span>
                </div>
                <input type="file" accept="image/*" onChange={handleFilledUpload} className="hidden" />
              </label>
              <button
                onClick={() => setStep('mapping')}
                className="w-full py-3 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 flex items-center justify-center gap-2"
              >
                <ChevronLeft size={20} /> Back to Mapping
              </button>
            </div>
          </div>
        )}

        {step === 'grading' && filledImage && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow p-4 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-700">Ready to Grade</h2>
                <p className="text-sm text-gray-500">{filledFileName || 'Uploaded sheet'}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setStep('upload_filled')}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Change Image
                </button>
                <button
                  onClick={runGrading}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <Play size={18} /> Start Grading
                </button>
              </div>
            </div>
            <div className="h-[600px] bg-white rounded-xl shadow p-4">
              <img src={filledImage} alt="Filled OMR" className="w-full h-full object-contain" />
            </div>
          </div>
        )}

        {step === 'results' && result && (
          <ResultsView result={result} onReset={() => {
            setFilledImage(null);
            setResult(null);
            setStep('upload_template');
          }} />
        )}
      </main>
    </div>
  );
}
