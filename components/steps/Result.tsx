'use client';

import { useState, useEffect } from 'react';
import type { RegulatoryScheme, TamizAnswers } from '@/lib/types';
import { SCHEMES } from '@/lib/constants';
import { getResultTone, compareIntuition, ANSWER_LABELS, QUESTION_LABELS } from '@/lib/logic';
import { useToast, ToastContainer } from '@/components/ui/Toast';

interface ResultProps {
  sessionId: string | null;
  companyName: string;
  contactEmail: string;
  diagnosedScheme: RegulatoryScheme | null;
  answers: TamizAnswers;
  files?: Record<string, { name: string }>;
  normativaUserText?: string;
  onSendReport: (normativaText?: string) => Promise<void>;
  onNewDiagnosis: () => void;
}

export default function Result({
  sessionId,
  companyName,
  contactEmail,
  diagnosedScheme,
  answers,
  files = {},
  normativaUserText,
  onSendReport,
  onNewDiagnosis,
}: ResultProps) {
  const [sending, setSending]       = useState(false);
  const [sent, setSent]             = useState(false);
  const [normativa, setNormativa]   = useState(normativaUserText ?? '');
  const { toasts, dismiss, loading: showLoading, success, error } = useToast();

  const tone       = getResultTone(diagnosedScheme);
  const schemeName = diagnosedScheme ? SCHEMES[diagnosedScheme]?.label ?? diagnosedScheme : null;
  const comparison = compareIntuition(answers.q0, diagnosedScheme);

  const label = companyName || 'X';

  // Auto-send once sessionId is available (retry every 500ms if not yet ready)
  useEffect(() => {
    if (sent || sending) return;
    if (!sessionId) {
      // SessionId still loading — will re-run when parent re-renders with sessionId
      return;
    }
    const doSend = async () => {
      setSending(true);
      const lid = showLoading('Enviando diagnóstico a ops@amcprincipal.com...');
      try {
        await onSendReport(normativa || undefined);
        dismiss(lid);
        success('✓ Diagnóstico enviado a ops@amcprincipal.com');
        setSent(true);
      } catch (err: any) {
        dismiss(lid);
        error(err?.message ?? 'Error al enviar. Verifique su conexión e intente de nuevo.');
      } finally {
        setSending(false);
      }
    };
    doSend();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Summary rows
  const summaryRows: { label: string; value: string }[] = [];
  if (companyName) summaryRows.push({ label: 'Empresa evaluada', value: companyName });
  if (contactEmail) summaryRows.push({ label: 'Correo de contacto', value: contactEmail });

  const answerKeys = ['q1', 'qA1', 'qA2', 'qA3', 'qB1', 'qB2'] as const;
  answerKeys.forEach((k) => {
    const v = answers[k as keyof TamizAnswers] as string | undefined;
    if (!v) return;
    const lbl = ANSWER_LABELS[k]?.[v] ?? v;
    summaryRows.push({ label: QUESTION_LABELS[k] ?? k, value: lbl });
  });
  if (answers.qA3consumers) {
    summaryRows.push({ label: 'Otros consumidores', value: answers.qA3consumers });
  }
  Object.entries(files).forEach(([k, f]) => {
    summaryRows.push({ label: `Documento ${k.replace('q', '').toUpperCase()}`, value: `📎 ${f.name}` });
  });

  return (
    <>
      {/* Result card */}
      <div className={`result-card ${tone}`}>
        <p className="result-label">
          {tone === 'match' ? 'Esquema identificado' : tone === 'no-match' ? 'Calificación' : 'Análisis detenido'}
        </p>
        <p className="result-name">
          {diagnosedScheme === 'SINSOP'
            ? 'Operación sin soporte regulatorio'
            : schemeName ?? `Análisis pausado: ${label} es el único consumidor`}
        </p>
        {diagnosedScheme === 'SINSOP' && (
          <p className="result-desc">
            La combinación de respuestas excluye los esquemas de Autogeneración Remota, Producción Marginal Remota y
            Suministro de Energía. Se recomienda revisar la estructura de la operación con el equipo de AMC Principal
            antes de avanzar.
          </p>
        )}
        {!diagnosedScheme && (
          <p className="result-desc">
            Conforme a las reglas del clasificador, cuando {label} es el único consumidor de la energía comprada el
            análisis se detiene en este punto. Se recomienda revisar la operación caso a caso con el equipo de AMC
            Principal antes de calificar el esquema.
          </p>
        )}

        {/* Normativa block (only for positive matches) */}
        {tone === 'match' && (
          <div className="normative-block">
            <p className="normative-label">Base normativa (opcional)</p>
            <textarea
              className="normative-textarea"
              placeholder="Si desea, ingrese la normativa o documentación que sustenta su operación..."
              value={normativa}
              onChange={(e) => setNormativa(e.target.value)}
              rows={4}
            />
            <p className="normative-helper">Este campo es opcional e informativo. El diagnóstico ya fue enviado automáticamente a ops@amcprincipal.com.</p>
          </div>
        )}
      </div>

      {/* Comparison block */}
      {answers.q0 && (
        <div className="comparison-block">
          <p className="normative-label">Su intuición vs. el diagnóstico</p>
          <div className="comparison-grid">
            <div className="comparison-cell">
              <p className="label">Esquema que usted indicó</p>
              <p className="value">
                {answers.q0 === 'NOSE'
                  ? 'No estaba seguro'
                  : SCHEMES[answers.q0 as RegulatoryScheme]?.label ?? answers.q0}
              </p>
            </div>
            <div className={`comparison-cell ${tone === 'match' ? 'match' : tone === 'no-match' ? 'no-match' : 'stop'}`}>
              <p className="label">Esquema diagnosticado</p>
              <p className="value">
                {diagnosedScheme === 'SINSOP'
                  ? 'Sin soporte regulatorio'
                  : schemeName ?? 'Análisis pausado'}
              </p>
            </div>
          </div>
          <div className={`comparison-banner ${comparison.bannerClass}`}>{comparison.message}</div>
        </div>
      )}

      {/* Summary block */}
      <div className="summary-block">
        <p className="normative-label">Resumen del diagnóstico</p>
        {summaryRows.map((row, i) => (
          <div className="summary-row" key={i}>
            <span className="summary-label">{row.label}</span>
            <span className="summary-value">{row.value}</span>
          </div>
        ))}
      </div>

      {/* Send status indicator */}
      <div className="send-status-row">
        {sending && (
          <span className="send-status sending">
            <span className="spinner" aria-hidden="true" />
            Enviando diagnóstico a ops@amcprincipal.com...
          </span>
        )}
        {sent && !sending && (
          <span className="send-status ok">✓ Diagnóstico enviado a ops@amcprincipal.com</span>
        )}
        {!sending && !sent && (
          <span className="send-status pending">Preparando envío...</span>
        )}
      </div>

      {/* Action buttons */}
      <div className="actions-row">
        <button
          type="button"
          className="action-btn secondary"
          onClick={() => window.print()}
        >
          Imprimir / Guardar PDF
        </button>

        <button
          type="button"
          className="action-btn secondary"
          onClick={onNewDiagnosis}
        >
          Nuevo diagnóstico
        </button>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </>
  );
}
