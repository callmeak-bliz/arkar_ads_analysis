import {
  ProcessedAdRow,
  GoalSummary,
  CampaignSummary,
  AdSetSummary,
  AutomaticFlag,
  ThresholdSettings,
  ClientProfile,
  ManualBusinessResults,
  ComparisonMetric,
} from '../types';

export const DEFAULT_THRESHOLDS: ThresholdSettings = {
  lpvRateMin: 55, // 55%
  fatigueFrequency: 3.0,
  underperformerMultiplier: 2.0, // 2x
  highCtrThreshold: 1.5, // 1.5%
};

/**
 * Check if two date intervals overlap
 */
export function areDatesOverlapping(startA: string, endA: string, startB: string, endB: string): boolean {
  if (!startA || !startB || startA === 'Ongoing' || startB === 'Ongoing') {
    // If ongoing, assume they run concurrently if both exist
    return true;
  }
  const dateAStart = new Date(startA).getTime();
  const dateAEnd = endA && endA !== 'Ongoing' ? new Date(endA).getTime() : Infinity;
  const dateBStart = new Date(startB).getTime();
  const dateBEnd = endB && endB !== 'Ongoing' ? new Date(endB).getTime() : Infinity;

  if (isNaN(dateAStart) || isNaN(dateBStart)) return false;

  return dateAStart <= dateBEnd && dateBStart <= dateAEnd;
}

/**
 * Group ads by Campaign -> Ad Set -> Ad and calculate aggregations
 */
