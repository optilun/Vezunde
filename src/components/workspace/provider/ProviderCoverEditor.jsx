import React, { useState } from 'react';
import { Check, Loader2, Palette, RotateCcw, Save } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { coverThemeBackground, isCoverColor, normalizeCoverTheme } from '@/lib/providerCoverTheme';

const SOLIDS = [
  ['Fildeș', '#f2eee6'], ['Salvie', '#dfe5d6'], ['Albastru', '#dce4f2'], ['Lavandă', '#e6dff0'],
  ['Nisip', '#e8d8b8'], ['Teracotă', '#dfbba6'], ['Petrol', '#20585e'], ['Grafit', '#30363d'],
];
const GRADIENTS = [
  ['Cer', '#dce4f2', '#f7f2e8'], ['Natură', '#dce5d4', '#f4efdc'], ['Aurora', '#e4ddf2', '#f3dbd3'],
  ['Ocean', '#173c64', '#2b9095'], ['Apus', '#b46d55', '#ecd5a7'], ['Noapte', '#30363d', '#5c668b'],
];
const buttonCls = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#345bc8] focus-visible:ring-offset-2 disabled:opacity-50';

function BrandColor({ label, value, onChange, disabled }) {
  return (
    <label className="block min-w-0 text-xs font-semibold text-[#514e48]">
      {label}
      <span className="mt-2 flex min-h-11 items-center gap-2 rounded-xl border border-[#d9d4ca] bg-white px-2">
        <input type="color" aria-label={`${label}: paletă`} value={isCoverColor(value) ? value : '#345bc8'} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="h-8 w-8 shrink-0 cursor-pointer rounded-md border-0 bg-transparent p-0" />
        <input type="text" aria-label={`${label}: cod HEX`} value={value} disabled={disabled} maxLength={7} spellCheck={false} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 bg-transparent py-2 font-mono text-sm uppercase text-[#171717] outline-none focus-visible:ring-2 focus-visible:ring-[#345bc8]" />
      </span>
    </label>
  );
}

export default function ProviderCoverEditor({ theme, organizationName, onPreview, onSave, onClose }) {
  const initial = normalizeCoverTheme(theme);
  const [mode, setMode] = useState(initial.mode === 'gradient' ? 'gradient' : 'solid');
  const [draft, setDraft] = useState(initial);
  const [color, setColor] = useState(initial.color || '#345bc8');
  const [colorEnd, setColorEnd] = useState(initial.colorEnd || '#72c1b7');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [custom, setCustom] = useState(false);
  const validCustom = isCoverColor(color) && (mode !== 'gradient' || isCoverColor(colorEnd));

  const choose = (next) => {
    setDraft(next);
    setCustom(false);
    setError('');
    if (next.color) setColor(next.color);
    if (next.colorEnd) setColorEnd(next.colorEnd);
    onPreview(next);
  };
  const editCustom = (nextColor, nextEnd, nextMode = mode) => {
    setColor(nextColor);
    setColorEnd(nextEnd);
    setCustom(true);
    setError('');
    if (isCoverColor(nextColor) && (nextMode !== 'gradient' || isCoverColor(nextEnd))) {
      const next = nextMode === 'solid' ? { mode: 'solid', color: nextColor.toLowerCase() } : { mode: 'gradient', color: nextColor.toLowerCase(), colorEnd: nextEnd.toLowerCase() };
      setDraft(next);
      onPreview(next);
    }
  };
  const changeMode = (next) => {
    setMode(next);
    if (custom) editCustom(color, colorEnd, next);
  };
  const save = async () => {
    setSaving(true);
    setError('');
    try { await onSave(draft); }
    catch (failure) { setError(failure.message || 'Nu am putut salva coperta. Încearcă din nou.'); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent className="max-h-[calc(100dvh-24px)] w-[calc(100%-24px)] max-w-[460px] gap-0 overflow-y-auto rounded-[24px] border-[#dedad2] bg-[#fbfaf7] p-0 sm:rounded-[24px]" onEscapeKeyDown={(event) => { if (saving) event.preventDefault(); }} onInteractOutside={(event) => { if (saving) event.preventDefault(); }}>
        <div className="px-5 pb-4 pt-6 sm:px-6">
          <div className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#77736b]"><Palette className="h-4 w-4" /> Identitatea brandului</div>
          <DialogTitle className="pr-8 font-heading text-2xl font-bold tracking-[-0.03em] text-[#171717]">Personalizează coperta</DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-6 text-[#706c64]">Alege un fundal pentru profilul public al organizației.</DialogDescription>
          <div aria-label="Previzualizare copertă" className="relative mt-4 h-28 overflow-hidden rounded-[16px] border border-black/10" style={{ background: coverThemeBackground(draft) }}>
            <span className="absolute bottom-3 left-3 max-w-[calc(100%-24px)] truncate rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-[#30302b]">{organizationName}</span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-1 rounded-full border border-[#dedad2] bg-[#efede7] p-1" aria-label="Tipul fundalului">
            {[['solid', 'Culori solide'], ['gradient', 'Degradeuri']].map(([key, label]) => <button key={key} type="button" aria-pressed={mode === key} disabled={saving} onClick={() => changeMode(key)} className={`${buttonCls} min-h-10 ${mode === key ? 'bg-white text-[#171717] shadow-sm' : 'text-[#706c64]'}`}>{label}</button>)}
          </div>
          <div className="mt-4 grid grid-cols-4 gap-x-3 gap-y-4" aria-label="Fundaluri disponibile">
            {(mode === 'solid' ? SOLIDS : GRADIENTS).map(([name, start, end]) => {
              const option = mode === 'solid' ? { mode, color: start } : { mode, color: start, colorEnd: end };
              const selected = !custom && JSON.stringify(option) === JSON.stringify(draft);
              return <button key={name} type="button" aria-label={`Alege ${name}`} aria-pressed={selected} disabled={saving} onClick={() => choose(option)} className="group min-w-0 rounded-xl text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#345bc8] focus-visible:ring-offset-2 disabled:opacity-50"><span className={`flex h-12 items-center justify-center rounded-xl border border-black/10 ${selected ? 'ring-2 ring-[#171717] ring-offset-2 ring-offset-[#fbfaf7]' : 'group-hover:ring-2 group-hover:ring-black/20 group-hover:ring-offset-2'}`} style={{ background: coverThemeBackground(option) }}>{selected && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[#171717]"><Check className="h-4 w-4" /></span>}</span><span className="mt-2 block truncate text-[11px] font-medium text-[#706c64]">{name}</span></button>;
            })}
          </div>
          <div className="mt-5 border-t border-[#dedad2] pt-4">
            <div className="mb-3 text-sm font-semibold text-[#171717]">Culorile brandului tău</div>
            <div className={`grid gap-3 ${mode === 'gradient' ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <BrandColor label={mode === 'gradient' ? 'Prima culoare' : 'Culoare personalizată'} value={color} onChange={(value) => editCustom(value, colorEnd)} disabled={saving} />
              {mode === 'gradient' && <BrandColor label="A doua culoare" value={colorEnd} onChange={(value) => editCustom(color, value)} disabled={saving} />}
            </div>
            {custom && !validCustom && <p role="alert" className="mt-2 text-xs text-[#a33f31]">Folosește un cod HEX complet, de exemplu #345BC8.</p>}
            <button type="button" disabled={saving} onClick={() => choose({ mode: 'default' })} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg text-xs font-medium text-[#706c64] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#345bc8]"><RotateCcw className="h-3.5 w-3.5" /> Fundalul implicit VIASEE</button>
          </div>
          {error && <p role="alert" className="mt-3 text-sm text-[#a33f31]">{error}</p>}
        </div>
        <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-[#dedad2] bg-[#fbfaf7] px-5 py-4 sm:px-6">
          <button type="button" disabled={saving} onClick={onClose} className={`${buttonCls} border border-[#d9d4ca] bg-white text-[#171717]`}>Renunță</button>
          <button type="button" disabled={saving || (custom && !validCustom)} onClick={save} className={`${buttonCls} bg-[#171717] text-white hover:bg-[#30302b]`}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvează coperta</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
