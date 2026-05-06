import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Page from './page';

describe('Page', () => {
  it('renders the landing content', () => {
    render(<Page />);

    expect(screen.getByText('Project ready!')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Button' })).toBeInTheDocument();
  });
});
