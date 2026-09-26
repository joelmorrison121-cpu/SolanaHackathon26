import type { CSSProperties } from "react";

export type TechTextProps = {
  text?: string;
  fontFamily?: string;
  fontWeight?: number;
  fontSize?: number;
  letterSpacing?: number;
  color?: string;
  accentColor?: string;
  reveal?: "area" | "letter" | "off";
  reach?: number;
  softness?: number;
  dashLength?: number;
  dashGap?: number;
  lineStyle?: "dashed" | "solid";
  strokeWidth?: number;
  specks?: number;
  selection?: boolean;
  labels?: boolean;
  draggable?: boolean;
  sweep?: boolean;
  speed?: number;
  className?: string;
  style?: CSSProperties;
};

declare function TechText(props: TechTextProps): JSX.Element;
export default TechText;
