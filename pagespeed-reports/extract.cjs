const fs = require('fs');
const path = require('path');

const targetUrl = 'https://buyaspot.in';
const outputDir = __dirname;
const categories = ['performance', 'accessibility', 'best-practices', 'seo'];

async function fetchWithRetry(url, retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Fetching: ${url} (Attempt ${i + 1})`);
      const response = await fetch(url);
      if (response.status === 429) {
          throw new Error(`Rate limit exceeded (429)`);
      }
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (e) {
      console.error(`Attempt ${i + 1} failed: ${e.message}`);
      if (i === retries - 1) throw e;
      const waitTime = 10000 * (i + 1);
      console.log(`Waiting ${waitTime}ms before retry...`);
      await new Promise(r => setTimeout(r, waitTime));
    }
  }
}

function formatBytes(bytes, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function formatTime(ms) {
  if (ms === undefined || ms === null) return '0 ms';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

async function getPageSpeed(strategy) {
  let url = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(targetUrl)}&strategy=${strategy}`;
  for (const cat of categories) {
    url += `&category=${cat}`;
  }
  url += `&key=AIzaSyBUJ7VcFVmzoipWMC8JOzFckdY33TnL39M`;
  return await fetchWithRetry(url);
}

function extractCoreWebVitals(data) {
  const audits = data.lighthouseResult?.audits || {};
  const metrics = ['largest-contentful-paint', 'cumulative-layout-shift', 'interactive', 'total-blocking-time', 'speed-index', 'first-contentful-paint', 'server-response-time'];
  const res = {};
  for (const m of metrics) {
    if (audits[m]) {
      res[m] = {
        title: audits[m].title,
        score: audits[m].score,
        displayValue: audits[m].displayValue,
        numericValue: audits[m].numericValue,
        formattedValue: audits[m].numericUnit === 'millisecond' ? formatTime(audits[m].numericValue) : audits[m].displayValue
      };
    }
  }
  return res;
}

function extractOpportunities(data) {
  const audits = data.lighthouseResult?.audits || {};
  const res = [];
  for (const key in audits) {
    const audit = audits[key];
    if (audit.details?.type === 'opportunity') {
      res.push({
        id: audit.id,
        title: audit.title,
        description: audit.description,
        savingsMs: formatTime(audit.details.overallSavingsMs || 0),
        savingsBytes: formatBytes(audit.details.overallSavingsBytes || 0),
        score: audit.score,
        items: audit.details.items || []
      });
    }
  }
  // Sort by savingsMs descending (approximate by numeric overallSavingsMs)
  res.sort((a, b) => {
      const aMs = audits[a.id]?.details?.overallSavingsMs || 0;
      const bMs = audits[b.id]?.details?.overallSavingsMs || 0;
      return bMs - aMs;
  });
  return res;
}

function extractDiagnostics(data) {
  const audits = data.lighthouseResult?.audits || {};
  const res = {};
  
  const requested = [
    'diagnostics',
    'mainthread-work-breakdown',
    'unused-javascript',
    'unused-css-rules',
    'render-blocking-resources',
    'bootup-time',
    'resource-summary',
    'third-party-summary',
    'network-server-latency',
    'legacy-javascript',
    'dom-size',
    'critical-request-chains'
  ];

  for (const r of requested) {
    if (audits[r]) {
      res[r] = audits[r];
    }
  }
  
  for (const key in audits) {
    const audit = audits[key];
    if (audit.score !== null && audit.score < 1 && audit.details?.type !== 'opportunity' && !res[key]) {
      res[key] = {
        id: audit.id,
        title: audit.title,
        score: audit.score,
        displayValue: audit.displayValue,
        details: audit.details
      };
    }
  }
  return res;
}

function extractNetworkRequests(data) {
  const audits = data.lighthouseResult?.audits || {};
  const network = audits['network-requests'];
  if (network?.details?.items) {
    return network.details.items.map(item => ({
      url: item.url,
      resourceType: item.resourceType,
      transferSize: formatBytes(item.transferSize || 0),
      resourceSize: formatBytes(item.resourceSize || 0),
      statusCode: item.statusCode,
      mimeType: item.mimeType,
      endTime: formatTime(item.endTime || 0),
      networkRequestTime: formatTime(item.networkRequestTime || 0)
    }));
  }
  return [];
}

function extractAuditsSummary(data) {
  const audits = data.lighthouseResult?.audits || {};
  const summary = {};
  for (const key in audits) {
    const audit = audits[key];
    summary[key] = {
      title: audit.title,
      score: audit.score,
      displayValue: audit.displayValue,
      numericValue: audit.numericValue,
      numericUnit: audit.numericUnit
    };
  }
  return summary;
}

