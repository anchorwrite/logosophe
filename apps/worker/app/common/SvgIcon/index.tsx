import { SvgIconProps } from '../types';

export const SvgIcon = ({ src, width, height, style }: SvgIconProps) => (
  <img src={src.startsWith('/') ? src : `/${src}`} alt={src} width={width} height={height} style={style} />
);
