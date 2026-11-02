import type { Preview } from '@storybook/react-vite';
import '@augur/kit-common/tokens.css';
import '@augur/ui-kit/base.css';
import '@augur/kit-common/kit.css';
import '@augur/app-kit/kit.css';

const preview: Preview = {
  parameters: {
    layout: 'padded',
    backgrounds: { disable: true },
  },
  decorators: [
    (Story) => {
      document.body.classList.add('w-ground');
      return <Story />;
    },
  ],
};

export default preview;
