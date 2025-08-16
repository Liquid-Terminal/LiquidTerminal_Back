export interface ProjectCsvRow {
  title?: string;
  desc?: string;
  logo?: string;
  banner?: string;
  Banner?: string;
  twitter?: string;
  discord?: string;
  telegram?: string;
  website?: string;
  Token?: string;
  token?: string;
  category?: string;
  Category?: string;
}

export interface CsvProjectProcessingResult {
  totalRows: number;
  successfulImports: number;
  failedImports: number;
  errors: Array<{
    row: number;
    error: string;
    data: ProjectCsvRow;
  }>;
  createdCategories: string[];
}
