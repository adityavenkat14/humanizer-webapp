/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  Loader2, Copy, Check, Wand2, Eraser, Info, 
  History, Save, Trash2, ChevronDown, Sliders, 
  Target, Maximize2, Minimize2, AlignLeft, Search,
  FileDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, 
  Tooltip as RechartsTooltip, Legend 
} from 'recharts';
import { Document, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";

interface Analysis {
  aiGenerated: number;
  aiRefined: number;
  humanContent: number;
}

interface SavedItem {
  id: string;
  timestamp: number;
  input: string;
  output: string;
  originalAnalysis: Analysis;
  rewrittenAnalysis: Analysis;
  settings: {
    length: string;
    audience: string;
    burstiness: number;
    formality: number;
    targetWordCount: number;
    numParagraphs: number;
    wordsPerParagraph: number;
  };
}

export default function App() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  //const [isLoading, setIsLoading] = useState(false);

  const [isDetecting, setIsDetecting] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);

  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [originalAnalysis, setOriginalAnalysis] = useState<Analysis | null>(null);
  const [rewrittenAnalysis, setRewrittenAnalysis] = useState<Analysis | null>(null);

  const [confidence, setConfidence] = useState<number | null>(null);
  const [reasoning, setReasoning] = useState('');
  
  // New Controls
  const [length, setLength] = useState('similar');
  const [audience, setAudience] = useState('general public');
  const [burstiness, setBurstiness] = useState(85);
  const [formality, setFormality] = useState(25);
  const [targetWordCount, setTargetWordCount] = useState(0);
  const [numParagraphs, setNumParagraphs] = useState(0);
  const [wordsPerParagraph, setWordsPerParagraph] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<SavedItem[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('humanizer_history');
    if (saved) {
      setHistory(JSON.parse(saved));
    }
  }, []);

  const saveToHistory = (data: Omit<SavedItem, 'id' | 'timestamp'>) => {
    const newItem: SavedItem = {
      ...data,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    const updatedHistory = [newItem, ...history].slice(0, 20);
    setHistory(updatedHistory);
    localStorage.setItem('humanizer_history', JSON.stringify(updatedHistory));
  };

  const deleteFromHistory = (id: string) => {
    const updatedHistory = history.filter(item => item.id !== id);
    setHistory(updatedHistory);
    localStorage.setItem('humanizer_history', JSON.stringify(updatedHistory));
  };

  const loadFromHistory = (item: SavedItem) => {
    setInput(item.input);
    setOutput(item.output);
    setOriginalAnalysis(item.originalAnalysis);
    setRewrittenAnalysis(item.rewrittenAnalysis);
    setLength(item.settings.length);
    setAudience(item.settings.audience);
    setBurstiness(item.settings.burstiness);
    setFormality(item.settings.formality);
    setTargetWordCount(item.settings.targetWordCount || 0);
    setNumParagraphs(item.settings.numParagraphs || 0);
    setWordsPerParagraph(item.settings.wordsPerParagraph || 0);
    setShowHistory(false);
  };

  const runDetection = async (text: string) => {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-lite",
    contents: text,
    config: {
      systemInstruction: `You are a precise text analysis tool that detects how much of a given text was written by a human vs generated or refined by AI.

Analyze the text carefully using these concrete signals:

AI-GENERATED signals (robotic, formulaic writing):
- Perfectly uniform sentence lengths with no variation
- Overuse of transitional phrases: "Furthermore", "Moreover", "In addition", "It is worth noting", "It is important to note"
- Unnatural symmetry — every paragraph the same size, every point given equal weight
- Absence of any personal voice, opinion, or tangent
- Generic, placeholder-style examples with no specificity
- Overly balanced "on one hand / on the other hand" structures
- No contractions, no colloquialisms, no informal asides

HUMAN-CONTENT signals (authentic, natural writing):
- Varied sentence rhythm — some very short, some long and winding
- Personal voice: asides, opinions, rhetorical questions, hedging ("I think", "arguably", "to be fair")
- Specific, concrete details and examples that feel lived-in
- Natural transitions that don't sound templated
- Occasional mild redundancy or restatement (humans repeat themselves sometimes)
- Contractions and informal phrasing where appropriate
- Paragraphs of uneven length — some brief, some dense

AI-REFINED signals (in between — AI-assisted but somewhat natural):
- Mostly clear and well-structured but lacks a personal voice
- Some variety in sentence length but still feels processed
- Transitions exist but lean on common connectives

IMPORTANT CALIBRATION RULES:
- Do NOT flag text as AI just because it is well-written or grammatically correct. Humans write well too.
- Most real-world text is a mix. Rarely is anything 100% in one category.
- Only assign high aiGenerated % (above 60) if you see multiple strong AI signals — not just one.
- Journalistic, academic, or professional writing can be human even if formal.
- Short texts are harder to classify — lean toward balanced scores when uncertain.

The three values must sum to exactly 100.

Additionally:
1. Provide a confidence score (0–100)
2. Provide a brief reasoning (2–4 sentences)
3. If the text is short or ambiguous, lower confidence accordingly.`,
      temperature: 0.1,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          originalAnalysis: {
            type: Type.OBJECT,
            properties: {
              aiGenerated: { type: Type.NUMBER },
              aiRefined: { type: Type.NUMBER },
              humanContent: { type: Type.NUMBER },
            },
            required: ["aiGenerated", "aiRefined", "humanContent"],
          },
          confidence: { type: Type.NUMBER },
          reasoning: { type: Type.STRING }
        },
        required: ["originalAnalysis", "confidence", "reasoning"],
      },
    },
  });

  const data = JSON.parse(response.text || '{}');

  setOriginalAnalysis(data.originalAnalysis);
  setRewrittenAnalysis(data.originalAnalysis);
  setConfidence(data.confidence);
  setReasoning(data.reasoning);
};

