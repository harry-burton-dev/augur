import type { Preview } from '@storybook/web-components-vite';
import '../dist/tokens.css';
import '../src/base.css';
// The typefaces, from this origin as the shell serves them (platform/frontends/shell/src/fonts.ts).
import '@fontsource/jost/200.css';
import '@fontsource/jost/300.css';
import '@fontsource/jost/400.css';
import '@fontsource/jost/500.css';
import '@fontsource/jost/600.css';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/600.css';

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
