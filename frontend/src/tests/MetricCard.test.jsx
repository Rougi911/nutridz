import React from 'react';
import { render, screen } from '@testing-library/react';
import MetricCard from '../components/MetricCard';

describe('MetricCard', () => {
  test('status good → has metric-card--good class', () => {
    const { container } = render(<MetricCard label="GMI" value="5.7" status="good" />);
    expect(container.firstChild).toHaveClass('metric-card');
    expect(container.firstChild).toHaveClass('metric-card--good');
  });

  test('status warning → has metric-card--warning class', () => {
    const { container } = render(<MetricCard label="TIR" value="62" unit="%" status="warning" />);
    expect(container.firstChild).toHaveClass('metric-card--warning');
  });

  test('renders unit when provided', () => {
    render(<MetricCard label="TIR" value="72" unit="%" status="good" />);
    expect(screen.getByText('%')).toBeInTheDocument();
  });

  test('renders statusText when provided', () => {
    render(
      <MetricCard label="TIR" value="72" unit="%" status="good" statusText="Objectif atteint" />
    );
    expect(screen.getByText('Objectif atteint')).toBeInTheDocument();
  });

  test('default status neutral → has metric-card--neutral class', () => {
    const { container } = render(<MetricCard label="Poids" value="72" unit="kg" />);
    expect(container.firstChild).toHaveClass('metric-card--neutral');
  });
});
