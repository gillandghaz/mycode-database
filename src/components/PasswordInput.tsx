"use client";

import { useState } from "react";
import { IconEye, IconEyeOff } from "./Icons";

interface Props {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  autoComplete?: string;
  required?: boolean;
  placeholder?: string;
}

export default function PasswordInput({ id, value, onChange, autoComplete = "current-password", required = false, placeholder }: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-field">
      <input id={id} type={visible ? "text" : "password"} autoComplete={autoComplete} value={value} onChange={onChange} required={required} placeholder={placeholder} />
      <button type="button" className="password-field__toggle" onClick={() => setVisible((v) => !v)} aria-label={visible ? "Hide password" : "Show password"} tabIndex={-1}>
        {visible ? <IconEyeOff size={17} /> : <IconEye size={17} />}
      </button>
    </div>
  );
}
