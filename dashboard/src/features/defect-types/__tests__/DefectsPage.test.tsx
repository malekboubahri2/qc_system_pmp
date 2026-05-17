import { screen } from '@testing-library/react';
import { DefectsPage } from '@/features/defect-types';
import { renderWithProviders } from '@/test-utils/render';

describe('DefectsPage', () => {
  it('renders heading and at least one category with cap counter', async () => {
    renderWithProviders(<DefectsPage />);

    expect(await screen.findByRole('heading', { name: /Défauts/i })).toBeInTheDocument();
    // Fixture category name — proves the category list loaded
    expect(await screen.findByText('Peinture')).toBeInTheDocument();
    // Cap counter proves defect_count is rendered
    expect(await screen.findByText('1/12 types')).toBeInTheDocument();
  });
});
