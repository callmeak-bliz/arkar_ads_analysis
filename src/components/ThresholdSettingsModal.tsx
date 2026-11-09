import React, { useState } from 'react';
import { ThresholdSettings } from '../types';
import { X, Sliders, RotateCcw } from 'lucide-react';
import { DEFAULT_THRESHOLDS } from '../utils/calculator';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  thresholds: ThresholdSettings;
  onSave: (thresholds: ThresholdSettings) => void;
}

export const ThresholdSettingsModal: React.FC<Props> = ({ isOpen, onClose, thresholds, onSave }) => {
  const [form, setForm] = useState<ThresholdSettings>(thresholds);

  if (!isOpen) return null;

  const handleReset = () => {
    setForm(DEFAULT_THRESHOLDS);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-neutral-200">
        <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-neutral-700" />
            <h2 className="text-base font-semibold text-neutral-900">Flag Detection Thresholds</h2>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-sm">
          <div>
            <label className="block font-medium text-neutral-700 mb-1">
              Minimum LPV Rate (%)
            </label>
            <p className="text-xs text-neutral-500 mb-1.5">
              Landing page views ÷ Link clicks. Triggers flag when below this threshold.
            </p>
            <input
              type="number"
              min="10"
              max="90"
              step="1"
              value={form.lpvRateMin}
              onChange={(e) => setForm({ ...form, lpvRateMin: parseFloat(e.target.value) || 0 })}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 focus:border-neutral-900 focus:outline-hidden"
              required
            />
          </div>

          <div>
            <label className="block font-medium text-neutral-700 mb-1">
              Audience Fatigue Frequency
            </label>
            <p className="text-xs text-neutral-500 mb-1.5">
              Average impressions per person. Triggers fatigue flag when exceeded.
            </p>
            <input
              type="number"
              min="1.5"
              max="10"
              step="0.1"
              value={form.fatigueFrequency}
              onChange={(e) => setForm({ ...form, fatigueFrequency: parseFloat(e.target.value) || 0 })}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 focus:border-neutral-900 focus:outline-hidden"
              required
            />
          </div>

          <div>
            <label className="block font-medium text-neutral-700 mb-1">
              Underperformer CPR Multiplier (× Goal Average)
            </label>
            <p className="text-xs text-neutral-500 mb-1.5">
              Flags ads whose Cost per Result is this many times the goal average CPR.
            </p>
            <input
              type="number"
              min="1.2"
              max="5"
              step="0.1"
              value={form.underperformerMultiplier}
              onChange={(e) => setForm({ ...form, underperformerMultiplier: parseFloat(e.target.value) || 0 })}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 focus:border-neutral-900 focus:outline-hidden"
              required
            />
          </div>

          <div>
            <label className="block font-medium text-neutral-700 mb-1">
              High CTR Threshold for Quality Check (%)
            </label>
            <p className="text-xs text-neutral-500 mb-1.5">
              Ads with CTR at or above this value and "Below average" quality ranking are flagged.
            </p>
            <input
              type="number"
              min="0.5"
              max="10"
              step="0.1"
              value={form.highCtrThreshold}
              onChange={(e) => setForm({ ...form, highCtrThreshold: parseFloat(e.target.value) || 0 })}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 focus:border-neutral-900 focus:outline-hidden"
              required
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-800 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset defaults
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-lg border border-neutral-200 text-neutral-700 hover:bg-neutral-50 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 text-xs font-medium transition-colors"
              >
                Save Settings
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
