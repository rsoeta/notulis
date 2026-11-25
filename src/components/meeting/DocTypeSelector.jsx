import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookmarkPlus,
  Check,
  ChevronDown,
  PenLine,
  Plus,
  Search,
  X,
} from 'lucide-react';
import {
  ALL_DOC_TYPE_PRESETS,
  DEFAULT_DOC_TYPE,
  DOC_TYPE_GROUPS,
  isBuiltinDocType,
  loadCustomDocTypes,
  normalizeDocTypeTitle,
  removeCustomDocType,
  saveCustomDocType,
} from '../../utils/docTypes';
import { showToast } from '../../utils/swal';

function findCanonicalOption(val, customTypes) {
  const clean = normalizeDocTypeTitle(val).toLowerCase();
  if (!clean) return '';
  const all = [...customTypes, ...ALL_DOC_TYPE_PRESETS];
  return all.find((item) => item.toLowerCase() === clean) || '';
}

export default function DocTypeSelector({
  value,
  onChange,
  label = 'Jenis Dokumen Notulen',
}) {
  const [customTypes, setCustomTypes] = useState(() => loadCustomDocTypes());
  const [isCustomMode, setIsCustomMode] = useState(() => {
    const clean = normalizeDocTypeTitle(value);
    if (!clean) return false;
    return (
      !isBuiltinDocType(clean) &&
      !loadCustomDocTypes().some((c) => c.toLowerCase() === clean.toLowerCase())
    );
  });
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    const clean = normalizeDocTypeTitle(value);
    if (!clean) return;
    const known = findCanonicalOption(clean, customTypes);
    if (!known) {
      setIsCustomMode(true);
    }
  }, [value, customTypes]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 10);

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const canonicalMatch = useMemo(
    () => findCanonicalOption(value, customTypes),
    [value, customTypes]
  );

  const cleanInput = normalizeDocTypeTitle(value);
  const canSaveToCustomList =
    Boolean(cleanInput) && !findCanonicalOption(cleanInput, customTypes);

  const normalizedQuery = normalizeDocTypeTitle(searchQuery);
  const qLower = normalizedQuery.toLowerCase();

  const filteredCustomTypes = useMemo(() => {
    if (!qLower) return customTypes;
    return customTypes.filter((item) => item.toLowerCase().includes(qLower));
  }, [customTypes, qLower]);

  const filteredGroups = useMemo(() => {
    if (!qLower) return DOC_TYPE_GROUPS;
    return DOC_TYPE_GROUPS.map((group) => {
      if (group.label.toLowerCase().includes(qLower)) {
        return group;
      }
      const matched = group.options.filter((opt) =>
        opt.toLowerCase().includes(qLower)
      );
      return { ...group, options: matched };
    }).filter((group) => group.options.length > 0);
  }, [qLower]);

  const flatFilteredOptions = useMemo(
    () => [
      ...filteredCustomTypes,
      ...filteredGroups.flatMap((group) => group.options),
    ],
    [filteredCustomTypes, filteredGroups]
  );

  const exactMatchForQuery = useMemo(
    () => Boolean(normalizedQuery && findCanonicalOption(normalizedQuery, customTypes)),
    [normalizedQuery, customTypes]
  );

  const displayLabel = isCustomMode
    ? cleanInput || 'Mode Tulis Custom...'
    : canonicalMatch || cleanInput || DEFAULT_DOC_TYPE;

  const selectOption = (opt) => {
    setIsCustomMode(false);
    setIsOpen(false);
    setSearchQuery('');
    onChange(opt);
  };

  const handleQuickAddFromSearch = () => {
    if (!normalizedQuery) return;
    const nextList = saveCustomDocType(normalizedQuery);
    setCustomTypes(nextList);
    setIsCustomMode(false);
    setIsOpen(false);
    setSearchQuery('');
    onChange(normalizedQuery);
    showToast('success', 'Jenis dokumen kustom ditambahkan.');
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setSearchQuery('');
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (flatFilteredOptions.length === 1) {
        selectOption(flatFilteredOptions[0]);
      } else if (normalizedQuery && !exactMatchForQuery) {
        handleQuickAddFromSearch();
      }
    }
  };

  const handleToggleTrigger = () => {
    setIsOpen((prev) => {
      if (prev) setSearchQuery('');
      return !prev;
    });
  };

  const handleToggleMode = () => {
    setIsOpen(false);
    setSearchQuery('');
    if (isCustomMode) {
      setIsCustomMode(false);
      onChange(canonicalMatch || DEFAULT_DOC_TYPE);
    } else {
      setIsCustomMode(true);
    }
  };

  const handleSaveCustom = () => {
    if (!canSaveToCustomList) return;
    const nextList = saveCustomDocType(cleanInput);
    setCustomTypes(nextList);
    setIsCustomMode(false);
    onChange(cleanInput);
    showToast('success', 'Jenis dokumen kustom disimpan ke daftar.');
  };

  const handleRemoveCustom = (item) => {
    const nextList = removeCustomDocType(item);
    setCustomTypes(nextList);
    if (normalizeDocTypeTitle(value).toLowerCase() === item.toLowerCase()) {
      setIsCustomMode(true);
    }
  };

  return (
    <div ref={containerRef} className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="block text-xs font-semibold text-slate-700">
          {label}
        </label>
        <button
          type="button"
          onClick={handleToggleMode}
          className="inline-flex items-center gap-1 min-h-[2rem] px-2 py-1 rounded-lg text-xs font-semibold text-blue-600 hover:bg-blue-50 transition cursor-pointer"
        >
          <PenLine className="w-3.5 h-3.5" />
          <span>{isCustomMode ? 'Pilih Preset' : '+ Custom'}</span>
        </button>
      </div>

      {/* Trigger Select */}
      <button
        type="button"
        onClick={handleToggleTrigger}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="w-full min-h-[2.75rem] px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl flex items-center justify-between gap-2 text-left text-slate-800 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition cursor-pointer"
      >
        <span className="truncate font-medium">{displayLabel}</span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-blue-600' : ''
          }`}
        />
      </button>

      {/* Searchable In-Flow Dropdown */}
      {isOpen && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
          <div className="p-2 border-b border-slate-100 bg-slate-50/80">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Cari jenis dokumen (mis. dinas, proyek, MoM, desa)..."
                className="w-full min-h-[2.5rem] pl-8 pr-8 py-1.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  aria-label="Hapus pencarian"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 min-w-[1.75rem] min-h-[1.75rem] flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div
            role="listbox"
            data-lenis-prevent
            className="max-h-56 overflow-y-auto py-1"
          >
            {filteredCustomTypes.length > 0 && (
              <div>
                <div className="text-[0.7rem] font-bold uppercase tracking-wider text-slate-500 px-3 py-1.5 bg-slate-50/95 sticky top-0">
                  Jenis Dokumen Kustom Saya
                </div>
                {filteredCustomTypes.map((item) => {
                  const isSelected =
                    !isCustomMode &&
                    cleanInput.toLowerCase() === item.toLowerCase();
                  return (
                    <div
                      key={`opt-custom-${item}`}
                      className={`flex items-center justify-between gap-1 px-2 ${
                        isSelected
                          ? 'bg-blue-50 text-blue-700 font-semibold'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <button
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => selectOption(item)}
                        className="flex-1 min-h-[2.5rem] px-1 py-2 text-left text-xs sm:text-sm flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <span className="truncate">{item}</span>
                        {isSelected && <Check className="w-4 h-4 shrink-0" />}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveCustom(item);
                        }}
                        aria-label={`Hapus ${item}`}
                        className="min-w-[2rem] min-h-[2rem] flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {filteredGroups.map((group) => (
              <div key={group.label}>
                <div className="text-[0.7rem] font-bold uppercase tracking-wider text-slate-500 px-3 py-1.5 bg-slate-50/95 sticky top-0">
                  {group.label}
                </div>
                {group.options.map((preset) => {
                  const isSelected =
                    !isCustomMode &&
                    (canonicalMatch || DEFAULT_DOC_TYPE).toLowerCase() ===
                      preset.toLowerCase();
                  return (
                    <button
                      key={preset}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => selectOption(preset)}
                      className={`w-full min-h-[2.5rem] px-3 py-2 text-left text-xs sm:text-sm flex items-center justify-between gap-2 transition cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50 text-blue-700 font-semibold'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="truncate">{preset}</span>
                      {isSelected && <Check className="w-4 h-4 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            ))}

            {flatFilteredOptions.length === 0 && (
              <p className="px-3 py-3 text-center text-xs text-slate-500">
                Tidak ada preset yang cocok.
              </p>
            )}

            {normalizedQuery && !exactMatchForQuery && (
              <div className="px-2 py-1.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleQuickAddFromSearch}
                  className="w-full min-h-[2.5rem] px-3 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold flex items-center gap-2 transition cursor-pointer text-left"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  <span className="truncate">
                    Gunakan &amp; Simpan &ldquo;{normalizedQuery}&rdquo;
                  </span>
                </button>
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 p-1.5 bg-slate-50/60">
            <button
              type="button"
              onClick={() => {
                setIsCustomMode(true);
                setIsOpen(false);
                setSearchQuery('');
              }}
              className="w-full min-h-[2.5rem] px-3 py-1.5 rounded-lg text-left text-xs font-semibold text-blue-600 hover:bg-blue-50 transition cursor-pointer"
            >
              ✎ Tulis Jenis Dokumen Custom...
            </button>
          </div>
        </div>
      )}

      {isCustomMode && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-2">
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              maxLength={80}
              placeholder="Contoh: NOTULEN RAPAT TIM PRODUK / BERITA ACARA SERAH TERIMA"
              className="flex-1 basis-[13rem] min-h-[2.75rem] px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              disabled={!canSaveToCustomList}
              onClick={handleSaveCustom}
              className="min-h-[2.75rem] px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-45 text-white text-xs font-semibold rounded-xl inline-flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <BookmarkPlus className="w-4 h-4" />
              <span>Simpan ke Daftar</span>
            </button>
          </div>

          {customTypes.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500">Tersimpan:</p>
              <div className="flex flex-wrap gap-1.5">
                {customTypes.map((item) => {
                  const isActive =
                    normalizeDocTypeTitle(value).toLowerCase() ===
                    item.toLowerCase();
                  return (
                    <span
                      key={`chip-${item}`}
                      className={`inline-flex items-center rounded-lg border text-xs font-medium overflow-hidden ${
                        isActive
                          ? 'bg-blue-50 border-blue-300 text-blue-700'
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onChange(item);
                          setIsCustomMode(false);
                        }}
                        className="px-2.5 py-1 hover:bg-slate-100/70 transition cursor-pointer"
                      >
                        {item}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveCustom(item)}
                        aria-label={`Hapus ${item}`}
                        className="px-1.5 py-1 text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
