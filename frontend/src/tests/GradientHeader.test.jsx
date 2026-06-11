import React from 'react';
import { render, screen } from '@testing-library/react';
import GradientHeader from '../components/GradientHeader';

describe('GradientHeader', () => {
  test('variant indigo → root has gradient-hero and gradient-header classes', () => {
    const { container } = render(<GradientHeader title="Journal" variant="indigo" />);
    expect(container.firstChild).toHaveClass('gradient-header');
    expect(container.firstChild).toHaveClass('gradient-hero');
  });

  test('variant glucose → root has gradient-glucose class', () => {
    const { container } = render(<GradientHeader title="Glycémie" variant="glucose" />);
    expect(container.firstChild).toHaveClass('gradient-glucose');
  });

  test('variant emerald → root has gradient-health class', () => {
    const { container } = render(<GradientHeader title="Stats" variant="emerald" />);
    expect(container.firstChild).toHaveClass('gradient-health');
  });

  test('variant slate → root has gradient-slate class', () => {
    const { container } = render(<GradientHeader title="Paramètres" variant="slate" />);
    expect(container.firstChild).toHaveClass('gradient-slate');
  });

  test('subtitle rendered in a <p> element', () => {
    render(<GradientHeader title="Journal" subtitle="Aujourd'hui" />);
    expect(screen.getByText("Aujourd'hui").tagName).toBe('P');
  });

  test('children rendered in right slot', () => {
    render(
      <GradientHeader title="Journal">
        <button>Scan</button>
      </GradientHeader>
    );
    expect(screen.getByRole('button', { name: 'Scan' })).toBeInTheDocument();
  });
});
