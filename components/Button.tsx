import React from 'react';
import { soundService } from '../services/soundService';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false, 
  className = '', 
  onClick,
  ...props 
}) => {
  const baseStyles = "py-3 px-6 rounded-xl font-bold transition-all duration-200 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg";
  
  const variants = {
    primary: "bg-brand-primary hover:bg-indigo-500 text-white shadow-indigo-500/30",
    secondary: "bg-brand-secondary hover:bg-purple-500 text-white shadow-purple-500/30",
    danger: "bg-brand-accent hover:bg-rose-600 text-white shadow-rose-500/30",
    ghost: "bg-brand-surface hover:bg-slate-700 text-slate-200 border border-slate-700"
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    soundService.play('click');
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  );
};