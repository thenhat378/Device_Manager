export function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
    return dateStr;
  }
  try {
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${day}/${month}/${year}`;
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (e) {
    return dateStr;
  }
}

export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

export function exportToWord(elementId: string, filename: string) {
  const element = document.getElementById(elementId);
  if (!element) return;

  // Clone the element so we don't modify the visible DOM
  const clonedElement = element.cloneNode(true) as HTMLElement;

  // Remove items marked as print:hidden or hidden controls
  const hiddenElements = clonedElement.querySelectorAll('.print\\:hidden, button, select, input, textarea');
  hiddenElements.forEach(el => el.remove());

  // Convert SVG icons to simple placeholders or style them cleanly
  const svgs = clonedElement.querySelectorAll('svg');
  svgs.forEach(svg => {
    // If it's a DUELogo SVG, let's keep it or replace it with a text indicator
    if (svg.classList.contains('due-logo-svg') || svg.querySelector('text')) {
      // Keep it since it has text
    } else {
      svg.remove(); // Remove small icons to prevent cluttering Word
    }
  });

  const htmlContent = clonedElement.innerHTML;

  const documentHtml = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' 
          xmlns:w='urn:schemas-microsoft-com:office:word' 
          xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>${filename}</title>
      <!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
          <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
      </xml>
      <![endif]-->
      <style>
        /* Vietnam Standard Administrative Margins: Top 2.0cm, Bottom 2.0cm, Left 3.0cm, Right 1.5cm */
        @page Section1 {
          size: 21.0cm 29.7cm; /* A4 size */
          margin: 2.0cm 1.5cm 2.0cm 3.0cm; /* Top, Right, Bottom, Left */
          mso-header-margin: 1.0cm;
          mso-footer-margin: 1.0cm;
          mso-paper-source: 0;
        }
        div.Section1 {
          page: Section1;
        }
        
        body {
          font-family: "Times New Roman", Times, serif;
          font-size: 13pt; /* Standard font size 13-14pt */
          line-height: 1.4;
          color: #000000;
          background-color: #ffffff;
        }
        
        /* Typography standards */
        h1, h2, h3, h4, p, table, div {
          margin: 0;
          padding: 0;
        }
        
        h2 {
          font-size: 14pt;
          font-weight: bold;
          text-align: center;
          margin-bottom: 8pt;
          text-transform: uppercase;
        }
        
        h3 {
          font-size: 12pt;
          font-weight: bold;
          margin-top: 14pt;
          margin-bottom: 6pt;
          text-transform: uppercase;
        }
        
        p {
          font-size: 13pt;
          margin-bottom: 6pt;
          text-align: justify;
        }
        
        .text-center { text-align: center; }
        .text-left { text-align: left; }
        .text-right { text-align: right; }
        .font-bold { font-weight: bold; }
        .italic { font-style: italic; }
        .uppercase { text-transform: uppercase; }
        .underline { text-decoration: underline; }
        
        /* Layout Structure */
        .header-table {
          width: 100%;
          border: none;
          margin-bottom: 24pt;
        }
        .header-table td {
          border: none;
          padding: 0;
          vertical-align: top;
          text-align: center;
        }
        
        /* Table styles */
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 12pt;
          margin-bottom: 12pt;
        }
        th, td {
          border: 1px solid #000000;
          padding: 6pt 8pt;
          font-size: 11pt;
          vertical-align: middle;
        }
        th {
          background-color: #f3f4f6;
          font-weight: bold;
          text-align: center;
          text-transform: uppercase;
        }
        
        /* Signature Area */
        .signature-table {
          width: 100%;
          border: none;
          margin-top: 30pt;
        }
        .signature-table td {
          border: none;
          padding: 0;
          text-align: center;
          vertical-align: top;
          width: 33%;
        }
        
        /* Clean margins and gaps */
        .space-y-1 > * { margin-bottom: 2px; }
        .space-y-2 > * { margin-bottom: 6px; }
        .mt-4 { margin-top: 12pt; }
        .pt-4 { padding-top: 12pt; }
        .pt-10 { padding-top: 30pt; }
        .pb-16 { padding-bottom: 48pt; }
        .h-16 { height: 48pt; }
        .h-20 { height: 60pt; }
        
        /* Grid helper to align side-by-side elements in Word */
        .flex-container {
          display: table;
          width: 100%;
        }
        .flex-cell {
          display: table-cell;
          width: 50%;
          padding: 6pt;
        }
      </style>
    </head>
    <body>
      <div class="Section1">
        ${htmlContent}
      </div>
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff' + documentHtml], {
    type: 'application/msword;charset=utf-8'
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.doc') ? filename : `${filename}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function getAvatarUrl(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  let initials = '';
  if (parts.length > 0) {
    if (parts.length === 1) {
      initials = parts[0].substring(0, 2).toUpperCase();
    } else {
      initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
  } else {
    initials = 'U';
  }
  
  // Hash name to get a consistent, sophisticated solid background color
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Professional palette (cool, warm, deep, sophisticated)
  const colors = [
    '#3b82f6', // Indigo blue
    '#10b981', // Emerald green
    '#6366f1', // Violet
    '#ec4899', // Pink
    '#f59e0b', // Amber
    '#0d9488', // Teal
    '#06b6d4', // Cyan
    '#f43f5e', // Rose
    '#8b5cf6', // Purple
    '#475569'  // Slate
  ];
  
  const color = colors[Math.abs(hash) % colors.length];
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
    <circle cx="50" cy="50" r="50" fill="${color}"/>
    <text x="50" y="55" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-weight="bold" font-size="34" fill="#ffffff" dominant-baseline="middle" text-anchor="middle">${initials}</text>
  </svg>`;
  
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