function generateReport(mobile, desktop) {
  function getScores(data) {
    const cats = data.lighthouseResult?.categories || {};
    return {
      Performance: cats.performance?.score ? cats.performance.score * 100 : 'N/A',
      Accessibility: cats.accessibility?.score ? cats.accessibility.score * 100 : 'N/A',
      'Best Practices': cats['best-practices']?.score ? cats['best-practices'].score * 100 : 'N/A',
      SEO: cats.seo?.score ? cats.seo.score * 100 : 'N/A',
      PWA: cats.pwa?.score ? cats.pwa.score * 100 : 'N/A'
    };
  }

  const report = {
    url: targetUrl,
    timestamp: new Date().toISOString(),
    mobile: {
      scores: getScores(mobile),
      coreWebVitals: extractCoreWebVitals(mobile)
    },
    desktop: {
      scores: getScores(desktop),
      coreWebVitals: extractCoreWebVitals(desktop)
    }
  };

  fs.writeFileSync(path.join(outputDir, 'final-report.json'), JSON.stringify(report, null, 2));

  let md = `# PageSpeed Insights Report for ${targetUrl}\n\n`;
  
  md += `## Scores\n\n`;
  md += `| Category | Mobile | Desktop |\n`;
  md += `|---|---|---|\n`;
  for (const cat of ['Performance', 'Accessibility', 'Best Practices', 'SEO', 'PWA']) {
    md += `| ${cat} | ${report.mobile.scores[cat]} | ${report.desktop.scores[cat]} |\n`;
  }
  
  md += `\n## Core Web Vitals (Mobile)\n\n`;
  for (const [key, val] of Object.entries(report.mobile.coreWebVitals)) {
    md += `- **${val.title}**: ${val.formattedValue} (Score: ${val.score})\n`;
  }

  md += `\n## Core Web Vitals (Desktop)\n\n`;
  for (const [key, val] of Object.entries(report.desktop.coreWebVitals)) {
    md += `- **${val.title}**: ${val.formattedValue} (Score: ${val.score})\n`;
  }

  // Top optimization opportunities (Mobile)
  md += `\n## Top Optimization Opportunities (Mobile)\n\n`;
  const mobileOpp = extractOpportunities(mobile).slice(0, 5);
  if (mobileOpp.length === 0) md += `*No major opportunities found.*\n`;
  for (const opp of mobileOpp) {
      md += `- **${opp.title}**: Savings ${opp.savingsMs} / ${opp.savingsBytes}\n`;
  }

  // Render blocking resources & Largest assets, etc...
  md += `\n## Selected Diagnostics (Mobile)\n\n`;
  const mDiag = extractDiagnostics(mobile);
  
  const mJS = mDiag['mainthread-work-breakdown'];
  if (mJS) {
      md += `**JS Execution Cost**: ${mJS.displayValue}\n`;
  }
  
  const mRB = mDiag['render-blocking-resources'];
  if (mRB) {
      md += `**Render Blocking Resources**: ${mRB.displayValue}\n`;
  }
  
  const mThirdParty = mDiag['third-party-summary'];
  if (mThirdParty) {
      md += `**Third-Party Impact**: ${mThirdParty.displayValue}\n`;
  }
  
  const mServerLat = mDiag['network-server-latency'];
  if (mServerLat) {
      md += `**Server Latency**: ${mServerLat.displayValue}\n`;
  }

  fs.writeFileSync(path.join(outputDir, 'final-report.md'), md);
}

async function main() {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    console.log('Starting data extraction...');
    
    let mobileData;
    if (fs.existsSync(path.join(outputDir, 'mobile-full.json'))) {
      console.log('Found mobile-full.json locally, skipping fetch.');
      mobileData = JSON.parse(fs.readFileSync(path.join(outputDir, 'mobile-full.json')));
    } else {
      mobileData = await getPageSpeed('mobile');
      fs.writeFileSync(path.join(outputDir, 'mobile-full.json'), JSON.stringify(mobileData, null, 2));
    }

    let desktopData;
    if (fs.existsSync(path.join(outputDir, 'desktop-full.json'))) {
      console.log('Found desktop-full.json locally, skipping fetch.');
      desktopData = JSON.parse(fs.readFileSync(path.join(outputDir, 'desktop-full.json')));
    } else {
      desktopData = await getPageSpeed('desktop');
      fs.writeFileSync(path.join(outputDir, 'desktop-full.json'), JSON.stringify(desktopData, null, 2));
    }

    const outputs = {
      'audits-summary.json': extractAuditsSummary,
      'opportunities.json': extractOpportunities,
      'diagnostics.json': extractDiagnostics,
      'core-web-vitals.json': extractCoreWebVitals,
      'network-requests.json': extractNetworkRequests
    };

    for (const [file, extractor] of Object.entries(outputs)) {
      const combined = {
        mobile: extractor(mobileData),
        desktop: extractor(desktopData)
      };
      fs.writeFileSync(path.join(outputDir, file), JSON.stringify(combined, null, 2));
    }

    generateReport(mobileData, desktopData);
    
    console.log('Successfully completed data extraction.');
    console.log('Output Directory:', outputDir);
    
    const files = fs.readdirSync(outputDir);
    console.log('Generated Files:');
    files.forEach(f => console.log(' - ' + f));
    
  } catch (err) {
    console.error('Error in extraction:', err);
  }
}

main();
