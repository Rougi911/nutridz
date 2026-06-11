import React from 'react';
import { render, screen } from '@testing-library/react';
import MacroPillCard from '../components/MacroPillCard';

describe('MacroPillCard', () => {
  test('progress bar width is 60% when value=60 target=100', () => {
    const { container } = render(
      <MacroPillCard icon="🥩" value={60} target={100} label="Protéines" />
    );
    const fill = container.querySelector('.macro-pill__fill');
    expect(fill).toBeInTheDocument();
    expect(fill.style.width).toBe('60%');
    expect(fill).not.toHaveClass('macro-pill__fill--complete');
  });

  test('progress bar capped at 100% when value > target', () => {
    const { container } = render(
      <MacroPillCard icon="🥩" value={150} target={100} label="Protéines" />
    );
    const fill = container.querySelector('.macro-pill__fill');
    expect(fill.style.width).toBe('100%');
  });

  test('adds complete class when value >= target', () => {
    const { container } = render(
      <MacroPillCard icon="🍞" value={100} target={100} label="Glucides" />
    );
    expect(container.querySelector('.macro-pill__fill')).toHaveClass('macro-pill__fill--complete');
  });

  test('renders label and value text', () => {
    render(<MacroPillCard icon="🫒" value={45} target={70} label="Lipides" unit="g" />);
    expect(screen.getByText('Lipides')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
  });
});
