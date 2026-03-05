import React, { useState, useRef, useEffect } from 'react';
import { Loader2, Trophy, CheckCircle, Share2 } from 'lucide-react';
import { GradeLevel, Language, Translations, Subject, ConceptNode, ConceptEdge } from '../../types';
import { generateConceptMap, evaluateConceptConnections } from '../../services/aiService';

interface Props {
  subject: Subject;
  userGrade: GradeLevel;
  language: Language;
  translations: Translations;
  onComplete: (score: number, xp: number) => void;
}

interface UserEdge {
  fromId: string;
  toId: string;
  relationship: string;
  justification: string;
}

const RELATIONSHIPS = ['causes', 'requires', 'opposes', 'is-type-of', 'contributes'];

const ConceptConnector: React.FC<Props> = ({ subject, userGrade, language, translations, onComplete }) => {
  const [nodes, setNodes] = useState<ConceptNode[]>([]);
  const [idealEdges, setIdealEdges] = useState<ConceptEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFrom, setSelectedFrom] = useState<string | null>(null);
  const [userEdges, setUserEdges] = useState<UserEdge[]>([]);
  const [pendingEdge, setPendingEdge] = useState<{ fromId: string; toId: string } | null>(null);
  const [pendingRelationship, setPendingRelationship] = useState('causes');
  const [pendingJustification, setPendingJustification] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState<{ edgeScores: { correct: boolean; feedback: string }[]; totalScore: number } | null>(null);
  const [done, setDone] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Node positions (auto-arranged in circle)
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});

  useEffect(() => {
    generateConceptMap(subject, userGrade, language)
      .then(result => {
        setNodes(result.nodes);
        setIdealEdges(result.idealEdges);
        // Arrange nodes in a circle
        const cx = 200, cy = 150, r = 120;
        const positions: Record<string, { x: number; y: number }> = {};
        result.nodes.forEach((n, i) => {
          const angle = (i / result.nodes.length) * 2 * Math.PI - Math.PI / 2;
          positions[n.id] = { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
        });
        setNodePositions(positions);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [subject, userGrade, language]);

  const handleNodeClick = (nodeId: string) => {
    if (done) return;
    if (!selectedFrom) {
      setSelectedFrom(nodeId);
      return;
    }
    if (selectedFrom === nodeId) {
      setSelectedFrom(null);
      return;
    }
    // Check if edge already exists
    const exists = userEdges.some(e => (e.fromId === selectedFrom && e.toId === nodeId) || (e.fromId === nodeId && e.toId === selectedFrom));
    if (exists) { setSelectedFrom(null); return; }
    setPendingEdge({ fromId: selectedFrom, toId: nodeId });
    setSelectedFrom(null);
    setPendingRelationship('causes');
    setPendingJustification('');
  };

  const handleAddEdge = () => {
    if (!pendingEdge) return;
    setUserEdges(prev => [...prev, {
      ...pendingEdge,
      relationship: pendingRelationship,
      justification: pendingJustification,
    }]);
    setPendingEdge(null);
    setPendingJustification('');
  };

  const handleEvaluate = async () => {
    if (userEdges.length === 0) return;
    setEvaluating(true);
    try {
      const result = await evaluateConceptConnections(nodes, userEdges, idealEdges, language);
      setEvalResult(result);
      setDone(true);
      const xp = Math.round(result.totalScore * 0.6 + (userEdges.length > 0 ? 10 : 0));
      onComplete(result.totalScore, xp);
    } catch { /* ignore */ }
    finally { setEvaluating(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-16 gap-3">
      <Loader2 size={24} className="animate-spin text-brand-500" />
      <span className="font-bold text-gray-500">Generating concept map...</span>
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
        {translations.connectConcepts} — click two nodes to connect them
      </p>

      {/* SVG canvas */}
      <div ref={containerRef} className="relative bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden" style={{ height: '300px' }}>
        <svg ref={svgRef} width="100%" height="100%" viewBox="0 0 400 300">
          {/* Existing edges */}
          {userEdges.map((e, i) => {
            const from = nodePositions[e.fromId];
            const to = nodePositions[e.toId];
            if (!from || !to) return null;
            const mx = (from.x + to.x) / 2;
            const my = (from.y + to.y) / 2;
            const isCorrect = evalResult?.edgeScores[i]?.correct;
            const color = evalResult ? (isCorrect ? '#22c55e' : '#ef4444') : '#6366f1';
            return (
              <g key={i}>
                <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={color} strokeWidth={2} strokeDasharray={evalResult && !isCorrect ? '4' : undefined} />
                <text x={mx} y={my - 4} textAnchor="middle" fontSize={9} fill={color} fontWeight="bold">{e.relationship}</text>
              </g>
            );
          })}
          {/* Nodes */}
          {nodes.map(n => {
            const pos = nodePositions[n.id];
            if (!pos) return null;
            const isSelected = selectedFrom === n.id;
            return (
              <g key={n.id} onClick={() => handleNodeClick(n.id)} style={{ cursor: 'pointer' }}>
                <circle cx={pos.x} cy={pos.y} r={28} fill={isSelected ? '#6366f1' : '#f3f4f6'} stroke={isSelected ? '#4338ca' : '#d1d5db'} strokeWidth={2} />
                <text x={pos.x} y={pos.y + 4} textAnchor="middle" fontSize={9} fill={isSelected ? 'white' : '#374151'} fontWeight="bold">
                  {n.label.length > 10 ? n.label.slice(0, 10) + '…' : n.label}
                </text>
              </g>
            );
          })}
        </svg>
        {selectedFrom && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-brand-500 text-white text-xs font-bold px-3 py-1.5 rounded-full animate-pulse">
            Now click the target node
          </div>
        )}
      </div>

      {/* Pending edge dialog */}
      {pendingEdge && (
        <div className="bg-white dark:bg-gray-800 border border-brand-200 dark:border-brand-700 rounded-2xl p-4 space-y-3">
          <p className="text-sm font-black text-gray-900 dark:text-white">
            {nodes.find(n => n.id === pendingEdge.fromId)?.label} → {nodes.find(n => n.id === pendingEdge.toId)?.label}
          </p>
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-500">{translations.selectRelationship}</p>
            <div className="flex flex-wrap gap-2">
              {RELATIONSHIPS.map(r => (
                <button
                  key={r}
                  onClick={() => setPendingRelationship(r)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-full border-2 transition-all ${
                    pendingRelationship === r
                      ? 'border-brand-400 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500'
                  }`}
                >
                  {(translations as any)[r.replace('-', '')] ?? r}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold text-gray-500">{translations.justifyConnection}</p>
            <input
              value={pendingJustification}
              onChange={e => setPendingJustification(e.target.value)}
              placeholder="1 sentence justification..."
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-brand-400 text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAddEdge} disabled={!pendingJustification.trim()} className="flex-1 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-colors">
              Add Connection
            </button>
            <button onClick={() => setPendingEdge(null)} className="px-4 py-2 text-gray-500 font-bold text-sm rounded-xl border border-gray-200 dark:border-gray-700">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Edge list */}
      {userEdges.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-black text-gray-400 uppercase tracking-wider">{userEdges.length} connections</p>
          {userEdges.map((e, i) => {
            const result = evalResult?.edgeScores[i];
            return (
              <div key={i} className={`flex items-start gap-2 p-2.5 rounded-xl text-xs ${
                result ? (result.correct ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20') : 'bg-gray-50 dark:bg-gray-700'
              }`}>
                {result && (result.correct ? <CheckCircle size={14} className="text-green-500 flex-shrink-0 mt-0.5" /> : <Share2 size={14} className="text-red-400 flex-shrink-0 mt-0.5" />)}
                <div>
                  <p className="font-bold text-gray-700 dark:text-gray-300">
                    {nodes.find(n => n.id === e.fromId)?.label} <span className="text-brand-500">{e.relationship}</span> {nodes.find(n => n.id === e.toId)?.label}
                  </p>
                  {result?.feedback && <p className="text-gray-500 mt-0.5">{result.feedback}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!done && (
        <button
          onClick={handleEvaluate}
          disabled={userEdges.length === 0 || evaluating}
          className="w-full py-3.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-black rounded-2xl transition-colors flex items-center justify-center gap-2"
        >
          {evaluating ? <><Loader2 size={18} className="animate-spin" /> Evaluating...</> : <><CheckCircle size={18} /> Submit Connections</>}
        </button>
      )}

      {done && evalResult && (
        <div className="bg-gradient-to-r from-brand-500 to-purple-600 rounded-2xl p-4 text-white text-center">
          <Trophy size={28} className="mx-auto mb-2" />
          <p className="font-black text-xl">{evalResult.totalScore}/100</p>
        </div>
      )}
    </div>
  );
};

export default ConceptConnector;
