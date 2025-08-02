import { TFunction } from "i18next";
import { CSSProperties } from "react";

export interface ContainerProps {
  border?: boolean;
  children: React.ReactNode;
}

export interface ButtonProps {
  color?: string;
  name?: string;
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
}

export interface SvgIconProps {
  src: string;
  width: string;
  height: string;
  style?: CSSProperties;
}

export interface InputProps {
  name: string;
  placeholder: string;
  t: TFunction;
  type?: string;
  value?: string;
  onChange: (
    event:
      | React.ChangeEvent<HTMLInputElement>
      | React.ChangeEvent<HTMLTextAreaElement>
  ) => void;
}

export interface validateProps {
  name: string;
  email: string;
  subject: string;
  message: string;
}
