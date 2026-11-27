'use client';

import React, { useState } from 'react';

interface DumpPropertiesButtonProps {
  runId: string;
  path?: string | null;
  contents?: string | null;
}

export function DumpPropertiesButton({ runId, path, contents }: DumpPropertiesButtonProps) {
  const defaultName =
    (path && path.trim() !== '' ? path.split('/').pop() : '') || `run-${runId}-user-test-properties.properties`;

  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState(defaultName);

  const download = (name: string) => {
    if (!contents) {
      window.alert('No auto-generated user test case properties are recorded for this run.');
      return;
    }

    const text = String(contents).split('|').join('\n');
    const filename = name.trim() !== '' ? name.trim() : defaultName;

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setFileName(defaultName);
          setOpen(true);
        }}
        disabled={!contents}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-500/40 bg-slate-800/40 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700/60 transition-colors disabled:opacity-50"
        title="Dump the auto-generated user test case properties to a text file"
      >
        Dump User Test Case Properties
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <h3 className="text-base font-bold text-white">Dump User Test Case Properties</h3>
            <p className="mt-1 text-xs text-slate-400">
              Choose the file name for the dumped properties file.
            </p>

            <div className="mt-4">
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">File name</label>
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => download(fileName)}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
              >
                Dump
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}