export function calculateAggregations(
  rows: ProcessedAdRow[],
  campaignGoalOverrides: Record<string, string> = {}
): {
  campaigns: CampaignSummary[];
  adSets: AdSetSummary[];
  goalSummaries: Record<string, GoalSummary>;
  effectiveRows: ProcessedAdRow[];
} {
  // Apply campaign goal overrides if any
  const effectiveRows: ProcessedAdRow[] = rows.map((r) => {
    const overrideGoal = campaignGoalOverrides[r.campaignName];
    return overrideGoal ? { ...r, detectedGoal: overrideGoal } : r;
  });

  // Group by campaign
  const campaignMap = new Map<string, ProcessedAdRow[]>();
  for (const row of effectiveRows) {
    const cName = row.campaignName;
    if (!campaignMap.has(cName)) {
      campaignMap.set(cName, []);
    }
    campaignMap.get(cName)!.push(row);
  }

  const campaigns: CampaignSummary[] = [];
  for (const [campaignName, cRows] of campaignMap.entries()) {
    const totalSpend = cRows.reduce((acc, r) => acc + r.amountSpent, 0);
    const totalReach = cRows.reduce((acc, r) => acc + r.reach, 0);
    const totalImpressions = cRows.reduce((acc, r) => acc + r.impressions, 0);
    const linkClicks = cRows.reduce((acc, r) => acc + r.linkClicks, 0);
    const landingPageViews = cRows.reduce((acc, r) => acc + r.landingPageViews, 0);
    const results = cRows.reduce((acc, r) => acc + r.results, 0);

    const frequency = totalReach > 0 ? Number((totalImpressions / totalReach).toFixed(2)) : 0;
    const cpm = totalImpressions > 0 ? Number(((totalSpend / totalImpressions) * 1000).toFixed(2)) : 0;
    const ctr = totalImpressions > 0 ? Number(((linkClicks / totalImpressions) * 100).toFixed(2)) : 0;
    const cpc = linkClicks > 0 ? Number((totalSpend / linkClicks).toFixed(2)) : 0;
    const costPerLpv = landingPageViews > 0 ? Number((totalSpend / landingPageViews).toFixed(2)) : 0;
    const lpvRate = linkClicks > 0 ? Number(((landingPageViews / linkClicks) * 100).toFixed(1)) : 0;
    const costPerResult = results > 0 ? Number((totalSpend / results).toFixed(2)) : 0;

    const uniqueAdSets = new Set(cRows.map((r) => r.adSetName)).size;
    const goal = cRows[0]?.detectedGoal || 'Other';
    const starts = cRows[0]?.starts || '';
    const ends = cRows[0]?.ends || '';

    campaigns.push({
      campaignName,
      goal,
      starts,
      ends,
      totalSpend: Number(totalSpend.toFixed(2)),
      totalReach,
      totalImpressions,
      frequency,
      cpm,
      linkClicks,
      ctr,
      cpc,
      landingPageViews,
      costPerLpv,
      lpvRate,
      results,
      costPerResult,
      adSetCount: uniqueAdSets,
      adCount: cRows.length,
      budgetType: cRows[0]?.adSetBudgetType,
      budget: cRows[0]?.adSetBudget,
    });
  }

  // Group by Ad set
  const adSetMap = new Map<string, ProcessedAdRow[]>();
  for (const row of effectiveRows) {
    const key = `${row.campaignName}___${row.adSetName}`;
    if (!adSetMap.has(key)) {
      adSetMap.set(key, []);
    }
    adSetMap.get(key)!.push(row);
  }

  const adSets: AdSetSummary[] = [];
  for (const [, asRows] of adSetMap.entries()) {
    const totalSpend = asRows.reduce((acc, r) => acc + r.amountSpent, 0);
    const totalReach = asRows.reduce((acc, r) => acc + r.reach, 0);
    const totalImpressions = asRows.reduce((acc, r) => acc + r.impressions, 0);
    const linkClicks = asRows.reduce((acc, r) => acc + r.linkClicks, 0);
    const landingPageViews = asRows.reduce((acc, r) => acc + r.landingPageViews, 0);
    const results = asRows.reduce((acc, r) => acc + r.results, 0);

    const frequency = totalReach > 0 ? Number((totalImpressions / totalReach).toFixed(2)) : 0;
    const cpm = totalImpressions > 0 ? Number(((totalSpend / totalImpressions) * 1000).toFixed(2)) : 0;
    const ctr = totalImpressions > 0 ? Number(((linkClicks / totalImpressions) * 100).toFixed(2)) : 0;
    const cpc = linkClicks > 0 ? Number((totalSpend / linkClicks).toFixed(2)) : 0;
    const costPerLpv = landingPageViews > 0 ? Number((totalSpend / landingPageViews).toFixed(2)) : 0;
    const lpvRate = linkClicks > 0 ? Number(((landingPageViews / linkClicks) * 100).toFixed(1)) : 0;
    const costPerResult = results > 0 ? Number((totalSpend / results).toFixed(2)) : 0;

    adSets.push({
      campaignName: asRows[0].campaignName,
      adSetName: asRows[0].adSetName,
      budget: asRows[0].adSetBudget,
      budgetType: asRows[0].adSetBudgetType,
      totalSpend: Number(totalSpend.toFixed(2)),
      totalReach,
      totalImpressions,
      frequency,
      cpm,
      linkClicks,
      ctr,
      cpc,
      landingPageViews,
      costPerLpv,
      lpvRate,
      results,
      costPerResult,
      adCount: asRows.length,
    });
  }

  // Group by Goal (NEVER add results of different goals together!)
  const goalMap = new Map<string, ProcessedAdRow[]>();
  for (const row of effectiveRows) {
    const g = row.detectedGoal;
    if (!goalMap.has(g)) {
      goalMap.set(g, []);
    }
    goalMap.get(g)!.push(row);
  }

  const goalSummaries: Record<string, GoalSummary> = {};
  for (const [goal, gRows] of goalMap.entries()) {
    const totalSpend = gRows.reduce((acc, r) => acc + r.amountSpent, 0);
    const totalReach = gRows.reduce((acc, r) => acc + r.reach, 0);
    const totalImpressions = gRows.reduce((acc, r) => acc + r.impressions, 0);
    const totalLinkClicks = gRows.reduce((acc, r) => acc + r.linkClicks, 0);
    const totalLandingPageViews = gRows.reduce((acc, r) => acc + r.landingPageViews, 0);
    const totalResults = gRows.reduce((acc, r) => acc + r.results, 0);

    const frequency = totalReach > 0 ? Number((totalImpressions / totalReach).toFixed(2)) : 0;
    const cpm = totalImpressions > 0 ? Number(((totalSpend / totalImpressions) * 1000).toFixed(2)) : 0;
    const ctr = totalImpressions > 0 ? Number(((totalLinkClicks / totalImpressions) * 100).toFixed(2)) : 0;
    const cpc = totalLinkClicks > 0 ? Number((totalSpend / totalLinkClicks).toFixed(2)) : 0;
    const costPerLpv = totalLandingPageViews > 0 ? Number((totalSpend / totalLandingPageViews).toFixed(2)) : 0;
    const lpvRate = totalLinkClicks > 0 ? Number(((totalLandingPageViews / totalLinkClicks) * 100).toFixed(1)) : 0;
    const costPerResult = totalResults > 0 ? Number((totalSpend / totalResults).toFixed(2)) : 0;

    const campaignCount = new Set(gRows.map((r) => r.campaignName)).size;

    goalSummaries[goal] = {
      goal,
      totalSpend: Number(totalSpend.toFixed(2)),
      totalReach,
      totalImpressions,
      frequency,
      cpm,
      totalLinkClicks,
      ctr,
      cpc,
      totalLandingPageViews,
      costPerLpv,
      lpvRate,
      totalResults,
      costPerResult,
      adCount: gRows.length,
      campaignCount,
    };
  }

  return {
    campaigns,
    adSets,
    goalSummaries,
    effectiveRows,
  };
}

