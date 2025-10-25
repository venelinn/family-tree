import React from 'react';
import clsx from 'clsx';
import * as Icons from 'lucide-react';
import styles from './Icon.module.scss';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: keyof typeof Icons;
  className?: string;
  title?: string;
  hidden?: boolean;
  strokeWidth?: string;
  size?: string | number;
  color?: string;
}

export const Icon = ({
  name,
  className,
  title,
  hidden,
  strokeWidth = '0.75',
  size = '1em',
  color = 'currentColor',
  ...props
}: IconProps) => {
  // Dynamically pick the icon from lucide-react
  // const LucideIcon = Icons[name] as React.ComponentType<React.SVGProps<SVGSVGElement>>;
  const LucideIcon = Icons[name] as React.ComponentType<
    React.SVGProps<SVGSVGElement>
  >;

  // If the icon doesn't exist in lucide-react, render nothing
  if (!LucideIcon) {
    console.warn(`Icon "${name}" not found in lucide-react`);
    return null;
  }

  return (
    <LucideIcon
      className={clsx(styles.icon, className)}
      aria-label={title || name}
      aria-hidden={hidden || undefined}
      width={size} // Apply size to width
      height={size} // Apply size to height
      color={color}
      strokeWidth={strokeWidth}
      {...props} // Pass any additional props
    />
  );
};

export default Icon;
