import type { Preview } from '@storybook/web-components-vite';
import '@augur/kit-common/tokens.css';
import '../src/base.css';

const preview: Preview = {
  parameters: {
    layout: 'padded',
    backgrounds: { disable: true },
  },
  decorators: [
    (story) => {
      document.body.classList.add('w-ground');
      return story();
    },
  ],
};

export default preview;
