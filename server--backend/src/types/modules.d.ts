// Type declarations for modules without types

declare module 'csv-parser' {
  import { Transform } from 'stream';
  interface CsvParserOptions {
    separator?: string;
    newline?: string;
    quote?: string;
    escape?: string;
    headers?: string[] | boolean;
    skipLines?: number;
    maxRowBytes?: number;
    strict?: boolean;
  }
  function csvParser(options?: CsvParserOptions): Transform;
  export = csvParser;
}

declare module 'xlsx' {
  interface WorkSheet {
    [cell: string]: any;
  }
  interface WorkBook {
    SheetNames: string[];
    Sheets: { [name: string]: WorkSheet };
  }
  interface ParsingOptions {
    type?: 'base64' | 'binary' | 'buffer' | 'file' | 'array' | 'string';
    raw?: boolean;
    cellFormula?: boolean;
    cellHTML?: boolean;
    cellText?: boolean;
    cellDates?: boolean;
    cellStyles?: boolean;
    sheetStubs?: boolean;
    sheetRows?: number;
  }
  interface Sheet2JSONOpts {
    raw?: boolean;
    dateNF?: string;
    header?: 'A' | number | string[];
    range?: any;
    blankrows?: boolean;
    defval?: any;
    skipHidden?: boolean;
  }
  function readFile(filename: string, opts?: ParsingOptions): WorkBook;
  function read(data: any, opts?: ParsingOptions): WorkBook;
  function write(workbook: WorkBook, opts?: any): any;
  function writeFile(workbook: WorkBook, filename: string, opts?: any): void;
  const utils: {
    book_new(): WorkBook;
    book_append_sheet(workbook: WorkBook, worksheet: WorkSheet, name?: string): void;
    sheet_to_json<T = any>(worksheet: WorkSheet, opts?: Sheet2JSONOpts): T[];
    json_to_sheet(data: any[], opts?: any): WorkSheet;
    aoa_to_sheet(data: any[][], opts?: any): WorkSheet;
    sheet_to_csv(worksheet: WorkSheet, opts?: any): string;
    decode_range(range: string): any;
    encode_range(range: any): string;
  };
}