/**
 * Detect automatic performance flags in JavaScript (Code only!)
 */
export function detectAutomaticFlags(
  rows: ProcessedAdRow[],
  campaigns: CampaignSummary[],
  adSets: AdSetSummary[],
  goalSummaries: Record<string, GoalSummary>,
  client: ClientProfile | null,
  thresholds: ThresholdSettings = DEFAULT_THRESHOLDS
): AutomaticFlag[] {
  const flags: AutomaticFlag[] = [];
  const curr = client?.currency || 'THB';

  // 1. Overspend: Lifetime budget and spend > budget
  for (const adSet of adSets) {
    const isLifetime = (adSet.budgetType || '').toLowerCase().includes('lifetime');
    if (isLifetime && adSet.budget && adSet.totalSpend > adSet.budget) {
      const overspendAmount = Number((adSet.totalSpend - adSet.budget).toFixed(2));
      const overspendPercent = Number(((overspendAmount / adSet.budget) * 100).toFixed(1));
      flags.push({
        id: `flag_overspend_${adSet.campaignName}_${adSet.adSetName}`,
        type: 'overspend',
        severity: 'critical',
        title: 'Overspend on Lifetime Budget',
        entityName: adSet.adSetName,
        entityType: 'Ad set',
        metrics: {
          'Ad set budget': `${curr} ${adSet.budget.toLocaleString()}`,
          'Total spend': `${curr} ${adSet.totalSpend.toLocaleString()}`,
          'Overspend': `+${curr} ${overspendAmount.toLocaleString()} (+${overspendPercent}%)`,
        },
        explanation: `Ad set "${adSet.adSetName}" has a Lifetime budget of ${curr} ${adSet.budget.toLocaleString()} but total spend reached ${curr} ${adSet.totalSpend.toLocaleString()} (+${overspendPercent}%).`,
        recommendation: 'Check ad delivery schedule and pacing rules to ensure lifetime limits do not overshoot.',
      });
    }
  }

  // 2. High CTR but Quality ranking "Below average"
  for (const ad of rows) {
    const qRank = (ad.qualityRanking || '').toLowerCase();
    const isBelowAvg = qRank.includes('below') || qRank.includes('bottom');
    const goalSummary = goalSummaries[ad.detectedGoal];
    const isHighCtr = ad.ctr >= thresholds.highCtrThreshold || (goalSummary && ad.ctr > goalSummary.ctr);

    if (isHighCtr && isBelowAvg) {
      flags.push({
        id: `flag_quality_${ad.id}`,
        type: 'quality_below_avg',
        severity: 'warning',
        title: 'High CTR but Quality Ranking Below Average',
        entityName: ad.adName,
        entityType: 'Ad',
        metrics: {
          'CTR': `${ad.ctr}%`,
          'Quality ranking': ad.qualityRanking,
          'CPM': `${curr} ${ad.cpm}`,
        },
        explanation: `Ad "${ad.adName}" attracts clicks (CTR ${ad.ctr}%) but Meta rated its Quality ranking as "${ad.qualityRanking}". The creative may appear low quality, sensational, or clickbaity to Meta algorithms, which artificially inflates CPM.`,
        recommendation: 'Refine visual creative clarity, remove clickbait phrasing, or polish typography. Raising Quality ranking will decrease CPM and increase reach efficiency.',
      });
    }
  }

  // 3. Low LPV rate (< 55%) or Conversion rate ranking "Below average"
  for (const ad of rows) {
    if (ad.linkClicks >= 10) {
      const convRank = (ad.conversionRateRanking || '').toLowerCase();
      const isConvBelow = convRank.includes('below') || convRank.includes('bottom');
      const isLowLpv = ad.lpvRate < thresholds.lpvRateMin;

      if (isLowLpv || isConvBelow) {
        flags.push({
          id: `flag_lpv_${ad.id}`,
          type: 'lpv_issue',
          severity: isLowLpv && isConvBelow ? 'critical' : 'warning',
          title: isLowLpv ? 'Drop-off between Link Clicks and Landing Page Views' : 'Conversion Rate Ranking Below Average',
          entityName: ad.adName,
          entityType: 'Ad',
          metrics: {
            'Link clicks': ad.linkClicks,
            'Landing page views': ad.landingPageViews,
            'LPV rate': `${ad.lpvRate}% (Target: ≥${thresholds.lpvRateMin}%)`,
            'Conversion ranking': ad.conversionRateRanking,
          },
          explanation: `Users clicked the ad ${ad.linkClicks} times, but only ${ad.landingPageViews} loaded the landing page (LPV rate: ${ad.lpvRate}%). ${
            isConvBelow ? `Conversion ranking is also "${ad.conversionRateRanking}".` : ''
          } Indicates page speed lag (common on mobile Myanmar networks), broken tracking, or destination mismatch.`,
          recommendation: 'Test landing page mobile load speed (keep under 2.5s on 4G), check tracking pixel fires, or simplify the mobile destination layout.',
        });
      }
    }
  }

  // 4. Inside the same ad set, the weaker ad got more spend than the better ad
  // Group rows by adSet
  const adSetAdMap = new Map<string, ProcessedAdRow[]>();
  for (const r of rows) {
    const key = `${r.campaignName}___${r.adSetName}`;
    if (!adSetAdMap.has(key)) adSetAdMap.set(key, []);
    adSetAdMap.get(key)!.push(r);
  }

  for (const [, setRows] of adSetAdMap.entries()) {
    if (setRows.length >= 2) {
      // Filter ads with results > 0
      const adsWithResults = setRows.filter((a) => a.results > 0);
      if (adsWithResults.length >= 2) {
        // Find ad with lowest costPerResult (best) and ad with highest spend
        adsWithResults.sort((a, b) => a.costPerResult - b.costPerResult);
        const bestAd = adsWithResults[0]; // lowest CPR
        const worstAd = adsWithResults[adsWithResults.length - 1]; // highest CPR

        if (worstAd.costPerResult > bestAd.costPerResult * 1.2 && worstAd.amountSpent > bestAd.amountSpent * 1.1) {
          flags.push({
            id: `flag_inversion_${worstAd.id}_vs_${bestAd.id}`,
            type: 'budget_inversion',
            severity: 'warning',
            title: 'Budget Allocation Inefficiency Inside Ad Set',
            entityName: worstAd.adSetName,
            entityType: 'Ad set',
            metrics: {
              'Weaker ad': `${worstAd.adName} (${curr} ${worstAd.costPerResult} CPR, ${curr} ${worstAd.amountSpent} spent)`,
              'Better ad': `${bestAd.adName} (${curr} ${bestAd.costPerResult} CPR, ${curr} ${bestAd.amountSpent} spent)`,
            },
            explanation: `Inside ad set "${worstAd.adSetName}", weaker ad "${worstAd.adName}" (Cost per result: ${curr} ${worstAd.costPerResult}) consumed ${curr} ${worstAd.amountSpent}, whereas better ad "${bestAd.adName}" (Cost per result: ${curr} ${bestAd.costPerResult}) received only ${curr} ${bestAd.amountSpent}.`,
            recommendation: `Pause "${worstAd.adName}" or separate "${bestAd.adName}" into a dedicated ad set with fixed spend to maximize return.`,
          });
        }
      }
    }
  }

  // 5. Same goal campaigns running on overlapping dates -> competing with each other
  for (let i = 0; i < campaigns.length; i++) {
    for (let j = i + 1; j < campaigns.length; j++) {
      const campA = campaigns[i];
      const campB = campaigns[j];

      if (campA.goal === campB.goal && areDatesOverlapping(campA.starts, campA.ends, campB.starts, campB.ends)) {
        flags.push({
          id: `flag_competition_${campA.campaignName}_${campB.campaignName}`,
          type: 'campaign_competition',
          severity: 'warning',
          title: 'Auction Overlap / Campaign Competition',
          entityName: `${campA.campaignName} & ${campB.campaignName}`,
          entityType: 'Campaign',
          metrics: {
            'Shared goal': campA.goal,
            'Campaign A dates': `${campA.starts} to ${campA.ends}`,
            'Campaign B dates': `${campB.starts} to ${campB.ends}`,
          },
          explanation: `Campaigns "${campA.campaignName}" and "${campB.campaignName}" target the same goal (${campA.goal}) over overlapping dates. If audience targeting overlaps, they enter the same auction and bid against each other, driving up CPM.`,
          recommendation: 'Check audience overlap in Meta Ads Manager. Consolidate into one campaign using CBO/Advantage+ budget or add audience exclusions.',
        });
      }
    }
  }

  // 6. Frequency > 3 -> audience fatigue
  for (const camp of campaigns) {
    if (camp.frequency >= thresholds.fatigueFrequency) {
      flags.push({
        id: `flag_fatigue_${camp.campaignName}`,
        type: 'audience_fatigue',
        severity: 'warning',
        title: 'High Frequency / Audience Fatigue',
        entityName: camp.campaignName,
        entityType: 'Campaign',
        metrics: {
          'Frequency': camp.frequency,
          'Threshold': `≥ ${thresholds.fatigueFrequency}`,
          'Total reach': camp.totalReach.toLocaleString(),
          'Total impressions': camp.totalImpressions.toLocaleString(),
        },
        explanation: `Campaign "${camp.campaignName}" reached a frequency of ${camp.frequency}. The target audience has seen the ad over 3 times on average, leading to ad fatigue and diminishing conversion rates.`,
        recommendation: 'Rotate fresh creatives, expand audience size, or test lookalikes/interest variations to renew delivery efficiency.',
      });
    }
  }

  // 7. Same-goal ads whose cost per result is 2× the goal average -> underperformer
  for (const ad of rows) {
    if (ad.results > 0) {
      const goalSummary = goalSummaries[ad.detectedGoal];
      if (goalSummary && goalSummary.costPerResult > 0) {
        const thresholdCost = goalSummary.costPerResult * thresholds.underperformerMultiplier;
        if (ad.costPerResult >= thresholdCost && ad.amountSpent > goalSummary.costPerResult * 2) {
          flags.push({
            id: `flag_underperformer_${ad.id}`,
            type: 'underperformer',
            severity: 'critical',
            title: `Underperforming Ad (${thresholds.underperformerMultiplier}× Goal Average CPR)`,
            entityName: ad.adName,
            entityType: 'Ad',
            metrics: {
              'Ad CPR': `${curr} ${ad.costPerResult}`,
              'Goal average CPR': `${curr} ${goalSummary.costPerResult}`,
              'Multiple': `${(ad.costPerResult / goalSummary.costPerResult).toFixed(1)}×`,
              'Amount spent': `${curr} ${ad.amountSpent}`,
            },
            explanation: `Ad "${ad.adName}" in "${ad.campaignName}" generated results at ${curr} ${ad.costPerResult} each, which is ${(
              ad.costPerResult / goalSummary.costPerResult
            ).toFixed(1)}× higher than the goal average (${curr} ${goalSummary.costPerResult}).`,
            recommendation: 'Turn off this creative immediately and allocate its budget to top-performing ads in the same goal.',
          });
        }
      }
    }
  }

  // 8. If targets are set: on / off target
  if (client?.targets) {
    const { targetCpc, targetCostPerLpv, targetCpm } = client.targets;

    if (targetCpc !== undefined && targetCpc > 0) {
      for (const camp of campaigns) {
        if (camp.cpc > 0) {
          const isOff = camp.cpc > targetCpc;
          if (isOff) {
            flags.push({
              id: `flag_target_cpc_${camp.campaignName}`,
              type: 'target_off',
              severity: 'info',
              title: 'CPC Above Target',
              entityName: camp.campaignName,
              entityType: 'Campaign',
              metrics: {
                'Actual CPC': `${curr} ${camp.cpc}`,
                'Target CPC': `${curr} ${targetCpc}`,
                'Gap': `+${curr} ${(camp.cpc - targetCpc).toFixed(2)}`,
              },
              explanation: `Campaign "${camp.campaignName}" recorded a CPC of ${curr} ${camp.cpc}, exceeding the client's target of ${curr} ${targetCpc}.`,
              recommendation: 'Optimize creative hook and headline copy to improve CTR, lowering CPC.',
            });
          }
        }
      }
    }

    if (targetCostPerLpv !== undefined && targetCostPerLpv > 0) {
      for (const camp of campaigns) {
        if (camp.costPerLpv > 0 && camp.costPerLpv > targetCostPerLpv) {
          flags.push({
            id: `flag_target_lpv_${camp.campaignName}`,
            type: 'target_off',
            severity: 'info',
            title: 'Cost per Landing Page View Above Target',
            entityName: camp.campaignName,
            entityType: 'Campaign',
            metrics: {
              'Actual Cost per LPV': `${curr} ${camp.costPerLpv}`,
              'Target Cost per LPV': `${curr} ${targetCostPerLpv}`,
              'Gap': `+${curr} ${(camp.costPerLpv - targetCostPerLpv).toFixed(2)}`,
            },
            explanation: `Campaign "${camp.campaignName}" cost per landing page view is ${curr} ${camp.costPerLpv}, exceeding the target of ${curr} ${targetCostPerLpv}.`,
            recommendation: 'Improve mobile page load speed and ensure landing page copy matches the ad promise.',
          });
        }
      }
    }

    if (targetCpm !== undefined && targetCpm > 0) {
      for (const camp of campaigns) {
        if (camp.cpm > 0 && camp.cpm > targetCpm) {
          flags.push({
            id: `flag_target_cpm_${camp.campaignName}`,
            type: 'target_off',
            severity: 'info',
            title: 'CPM Above Target',
            entityName: camp.campaignName,
            entityType: 'Campaign',
            metrics: {
              'Actual CPM': `${curr} ${camp.cpm}`,
              'Target CPM': `${curr} ${targetCpm}`,
              'Gap': `+${curr} ${(camp.cpm - targetCpm).toFixed(2)}`,
            },
            explanation: `Campaign "${camp.campaignName}" recorded a CPM of ${curr} ${camp.cpm}, above the target of ${curr} ${targetCpm}.`,
            recommendation: 'Broaden targeting, inspect creative quality rankings, and avoid narrow audience splits.',
          });
        }
      }
    }
  }

  return flags;
}

