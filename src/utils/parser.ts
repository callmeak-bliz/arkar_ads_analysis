import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { ProcessedAdRow, ColumnStatus } from '../types';

export const EXPECTED_COLUMNS: { name: string; required: boolean; regex: RegExp }[] = [
  { name: 'Campaign name', required: true, regex: /^campaign\s*name$/i },
  { name: 'Ad set name', required: true, regex: /^ad\s*set\s*name$/i },
  { name: 'Ad name', required: true, regex: /^ad\s*name$/i },
  { name: 'Ad delivery', required: false, regex: /^ad\s*delivery$/i },
  { name: 'Objective', required: false, regex: /^objective$/i },
  { name: 'Attribution setting', required: false, regex: /^attribution\s*setting$/i },
  { name: 'Starts', required: false, regex: /^starts$/i },
  { name: 'Ends', required: false, regex: /^ends$/i },
  { name: 'Amount spent', required: true, regex: /^amount\s*spent(\s*\(.*\))?$/i },
  { name: 'Ad set budget', required: false, regex: /^ad\s*set\s*budget$/i },
  { name: 'Ad set budget type', required: false, regex: /^ad\s*set\s*budget\s*type$/i },
  { name: 'Reach', required: true, regex: /^reach$/i },
  { name: 'Impressions', required: true, regex: /^impressions$/i },
  { name: 'Frequency', required: false, regex: /^frequency$/i },
  { name: 'CPM', required: false, regex: /^cpm(\s*\(.*\))?$/i },
  { name: 'Results', required: true, regex: /^results$/i },
  { name: 'Result indicator', required: false, regex: /^result\s*indicator$/i },
  { name: 'Cost per results', required: false, regex: /^cost\s*per\s*results?(\s*\(.*\))?$/i },
  { name: 'Link clicks', required: false, regex: /^link\s*clicks$/i },
  { name: 'CTR (link click-through rate)', required: false, regex: /^ctr(\s*\(.*\))?$/i },
  { name: 'CPC (cost per link click)', required: false, regex: /^cpc(\s*\(.*\))?$/i },
  { name: 'Landing page views', required: false, regex: /^landing\s*page\s*views$/i },
  { name: 'Cost per landing page view', required: false, regex: /^cost\s*per\s*landing\s*page\s*view(\s*\(.*\))?$/i },
  { name: 'Page engagement', required: false, regex: /^page\s*engagement$/i },
  { name: 'Facebook likes', required: false, regex: /^facebook\s*likes$/i },
  { name: 'Video plays', required: false, regex: /^video\s*plays$/i },
  { name: 'Post engagements', required: false, regex: /^post\s*engagements$/i },
  { name: 'Quality ranking', required: false, regex: /^quality\s*ranking$/i },
  { name: 'Engagement rate ranking', required: false, regex: /^engagement\s*rate\s*ranking$/i },
  { name: 'Conversion rate ranking', required: false, regex: /^conversion\s*rate\s*ranking$/i },
];

/**
 * Detect goal from Result indicator or objective
 */
export function detectGoal(resultIndicator: string, objective: string): string {
  const ind = (resultIndicator || '').toLowerCase().trim();
  const obj = (objective || '').toLowerCase().trim();

  if (ind.includes('reach') || obj.includes('reach') || obj.includes('awareness')) {
    return 'Awareness';
  }
  if (ind.includes('omni_landing_page_view') || ind.includes('landing_page_view')) {
    return 'Traffic (landing page views)';
  }
  if (ind.includes('link_click') || obj.includes('traffic')) {
    return 'Traffic (clicks)';
  }
  if (
    ind.includes('page_visit_view') ||
    ind.includes('post_interaction') ||
    ind.includes('like') ||
    ind.includes('post_engagement') ||
    ind.includes('page_engagement') ||
    obj.includes('engagement')
  ) {
    return 'Engagement';
  }
  if (ind.includes('lead') || obj.includes('lead')) {
    return 'Lead Generation';
  }
  if (ind.includes('messaging') || ind.includes('message')) {
    return 'Messages / Leads';
  }
  if (ind.includes('purchase') || ind.includes('order') || obj.includes('sales') || obj.includes('conversions')) {
    return 'Sales / Conversions';
  }

  // Fallback to capitalizing result indicator or "Other"
  if (ind && ind !== '-') {
    return ind.replace(/^actions:/, '').replace(/_/g, ' ');
  }
  return 'Other';
}

