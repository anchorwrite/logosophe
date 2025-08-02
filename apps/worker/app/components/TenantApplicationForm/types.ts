import { TFunction } from "i18next";

export interface TenantApplicationProps {
  title: string;
  content: string;
  id: string;
  t: TFunction;
}

export interface ValidationTypeProps {
  type: string;
} 