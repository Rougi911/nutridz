import React from 'react';
import { renderWithProviders, screen } from './test-utils';

test('renderWithProviders renders children', () => {
  renderWithProviders(<div>hello</div>);
  expect(screen.getByText('hello')).toBeInTheDocument();
});
