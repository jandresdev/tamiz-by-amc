'use client';

import { useRef, useState, useCallback } from 'react';
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE } from '@/lib/constants';

interface UploadedFile {
  name: string;
  size: number;
  type: string;
  file: File;
}

interface UploadZoneProps {
  label?: string;
  subtitle?: string;
  onChange: (file: File | null) => void;
  currentFile?: UploadedFile | null;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadZone({ label, subtitle, onChange, currentFile }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const validate = useCallback((file: File): string | null => {
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return 'Tipo de archivo no permitido. Use PDF, Word, Excel o imágenes.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return `El archivo excede el límite de ${formatSize(MAX_FILE_SIZE)}.`;
    }
    return null;
  }, []);

  const handleFile = useCallback((file: File) => {
    const err = validate(file);
    if (err) {
      setFileError(err);
      onChange(null);
    } else {
      setFileError(null);
      onChange(file);
    }
  }, [validate, onChange]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const remove = useCallback(() => {
    setFileError(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = '';
  }, [onChange]);

  const hasFile = Boolean(currentFile);

  return (
    <div
      className={`upload-zone${dragOver ? ' drag-over' : ''}${hasFile ? ' has-file' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      onClick={!hasFile ? () => inputRef.current?.click() : undefined}
    >
      <span className="upload-icon" aria-hidden="true">📎</span>
      <p className="upload-label">{label ?? 'Adjuntar documento (opcional)'}</p>
      <p className="upload-sub">{subtitle ?? 'PDF, Word, Excel o imagen · Máx. 10 MB'}</p>

      <label className="upload-btn-label" onClick={(e) => e.stopPropagation()}>
        Seleccionar archivo
        <input
          ref={inputRef}
          type="file"
          className="file-input"
          accept={ALLOWED_FILE_TYPES.join(',')}
          onChange={onInputChange}
        />
      </label>

      {hasFile && currentFile && (
        <p className="file-meta">
          <span>📄</span>
          <span className="file-meta-name">{currentFile.name}</span>
          <span className="file-meta-size">{formatSize(currentFile.size)}</span>
          <button type="button" className="file-remove" onClick={remove} aria-label="Eliminar archivo">
            ✕
          </button>
        </p>
      )}

      {fileError && <p className="file-error">{fileError}</p>}
    </div>
  );
}
