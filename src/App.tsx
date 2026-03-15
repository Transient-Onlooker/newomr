import { useState, useRef } from 'react'
import './App.css'

interface OMRResult {
  questionNum: number
  selectedAnswer: string | null
}

function App() {
  const [image, setImage] = useState<string | null>(null)
  const [results, setResults] = useState<OMRResult[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        setImage(event.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleProcessOMR = async () => {
    if (!image) return
    
    setIsProcessing(true)
    // TODO: Implement OMR processing logic
    await new Promise(resolve => setTimeout(resolve, 1000)) // Mock delay
    
    // Mock results
    const mockResults: OMRResult[] = [
      { questionNum: 1, selectedAnswer: 'A' },
      { questionNum: 2, selectedAnswer: 'B' },
      { questionNum: 3, selectedAnswer: 'C' },
      { questionNum: 4, selectedAnswer: null },
      { questionNum: 5, selectedAnswer: 'D' },
    ]
    setResults(mockResults)
    setIsProcessing(false)
  }

  const handleReset = () => {
    setImage(null)
    setResults([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>OMR Scanner</h1>
        <p>Upload and scan your OMR sheet to automatically read answers</p>
      </header>

      <main className="main">
        <section className="upload-section">
          <div className="upload-area" onClick={() => fileInputRef.current?.click()}>
            {image ? (
              <img src={image} alt="Uploaded OMR sheet" className="preview-image" />
            ) : (
              <div className="upload-placeholder">
                <svg className="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <p>Click to upload OMR sheet</p>
                <span className="hint">Supports PNG, JPG, JPEG</span>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="file-input"
          />
        </section>

        <section className="controls">
          <button 
            className="btn btn-primary" 
            onClick={handleProcessOMR}
            disabled={!image || isProcessing}
          >
            {isProcessing ? 'Processing...' : 'Scan OMR'}
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={handleReset}
            disabled={!image}
          >
            Reset
          </button>
        </section>

        {results.length > 0 && (
          <section className="results-section">
            <h2>Results</h2>
            <div className="results-grid">
              {results.map((result) => (
                <div key={result.questionNum} className="result-item">
                  <span className="question-label">Q{result.questionNum}</span>
                  <span className={`answer ${result.selectedAnswer ? 'answered' : 'unanswered'}`}>
                    {result.selectedAnswer || '-'}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

export default App
