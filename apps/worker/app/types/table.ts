export interface Field {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'checkbox' | 'date' | 'datetime';
  required: boolean;
  readOnly?: boolean;
  options?: { value: string; label: string }[];
}

export interface TableConfig {
  name: string;
  endpoint: string;
  fields: Field[];
  compositeKey?: boolean;
  tenantId?: string;
}

export interface TableRow {
  [key: string]: any;
}