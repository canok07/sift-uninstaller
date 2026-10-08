import React, { useEffect, useState } from 'react';

export function ProgramIcon({ id, revision, real, fallback }: { id: string; revision?: string; real?: boolean; fallback: string }) {
  const [image, setImage] = useState<string>();
  useEffect(() => {
    let active = true;
    setImage(undefined);
    if (real && revision && window.api?.getProgramIcon) {
      void window.api.getProgramIcon(id, revision).then(result => {
        if (active && result.dataUrl && /^data:image\/png;base64,[a-z\d+/=]+$/i.test(result.dataUrl)
          && result.dataUrl.length <= 128 * 1024) setImage(result.dataUrl);
      }).catch(() => {});
    }
    return () => { active = false; };
  }, [id, revision, real]);
  return image ? <img src={image} alt="" width={32} height={32} className="w-8 h-8 object-contain" onError={() => setImage(undefined)} /> : <>{fallback}</>;
}
