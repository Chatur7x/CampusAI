/**
 * Utility for exporting data to various formats (CSV, JSON)
 */

export const exportToCSV = (data: any[], fileName: string) => {
  if (!data || data.length === 0) return;

  // Flatten nested objects if necessary (simple version)
  const flattenObject = (obj: any, prefix = ''): any => {
    return Object.keys(obj).reduce((acc: any, k) => {
      const pre = prefix.length ? prefix + '_' : '';
      if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
        Object.assign(acc, flattenObject(obj[k], pre + k));
      } else {
        acc[pre + k] = obj[k];
      }
      return acc;
    }, {});
  };

  const processedData = data.map(item => flattenObject(item));
  const headers = Object.keys(processedData[0]);
  
  const csvRows = [];
  // Add headers
  csvRows.push(headers.join(','));

  // Add data rows
  for (const row of processedData) {
    const values = headers.map(header => {
      const val = row[header];
      const escaped = ('' + val).replace(/"/g, '\\"');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }

  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${fileName}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

export const exportToJSON = (data: any[], fileName: string) => {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${fileName}_${new Date().toISOString().split('T')[0]}.json`);
  link.click();
};
