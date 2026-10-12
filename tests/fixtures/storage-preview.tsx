import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '../../src/App';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';

let root: ReturnType<typeof createRoot>;

// An isolated demo renderer, never the user's live profile or program inventory.
export function mountStoragePreview() {
  const target = document.createElement('div');
  target.id = 'root'; document.body.appendChild(target);
  root = createRoot(target);
  root.render(<ErrorBoundary><App /></ErrorBoundary>);
}

function BrokenFixture() { throw new Error('SIFT_RECOVERY_UI_FIXTURE'); return null; }

export function mountErrorPreview() {
  root.unmount();
  root = createRoot(document.getElementById('root')!);
  root.render(<ErrorBoundary><BrokenFixture /></ErrorBoundary>);
}