/**
 * Compare two sets of goal summaries for period-over-period diffs
 */
export function comparePeriods(
  current: Record<string, GoalSummary>,
  previous: Record<string, GoalSummary>
): Record<string, ComparisonMetric[]> {
  const result: Record<string, ComparisonMetric[]> = {};

  const allGoals = Array.from(new Set([...Object.keys(current), ...Object.keys(previous)]));

  for (const goal of allGoals) {
    const cur = current[goal];
    const prev = previous[goal];
    if (!cur || !prev) continue;

    const metricsToCompare: { key: keyof GoalSummary; label: string; lowerIsBetter?: boolean }[] = [
      { key: 'totalSpend', label: 'Spend' },
      { key: 'totalResults', label: 'Results' },
      { key: 'costPerResult', label: 'Cost per Result', lowerIsBetter: true },
      { key: 'cpm', label: 'CPM', lowerIsBetter: true },
      { key: 'ctr', label: 'CTR (%)' },
      { key: 'cpc', label: 'CPC', lowerIsBetter: true },
      { key: 'lpvRate', label: 'LPV Rate (%)' },
      { key: 'costPerLpv', label: 'Cost per LPV', lowerIsBetter: true },
    ];

    const comparisons: ComparisonMetric[] = [];
    for (const item of metricsToCompare) {
      const curVal = Number(cur[item.key]) || 0;
      const prevVal = Number(prev[item.key]) || 0;
      const diff = Number((curVal - prevVal).toFixed(2));
      const diffPercent = prevVal !== 0 ? Number(((diff / prevVal) * 100).toFixed(1)) : 0;
      const favorable = item.lowerIsBetter ? diff < 0 : diff > 0;

      comparisons.push({
        metric: item.label,
        current: curVal,
        previous: prevVal,
        diff,
        diffPercent,
        favorable,
      });
    }

    result[goal] = comparisons;
  }

  return result;
}

/**
 * Calculate Real Business Results metrics
 */
export function calculateBusinessMetrics(
  totalSpend: number,
  manual: ManualBusinessResults,
  currency: string = 'THB'
) {
  const count = manual.resultCount || 0;
  const revenue = manual.revenue || 0;

  const costPerRealResult = count > 0 ? Number((totalSpend / count).toFixed(2)) : 0;
  const roas = totalSpend > 0 && revenue > 0 ? Number((revenue / totalSpend).toFixed(2)) : 0;

  return {
    label: manual.resultLabel || 'Business Results',
    count,
    costPerRealResult: count > 0 ? `${currency} ${costPerRealResult.toLocaleString()}` : 'N/A',
    revenue: revenue > 0 ? `${currency} ${revenue.toLocaleString()}` : null,
    roas: roas > 0 ? `${roas}x` : null,
  };
}