/**
 * Clean numeric string from Meta exports
 */
export function parseMetaNumber(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).trim();
  if (!str || str === '-' || str.toLowerCase() === 'n/a' || str.toLowerCase() === 'nan') return 0;
  // Remove currency codes, symbols, commas, percent
  const cleaned = str.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Clean date string and normalize 1970-01-01
 */
export function parseMetaDate(val: any): string {
  if (!val) return '';
  const str = String(val).trim();
  if (str.startsWith('1970-01-01') || str === '-') {
    return 'Ongoing';
  }
  return str;
}

export interface ParseResult {
  rows: ProcessedAdRow[];
  columnStatuses: ColumnStatus[];
  currencyDetected?: string;
  totalRawRows: number;
  excludedZeroSpendRows: number;
}

/**
 * Parse raw CSV or XLSX file
 */
export async function parseMetaAdsFile(file: File): Promise<ParseResult> {
  let rawData: Record<string, any>[] = [];

  const fileName = file.name.toLowerCase();
  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    rawData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
  } else {
    // CSV
    const text = await file.text();
    const parsed = Papa.parse<Record<string, any>>(text, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim(),
    });
    rawData = parsed.data;
  }

  if (!rawData.length) {
    throw new Error('The uploaded file contains no data rows.');
  }

  // Column matching
  const fileHeaders = Object.keys(rawData[0] || {});
  const columnStatuses: ColumnStatus[] = [];
  const headerMap: Record<string, string> = {};

  let currencyDetected = 'THB';

  for (const expected of EXPECTED_COLUMNS) {
    const matchedHeader = fileHeaders.find((fh) => expected.regex.test(fh.trim()));
    if (matchedHeader) {
      headerMap[expected.name] = matchedHeader;
      columnStatuses.push({
        name: expected.name,
        found: true,
        required: expected.required,
        aliasMatched: matchedHeader,
      });

      // Try extracting currency from Amount spent header e.g. "Amount spent (THB)" or "Amount spent (USD)"
      if (expected.name === 'Amount spent') {
        const currMatch = matchedHeader.match(/\(([A-Za-z]{3})\)/i);
        if (currMatch) {
          currencyDetected = currMatch[1].toUpperCase();
        }
      }
    } else {
      columnStatuses.push({
        name: expected.name,
        found: false,
        required: expected.required,
      });
    }
  }

  // Check required columns: Campaign name, Ad set name, Ad name, Amount spent
  const missingRequired = columnStatuses.filter((c) => c.required && !c.found);
  if (missingRequired.length > 0) {
    throw new Error(
      `Missing required Meta Ads columns: ${missingRequired.map((c) => `"${c.name}"`).join(', ')}. Please export from the Ads tab in Meta Ads Manager.`
    );
  }

  const getVal = (row: Record<string, any>, colName: string) => {
    const actualCol = headerMap[colName];
    return actualCol ? row[actualCol] : undefined;
  };

  const processedRows: ProcessedAdRow[] = [];
  let excludedZeroSpendRows = 0;

  rawData.forEach((row, idx) => {
    const amountSpent = parseMetaNumber(getVal(row, 'Amount spent'));
    if (amountSpent <= 0) {
      excludedZeroSpendRows++;
      return;
    }

    const campaignName = String(getVal(row, 'Campaign name') || '').trim();
    const adSetName = String(getVal(row, 'Ad set name') || '').trim();
    const adName = String(getVal(row, 'Ad name') || '').trim();

    if (!campaignName && !adSetName && !adName) {
      return; // empty row
    }

    const rawBudget = getVal(row, 'Ad set budget');
    const isUsingCampaignBudget = String(rawBudget || '').toLowerCase().includes('campaign');
    const adSetBudget = isUsingCampaignBudget ? null : parseMetaNumber(rawBudget) || null;
    const adSetBudgetType = String(getVal(row, 'Ad set budget type') || '').trim() || (isUsingCampaignBudget ? 'Campaign Budget' : null);

    const reach = parseMetaNumber(getVal(row, 'Reach'));
    const impressions = parseMetaNumber(getVal(row, 'Impressions'));
    const frequency = reach > 0 ? Number((impressions / reach).toFixed(2)) : parseMetaNumber(getVal(row, 'Frequency'));
    const cpm = impressions > 0 ? Number(((amountSpent / impressions) * 1000).toFixed(2)) : parseMetaNumber(getVal(row, 'CPM'));

    const results = parseMetaNumber(getVal(row, 'Results'));
    const resultIndicator = String(getVal(row, 'Result indicator') || '').trim();
    const costPerResult = results > 0 ? Number((amountSpent / results).toFixed(2)) : parseMetaNumber(getVal(row, 'Cost per results'));

    const linkClicks = parseMetaNumber(getVal(row, 'Link clicks'));
    const ctr = impressions > 0 ? Number(((linkClicks / impressions) * 100).toFixed(2)) : parseMetaNumber(getVal(row, 'CTR (link click-through rate)'));
    const cpc = linkClicks > 0 ? Number((amountSpent / linkClicks).toFixed(2)) : parseMetaNumber(getVal(row, 'CPC (cost per link click)'));

    const landingPageViews = parseMetaNumber(getVal(row, 'Landing page views'));
    const costPerLpv = landingPageViews > 0 ? Number((amountSpent / landingPageViews).toFixed(2)) : parseMetaNumber(getVal(row, 'Cost per landing page view'));
    const lpvRate = linkClicks > 0 ? Number(((landingPageViews / linkClicks) * 100).toFixed(1)) : 0;

    const objective = String(getVal(row, 'Objective') || '').trim();
    const detectedGoal = detectGoal(resultIndicator, objective);

    processedRows.push({
      id: `ad_${idx}_${Date.now()}`,
      campaignName,
      adSetName,
      adName,
      adDelivery: String(getVal(row, 'Ad delivery') || '').trim(),
      objective,
      attributionSetting: String(getVal(row, 'Attribution setting') || '').trim(),
      starts: parseMetaDate(getVal(row, 'Starts')),
      ends: parseMetaDate(getVal(row, 'Ends')),
      amountSpent: Number(amountSpent.toFixed(2)),
      adSetBudget,
      adSetBudgetType,
      reach,
      impressions,
      frequency,
      cpm,
      results,
      resultIndicator,
      costPerResult,
      linkClicks,
      ctr,
      cpc,
      landingPageViews,
      costPerLpv,
      lpvRate,
      pageEngagement: parseMetaNumber(getVal(row, 'Page engagement')),
      facebookLikes: parseMetaNumber(getVal(row, 'Facebook likes')),
      videoPlays: parseMetaNumber(getVal(row, 'Video plays')),
      postEngagements: parseMetaNumber(getVal(row, 'Post engagements')),
      qualityRanking: String(getVal(row, 'Quality ranking') || '-').trim(),
      engagementRateRanking: String(getVal(row, 'Engagement rate ranking') || '-').trim(),
      conversionRateRanking: String(getVal(row, 'Conversion rate ranking') || '-').trim(),
      detectedGoal,
    });
  });

  return {
    rows: processedRows,
    columnStatuses,
    currencyDetected,
    totalRawRows: rawData.length,
    excludedZeroSpendRows,
  };
}
