import React, { useState } from 'react';
import { ClientProfile } from '../types';
import { Plus, Edit2, Trash2, Check, ArrowRight, UserPlus, Target, DollarSign, MapPin, Users } from 'lucide-react';

interface Props {
  clients: ClientProfile[];
  selectedClientId: string | null;
  onSelectClient: (clientId: string) => void;
  onSaveClient: (client: ClientProfile) => void;
  onDeleteClient: (clientId: string) => void;
  onNavigateToAnalyze: () => void;
}

const COMMON_CURRENCIES = ['THB', 'MMK', 'USD', 'SGD', 'MYR'];

export const ClientsTab: React.FC<Props> = ({
  clients,
  selectedClientId,
  onSelectClient,
  onSaveClient,
  onDeleteClient,
  onNavigateToAnalyze,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [businessAndProduct, setBusinessAndProduct] = useState('');
  const [mainGoals, setMainGoals] = useState('');
  const [targetLocation, setTargetLocation] = useState('Yangon, Myanmar');
  const [targetAudience, setTargetAudience] = useState('');
  const [currency, setCurrency] = useState('THB');
  const [customCurrency, setCustomCurrency] = useState('');
  const [targetCpc, setTargetCpc] = useState<string>('');
  const [targetCostPerLpv, setTargetCostPerLpv] = useState<string>('');
  const [targetCpm, setTargetCpm] = useState<string>('');

  const resetForm = () => {
    setName('');
    setBusinessAndProduct('');
    setMainGoals('');
    setTargetLocation('Yangon, Myanmar');
    setTargetAudience('');
    setCurrency('THB');
    setCustomCurrency('');
    setTargetCpc('');
    setTargetCostPerLpv('');
    setTargetCpm('');
    setEditingId(null);
    setIsEditing(false);
  };

  const handleStartCreate = () => {
    resetForm();
    setIsEditing(true);
  };

  const handleStartEdit = (client: ClientProfile) => {
    setName(client.name);
    setBusinessAndProduct(client.businessAndProduct);
    setMainGoals(client.mainGoals);
    setTargetLocation(client.targetLocation);
    setTargetAudience(client.targetAudience);
    if (COMMON_CURRENCIES.includes(client.currency)) {
      setCurrency(client.currency);
      setCustomCurrency('');
    } else {
      setCurrency('OTHER');
      setCustomCurrency(client.currency);
    }
    setTargetCpc(client.targets?.targetCpc !== undefined ? String(client.targets.targetCpc) : '');
    setTargetCostPerLpv(client.targets?.targetCostPerLpv !== undefined ? String(client.targets.targetCostPerLpv) : '');
    setTargetCpm(client.targets?.targetCpm !== undefined ? String(client.targets.targetCpm) : '');
    setEditingId(client.id);
    setIsEditing(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const finalCurrency = currency === 'OTHER' ? customCurrency.trim().toUpperCase() || 'THB' : currency;

    const targets = {
      targetCpc: targetCpc ? parseFloat(targetCpc) : undefined,
      targetCostPerLpv: targetCostPerLpv ? parseFloat(targetCostPerLpv) : undefined,
      targetCpm: targetCpm ? parseFloat(targetCpm) : undefined,
    };

    const clientData: ClientProfile = {
      id: editingId || `client_${Date.now()}`,
      name: name.trim(),
      businessAndProduct: businessAndProduct.trim(),
      mainGoals: mainGoals.trim(),
      targetLocation: targetLocation.trim(),
      targetAudience: targetAudience.trim(),
      currency: finalCurrency,
      targets,
      createdAt: editingId ? (clients.find((c) => c.id === editingId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSaveClient(clientData);
    if (!selectedClientId) {
      onSelectClient(clientData.id);
    }
    resetForm();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900">Client Profiles</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Manage your Myanmar clients. Each client has completely separated data, targets, and lessons.
          </p>
        </div>
        {!isEditing && (
          <button
            onClick={handleStartCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 text-xs font-medium transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add New Client
          </button>
        )}
      </div>

      {/* Client Form (Modal-like inline card) */}
      {isEditing && (
        <div className="rounded-xl border border-neutral-300 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-neutral-100">
            <h2 className="text-base font-semibold text-neutral-900">
              {editingId ? 'Edit Client Profile' : 'Create New Client Profile'}
            </h2>
            <button
              onClick={resetForm}
              className="text-xs text-neutral-500 hover:text-neutral-800 transition-colors"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Client / Brand Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Bella Beauty Clinic, Yangon Mart"
                  required
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Currency <span className="text-rose-500">*</span>
                </label>
                <div className="flex gap-2">
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-hidden"
                  >
                    <option value="THB">THB (Thai Baht - Default)</option>
                    <option value="MMK">MMK (Myanmar Kyat)</option>
                    <option value="USD">USD (US Dollar)</option>
                    <option value="SGD">SGD (Singapore Dollar)</option>
                    <option value="MYR">MYR (Malaysian Ringgit)</option>
                    <option value="OTHER">Custom Currency...</option>
                  </select>
                  {currency === 'OTHER' && (
                    <input
                      type="text"
                      placeholder="Code (e.g. EUR)"
                      value={customCurrency}
                      onChange={(e) => setCustomCurrency(e.target.value)}
                      className="w-28 rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-hidden uppercase"
                      required
                    />
                  )}
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Business & Product Description <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={businessAndProduct}
                  onChange={(e) => setBusinessAndProduct(e.target.value)}
                  placeholder="e.g. Premium skincare treatments and Korean medical aesthetics products"
                  required
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Main Campaign Goals <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={mainGoals}
                  onChange={(e) => setMainGoals(e.target.value)}
                  placeholder="e.g. Lead generation via Messenger, Brand awareness for new branch"
                  required
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Target Location <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={targetLocation}
                  onChange={(e) => setTargetLocation(e.target.value)}
                  placeholder="e.g. Yangon (Downtown & Kamayut), Mandalay"
                  required
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-hidden"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Target Audience
                </label>
                <input
                  type="text"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="e.g. Females 22-45 interested in skincare, Korean beauty, working professionals"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Optional KPI Targets */}
            <div className="pt-3 border-t border-neutral-100">
              <h3 className="text-xs font-semibold text-neutral-700 mb-2 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-neutral-500" />
                Optional Target Benchmarks (for automatic On/Off target flagging)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-neutral-500 mb-1">
                    Target CPC ({currency === 'OTHER' ? customCurrency || 'CUR' : currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 2.50"
                    value={targetCpc}
                    onChange={(e) => setTargetCpc(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-xs text-neutral-900 focus:border-neutral-900 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-neutral-500 mb-1">
                    Target Cost per LPV ({currency === 'OTHER' ? customCurrency || 'CUR' : currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 4.00"
                    value={targetCostPerLpv}
                    onChange={(e) => setTargetCostPerLpv(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-xs text-neutral-900 focus:border-neutral-900 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-neutral-500 mb-1">
                    Target CPM ({currency === 'OTHER' ? customCurrency || 'CUR' : currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 60.00"
                    value={targetCpm}
                    onChange={(e) => setTargetCpm(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-xs text-neutral-900 focus:border-neutral-900 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-neutral-100">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 rounded-lg border border-neutral-200 text-neutral-700 hover:bg-neutral-50 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 text-xs font-medium transition-colors"
              >
                {editingId ? 'Update Client' : 'Save Client'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Clients List or Empty State */}
      {clients.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-4 text-neutral-600">
            <UserPlus className="w-6 h-6" />
          </div>
          <h2 className="text-base font-semibold text-neutral-900 mb-1">No Client Profiles Yet</h2>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto mb-5 leading-relaxed">
            Create client profiles for the Myanmar businesses you run Meta Ads for. All uploaded reports, calculations, and AI insights are strictly separated per client.
          </p>
          <button
            onClick={handleStartCreate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 text-xs font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Your First Client
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((client) => {
            const isSelected = selectedClientId === client.id;
            return (
              <div
                key={client.id}
                className={`rounded-xl border p-5 transition-all bg-white flex flex-col justify-between ${
                  isSelected
                    ? 'border-neutral-900 shadow-sm ring-1 ring-neutral-900'
                    : 'border-neutral-200 hover:border-neutral-400'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-base font-bold text-neutral-900 truncate">
                      {client.name}
                    </h3>
                    <span className="text-[11px] font-mono font-medium text-neutral-500 px-1.5 py-0.5 rounded bg-neutral-100 shrink-0">
                      {client.currency}
                    </span>
                  </div>

                  <p className="text-xs text-neutral-600 mb-3 line-clamp-2">
                    {client.businessAndProduct}
                  </p>

                  <div className="space-y-1.5 text-xs text-neutral-500 pt-2 border-t border-neutral-100">
                    <div className="flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                      <span className="truncate">{client.mainGoals}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                      <span className="truncate">{client.targetLocation}</span>
                    </div>
                    {client.targetAudience && (
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span className="truncate">{client.targetAudience}</span>
                      </div>
                    )}
                  </div>

                  {/* Targets preview if any */}
                  {client.targets && (client.targets.targetCpc || client.targets.targetCostPerLpv || client.targets.targetCpm) && (
                    <div className="mt-3 pt-2 border-t border-neutral-100 text-[11px] text-neutral-500 flex flex-wrap gap-2">
                      {client.targets.targetCpc !== undefined && (
                        <span>CPC: {client.currency} {client.targets.targetCpc}</span>
                      )}
                      {client.targets.targetCostPerLpv !== undefined && (
                        <span>LPV: {client.currency} {client.targets.targetCostPerLpv}</span>
                      )}
                      {client.targets.targetCpm !== undefined && (
                        <span>CPM: {client.currency} {client.targets.targetCpm}</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-4 mt-4 border-t border-neutral-100">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleStartEdit(client)}
                      title="Edit Profile"
                      className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-md transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete client "${client.name}" and all associated lessons?`)) {
                          onDeleteClient(client.id);
                        }
                      }}
                      title="Delete Client"
                      className="p-1.5 text-neutral-400 hover:text-rose-600 rounded-md transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {isSelected ? (
                      <button
                        onClick={onNavigateToAnalyze}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 transition-colors"
                      >
                        <span>Analyze Ads</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => onSelectClient(client.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-neutral-300 text-neutral-700 hover:border-neutral-900 text-xs font-medium transition-colors"
                      >
                        <Check className="w-3.5 h-3.5 text-neutral-400" />
                        <span>Select Client</span>
                      </button>
                    )}
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
