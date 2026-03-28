import React, { forwardRef, useId } from 'react';
import './ui.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ label, error, icon, className = '', id, ...props }, ref) => {
        const generatedId = useId();
        const inputId = id || generatedId;

        return (
            <div className={`input-wrapper ${className}`}>
                {label && <label htmlFor={inputId} className="input-label">{label}</label>}
                <div className="input-container">
                    {icon && <span className="input-icon">{icon}</span>}
                    <input
                        id={inputId}
                        ref={ref}
                        className={`input-field ${error ? 'input-error' : ''} ${icon ? 'has-icon' : ''}`}
                        {...props}
                    />
                </div>
                {error && <span className="input-error-text">{error}</span>}
            </div>
        );
    }
);

Input.displayName = 'Input';
