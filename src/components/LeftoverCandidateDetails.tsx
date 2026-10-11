import React from 'react';
import type { LeftoverItem } from '../types';

export function leftoverSizeLabel(item: LeftoverItem): string {
  if (item.type === 'registry_key') return 'Registry boyutu ölçülmedi; disk alanı kazancı hesaplanamaz.';
  if (typeof item.sizeBytes !== 'number' || !Number.isSafeInteger(item.sizeBytes) || item.sizeBytes < 0) return 'Boyut ölçülemedi.';
  const bytes = item.sizeBytes;
  const size = bytes < 1024 ? `${bytes.toLocaleString('tr-TR')} B`
    : bytes < 1024 ** 2 ? `${(bytes / 1024).toFixed(2)} KB`
    : bytes < 1024 ** 3 ? `${(bytes / 1024 ** 2).toFixed(2)} MB` : `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  const count = Number.isSafeInteger(item.fileCount) && item.fileCount! >= 0 ? ` · ${item.fileCount} dosya` : '';
  return `${size}${count} (tarama anı; dosya boyutu toplamı)`;
}

export function LeftoverCandidateDetails({ item, demo = false }: { item: LeftoverItem; demo?: boolean }) {
  const evidence = item.evidence;
  const kind = item.type === 'registry_key' ? 'anahtar' : item.type === 'folder' ? 'klasör' : 'dosya';
  return <div className="mt-2 space-y-1 font-sans text-[11px] leading-relaxed break-words text-slate-600 dark:text-zinc-400">
    <p><strong>Kaynak:</strong> {item.targetScope} · {kind}</p>
    <p><strong>Boyut:</strong> {demo ? `Demo örneği; gerçek ölçüm yapılmadı.${item.sizeOrDetails ? ' Örnek: ' + item.sizeOrDetails : ''}` : leftoverSizeLabel(item)}</p>
    {evidence ? <>
      <p><strong>Bulunma gerekçesi:</strong> {kind} adı “{evidence.matchedName}”, programın {evidence.matchKind === 'display-name' ? 'görünen adıyla eşleşiyor.' : 'parantez/sürüm bilgisi ayıklanmış adından oluşturuldu.'}
        {evidence.locationKind === 'publisher' && ` Yayıncı-adı alt yolu kullanıldı: “${evidence.publisher || 'Belirtilmemiş'}”.`}</p>
      <p className="text-amber-700 dark:text-amber-300"><strong>Tahmini ilişki:</strong> “{evidence.programName}” — ada dayalı aday; kesin sahiplik kanıtı değildir.</p>
    </> : <p className="text-amber-700 dark:text-amber-300">Bulunma gerekçesi mevcut değil; bu kayıt sahipliği doğrulanmış veri sayılmaz.</p>}
  </div>;
}
