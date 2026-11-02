import { Component, type ReactNode } from 'react';
import { useT } from '@/i18n';
import { Button } from '@/ui/Button';

const Fallback = () => {
  const t = useT();
  return (
    <div role="alert" className="mx-auto max-w-md py-24 text-center">
      <p className="text-lg font-medium">{t.errors.boundary}</p>
      <Button className="mt-4" onClick={() => window.location.reload()}>{t.errors.reload}</Button>
    </div>
  );
};

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { console.error(error); }
  render() { return this.state.failed ? <Fallback /> : this.props.children; }
}
