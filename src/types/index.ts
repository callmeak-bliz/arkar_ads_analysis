/**
 * Core type definitions for Ads Analyst
 */

export interface ClientTargetMetrics {
  targetCpc?: number;
  targetCostPerLpv?: number;
  targetCpm?: number;
}

export interface ClientProfile {
  id: string;
  name: string;
  businessAndProduct: string;
  mainGoals: string;
  targetLocation: string;
  targetAudience: string;
  currency: string; // default "THB"
  targets?: ClientTargetMetrics;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessedAdRow {
  id: string;
  campaignName: string;
  adSetName: string;
  adName: string;
  adDelivery: string;
  objective: string;
  attributionSetting: string;
  starts: string;
  ends: string;
  amountSpent: number;
  adSetBudget: number | null;
  adSetBudgetType: string | null;
  reach: number;
  impressions: number;
  frequency: number;
  cpm: number;
  results: number;
  resultIndicator: string;
  costPerResult: number;
  linkClicks: number;
  ctr: number;
  cpc: number;
  landingPageViews: number;
  costPerLpv: number;
  lpvRate: number; // (landingPageViews / linkClicks) * 100
  pageEngagement: number;
  facebookLikes: number;
  videoPlays: number;
  postEngagements: number;
  qualityRanking: string;
  engagementRateRanking: string;
  conversionRateRanking: string;
  detectedGoal: string; // e.g. "Awareness", "Traffic (clicks)", "Traffic (landing page views)", "Engagement", etc.
}

export interface GoalSummary {
  goal: string;
  totalSpend: number;
  totalReach: number;
  totalImpressions: number;
  frequency: number;
  cpm: number;
  totalLinkClicks: number;
  ctr: number;
  cpc: number;
  totalLandingPageViews: number;
  costPerLpv: number;
  lpvRate: number;
  totalResults: number;
  costPerResult: number;
  adCount: number;
  campaignCount: number;
}

export interface CampaignSummary {
  campaignName: string;
  goal: string;
  starts: string;
  ends: string;
  totalSpend: number;
  totalReach: number;
  totalImpressions: number;
  frequency: number;
  cpm: number;
  linkClicks: number;
  ctr: number;
  cpc: number;
  landingPageViews: number;
  costPerLpv: number;
  lpvRate: number;
  results: number;
  costPerResult: number;
  adSetCount: number;
  adCount: number;
  budgetType?: string | null;
  budget?: number | null;
}

export interface AdSetSummary {
  campaignName: string;
  adSetName: string;
  budget: number | null;
  budgetType: string | null;
  totalSpend: number;
  totalReach: number;
  totalImpressions: number;
  frequency: number;
  cpm: number;
  linkClicks: number;
  ctr: number;
  cpc: number;
  landingPageViews: number;
  costPerLpv: number;
  lpvRate: number;
  results: number;
  costPerResult: number;
  adCount: number;
}

export interface AutomaticFlag {
  id: string;
  type: 
    | 'overspend' 
    | 'quality_below_avg' 
    | 'lpv_issue' 
    | 'budget_inversion' 
    | 'campaign_competition' 
    | 'audience_fatigue' 
    | 'underperformer' 
    | 'target_off';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  entityName: string;
  entityType: 'Campaign' | 'Ad set' | 'Ad';
  metrics: Record<string, string | number>;
  explanation: string;
  recommendation: string;
}

export interface ThresholdSettings {
  lpvRateMin: number; // default 55%
  fatigueFrequency: number; // default 3.0
  underperformerMultiplier: number; // default 2.0x
  highCtrThreshold: number; // default 1.5%
}

export interface ManualBusinessResults {
  uniqueReach?: number | null;
  resultLabel: string; // e.g. "App Installs", "Orders", "Signups"
  resultCount?: number | null;
  revenue?: number | null;
}

export interface ComparisonMetric {
  metric: string;
  current: number;
  previous: number;
  diff: number;
  diffPercent: number;
  favorable: boolean; // whether positive diff is good for this metric
}

export interface AIAnalysisOutput {
  summary: string;           // 1. အခြေအနေ အကျဉ်းချုပ်
  bestWorst: string;         // 2. အကောင်းဆုံး / အညံ့ဆုံး
  issues: string;            // 3. ပြဿနာများ
  creativeLessons: string;   // 4. Creative သင်ခန်းစာ
  recommendations: string;   // 5. နောက် campaign အတွက် အကြံ
  suggestedLessons: string[];// 6. Suggested lessons (3-5 items)
}

export interface ApprovedLesson {
  id: string;
  clientId: string;
  date: string; // YYYY-MM-DD
  periodOrCampaign: string;
  text: string;
  status: 'Valid' | 'Outdated';
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ColumnStatus {
  name: string;
  found: boolean;
  required: boolean;
  aliasMatched?: string;
}
