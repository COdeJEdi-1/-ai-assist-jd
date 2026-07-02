import * as XLSX from 'xlsx';

export const CANDIDATE_TEMPLATE_HEADERS = ['Name', 'Phone Number', 'Email'] as const;

export const CANDIDATE_TEMPLATE_FILENAME = 'Arvind_GCC_Candidate_Template.xlsx';

export function downloadCandidateTemplate() {
  const worksheet = XLSX.utils.aoa_to_sheet([[...CANDIDATE_TEMPLATE_HEADERS]]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Candidates');
  XLSX.writeFile(workbook, CANDIDATE_TEMPLATE_FILENAME);
}