const handleDetect = async () => {
  if (!input.trim()) return;

  setOriginalAnalysis(null);
  setRewrittenAnalysis(null);
  setConfidence(null);
  setReasoning('');
  setOutput('');

  setIsDetecting(true);
  setError('');

  try {
    await runDetection(input);
  } catch (err) {
    console.error(err);
    setError('⚠️ Server busy. Try again.');
  } finally {
    setIsDetecting(false);
  }
};

  const handleRewrite = async () => {
    if (!input.trim()) return;

    setIsRewriting(true);
    setError('');
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: input,
        config: {
          systemInstruction: `You are an expert human editor with a highly irregular, conversational writing style. Your goal is to rewrite the input to bypass all 2026 AI detectors.

OBJECTIVE:
- Improve clarity, flow, and readability
- Preserve full scientific accuracy and technical depth
- Make the writing sound like it was written by an experienced human expert

STRICT REQUIREMENTS:
- Do NOT remove or simplify scientific terminology
- Preserve all numerical data, relationships, and mechanisms
- Maintain logical rigor and precision

WRITING STYLE:
- Use natural variation in sentence length and structure
- Introduce human-like flow: reasoning, emphasis, and transitions
- Allow mild redundancy only where it improves clarity
- Avoid overusing predictable or templated phrases such as:
"Interestingly", "What is important here", "From a mechanistic standpoint"

Use more natural and varied phrasing instead.

TONE:
- Expert-to-expert communication
- Confident, analytical, and slightly interpretive
- Not robotic, not overly conversational

Target Audience: ${audience}
Desired Length: ${length} (relative to original)
Target Word Count: ${targetWordCount > 0 ? targetWordCount : 'Match original'}
Target Number of Paragraphs: ${numParagraphs > 0 ? numParagraphs : 'Match original'}
Target Words Per Paragraph: ${wordsPerParagraph > 0 ? wordsPerParagraph : 'Natural variation'}
Burstiness Level: ${burstiness}/100 (higher means more sentence length variation)
Formality Level: ${formality}/100 (higher means more formal, lower means more idioms and vocal fillers)

Execution Guidelines:
Tone & Flow: Use varied sentence lengths. Mix short, punchy sentences with longer, descriptive ones to create a natural "rhythm" (burstiness). Adjust based on the Burstiness Level.

Formatting: Strictly remove all Unicode characters, special symbols (except basic punctuation), and M-lines (multiple consecutive dashes or line breaks).

Structure: ${numParagraphs > 0 ? `Strictly use exactly ${numParagraphs} paragraphs.` : 'Maintain the same number of paragraphs as the original text.'} Ensure the context and core message remain identical. Avoid perfectly symmetrical bullet points. Use paragraph-driven explanations with natural transitions.

Analysis Requirement: 
You must also analyze both the original input and your rewritten version to estimate the percentage of:
1. AI Generated: Content that sounds entirely robotic or formulaic.
2. AI Refined: Content that shows signs of AI assistance but has some human-like structure.
3. Human Content: Content that feels authentic, varied, and natural.

Strict Constraints:
No "In conclusion" or "Lastly" summaries.
No repetitive sentence starters.
No robotic "As an AI..." disclaimers.
The humanizedText must be clean text only—no markdown code blocks, no bolding, no special formatting. Just the plain text. 

HUMAN AUTHENTICITY LAYER (CRITICAL):

- Introduce slight imperfections in flow — not every sentence should be perfectly structured
- Occasionally use informal phrasing or mild conversational tone
- Allow small redundancies or rephrasings where natural
- Avoid consistently polished transitions — sometimes jump between ideas naturally
- Do NOT make every sentence sound “expert-level clean”
- Mix clarity with slight messiness — like real human writing

VERY IMPORTANT:
The text should NOT feel like it was optimized. It should feel like it was written.`,
          temperature: 1.1,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              humanizedText: { type: Type.STRING },
              originalAnalysis: {
                type: Type.OBJECT,
                properties: {
                  aiGenerated: { type: Type.NUMBER },
                  aiRefined: { type: Type.NUMBER },
                  humanContent: { type: Type.NUMBER },
                },
                required: ["aiGenerated", "aiRefined", "humanContent"],
              },
              rewrittenAnalysis: {
                type: Type.OBJECT,
                properties: {
                  aiGenerated: { type: Type.NUMBER },
                  aiRefined: { type: Type.NUMBER },
                  humanContent: { type: Type.NUMBER },
                },
                required: ["aiGenerated", "aiRefined", "humanContent"],
              },
            },
            required: ["humanizedText", "originalAnalysis", "rewrittenAnalysis"],
          },
        },
      });

      const data = JSON.parse(response.text || '{}');
      setOutput(data.humanizedText || '');
      await runDetection(data.humanizedText);
      
      saveToHistory({
        input,
        output: data.humanizedText,
        originalAnalysis: data.originalAnalysis,
        rewrittenAnalysis: data.rewrittenAnalysis,
        settings: { length, audience, burstiness, formality, targetWordCount, numParagraphs, wordsPerParagraph }
      });
    } catch (err) {
      console.error(err);
      setError('Something went wrong while rewriting. Please try again.');
    } finally {
      setIsRewriting(false)
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportDocx = async () => {
    if (!output) return;

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: output.split('\n').map(para => 
            new Paragraph({
              children: [new TextRun(para)],
              spacing: { after: 200 }
            })
          ),
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `humanized-text-${Date.now()}.docx`);
  };

  const handleClear = () => {
    setInput('');
    setOutput('');
    setError('');
    setOriginalAnalysis(null);
    setRewrittenAnalysis(null);
  };

  const AnalysisChart = ({ analysis }: { analysis: Analysis }) => {
    const data = [
      { name: 'AI Generated', value: analysis.aiGenerated, color: '#f87171' },
      { name: 'AI Refined', value: analysis.aiRefined, color: '#fbbf24' },
      { name: 'Human Content', value: analysis.humanContent, color: '#22c55e' },
    ];

    return (
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <RechartsTooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex justify-center gap-4 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-400" /> AI Gen</div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-400" /> AI Refined</div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" /> Human</div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-900 font-sans selection:bg-zinc-200">
      <header className="max-w-7xl mx-auto px-6 py-8 md:py-12 flex items-center justify-between">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-1"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 text-zinc-600 text-xs font-medium tracking-wider uppercase">
            <Wand2 size={14} />
            Writing Assistant
          </div>
          <h1 className="text-3xl font-medium tracking-tight text-zinc-950">
            Humanizer <span className="text-zinc-400 font-light">Pro</span>
          </h1>
        </motion.div>

        <button 
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-zinc-200 text-sm font-medium hover:bg-zinc-50 transition-all shadow-sm"
        >
          <History size={18} />
          History
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Controls Sidebar */}
          <aside className="lg:col-span-3 space-y-6">
            <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-6 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950 uppercase tracking-widest">
                <Sliders size={16} />
                Configuration
              </div>

              {/* Length */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                  <AlignLeft size={14} /> Output Length
                </label>
                <div className="flex bg-zinc-100 p-1 rounded-xl">
                  {['shorter', 'similar', 'longer'].map((l) => (
                    <button
                      key={l}
                      onClick={() => setLength(l)}
                      className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all capitalize ${
                        length === l ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Audience */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                  <Target size={14} /> Target Audience
                </label>
                <select 
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  className="w-full p-3 bg-zinc-100 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-zinc-900/5 transition-all"
                >
                  <option value="general public">General Public</option>
                  <option value="technical experts">Technical Experts</option>
                  <option value="young adults">Young Adults</option>
                  <option value="business executives">Business Executives</option>
                  <option value="academic researchers">Academic Researchers</option>
                </select>
              </div>

              {/* Burstiness */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                    <Maximize2 size={14} /> Burstiness
                  </label>
                  <span className="text-xs font-medium text-zinc-600">{burstiness}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" max="100" 
                  value={burstiness}
                  onChange={(e) => setBurstiness(parseInt(e.target.value))}
                  className="w-full accent-zinc-950 h-1.5 bg-zinc-100 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Formality */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                    <Minimize2 size={14} /> Formality
                  </label>
                  <span className="text-xs font-medium text-zinc-600">{formality}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" max="100" 
                  value={formality}
                  onChange={(e) => setFormality(parseInt(e.target.value))}
                  className="w-full accent-zinc-950 h-1.5 bg-zinc-100 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Word Count */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                  <AlignLeft size={14} /> Target Word Count
                </label>
                <div className="flex gap-2">
                  <input 
                    type="number" 
                    placeholder="Auto"
                    value={targetWordCount || ''}
                    onChange={(e) => setTargetWordCount(parseInt(e.target.value) || 0)}
                    className="w-full p-3 bg-zinc-100 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-zinc-900/5 transition-all"
                  />
                </div>
                <p className="text-[10px] text-zinc-400">Leave empty to match original length automatically.</p>
              </div>

              {/* Paragraph Controls */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Paragraphs
                  </label>
                  <input 
                    type="number" 
                    placeholder="Auto"
                    value={numParagraphs || ''}
                    onChange={(e) => setNumParagraphs(parseInt(e.target.value) || 0)}
                    className="w-full p-3 bg-zinc-100 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-zinc-900/5 transition-all"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Words/Para
                  </label>
                  <input 
                    type="number" 
                    placeholder="Auto"
                    value={wordsPerParagraph || ''}
                    onChange={(e) => setWordsPerParagraph(parseInt(e.target.value) || 0)}
                    className="w-full p-3 bg-zinc-100 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-zinc-900/5 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Comparison Stats */}
            {originalAnalysis && rewrittenAnalysis && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-zinc-950 text-white rounded-2xl p-6 space-y-6 shadow-xl shadow-zinc-950/20"
              >
                <div className="space-y-4">
                  <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Humanization Lift</div>
                  <div className="flex items-end gap-3">
                    <div className="text-4xl font-medium">{rewrittenAnalysis.humanContent}%</div>
                    <div className="text-green-400 text-sm font-medium mb-1 flex items-center gap-1">
                      +{rewrittenAnalysis.humanContent - originalAnalysis.humanContent}%
                    </div>
                  </div>
                </div>

                <div className="h-px bg-zinc-800" />

                <div className="space-y-4">
                  <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Analysis Breakdown</div>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-zinc-400">AI Generated</span>
                      <span className="text-xs font-medium text-red-400">{rewrittenAnalysis.aiGenerated}%</span>
                    </div>
                    <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-red-400 transition-all duration-500" style={{ width: `${rewrittenAnalysis.aiGenerated}%` }} />
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-xs text-zinc-400">AI Refined</span>
                      <span className="text-xs font-medium text-amber-400">{rewrittenAnalysis.aiRefined}%</span>
                    </div>
                    <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 transition-all duration-500" style={{ width: `${rewrittenAnalysis.aiRefined}%` }} />
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-xs text-zinc-400">Human Content</span>
                      <span className="text-xs font-medium text-green-400">{rewrittenAnalysis.humanContent}%</span>
                    </div>
                    <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${rewrittenAnalysis.humanContent}%` }} />
                    </div>
                  </div>
                </div>

                <div className="text-xs text-zinc-500 leading-relaxed pt-2">
                  Original human score: {originalAnalysis.humanContent}%. Target: 94%.
                </div>
              </motion.div>
            )}
          </aside>

          {/* Main Workspace */}
          <div className="lg:col-span-9 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Input Section */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <label htmlFor="input" className="text-sm font-medium text-zinc-500 uppercase tracking-widest">
                    Original Text
                  </label>
                  <button 
                    onClick={handleClear}
                    className="text-zinc-400 hover:text-zinc-900 transition-colors p-1"
                    title="Clear input"
                  >
                    <Eraser size={18} />
                  </button>
                </div>
                <div className="relative group">
                  <textarea
                    id="input"
                    className="w-full h-[350px] p-6 bg-white border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5 focus:border-zinc-900 transition-all resize-none text-base leading-relaxed placeholder:text-zinc-300 shadow-sm"
                    placeholder="Paste your text here..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                  />
                  <div className="absolute bottom-4 right-4 text-xs text-zinc-400">
                    {input.length} characters
                  </div>
                </div>
                {originalAnalysis && (
                  <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm">
                    <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Original Analysis</div>
                    <AnalysisChart analysis={originalAnalysis} />
                  </div>
                )}
              </section>

              {/* Output Section */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-zinc-500 uppercase tracking-widest">
                    Humanized Version
                  </label>
                  <div className="flex items-center gap-4">
                    {output && (
                      <>
                        <button 
                          onClick={handleExportDocx}
                          className="flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-zinc-950 transition-colors"
                          title="Export to .docx"
                        >
                          <FileDown size={16} />
                          Export DOCX
                        </button>
                        <button 
                          onClick={handleCopy}
                          className="flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-zinc-950 transition-colors"
                        >
                          {copied ? (
                            <>
                              <Check size={16} className="text-green-600" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy size={16} />
                              Copy Text
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="relative">
                  <div className="w-full h-[350px] p-6 bg-white border border-zinc-200 rounded-2xl overflow-y-auto shadow-sm">
                    <AnimatePresence mode="wait">
                      {error ? (
                        <motion.p 
                          key="error"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-red-500 text-sm"
                        >
                          {error}
                        </motion.p>
                      ) : output ? (
                        <motion.div
                          key="output"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="whitespace-pre-wrap text-base leading-relaxed text-zinc-800"
                        >
                          {output}
                        </motion.div>
                      ) : (
                        <motion.div 
                          key="placeholder"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="h-full flex flex-col items-center justify-center text-zinc-300 space-y-4"
                        >
                          <Wand2 size={48} strokeWidth={1} />
                          <p className="text-sm">Your humanized text will appear here</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                {rewrittenAnalysis && (
                  <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm">
                    <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Rewritten Analysis</div>
                    <AnalysisChart analysis={rewrittenAnalysis} />
                  </div>
                )}
              </section>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={handleDetect}
                disabled={isRewriting || !input.trim()}
                className="w-full py-4 px-6 bg-white border border-zinc-200 text-zinc-950 rounded-2xl font-medium hover:bg-zinc-50 disabled:bg-zinc-50 disabled:text-zinc-300 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3 shadow-sm"
              >
                {isRewriting ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <Search size={20} />
                )}
                Detect AI Content
              </button>

              <button
                onClick={handleRewrite}
                disabled={isRewriting || !input.trim()}
                className="w-full py-4 px-6 bg-zinc-950 text-white rounded-2xl font-medium hover:bg-zinc-800 disabled:bg-zinc-200 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3 shadow-xl shadow-zinc-950/10"
              >
                {isRewriting ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <Wand2 size={20} />
                )}
                Rewrite & Humanize to 94%
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* History Drawer */}
      <AnimatePresence>
        {showHistory && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white z-50 shadow-2xl p-8 overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-medium">History</h2>
                <button onClick={() => setShowHistory(false)} className="text-zinc-400 hover:text-zinc-900">
                  <ChevronDown size={24} className="rotate-[-90deg]" />
                </button>
              </div>

              {history.length === 0 ? (
                <div className="h-[60vh] flex flex-col items-center justify-center text-zinc-300 space-y-4">
                  <History size={48} strokeWidth={1} />
                  <p>No saved content yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {history.map((item) => (
                    <div 
                      key={item.id}
                      className="group p-4 rounded-2xl border border-zinc-100 hover:border-zinc-200 hover:bg-zinc-50 transition-all cursor-pointer relative"
                    >
                      <div onClick={() => loadFromHistory(item)}>
                        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">
                          {new Date(item.timestamp).toLocaleString()}
                        </div>
                        <p className="text-sm text-zinc-600 line-clamp-2 mb-2">{item.output}</p>
                        <div className="flex gap-2">
                          <span className="text-[10px] bg-zinc-200 px-2 py-0.5 rounded uppercase">{item.settings.audience}</span>
                          <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded uppercase">{item.rewrittenAnalysis.humanContent}% Human</span>
                        </div>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteFromHistory(item.id);
                        }}
                        className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-zinc-100">
        <p className="text-sm text-zinc-400 text-center">
          Humanizer Pro — Advanced authentic expression engine.
        </p>
      </footer>
    </div>
  );
}
