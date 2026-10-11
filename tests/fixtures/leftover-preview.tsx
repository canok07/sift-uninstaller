// Visual-only fixture: no uninstall, scan or delete call is made.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { LeftoverCleanerModal } from '../../src/components/LeftoverCleanerModal';
import type { LeftoverItem } from '../../src/types';

export function mountCandidatePreview() {
  const container = document.createElement('div'); container.id = 'candidate-preview';
  document.body.appendChild(container);
  const root = createRoot(container);
  const items: LeftoverItem[] = [
    { id: 'visual-only-folder', type: 'folder', path: 'C:\\VisualFixture\\ExampleVendor\\ExampleApp', targetScope: '%LocalAppData%', selected: false,
      sizeBytes: 1027, fileCount: 3, evidence: { programName: 'ExampleApp (64-bit)', matchedName: 'ExampleApp', matchKind: 'normalized-name', locationKind: 'publisher', publisher: 'ExampleVendor' } },
    { id: 'visual-only-registry', type: 'registry_key', path: 'HKCU\\Software\\ExampleApp', targetScope: 'HKCU\\Software', selected: false,
      evidence: { programName: 'ExampleApp (64-bit)', matchedName: 'ExampleApp', matchKind: 'normalized-name', locationKind: 'direct' } }
  ];
  root.render(<LeftoverCleanerModal appName="ExampleApp (64-bit)" initialItems={items}
    onClose={() => { root.unmount(); container.remove(); }}
    onCleanSuccess={() => { throw new Error('Visual fixture must never clean data.'); }} />);
}
