import { taskApi, type ListParams } from '@/lib/tasks';
import type { ExportFormat } from '@/components/wc';

// Export every task matching the current tab, search and date range
// (spec §7.2). Excel and CSV are built on the server; PDF is drawn here from
// the same rows, since the server has no PDF library.

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function exportTasks(format: ExportFormat, params: Omit<ListParams, 'page'>) {
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === 'pdf') {
    const [{ default: jsPDF }, { autoTable }, data] = await Promise.all([import('jspdf'), import('jspdf-autotable'), taskApi.exportRows(params)]);
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16);
    doc.text('Tasks', 14, 16);
    doc.setFontSize(10);
    doc.text(`${data.rows.length} tasks · exported ${new Date().toLocaleString()}`, 14, 22);
    autoTable(doc, {
      head: [data.header],
      body: data.rows,
      startY: 28,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [18, 18, 18], textColor: [255, 255, 255] },
    });
    doc.save(`${data.filename}.pdf`);
    return;
  }
  const res = await taskApi.exportFile(format, params);
  save(res.data, `tasks-${stamp}.${format}`);
}
