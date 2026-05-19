import { screen } from '@testing-library/react';
import { HomePage } from '@/features/home';
import { renderWithProviders } from '@/test-utils/render';

describe('HomePage', () => {
  it('renders the page heading', async () => {
    renderWithProviders(<HomePage />);
    expect(await screen.findByRole('heading', { name: /Tableau de bord/i })).toBeInTheDocument();
  });

  it('renders stat cards with computed labels from fixture', async () => {
    renderWithProviders(<HomePage />);
    // Stat card labels are always rendered
    expect(await screen.findByText('PMP — Inspections')).toBeInTheDocument();
    expect(await screen.findByText('Injection — Inspections')).toBeInTheDocument();
  });

  it('renders 24 hourly rows in the table', async () => {
    renderWithProviders(<HomePage />);
    // The table rows include hours 00h to 23h
    expect(await screen.findByText('00h')).toBeInTheDocument();
    expect(await screen.findByText('23h')).toBeInTheDocument();
  });

  it('renders non-zero rate for hours with data', async () => {
    renderWithProviders(<HomePage />);
    // Hour 8 has pmp_rate=0.2222 → 22.2%
    expect(await screen.findByText('22.2%')).toBeInTheDocument();
  });

  it('renders the date input', async () => {
    renderWithProviders(<HomePage />);
    expect(await screen.findByLabelText(/Date/i)).toBeInTheDocument();
  });
});
