import React, { useState } from 'react';
import { ApprovedLesson, ClientProfile } from '../types';
import { Storage } from '../utils/storage';
import { Plus, Check, Clock, Trash2, Edit2, BookmarkCheck, Calendar, BookOpen, AlertCircle } from 'lucide-react';

interface Props {
  selectedClient: ClientProfile | null;
  onNavigateToClients: () => void;
}

export const LessonsTab: React.FC<Props> = ({ selectedClient, onNavigateToClients }) => {
  const [lessons, setLessons] = useState<ApprovedLesson[]>(() => {
    return selectedClient ? Storage.getLessons(selectedClient.id) : [];
  });

  const [filter, setFilter] = useState<'All' | 'Valid' | 'Outdated'>('All');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [text, setText] = useState('');
  const [periodOrCampaign, setPeriodOrCampaign] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<'Valid' | 'Outdated'>('Valid');

  // Reload when client changes
  React.useEffect(() => {
    if (selectedClient) {
      setLessons(Storage.getLessons(selectedClient.id));
    } else {
      setLessons([]);
    }
  }, [selectedClient]);

  if (!selectedClient) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-12 text-center">
        <BookOpen className="w-8 h-8 text-neutral-400 mx-auto mb-3" />
        <h2 className="text-base font-semibold text-neutral-900 mb-1">No Client Selected</h2>
        <p className="text-xs text-neutral-500 max-w-sm mx-auto mb-4">
          Please select or create a client profile first to view and manage their campaign lessons history.
        </p>
        <button
          onClick={onNavigateToClients}
          className="px-4 py-2 rounded-lg bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 transition-colors"
        >
          Go to Clients
        </button>
      </div>
    );
  }

  const handleToggleStatus = (lesson: ApprovedLesson) => {
    const newStatus = lesson.status === 'Valid' ? 'Outdated' : 'Valid';
    Storage.updateLesson(selectedClient.id, lesson.id, { status: newStatus });
    setLessons(Storage.getLessons(selectedClient.id));
  };

  const handleDelete = (lessonId: string) => {
    if (confirm('Delete this saved lesson?')) {
      Storage.deleteLesson(selectedClient.id, lessonId);
      setLessons(Storage.getLessons(selectedClient.id));
    }
  };

  const handleStartEdit = (lesson: ApprovedLesson) => {
    setEditingId(lesson.id);
    setText(lesson.text);
    setPeriodOrCampaign(lesson.periodOrCampaign);
    setDate(lesson.date);
    setStatus(lesson.status);
    setIsAdding(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    if (editingId) {
      Storage.updateLesson(selectedClient.id, editingId, {
        text: text.trim(),
        periodOrCampaign: periodOrCampaign.trim() || 'General',
        date,
        status,
      });
    } else {
      Storage.addLesson({
        clientId: selectedClient.id,
        text: text.trim(),
        periodOrCampaign: periodOrCampaign.trim() || 'General',
        date,
        status,
      });
    }

    setLessons(Storage.getLessons(selectedClient.id));
    setIsAdding(false);
    setEditingId(null);
    setText('');
    setPeriodOrCampaign('');
  };

  const filteredLessons = lessons.filter((l) => {
    if (filter === 'All') return true;
    return l.status === filter;
  });

  const validCount = lessons.filter((l) => l.status === 'Valid').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-neutral-900">Lessons History</h1>
            <span className="text-xs font-medium text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded">
              {selectedClient.name}
            </span>
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">
            Verified knowledge base for {selectedClient.name}. Only <strong className="font-semibold text-neutral-800">Valid</strong> lessons from the last 5 periods are sent to Gemini during analysis.
          </p>
        </div>

        {!isAdding && (
          <button
            onClick={() => {
              setEditingId(null);
              setText('');
              setPeriodOrCampaign('');
              setDate(new Date().toISOString().split('T')[0]);
              setStatus('Valid');
              setIsAdding(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 text-xs font-medium transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Lesson
          </button>
        )}
      </div>

      {/* Add / Edit Form */}
      {isAdding && (
        <div className="rounded-xl border border-neutral-300 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-neutral-100">
            <h2 className="text-sm font-semibold text-neutral-900">
              {editingId ? 'Edit Approved Lesson' : 'Add New Approved Lesson'}
            </h2>
            <button
              onClick={() => {
                setIsAdding(false);
                setEditingId(null);
              }}
              className="text-xs text-neutral-500 hover:text-neutral-800 transition-colors"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-xs text-neutral-900 focus:border-neutral-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Campaign / Period Tag
                </label>
                <input
                  type="text"
                  placeholder="e.g. Oct 2026 Promo, Thadingyut Sale"
                  value={periodOrCampaign}
                  onChange={(e) => setPeriodOrCampaign(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-xs text-neutral-900 focus:border-neutral-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'Valid' | 'Outdated')}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-xs text-neutral-900 focus:border-neutral-900 focus:outline-hidden"
                >
                  <option value="Valid">Valid (Send to Gemini)</option>
                  <option value="Outdated">Outdated (Historical archive)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Lesson / Finding (Short & Actionable)
              </label>
              <textarea
                rows={3}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="e.g. Video creatives showcasing doctor demonstrations yielded 40% lower CPR than static images for Kamayut clinic audience."
                required
                className="w-full rounded-lg border border-neutral-300 p-3 text-xs text-neutral-900 focus:border-neutral-900 focus:outline-hidden"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setEditingId(null);
                }}
                className="px-3 py-1.5 rounded-lg border border-neutral-200 text-neutral-700 hover:bg-neutral-50 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 text-xs font-medium transition-colors"
              >
                Save Lesson
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter Tabs & Count */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-neutral-100 rounded-lg">
          {(['All', 'Valid', 'Outdated'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                filter === tab
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              {tab} {tab === 'Valid' ? `(${validCount})` : tab === 'All' ? `(${lessons.length})` : ''}
            </button>
          ))}
        </div>

        <span className="text-xs text-neutral-500 font-mono">
          {validCount} active rule{validCount === 1 ? '' : 's'} passed to AI
        </span>
      </div>

      {/* Lessons List */}
      {filteredLessons.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center">
          <BookmarkCheck className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-neutral-900 mb-1">
            {filter === 'All' ? 'No Saved Lessons' : `No ${filter} Lessons`}
          </h3>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto mb-4">
            {filter === 'All'
              ? 'When analyzing Meta Ads campaigns, approve Gemini suggested lessons or add custom findings here.'
              : `No lessons found with status "${filter}".`}
          </p>
          {filter === 'All' && (
            <button
              onClick={() => setIsAdding(true)}
              className="px-3.5 py-1.5 rounded-lg border border-neutral-300 text-neutral-800 text-xs font-medium hover:border-neutral-900 transition-colors"
            >
              Add First Lesson
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLessons.map((lesson) => {
            const isValid = lesson.status === 'Valid';
            return (
              <div
                key={lesson.id}
                className="rounded-xl border border-neutral-200 bg-white p-4 transition-all hover:border-neutral-300"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5 text-[11px] text-neutral-500">
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar className="w-3 h-3" />
                        {lesson.date}
                      </span>
                      <span>·</span>
                      <span className="font-medium text-neutral-700">
                        {lesson.periodOrCampaign}
                      </span>
                      <span>·</span>
                      <button
                        onClick={() => handleToggleStatus(lesson)}
                        className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded font-medium transition-colors ${
                          isValid
                            ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                            : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                        }`}
                        title="Click to toggle Valid / Outdated"
                      >
                        {isValid ? (
                          <>
                            <Check className="w-3 h-3" /> Valid
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3" /> Outdated
                          </>
                        )}
                      </button>
                    </div>

                    <p className="text-sm text-neutral-800 leading-relaxed font-sans">
                      {lesson.text}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 pt-0.5">
                    <button
                      onClick={() => handleStartEdit(lesson)}
                      className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded transition-colors"
                      title="Edit Lesson"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(lesson.id)}
                      className="p-1.5 text-neutral-400 hover:text-rose-600 rounded transition-colors"
                      title="Delete Lesson"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
